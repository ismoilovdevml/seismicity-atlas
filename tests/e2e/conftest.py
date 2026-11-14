"""Browser tests for the static site in site/.

The site is served from a local http.server on a free port. Browsers come from Playwright; choose them with
E2E_BROWSERS (comma-separated: chromium, firefox, webkit; default chromium). Run:

    E2E_BROWSERS=chromium,firefox,webkit python -m pytest tests/e2e -q

The suite skips itself when Playwright is not installed, so `pytest tests/` keeps working without it.
"""
import functools
import http.server
import os
import threading
from pathlib import Path

import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
BROWSERS = [b.strip() for b in os.environ.get("E2E_BROWSERS", "chromium").split(",") if b.strip()]
VIEWPORTS = {"desktop": (1440, 900), "phone": (390, 844)}

# Defined before any page script runs. map.js calls it with the MapLibre map; normal visits never define it.
TEST_HOOK = "window.__gsaTestHook = (m) => { window.__map = m; };"

# The site opens in the Simple view for new visitors (v0.3). The tests written for the Scientist view open the site as
# a visitor who chose it before: gsa-mode=pro in localStorage, set only when absent so a test can still change it.
# Every test also starts with the first-visit tour already seen, except the tests that pass tour=True.
def _store_default(key, value):
    return f"try {{ if (localStorage.getItem('{key}') === null) localStorage.setItem('{key}', '{value}'); }} catch (e) {{}}"

# Console noise that does not come from the site's code.
IGNORED_CONSOLE = (
    "GPU stall due to ReadPixels",  # headless Chromium WebGL driver
    "READ-usage buffer",
    "WebGL warning",  # Firefox software WebGL
    "Failed to load resource",
    # Benign by spec (resize observers re-notified in the same frame); Firefox reports it as an error event
    "ResizeObserver loop completed with undelivered notifications",  # expected 404 for the optional regional index; HTTP errors are checked separately
)


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(_Quiet, directory=str(SITE))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/"
    srv.shutdown()


@pytest.fixture(scope="session")
def pw():
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session", params=BROWSERS)
def browser(request, pw):
    opts = {}
    # Optional local override, e.g. a Chrome for Testing build that is already on disk.
    exe = os.environ.get(f"E2E_{request.param.upper()}_PATH")
    if exe:
        opts["executable_path"] = exe
    b = getattr(pw, request.param).launch(**opts)
    yield b
    b.close()


class Site:
    """Opens pages with the test hook, collects errors, and gives small helpers."""

    def __init__(self, browser, base_url):
        self.browser = browser
        self.base = base_url
        self.pages = []

    def open(self, hash_="", viewport="desktop", scheme="light", regional=False, ready=True, locale="en-US", routes=(),
             mode="pro", tour=False, size=None):
        """mode: the stored view mode ("pro", "simple" or None for a first visit); tour: show the first-visit tour."""
        w, h = size or VIEWPORTS[viewport]
        # The globe's first view turns to the visitor's time-zone longitude, so rendered-feature counts depend on
        # the time zone. Pin it (the CI runner is UTC, which faces the Atlantic); override with E2E_TZ.
        ctx = self.browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, locale=locale,
                                       timezone_id=os.environ.get("E2E_TZ", "Asia/Tashkent"), accept_downloads=True)
        ctx.add_init_script(TEST_HOOK)
        if mode:
            ctx.add_init_script(_store_default("gsa-mode", mode))
        if not tour:
            ctx.add_init_script(_store_default("gsa-tour", "1"))
        if regional:
            ctx.route("**/data/regional/**", _serve_fixture)
        for pattern, handler in routes:
            ctx.route(pattern, handler)
        pg = ctx.new_page()
        pg.errors = []
        pg.on("pageerror", lambda e: pg.errors.append(f"pageerror: {e}")
              if not any(s in str(e) for s in IGNORED_CONSOLE) else None)
        pg.on("console", lambda m: pg.errors.append(f"console.{m.type}: {m.text}")
              if m.type == "error" and not any(s in m.text for s in IGNORED_CONSOLE) else None)
        pg.on("response", lambda r: pg.errors.append(f"HTTP {r.status} {r.url}")
              if r.status >= 400 and "/data/regional/" not in r.url else None)
        self.pages.append(pg)
        pg.goto(self.base + hash_)
        if ready:
            wait_map(pg)
        return pg

    def close(self):
        errs = []
        for pg in self.pages:
            errs += pg.errors
            pg.context.close()
        return errs


def _serve_fixture(route):
    rel = route.request.url.split("/data/regional/", 1)[1].split("?")[0]
    path = (FIXTURES / "regional" / rel).resolve()
    if FIXTURES not in path.parents or not path.is_file():
        route.fulfill(status=404, body="not found")
    else:
        route.fulfill(status=200, body=path.read_bytes(), content_type="application/json")


@pytest.fixture
def site(browser, base_url):
    s = Site(browser, base_url)
    yield s
    errs = s.close()
    assert not errs, "page errors:\n" + "\n".join(errs[:20])


def wait_map(pg, timeout=30000):
    pg.wait_for_selector("#map-status", state="hidden", timeout=timeout)
    pg.wait_for_function("window.__map && window.__map.loaded() && !window.__map.isMoving()", timeout=timeout)
    pg.wait_for_timeout(300)


def cell_point(pg, cid):
    """Page coordinates of a cell centre (nearest world copy)."""
    return pg.evaluate("""(cid) => { const m = window.__map;
      const f = m.querySourceFeatures('cells', {filter: ['==', ['get', 'id'], cid]})[0]; const p = f.properties;
      let lon = p.lon; const c = m.getCenter().lng; while (lon - c > 180) lon -= 360; while (c - lon > 180) lon += 360;
      const pt = m.project([lon, p.lat]); const r = m.getContainer().getBoundingClientRect();
      return [pt.x + r.left, pt.y + r.top]; }""", cid)


def rendered(pg, layer):
    return pg.evaluate("(l) => window.__map.getLayer(l) ? window.__map.queryRenderedFeatures({layers: [l]}).length : -1", layer)


def no_hscroll(pg):
    r = pg.evaluate("""() => { const v = document.querySelector('.view:not([hidden])');
      return [document.documentElement.scrollWidth, innerWidth, v.scrollWidth, v.clientWidth]; }""")
    return r[0] <= r[1] and r[2] <= r[3] + 1, r


def jump(pg, lon, lat, z):
    pg.evaluate("([lon, lat, z]) => window.__map.jumpTo({center: [lon, lat], zoom: z})", [lon, lat, z])
    pg.wait_for_function("!window.__map.isMoving() && window.__map.loaded()")
    pg.wait_for_timeout(250)
