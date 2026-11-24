"""Tests for the induced-seismicity case study helpers (scripts/induced) and the published data contract."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "induced"))
import inducedlib as il  # noqa: E402
import seislib as sl  # noqa: E402
from fetch_groningen import parse_production  # noqa: E402

SITE = ROOT / "site" / "data" / "induced" / "groningen"


def test_rd_transform_known_point_and_roundtrip():
    # origin of the RD New system: Amersfoort tower, x = 155 000 m, y = 463 000 m
    x, y = il.to_rd([5.38720621], [52.15517440])
    assert abs(x[0] - 155000) < 1.0 and abs(y[0] - 463000) < 1.0
    lon, lat = il.from_rd(x, y)
    assert abs(lon[0] - 5.38720621) < 1e-7 and abs(lat[0] - 52.15517440) < 1e-7


def test_inside_honours_holes_and_buffer():
    from shapely.geometry import Polygon
    g = Polygon([(0, 0), (10, 0), (10, 10), (0, 10)], holes=[[(4, 4), (6, 4), (6, 6), (4, 6)]])
    res = il.inside(g, [1, 5, 11, 11], [1, 5, 5, 15])
    assert res.tolist() == [True, False, False, False]
    assert il.inside(g, [11], [5], buffer_m=2.0).tolist() == [True]


def test_grid_nodes_inside_outline():
    from shapely.geometry import Polygon
    g = Polygon([(0, 0), (5000, 0), (5000, 3000), (0, 3000)])
    x, y = il.grid_nodes(g, 1000.0)
    assert x.size == 4 * 2      # interior nodes only: x in 1000..4000, y in 1000..2000
    assert il.inside(g, x, y).all()


def test_monthly_counts_threshold_binning_and_empty_months():
    t = pd.to_datetime(["2020-01-05", "2020-01-20", "2020-03-01", "2020-03-02"], utc=True)
    m = np.array([1.46, 1.44, 2.0, 0.3])          # 1.46 bins to 1.5 (counted), 1.44 to 1.4 (not counted)
    months = pd.period_range("2020-01", "2020-04", freq="M")
    assert il.monthly_counts(pd.Series(t), m, 1.5, months).tolist() == [1, 0, 1, 0]


def test_b_fixed_recovers_b_and_interval_covers_truth():
    rng = np.random.default_rng(3)
    m = sl.synth_gr(3000, 1.0, 1.5, rng=rng)
    r = il.b_fixed(np.r_[m, rng.uniform(0.0, 1.4, 500)], 1.5, nboot=500, rng=1)   # events below mc are ignored
    assert r["n"] == 3000
    assert abs(r["b"] - 1.0) < 0.05
    assert r["lo"] < 1.0 < r["hi"]
    assert abs((r["hi"] - r["lo"]) / 3.92 - r["sigma_shibolt"]) < 0.01


def test_b_fixed_small_sample_returns_nan():
    r = il.b_fixed(np.array([1.5, 1.6, 2.0]), 1.5)
    assert r["n"] == 3 and np.isnan(r["b"])


def test_annual_mc_needs_minimum_sample():
    rng = np.random.default_rng(5)
    m = sl.synth_gr(400, 1.0, 1.0, rng=rng)
    yrs = np.r_[np.full(390, 2001.5), np.full(10, 2002.5)]
    mc = il.annual_mc(yrs, m, [(2001, 2002), (2002, 2003)])
    assert abs(mc[0] - 1.2) < 0.15 and np.isnan(mc[1])   # MAXC (=1.0 for a sharp cut) + 0.2


def test_moving_bpos_recovers_b_and_uses_last_event_time():
    rng = np.random.default_rng(7)
    m = sl.synth_gr(2000, 1.0, 0.5, rng=rng)
    t = np.linspace(2000, 2010, m.size)
    mv = il.moving_bpos(t, m, 0.5, window=400, step=100, nboot=100, rng=1)
    assert len(mv) > 5
    assert abs(mv.b.median() - 1.0) < 0.12
    assert np.isclose(mv.t.iloc[0], t[399]) and np.isclose(mv.t0.iloc[0], t[0])
    assert (mv.lo <= mv.b).all() and (mv.b <= mv.hi).all()


def test_b_map_masks_sparse_nodes():
    rng = np.random.default_rng(9)
    n = 800
    m = sl.synth_gr(n, 1.0, 0.5, rng=rng)
    ex, ey = rng.normal(0, 1500, n), rng.normal(0, 1500, n)
    df = il.b_map(np.array([0.0, 50000.0]), np.array([0.0, 0.0]), ex, ey, m, np.full(n, 0.7), 0.5, 5000.0,
                  nboot=100, rng=1)
    assert np.isfinite(df.bpos[0]) and abs(df.bpos[0] - 1.0) < 0.2
    assert df.n[1] == 0 and np.isnan(df.bpos[1]) and df.q[1] == "insufficient"


def test_parse_production_units_and_order():
    recs = [{"year": "2004", "jan": 2.0e6, "feb": None, **{k: 0 for k in "mar apr may jun jul aug sep oct nov dec".split()}},
            {"year": "2003", **{k: 1.0e6 for k in "jan feb mar apr may jun jul aug sep oct nov dec".split()}}]
    df = parse_production(recs)
    assert df.month.iloc[0] == "2003-01" and df.month.iloc[-1] == "2004-12" and len(df) == 24
    assert df.gas_1e3m3.iloc[12] == 2.0e6 and np.isnan(df.gas_1e3m3.iloc[13])


@pytest.mark.skipif(not (SITE / "index.json").exists(), reason="site data not built")
def test_published_groningen_contract():
    idx = json.loads((SITE / "index.json").read_text())
    for k in ("id", "contract_version", "catalogue_cutoff_utc", "statement", "files", "sources"):
        assert k in idx
    assert "not a forecast" in idx["statement"].lower()
    for f, size in idx["files"].items():
        assert (SITE / f).stat().st_size == size
    for s in idx["sources"]:
        assert s["licence"] and s["attribution"]
    rates = json.loads((SITE / "rates.json").read_text())
    mo = rates["monthly"]
    assert len(mo["month"]) == len(mo["n_ge15"]) == len(mo["prod_bcm"])
    bmap = json.loads((SITE / "bmap.json").read_text())
    for per in bmap["periods"].values():
        for key in ("bpos", "b"):
            for v, lo, hi in zip(per[key], per[key + "_lo"], per[key + "_hi"]):
                # a b-value is never published without its 95 % interval
                assert (v is None) or (lo is not None and hi is not None and lo <= v <= hi)
    val = json.loads((SITE / "validation.json").read_text())["rows"]
    assert all(r["verdict"] in ("consistent", "differs", "matches", "not testable") for r in val)


def test_ml_ge_3_uses_reported_magnitudes_not_bins():
    import build_groningen as bg
    ev = pd.DataFrame({"mag": [2.94, 2.95, 2.99, 3.0, 3.01, 3.6]})
    ev["mb"] = sl.bin_mag(ev.mag.values)
    assert bg.at_least(ev, 3.0).mag.tolist() == [3.0, 3.01, 3.6]          # 2.95 and 2.99 are in bin 3.0, not >= 3.0


def test_production_gap_note_names_the_missing_side():
    # the shut-in phase (Oct 2023 on) was told "NLOG monthly figures start in 2003"; its gap is after 2024-12
    import build_groningen as bg
    months = pd.Series([f"{y}-{m:02d}" for y in range(2001, 2027) for m in range(1, 13)])
    prod = pd.Series(np.where((months >= "2003-01") & (months <= "2024-12"), 1.0, np.nan))
    covered = months[prod.notna()]

    def note(a, b):
        sel = (months >= a) & (months < b)
        return bg.production_gap_note(months[sel], prod[sel], covered)
    assert note("2001-01", "2003-01") == "NLOG monthly figures start in 2003-01"
    assert note("2023-10", "2026-11") == "no NLOG monthly figures after 2024-12"
    assert note("2003-01", "2014-01") is None


def test_one_bootstrap_size_everywhere():
    import inspect

    import atlaslib as al
    import build_groningen as bg
    sys.path.insert(0, str(ROOT / "scripts" / "regional"))
    sys.path.insert(0, str(ROOT / "scripts" / "monitor"))
    import build_regional as br
    import monitorlib as ml
    import regionlib as rl
    defaults = [inspect.signature(f).parameters["nboot"].default for f in
                (rl.cell_b_tv, rl.b_region, il.b_fixed, il.moving_bpos, il.b_map, al.cell_b)]
    assert set(defaults) == {al.NBOOT} and bg.NBOOT == br.NBOOT == ml.NBOOT == al.NBOOT == 1000
