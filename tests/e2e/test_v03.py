"""v0.3 additions: the globe as the default projection and its persistence, search ranking by match quality then
population, the rating lookup (rating.json) against cells.geojson, and a Simple view that never loads cells.geojson.
"""
import json
import random

from conftest import SITE, rendered, wait_map

DATA = SITE / "data"
CELLS = json.loads((DATA / "cells.geojson").read_text())["features"]
GLOBAL_MC = json.loads((DATA / "manifest.json").read_text())["global"]["b_shallow_1976_2021"]["mc"]

proj = "((window.__map.getProjection() || {}).type || 'mercator')"


# ---------------------------------------------------------------- projection

def test_globe_is_the_default_and_the_choice_persists(site):
    pg = site.open("#v=map&mode=simple", mode=None)
    assert pg.evaluate(proj) == "globe"
    assert "g=1" in pg.evaluate("location.hash")
    assert pg.evaluate("localStorage.getItem('gsa-proj')") is None  # not stored until chosen
    pg.click("#globe-btn")
    assert pg.evaluate(proj) == "mercator"
    assert "g=0" in pg.evaluate("location.hash")
    assert pg.evaluate("localStorage.getItem('gsa-proj')") == "flat"
    # a link without g (all links made before v0.3) opens in the stored choice
    pg.goto(site.base + "#v=map&mode=simple&lang=en")
    wait_map(pg)
    assert pg.evaluate(proj) == "mercator"
    # a navigation link without g keeps the projection in use
    pg.evaluate("location.hash = 'v=about'")
    pg.wait_for_selector("#view-about:not([hidden])")
    assert "g=0" in pg.evaluate("location.hash")
    # a link's g wins over the stored choice, without changing it
    pg.goto(site.base + "#v=map&mode=simple&g=1&lang=en")
    wait_map(pg)
    assert pg.evaluate(proj) == "globe"
    assert pg.evaluate("localStorage.getItem('gsa-proj')") == "flat"
    pg.click("#globe-btn")
    pg.click("#globe-btn")
    assert pg.evaluate("localStorage.getItem('gsa-proj')") == "globe"


def test_old_links_without_g_open_on_the_globe(site):
    pg = site.open("#v=map&l=b&d=sh&lang=en", mode=None)  # a v0.2 Scientist link
    assert pg.evaluate("document.documentElement.dataset.mode") == "pro"
    assert pg.evaluate(proj) == "globe"
    pg2 = site.open("#v=map&l=b&d=sh&g=0&lang=en", mode=None)
    assert pg2.evaluate(proj) == "mercator"


def test_layers_render_on_the_globe(site):
    pg = site.open("#v=map&mode=simple&at=2.5/35/140", mode=None)
    pg.wait_for_function("window.__map.getLayer('sx-dots') && window.__map.queryRenderedFeatures({layers: ['sx-dots']}).length > 100")
    assert pg.evaluate(proj) == "globe"
    for layer in ("sx-dots", "coast", "land", "plates"):
        assert rendered(pg, layer) > 0, layer
    # the Scientist cells, across the antimeridian (Fiji and Tonga sit on both sides of 180 degrees)
    pg2 = site.open("#v=map&l=q&d=sh&at=3/-18/179.5&lang=en")
    assert pg2.evaluate(proj) == "globe"
    # (point queries: a whole-viewport query on the globe returns features of the wrong side in MapLibre 5.24)
    hits = pg2.evaluate("""() => [[179.5, -18], [-175, -20]].map(([lon, lat]) => { const m = window.__map;
      const p = m.project([lon, lat]); const f = m.queryRenderedFeatures([p.x, p.y], {layers: ['cells-fill']})[0];
      return f ? f.properties.lon : null; })""")
    assert hits[0] is not None and hits[0] > 170 and hits[1] is not None and hits[1] < -170, hits


def test_globe_on_a_phone(site):
    pg = site.open("#v=map&mode=simple", viewport="phone", mode=None)
    assert pg.evaluate(proj) == "globe"
    pg.wait_for_function("window.__map.getLayer('sx-dots') && window.__map.queryRenderedFeatures({layers: ['sx-dots']}).length > 100")
    # the whole globe is in sight: its disc fits the map width
    r = pg.evaluate("""() => { const m = window.__map, c = m.getCenter(); const a = m.project([c.lng, c.lat]);
      const b = m.project([c.lng + 89, 0]); return [b.x - a.x, m.getContainer().clientWidth]; }""")
    assert 0.3 * r[1] < r[0] < 0.5 * r[1], r


# ---------------------------------------------------------------- search ranking

def search(pg, q):
    pg.fill("#sx-q", q)
    pg.wait_for_function("(q) => !document.getElementById('sx-list').hidden && document.getElementById('sx-q').value === q "
                         "&& document.querySelector('#sx-list [role=option]')", arg=q)
    pg.wait_for_timeout(150)
    return pg.eval_on_selector_all("#sx-list [role=option][data-place]",
                                   "(els) => els.map((e) => e.querySelector('.sx-opt-name').textContent + ' | ' + e.querySelector('.sx-opt-where').textContent)")


