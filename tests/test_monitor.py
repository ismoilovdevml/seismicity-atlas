"""Sequence Monitor maths: synthetic recovery and small exact checks (scripts/monitor/monitorlib.py)."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "monitor"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import monitorlib as ml  # noqa: E402
import seislib as sl  # noqa: E402


def synth_sequence(K, c, p, T, mag_main, mcat, b, rng):
    """Omori-Utsu times for M >= mcat, GR magnitudes, then the early events below Mc(t) are removed."""
    r = np.random.default_rng(rng)
    t = sl.synth_omori(K, c, p, 0.0, T, rng=r.integers(1e9))
    m = sl.synth_gr(t.size, b, mcat, rng=r.integers(1e9))
    keep = m >= ml.mc_t(t, mag_main, mcat) - ml.DM / 2 + 1e-9   # same rule as the fit (binned magnitudes)
    return t[keep], m[keep]


def test_omori_recovery_with_time_dependent_mc():
    # Mm 7.5 with Mcat 2.5: Mc(t) stays above Mcat for the first 4.6 days, so the early loss is large
    p_true, c_true, K = 1.1, 0.05, 40.0
    ps, sps, inside = [], [], 0
    for s in range(20):
        t, m = synth_sequence(K, c_true, p_true, 200.0, 7.5, 2.5, 1.0, s)
        f = ml.omori_fit(t, m, 200.0, 7.5, 2.5, 1.0)
        ps.append(f["p"]); sps.append(f["sp"])
        inside += f["p_lo"] <= p_true <= f["p_hi"]
    assert abs(np.mean(ps) - p_true) < 0.035, np.mean(ps)   # about 3 standard errors of the mean
    assert inside >= 16, inside          # 95 % intervals: expect about 19 of 20
    assert abs(np.std(ps, ddof=1) / np.mean(sps) - 1) < 0.5


def test_expected_cumulative_matches_count_at_the_fit():
    t, m = synth_sequence(30.0, 0.05, 1.05, 100.0, 7.5, 2.5, 1.0, 7)
    f = ml.omori_fit(t, m, 100.0, 7.5, 2.5, 1.0)
    e = ml.expected_cum([100.0], f["K"], f["c"], f["p"], 7.5, 2.5, 1.0)[0]
    assert abs(e - f["n"]) / f["n"] < 0.01, (e, f["n"])   # the MLE of K reproduces the total count
    g = ml.expected_cum([1.0, 10.0, 100.0], f["K"], f["c"], f["p"], 7.5, 2.5, 1.0)
    assert np.all(np.diff(g) > 0)


def test_productivity_recovers_a_and_classifies():
    reg = "ANSR-SHALCON"
    p_reg, a_mean = ml.PAGE2016[reg][:2]
    Mm, mcat, T = 7.2, 3.0, 300.0
    for shift, want in ((0.0, "typical"), (1.0, "more"), (-1.0, "less")):
        a_true = a_mean + shift
        K = 10 ** (a_true + 1.0 * (Mm - mcat))
        t, m = synth_sequence(K, ml.PAGE_C, p_reg, T, Mm, mcat, 1.0, 11)
        r = ml.productivity(t, m, T, Mm, mcat, reg)
        assert abs(r["a"] - a_true) < 4 / (math.log(10) * math.sqrt(r["n"])), (r["a"], a_true)
        assert r["class"] == want, (shift, r)
        assert r["a_lo"] < r["a"] < r["a_hi"]


def test_a_sigma_matches_the_opensha_formula():
    assert abs(ml.a_sigma("ANSR-SHALCON", 7.0) - math.sqrt(0.49 ** 2 + 570 ** 2 / 1e7)) < 1e-12
    assert ml.a_sigma("SZ-GENERIC", 5.0) == ml.a_sigma("SZ-GENERIC", 6.0)   # sigma is frozen below M 6


def test_b_bootstrap_recovers_b_and_gates():
    t, m = synth_sequence(80.0, 0.05, 1.0, 200.0, 7.5, 2.5, 1.0, 3)
    r = ml.b_bootstrap_seq(t, m, 200.0, 7.5, floor=2.5, nboot=100)
    assert r["q"] in ("A", "B") and r["lo"] <= 1.0 <= r["hi"], r
    few = ml.b_bootstrap_seq(t[:30], m[:30], 200.0, 7.5, floor=2.5, nboot=20)
    assert few["q"] == "insufficient" and few["b"] is None


def test_select_mainshocks_absorbs_aftershocks_and_doublets():
    # 0: M7.5 at day 10; 1: M7.2 33 s earlier, 140 km away (doublet within 2R); 2: M7.0 aftershock 50 km away;
    # 3: M7.1 far away (independent)
    t = np.array([10.0, 10.0 - 33 / 86400, 40.0, 20.0])
    lat = np.array([0.0, 0.0, 0.0, 30.0])
    lon = np.array([0.0, 140 / 111.19, 50 / 111.19, 0.0])
    mag = np.array([7.5, 7.2, 7.0, 7.1])
    chosen, absorbed = ml.select_mainshocks(t, lat, lon, mag)
    assert chosen == [0, 3]
    assert sorted(absorbed[0]) == [1, 2]


def test_regime_table_decoder():
    # synthetic grid in the OpenSHA format: west of the date-line split = regime 3, east = regime 11
    rows = ["0"] * 15
    for _ in range(ml.RegimeTable.LAT_N):
        rows += ["2", "0", "3600", "3", "11"]
    tab = ml.RegimeTable(" ".join(rows))
    assert tab.regime(10.0, -60.0) == "ANSR-SHALCON"
    assert tab.regime(-10.0, 60.0) == "SZ-GENERIC"
    assert tab.regime(0.0, 300.0) == "ANSR-SHALCON"     # 300 E = 60 W


def test_small_helpers():
    assert ml.bath(np.array([5.0, 6.3, 4.8]), 7.5) == {"mag": 6.3, "dm": 1.2}
    assert ml.bath(np.array([]), 7.5) is None
    allc, mc = ml.daily_counts(np.array([0.1, 0.5, 1.2, 2.9]), np.array([4.0, 5.0, 4.6, 3.0]), 3.0, 4.5)
    assert allc == [2, 1, 1] and mc == [1, 1, 0]
    g = ml.cum_grid(3.4)
    assert g[0] == round(1 / 24, 4) and g[-1] == 3.4 and np.all(np.diff(g) > 0)
    assert ml.wc_radius_km(6.0) == 100.0 and abs(ml.wc_radius_km(8.0) - 10 ** 2.28) < 1e-9


def test_depth_window():
    z = np.array([10.0, 120.0, 590.0, np.nan, 499.0])
    assert ml.depth_window(z, 600.0).tolist() == [False, False, True, True, False]   # deep mainshock: shallow out
    assert ml.depth_window(z, 25.0).tolist() == [True, True, False, True, False]     # intraslab below a megathrust in
    assert ml.depth_window(z, None).all() and ml.depth_window(z, float("nan")).all()


def test_b_positive_seq_uses_events_above_mcat():
    # complete above 3.0 only: half of the events between 2.5 and 3.0 are missing (static incompleteness), which
    # biases b-positive low when they enter the differences (audit fix: the monitor now cuts at Mcat)
    r = np.random.default_rng(4)
    m = sl.synth_gr(20000, 1.0, 2.5, rng=5)
    m = m[(m >= 3.0 - 0.05) | (r.random(m.size) < 0.3)]
    t = np.sort(r.uniform(0, 100, m.size))
    all_ = ml.b_positive_seq(t, m)
    cut = ml.b_positive_seq(t, m, 3.0)
    assert cut["n"] < all_["n"]
    assert cut["lo"] < 1.0 < cut["hi"], cut
    assert all_["hi"] < 1.0, all_


def test_sequence_query_falls_back_to_higher_magnitude_then_time_split(monkeypatch):
    import pandas as pd
    import build_monitor as bm
    calls = []

    def fake(params, refresh=False):
        calls.append(dict(params))
        span = pd.Timestamp(params["endtime"]) - pd.Timestamp(params["starttime"])
        if params["minmagnitude"] < 3.5 or span > pd.Timedelta(days=100):
            raise bm.TooMany("too many")
        t0 = pd.Timestamp(params["starttime"], tz="UTC")
        return pd.DataFrame({"time": [t0 + pd.Timedelta(hours=1)], "id": [params["starttime"]], "mag": [4.0]})

    monkeypatch.setattr(bm, "comcat_csv", fake)
    q = {"starttime": "2025-01-01T00:00:00", "endtime": "2025-12-31T00:00:00", "minmagnitude": 2.5}
    ev = bm.sequence_events(q)
    assert q["minmagnitude"] == 3.5                    # recorded for the Mcat floor
    assert len(ev) == 4 and ev.time.is_monotonic_increasing
    assert calls[0]["minmagnitude"] == 2.5 and all(c["minmagnitude"] == 3.5 for c in calls[1:])
