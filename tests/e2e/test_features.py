"""Cell comparison, per-cell CSV, M5 event links, regional catalogues and languages."""
import json
import re

import pytest

from conftest import SITE, cell_point, jump, no_hscroll, rendered

A = "820ccffffffffff"        # b 0.67 [0.55, 0.82]
B_OVER = "820cdffffffffff"   # b interval [0.68, 1.04]: overlaps A
B_SEP = "829b2ffffffffff"    # b interval [1.28, 1.75]: does not overlap A
NO_B = "82000ffffffffff"     # insufficient


def panel_text(pg):
    pg.wait_for_selector("#panel:not([hidden])")
    return pg.inner_text("#panel")


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_compare_overlap_is_not_called_different(site, viewport):
    pg = site.open(f"#c={B_OVER}&k={A}", viewport=viewport)
    pg.wait_for_selector(".cmp-verdict")
    txt = panel_text(pg)
    assert "The 95 % intervals overlap" in txt and "do not show that b differs" in txt
    head = pg.inner_text(".cmp-verdict strong") + " " + pg.inner_text(".cmp-verdict > p >> nth=0")
    # the verdict itself never claims a difference when the intervals overlap
    assert "do not overlap" not in txt and "differen" not in head.replace("do not show that b differs", "")
    assert pg.evaluate("document.querySelectorAll('#panel .chart-svg').length") == 1
    ok, r = no_hscroll(pg)
    assert ok, r


def test_compare_separate_and_missing(site):
    pg = site.open(f"#c={B_SEP}&k={A}")
    pg.wait_for_selector(".cmp-verdict.separate")
    assert "do not overlap" in pg.inner_text(".cmp-verdict")
    pg.click("text=Swap A and B")
    pg.wait_for_function(f"location.hash.includes('k={B_SEP}') && location.hash.includes('c={A}')")
    assert "Cell A has the higher b" in pg.inner_text(".cmp-verdict")
    pg.evaluate(f"location.hash = 'v=map&l=b&d=sh&c={NO_B}&k={A}'")
    pg.wait_for_selector(".cmp-verdict.missing")
    assert "No comparison possible" in pg.inner_text(".cmp-verdict")
    pg.click("text=End comparison")
    pg.wait_for_function("!location.hash.includes('k=')")
    assert pg.is_hidden(".cmp-verdict")


def test_compare_verdict_boundaries(site):
    pg = site.open()
    res = pg.evaluate("""async () => { const m = await import('./js/compare.js');
      const c = (lo1, hi1, lo2, hi2) => m.compareVerdict({sh_q: 'A', sh_b: (lo1 + hi1) / 2, sh_b_lo: lo1, sh_b_hi: hi1},
                                                         {sh_q: 'B', sh_b: (lo2 + hi2) / 2, sh_b_lo: lo2, sh_b_hi: hi2}, 'sh').kind;
      return [c(0.8, 1.0, 1.0, 1.2), c(0.8, 1.0, 1.01, 1.2), c(1.1, 1.3, 0.7, 1.09), c(0.5, 1.5, 0.9, 1.0),
              m.compareVerdict({sh_q: 'C'}, {sh_q: 'A', sh_b: 1, sh_b_lo: 0.9, sh_b_hi: 1.1}, 'sh').kind]; }""")
    # touching intervals count as overlapping
    assert res == ["overlap", "separate", "separate", "overlap", "missing"]


def test_compare_by_clicking(site):
    pg = site.open()
    x, y = cell_point(pg, A)
    pg.mouse.click(x, y)
    pg.click("#cmp-btn")
    pg.wait_for_selector("#cmp-banner:not([hidden])")
    assert f"k={A}" in pg.evaluate("location.hash")
    x, y = cell_point(pg, B_OVER)
    pg.mouse.click(x, y)
    pg.wait_for_selector(".cmp-verdict")
    assert pg.is_hidden("#cmp-banner")
    assert f"c={B_OVER}" in pg.evaluate("location.hash")


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_cell_csv_download(site, viewport):
    pg = site.open(f"#c={A}", viewport=viewport)
    if viewport == "phone":
        pg.click("text=Full details and charts")
    with pg.expect_download() as dl:
        pg.click("#csv-btn")
    d = dl.value
    assert d.suggested_filename == f"seismicity-atlas-cell-{A}.csv"
    text = open(d.path(), encoding="utf-8").read()
    lines = text.splitlines()
    assert lines[0].startswith("# Global Seismicity Atlas, version")
    header = next(i for i, l in enumerate(lines) if not l.startswith("#"))
    assert lines[header] == "section,depth,catalogue,name,magnitude,value"
    rows = [l.split(",") for l in lines[header + 1:]]
    summ = {(r[1], r[3]): r[5] for r in rows if r[0] == "summary"}
    props = {f["properties"]["id"]: f["properties"] for f in json.load(open(SITE / "data/cells.geojson"))["features"]}[A]
    assert float(summ[("sh", "b")]) == props["sh_b"] and float(summ[("sh", "b_lo")]) == props["sh_b_lo"]
    det = json.load(open(SITE / f"data/cells/{A}.json"))
    fmd = [r for r in rows if r[0] == "fmd" and r[1] == "sh" and r[2] == "ISC-GEM Mw" and r[3] == "count"]
    assert len(fmd) == len(det["sh"]["fmd_iscgem"])
    assert sum(int(r[5]) for r in fmd) == sum(n for _, n in det["sh"]["fmd_iscgem"])
    cum = [r for r in rows if r[0] == "fmd" and r[1] == "sh" and r[2] == "ISC-GEM Mw" and r[3] == "cumulative_count"]
    assert int(cum[0][5]) == sum(n for _, n in det["sh"]["fmd_iscgem"])


