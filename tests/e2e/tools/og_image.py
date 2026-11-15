"""Render the social-card image site/og-image.png (1200 x 630) from the live map code and the real data.

Usage (needs Playwright with Chromium, and Pillow for the palette step):

    python tests/e2e/tools/og_image.py [--chromium /path/to/chrome]

The map is drawn by the site itself (b-value layer, shallow, plate boundaries); a title card is laid over it.
The PNG is reduced to a 96-colour palette to stay well under 300 KB.
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
OUT = SITE / "og-image.png"

CARD_CSS = """
.top, .disclaimer, .rail, .chips, .map-buttons, .legend, .attrib, .panel, .tooltip { display: none !important; }
#view-map { grid-template-columns: 1fr !important; }
.map-area { grid-column: 1 / -1 !important; }
.og-card { position: absolute; left: 36px; bottom: 36px; z-index: 10; width: 470px; padding: 24px 28px;
  background: var(--surface); border: 1px solid var(--rule); border-radius: 14px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 12px; font-family: var(--font); color: var(--ink); }
.og-card h1 { margin: 0; font-size: 36px; line-height: 1.1; letter-spacing: -0.02em; font-weight: 650; }
.og-card p { margin: 0; font-size: 17px; line-height: 1.4; color: var(--ink-2); }
.og-card .warn { font-size: 15px; color: var(--note-fg); background: var(--note-bg); border: 1px solid var(--note-border);
  border-radius: 8px; padding: 6px 10px; width: fit-content; }
.og-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; margin-top: 4px; }
.og-bar div { height: 14px; }
.og-ticks { display: grid; grid-template-columns: repeat(6, 1fr); font-family: var(--mono); font-size: 13px; color: var(--ink-3); }
.og-ticks span { transform: translateX(-50%); }
.og-ticks span:first-child { visibility: hidden; }
.og-url { font-family: var(--mono); font-size: 15px; color: var(--accent); }
"""

CARD_JS = """() => {
  const css = getComputedStyle(document.documentElement);
  const colors = ['#001261', '#05528a', '#5d9cbb', '#cf8c66', '#a74310', '#590008']; // layers.js B_LIGHT (Crameri vik)
  const card = document.createElement('div');
  card.className = 'og-card';
  card.innerHTML = `<h1>Global Seismicity Atlas</h1>
    <p>Gutenberg-Richter b-value with its 95&nbsp;% interval, completeness and catalogue agreement, from open global catalogues.</p>
    <div><div class="og-bar">${colors.map((c) => `<div style="background:${c}"></div>`).join('')}</div>
    <div class="og-ticks"><span></span><span>0.8</span><span>0.9</span><span>1.0</span><span>1.1</span><span>1.2</span></div></div>
    <span class="warn">Not a forecast. Not a hazard map.</span>
    <span class="og-url">seismicityatlas.org</span>`;
  document.getElementById('map-area').append(card);
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chromium", help="path to a Chromium executable (default: Playwright's)")
    args = ap.parse_args()

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(**({"executable_path": args.chromium} if args.chromium else {}))
        ctx = b.new_context(viewport={"width": 1200, "height": 630}, color_scheme="light", device_scale_factor=1)
        ctx.add_init_script("window.__gsaTestHook = (m) => { window.__map = m; };")
        pg = ctx.new_page()
        pg.goto(f"http://127.0.0.1:{srv.server_port}/#v=map&l=b&d=sh&at=1.1/8/-165&g=0&mode=pro&lang=en")
        pg.wait_for_selector("#map-status", state="hidden", timeout=60000)
        pg.add_style_tag(content=CARD_CSS)
        pg.evaluate(CARD_JS)
        pg.evaluate("window.__map.resize()")
        pg.wait_for_function("window.__map.loaded() && !window.__map.isMoving()")
        pg.wait_for_timeout(1500)
        png = pg.screenshot(type="png")
        b.close()
    srv.shutdown()
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(png)).convert("RGB").quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        im.save(OUT, optimize=True)
    except ImportError:
        OUT.write_bytes(png)
    print(OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
