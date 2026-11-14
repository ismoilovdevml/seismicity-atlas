"""Simple view (default since v0.3): mode default and persistence, place search, place card numbers against the data,
the recording rating, "Scientist view of this place", the first-visit tour and the phone bottom sheet.

Expected numbers are computed here from the published JSON files, independently of the site's JavaScript.
"""
import json
import math
from datetime import datetime, timedelta, timezone

import pytest

from conftest import SITE, jump, no_hscroll, rendered, wait_map

DATA = SITE / "data"
EVENTS = json.loads((DATA / "events_m6.json").read_text())
CELLS = json.loads((DATA / "cells.geojson").read_text())["features"]
MANIFEST = json.loads((DATA / "manifest.json").read_text())
PLACES = json.loads((DATA / "places.json").read_text())
COL = {c: i for i, c in enumerate(PLACES["columns"])}
GLOBAL_MC = MANIFEST["global"]["b_shallow_1976_2021"]["mc"]


def place(name, country):
    for r in PLACES["rows"]:
        if r[COL["n"]] == name and PLACES["countries"][r[COL["c"]]] == country:
            return {"lat": r[COL["y"]], "lon": r[COL["x"]]}
    raise LookupError(name)


TOKYO = place("Tokyo", "Japan")
TASHKENT = place("Tashkent", "Uzbekistan")


def dist_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(min(1.0, math.sqrt(a)))


def dec_year_date(y):
    yr = math.floor(y)
    start = datetime(yr, 1, 1, tzinfo=timezone.utc)
    length = datetime(yr + 1, 1, 1, tzinfo=timezone.utc) - start
    return (start + (y - yr) * length).date().isoformat()


def expected_stats(lat, lon, radius, y0=None, y1=None):
    e = EVENTS
    y0 = y0 if y0 is not None else math.floor(min(e["year"]))
    y1 = y1 if y1 is not None else math.floor(max(e["year"]))
    rows = [i for i in range(e["n"]) if y0 <= e["year"][i] < y1 + 1 and e["mag"][i] >= 6
            and dist_km(lat, lon, e["lat"][i], e["lon"][i]) <= radius]
    if not rows:
        return {"n6": 0, "n7": 0, "y0": y0, "y1": y1}
    largest = max(rows, key=lambda i: (e["mag"][i], e["year"][i]))
    recent = max(rows, key=lambda i: e["year"][i])
    depths = sorted(e["depth"][i] for i in rows)
    k = len(depths) // 2
    med = depths[k] if len(depths) % 2 else (depths[k - 1] + depths[k]) / 2
    return {"n6": len(rows), "n7": sum(e["mag"][i] >= 7 for i in rows), "y0": y0, "y1": y1, "largest": largest,
            "recent": recent, "median": med}


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def cell_at(lat, lon):
    for ft in CELLS:
        ring = ft["geometry"]["coordinates"][0]
        if any(in_ring(L, lat, ring) for L in (lon, lon + 360, lon - 360)):
            return ft["properties"]
    raise LookupError((lat, lon))


def expected_rating(p):
    """The documented table (docs/learn.md, "How well earthquakes are recorded"), implemented independently."""
    q, flag = p["sh_q"], p["c_flag"]
    if q not in ("A", "B", "C"):
        return "few"
    if q == "C" or flag == "check":
        return "limited"
    if q == "A" and flag == "ok" and p.get("sh_mc") is not None and p["sh_mc"] <= GLOBAL_MC + 0.2 + 1e-9:
        return "vgood"
    return "good"


def simple_layers_off(pg):
    return pg.evaluate("""() => ['sx-dots', 'sx-heat', 'sx-pin'].every((l) => !window.__map.getLayer(l)
      || window.__map.getLayoutProperty(l, 'visibility') === 'none')""")


def fmt_int(n):
    return f"{n:,}"


def wait_card(pg):
    pg.wait_for_selector("#sx-card:not([hidden]) [data-stat=n6]", timeout=20000)
    pg.wait_for_timeout(200)


def place_hash(p, extra=""):
    return f"#v=map&mode=simple&p={p['lat']:.3f}/{p['lon']:.3f}{extra}"


# ---------------------------------------------------------------- default mode and persistence

