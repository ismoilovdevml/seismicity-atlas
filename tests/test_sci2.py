"""Second round of scientific comparisons: estimators (scripts/sci2/sci2lib.py) and the Zhang & Werner (2020)
productivity comparison of the monitor (scripts/monitor/monitorlib.py)."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
for p in (ROOT / "scripts" / "sci2", ROOT / "scripts" / "monitor", ROOT / "scripts"):
    sys.path.insert(0, str(p))
import monitorlib as ml  # noqa: E402
import sci2lib as s2  # noqa: E402
import seislib as sl  # noqa: E402


# ----------------------------------------------------------------------------------------------- sci2lib
def test_weighted_b_reduces_to_aki_utsu_and_recovers_a_step():
    r = np.random.default_rng(1)
    # uniform weights (huge kernel): the weighted MLE equals the classical MLE without the (N-1)/N factor
    m = sl.synth_gr(4000, 1.0, 2.0, dm=0.1, rng=r.integers(1e9))
    lat, lon = r.uniform(42, 43, m.size), r.uniform(12, 13, m.size)
    b, s, ne = s2.b_wle(42.5, 12.5, lat, lon, m, np.full(m.size, 2.0), 0.1, 1e6)
    b_cl = 1 / (math.log(10) * (np.mean(m - 2.0) + 0.05))
    assert abs(b[0] - b_cl) < 1e-9 and abs(ne[0] - m.size) < 1e-6
    assert abs(s[0] - b[0] / math.sqrt(m.size)) < 1e-9
    # two half-planes with b 0.8 (west) and 1.2 (east): a narrow kernel recovers each side
    n = 20000
    lon = r.uniform(10, 14, n)
    lat = r.uniform(42, 43, n)
    bt = np.where(lon < 12, 0.8, 1.2)
    m = 2.0 + r.exponential(1 / (bt * math.log(10)))
    m = np.round(m / 0.01) * 0.01
    b, s, _ = s2.b_wle([42.5, 42.5], [10.8, 13.2], lat, lon, m, np.full(n, 2.0), 0.01, 20.0)
    assert abs(b[0] - 0.8) < 4 * s[0] and abs(b[1] - 1.2) < 4 * s[1], (b, s)


def test_whole_catalogue_b_with_per_event_mc():
    r = np.random.default_rng(2)
    mc = np.r_[np.full(3000, 3.0), np.full(3000, 2.0)]
    m = mc + np.round(r.exponential(1 / math.log(10), mc.size) / 0.01) * 0.01   # b = 1 above each threshold
    b, n, sig = s2.b_whole_tz(m, mc, 0.01)
    assert n == 6000 and abs(b - 1.0) < 3 * sig


def test_single_mc_estimator():
    m = sl.synth_gr(3000, 1.0, 1.0, rng=3)
    m = np.r_[m, np.full(200, 0.8), np.full(100, 0.9)]   # an incomplete tail below Mc
    q = s2.b_single_mc(m, 0.1, 0.0)
    assert q["mc"] == 1.0 and abs(q["b"] - 1.0) < 3 * q["sigma"]
    assert s2.b_single_mc(m[:20])["n"] == 20 and np.isnan(s2.b_single_mc(m[:20])["b"])


def test_day_night_ratio():
    assert s2.day_night_ratio(np.arange(24)) == 1.0
    assert s2.day_night_ratio(np.r_[np.full(30, 10), np.full(10, 2)]) == 3.0
    assert s2.is_daytime(np.array([6, 7, 18, 19])).tolist() == [False, True, True, False]


def test_n_test_matches_pycsep_definition():
    d1, d2 = s2.n_test_poisson(10.0, 10)
    assert abs(d1 - (1 - stats.poisson.cdf(9, 10))) < 1e-12 and abs(d2 - stats.poisson.cdf(10, 10)) < 1e-12
    d1, d2 = s2.n_test_poisson(10.0, 30)
    assert d1 < 1e-5 and d2 > 0.99999
    m1, m2 = s2.n_test_mixture([10.0, 10.0], 10)
    assert abs(m1 - s2.n_test_poisson(10.0, 10)[0]) < 1e-12 and abs(m2 - s2.n_test_poisson(10.0, 10)[1]) < 1e-12


# ----------------------------------------------------------------------------------------------- Zhang & Werner
def zw_synth(mag_main, mcat, T, scale, seed):
    """Direct aftershocks only, with the Table 6 parameters times `scale`; events below Mc(t) removed."""
    z = ml.ZW2020
    K = scale * z["K0"] * math.exp(z["alpha"] * (mag_main - z["mcut"])) * 10 ** (-(mcat - z["mcut"])) \
        * (z["p"] - 1) * z["c"] ** (z["p"] - 1)
    r = np.random.default_rng(seed)
    t = sl.synth_omori(K, z["c"], z["p"], 0.0, T, rng=r.integers(1e9))
    m = sl.synth_gr(t.size, 1.0, mcat, rng=r.integers(1e9))
    keep = m >= ml.mc_t(t, mag_main, mcat) - ml.DM / 2 + 1e-9
    return t[keep], m[keep]


def test_zw_recovers_unit_ratio_and_scaling():
    lr = []
    for s in range(12):
        t, m = zw_synth(8.0, 4.4, 200.0, 1.0, s)
        r = ml.zw2020_productivity(t, m, 200.0, 8.0, 4.4, "SZ-GENERIC", 25.0)
        assert r["applicable"] and r["in_calibration_range"] and r["ratio_lo"] < r["ratio"] < r["ratio_hi"]
        lr.append(math.log10(r["ratio"]))
    # Poisson scatter only (about 0.03 in log10 for ~250 events): the mean log ratio is close to 0
    assert abs(np.mean(lr)) < 0.03, np.mean(lr)
    t, m = zw_synth(7.6, 4.5, 150.0, 30.0, 99)
    r = ml.zw2020_productivity(t, m, 150.0, 7.6, 4.5, "SZ-ONSHORE", 20.0)
    assert abs(math.log10(r["ratio"] / 30.0)) < 0.1 and r["class"] == "above"


def test_zw_reference_and_gating():
    ref = ml.zw_reference_ratios()
    idx = [x[0] for x in ref]
    assert 16 not in idx and 25 not in idx and 18 not in idx and 23 not in idx  # M8.0 window, Mc>4.5, <100 events
    tohoku_free = [x for x in ref if x[0] == 10][0]
    want = 3298 / (0.04 * math.exp(2.3 * 4.5) * (1 - (1 + 4 * 365.25 / 0.03) ** (1 - 1.21)))
    assert abs(tohoku_free[3] - want) < 1e-9
    assert 1 - ml.zw_omori_fraction(1e30) < 1e-5 and ml.zw_omori_fraction(0.0) == 0.0
    assert ml.zw2020_productivity(np.array([1.0]), np.array([5.0]), 10.0, 7.5, 4.5, "ANSR-SHALCON", 10.0) == \
        {"applicable": False, "reason": "not a subduction-zone regime"}
    r = ml.zw2020_productivity(np.array([1.0, 2.0]), np.array([5.0, 5.1]), 10.0, 7.5, 4.5, "SZ-GENERIC", 150.0)
    assert r["class"] == "insufficient" and r["in_calibration_range"] is False
