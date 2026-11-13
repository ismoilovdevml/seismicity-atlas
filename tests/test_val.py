"""Tests for the validation helpers: fixed-threshold b, tapered G-R beta, sequence windows, literature file."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import seislib as sl  # noqa: E402
from val_chile import b_fixed, seq_mask  # noqa: E402
from val_literature import LIT, tgr_beta  # noqa: E402


def test_b_fixed_recovers_b():
    m = sl.synth_gr(3000, 0.9, 5.0, rng=1)
    r = b_fixed(m, 5.0, nboot=300)
    assert r["ci95"][0] <= 0.9 <= r["ci95"][1], r


def test_tgr_beta_recovers_beta_and_corner():
    # tapered G-R survival (Mt/M)^beta exp((Mt-M)/Mc) = Pareto survival x shifted-exponential survival
    rng = np.random.default_rng(2)
    beta, mt, mcorner = 0.65, 5.8, 7.5
    Mt, Mc = 10 ** (1.5 * mt + 9.1), 10 ** (1.5 * mcorner + 9.1)
    n = 20000
    M = np.minimum(Mt * rng.uniform(size=n) ** (-1 / beta), Mt + rng.exponential(Mc, n))
    m = (np.log10(M) - 9.1) / 1.5
    b_hat, mc_hat = tgr_beta(m, mt)
    assert abs(b_hat - beta) < 0.03, b_hat
    assert abs(mc_hat - mcorner) < 0.3, mc_hat


def test_seq_mask_window():
    t0 = pd.Timestamp("2010-01-01", tz="UTC")
    main = pd.DataFrame({"time": [t0], "lat": [0.0], "lon": [0.0], "mag": [8.0]})
    ev = pd.DataFrame({"time": [t0 - pd.Timedelta(days=40), t0 + pd.Timedelta(days=10), t0 + pd.Timedelta(days=10)],
                       "lat": [0.0, 0.5, 10.0], "lon": [0.0, 0.0, 0.0]})
    assert seq_mask(ev, main).tolist() == [False, True, False]


def test_literature_file_is_complete():
    lit = json.loads(LIT.read_text())
    assert 10 <= len(lit) <= 20
    for e in lit:
        assert e["needs_human_check"] is True
        assert e["quote"] and e["location_in_source"] and e["citation"]
        assert e["quantity"] in ("b", "beta", "Mc")
        assert e["compare"]["kind"] in ("box", "class", "global", "class_range", "mc_global")