def test_simple_is_the_default_for_new_visitors(site):
    pg = site.open("", mode=None)
    assert pg.evaluate("document.documentElement.dataset.mode") == "simple"
    assert "mode=simple" in pg.evaluate("location.hash")
    assert pg.is_visible("#sx-top") and pg.is_visible("#sx-q") and pg.is_visible("#sx-legend")
    assert pg.is_hidden("#controls") and pg.is_hidden("#legend")
    # real earthquakes and their density, no hexagons
    pg.wait_for_function("window.__map.getLayer('sx-dots')")
    jump(pg, 140, 25, 1.6)  # a fixed, earthquake-dense view, so the count does not depend on the first view
    pg.wait_for_timeout(400)
    assert rendered(pg, "sx-dots") > 500
    assert pg.evaluate("window.__map.getLayoutProperty('sx-heat', 'visibility')") == "visible"
    assert rendered(pg, "cells-fill") == 0
    assert pg.get_attribute("#mode-seg [data-mode=simple]", "aria-checked") == "true"
    # nav for the public: Map, Recent big quakes, Depth 3D, Learn, About; Sequences and Validation stay in Scientist
    assert pg.inner_text("#nav-monitor") == "Recent big quakes"
    assert pg.is_hidden("#nav a[data-view=sequences]") and pg.is_hidden("#nav a[data-view=methods]")
    # the legend counts what is drawn
    n = sum(1 for m in EVENTS["mag"] if m >= 6)
    assert fmt_int(n) in pg.inner_text("#sx-legend")


def test_mode_persists_across_reloads_and_links(site):
    pg = site.open("", mode=None)
    pg.click("#mode-seg [data-mode=pro]")
    pg.wait_for_selector("#controls", state="visible")
    assert "mode=pro" in pg.evaluate("location.hash")
    assert pg.evaluate("localStorage.getItem('gsa-mode')") == "pro"
    pg.wait_for_function("window.__map.queryRenderedFeatures({layers: ['cells-fill']}).length > 100")
    assert simple_layers_off(pg)
    # a bare URL opens the stored choice
    # (each navigation waits for the map to finish loading: leaving a page mid-load aborts its fetches, which
    # Firefox and WebKit report as console errors)
    pg.goto(site.base)
    wait_map(pg)
    assert pg.evaluate("document.documentElement.dataset.mode") == "pro"
    # a navigation link without a mode keeps the current one
    pg.evaluate("location.hash = 'v=about'")
    pg.wait_for_selector("#view-about:not([hidden])")
    assert "mode=pro" in pg.evaluate("location.hash")
    # a shared Simple link opens Simple, without changing the stored choice
    pg.goto(site.base + "#v=map&mode=simple&lang=en")
    wait_map(pg)
    pg.reload()
    wait_map(pg)
    pg.wait_for_selector("#sx-top", state="visible")
    assert pg.evaluate("localStorage.getItem('gsa-mode')") == "pro"
    pg.click("#mode-seg [data-mode=simple]")
    assert pg.evaluate("localStorage.getItem('gsa-mode')") == "simple"


def test_old_expert_links_open_the_scientist_view(site):
    cid = cell_at(TOKYO["lat"], TOKYO["lon"])["id"]
    pg = site.open(f"#v=map&l=mc&d=sh&c={cid}&lang=en", mode="simple")
    pg.wait_for_selector("#panel:not([hidden])")
    assert pg.evaluate("document.documentElement.dataset.mode") == "pro"
    h = pg.evaluate("location.hash")
    assert "mode=pro" in h and "l=mc" in h and f"c={cid}" in h, h
    assert pg.is_visible("#controls") and pg.is_hidden("#sx-top")
    # no earthquake dots or shading of the Simple view on the cells
    assert simple_layers_off(pg)


# ---------------------------------------------------------------- search

@pytest.mark.parametrize("query,name,country", [
    ("reykjavik", "Reykjavík", "Iceland"),     # accent-insensitive
    ("SAO PAULO", "São Paulo", "Brazil"),      # case and accent
    ("zurich", "Zürich", "Switzerland"),
    ("Ташкент", "Tashkent", "Uzbekistan"),     # the Russian name from Natural Earth
])
def test_search_matches_without_accents(site, query, name, country):
    pg = site.open("#v=map&mode=simple", mode=None)
    pg.click("#sx-q")
    pg.fill("#sx-q", query)
    pg.wait_for_selector("#sx-list:not([hidden]) [role=option][data-place]")
    first = pg.inner_text("#sx-list [role=option] >> nth=0")
    assert name in first and country in first, first
    assert pg.get_attribute("#sx-q", "aria-expanded") == "true"
    pg.keyboard.press("Enter")
    wait_card(pg)
    assert pg.inner_text("#sx-card-title") == name
    assert country in pg.inner_text("#sx-card-meta")
    assert "p=" in pg.evaluate("location.hash")


