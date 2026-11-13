"""Tests for the regional layers: time-varying Mc estimator, FDSN text parsing, catalogue filters."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts" / "regional"))
import regionlib as rl  # noqa: E402
import seislib as sl  # noqa: E402
from fetch_regional import parse_fdsn_text  # noqa: E402


def synth_period(n, b, mc, rng, width=0.1):
    """GR magnitudes with a logistic detection roll-off centred 0.2 below mc (as in test_atlaslib)."""
    m = sl.synth_gr(int(n * 30), b, mc - 1.5, rng=rng)
    p = 1 / (1 + np.exp(-(m - (mc - 0.2)) / width))
    m = m[rng.uniform(size=m.size) < p]
    return m[rng.permutation(m.size)][:n]


def test_period_index_inclusive_years():
    per = rl.period_index([2009.99, 2010.0, 2013.999, 2014.0, 2025.5, 2026.0], [[2010, 2013], [2014, 2025]])
    assert per.tolist() == [-1, 0, 0, 1, 1, -1]


def test_cell_b_tv_recovers_b_when_mc_drops_over_time():
    rng = np.random.default_rng(11)
    m0 = synth_period(1500, 1.0, 2.5, rng)    # early period complete above 2.5
    m1 = synth_period(1500, 1.0, 1.5, rng)    # late period complete above 1.5
    m = np.r_[m0, m1]
    per = np.r_[np.zeros(m0.size, int), np.ones(m1.size, int)]
    r = rl.cell_b_tv(m, per, [np.nan, np.nan], nboot=200, rng=1)
    assert r["quality"] in ("A", "B")
    # MAXC+0.2 leaves a small low bias with this roll-off (as in the global synthetic tests): |bias| < 0.06
    assert abs(r["b"] - 1.0) < 0.06, r["b"]
    assert abs(r["mc_periods"][0] - 2.5) <= 0.2 and abs(r["mc_periods"][1] - 1.5) <= 0.2, r["mc_periods"]
    assert r["mc"] == r["mc_periods"][-1]
    # one threshold at the late (lower) Mc is biased low: the early period is truncated near 2.5
    b_single = sl.b_aki(m, r["mc_periods"][1])[0]
    assert b_single < r["b_lo"], b_single


def test_cell_b_tv_coverage():
    rng = np.random.default_rng(7)
    cover = []
    for k in range(60):
        b_true = (0.8, 1.0, 1.2)[k % 3]
        m0, m1 = synth_period(200, b_true, 2.0, rng), synth_period(200, b_true, 1.4, rng)
        m = np.r_[m0, m1]
        per = np.r_[np.zeros(m0.size, int), np.ones(m1.size, int)]
        r = rl.cell_b_tv(m, per, [np.nan, np.nan], nboot=200, rng=k)
        if np.isfinite(r["b_lo_raw"]):
            cover.append(r["b_lo_raw"] <= b_true <= r["b_hi_raw"])
    assert len(cover) >= 55
    assert np.mean(cover) >= 0.85, np.mean(cover)


def test_small_period_falls_back_to_floor_and_thresholds_map_back():
    rng = np.random.default_rng(3)
    m0 = synth_period(20, 1.0, 2.0, rng)      # too few events for its own Mc -> fallback
    m1 = synth_period(400, 1.0, 1.0, rng)
    m = np.r_[m0, m1]
    per = np.r_[np.zeros(m0.size, int), np.ones(m1.size, int)]
    r = rl.cell_b_tv(m, per, [2.3, np.nan], nboot=50, rng=0)
    assert r["mc_periods"][0] == max(2.3, r["mc_all"])
    thr = rl.thresholds_time_order(r)
    k = m0.size
    assert np.all(thr[:k] == r["mc_periods"][0]) and np.all(thr[k:] == r["mc_periods"][1])


def test_insufficient_when_few_events():
    r = rl.cell_b_tv(np.array([1.0, 1.5, 2.0]), np.zeros(3, int), [np.nan], rng=0)
    assert r["quality"] == "insufficient" and r["n_b"] == 0


def test_b_region_interval_covers_truth():
    m = sl.synth_gr(5000, 1.1, 1.0, rng=4)
    r = rl.b_region(m, np.full(m.size, 1.0), rng=5)
    assert r["lo"] <= 1.1 <= r["hi"]


def test_parse_fdsn_text_geonet_padding_and_ingv():
    geonet = ("#EventID | Time | Latitude | Longitude | Depth/km | Author | Catalog | Contributor | ContributorID | "
              "MagType | Magnitude | MagAuthor | EventLocationName | EventType\n"
              "2024p000135|2024-01-01T01:11:54|-38.580|178.574|21.5|GNS|GNS|GNS|2024p000135|MLv|2.2|GNS|"
              "30 km south-east of Tolaga Bay|earthquake\n")
    ingv = ("#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|"
            "MagAuthor|EventLocationName|EventType\n"
            "37304981|2024-01-08T23:43:36.910000|40.6292|15.5978|9.5|BULLETIN-INGV||||ML|1.9|--|"
            "3 km W Picerno (PZ)|earthquake\n")
    for txt, mt, mag, depth in ((geonet, "MLv", 2.2, 21.5), (ingv, "ML", 1.9, 9.5)):
        df = parse_fdsn_text(txt)
        assert len(df) == 1 and df.magtype[0] == mt and df.mag[0] == mag and df.depth[0] == depth
        assert isinstance(df.time.dtype, pd.DatetimeTZDtype)
    assert parse_fdsn_text("").empty
