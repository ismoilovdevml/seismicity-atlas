"""Render the social-card image site/og-image.png (1200 x 630) from the live map code and the real data.

Usage (needs Playwright with Chromium, and Pillow for the palette step):

    python tests/e2e/tools/og_image.py [--chromium /path/to/chrome]

The map is drawn by the site itself (globe, b-value layer, shallow, only cells of quality A/B, plate boundaries);
a title card with the live count of cells that pass the quality gate is laid over it. Dark scheme by default.
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
.top, .disclaimer, .rail, .chips, .map-buttons, .legend, .attrib, .panel, .tooltip, .sx, .tour { display: none !important; }
#view-map { grid-template-columns: 1fr !important; }
.map-area { grid-column: 1 / -1 !important; }
.og-card { position: absolute; left: 40px; top: 50%; transform: translateY(-50%); z-index: 10; width: 430px; padding: 28px 30px;
  background: color-mix(in srgb, var(--surface) 88%, transparent); border: 1px solid var(--rule); border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,.35); display: flex; flex-direction: column; gap: 10px; font-family: var(--font); color: var(--ink); }
.og-card h1 { margin: 0; font-size: 34px; line-height: 1.08; letter-spacing: -0.02em; font-weight: 650; }
.og-card .sub { margin: 0; font-size: 16px; line-height: 1.4; color: var(--ink-2); }
.og-card .big { margin: 6px 0 0; font-size: 64px; line-height: 1; font-weight: 700; letter-spacing: -0.03em; color: var(--accent); }
.og-card .bigtxt { margin: 0; font-size: 16px; line-height: 1.35; color: var(--ink-2); }
.og-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; margin-top: 6px; }
.og-bar div { height: 12px; }
.og-ticks { display: grid; grid-template-columns: repeat(6, 1fr); font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
.og-ticks span { transform: translateX(-50%); }
.og-ticks span:first-child { visibility: hidden; }
.og-foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; }
.og-url { font-family: var(--mono); font-size: 16px; color: var(--accent); }
.og-warn { font-size: 13px; color: var(--ink-3); }
"""

# The headline number is read from the published data, so the card follows the monthly update.
CARD_JS = """async () => {
  const cells = (await (await fetch('data/cells.geojson')).json()).features.map((f) => f.properties);
  const ok = cells.filter((p) => p.sh_q === 'A' || p.sh_q === 'B').length;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const colors = dark ? ['#4a7cc0', '#7ea3d3', '#b4c9e2', '#ebc08f', '#de9550', '#c06a30']   // layers.js B_DARK
                      : ['#001261', '#05528a', '#5d9cbb', '#cf8c66', '#a74310', '#590008']; // layers.js B_LIGHT (Crameri vik)
  const card = document.createElement('div');
  card.className = 'og-card';
  card.innerHTML = `<h1>Global Seismicity Atlas</h1>
    <p class="sub">Earthquake b-value and completeness, with uncertainty, from open global catalogues.</p>
    <p class="big">${ok}</p>
    <p class="bigtxt">of ${cells.length.toLocaleString('en')} places with earthquakes have enough data for a trustworthy b-value (shallow, M&nbsp;≥&nbsp;5).</p>
    <div><div class="og-bar">${colors.map((c) => `<div style="background:${c}"></div>`).join('')}</div>
    <div class="og-ticks"><span></span><span>0.8</span><span>0.9</span><span>1.0</span><span>1.1</span><span>1.2</span></div></div>
    <div class="og-foot"><span class="og-url">seismicityatlas.org</span><span class="og-warn">Not a forecast</span></div>`;
  document.getElementById('map-area').append(card);
  // only the cells that pass the quality gate: grey and hatched cells clutter a small card image
  const m = window.__map;
  m.setFilter('cells-fill', ['in', ['get', 'sh_q'], ['literal', ['A', 'B']]]);
  if (m.getLayer('cells-hatch')) m.setLayoutProperty('cells-hatch', 'visibility', 'none');
  // globe to the right of the card
  m.setPadding({ left: 470, right: 0, top: 0, bottom: 0 });
  m.jumpTo({ center: [LON, LAT], zoom: ZOOM });
  return ok;
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chromium", help="path to a Chromium executable (default: Playwright's)")
    ap.add_argument("--scheme", default="dark", choices=["dark", "light"])
    ap.add_argument("--view", default="2.1/8/172", help="globe zoom/lat/lon, centred right of the card")
    args = ap.parse_args()

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(**({"executable_path": args.chromium} if args.chromium else {}))
        ctx = b.new_context(viewport={"width": 1200, "height": 630}, color_scheme=args.scheme, device_scale_factor=1)
        ctx.add_init_script("window.__gsaTestHook = (m) => { window.__map = m; };")
        pg = ctx.new_page()
        pg.goto(f"http://127.0.0.1:{srv.server_port}/#v=map&l=b&d=sh&g=1&mode=pro&lang=en")
        pg.wait_for_selector("#map-status", state="hidden", timeout=60000)
        pg.add_style_tag(content=CARD_CSS)
        z, la, lo = args.view.split("/")
        print("cells with a shown b:", pg.evaluate(CARD_JS.replace("LON", lo).replace("LAT", la).replace("ZOOM", z)))
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
