"""Fixes from the external audit of 2026-11-20: lazy view code and style sheets, the M5 worker, map state kept across
pages, the header at desktop widths, the place card under the 5+ filter, races, leaks, reduced motion, accessibility
and the CSV export. Each test names the audit item it guards."""
import pytest

from conftest import jump, wait_map

LAZY_CSS = ["css/terrain3d.css", "css/learn.css", "css/analyze.css", "css/cases.css"]


def sheets(pg):
    return pg.evaluate("() => [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href'))")


def test_view_style_sheets_and_code_load_on_first_use(site):
    """Item 2: only the map's style sheets block the first paint; a view's sheet arrives with the view."""
    pg = site.open("#v=map&mode=pro")
    first = sheets(pg)
    assert not any(c in first for c in LAZY_CSS), first
    # the info (i) buttons and deficit tokens moved to app.css: the map still styles them
    assert pg.evaluate("() => getComputedStyle(document.querySelector('#legend .info-btn')).borderRadius") == "50%"
    loaded = pg.evaluate("() => performance.getEntriesByType('resource').map((r) => r.name)")
    for mod in ("pages.js", "monitor.js", "cases.js", "depth3d.js"):
        assert not any(n.endswith(f"/js/{mod}") for n in loaded), mod
    pg.click(".nav a[data-view=learn]")
    pg.wait_for_selector("#learn-root .lr-index, #learn-root article")
    assert "css/learn.css" in sheets(pg)
    pg.click(".nav a[data-view=cases]")
    pg.wait_for_selector("#cases-root .cs-tabs", timeout=20000)
    assert "css/cases.css" in sheets(pg)
    # cases.css applies: the tabs are a flex row
    assert pg.evaluate("() => getComputedStyle(document.querySelector('.cs-tabs')).display") == "flex"


def test_depth_keys_survive_before_the_module_loads(site):
    """Item 2: the Depth 3D and case keys are declared at start-up (view-keys.js), so a link keeps them."""
    pg = site.open("#v=map&mode=pro&p3=chile&x3=7&m3=xs")
    h = pg.evaluate("location.hash")
    assert "p3=chile" in h and "x3=7" in h and "m3=xs" in h, h
    ids = pg.evaluate("() => import('./js/depth3d.js').then((m) => [Object.keys(m.PRESETS), m.PRESET_IDS])")
    assert ids[0] + ["view"] == ids[1]


def test_map_state_is_kept_across_pages(site):
    """Item 8: header links change the view only; back on the map the layer, cell, filters and position are kept."""
    pg = site.open("#v=map&mode=pro&g=0")
    jump(pg, 140, 36, 3)
    pg.click("#layer-list input[value=mc]", force=True)
    pg.check("#chk-events")
    cid = pg.evaluate("() => window.__map.queryRenderedFeatures({layers: ['cells-fill']})[0].properties.id")
    pg.evaluate("(c) => { location.hash = location.hash.replace(/&c=[^&]*/, '') + '&c=' + c; }", cid)
    pg.wait_for_selector("#panel:not([hidden])")
    before = pg.evaluate("location.hash")
    for view in ("about", "learn", "monitor"):
        pg.click(f".nav a[data-view={view}]")
        pg.wait_for_timeout(300)
        h = pg.evaluate("location.hash")
        assert f"v={view}" in h and "l=mc" in h and f"c={cid}" in h and "ev=6" in h, h
    pg.click(".nav a[data-view=map]")
    wait_map(pg)
    after = pg.evaluate("location.hash")
    for key in ("l=mc", f"c={cid}", "ev=6", "at="):
        assert key in after, (key, after)
    assert after.split("at=")[1].split("&")[0] == before.split("at=")[1].split("&")[0]
    assert pg.is_visible("#panel") and pg.is_checked("#chk-events")