def _m5_with_ids(route):
    """A small copy of events_m5.json (around Japan only) with an id column added, as the pipeline will write it."""
    e = json.load(open(SITE / "data/events_m5.json"))
    keep = [i for i in range(e["n"]) if 130 < e["lon"][i] < 155 and 28 < e["lat"][i] < 48]
    out = {k: v for k, v in e.items() if not isinstance(v, list) or k == "fields"}
    for f in e["fields"]:
        out[f] = [e[f][i] for i in keep]
    out["n"] = len(keep)
    out["id"] = [f"test{i:06d}" for i in keep]
    out["fields"] = e["fields"] + ["id"]
    route.fulfill(status=200, body=json.dumps(out), content_type="application/json")


def _click_m5_event(pg):
    pg.check("#chk-events")
    pg.check("#chk-m5")
    pg.wait_for_function("document.getElementById('ev-count').textContent.includes('M ≥ 5.0')", timeout=120000)
    jump(pg, 142, 38, 4)
    pt = pg.evaluate("""() => { const m = window.__map; const r = m.getContainer().getBoundingClientRect();
      const ps = m.queryRenderedFeatures({layers: ['events']}).filter((f) => f.properties.k === 5)
        .map((f) => m.project(f.geometry.coordinates)).filter((p) => p.x > 360 && p.y > 40 && p.x < r.width - 60 && p.y < r.height - 40);
      return [ps[0].x + r.left, ps[0].y + r.top]; }""")
    # zoom 4 spreads events; the topmost event under the pointer is opened
    pg.mouse.click(*pt)
    pg.wait_for_selector(".maplibregl-popup")
    return pg.inner_text(".maplibregl-popup"), pg.query_selector(".maplibregl-popup a")


@pytest.mark.parametrize("with_ids", [False, True])
def test_m5_event_links(site, with_ids):
    pg = site.open(routes=[("**/data/events_m5.json", _m5_with_ids)] if with_ids else [])
    txt, link = _click_m5_event(pg)
    if with_ids:
        assert link is not None and re.match(r"https://earthquake\.usgs\.gov/earthquakes/eventpage/test\d{6}$", link.get_attribute("href"))
    elif link is None:
        assert "no event id" in txt
    else:
        # an M6+ event can sit on top; it links by the id in events_m6.json
        assert link.get_attribute("href").startswith("https://earthquake.usgs.gov/")