def test_search_without_results_says_what_to_do(site):
    pg = site.open("#v=map&mode=simple", mode=None)
    pg.click("#sx-q")
    pg.fill("#sx-q", "qqxxzz")
    pg.wait_for_selector("#sx-list:not([hidden]) .sx-empty")
    assert "click the map" in pg.inner_text("#sx-list")


# ---------------------------------------------------------------- place card

@pytest.mark.parametrize("where", ["tokyo", "tashkent"])
def test_place_card_numbers_match_the_data(site, where):
    p = TOKYO if where == "tokyo" else TASHKENT
    lat, lon = round(p["lat"], 3), round(p["lon"], 3)
    pg = site.open(place_hash(p), mode=None)
    wait_card(pg)
    for radius in (100, 300):
        if radius == 300:
            pg.click("#sx-card [data-pr='300']")
            pg.wait_for_function("document.querySelector('#sx-card [data-pr=\"300\"]').getAttribute('aria-pressed') === 'true'")
            pg.wait_for_timeout(200)
        exp = expected_stats(lat, lon, radius)
        assert pg.inner_text("[data-stat=n6] .sx-big-n") == fmt_int(exp["n6"]), (radius, exp)
        assert pg.inner_text("[data-stat=n7] .sx-big-n") == fmt_int(exp["n7"]), (radius, exp)
        years = pg.inner_text("[data-stat=years]")
        assert f"{exp['y0']}–{exp['y1']}" in years and f"{radius} km" in years, years
        if exp["n6"]:
            e = EVENTS
            for kind in ("largest", "recent"):
                i = exp[kind]
                row = pg.inner_text(f"[data-row={kind}]")
                assert f"M {e['mag'][i]:.1f} on {dec_year_date(e['year'][i])}" in row, (kind, row)
                href = pg.get_attribute(f"[data-row={kind}] a", "href")
                assert href.endswith(e["id"][i]) and href.startswith("https://earthquake.usgs.gov/"), href
            assert f"median depth {math.floor(exp['median'] + 0.5)} km" in pg.inner_text("[data-row=depth]")
    # the honesty line is always there
    assert "not a forecast or a hazard map" in pg.inner_text(".sx-honest")
    if where == "tokyo":
        assert exp["n6"] > 0


def test_time_range_changes_the_card(site):
    pg = site.open(place_hash(TOKYO), mode=None)
    wait_card(pg)
    pg.click("#sx-yr [data-sr='10']")
    pg.wait_for_timeout(300)
    y1 = math.floor(max(EVENTS["year"]))
    exp = expected_stats(round(TOKYO["lat"], 3), round(TOKYO["lon"], 3), 100, y1 - 9, y1)
    assert pg.inner_text("[data-stat=n6] .sx-big-n") == fmt_int(exp["n6"])
    assert f"{y1 - 9}–{y1}" in pg.inner_text("[data-stat=years]")
    assert "sr=10" in pg.evaluate("location.hash")


def test_map_click_opens_a_card(site):
    pg = site.open("#v=map&mode=simple&at=3/36/138", mode=None)
    pt = pg.evaluate("""() => { const m = window.__map; const p = m.project([139.7, 35.7]);
      const r = m.getContainer().getBoundingClientRect(); return [p.x + r.left, p.y + r.top]; }""")
    pg.mouse.click(*pt)
    wait_card(pg)
    assert "p=35.7" in pg.evaluate("location.hash")
    pg.click("#sx-card-close")
    pg.wait_for_selector("#sx-card", state="hidden")
    assert "p=" not in pg.evaluate("location.hash")


# ---------------------------------------------------------------- recording rating

def test_rating_rule_branches(site):
    """recordingRating() against the documented table, one input per branch."""
    pg = site.open("#v=map&mode=simple", mode=None)
    cases = [
        ({"sh_q": "insufficient", "c_flag": "ok"}, "few"),
        ({"sh_q": "C", "c_flag": "ok", "sh_mc": 5.2}, "limited"),
        ({"sh_q": "A", "c_flag": "check", "sh_mc": 5.2}, "limited"),
        ({"sh_q": "A", "c_flag": "ok", "sh_mc": round(GLOBAL_MC + 0.2, 1)}, "vgood"),
        ({"sh_q": "A", "c_flag": "ok", "sh_mc": round(GLOBAL_MC + 0.3, 1)}, "good"),
        ({"sh_q": "A", "c_flag": "few", "sh_mc": 5.2}, "good"),
        ({"sh_q": "B", "c_flag": "ok", "sh_mc": 5.2}, "good"),
    ]
    got = pg.evaluate("""([cases, g]) => import('./js/places.js').then((m) => cases.map(([p]) => m.recordingRating(p, g)))""",
                      [cases, GLOBAL_MC])
    assert got == [c[1] for c in cases]
    for p, r in cases:
        assert expected_rating({"sh_mc": None, **p}) == r
    # every real cell: the page and the independent implementation agree
    got = pg.evaluate("""(g) => Promise.all([import('./js/places.js'), fetch('data/cells.geojson').then((r) => r.json())])
      .then(([m, c]) => c.features.map((f) => m.recordingRating(f.properties, g)))""", GLOBAL_MC)
    assert got == [expected_rating(ft["properties"]) for ft in CELLS]