@pytest.mark.parametrize("lang", ["en", "uz", "ru", "es"])
@pytest.mark.parametrize("width", [1024, 1280, 1366, 1440])
def test_header_never_clips(site, lang, width):
    """Item 7: in both modes and every language, every header item is inside the header; links that do not fit fold
    into the menu button, which opens them all."""
    pg = site.open(f"#v=map&mode=pro&lang={lang}", size=(width, 860), ready=False)
    pg.wait_for_selector("#map-status", state="hidden", timeout=30000)
    for mode in ("pro", "simple"):
        pg.click(f"#mode-seg [data-mode={mode}]")
        pg.wait_for_timeout(250)
        r = pg.evaluate("""() => { const top = document.querySelector('.top'); const tr = top.getBoundingClientRect();
          const right = document.querySelector('.top-right').getBoundingClientRect();
          const links = [...document.querySelectorAll('#nav a')].filter((a) => a.offsetParent !== null).map((a) => a.getBoundingClientRect());
          const name = document.querySelector('.brand-name');
          return { compact: top.classList.contains('compact'), overflow: top.scrollWidth - top.clientWidth,
            truncated: name.scrollWidth > name.clientWidth + 1, bad: links.filter((l) => l.right > right.left + 1 || l.right > tr.right || l.left < tr.left).length,
            menu: getComputedStyle(document.getElementById('menu-btn')).display }; }""")
        assert r["overflow"] <= 1 and not r["truncated"] and r["bad"] == 0, (lang, width, mode, r)
        if r["compact"]:
            assert r["menu"] != "none"
            pg.click("#menu-btn")
            n = pg.evaluate("() => [...document.querySelectorAll('#nav a')].filter((a) => a.offsetParent !== null).length")
            assert n >= 7, n
            pg.keyboard.press("Escape")
            assert not pg.evaluate("document.getElementById('nav').classList.contains('open')")


def test_place_card_counts_follow_the_5_plus_filter(site):
    """Item 9: with 5+ the card counts M5+ like the map (an M5.5 place no longer reads '0 M6+ earthquakes')."""
    pg = site.open("#v=map&mode=simple&sm=5&p=38.300/142.400&pr=100", mode="simple")
    pg.wait_for_selector("#sx-card [data-stat=n5]", timeout=120000)
    n5 = int(pg.inner_text("[data-stat=n5] .sx-big-n").replace(",", "").replace(" ", "").replace(" ", ""))
    n6 = int(pg.inner_text("[data-stat=n6] .sx-big-n").replace(",", "").replace(" ", "").replace(" ", ""))
    assert n5 > n6 > 0, (n5, n6)
    pg.click("#sx-mag [data-sm='6']")
    pg.wait_for_selector("#sx-card [data-stat=n7]")
    assert pg.locator("#sx-card [data-stat=n5]").count() == 0


def test_region_none_cancels_a_loading_catalogue(site):
    """Item 10: choosing 'None' while a regional catalogue loads keeps it off the map."""
    def slow(route):
        import time
        time.sleep(1.5)
        route.fallback()
    pg = site.open("#v=map&mode=pro", regional=True, routes=[("**/data/regional/fixture-ca/cells.geojson", slow)])
    pg.wait_for_selector("#reg-group:not([hidden])")
    pg.select_option("#reg-select", "fixture-ca")
    pg.wait_for_timeout(100)
    pg.select_option("#reg-select", "")
    pg.wait_for_timeout(2500)
    assert "r=" not in pg.evaluate("location.hash")
    assert not pg.evaluate("() => !!window.__map.getLayer('rcells-fill') && window.__map.getLayoutProperty('rcells-fill', 'visibility') !== 'none'")


def test_slider_updates_once_per_frame(site):
    """Item 5: a burst of slider steps writes the URL once per frame, not once per step."""
    pg = site.open("#v=map&mode=pro&ev=6")
    pg.wait_for_function("/\\d/.test(document.getElementById('ev-count').textContent)")
    n = pg.evaluate("""() => new Promise((done) => { let calls = 0; const orig = history.replaceState;
      history.replaceState = function (...a) { calls++; return orig.apply(this, a); };
      const el = document.getElementById('yr0');
      for (let y = 1910; y < 2010; y++) { el.value = y; el.dispatchEvent(new Event('input', { bubbles: true })); }
      requestAnimationFrame(() => requestAnimationFrame(() => { history.replaceState = orig; done(calls); })); })""")
    assert n <= 2, n
    assert "2009–" in pg.inner_text("#ev-count")


