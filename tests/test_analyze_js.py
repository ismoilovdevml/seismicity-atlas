"""The browser analysis (site/js/analyze/core.js) against the Python package on the same files.

Deterministic numbers (Mc, b, b-positive, FMD, Mc by year, warnings) must be equal; bootstrap interval ends use a
different random generator and must agree within Monte-Carlo noise. Skipped when Node.js is not installed."""
import json
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
from test_package import synth  # noqa: E402

NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js not installed")


def run_js(csv, nboot=1000, fp=None):
    out = subprocess.run([NODE, str(ROOT / "tests" / "js" / "analyze_cli.mjs"), str(csv), str(nboot), json.dumps(fp)],
                         check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


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
}


@pytest.mark.parametrize("name", list(CASES))
def test_js_equals_python(name, tmp_path):
    make, fp = CASES[name]
    csv = tmp_path / "c.csv"
    make().to_csv(csv, index=False)
    py = sa.analyze(sa.read_catalog(csv), nboot=1000, floor_periods=fp)
    js = run_js(csv, 1000, fp)
    assert js["n"] == py["n_events"]
    assert js["mc"]["maxc02"] == py["mc"]["maxc02"]
    assert js["b"]["n_above_threshold"] == py["b"]["n_above_threshold"]
    assert js["fmd"]["count"] == py["fmd"]["count"] and js["fmd"]["cumulative"] == py["fmd"]["cumulative"]
    assert js["years"] == py["mc_by_year"]
    assert sorted(js["warn"]) == py_warn_keys(py)
    if py["b"]["b"] is None:
        assert js["b"]["b"] is None
        return
    assert js["b"]["b"] == pytest.approx(py["b"]["b"], abs=1e-9)
    for kj, kp in (("b_plus02", "b_threshold_plus_0.2"), ("b_plus04", "b_threshold_plus_0.4")):
        assert js["b"][kj] == pytest.approx(py["b"][kp], abs=1e-9)
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