@pytest.mark.parametrize("where", ["tokyo", "tashkent"])
def test_card_rating_and_scientist_view_of_place(site, where):
    p = TOKYO if where == "tokyo" else TASHKENT
    cell = cell_at(round(p["lat"], 3), round(p["lon"], 3))
    pg = site.open(place_hash(p), mode=None)
    wait_card(pg)
    rating = expected_rating(cell)
    assert pg.get_attribute(".sx-rating", "data-rating") == rating
    words = {"vgood": "Very good", "good": "Good", "limited": "Limited", "few": "Too little data"}
    assert pg.inner_text(".sx-rate-label") == words[rating]
    basis = pg.inner_text(".sx-basis")
    assert (f"Quality {cell['sh_q']}" if cell["sh_q"] != "insufficient" else "Insufficient") in basis, basis
    # the Learn button explains the rule
    assert pg.get_attribute(".sx-rating .info-btn", "data-concept") == "recording-rating"
    pg.click(".sx-pro-btn")
    pg.wait_for_selector("#panel:not([hidden])")
    assert pg.evaluate("document.documentElement.dataset.mode") == "pro"
    h = pg.evaluate("location.hash")
    assert f"c={cell['id']}" in h and "mode=pro" in h, h
    assert pg.is_hidden("#sx-card")


def test_learn_page_of_the_rating(site):
    pg = site.open("#v=learn&t=recording-rating", mode=None, ready=False)
    pg.wait_for_selector(".lr-page[data-concept=recording-rating] .lr-diagram[data-ready='1']", timeout=20000)
    rows = pg.locator(".lr-tech table tbody tr")
    assert rows.count() == 4
    pg.click("[data-ctl=q-C]")
    assert pg.get_attribute(".lr-fig", "data-rating") == "limited"
    pg.click("[data-ctl=q-A]")
    assert pg.get_attribute(".lr-fig", "data-rating") == "vgood"
    pg.click("[data-ctl=flag-check]")
    assert pg.get_attribute(".lr-fig", "data-rating") == "limited"
    counts = {}
    for ft in CELLS:
        r = expected_rating(ft["properties"])
        counts[r] = counts.get(r, 0) + 1
    table = pg.evaluate("[...document.querySelectorAll('.lr-table tbody tr')].map((tr) => [...tr.cells].map((c) => c.textContent))")
    want = [["Very good", "vgood"], ["Good", "good"], ["Limited", "limited"], ["Too little data", "few"]]
    assert table == [[w, fmt_int(counts.get(k, 0))] for w, k in want], table


# ---------------------------------------------------------------- tour, controls, phone, languages

def test_tour_steps_and_dismissal(site):
    pg = site.open("", mode=None, tour=True)
    pg.wait_for_selector("#sx-tour:not([hidden])")
    assert "1 of 3" in pg.inner_text("#sx-tour-step")
    pg.click("#sx-tour-next")
    assert "2 of 3" in pg.inner_text("#sx-tour-step") and "shading" in pg.inner_text("#sx-tour-title").lower()
    pg.click("#sx-tour-next")
    assert pg.inner_text("#sx-tour-next") == "Got it"
    pg.click("#sx-tour-next")
    assert pg.is_hidden("#sx-tour")
    assert pg.evaluate("localStorage.getItem('gsa-tour')") == "1"
    assert pg.evaluate("document.activeElement.id") == "sx-q"
    pg.reload()
    wait_map(pg)
    assert pg.is_hidden("#sx-tour")


def test_tour_skip(site):
    pg = site.open("", mode=None, tour=True)
    pg.wait_for_selector("#sx-tour:not([hidden])")
    pg.click("#sx-tour-skip")
    assert pg.is_hidden("#sx-tour") and pg.evaluate("localStorage.getItem('gsa-tour')") == "1"


