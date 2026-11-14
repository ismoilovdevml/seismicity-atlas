"""Render the v0.3 documentation screenshots (Simple and Scientist views) into docs/img/site-v3-*.png.

Usage (needs Playwright with Chromium, and Pillow for the palette step):

    python tests/e2e/tools/site_v3_shots.py [--chromium /path/to/chrome] [--only name]

The pages are the real site with the real data, served locally. Each PNG over 400 KB is reduced to a 256-colour
palette, as in terrain3d_shots.py.
"""
import argparse
import functools
import http.server
import json
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

from terrain3d_shots import save

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
IMG = ROOT / "docs" / "img"


def place(name, country):
    doc = json.loads((SITE / "data" / "places.json").read_text())
    col = {c: i for i, c in enumerate(doc["columns"])}
    for r in doc["rows"]:
        if r[col["n"]] == name and doc["countries"][r[col["c"]]] == country:
            return f"{r[col['y']]:.3f}/{r[col['x']]:.3f}"
    raise LookupError(name)


# name: (hash, viewport, scheme, stored mode, actions)
SHOTS = {
    "site-v3-simple-light": ("#v=map&mode=simple&at=1.75/22/120&lang=en", (1440, 900), "light", None, "search"),
    "site-v3-phone-dark-card": (f"#v=map&mode=simple&p={place('Tokyo', 'Japan')}&lang=en", (390, 844), "dark", None, None),
    "site-v3-expert": ("#v=map&l=b&d=sh&c=822f5ffffffffff&at=3.4/36.5/141&lang=en", (1440, 900), "light", "pro", None),
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


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
        for name, (hash_, (w, h), scheme, mode, action) in SHOTS.items():
            if a.only and a.only != name:
                continue
            ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, device_scale_factor=1)
            ctx.add_init_script("window.__gsaTestHook = (m) => { window.__map = m; };")
            ctx.add_init_script("try { localStorage.setItem('gsa-tour', '1'); } catch (e) {}")
            if mode:
                ctx.add_init_script(f"try {{ localStorage.setItem('gsa-mode', '{mode}'); }} catch (e) {{}}")
            pg = ctx.new_page()
            pg.goto(base + hash_)
            pg.wait_for_selector("#map-status", state="hidden", timeout=60000)
            pg.wait_for_function("window.__map && window.__map.loaded() && window.__map.isSourceLoaded('relief')", timeout=60000)
            if "&p=" in hash_:
                pg.wait_for_selector("#sx-card:not([hidden]) [data-stat=n6]", timeout=30000)
            if mode == "pro":
                pg.wait_for_selector("#panel-body .chart-svg", timeout=30000)
            if action == "search":  # the search with its suggestions open
                pg.click("#sx-q")
                pg.keyboard.type("San", delay=40)
                pg.wait_for_selector("#sx-list:not([hidden]) [data-place]", timeout=30000)
            pg.wait_for_function("!window.__map.isMoving()", timeout=30000)
            pg.wait_for_timeout(1500)
            n = save(pg.screenshot(), IMG / f"{name}.png")
            print(f"{name}.png {n / 1e3:.0f} kB")
            ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
