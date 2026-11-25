"""Edge cases of the statistics library (0.6.0 audit): Omori fits with too few events or c or p at a bound, the
omori_fit_mct integral from T1 = 0, and mc_mbs on empty or truncated windows."""
import sys
import warnings
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "monitor"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import monitorlib as ml  # noqa: E402
import seislib as sl  # noqa: E402


# ----------------------------------------------------------------------------------------------- Omori-Utsu
def _fits(t, T2=100.0):
    return (sl.omori_fit(t, 0.0, T2),
            sl.omori_fit_mct(t, np.full(np.size(t), 6.0), 0.0, T2, 7.0, 4.5, 1.0))


@pytest.mark.parametrize("n", [0, 1])
def test_omori_too_few_events_is_unfit_without_warnings(n):
    t = np.linspace(1.0, 5.0, n)
    with warnings.catch_warnings():
        warnings.simplefilter("error")          # n = 0 used to give log(0) and 0 * inf RuntimeWarnings
        fits = _fits(t)
    for f in fits:
        assert f["fitted"] is False and f["n"] == n
        assert all(np.isnan(f[k]) for k in ("K", "c", "p", "sK", "sc", "sp", "logL"))
        assert f["c_at_bound"] is False and f["c_bound"] is None
        assert f["p_at_bound"] is False and f["p_bound"] is None
        # the callers' contract: float() of every estimate works (NaN), as for a failed Hessian
        assert all(isinstance(float(f[k]), float) for k in ("K", "c", "p", "sK", "sc", "sp"))


def test_omori_normal_fit_is_marked_fitted():
    t = sl.synth_omori(200.0, 0.05, 1.1, 0.0, 100.0, rng=5)
    a, b = _fits(t)
    assert a["n"] == t.size and 0 < b["n"] <= t.size      # omori_fit_mct drops events below Mc(t)
    for f in (a, b):
        assert f["fitted"] is True and np.isfinite(f["p"]) and np.isfinite(f["sp"])


def test_omori_c_at_upper_bound_is_flagged():
    # a rate that hardly decays within one day (true c = 5 days): c runs to the upper bound max(T2, 1) = 1 day,
    # where the full Hessian is not that of a maximum; up to 0.6.0 it was not flagged and sp, sc came out NaN or
    # meaningless
    t = sl.synth_omori(3000.0, 5.0, 1.1, 0.0, 1.0, rng=1)
    m = np.full(t.size, 6.0)
    for f in (sl.omori_fit(t, 0.0, 1.0), sl.omori_fit_mct(t, m, 0.0, 1.0, 4.0, 2.0, 1.0)):
        assert f["c"] == pytest.approx(1.0, rel=2e-3)
        assert f["c_at_bound"] is True and f["c_bound"] == "upper"
        assert np.isnan(f["sc"])
        assert np.isfinite(f["sp"]) and np.isfinite(f["sK"])   # errors of p and K for c fixed at the bound


def test_omori_c_at_lower_bound_names_the_bound():
    # the first hours are missing (T1 = 0.5 day) and the rate is a pure power law: c -> c_min
    t = sl.synth_omori(500.0, 1e-6, 1.1, 0.5, 365.0, rng=10)
    f = sl.omori_fit(t, 0.5, 365.0)
    assert f["c_at_bound"] is True and f["c_bound"] == "lower"
    assert f["c"] == pytest.approx(sl.C_MIN_DAYS, rel=2e-3) and np.isnan(f["sc"])
    # an interior c is never flagged
    g = sl.omori_fit(sl.synth_omori(300.0, 0.1, 1.1, 0.0, 365.0, rng=8), 0.0, 365.0)
    assert g["c_at_bound"] is False and g["c_bound"] is None and np.isfinite(g["sc"])


def test_omori_fixed_c_is_never_at_bound():
    t = sl.synth_omori(300.0, 0.1, 1.1, 0.0, 365.0, rng=9)
    for f in (sl.omori_fit(t, 0.0, 365.0, fix_c=365.0),
              sl.omori_fit_mct(t, np.full(t.size, 6.0), 0.0, 365.0, 7.0, 4.5, 1.0, fix_c=365.0)):
        assert f["c_at_bound"] is False and f["c_bound"] is None


def test_omori_p_at_lower_bound_is_flagged_and_not_quality_a_or_b():
    # a flat rate (200 events uniform over a year): p runs to the lower search bound 0.05. Up to 0.6.0 this was not
    # flagged and sp was the curvature at the bound (0.0715 with c fixed at 1 day, below the A limit of 0.10)
    t = np.sort(np.random.default_rng(42).uniform(0.0, 365.0, 200))
    m = np.full(t.size, 6.0)
    for f in (sl.omori_fit(t, 0.0, 365.0), sl.omori_fit(t, 0.0, 365.0, fix_c=1.0),
              sl.omori_fit_mct(t, m, 0.0, 365.0, 7.0, 4.5, 1.0),
              sl.omori_fit_mct(t, m, 0.0, 365.0, 7.0, 4.5, 1.0, fix_c=1.0)):
        assert f["p"] == pytest.approx(sl.P_BOUNDS[0], abs=1e-3)
        assert f["p_at_bound"] is True and f["p_bound"] == "lower"
        assert np.isnan(f["sp"])                       # no interval for a p pinned at the bound
        assert np.isfinite(f["sK"]) and f["sK"] > 0     # K error for p (and c, if at a bound) fixed there
    # the callers' quality rule (monitorlib.omori_quality = scripts/sequences.py): not A or B, and no p interval
    fit = ml.omori_fit(t, m, 365.0, 7.0, 4.5, 1.0)
    assert fit["p_lo"] is None and fit["p_hi"] is None
    assert ml.omori_quality(fit, contaminated=False) not in ("A", "B")