def test_leaving_depth_releases_webgl_and_learn_stops(site):
    """Item 11: leaving Depth 3D disposes the scene (no canvas, no WebGL context); leaving Learn stops animations."""
    pg = site.open("#v=depth&mode=pro", ready=False)
    pg.wait_for_selector("#d3-stage canvas.d3-canvas, #d3-stage .d3-xs", timeout=60000)
    pg.wait_for_timeout(500)
    pg.click(".nav a[data-view=map]")
    pg.wait_for_timeout(500)
    assert pg.locator("#d3-stage canvas").count() == 0
    pg.click(".nav a[data-view=depth]")
    pg.wait_for_selector("#d3-stage canvas.d3-canvas, #d3-stage .d3-xs", timeout=60000)
    pg.evaluate("location.hash = '#v=learn&t=omori-utsu'")
    pg.wait_for_selector("#learn-root [data-ready='1']", timeout=30000)
    pg.click(".nav a[data-view=map]")
    pg.wait_for_timeout(300)
    # the Omori diagram animates; after leaving, its play button is back to "play"
    assert pg.evaluate("() => [...document.querySelectorAll('#learn-root .lr-play')].every((b) => b.getAttribute('aria-pressed') === 'false')")


def test_simple_mode_leaves_scientist_only_pages(site):
    """Item 12: switching to Simple on Sequences or Validation shows the map."""
    pg = site.open("#v=sequences&mode=pro", ready=False)
    pg.wait_for_selector("#seq-root h1", timeout=30000)
    pg.click("#mode-seg [data-mode=simple]")
    pg.wait_for_timeout(300)
    assert pg.is_visible("#view-map") and "v=map" in pg.evaluate("location.hash")


def test_polar_place_does_not_throw(site):
    """Item 12: a place near the pole is framed without an Invalid LngLat error (site fixture checks page errors)."""
    pg = site.open("#v=map&mode=simple&p=84.000/20.000", mode="simple")
    pg.wait_for_selector("#sx-card:not([hidden])")
    pg.wait_for_timeout(1200)


def test_tour_takes_focus_and_escape_works_anywhere(site):
    """Items 12 and 17: the tour dialog gets the focus, does not cover the legend, and Escape closes it from anywhere."""
    pg = site.open(mode=None, tour=True, size=(390, 760))
    pg.wait_for_selector("#sx-tour:not([hidden])", timeout=30000)
    assert pg.evaluate("document.activeElement.id") == "sx-tour"
    over = pg.evaluate("""() => { const a = document.getElementById('sx-tour').getBoundingClientRect(), b = document.getElementById('sx-legend').getBoundingClientRect();
      return b.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }""")
    assert not over
    pg.evaluate("document.body.focus()")
    pg.keyboard.press("Escape")
    assert pg.is_hidden("#sx-tour")


def test_phone_controls_drawer_closes(site):
    """Item 12: the phone controls drawer has a close button and Escape."""
    pg = site.open("#v=map&mode=pro", viewport="phone")
    pg.click("#chip-more")
    assert pg.is_visible("#controls") and pg.is_visible("#rail-close")
    pg.click("#rail-close")
    assert pg.is_hidden("#controls")
    pg.click("#chip-more")
    pg.keyboard.press("Escape")
    assert pg.is_hidden("#controls")
    assert pg.evaluate("document.activeElement.id") == "chip-more"


def test_scientist_to_simple_drops_the_3d_tilt(site):
    """Item 12: the Simple view has no terrain switch, so leaving the Scientist view with 3D terrain flattens the map."""
    pg = site.open("#v=map&mode=pro&tr=1", routes=[("**/elevation-tiles-prod/**", lambda r: r.fulfill(status=204, body=""))])
    pg.click("#mode-seg [data-mode=simple]")
    pg.wait_for_function("window.__map.getPitch() === 0 && !window.__map.isMoving()", timeout=10000)
    assert "tr=1" not in pg.evaluate("location.hash")


