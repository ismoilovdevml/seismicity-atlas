"""v0.3.1: the Case studies view (Groningen), the seismic-deficit layer, the Zhang & Werner (2020) productivity line on
the Ongoing cards and the Türkiye preset of Depth 3D. Every wait polls for a condition (no fixed sleeps)."""
import json
import re
from pathlib import Path

import pytest

from conftest import FIXTURES, no_hscroll

ROOT = Path(__file__).resolve().parents[2]
GR = ROOT / "site" / "data" / "induced" / "groningen"
DF = ROOT / "site" / "data" / "deficit"
KNMI_DOI = "10.21944/e970fd34-23b9-3411-b366-e4f72877d2c5"
# A ratio string as the deficit layer prints it: value [lo, hi] (95 %), p_full p
RATIO = re.compile(r"\d+(\.\d+)? \[\d+(\.\d+)?, \d+(\.\d+)?\] \(95 %\), p_full (< )?\d\.\d\d")


def open_case(site, hash_="#v=cases&cs=groningen", **kw):
    pg = site.open(hash_, ready=False, **kw)
    pg.wait_for_selector(".cs-bmap svg .cs-node", timeout=30000)
    pg.wait_for_function("document.querySelectorAll('#view-cases .chart-svg').length >= 4", timeout=30000)
    return pg


# ---------------------------------------------------------------- Groningen case study

@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "light"), ("desktop", "dark")])
def test_case_study_renders(site, viewport, scheme):
    pg = open_case(site, viewport=viewport, scheme=scheme)
    root = pg.inner_text("#cases-root")
    assert pg.get_attribute(".nav a[data-view='cases']", "aria-current") == "page"
    assert pg.title().startswith("Case studies")
    # licence obligations: "not a forecast", the KNMI attribution with the network DOI, "Source: NLOG.NL"
    assert "Not a forecast." in pg.inner_text(".cs-notice")
    assert KNMI_DOI in root and "Royal Netherlands Meteorological Institute (KNMI)" in root
    assert pg.query_selector(f"#cases-root a[href='https://doi.org/{KNMI_DOI}']")
    prod_note = pg.inner_text(".cs-stack figure:first-child .chart-note")
    assert "Source: NLOG.NL" in prod_note
    assert "Source: NLOG.NL" in pg.inner_text(".cs-bmap")
    idx = json.loads((GR / "index.json").read_text())
    for s in idx["sources"]:
        assert s["attribution"] in root, s["name"]
    # no download of single events: no download links and no CSV anywhere in the view
    assert pg.evaluate("document.querySelectorAll('#cases-root a[download], #cases-root a[href$=\".csv\"]').length") == 0
    # phase rates, b by phase, moving b-positive with both sub-fields, validation table with every row
    rates = json.loads((GR / "rates.json").read_text())
    assert pg.locator("#cases-root .cs-btable tbody tr").count() == len(rates["phases"])
    val = json.loads((GR / "validation.json").read_text())
    assert pg.locator(".cs-vtable tbody tr").count() == len(val["rows"])
    assert pg.locator(".cs-vtable tr[data-verdict='differs'] .pill.bad").count() == 1
    ok, r = no_hscroll(pg)
    assert ok, r


def test_case_summary_first_and_numbers_from_the_data(site):
    pg = open_case(site, mode="simple")
    order = pg.evaluate("""() => { const s = document.querySelector('.cs-summary'), d = document.querySelector('.cs-details');
      return !!(s.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING); }""")
    assert order, "the plain-language summary must come before the details"
    rates = json.loads((GR / "rates.json").read_text())
    ph = {p["start"]: p for p in rates["phases"]}
    txt = pg.inner_text(".cs-summary")
    assert f"{ph['2014-01']['rate_per_yr']:.1f} per year" in txt and f"{ph['2003-01']['rate_per_yr']:.1f} per year" in txt
    assert f"{ph['2023-10']['rate_per_yr']:.1f} per year" in txt
    assert f"{rates['correlation']['lag1_rho']:.2f}" in txt


def test_case_b_values_always_with_interval(site):
    pg = open_case(site)
    cells = pg.locator(".cs-btable td.num").all_inner_texts()
    for c in cells:
        first = c.split("\n")[0]
        assert re.fullmatch(r"\d\.\d\d \[\d\.\d\d, \d\.\d\d\]", first) or first.startswith("not enough data"), c
    # moving b-positive: both sub-fields drawn with their 95 % bands
    fig = pg.locator("#cs-movH").locator("xpath=ancestor::section[1]")
    assert fig.locator("path.band").count() == 2 and fig.locator("path.line").count() == 2


