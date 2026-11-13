"""Ongoing sequences (Sequence Monitor) view.

Most tests serve a small fixture (tests/e2e/fixtures/monitor/, three sequences cut from a real build) in place of
site/data/monitor/, which changes every day. One test reads the committed data as served.
"""
import json
from pathlib import Path

import pytest

from conftest import FIXTURES, no_hscroll

FIX = FIXTURES / "monitor"
N_FIX = len(json.loads((FIX / "index.json").read_text())["sequences"])


def _serve_monitor(route):
    rel = route.request.url.split("/data/monitor/", 1)[1].split("?")[0]
    path = (FIX / rel).resolve()
    if FIX not in path.parents or not path.is_file():
        route.fulfill(status=404, body="not found")
    else:
        route.fulfill(status=200, body=path.read_bytes(), content_type="application/json")


ROUTES = (("**/data/monitor/**", _serve_monitor),)


def open_monitor(site, hash_="#v=monitor", **kw):
    pg = site.open(hash_, ready=False, routes=ROUTES, **kw)
    pg.wait_for_selector(".mon-seq", timeout=20000)
    pg.wait_for_function("document.querySelectorAll('.mon-seq .chart-svg').length >= 2", timeout=20000)
    return pg


@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "light"), ("desktop", "dark")])
def test_monitor_renders(site, viewport, scheme):
    pg = open_monitor(site, viewport=viewport, scheme=scheme)
    assert pg.evaluate("document.querySelectorAll('.mon-seq').length") == N_FIX
    note = pg.inner_text(".mon-notice")
    assert "Descriptive only, not a forecast." in note
    facts = pg.inner_text(".mon-facts")
    assert "2026-11-13 00:00 UTC" in facts and "2026-11-13 00:05 UTC" in facts
    # the sequence without enough events says so instead of drawing a curve
    insuf = pg.inner_text("#mon-us6000sasz")
    assert "too few for a decay fit" in insuf and pg.query_selector("#mon-us6000sasz .chart-svg") is None
    hub = pg.inner_text("#mon-us6000rsy1")
    for s in ("Omori fit: quality A", "b: quality A", "Typical productivity for its region so far", "M 7.0",
              "Largest aftershock", "b-positive"):
        assert s in hub, s
    assert pg.query_selector("#mon-us6000rsy1 a[href='https://earthquake.usgs.gov/earthquakes/eventpage/us6000rsy1']")
    assert pg.query_selector(".nav a[data-view='monitor'][aria-current='page']")
    ok, r = no_hscroll(pg)
    assert ok, r


def test_fitted_curve_stops_at_the_cutoff(site):
    pg = open_monitor(site)
    xs = pg.evaluate("""() => { const svg = document.querySelector('#mon-us6000u18k .chart-svg');
      const rule = svg.querySelector('line.rule.dashed');
      const paths = [...svg.querySelectorAll('path.line')].map((p) => p.getAttribute('d'));
      const maxX = Math.max(...paths.flatMap((d) => [...d.matchAll(/[ML]([\\d.]+),/g)].map((m) => +m[1])));
      return [maxX, +rule.getAttribute('x1'), paths.length]; }""")
    assert xs[2] == 2, xs
    assert xs[0] <= xs[1] + 0.5, xs
    data = json.loads((FIX / "us6000u18k.json").read_text())
    assert data["cum"]["t"][-1] == pytest.approx(data["age_days"], abs=0.01)
    assert len(data["cum"]["fit"]) == len(data["cum"]["t"])


def test_deep_link_focuses_a_sequence(site):
    pg = open_monitor(site, "#v=monitor&s=us6000rsy1&lang=en")
    pg.wait_for_selector("#mon-us6000rsy1.focus")
    top = pg.evaluate("document.getElementById('mon-us6000rsy1').getBoundingClientRect().top")
    assert 0 <= top < 200, top
    # following another card's link updates the focus and keeps the language in the hash
    pg.click("#mon-us6000u18k h3 a")
    pg.wait_for_selector("#mon-us6000u18k.focus")
    assert pg.query_selector("#mon-us6000rsy1.focus") is None
    h = pg.evaluate("location.hash")
    assert "s=us6000u18k" in h and "lang=en" in h and "v=monitor" in h


@pytest.mark.parametrize("code,nav,strong", [("uz", "Davom etayotgan", "Faqat tavsif, prognoz emas."),
                                             ("ru", "Текущие", "Только описание, не прогноз."),
                                             ("es", "En curso", "Solo descriptivo, no es un pronóstico.")])
def test_monitor_languages(site, code, nav, strong):
    pg = open_monitor(site, f"#v=monitor&lang={code}")
    pg.wait_for_function(f"document.querySelector('.mon-notice strong').textContent.startsWith({json.dumps(strong)})")
    assert pg.inner_text(".nav a[data-view='monitor']") == nav
    body = pg.inner_text("#monitor-root")
    assert "mon." not in body and "regime." not in body, "untranslated key"
    ok, r = no_hscroll(pg)
    assert ok, r


def test_language_switch_and_persistence(site):
    pg = open_monitor(site)
    pg.select_option("#lang-select", "ru")
    pg.wait_for_function("document.querySelector('.mon-notice strong') && document.querySelector('.mon-notice strong').textContent.startsWith('Только')")
    pg.wait_for_selector(".mon-seq .chart-svg")
    assert "lang=ru" in pg.evaluate("location.hash") and "v=monitor" in pg.evaluate("location.hash")
    # a navigation link without a language keeps Russian, and so does a reload
    pg.evaluate("location.hash = 'v=monitor'")
    pg.wait_for_function("location.hash.includes('lang=ru')")
    pg.reload()
    pg.wait_for_selector(".mon-notice")
    assert pg.inner_text(".mon-notice strong").startswith("Только")


def test_committed_monitor_data_loads(site, base_url):
    pg = site.open("#v=monitor", ready=False)
    pg.wait_for_selector(".mon-seq", timeout=20000)
    n = json.loads((Path(__file__).resolve().parents[2] / "site" / "data" / "monitor" / "index.json").read_text())
    assert pg.evaluate("document.querySelectorAll('.mon-seq').length") == len(n["sequences"])
    assert "could not be loaded" not in pg.inner_text("#monitor-root")
