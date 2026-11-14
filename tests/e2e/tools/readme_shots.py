"""Render every screenshot the README uses (docs/img/readme/*.png) and the b-palette comparison (docs/img/ux/).

Usage (needs Playwright with Chromium, and Pillow for the size step):

    python tests/e2e/tools/readme_shots.py [--chromium /path/to/chrome] [--only name]

Deterministic by construction: the real site and the committed data in site/data/, served locally; a fixed viewport,
device scale 1, time zone Asia/Tokyo (the first globe view turns to the time-zone longitude, so it shows the western
Pacific), a fixed colour scheme, reduced motion (animated diagrams draw their final frame), the first-visit tour marked
as seen, and a fixed language. A PNG over 400 KB is reduced to a 256-colour palette. Screenshots are refreshed on each
release (docs/release.md); they are not rendered in CI. tests/test_readme.py checks that every image the README uses
exists and that every file in docs/img/readme/ is used.
"""
import argparse
import functools
import http.server
import io
import json
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
IMG = ROOT / "docs" / "img"
LIMIT = 400_000


def place(name, country):
    doc = json.loads((SITE / "data" / "places.json").read_text())
    col = {c: i for i, c in enumerate(doc["columns"])}
    for r in doc["rows"]:
        if r[col["n"]] == name and doc["countries"][r[col["c"]]] == country:
            return f"{r[col['y']]:.3f}/{r[col['x']]:.3f}"
    raise LookupError(name)


# name: (output dir, hash, viewport, scheme, stored mode, wait selector, action)
SHOTS = {
    "simple-globe": ("readme", "#v=map&mode=simple&lang=en", (1440, 900), "light", None, None, "search"),
    "phone-place-card": ("readme", f"#v=map&mode=simple&p={place('Tokyo', 'Japan')}&lang=en", (390, 844), "dark", None,
                         "#sx-card:not([hidden]) [data-stat=n6]", None),
    "scientist": ("readme", "#v=map&l=b&d=sh&c=822f5ffffffffff&at=2.7/30/150&lang=en", (1440, 900), "light", "pro",
                  "#panel-body .chart-svg", None),
    "ongoing": ("readme", "#v=monitor&mode=pro&lang=en", (1440, 900), "light", "pro", ".mon-seq .chart-svg", None),
    "depth3d": ("readme", "#v=depth&p3=turkey&e3=5&lang=en", (1440, 900), "light", "pro", "canvas.d3-canvas[data-view]", None),
    "learn": ("readme", "#v=learn&t=induced-seismicity&mode=simple&lang=en", (1440, 900), "light", None,
              ".lr-diagram[data-ready='1']", None),
    "groningen": ("readme", "#v=cases&cs=groningen&mode=pro&lang=en", (1440, 900), "light", "pro",
                  ".cs-bmap svg", None),
    "deficit": ("readme", "#v=map&l=b&d=sh&df=1&dz=ts_central&at=3.7/41.5/76.5&mode=pro&lang=en", (1440, 900), "light", "pro",
                "#panel-body .df-panel", None),
    # The b classes on the Scientist map (light theme), for the palette decision in docs/ux-notes.md.
    "b-palette-after": ("ux", "#v=map&l=b&d=sh&pl=1&at=2.4/-12/170&mode=pro&lang=en", (1200, 760), "light", "pro",
                        None, None),
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def save(png: bytes, out: Path) -> int:
    """Write a PNG; above LIMIT, reduce it to a 256-colour palette (fast octree keeps the map class colours)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    if len(png) > LIMIT:
        from PIL import Image
        im = Image.open(io.BytesIO(png)).convert("RGB").quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        png = buf.getvalue()
    out.write_bytes(png)
    return len(png)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chromium")
    ap.add_argument("--only")
    a = ap.parse_args()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_port}/"
    with sync_playwright() as p:
        b = p.chromium.launch(**({"executable_path": a.chromium} if a.chromium else {}))
        for name, (sub, hash_, (w, h), scheme, mode, wait, action) in SHOTS.items():
            if a.only and a.only != name:
                continue
            ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, device_scale_factor=1,
                                timezone_id="Asia/Tokyo", locale="en-US", reduced_motion="reduce")
            ctx.add_init_script("window.__gsaTestHook = (m) => { window.__map = m; };")
            ctx.add_init_script("try { localStorage.setItem('gsa-tour', '1'); } catch (e) {}")
            if mode:
                ctx.add_init_script(f"try {{ localStorage.setItem('gsa-mode', '{mode}'); }} catch (e) {{}}")
            pg = ctx.new_page()
            pg.goto(base + hash_)
            if "v=map" in hash_:
                pg.wait_for_selector("#map-status", state="hidden", timeout=60000)
                pg.wait_for_function("window.__map && window.__map.loaded() && window.__map.isSourceLoaded('relief')",
                                     timeout=60000)
            if wait:
                pg.wait_for_selector(wait, timeout=60000)
            if action == "search":  # the search with its suggestions open
                pg.click("#sx-q")
                pg.keyboard.type("San", delay=40)
                pg.wait_for_selector("#sx-list:not([hidden]) [data-place]", timeout=30000)
            if "v=map" in hash_:
                pg.wait_for_function("!window.__map.isMoving() && window.__map.loaded()", timeout=30000)
            pg.wait_for_timeout(1500)
            n = save(pg.screenshot(), IMG / sub / f"{name}.png")
            print(f"{sub}/{name}.png {n / 1e3:.0f} kB")
            ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
