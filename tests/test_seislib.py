"""Synthetic recovery tests: the estimators must return the parameters they were given."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import seislib as sl  # noqa: E402


def test_b_aki_recovers_b():
    for b_true in (0.8, 1.0, 1.3):
        m = sl.synth_gr(20000, b_true, 2.0, rng=1)
        b, sig, n, _ = sl.b_aki(m, 2.0)
        assert abs(b - b_true) < 3 * sig, (b_true, b, sig)
        assert n == 20000


def test_shi_bolt_matches_bootstrap():
    m = sl.synth_gr(2000, 1.0, 3.0, rng=2)
    b, sig, _, _ = sl.b_aki(m, 3.0)
    sb = sl.b_bootstrap(m, 3.0, nboot=400, rng=3)
    assert abs(sig - sb) / sb < 0.2


def test_b_positive_recovers_b_under_short_term_incompleteness():
    # Omori sequence; events below a time-dependent Mc(t) = 7.1 - 4.5 - 0.75 log10(t) are lost (Helmstetter 2006)
    t = sl.synth_omori(3000, 0.001, 1.1, 0.0, 100.0, rng=4)
    m = sl.synth_gr(t.size, 1.0, 1.0, rng=5)
    keep = m >= np.maximum(1.0, 7.1 - 4.5 - 0.75 * np.log10(np.maximum(t, 1e-6)))
    b_naive, s_naive, _, _ = sl.b_aki(m[keep], 1.0)
    b, sig, n = sl.b_positive(m[keep])
    assert b_naive < 0.9  # the plain estimate is biased low by the missing early small events
    assert abs(b - 1.0) < 3 * sig, (b, sig, n)


def test_mc_methods_find_true_mc():
    rng = np.random.default_rng(6)
    m = sl.synth_gr(50000, 1.0, 0.5, rng=7)
    # smooth detection roll-off below Mc=2.0
    pdet = 1 / (1 + np.exp(-(m - 1.8) / 0.08))
    m = m[rng.uniform(size=m.size) < pdet]
    assert 1.8 <= sl.mc_maxc(m, correction=0.2) <= 2.2
    mc_g, r = sl.mc_gft(m)
    assert 1.8 <= mc_g <= 2.3, (mc_g, r)
    mc_b = sl.mc_mbs(m)
    assert 1.8 <= mc_b <= 2.5, mc_b


def test_omori_recovers_parameters():
    K, c, p = 200.0, 0.05, 1.15
    fits = [sl.omori_fit(sl.synth_omori(K, c, p, 0.0, 1000.0, rng=100 + s), 0.0, 1000.0) for s in range(10)]
    for key, true in (("p", p), ("c", c), ("K", K)):
        est = np.array([f[key] for f in fits])
        se = np.array([f["s" + key] for f in fits])
        # unbiased: the mean of 10 fits is within 3 standard errors of the mean
        assert abs(est.mean() - true) < 3 * se.mean() / np.sqrt(len(fits)), (key, est.mean(), se.mean())
        # the Hessian standard error agrees with the scatter between realisations
        assert 0.5 < est.std(ddof=1) / se.mean() < 1.6, (key, est.std(ddof=1), se.mean())


def test_omori_fixed_c_and_late_window():
    K, c, p = 100.0, 0.00232, 1.1
    t = sl.synth_omori(K, c, p, 0.3, 2660.0, rng=9)
    f = sl.omori_fit(t, 0.3, 2660.0, fix_c=c)
    assert abs(f["p"] - p) < 3 * f["sp"], f
    a = sl.rj_a_from_K(f["K"], 1.0, 7.1, 3.0)
    assert abs(a - (np.log10(K) - 4.1)) < 0.1


def test_gk_declusters_synthetic_sequence():
    rng = np.random.default_rng(10)
    # 300 background events over 20 yr in a 5x5 deg box + one M7 with 500 aftershocks within 30 km, 200 d
    nb = 300
    tb = rng.uniform(0, 7300, nb)
    latb = rng.uniform(40, 45, nb); lonb = rng.uniform(70, 75, nb)
    mb = sl.synth_gr(nb, 1.0, 4.0, rng=11)
    mb = np.minimum(mb, 6.0)
    ta = 3000 + sl.synth_omori(50, 0.05, 1.1, 0, 200, rng=12)[:500]
    na = ta.size
    lata = 42.5 + rng.normal(0, 0.1, na); lona = 72.5 + rng.normal(0, 0.1, na)
    ma = np.minimum(sl.synth_gr(na, 1.0, 4.0, rng=13), 6.4)
    t = np.r_[tb, 3000.0, ta]; lat = np.r_[latb, 42.5, lata]; lon = np.r_[lonb, 72.5, lona]
    m = np.r_[mb, 7.0, ma]
    main = sl.decluster_gk(t, lat, lon, m)
    assert main[nb]  # the M7 itself
    assert main[nb + 1:].sum() < 0.02 * na  # nearly all aftershocks removed
    assert main[:nb].sum() > 0.9 * nb  # background mostly kept


def test_omori_mct_recovers_p_with_early_incompleteness():
    K, c, p = 100.0, 0.00232, 1.1  # K: rate of M>=3 events per day
    t = sl.synth_omori(K, c, p, 0.0, 2000.0, rng=21)
    m = sl.synth_gr(t.size, 1.0, 3.0, rng=22)
    keep = m >= sl.mc_helmstetter(t, 7.1, 3.0)
    f = sl.omori_fit_mct(t[keep], m[keep], 0.0, 2000.0, 7.1, 3.0, 1.0, fix_c=c)
    assert abs(f["p"] - p) < 3 * f["sp"], f
    assert abs(np.log10(f["K"]) - 2.0) < 0.05, f


def test_mc_lilliefors_res_equal_step_finds_true_mc():
    # magnitudes reported at 0.1 and tested on the 0.1 grid: (c - step/2)/res ends in .5, so a half-to-even round
    # put the bin edge one bin low for odd tenths and rejected the true Mc (audit fix)
    for seed in (0, 1, 2):
        m = sl.synth_gr(2000, 1.0, 2.1, 0.1, rng=seed)
        mc, table = sl.mc_lilliefors(m, res=0.1, step=0.1, rng=seed)
        assert mc == 2.1, table[:2]


def test_omori_mct_sk_includes_parameter_covariance():
    # K / sqrt(n) ignored the covariance of K with p and c (about half the true scatter); the new sK must match the
    # spread of K between realisations (audit fix)
    r = np.random.default_rng(3)
    Ks, sKs, old = [], [], []
    for _ in range(40):
        t = sl.synth_omori(60.0, 0.05, 1.05, 0.0, 365.0, rng=r.integers(1e9))
        m = sl.synth_gr(t.size, 1.0, 4.5, rng=r.integers(1e9))
        keep = m >= sl.mc_helmstetter(t, 8.0, 4.5) - 0.05 + 1e-9
        f = sl.omori_fit_mct(t[keep], m[keep], 0.0, 365.0, 8.0, 4.5, 1.0)
        Ks.append(f["K"]); sKs.append(f["sK"]); old.append(f["K"] / np.sqrt(f["n"]))
    ratio = np.std(Ks, ddof=1) / np.mean(sKs)
    assert 0.75 < ratio < 1.35, ratio
    assert np.mean(sKs) > 1.5 * np.mean(old)   # well above the old Poisson-only value


def test_omori_c_is_bounded_and_errors_finite_or_flagged():
    # true c far below the bound: the old unconstrained search returned c ~ 1e-15 with a singular Hessian
    for s in range(3):
        t = sl.synth_omori(20.0, 1e-7, 1.05, 0.0, 365.0, rng=s)
        m = sl.synth_gr(t.size, 1.0, 4.5, rng=s + 10)
        for f in (sl.omori_fit_mct(t, m, 0.0, 365.0, 7.0, 4.5, 1.0), sl.omori_fit(t, 0.0, 365.0)):
            assert f["c"] >= sl.C_MIN_DAYS * (1 - 1e-9), f["c"]
            assert f["c_at_bound"] and not np.isfinite(f["sc"])
            assert np.isfinite(f["sp"]) and f["sp"] > 0 and np.isfinite(f["sK"]) and f["sK"] > 0, f