def test_omori_p_at_upper_bound_is_flagged():
    # true p = 7 (all events within the first hour): p runs to the upper bound 5.0; c stays interior and keeps
    # its error (for p fixed at the bound)
    pt, c = 7.0, 0.01
    t = sl.synth_omori(200.0 * (pt - 1) * c ** (pt - 1), c, pt, 0.0, 365.0, rng=3)
    m = np.full(t.size, 6.0)
    for f in (sl.omori_fit(t, 0.0, 365.0), sl.omori_fit_mct(t, m, 0.0, 365.0, 6.5, 4.5, 1.0, H=0.0)):
        assert f["p"] == pytest.approx(sl.P_BOUNDS[1], abs=1e-3)
        assert f["p_at_bound"] is True and f["p_bound"] == "upper"
        assert np.isnan(f["sp"]) and np.isfinite(f["sK"])
        assert f["c_at_bound"] is False and np.isfinite(f["sc"])


# omori_fit / omori_fit_mct of synth_omori(200, 0.05, 1.1, 0, 100, rng=5) on main 8706ec4, before p_at_bound
_MAIN_8706EC4 = {
    "free": (201.44931711035625, 0.04528263486757434, 1.1004857606542293, 8.510810555691972, 0.007086127892447481,
             0.01907469712415359),
    "fixc": (205.82220738751982, 0.05, 1.1100973415374755, 5.4062622726594745, np.nan, 0.01207744976826616),
    "mct": (199.33359593808024, 0.04226373744431257, 1.0962424262278918, 8.41521865661462, 0.006903806165913198,
            0.019057881877301085),
    "mctfix": (206.53112170159199, 0.05, 1.112116537094116, 5.427715313195088, np.nan, 0.012117104000219434)}


def test_omori_interior_p_is_not_flagged_and_unchanged():
    t = sl.synth_omori(200.0, 0.05, 1.1, 0.0, 100.0, rng=5)
    m = np.full(t.size, 6.0)
    fits = {"free": sl.omori_fit(t, 0.0, 100.0), "fixc": sl.omori_fit(t, 0.0, 100.0, fix_c=0.05),
            "mct": sl.omori_fit_mct(t, m, 0.0, 100.0, 7.0, 4.5, 1.0),
            "mctfix": sl.omori_fit_mct(t, m, 0.0, 100.0, 7.0, 4.5, 1.0, fix_c=0.05)}
    for name, f in fits.items():
        assert f["p_at_bound"] is False and f["p_bound"] is None
        got = [f[k] for k in ("K", "c", "p", "sK", "sc", "sp")]
        assert got == pytest.approx(list(_MAIN_8706EC4[name]), rel=1e-9, nan_ok=True), name


def test_omori_fit_mct_integrates_from_T1_zero():
    # constant completeness (H = 0, F Mm - G <= Mcat): every weight is 1 and omori_fit_mct must reproduce the
    # analytic omori_fit. Up to 0.6.0 its numerical integral started at 1e-6 day and missed [0, 1e-6] (0.13 % of
    # the integral at c = 1e-4, p = 1.1): K differed by 1.6e-4 and p by 3e-4 here
    t = sl.synth_omori(200.0, 1e-3, 1.1, 0.0, 365.0, rng=11)
    a = sl.omori_fit(t, 0.0, 365.0, fix_c=1e-4)
    b = sl.omori_fit_mct(t, np.full(t.size, 5.0), 0.0, 365.0, 6.5, 4.5, 1.0, H=0.0, fix_c=1e-4)
    assert a["n"] == b["n"] == t.size
    assert b["K"] / a["K"] - 1 == pytest.approx(0.0, abs=2e-5)
    assert b["p"] - a["p"] == pytest.approx(0.0, abs=2e-5)


# ----------------------------------------------------------------------------------------------- mc_mbs
def test_mc_mbs_empty_and_small_inputs_are_nan():
    assert np.isnan(sl.mc_mbs(np.array([])))             # raised ValueError (min of an empty array) up to 0.6.0
    assert np.isnan(sl.mc_mbs(np.array([np.nan, np.nan])))
    assert np.isnan(sl.mc_mbs(sl.synth_gr(49, 1.0, 3.0, rng=1)))   # fewer than nmin = 50 events


def test_mc_mbs_needs_a_complete_window():
    # 60 events in one bin and one above: b(3.0) is finite (n = 61) but b is NaN from 3.1 upwards (fewer than two
    # events), so the window [3.0, 3.5] has a single finite b. nanmean of that one value equals b(3.0) and the
    # candidate passed on its own b (0.6.0 returned 3.0)
    m = np.r_[np.full(60, 3.0), [3.1]]
    b, sig, n, _ = sl.b_aki(m, 3.0)
    assert n == 61 and np.isfinite(b) and np.isfinite(sig)
    assert np.isnan(sl.mc_mbs(m))


def test_mc_mbs_unchanged_on_complete_windows():
    rng = np.random.default_rng(6)
    m = sl.synth_gr(50000, 1.0, 0.5, rng=7)
    m = m[rng.uniform(size=m.size) < 1 / (1 + np.exp(-(m - 1.8) / 0.08))]
    assert 1.8 <= sl.mc_mbs(m) <= 2.5
    # a pure Gutenberg-Richter sample is stable from its lowest bin
    assert sl.mc_mbs(sl.synth_gr(5000, 1.0, 4.0, rng=3)) == pytest.approx(4.0)