def test_case_b_map_periods_and_estimators(site):
    pg = open_case(site)
    bm = json.loads((GR / "bmap.json").read_text())
    for period, p in bm["periods"].items():
        pg.check(f"input[name='cs-period'][value='{period}']", force=True)
        n_bpos = sum(1 for b, lo in zip(p["bpos"], p["bpos_lo"]) if b is not None and lo is not None)
        pg.wait_for_function("(n) => document.querySelector('.cs-bmap').dataset.shown === String(n)", arg=n_bpos)
        pg.check("input[name='cs-est'][value='b']", force=True)
        n_ab = sum(1 for b, q in zip(p["b"], p["q"]) if b is not None and q in ("A", "B"))
        pg.wait_for_function("(n) => document.querySelector('.cs-bmap').dataset.shown === String(n)", arg=n_ab)
        pg.check("input[name='cs-est'][value='bpos']", force=True)
    # the hover readout gives b with its interval
    pg.hover(".cs-node >> nth=0")
    pg.wait_for_selector(".cs-map-plot .chart-tip:not([hidden])")
    assert re.search(r"b \d\.\d\d \[\d\.\d\d, \d\.\d\d\]", pg.inner_text(".cs-map-plot .chart-tip"))


@pytest.mark.parametrize("code,h1", [("uz", "Groningen gaz koni"), ("ru", "Месторождение Гронинген"), ("es", "Yacimiento de Groningen")])
def test_case_languages(site, code, h1):
    pg = open_case(site, f"#v=cases&cs=groningen&lang={code}")
    assert pg.inner_text("#cases-root h1").startswith(h1)
    body = pg.inner_text("#cases-root")
    assert not re.search(r"\bcs\.[a-zA-Z]", body), "untranslated key"
    assert KNMI_DOI in body and "Source: NLOG.NL" in body
    ok, r = no_hscroll(pg)
    assert ok, r


def test_case_phone_360(site):
    pg = open_case(site, viewport="phone", mode="simple")
    pg.set_viewport_size({"width": 360, "height": 780})
    pg.wait_for_function("document.documentElement.clientWidth === 360")
    ok, r = no_hscroll(pg)
    assert ok, r


# ---------------------------------------------------------------- seismic-deficit layer

def open_deficit(site, hash_="#v=map&l=b&d=sh&df=1&dz=ts_central&at=3.7/41.5/76.5&g=0", **kw):
    pg = site.open(hash_, **kw)
    pg.wait_for_selector("#panel-body .df-panel", timeout=30000)
    pg.wait_for_function("window.__map.getLayer('df-fill') && window.__map.getLayoutProperty('df-fill', 'visibility') === 'visible'", timeout=30000)
    return pg


def test_deficit_panel_headline_and_no_ratio_without_ci(site):
    pg = open_deficit(site)
    head = pg.inner_text(".df-head strong")
    assert head == "No detectable deficit beyond catalogue noise"
    assert "No detectable deficit beyond catalogue noise" in pg.inner_text("#legend")
    # every ratio on the page carries its 95 % interval and p_full
    texts = pg.evaluate("[...document.querySelectorAll('[data-ratio]')].map((e) => e.textContent)")
    assert len(texts) >= 2, texts
    for s in texts:
        assert RATIO.search(s), s
    # the forest chart: every drawn row has an interval, and every tooltip text names p_full
    pg.evaluate("document.querySelector('.df-panel details.chart-table').open = true")
    pg.wait_for_function("document.querySelectorAll('.df-panel details.chart-table tbody tr').length === 4")
    tbl = pg.evaluate("[...document.querySelectorAll('.df-panel details.chart-table tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent))")
    for row in tbl:
        assert re.fullmatch(r"\d+(\.\d+)? \[\d+(\.\d+)?, \d+(\.\d+)?\]", row[1]) and re.fullmatch(r"\d\.\d\d", row[3]), row
    # the caveats and the disclaimer are shown
    assert pg.locator(".df-caveats li").count() == 5
    assert "Not a forecast and not a hazard map." in pg.inner_text(".df-disclaimer")


def test_deficit_data_values_reach_the_panel(site):
    pg = open_deficit(site)
    reg = {p["id"]: p for p in json.loads((DF / "index.json").read_text())["regions"]}
    c = reg["ts_central"]
    txt = pg.inner_text(".df-zone [data-ratio='obs']")
    assert f"{c['r_obs']:.2f} [{c['r_obs_lo']:.2f}, {c['r_obs_hi']:.2f}]" in txt and f"p_full {c['p_full']:.2f}" in txt


def test_deficit_few_cells_are_greyed(site):
    cells = json.loads((DF / "cells.geojson").read_text())["features"]
    few = next(ft["properties"] for ft in cells if ft["properties"]["q"] == "few" and ft["properties"]["r_obs"] > 0)
    pg = open_deficit(site, f"#v=map&l=b&d=sh&df=1&dv=c&dz={few['id']}&at=3.7/41.5/76.5&g=0")
    assert pg.locator(".df-zone.few .df-few").count() == 1
    assert RATIO.search(pg.inner_text(".df-zone [data-ratio='obs']"))
    # the map greys them: grey fill colour and the hatch layer for q = few
    flt = pg.evaluate("JSON.stringify(window.__map.getFilter('df-hatch'))")
    assert "few" in flt and "nogeod" in flt


