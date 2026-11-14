"""Tests for the b-positive diagnosis helpers (scripts/val_bpos.py) and the Lilliefors completeness test."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import seislib as sl  # noqa: E402
from val_bpos import bpos_pairs, bpos_shuffled, stai_missed, synth_sequences, time_after_larger  # noqa: E402

LOG10E = np.log10(np.e)


def test_lilliefors_size_on_exponential():
    # pure G-R above the 5.0 bin (lower edge 4.95), magnitudes at 0.01: rejections at alpha 0.1 stay near 10 %
    rng = np.random.default_rng(1)
    rej = 0
    for _ in range(40):
        m = 4.5 + rng.exponential(LOG10E, 2500)
        k, tab = sl.lilliefors_offset(m, 5.0, [0.0], ndither=5, nsim=200, rng=rng)
        rej += tab[0][2] < 0.1
    assert rej / 40 <= 0.25, rej


def test_lilliefors_rejects_incomplete_and_mc_recovered():
    rng = np.random.default_rng(2)
    m = 4.5 + rng.exponential(LOG10E, 20000)
    keep = rng.uniform(size=m.size) < 1 / (1 + np.exp(-(m - 5.0) / 0.08))   # detection 50 % at 5.0
    mc, tab = sl.mc_lilliefors(np.round(m[keep], 2), ndither=5, nsim=200, rng=3, mc_range=(4.8, 6.0))
    assert tab[0][2] < 0.1                       # 4.8 is incomplete
    assert 5.1 <= mc <= 5.5, (mc, tab)


def test_lilliefors_offset_per_event_thresholds():
    # two periods with floors 5.8 and 5.3; excesses over the own floor are exponential with one rate, so the
    # test passes at offset 0 in about 90 % of catalogues (alpha 0.1)
    rng = np.random.default_rng(4)
    f = np.r_[np.full(500, 5.8), np.full(1000, 5.3)]
    passed = 0
    for _ in range(20):
        m = np.round(f - 0.3 + rng.exponential(LOG10E, f.size), 2)   # continuous below the edge, as real data
        passed += sl.lilliefors_offset(m, f, [0.0], ndither=5, nsim=200, rng=rng)[0] == 0.0
    assert passed >= 14, passed


def test_time_after_larger():
    t = np.array([0.0, 0.5, 2.0, 3.0, 4.0])
    lat = np.array([0.0, 0.1, 0.1, 20.0, 0.1])
    lon = np.zeros(5)
    m = np.array([7.0, 6.0, 6.8, 5.5, 7.5])
    dt = time_after_larger(t, lat, lon, m, mmin=6.5, dmag=0.5, radius_km=300)
    # event 1: 0.5 d after event 0; event 2 (6.8) is not 0.5 smaller than 7.0; event 3 is 2200 km away
    assert dt[1] == 0.5 and np.isinf(dt[2]) and np.isinf(dt[3]) and np.isinf(dt[0]) and np.isinf(dt[4])


def test_bpos_shuffled_matches_bpos_for_iid():
    rng = np.random.default_rng(5)
    m = np.round(5.25 + rng.exponential(LOG10E, 6000), 2)
    f = np.full(m.size, 5.3)
    b_real = sl.b_positive(sl.bin_mag(m))[0]
    b_shuf = bpos_shuffled(m, f, np.zeros(m.size), nperm=10, rng=6)
    assert abs(b_real - b_shuf) < 0.04, (b_real, b_shuf)
    assert abs(b_shuf - 1.0) < 0.06


def test_bpos_pairs_split():
    m = np.array([5.3, 5.8, 5.3, 6.0, 5.4, 5.9])
    t = np.array([0.0, 0.5, 10.0, 10.2, 30.0, 40.0])
    (b_le, n_le), (b_gt, n_gt) = bpos_pairs(m, t, np.full(m.size, 5.3))
    # positive differences >= 0.2: 0.5 (0.5 d), 0.7 (0.2 d) within a day; 0.5 (10 d) later; fewer than 10 -> NaN
    assert (n_le, n_gt) == (2, 1) and np.isnan(b_le) and np.isnan(b_gt)


def test_stai_lowers_b_not_bpos():
    rng = np.random.default_rng(7)
    b_all, bp_all = [], []
    for _ in range(4):
        df = synth_sequences(4000, rng=rng)
        df = df[df.m >= 5.25 - 1e-9].reset_index(drop=True)
        x = df[~stai_missed(df)]
        f = np.full(len(x), 5.3)
        b_all.append(sl.b_varmc(x.m.to_numpy(), f)[0])
        mb = sl.bin_mag(x.m.to_numpy())
        bp_all.append(sl.b_positive(mb[mb >= 5.3 - 1e-9])[0])
    assert np.mean(bp_all) - np.mean(b_all) > 0.015, (b_all, bp_all)
