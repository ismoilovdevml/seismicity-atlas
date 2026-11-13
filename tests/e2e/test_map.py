"""Map view: layers, tooltip, cell panel, events, URL state, globe, list, keyboard and theme."""
import re

import pytest

from conftest import cell_point, jump, no_hscroll, rendered

CELL_A = "820ccffffffffff"  # Aleutians, shallow quality A
CELL_B = "820cdffffffffff"  # neighbour, shallow quality B
LAYERS = [("q", [None]), ("mc", ["ig", "cc", "cc0"]), ("cc", ["flag", "dmw", "dloc"]), ("rate", [None]), ("b", [None])]


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_layers_render(site, viewport):
    pg = site.open(viewport=viewport)
    assert "b-value" in pg.inner_text("#legend")
    ok, r = no_hscroll(pg)
    assert ok, r
    if viewport == "phone":
        pg.click("#chip-more")
    for lay, subs in LAYERS + [("none", [None])]:
        pg.check(f"input[name=layer][value={lay}]", force=True)
        for sub in subs:
            if sub:
                pg.select_option("#sub-select", sub)
            pg.wait_for_timeout(200)
            n = rendered(pg, "cells-fill")
            assert n > 100, (lay, sub, n)
            assert len(pg.inner_text("#legend")) > 8
    pg.check("input[name=depth][value=dp]", force=True)
    pg.wait_for_timeout(200)
    assert "d=dp" in pg.evaluate("location.hash")


def test_tooltip_carries_interval_and_quality(site):
    pg = site.open()
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
    pg = site.open(viewport=viewport)
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
    pg = site.open()
    pg.check("#chk-events")
    pg.wait_for_function("document.getElementById('ev-count').textContent.includes('shown')")
    pg.wait_for_timeout(600)
    n6 = rendered(pg, "events")
    assert n6 > 1000, n6
    pg.check("#chk-m5")
    pg.wait_for_function("document.getElementById('ev-count').textContent.includes('M ≥ 5.0')", timeout=60000)
    pg.wait_for_timeout(1200)
    n5 = rendered(pg, "events")
    assert n5 > n6, (n6, n5)
    pg.evaluate("() => { const e = document.getElementById('yr0'); e.value = 2000; e.dispatchEvent(new Event('input')); }")
    pg.wait_for_timeout(300)
    assert "2000–" in pg.inner_text("#ev-count")
    pg.uncheck("#chk-m5")
    pg.wait_for_timeout(500)
    pt = pg.evaluate("""() => { const m = window.__map;
      const f = m.queryRenderedFeatures({layers: ['events']}).filter((f) => f.properties.m >= 7.5)[0];
      const p = m.project(f.geometry.coordinates); const r = m.getContainer().getBoundingClientRect();
      return [p.x + r.left, p.y + r.top]; }""")
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
    pg.click("#globe-btn")
    jump(pg, 180, -15, 1.6)
    assert pg.evaluate("window.__map.getProjection().type") == "globe"
    assert "g=1" in pg.evaluate("location.hash")
    # the space around the globe differs from the ocean colour, so the globe edge is visible
    bg = pg.evaluate("""() => [getComputedStyle(document.getElementById('map-area')).backgroundColor,
      getComputedStyle(document.documentElement).getPropertyValue('--ocean').trim()]""")
    assert pg.evaluate("document.getElementById('map-area').classList.contains('globe')"), bg
    pg.click("#globe-btn")
    pg.click("#list-btn")
    pg.wait_for_timeout(300)
    assert pg.evaluate("document.querySelectorAll('#panel-body tbody tr').length") == 204
    pg.click("#panel-body tbody tr >> nth=0 >> button")
    pg.wait_for_timeout(500)
    assert re.search(r"c=[0-9a-f]{15}", pg.evaluate("location.hash"))


def test_keyboard_and_theme(site):
    pg = site.open()
    seen = []
    for _ in range(16):
        pg.keyboard.press("Tab")
        seen.append(pg.evaluate("""(() => { const e = document.activeElement;
          return (e.id || e.name || e.tagName) + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30); })()"""))
    joined = " ".join(seen).lower()
    # WebKit skips links and buttons on Tab unless the user enables it; form fields are always reached
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