def test_simple_controls(site):
    pg = site.open("#v=map&mode=simple", mode=None)
    pg.wait_for_function("window.__map.getLayer('sx-dots')")
    pg.click("#sx-mag [data-sm='7']")
    pg.wait_for_timeout(300)
    assert "M7+" in pg.inner_text("#sx-legend")
    assert fmt_int(sum(1 for m in EVENTS["mag"] if m >= 7)) in pg.inner_text("#sx-legend")
    pg.uncheck("#sx-plates")
    assert pg.evaluate("window.__map.getLayoutProperty('plates', 'visibility')") == "none"
    pg.uncheck("#sx-relief")
    assert pg.evaluate("window.__map.getLayoutProperty('relief', 'visibility')") == "none"
    h = pg.evaluate("location.hash")
    assert "sm=7" in h and "pl=0" in h and "rl=0" in h, h
    if pg.context.browser.browser_type.name == "chromium":  # 7.5 MB: once is enough
        pg.click("#sx-mag [data-sm='5']")
        pg.wait_for_function("document.querySelector('#sx-legend').innerText.includes('M5+')", timeout=30000)
        pg.wait_for_function("!document.querySelector('#sx-yr-hint').textContent", timeout=30000)


@pytest.mark.parametrize("scheme", ["light", "dark"])
def test_phone_bottom_sheet_360(site, scheme):
    pg = site.open(place_hash(TOKYO), viewport="phone", size=(360, 780), scheme=scheme, mode=None)
    wait_card(pg)
    ok, r = no_hscroll(pg)
    assert ok, r
    box = pg.evaluate("(() => { const b = document.getElementById('sx-card').getBoundingClientRect(); return [b.left, b.right, b.bottom, b.height]; })()")
    assert box[0] == 0 and abs(box[1] - 360) < 1 and abs(box[2] - 780) < 1 and box[3] < 780 * 0.7, box
    assert pg.is_visible("#mode-seg") and pg.is_visible("#sx-q")
    # every header control fits in 360 px
    right = pg.evaluate("Math.max(...[...document.querySelectorAll('.top-right > *')].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().right))")
    assert right <= 360, right
    # the theme moves into the menu on phones
    pg.click("#menu-btn")
    assert pg.is_visible("#nav-theme")


@pytest.mark.parametrize("lang,simple,pro,title", [
    ("en", "Simple", "Scientist", "Where do earthquakes happen"),
    ("uz", "Oddiy", "Ilmiy", "Zilzilalar qayerda"),
    ("ru", "Простой", "Научный", "Где происходят землетрясения"),
    ("es", "Sencilla", "Científica", "¿Dónde ocurren los terremotos"),
])
def test_simple_view_in_four_languages(site, lang, simple, pro, title):
    pg = site.open(place_hash(TOKYO, f"&lang={lang}"), mode=None)
    wait_card(pg)
    assert pg.inner_text("#mode-seg [data-mode=simple]") == simple
    assert pg.inner_text("#mode-seg [data-mode=pro]") == pro
    assert pg.inner_text(".sx-title").startswith(title)
    for key in ("sx-honest", "sx-rate-label", "sx-pro-btn"):
        assert pg.inner_text(f".{key}").strip()
    if lang != "en":
        assert "not a forecast" not in pg.inner_text(".sx-honest")


def test_no_console_errors_through_the_simple_flows(site):
    """The fixture fails any test with a console error; this one walks every Simple flow in one page to be explicit."""
    pg = site.open("", mode=None, tour=True)
    pg.wait_for_selector("#sx-tour:not([hidden])")
    pg.click("#sx-tour-skip")
    pg.click("#sx-q")
    pg.fill("#sx-q", "lima")
    pg.wait_for_selector("#sx-list:not([hidden]) [data-place]")
    pg.keyboard.press("ArrowDown")
    pg.keyboard.press("Enter")
    wait_card(pg)
    pg.click("#sx-card [data-pr='300']")
    pg.click("#sx-yr [data-sr='50']")
    pg.click("#sx-mag [data-sm='7']")
    pg.select_option("#lang-select", "uz")
    pg.wait_for_function("document.querySelector('#mode-seg [data-mode=simple]').textContent === 'Oddiy'")
    pg.click(".sx-rating .info-btn")
    pg.wait_for_selector(".lr-page[data-concept=recording-rating] .lr-diagram[data-ready='1']", timeout=20000)
    pg.click(".lr-top [data-learn=back]")
    pg.wait_for_selector("#sx-card:not([hidden])")
    pg.click(".sx-pro-btn")
    pg.wait_for_selector("#panel:not([hidden])")
    pg.click("#mode-seg [data-mode=simple]")
    pg.wait_for_selector("#sx-top", state="visible")
    pg.wait_for_timeout(500)
    assert not pg.errors, pg.errors
