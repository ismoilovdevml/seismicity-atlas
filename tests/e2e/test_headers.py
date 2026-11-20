"""site/_headers (Cloudflare Pages): the cache rules and the security headers, with the Content-Security-Policy applied
by a local server so the browser enforces it. Playwright's own routing cannot add response headers to the page's
requests, hence the server here."""
import base64
import functools
import hashlib
import http.server
import re
import threading
import time

import pytest

from conftest import SITE


def parse_headers():
    rules, cur = {}, None
    for line in (SITE / "_headers").read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith((" ", "\t")):
            cur = line.strip()
            rules[cur] = []
            continue
        rules[cur].append(line.strip())
    return rules


def test_inline_script_hash_matches_the_csp():
    rules = parse_headers()
    csp = next(v.split(":", 1)[1] for v in rules["/*"] if v.startswith("Content-Security-Policy:"))
    html = (SITE / "index.html").read_text()
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    assert scripts, "index.html has no inline start-up script any more: drop its hash from the CSP"
    for s in scripts:
        digest = base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
        assert f"'sha256-{digest}'" in csp, "update the script hash in site/_headers"


def test_cache_rules_do_not_stack():
    """Cloudflare joins a header set by several matching rules: a narrower data rule must detach the wider one."""
    rules = parse_headers()
    assert any("immutable" in v for v in rules["/vendor/*"])
    for path in ("/data/manifest.json", "/data/monitor/*"):
        assert rules[path][0] == "! Cache-Control", path
    for path in ("/js/*", "/css/*"):
        assert any("must-revalidate" in v for v in rules[path]), path
    assert all(not v.startswith("Cache-Control") for v in rules["/*"])


@pytest.fixture(scope="module")
def csp_url():
    extra = [v.split(":", 1) for v in parse_headers()["/*"]]

    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            for k, v in extra:
                self.send_header(k.strip(), v.strip())
            super().end_headers()

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/"
    srv.shutdown()


WATCH = """window.__gsaTestHook = (m) => { window.__map = m; };
window.__csp = [];
document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
try { localStorage.setItem('gsa-tour', '1'); } catch (e) {}"""


def poll(pg, js, timeout=60):
    """wait_for_function evaluates a string, which the CSP (rightly) forbids: poll with evaluate instead."""
    end = time.time() + timeout
    while time.time() < end:
        if pg.evaluate(js):
            return
        time.sleep(0.25)
    raise AssertionError(f"timed out: {js}")


def test_site_works_under_its_csp(browser, csp_url):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(WATCH)
    # the optional 3D terrain is the only outside source; answer it locally so the test needs no network
    ctx.route("https://s3.amazonaws.com/**", lambda r: r.fulfill(status=204, body=""))
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    try:
        pg.goto(csp_url + "#v=map&mode=simple")
        poll(pg, "() => window.__map && window.__map.loaded() && document.getElementById('map-status').hidden")
        pg.click("#sx-mag [data-sm='5']")  # the M5 worker
        poll(pg, "() => document.getElementById('sx-yr-hint').textContent === ''", 120)
        pg.click("#mode-seg [data-mode=pro]")
        pg.check("#chk-m5")
        poll(pg, "() => !document.getElementById('chk-m5').disabled && /\\d/.test(document.getElementById('ev-count').textContent)", 120)
        pg.evaluate("location.hash = '#v=depth&mode=pro'")  # three.js and WebGL
        poll(pg, "() => !!document.querySelector('#d3-stage canvas.d3-canvas, #d3-stage .d3-xs')", 60)
        pg.evaluate("location.hash = '#v=learn&t=omori-utsu'")
        poll(pg, "() => !!document.querySelector('#learn-root [data-ready=\"1\"]')", 60)
        pg.evaluate("location.hash = '#v=analyze&mode=pro'")
        poll(pg, "() => document.getElementById('analyze-root').children.length > 0", 30)
        pg.evaluate("location.hash = '#v=map&mode=pro&tr=1'")
        pg.wait_for_timeout(1500)
        assert pg.evaluate("window.__csp") == []
        assert pg.evaluate("document.documentElement.dataset.mode") == "pro"  # the inline start-up script ran
        bad = [e for e in errors if "Content Security Policy" in e or "Refused" in e]
        assert not bad, bad
    finally:
        ctx.close()
