"""Tests for the direct-Mw b sample (common.b_sample_mask) and the config switch ATLAS_B_MAGERR_MAX."""
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402
from common import b_sample_label, b_sample_mask  # noqa: E402


def test_mask_keeps_only_uncertainty_010():
    e = np.array([0.1, 0.10, 0.11, 0.2, 0.34, np.nan, 0.1])
    assert b_sample_mask(e, 0.10).tolist() == [True, True, False, False, False, False, True]


def test_mask_float_noise_at_the_limit():
    assert b_sample_mask(np.array([0.1 + 1e-9, 0.30000000000000004]), 0.10).tolist() == [True, False]
    assert b_sample_mask(np.array([0.30000000000000004]), 0.30).tolist() == [True]


def test_mask_off_keeps_everything_including_nan():
    e = np.array([0.1, 0.7, np.nan])
    assert b_sample_mask(e, None).all()
    assert b_sample_label(None) == "all events"
    assert "0.10" in b_sample_label(0.10)


def test_mask_refuses_catalogue_without_uncertainties():
    with pytest.raises(ValueError):
        b_sample_mask(np.full(10, np.nan), 0.10)


@pytest.mark.parametrize("value,expected", [(None, "0.1"), ("all", "None"), ("0.2", "0.2")])
def test_env_switch(value, expected):
    env = {k: v for k, v in os.environ.items() if k != "ATLAS_B_MAGERR_MAX"}
    if value is not None:
        env["ATLAS_B_MAGERR_MAX"] = value
    code = f"import sys; sys.path.insert(0, {str(SCRIPTS)!r}); import common; print(common.B_MAGERR_MAX)"
    out = subprocess.run([sys.executable, "-I", "-c", code], env=env, capture_output=True, text=True, check=True)
    assert out.stdout.strip() == expected


def test_filter_removes_proxy_like_bias():
    """GR b = 1.0 'direct' events plus 'proxy' events piled up just above the threshold (the pattern seen in
    ISC-GEM 1976-2021: proxy Mw concentrated at Mw 5.6-6.0). All events give b > 1.05; the filtered sample
    recovers the true value."""
    rng = np.random.default_rng(3)
    direct = sl.synth_gr(6000, 1.0, 5.6, rng=rng)
    proxy = sl.synth_gr(1500, 1.8, 5.6, rng=rng)        # steep: what the proxy class alone gives (b ~1.7)
    m = np.r_[direct, proxy]
    err = np.r_[np.full(direct.size, 0.10), rng.choice([0.2, 0.3, 0.4], proxy.size)]
    b_all = sl.b_aki(m, 5.6)[0]
    keep = b_sample_mask(err, 0.10)
    assert keep.sum() == direct.size
    b, sig, n, _ = sl.b_aki(m[keep], 5.6)
    assert b_all > 1.05
    assert abs(b - 1.0) < 2 * sig + 0.01
    # the atlas estimator on the filtered sample: interval covers the true value
    r = al.cell_b(m[keep], np.full(n, 5.6), nboot=200, rng=1)
    assert r["b_lo_raw"] <= 1.0 <= r["b_hi_raw"]
