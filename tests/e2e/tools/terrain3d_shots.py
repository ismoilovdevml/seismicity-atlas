"""Render the documentation screenshots of the relief base map and the Depth 3D view into docs/img/.

Usage (needs Playwright with Chromium, and Pillow for the palette step):

    python tests/e2e/tools/terrain3d_shots.py [--chromium /path/to/chrome] [--only name]

The pages are the real site with the real data, served locally. 3D terrain is not shown (it needs the external
tiles). Each PNG over 400 KB is reduced to a 256-colour palette (fast octree, which keeps the map class colours).
"""
import argparse
import functools
import http.server
import io
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
SITE = ROOT / "site"
IMG = ROOT / "docs" / "img"
LIMIT = 400_000

SHOTS = {  # name: (hash, viewport, scheme, wait-for selector)
    "site-relief-light": ("#v=map&at=2.6/30/92&lang=en", (1440, 900), "light", None),
    "site-relief-dark-phone": ("#v=map&at=2.2/-18/-70&lang=en", (390, 844), "dark", None),
    "site-3d-light": ("#v=depth&p3=japan&e3=5&lang=en", (1440, 900), "light", "canvas.d3-canvas[data-view]"),
    "site-3d-dark-phone": ("#v=depth&p3=tonga&lang=en", (390, 844), "dark", "canvas.d3-canvas[data-view]"),
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def save(png: bytes, out: Path):
    from PIL import Image
    for colours in (256,):
        if len(png) <= LIMIT:
            break
        im = Image.open(io.BytesIO(png)).convert("RGB").quantize(colours, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
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
        for name, (hash_, (w, h), scheme, sel) in SHOTS.items():
            if a.only and a.only != name:
                continue
            ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, device_scale_factor=1)
            ctx.add_init_script("window.__gsaTestHook = (m) => { window.__map = m; };")
            pg = ctx.new_page()
            pg.goto(base + hash_)
            pg.wait_for_selector("#map-status", state="hidden", timeout=60000)
            if sel:
                pg.wait_for_selector(sel, timeout=60000)
            else:
                pg.wait_for_function("window.__map && window.__map.loaded() && window.__map.isSourceLoaded('relief')", timeout=60000)
            if sel and w < 600:  # phones: the scene sits below the controls
                pg.evaluate("document.getElementById('d3-stage').scrollIntoView({block: 'start'})")
            pg.wait_for_timeout(1500)
            n = save(pg.screenshot(), IMG / f"{name}.png")
            print(f"{name}.png {n / 1e3:.0f} kB")
            ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