def test_deficit_layer_toggle_hover_and_simple_mode(site):
    pg = site.open("#v=map&l=b&d=sh&at=3.7/41.5/78&g=0")
    pg.check("#chk-deficit")
    pg.wait_for_function("window.__map.getLayer('df-fill') && window.__map.getLayoutProperty('df-fill', 'visibility') === 'visible'", timeout=30000)
    pg.wait_for_function("location.hash.includes('df=1')")
    pg.wait_for_function("!window.__map.isMoving() && window.__map.loaded()", timeout=30000)
    # hover the central region: the tooltip gives the ratio with interval and p_full
    pt = pg.evaluate("""() => { const m = window.__map; const p = m.project([79, 42]); const r = m.getContainer().getBoundingClientRect();
      return [p.x + r.left, p.y + r.top]; }""")
    pg.mouse.move(pt[0], pt[1])
    pg.wait_for_selector("#tooltip:not([hidden]) .df-tip", timeout=10000)
    assert RATIO.search(pg.inner_text("#tooltip"))
    pg.mouse.click(pt[0], pt[1])
    pg.wait_for_selector("#panel-body .df-panel")
    assert "dz=" in pg.evaluate("location.hash")
    # the Simple view never shows the layer
    pg.click("#mode-seg [data-mode=simple]")
    pg.wait_for_function("window.__map.getLayoutProperty('df-fill', 'visibility') === 'none'")
    assert pg.is_hidden("#panel")


@pytest.mark.parametrize("code,head", [("uz", "Katalog shovqinidan tashqari aniqlanadigan taqchillik yoʻq"),
                                       ("ru", "Обнаружимого дефицита сверх шума каталога нет"),
                                       ("es", "Ningún déficit detectable más allá del ruido del catálogo")])
def test_deficit_languages(site, code, head):
    pg = open_deficit(site, f"#v=map&l=b&d=sh&df=1&dz=tienshan&g=0&lang={code}")
    assert pg.inner_text(".df-head strong") == head
    assert not re.search(r"\bdf\.[a-zA-Z]", pg.inner_text("#panel")), "untranslated key"


def test_deficit_info_button_opens_the_concept(site):
    pg = open_deficit(site)
    pg.click("#panel-meta .info-btn[data-concept='seismic-moment-budget']")
    pg.wait_for_selector(".lr-page[data-concept='seismic-moment-budget'] .lr-diagram[data-ready='1']", timeout=20000)
    pg.click(".lr-top [data-learn=back]")
    pg.wait_for_selector("#panel-body .df-panel", timeout=20000)


# ---------------------------------------------------------------- Ongoing cards: Zhang & Werner (2020)

FIX = FIXTURES / "monitor"


def _serve_monitor(route):
    rel = route.request.url.split("/data/monitor/", 1)[1].split("?")[0]
    path = (FIX / rel).resolve()
    route.fulfill(status=200, body=path.read_bytes(), content_type="application/json") if FIX in path.parents and path.is_file() \
        else route.fulfill(status=404, body="not found")


def test_monitor_zw2020_in_context(site):
    pg = site.open("#v=monitor", ready=False, routes=(("**/data/monitor/**", _serve_monitor),))
    pg.wait_for_selector("#mon-us6000u18k .chart-svg", timeout=20000)
    card = pg.inner_text("#mon-us6000u18k")
    zw = json.loads((FIX / "us6000u18k.json").read_text())["productivity_zw2020"]
    assert "More productive than most in its region so far" in card
    assert "Productivity, ETAS reference" in card
    assert f"{zw['ratio']:.1f} [{zw['ratio_lo']:.2f}, {zw['ratio_hi']:.1f}]" in card
    assert "within the range of global subduction sequences (Zhang & Werner 2020)" in card
    assert "Page et al. (2016)" in card
    assert "not compared: not a subduction-zone regime" in pg.inner_text("#mon-us6000rsy1")


# ---------------------------------------------------------------- Depth 3D: Türkiye 2023

def test_turkey_preset(site):
    pg = site.open("#v=depth&p3=turkey", ready=False)
    pg.wait_for_function("() => /\\d events M/.test((document.getElementById('d3-caption') || {}).textContent || '')", timeout=30000)
    n = int(re.search(r"([\d,]+) events M", pg.inner_text("#d3-caption")).group(1).replace(",", ""))
    assert n > 10, n
    assert pg.input_value("#d3-preset") == "turkey"
    assert pg.is_disabled("#d3-slab")
    assert pg.query_selector("#d3-note a[href='https://doi.org/10.5281/zenodo.8089273']")
    assert "high-precision relocations" in pg.inner_text("#d3-note")
