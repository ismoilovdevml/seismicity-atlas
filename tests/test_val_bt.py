"""Tests for the retrospective b(t) helpers."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import seislib as sl  # noqa: E402
from val_bt import b_window, mc_after  # noqa: E402


def test_mc_after_decays_to_floor():
    assert abs(mc_after(np.array([0.01]), 9.0, 5.4)[0] - 6.0) < 1e-9  # 9.0 - 4.5 + 1.5
    assert mc_after(np.array([1000.0]), 9.0, 5.4)[0] == 5.4


def test_b_window_reports_insufficient():
    r = b_window(np.array([5.5, 5.6]), np.array([5.4, 5.4]))
    assert r["b"] is None and r["n"] == 2


def test_b_window_recovers_b_with_time_dependent_threshold():
    rng = np.random.default_rng(3)
    t = np.sort(rng.uniform(0.001, 30, 4000))
    m = sl.synth_gr(t.size, 1.0, 5.0, rng=4)
    thr = mc_after(t, 9.0, 5.2)
    keep = m >= thr - 1e-9          # events below Mc(t) are lost, as in an early aftershock sequence
    r = b_window(m[keep], thr[keep], nboot=200, time_order=t[keep])
    assert r["q"] in ("A", "B") and r["b_lo"] <= 1.0 <= r["b_hi"], r