def test_regional_hidden_without_index(site):
    # Simulate a deployment without regional layers: the index request fails.
    pg = site.open(routes=[("**/data/regional/index.json", lambda route: route.fulfill(status=404, body="not found"))])
    pg.wait_for_timeout(800)
    assert pg.is_hidden("#reg-group")
    assert pg.evaluate("window.__map.getLayer('rcells-fill') === undefined")


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_regional_layer_from_fixture(site, viewport):
    pg = site.open(viewport=viewport, regional=True)
    if viewport == "phone":
        pg.click("#chip-more")
    pg.wait_for_selector("#reg-group:not([hidden])")
    pg.select_option("#reg-select", "fixture-ca")
    pg.wait_for_function("location.hash.includes('r=fixture-ca') && window.__map.getLayer('rcells-fill')")
    pg.wait_for_function("!window.__map.isMoving()", timeout=10000)
    pg.wait_for_timeout(500)
    assert rendered(pg, "rcells-fill") >= 10
    c = pg.evaluate("window.__map.getCenter().toArray()")
    assert -124 < c[0] < -115 and 33 < c[1] < 40, c
    if viewport == "desktop":
        leg = pg.inner_text("#legend")
        assert "Synthetic test catalogue" in leg and "CC0 (test fixture)" in leg and "Fixture region" in leg
        assert "Test attribution line" in leg and "Test caveat" in leg
    else:
        pg.click("#chip-more")
    # open the regional cell that has a detail file
    pt = pg.evaluate("""() => { const m = window.__map; const f = m.querySourceFeatures('rcells', {filter: ['==', ['get', 'id'], '832834fffffffff']})[0];
      const p = m.project([f.properties.lon, f.properties.lat]); const r = m.getContainer().getBoundingClientRect(); return [p.x + r.left, p.y + r.top]; }""")
    pg.mouse.click(*pt)
    pg.wait_for_function("location.hash.includes('c=832834fffffffff')")
    if viewport == "phone":
        pg.click("text=Full details and charts")
    pg.wait_for_selector("#panel-body .chart-svg >> nth=3", timeout=10000)
    txt = pg.inner_text("#panel")
    assert "Synthetic test catalogue" in txt and "Catalogue agreement" not in txt
    assert "Test caveat: synthetic values only." in txt and "Test attribution line" in txt and "ML (synthetic)" in txt
    # Mc comes from the detail file's stats for regional cells
    assert re.search(r"Mc\s+2\.5\s*\(2\.4–2\.7\)", txt), txt[:400]
    ok, r = no_hscroll(pg)
    assert ok, r
    # the regional selection survives a reload from the URL
    pg2 = site.open(pg.evaluate("location.hash"), viewport=viewport, regional=True)
    pg2.wait_for_function("window.__map.getLayer('rcells-fill') && document.getElementById('panel').hidden === false", timeout=15000)


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
@pytest.mark.parametrize("lang,nav,html_lang", [("uz", "Xarita", "uz-Latn"), ("ru", "Карта", "ru"), ("es", "Mapa", "es")])
def test_languages(site, viewport, lang, nav, html_lang):
    pg = site.open(f"#lang={lang}&c={A}", viewport=viewport)
    pg.wait_for_selector("#panel:not([hidden])")
    assert pg.evaluate("document.documentElement.lang") == html_lang
    assert pg.evaluate("document.querySelector('.nav a[data-view=map]').textContent") == nav
    assert pg.input_value("#lang-select") == lang
    # numbers: decimal point kept, thousands grouped with a narrow no-break space
    if viewport == "desktop":
        assert "2 598" in pg.inner_text("#legend")
    assert re.search(r"0\.\d\d", pg.inner_text("#panel"))
    ok, r = no_hscroll(pg)
    assert ok, (lang, r)
    for v in ["methods", "about", "sequences"]:
        pg.evaluate(f"location.hash = 'v={v}&lang={lang}'")
        pg.wait_for_function(f"document.getElementById('view-{v}').innerText.length > 400", timeout=20000)
        ok, r = no_hscroll(pg)
        assert ok, (lang, v, r)


def test_language_switcher_round_trip(site):
    pg = site.open()
    pg.select_option("#lang-select", "ru")
    pg.wait_for_function("location.hash.includes('lang=ru') && document.documentElement.lang === 'ru'")
    assert "Карта" in pg.inner_text("#nav")
    pg.select_option("#lang-select", "en")
    pg.wait_for_function("!location.hash.includes('lang=') && document.documentElement.lang === 'en'")
    assert "b-value" in pg.inner_text("#legend") and "2,598" in pg.inner_text("#legend")


def _long_validation(route):
    g = json.load(open(SITE / "data/global.json"))
    row = dict(g["validation_table"][0])
    row.update(test="Time windows around large mainshocks, per cell (long test row)",
               ours="shown (A/B) per window {'pre_5y': 3, 'pre_1y': 0, 'post_0_30d': 2, 'post_30_365d': 2}; 1 pair(s) with both shown; median post - pre +0.032; 0 with separated intervals",
               verdict="match (global vs local map) [needs a published regional comparison with the same magnitude type and window]")
    g["validation_table"] = g["validation_table"] + [row] * 20
    route.fulfill(status=200, body=json.dumps(g), content_type="application/json")


@pytest.mark.parametrize("viewport", ["desktop", "phone"])
def test_validation_page_wraps_long_rows(site, viewport):
    pg = site.open("#v=methods", viewport=viewport, ready=False, routes=[("**/data/global.json", _long_validation)])
    pg.wait_for_function("document.querySelectorAll('.vtable tbody tr').length > 20", timeout=20000)
    ok, r = no_hscroll(pg)
    assert ok, r
    over = pg.evaluate("""() => { const c = document.querySelector('.table-card'); return [c.scrollWidth, c.clientWidth]; }""")
    assert over[0] <= over[1] + 1, over
