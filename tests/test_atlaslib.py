"""Synthetic recovery tests for the per-cell estimators used by the atlas."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402


def synth_cell(n, b, mc, rng, width=0.1):
    """GR magnitudes above mc - 1.5 with a logistic detection roll-off centred 0.2 below mc."""
    m = sl.synth_gr(int(n * 30), b, mc - 1.5, rng=rng)
    p = 1 / (1 + np.exp(-(m - (mc - 0.2)) / width))
    m = m[rng.uniform(size=m.size) < p]
    return m[rng.permutation(m.size)][: int(n * 3)]


def test_b_varmc_matches_aki_for_constant_threshold():
    m = sl.synth_gr(5000, 1.0, 5.0, rng=1)
    b1 = sl.b_aki(m, 5.0)[0]
    b2 = sl.b_varmc(m, np.full(m.size, 5.0))[0]
    assert abs(b1 - b2) < 1e-12


def test_b_varmc_recovers_b_with_time_varying_threshold():
    rng = np.random.default_rng(2)
    m1 = sl.synth_gr(3000, 1.0, 6.0, rng=3)   # early period complete above 6.0
    m2 = sl.synth_gr(3000, 1.0, 5.2, rng=4)   # late period complete above 5.2
    m = np.r_[m1, m2]
    thr = np.r_[np.full(m1.size, 6.0), np.full(m2.size, 5.2)]
    b, sig, n = sl.b_varmc(m, thr)
    assert abs(b - 1.0) < 3 * sig
    # a single threshold at the late Mc is biased because the early period is truncated at 6.0
    assert sl.b_aki(m, 5.2)[0] < b - 3 * sig


def test_cell_b_ci_coverage_and_bias():
    rng = np.random.default_rng(5)
    cover, err = [], []
    for k in range(120):
        b_true = (0.8, 1.0, 1.3)[k % 3]
        mc_true = 5.0 + 0.1 * (k % 8)
        m = synth_cell(150, b_true, mc_true, rng)
        r = al.cell_b(m, np.full(m.size, 4.0), nboot=200, rng=k)
        if not np.isfinite(r["b_lo_raw"]):
            continue
        cover.append(r["b_lo_raw"] <= b_true <= r["b_hi_raw"])
        err.append(r["b_raw"] - b_true)
    assert len(cover) > 100
    assert np.mean(cover) >= 0.88, np.mean(cover)
    assert abs(np.median(err)) < 0.05, np.median(err)
