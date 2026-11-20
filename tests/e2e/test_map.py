"""Map view: layers, tooltip, cell panel, events, URL state, globe, list, keyboard and theme."""
import json
import re

import pytest

from conftest import SITE, cell_point, jump, no_hscroll, rendered

CELL_A = "8222effffffffff"  # Aleutians, shallow, b shown (quality B in 0.6.0; 820cc... before)
CELL_B = "820cdffffffffff"  # neighbour with a detail file (shallow quality C since 0.5.0)
LAYERS = [("q", [None]), ("mc", ["ig", "cc", "cc0"]), ("cc", ["flag", "dmw", "dloc"]), ("rate", [None]), ("none", [None]),
          ("b", [None])]


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_layers_render(site, viewport):
    pg = site.open(viewport=viewport)
    assert "b-value" in pg.inner_text("#legend")
    ok, r = no_hscroll(pg)
    assert ok, r
    if viewport == "phone":
        pg.click("#chip-more")
    for lay, subs in LAYERS:
        pg.check(f"input[name=layer][value={lay}]", force=True)
        for sub in subs:
            if sub:
                pg.select_option("#sub-select", sub)
            pg.wait_for_timeout(200)
            n = rendered(pg, "cells-fill")
            assert n > 100 or lay == "none", (lay, sub, n)
            assert len(pg.inner_text("#legend")) > 8
    pg.check("input[name=depth][value=dp]", force=True)
    pg.wait_for_timeout(200)
    assert "d=dp" in pg.evaluate("location.hash")


def test_tooltip_carries_interval_and_quality(site):
    pg = site.open("#g=0")  # hovers a cell at its place on the flat world view
    x, y = cell_point(pg, CELL_A)
    pg.mouse.move(x, y)
    pg.wait_for_selector("#tooltip:not([hidden])")
    tt = pg.inner_text("#tooltip")
    assert re.search(r"b \d\.\d\d \[\d\.\d\d, \d\.\d\d\]", tt) and "quality" in tt, tt
    pg.check("input[name=layer][value=mc]", force=True)
    pg.mouse.move(x + 1, y + 1)
    pg.wait_for_timeout(250)
    tt = pg.inner_text("#tooltip")
    assert "Mc" in tt and re.search(r"\[\d\.\d\d, \d\.\d\d\]", tt) and "quality" in tt, tt


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_cell_panel_and_error_state(site, viewport):
    pg = site.open("#g=0", viewport=viewport)
    if viewport == "phone":
        jump(pg, -157.4, 55.4, 1.5)
    x, y = cell_point(pg, CELL_A)
    pg.mouse.click(x, y)
    if viewport == "phone":
        pg.click("text=Full details and charts")
    pg.wait_for_selector("#panel-body .chart-svg >> nth=3", timeout=10000)
    assert f"c={CELL_A}" in pg.evaluate("location.hash")
    ok, r = no_hscroll(pg)
    assert ok, r
    # keyboard readout on a chart
    pg.focus("#panel-body .chart-wrap >> nth=1")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowRight")
    assert pg.evaluate("[...document.querySelectorAll('#panel-body .chart-tip')].some(t => !t.hidden)")
    pg.keyboard.press("Escape")
    pg.click("#panel-close")
    pg.wait_for_timeout(200)
    assert pg.is_hidden("#panel") and "c=" not in pg.evaluate("location.hash")
    # a failed detail file gives a readable error and a working retry
    pg.route(f"**/data/cells/{CELL_B}.json", lambda r: r.fulfill(status=503, body="unavailable"))
    pg.evaluate(f"() => {{ location.hash = location.hash.replace(/&c=[^&]*/, '') + '&c={CELL_B}'; }}")
    if viewport == "phone":
        pg.click("text=Full details and charts")
    pg.wait_for_selector("#panel-body .error button")
    assert "could not be loaded" in pg.inner_text("#panel-body")
    pg.unroute(f"**/data/cells/{CELL_B}.json")
    pg.click("#panel-body .error button")
    pg.wait_for_selector("#panel-body .chart-svg >> nth=3", timeout=10000)
    # the 503 above is intentional
    pg.errors[:] = [e for e in pg.errors if CELL_B not in e and "503" not in e]


