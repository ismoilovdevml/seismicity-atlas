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


# ---- quality mask on the relative interval width (v0.5) ------------------------------------------------------------
# Synthetic cells with a known threshold: exactly n events above a floor of 5.5 (continuous magnitudes above 5.45,
# so binned 5.5 and up) plus 150 events of the same G-R between 4.75 and 5.45, so the cell MAXC + 0.2 (about 5.0)
# stays below the floor and every replicate uses the same threshold. At fixed n the relative width (hi - lo) / b is
# about 3.92 / sqrt(n) whatever b is, while the absolute width scales with b.
LOG10E = np.log10(np.e)
B_TRUE = (0.8, 1.0, 1.25, 1.5)
N_ABOVE, TRIALS = 70, 200


def _cell(n_above, b, rng, floor=5.5, low=4.75, n_below=150):
    beta = b / LOG10E
    above = floor - 0.05 + rng.exponential(1 / beta, n_above)
    w = floor - 0.05 - low
    below = low - np.log(1 - rng.uniform(size=n_below) * (1 - np.exp(-beta * w))) / beta
    return np.r_[below, above]


_MASK_RUNS = {}


def _mask_runs():
    """TRIALS cells per true b at N_ABOVE events above the floor, nboot = atlaslib.NBOOT, fixed seeds."""
    if not _MASK_RUNS:
        for bt in B_TRUE:
            rng = np.random.default_rng(int(1000 * bt))
            rows = []
            for t in range(TRIALS):
                m = _cell(N_ABOVE, bt, rng)
                r = al.cell_b(m, np.full(m.size, 5.5), rng=t)
                rows.append((r["n_b"], r["b_raw"], r["b_lo_raw"], r["b_hi_raw"], r["quality"]))
            _MASK_RUNS[bt] = rows
    return _MASK_RUNS


def test_quality_uses_relative_width():
    assert al.quality(100, 0.90, 1.20, 1.0) == "A"      # 0.30 / 1.0
    assert al.quality(100, 1.30, 1.75, 1.5) == "A"      # 0.45 absolute, 0.30 relative
    assert al.quality(100, 0.60, 1.00, 0.8) == "B"      # 0.40 / 0.8 = 0.50
    assert al.quality(100, 0.60, 1.01, 0.8) == "C"
    assert al.quality(49, 0.95, 1.05, 1.0) == "insufficient"
    assert al.quality(100, np.nan, 1.05, 1.0) == "insufficient"
    assert al.quality(100, 0.9, 1.1, np.nan) == "insufficient"


def test_cell_b_default_nboot_is_1000():
    assert al.NBOOT == 1000
    import inspect
    assert inspect.signature(al.cell_b).parameters["nboot"].default == al.NBOOT


def test_shown_share_does_not_depend_on_b_at_fixed_n():
    runs = _mask_runs()
    assert all(r[0] == N_ABOVE for rows in runs.values() for r in rows)   # the threshold is the known floor
    rel = {bt: np.mean([q in ("A", "B") for *_, q in rows]) for bt, rows in runs.items()}
    # the old absolute rule on the same intervals, for contrast: its share falls steeply with b
    absw = {bt: np.mean([hi - lo <= 0.50 for _, _, lo, hi, _ in rows]) for bt, rows in runs.items()}
    spread = max(rel.values()) - min(rel.values())
    # binomial SD of one share is about 0.03 at TRIALS = 200; 0.15 is about 3.5 SD of a difference of two shares
    assert spread <= 0.15, rel
    assert 0.4 <= np.mean(list(rel.values())) <= 0.95, rel           # the test sits where the mask bites
    assert absw[0.8] - absw[1.5] >= 0.5, absw                         # the absolute rule fails the same test


def test_mean_of_shown_b_is_unbiased():
    for bt, rows in _mask_runs().items():
        shown = [b for _, b, _, _, q in rows if q in ("A", "B")]
        assert len(shown) >= 0.4 * TRIALS, (bt, len(shown))
        # Aki-Utsu has a small-sample bias of about b / (n - 1) (+0.015 at b = 1, n = 70); allow 3 % of b
        assert abs(np.mean(shown) - bt) <= 0.03 * bt, (bt, np.mean(shown))


def test_ci_bounds_stable_at_1000_replicates():
    """Same sample, 40 bootstrap seeds: the SD of the interval bounds at 1000 replicates is about 1/sqrt(5) of that at
    200, and small against the A/B/C limits (n = 150 events above 5.25, b = 1)."""
    rng = np.random.default_rng(11)
    m = 5.25 + rng.exponential(LOG10E / 1.0, 150)
    f = np.full(m.size, 5.3)
    sd = {}
    for nb in (200, 1000):
        lo, hi = np.array([[al.cell_b(m, f, nboot=nb, rng=s)[k] for k in ("b_lo_raw", "b_hi_raw")] for s in range(40)]).T
        sd[nb] = (lo.std(ddof=1), hi.std(ddof=1))
    assert max(sd[1000]) <= 0.015, sd
    assert sd[1000][0] <= 0.65 * sd[200][0] and sd[1000][1] <= 0.65 * sd[200][1], sd
