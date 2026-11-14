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
    assert np.isnan(ml.balance_corner_mw(1e10, rate, mt, beta))       # below the minimum possible rate


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