def test_search_ranks_by_match_then_population(site):
    pg = site.open("#v=map&mode=simple&lang=en", mode=None)
    pg.click("#sx-q")
    got = search(pg, "San")
    names = [g.split(" | ")[0] for g in got]
    mali = next(i for i, g in enumerate(got) if g.startswith("San |") and g.endswith("Mali"))
    for big in ("San Francisco", "Santiago", "San Diego"):
        assert names.index(big) < mali, got
    # an exact name that falls outside the first results is still listed
    assert len(got) == 8 and mali == 7, got
    assert search(pg, "Paris")[0].endswith("France")
    york = [g.split(" | ")[0] for g in search(pg, "York")]
    assert york.index("York") < york.index("New York"), york  # starts with the query before a later word
    # accents and Cyrillic still match
    assert search(pg, "zurich")[0].startswith("Zürich")
    assert search(pg, "Киев")[0].startswith("Kyiv")


# ---------------------------------------------------------------- rating.json

def test_rating_lookup_matches_cells_and_the_js_rule(site):
    pg = site.open("#v=map&mode=simple", mode=None)
    rnd = random.Random(7)
    pts = [[ft["properties"]["lat"], ft["properties"]["lon"]] for ft in CELLS]
    pts += [[rnd.uniform(-89, 89), rnd.uniform(-180, 180)] for _ in range(3000)]
    res = pg.evaluate("""async ([g, pts]) => {
      const m = await import('./js/places.js');
      const [look, cells] = await Promise.all([m.loadRating(), fetch('data/cells.geojson').then((r) => r.json())]);
      const bad = [];
      cells.features.forEach((f, i) => {
        const p = f.properties, q = look[i].properties;
        const want = { id: p.id, lat: p.lat, lon: p.lon, sh_q: p.sh_q, sh_mc: p.sh_mc, c_flag: p.c_flag,
          area: Math.round(p.area_km2 / 1000), rating: m.recordingRating(p, g) };
        const got = { id: q.id, lat: q.lat, lon: q.lon, sh_q: q.sh_q, sh_mc: q.sh_mc, c_flag: q.c_flag,
          area: Math.round(q.area_km2 / 1000), rating: q.rating };
        if (JSON.stringify(want) !== JSON.stringify(got)) bad.push([want, got]);
        if (JSON.stringify(f.geometry.coordinates) !== JSON.stringify(look[i].geometry.coordinates)) bad.push(['ring', p.id]);
      });
      let diff = 0;
      for (const [lat, lon] of pts) if (m.cellAtPoint(cells.features, lat, lon).id !== m.cellAtPoint(look, lat, lon).id) diff++;
      const counts = {}; for (const f of look) counts[f.properties.rating] = (counts[f.properties.rating] || 0) + 1;
      return { n: look.length, bad: bad.slice(0, 3), diff, counts };
    }""", [GLOBAL_MC, pts])
    assert res["n"] == len(CELLS) == sum(res["counts"].values())
    assert not res["bad"], res["bad"]
    assert res["diff"] == 0, res


# ---------------------------------------------------------------- Simple view without cells.geojson

def test_simple_view_never_loads_cells(site):
    urls = []

    def rec(route):
        urls.append(route.request.url)
        route.continue_()

    pg = site.open("#v=map&mode=simple&lang=en", mode=None, routes=[("**/data/**", rec)])
    pg.click("#sx-q")
    pg.fill("#sx-q", "Tokyo")
    pg.wait_for_selector("#sx-list [role=option][data-place]")
    pg.keyboard.press("Enter")
    pg.wait_for_selector("#sx-card:not([hidden]) .sx-rating[data-rating]", timeout=20000)
    assert pg.get_attribute(".sx-rating", "data-rating") == "vgood"
    assert any(u.endswith("/data/rating.json") for u in urls), urls
    assert not any("cells.geojson" in u for u in urls), [u for u in urls if "cells" in u]
    # the Scientist view loads the cells and draws them
    pg.click("#mode-seg [data-mode=pro]")
    pg.wait_for_function("window.__map.queryRenderedFeatures({layers: ['cells-fill']}).length > 20", timeout=20000)
    assert any(u.endswith("/data/cells.geojson") for u in urls)
    pg.wait_for_selector("#map-status", state="hidden")
    assert "km²" in pg.inner_text("#pro-hex")  # the hexagon line is filled once the cells are in


def test_scientist_view_of_a_place_waits_for_the_cells(site):
    pg = site.open("#v=map&mode=simple&p=35.690/139.692&lang=en", mode=None)
    pg.wait_for_selector("#sx-card:not([hidden]) .sx-pro-btn", timeout=20000)
    cid = pg.get_attribute(".sx-pro-btn", "data-cell")
    pg.click(".sx-pro-btn")
    pg.wait_for_selector("#panel:not([hidden]) .chart-svg", timeout=20000)
    assert f"c={cid}" in pg.evaluate("location.hash")
    assert "mode=pro" in pg.evaluate("location.hash")