def test_events_filter_and_usgs_link(site):
    # flat map: on the globe a whole-viewport queryRenderedFeatures also returns far-side features (MapLibre)
    pg = site.open("#v=map&g=0")
    pg.check("#chk-events")
    pg.wait_for_function("document.getElementById('ev-count').textContent.includes('shown')")
    jump(pg, 140, 25, 1.6)  # a fixed, earthquake-dense view, so the count does not depend on the first view
    pg.wait_for_timeout(600)
    n6 = rendered(pg, "events")
    assert n6 > 1000, n6
    pg.check("#chk-m5")
    pg.wait_for_function("document.getElementById('ev-count').textContent.includes('M ≥ 5.0')", timeout=120000)
    # The 7.5 MB M5 layer can take several seconds to render on slow CI runners: poll instead of a fixed wait.
    n5 = n6
    for _ in range(120):
        pg.wait_for_timeout(500)
        n5 = rendered(pg, "events")
        if n5 > n6:
            break
    assert n5 > n6, (n6, n5)
    pg.evaluate("() => { const e = document.getElementById('yr0'); e.value = 2000; e.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(300)
    assert "2000–" in pg.inner_text("#ev-count")
    pg.uncheck("#chk-m5")
    pg.wait_for_timeout(500)
    pt = pg.evaluate("""() => { const m = window.__map;
      const r = m.getContainer().getBoundingClientRect();
      // features of other world copies come back with unwrapped coordinates, so keep only on-screen points
      const pts = m.queryRenderedFeatures({layers: ['events']}).filter((f) => f.properties.m >= 7.5)
        .map((f) => m.project(f.geometry.coordinates))
        .filter((p) => p.x > 40 && p.y > 40 && p.x < r.width - 360 && p.y < r.height - 40);
      return [pts[0].x + r.left, pts[0].y + r.top]; }""")
    pg.mouse.click(*pt)
    pg.wait_for_selector(".maplibregl-popup a")
    assert pg.get_attribute(".maplibregl-popup a", "href").startswith("https://earthquake.usgs.gov/earthquakes/eventpage/")


def test_hash_round_trip(site):
    pg = site.open()
    pg.check("input[name=layer][value=mc]", force=True)
    pg.select_option("#sub-select", "cc")
    pg.check("input[name=depth][value=dp]", force=True)
    pg.uncheck("#chk-plates")
    pg.check("#chk-events")
    jump(pg, -70, -20, 3)
    pg.wait_for_timeout(400)
    hs = pg.evaluate("location.hash")
    pg2 = site.open(hs)
    st = pg2.evaluate("""() => [document.querySelector('input[name=layer]:checked').value,
      document.getElementById('sub-select').value, document.querySelector('input[name=depth]:checked').value,
      document.getElementById('chk-plates').checked, document.getElementById('chk-events').checked,
      Math.round(window.__map.getCenter().lng), Math.round(window.__map.getZoom())]""")
    assert st == ["mc", "cc", "dp", False, True, -70, 3], (hs, st)
    pg2.evaluate("() => { location.hash = location.hash.replace('l=mc', 'l=rate'); }")
    pg2.wait_for_timeout(300)
    assert pg2.evaluate("document.querySelector('input[name=layer]:checked').value") == "rate"
    assert "M6" in pg2.inner_text("#legend")


def test_globe_and_cell_list(site):
    pg = site.open()
    # the globe is the default (v0.3); the button switches to the flat map and back
    assert pg.evaluate("((window.__map.getProjection() || {}).type || 'mercator')") == "globe"
    assert "g=1" in pg.evaluate("location.hash")
    assert pg.get_attribute("#globe-btn", "aria-pressed") == "true"
    pg.click("#globe-btn")
    assert pg.evaluate("((window.__map.getProjection() || {}).type || 'mercator')") == "mercator"
    assert "g=0" in pg.evaluate("location.hash")
    assert pg.get_attribute("#globe-btn", "aria-pressed") == "false"
    pg.click("#globe-btn")
    jump(pg, 180, -15, 1.6)
    assert pg.evaluate("((window.__map.getProjection() || {}).type || 'mercator')") == "globe"
    assert "g=1" in pg.evaluate("location.hash")
    # the space around the globe differs from the ocean colour, so the globe edge is visible
    bg = pg.evaluate("""() => [getComputedStyle(document.getElementById('map-area')).backgroundColor,
      getComputedStyle(document.documentElement).getPropertyValue('--ocean').trim()]""")
    assert pg.evaluate("document.getElementById('map-area').classList.contains('globe')"), bg
    pg.click("#globe-btn")
    pg.click("#list-btn")
    pg.wait_for_timeout(300)
    # one row per shallow cell with a shown b (quality A or B), counted from the data rather than hard-coded
    cells = json.load(open(SITE / "data/cells.geojson"))["features"]
    n_shown = sum(1 for f in cells if f["properties"].get("sh_q") in ("A", "B"))
    assert pg.evaluate("document.querySelectorAll('#panel-body tbody tr').length") == n_shown
    pg.click("#panel-body tbody tr >> nth=0 >> button")
    pg.wait_for_timeout(500)
    assert re.search(r"c=[0-9a-f]{15}", pg.evaluate("location.hash"))


def test_keyboard_and_theme(site):
    pg = site.open()
    seen = []
    # WebKit (as Safari) moves focus to buttons and form controls with Alt+Tab; plain Tab reaches text fields only
    key = "Alt+Tab" if pg.context.browser.browser_type.name == "webkit" else "Tab"
    for _ in range(19):  # v0.3: Simple | Scientist switch; v0.5: 'Your catalogue' nav link (one tab stop each)
        pg.keyboard.press(key)
        seen.append(pg.evaluate("""(() => { const e = document.activeElement;
          return (e.id || e.name || e.tagName) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30); })()"""))
    joined = " ".join(seen).lower()
    assert "layer" in joined and "depth" in joined, seen
    pg.click("#theme-btn")
    a = pg.evaluate("document.documentElement.dataset.theme")
    pg.click("#theme-btn")
    b = pg.evaluate("document.documentElement.dataset.theme")
    assert (a, b) == ("light", "dark")


def test_map_not_exposed_without_hook(browser, base_url):
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto(base_url + "?debug")
    pg.wait_for_selector("#map-status", state="hidden", timeout=30000)
    assert pg.evaluate("typeof window.__map") == "undefined"
    ctx.close()


@pytest.mark.parametrize("scheme", ["light", "dark"])
@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_dark_and_light_panel_from_url(site, viewport, scheme):
    pg = site.open(f"#v=map&l=b&d=sh&c={CELL_A}", viewport=viewport, scheme=scheme)
    pg.wait_for_selector("#panel:not([hidden])")
    ok, r = no_hscroll(pg)
    assert ok, r
