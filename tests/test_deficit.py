"""Synthetic checks of the seismic-deficit moment-rate maths (scripts/deficit/momentlib.py)."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "deficit"))
import momentlib as ml  # noqa: E402


def test_mw_m0_roundtrip_and_constant():
    assert ml.mw_to_m0(6.0) == pytest.approx(10 ** 18.1)
    assert ml.m0_to_mw(ml.mw_to_m0(7.33)) == pytest.approx(7.33)


@pytest.mark.parametrize("e1,e2,want", [(1e-8, -1e-8, 1e-8),     # pure shear
                                        (0.0, -2e-8, 2e-8),      # uniaxial shortening
                                        (-1e-8, -1e-8, 2e-8),    # biaxial shortening: vertical strain dominates
                                        (3e-8, -1e-8, 3e-8)])
def test_savage_simpson_principal_and_rotation_invariant(e1, e2, want):
    for th in np.radians([0, 17, 45, 120]):
        c, s = np.cos(th), np.sin(th)
        exx = e1 * c * c + e2 * s * s
        eyy = e1 * s * s + e2 * c * c
        exy = (e1 - e2) * s * c
        assert ml.savage_simpson_rate(exx, eyy, exy) == pytest.approx(want, rel=1e-9)
        p1, p2 = ml.principal_horizontal(exx, eyy, exy)
        assert (p1, p2) == pytest.approx((max(e1, e2), min(e1, e2)), abs=1e-20)


def test_grid_area_and_geodetic_rate_match_analytic_box():
    # 10 x 5 degree box at 40-45 N, 0.05 degree nodes, uniform pure shear 20 nanostrain/yr
    d = 0.05
    lat = np.arange(40 + d / 2, 45, d)
    lon = np.arange(70 + d / 2, 80, d)
    LA, _ = np.meshgrid(lat, lon, indexing="ij")
    area = ml.node_area_m2(LA, d, d)
    a_true = ml.R_EARTH ** 2 * np.radians(10) * (np.sin(np.radians(45)) - np.sin(np.radians(40)))
    assert area.sum() == pytest.approx(a_true, rel=1e-9)
    e = np.full(LA.shape, 20e-9)
    mu, h = 3.0e10, 20e3
    assert ml.geodetic_moment_rate(e, area, mu, h) == pytest.approx(2 * mu * h * a_true * 20e-9, rel=1e-9)


def test_tgr_mean_moment_matches_samples_and_kagan_limit():
    rng = np.random.default_rng(3)
    beta, mt, mc = 0.65, 6.0, 7.5
    m = ml.tgr_sample_mw(2_000_000, mt, beta, mc, rng)
    assert m.min() >= mt - 1e-9
    emp = ml.mw_to_m0(m).mean()
    assert ml.tgr_mean_moment(ml.mw_to_m0(mt), beta, ml.mw_to_m0(mc)) == pytest.approx(emp, rel=0.03)
    # Kagan (2002) approximation for Mt << Mc: E[M] ~ Mt^beta Mc^(1-beta) Gamma(2-beta)/(1-beta)
    from scipy.special import gamma
    mt0, mc0 = ml.mw_to_m0(4.0), ml.mw_to_m0(8.5)
    approx = mt0 ** beta * mc0 ** (1 - beta) * gamma(2 - beta) / (1 - beta)
    assert ml.tgr_mean_moment(mt0, beta, mc0) == pytest.approx(approx, rel=1e-2)  # differs by O((Mt/Mc)^(1-beta))


def test_tgr_survivor_matches_samples():
    rng = np.random.default_rng(4)
    beta, mt, mc = 0.6, 5.5, 7.0
    m0 = ml.mw_to_m0(ml.tgr_sample_mw(400_000, mt, beta, mc, rng))
    for mw in (6.0, 6.5, 7.0, 7.5):
        M = ml.mw_to_m0(mw)
        Mt, Mc = ml.mw_to_m0(mt), ml.mw_to_m0(mc)
        want = (Mt / M) ** beta * np.exp((Mt - M) / Mc)
        assert (m0 >= M).mean() == pytest.approx(want, rel=0.05, abs=2e-4)


def test_balance_corner_recovers_corner():
    rate, mt, beta = 0.4, 6.0, 0.65
    for mc in (7.2, 8.0, 8.8):
        mdot = ml.tgr_moment_rate(rate, mt, beta, mc)
        assert ml.balance_corner_mw(mdot, rate, mt, beta) == pytest.approx(mc, abs=1e-3)
    assert ml.balance_corner_mw(1e10, rate, mt, beta) == -np.inf      # below the minimum possible rate
    assert ml.balance_corner_mw(1e30, rate, mt, beta) == np.inf       # above the rate of a corner at 10.5


def test_tgr_mean_moment_for_beta_at_and_above_one():
    # b >= 1.5 (beta >= 1): the taper keeps the mean finite; it used to be NaN (gammaincc needs a positive order)
    from scipy.integrate import quad
    mt, mc = ml.mw_to_m0(6.0), ml.mw_to_m0(8.0)
    for beta in (0.7, 1.0, 1.2, 1.6, 2.3):
        # E[M] = Mt + int_Mt^inf F(M) dM, in u = ln(M / Mt)
        surv = quad(lambda u: mt * np.exp(u) * np.exp(-beta * u) * np.exp((mt - mt * np.exp(u)) / mc), 0, 60,
                    limit=400)[0]
        got = ml.tgr_mean_moment(mt, beta, mc)
        assert np.isfinite(got) and got == pytest.approx(mt + surv, rel=1e-6), beta
    rng = np.random.default_rng(7)
    m = ml.mw_to_m0(ml.tgr_sample_mw(1_000_000, 6.0, 1.2, 8.0, rng))
    assert ml.tgr_mean_moment(mt, 1.2, mc) == pytest.approx(m.mean(), rel=0.03)
    for s in (0.5, 0.0, -0.4, -1.0, -1.7):          # recurrence against direct integration of t^(s-1) e^-t
        want = quad(lambda t: t ** (s - 1) * np.exp(-t), 0.3, np.inf)[0]
        assert ml.upper_gamma(s, 0.3) == pytest.approx(want, rel=1e-8), s


def test_bandwise_rate_recovers_truth_with_incomplete_early_years():
    rng = np.random.default_rng(5)
    beta, mt, mc, rate, years = 0.65, 5.8, 7.0, 50.0, 200
    n = rng.poisson(rate * years)
    mw = ml.tgr_sample_mw(n, mt, beta, mc, rng)
    yr = rng.uniform(1800, 2000, n)
    bands = [(5.8, 6.5, 1950), (6.5, 7.0, 1900), (7.0, 99.0, 1800)]
    # delete what an incomplete early catalogue would miss
    keep = ~(((mw < 6.5) & (yr < 1950)) | ((mw < 7.0) & (yr < 1900)))
    est, rows = ml.bandwise_moment_rate(mw[keep], yr[keep], bands, 2000.0)
    true = ml.tgr_moment_rate(rate, mt, beta, mc)
    assert est == pytest.approx(true, rel=0.15)
    assert [r["years"] for r in rows] == [50.0, 100.0, 200.0]
    # the naive sum over the full window is biased low
    naive = ml.mw_to_m0(mw[keep]).sum() / years
    assert naive < est


def test_simulated_sums_mean_equals_tgr_rate():
    rng = np.random.default_rng(6)
    rate, years, mt, beta, mc = 0.3, 100.0, 6.0, 0.65, 7.5
    s = ml.simulate_catalogue_sums(20000, rate, years, mt, beta, mc, rng)
    assert s.mean() / years == pytest.approx(ml.tgr_moment_rate(rate, mt, beta, mc), rel=0.05)
    # heavy tail: the median catalogue sum is below the mean
    assert np.median(s) < s.mean()


def test_bandwise_draws_zero_sigma_equals_point_estimate():
    rng = np.random.default_rng(7)
    mw = np.array([6.1, 6.9, 7.8, 5.9])
    yr = np.array([1970.0, 1950.0, 1910.0, 1990.0])
    bands = [(5.8, 6.0, 1976.0), (6.0, 6.5, 1964.0), (6.5, 6.8, 1955.0), (6.8, 7.0, 1940.0), (7.0, 7.7, 1918.0),
             (7.7, 99.0, 1904.0)]
    point, _ = ml.bandwise_moment_rate(mw, yr, bands, 2020.0)
    d = ml.bandwise_rate_draws(mw, np.zeros(4), yr, bands, 2020.0, 5, rng)
    assert d == pytest.approx(np.full(5, point))
    # the 1990 Mw 5.9 event counts, the 1950 Mw 6.9 event counts in the 6.8-7.0 band (complete from 1940)
    assert point == pytest.approx(ml.mw_to_m0(5.9) / 44 + ml.mw_to_m0(6.1) / 56 + ml.mw_to_m0(6.9) / 80
                                  + ml.mw_to_m0(7.8) / 116)


def test_kostrov_shortening_reproduces_molnar_ghose_2000():
    # Molnar & Ghose (2000, GRL 27, 2377): M_NN = -16.3e20 N m, mu = 3.3e10 Pa, depth 20 km, length 1800 km,
    # width 300 km, 100 years -> strain rate -23.1e-9 /yr and 7 mm/yr shortening
    u = ml.kostrov_shortening(16.3e20, 3.3e10, 20e3, 1800e3, 100.0)
    assert u / 300e3 == pytest.approx(23.1e-9, rel=0.02)
    assert u * 1e3 == pytest.approx(7.0, abs=0.2)   # 6.86; the paper rounds to 7


def test_deficit_b_sample_keeps_the_whole_lowest_bin(tmp_path, monkeypatch):
    # bin 5.8 holds Mw 5.75-5.84; cutting the raw magnitudes at 5.80 first dropped 5.75-5.79 and biased b low
    # (Tien Shan, 0.5.0: 0.954, n = 38; with the whole bin about 1.00, n = 40). Moment bands and counts keep Mw >= 5.8.
    import pandas as pd
    from shapely.geometry import box
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import build_deficit as bd
    import seislib as sl
    rows = [("1990-01-01T00:00:00Z", 42.0, 75.0, 10.0, m, 0.1, f"e{i}") for i, m in enumerate((5.76, 5.79, 5.80, 6.1))]
    pd.DataFrame(rows, columns=["time", "latitude", "longitude", "depth", "mag", "magError", "id"]).to_csv(
        tmp_path / "iscgem.csv", index=False)
    pd.DataFrame([("2023-01-01T00:00:00Z", 10.0, 10.0, 10.0, 6.0, "mww", "c1")],      # outside the box
                 columns=["time", "latitude", "longitude", "depth", "mag", "magType", "id"]).to_csv(
        tmp_path / "comcat_m45.csv", index=False)
    monkeypatch.setattr(bd, "PROC", tmp_path)
    ev, _ = bd.load_catalogue()
    assert sorted(ev.mag) == [5.76, 5.79, 5.80, 6.1]
    assert sl.b_aki(ev.mag.to_numpy(), bd.B_MIN, bd.DM)[2] == 4            # all four are in bins >= 5.8
    LO, LA = np.meshgrid(np.arange(70, 80, 0.5), np.arange(40, 44, 0.5))
    zi = bd.zone_inputs(box(70, 40, 80, 44), {}, LO, LA, np.ones(LO.shape), ev)
    assert sorted(zi["events"].mag) == [5.80, 6.1]                          # counts and moment: Mw >= 5.8 only
    # synthetic check of the bias itself: 2-decimal GR magnitudes, b = 1
    r = np.random.default_rng(2)
    m = np.round(5.745 + r.exponential(np.log10(np.e), 200_000), 2)
    b_old = sl.b_aki(m[m >= 5.8 - 1e-9], 5.8)[0]
    b_new = sl.b_aki(m[m >= 5.75 - 1e-9], 5.8)[0]
    assert b_old < 0.96 and abs(b_new - 1.0) < 0.02, (b_old, b_new)
