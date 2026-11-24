"""The browser analysis (site/js/analyze/core.js) against the Python package on the same files.

Deterministic numbers (Mc, b, b-positive, FMD, Mc by year, warnings) must be equal; bootstrap interval ends use a
different random generator and must agree within Monte-Carlo noise. Skipped when Node.js is not installed."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import seisatlas as sa  # noqa: E402
from seisatlas.report import fit_segment  # noqa: E402
from test_package import synth  # noqa: E402

NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js not installed")


def run_js(csv, nboot=1000, fp=None, floor=None):
    out = subprocess.run([NODE, str(ROOT / "tests" / "js" / "analyze_cli.mjs"), str(csv), str(nboot), json.dumps(fp),
                          json.dumps(floor)], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


CORE = (ROOT / "site" / "js" / "analyze" / "core.js").as_uri()


def node_eval(body):
    """Run an ES module body with `core` = site/js/analyze/core.js; it must print one JSON value."""
    out = subprocess.run([NODE, "--input-type=module", "-e", f"import * as core from '{CORE}';\n{body}"],
                         check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def js_error(body):
    """Code and message of the CatalogError thrown by `body`, or None."""
    return node_eval(f"try {{ {body}; console.log('null'); }} catch (e) {{ console.log(JSON.stringify("
                     "{code: e.code || null, message: e.message})); }")


WARN = {"Mixed magnitude": "mixed", "Fewer than": "few", "quality C": "wide", "b changes when": "unstable",
        "Only ": "small", "Yearly Mc": "mc_time"}


def py_warn_keys(res):
    return sorted(k for w in res["warnings"] for p, k in WARN.items() if p in w)


CASES = {
    "one period": (lambda: synth(3000, b=1.0), None),
    "high b": (lambda: synth(1500, b=1.4, seed=7), None),
    "small": (lambda: synth(120, b=0.9, seed=8), None),
    "two periods + types": (lambda: pd.concat([synth(1500, mc=3.6, seed=3, start="1990-01-01", years=5),
                                               synth(1500, mc=2.8, seed=4, start="2000-01-01", years=5,
                                                     magtype="mb")]), None),
    "period floors": (lambda: pd.concat([synth(1500, mc=3.6, seed=3, start="1990-01-01", years=5),
                                         synth(1500, mc=2.8, seed=4, start="2000-01-01", years=5)]),
                      [[1990, 1994, 3.6], [1995, 2009, 2.8]]),
    # a scalar floor above Mc: the FMD line is anchored at the floor, not at Mc
    "floor above Mc": (lambda: synth(3000, b=1.0, seed=5), None, 3.5),
    # one outlier: the G-R line reaches N = 1 before the largest magnitude and must be clipped there
    "outlier": (lambda: pd.concat([synth(400, b=1.0, seed=6), synth(1, seed=9).assign(mag=7.9)]), None),
    # missing and empty magnitude types are missing, not a type "nan" or ""
    "missing types": (lambda: synth(1500, seed=10).assign(
        magType=lambda d: ["ml" if i % 4 else ("" if i % 8 else None) for i in range(len(d))]), None),
}


@pytest.mark.parametrize("name", list(CASES))
def test_js_equals_python(name, tmp_path):
    make, fp, *rest = CASES[name]
    floor = rest[0] if rest else None
    csv = tmp_path / "c.csv"
    make().to_csv(csv, index=False)
    py = sa.analyze(sa.read_catalog(csv), nboot=1000, floor_periods=fp, floor=floor)
    js = run_js(csv, 1000, fp, floor)
    assert js["n"] == py["n_events"]
    assert set(js["b"]) == set(py["b"])  # the same keys, b_sigma_shi_bolt and threshold included
    assert js["b"]["threshold"] == py["b"]["threshold"]
    assert js["types"] == py.get("magnitude_types")
    seg = fit_segment(py)
    assert (js["seg"] is None) == (seg is None)
    if seg is not None:
        assert js["seg"] == pytest.approx(list(seg), abs=1e-9)
        assert seg[3] >= 1 - 1e-9  # the line never goes below N = 1
    assert js["mc"]["maxc02"] == py["mc"]["maxc02"]
    assert js["b"]["n_above_threshold"] == py["b"]["n_above_threshold"]
    assert js["fmd"]["count"] == py["fmd"]["count"] and js["fmd"]["cumulative"] == py["fmd"]["cumulative"]
    assert js["years"] == py["mc_by_year"]
    assert sorted(js["warn"]) == py_warn_keys(py)
    if py["b"]["b"] is None:
        assert js["b"]["b"] is None
        return
    assert js["b"]["b"] == pytest.approx(py["b"]["b"], abs=1e-9)
    for k in ("b_threshold_plus_0.2", "b_threshold_plus_0.4", "b_sigma_shi_bolt"):
        assert js["b"][k] == pytest.approx(py["b"][k], abs=1e-9)
    assert js["b"]["b_lo"] == pytest.approx(py["b"]["b_lo"], abs=0.015)
    assert js["b"]["b_hi"] == pytest.approx(py["b"]["b_hi"], abs=0.015)
    if py.get("b_positive") and py["b_positive"]["b"] is not None:
        assert js["bpos"]["b"] == pytest.approx(py["b_positive"]["b"], abs=1e-9)
        assert js["bpos"]["n_differences"] == py["b_positive"]["n_differences"]


def test_js_real_catalogue(tmp_path):
    """ISC-GEM, shallow 1976-2021 (the atlas input), when the local copy exists."""
    src = ROOT / "data" / "processed" / "iscgem.csv"
    if not src.exists():
        pytest.skip("data/processed/iscgem.csv not built")
    df = pd.read_csv(src)
    df = df[(df.depth <= 70) & (df.time >= "1976") & (df.time < "2022")]
    csv = tmp_path / "iscgem.csv"
    df.to_csv(csv, index=False)
    fp = [[1976, 2003, 5.8], [2004, 2021, 5.3]]
    py = sa.analyze(sa.read_catalog(csv), nboot=300, floor_periods=fp)
    js = run_js(csv, 300, fp)
    assert js["b"]["b"] == pytest.approx(py["b"]["b"], abs=1e-9) == pytest.approx(1.057, abs=5e-4)   # 1.053 before 0.6.0 (binning, binned MLE)
    assert js["mc"]["maxc02"] == py["mc"]["maxc02"]


def test_js_date_and_time_columns_equal_python(tmp_path):
    """A time-of-day column is joined with the date column (it used to lose the date in Python, every time in JS)."""
    csv = tmp_path / "dt.csv"
    csv.write_text("date,time,mag\n2001-03-04,12:00:00,3.1\n2005-06-07,1:02:03.5,4.2\n2006-01-01,,3.3\n")
    py = sa.read_catalog(csv)
    js = run_js(csv, 100)
    assert js["columns"]["time"] == py.columns_used["time"] == "date + time"
    py_ms = [None if pd.isna(t) else int(t.value // 10**6) for t in py.events["time"]]
    assert js["times"] == py_ms
    assert py_ms[:2] == [int(pd.Timestamp("2001-03-04 12:00:00").value // 10**6),
                         int(pd.Timestamp("2005-06-07 01:02:03.5").value // 10**6)]
    only = tmp_path / "t.csv"
    only.write_text("time,mag\n12:00:00,3.1\n13:00:00,3.2\n")
    assert not sa.read_catalog(only).has_time and "time" not in sa.read_catalog(only).columns_used
    js = run_js(only, 100)
    assert js["times"] == [None, None] and "time" not in js["columns"]


def test_js_strict_numbers_equal_python(tmp_path):
    csv = tmp_path / "n.csv"
    csv.write_text('mag,depth\n5.2abc,10\n"3,1",10\n,10\n3.0,10x\n3.1,1e1\n-0.5,.5\n')
    py = sa.read_catalog(csv)
    js = node_eval(f"const c = core.readCatalog({json.dumps(csv.read_text())}); "
                   "console.log(JSON.stringify(c.events.map((e) => "
                   "[e.mag, Number.isFinite(e.depth) ? e.depth : null])));")
    assert js == [[m, None if pd.isna(d) else d] for m, d in zip(py.events["mag"], py.events["depth"])]
    assert [r[0] for r in js] == [3.0, 3.1, -0.5]


@pytest.mark.parametrize("opts,py_kw,code", [
    ({"depthMin": 0}, {"depth_min": 0}, "noDepth"),
    ({"start": "2000-01-01"}, {"start": "2000-01-01"}, "noTime"),
    ({"lat": 1, "lon": 1, "radiusKm": 10}, {"lat": 1, "lon": 1, "radius_km": 10}, "noLocation"),
    ({"radiusKm": 10}, {"radius_km": 10}, "circle"),
])
def test_js_select_on_missing_column_is_an_error_as_in_python(opts, py_kw, code):
    text = "mag\n3.0\n3.1\n"
    with pytest.raises(ValueError):
        sa.select(sa.read_catalog(pd.DataFrame({"mag": [3.0, 3.1]})), **py_kw)
    err = js_error(f"core.select(core.readCatalog({json.dumps(text)}), {json.dumps(opts)})")
    assert err and err["code"] == code


def test_js_floor_periods_without_time_is_an_error_as_in_python():
    with pytest.raises(ValueError, match="floor_periods needs a time column"):
        sa.analyze(sa.read_catalog(pd.DataFrame({"mag": [3.0] * 60})), nboot=10, floor_periods=[(2000, 2001, 3.0)])
    err = js_error("core.analyze(core.readCatalog('mag\\n' + '3.0\\n'.repeat(60)).events, "
                   "{nboot: 10, floorPeriods: [[2000, 2001, 3.0]]})")
    assert err == {"code": "floorTime", "message": "floor_periods needs a time column"}


def test_js_large_catalogue_has_no_stack_overflow():
    """Math.min(...m) threw RangeError above ~10^5 events."""
    out = node_eval("const ev = Array.from({length: 300000}, (_, i) => ({mag: 2 + (i % 30) / 10, "
                    "time: Date.UTC(2000, 0, 1) + i * 1000, magtype: null})); "
                    "const r = core.analyze(ev, {nboot: 2}); console.log(JSON.stringify(r.magnitude_range));")
    assert out == [2, 4.9]
    src = "\n".join((ROOT / "site" / "js" / "analyze" / f).read_text() for f in ("core.js", "view.js", "worker.js"))
    assert not re.search(r"Math\.(min|max)\(\.\.\.", src)


def test_every_error_code_is_translated():
    """core.js throws codes; view.js shows an.err.<code> in the page language (en, uz, ru, es)."""
    codes = set(re.findall(r"new CatalogError\('(\w+)'", (ROOT / "site/js/analyze/core.js").read_text()))
    assert {"noRows", "noMag", "noTypeCol", "floorTime", "noDepth", "noTime", "noLocation", "circle"} <= codes
    for lang in ("en", "uz", "ru", "es"):
        text = (ROOT / "site/js/i18n" / f"{lang}.js").read_text()
        keys = set(re.findall(r'^  "(an\.[^"]+)":', text, re.M))
        missing = {f"an.err.{c}" for c in codes} | {"an.err.failed", "an.progress", "an.reading"}
        assert missing <= keys, (lang, missing - keys)
        if lang == "uz":  # Uzbek Latin apostrophes: oʻ gʻ and ʼ, not ASCII '
            assert not [k for k in keys if "'" in re.search(rf'^  "{re.escape(k)}": (.*)$', text, re.M).group(1)]
    en = set(re.findall(r'^  "(an\.[^"]+)":', (ROOT / "site/js/i18n/en.js").read_text(), re.M))
    for lang in ("uz", "ru", "es"):
        assert set(re.findall(r'^  "(an\.[^"]+)":', (ROOT / "site/js/i18n" / f"{lang}.js").read_text(), re.M)) == en


def test_js_bootstrap_drops_replicates_without_b_as_python():
    """A replicate whose events above its threshold all sit in the lowest bin has a mean excess of 0 and no b (NaN).
    atlaslib.cell_b drops it (np.isfinite); core.js kept it, and the NaN sorted to the top made the upper interval
    end NaN. Here about 1 replicate in 8 draws neither M 5.3 event."""
    import numpy as np
    from seisatlas import atlaslib as al

    m = [5.0] * 39 + [5.1, 5.1, 5.2, 5.2, 5.2, 5.3, 5.3]
    py = al.cell_b(np.array(m), np.full(len(m), -9.0), rng=20261116)
    js = node_eval(f"const m = {json.dumps(m)}; const r = core.cellB(m, m.map(() => -9), {{nboot: 1000}}); "
                   "console.log(JSON.stringify({lo: r.lo, hi: r.hi}));")
    assert np.isfinite(py["b_lo_raw"]) and np.isfinite(py["b_hi_raw"])
    assert js["lo"] is not None and js["hi"] is not None   # JSON null = NaN
    assert js["lo"] == pytest.approx(py["b_lo_raw"], abs=0.5) and js["hi"] == pytest.approx(py["b_hi_raw"], abs=0.5)