def test_reduced_motion_jumps(site):
    """Item 15: with reduced motion asked for, zoom buttons and fly-to jump instead of animating."""
    pg = site.open("#v=map&mode=pro")
    pg.emulate_media(reduced_motion="reduce")
    z = pg.evaluate("window.__map.getZoom()")
    pg.click("#zoom-in")
    assert abs(pg.evaluate("window.__map.getZoom()") - (z + 1)) < 0.01
    # the zoom's moveend writes the URL a frame later; set the new hash after it
    pg.wait_for_function("!window.__map.isMoving() && location.hash.includes('at=' + window.__map.getZoom().toFixed(2))")
    pg.evaluate("location.hash = location.hash.replace(/&at=[^&]*/, '') + '&at=4/35/139'")
    pg.wait_for_timeout(100)
    assert abs(pg.evaluate("window.__map.getZoom()") - 4) < 0.01


def test_accessibility_structure(site):
    """Items 16 and 17: legends are not live regions; the Scientist map has an h1; list pages go h1 -> h2."""
    pg = site.open("#v=map&mode=pro")
    assert pg.get_attribute("#legend", "aria-live") is None and pg.get_attribute("#sx-legend", "aria-live") is None
    assert pg.evaluate("() => [...document.querySelectorAll('#view-map h1')].filter((e) => e.getClientRects().length > 0).length") == 1
    for view, root in (("sequences", "#seq-root"), ("monitor", "#monitor-root")):
        pg.click(f".nav a[data-view={view}]")
        pg.wait_for_selector(f"{root} .seq", timeout=30000)
        levels = pg.evaluate(f"() => [...document.querySelectorAll('{root} h1, {root} h2, {root} h3')].map((e) => +e.tagName[1])")
        assert all(b - a <= 1 for a, b in zip(levels, levels[1:])), levels
    # external links open without the opener or the referrer
    rels = pg.evaluate("() => [...document.querySelectorAll('a[target=_blank]')].map((a) => a.rel)")
    assert rels and all("noopener" in r and "noreferrer" in r for r in rels), rels


def test_depth_section_has_a_data_table(site):
    """Item 17: the 2D cross-section lists its events in a table."""
    pg = site.open("#v=depth&mode=pro&m3=xs", ready=False)
    pg.wait_for_selector(".d3-xs-table", timeout=60000)
    pg.click(".d3-xs-table summary")
    pg.wait_for_selector(".d3-xs-table tbody tr")  # built on the (asynchronous) toggle event
    assert pg.locator(".d3-xs-table tbody tr").count() > 20


def test_csv_quoting_and_formula_guard(site):
    """Item 14: CR is quoted (RFC 4180) and text that a spreadsheet would run as a formula is neutralised."""
    pg = site.open("#v=map&mode=pro")
    out = pg.evaluate("""() => import('./js/csv.js').then(({ cell }) => [cell('a\\rb'), cell('=1+2'), cell('-x'), cell(-0.25), cell('@SUM'), cell('plain')])""")
    assert out == ['"a\rb"', "'=1+2", "'-x", "-0.25", "'@SUM", "plain"], out


def test_unsafe_urls_from_data_are_not_linked(site):
    """Item 14: a javascript: URL in the manifest's sources is shown as text, never as a link."""
    import json
    from conftest import SITE
    man = json.loads((SITE / "data/manifest.json").read_text())
    man["sources"][0]["url"] = "javascript:alert(1)"
    man["sources"][0]["licence_url"] = "javascript:alert(2)"
    body = json.dumps(man)
    pg = site.open("#v=about&mode=pro", ready=False,
                   routes=[("**/data/manifest.json", lambda r: r.fulfill(status=200, body=body, content_type="application/json"))])
    pg.wait_for_selector("#about-root .src-list")
    assert pg.locator("#about-root a[href^='javascript']").count() == 0
    assert "javascript:alert(1)" in pg.inner_text("#about-root .src-list")
