"""Tests for the data-pipeline helpers: official ISC-GEM reader, yearly series, release bump, drift guard."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[0] / "scripts"))
import iscgem_official as io_  # noqa: E402

SAMPLE = HERE / "data" / "iscgem_official_sample.csv"


def test_official_iscgem_parser_maps_columns():
    df, info = io_.load(SAMPLE)
    assert info["source"] == "official" and info["n"] == 3 and len(info["sha256"]) == 64
    assert list(df["id"]) == ["iscgem900000001", "iscgem900000003", "iscgem900000002"]  # time-sorted
    r = df.iloc[2]
    assert r["time"] == "2004-12-26T00:58:53.450Z"
    assert (r["latitude"], r["longitude"], r["depth"], r["mag"]) == (3.3, 95.98, 30.0, 9.1)
    assert (r["magType"], r["net"], r["magSource"]) == ("mw", "iscgem", "iscgem")
    assert (r["horizontalError"], r["depthError"], r["magError"]) == (5.0, 2.0, 0.1)
    blank = df.iloc[1]  # empty uncertainties become NaN, not 0
    assert np.isnan(blank["depthError"]) and np.isnan(blank["magError"])


def test_official_iscgem_output_feeds_prepare_standardise():
    import prepare
    df, _ = io_.load(SAMPLE)
    s = prepare.standardise(df, "iscgem")
    assert len(s) == 3 and s["deep"].tolist() == [False, True, False]
    assert s["time"].dt.year.tolist() == [1910, 1990, 2004]


def test_official_iscgem_parser_rejects_missing_column():
    bad = SAMPLE.read_text().replace(", eventid", ", evid")
    with pytest.raises(io_.FormatError, match="eventid"):
        io_.parse(bad)


def test_official_iscgem_parser_rejects_bad_date():
    bad = SAMPLE.read_text().replace("1990-01-02 03:04:05.60", "1990-13-45 03:04:05.60")
    with pytest.raises(io_.FormatError, match="date"):
        io_.parse(bad)


def test_yearly_counts_null_outside_cover():
    from atlas import yearly_counts
    n = yearly_counts([1974, 1976, 1976, 2021, 2030], 1973, 2026, (1976, 2021))
    assert len(n) == 2026 - 1973 + 1
    assert n[:3] == [None, None, None] and n[3] == 2 and n[4] == 0
    assert n[2021 - 1973] == 1 and all(v is None for v in n[2022 - 1973:])
    assert yearly_counts([1973, 2026], 1973, 2026)[0] == 1  # no cover: plain counts, zeros kept


def _site(d, cutoff="2026-11-13", b_sh=1.035, b_dp=0.936, n_b_sh=200, n_cells=100, m5=1000):
    d.mkdir(parents=True, exist_ok=True)
    man = {"data_cutoff_utc": cutoff, "version": "0.1.0",
           "global": {"b_shallow_1976_2021": {"b": b_sh}, "b_deep_1976_2021": {"b": b_dp}},
           "events": {"events_m5.json": {"n": m5}, "events_m6.json": {"n": 100}}}
    feats = [{"properties": {"sh_q": "A" if i < n_b_sh else "C", "dp_q": "B" if i < 70 else "insufficient"}}
             for i in range(max(n_cells, n_b_sh))]
    (d / "manifest.json").write_text(json.dumps(man))
    (d / "cells.geojson").write_text(json.dumps({"features": feats}))
    return d


def test_drift_guard_passes_small_change_and_fails_large(tmp_path):
    import check_drift as cd
    base = _site(tmp_path / "old", n_cells=300)
    ok = _site(tmp_path / "ok", cutoff="2026-12-01", n_b_sh=210, n_cells=300, m5=1010)
    assert cd.main(["--baseline", str(base), "--new", str(ok)]) == 0
    for kw, word in (({"b_dp": 1.06}, "b_dp"), ({"n_b_sh": 140}, "cells_b_sh"), ({"m5": 900}, "events_m5"),
                     ({"cutoff": "2026-10-01"}, "cut-off")):
        new = _site(tmp_path / word, n_cells=300, **kw)
        bad = cd.check(cd.summary(base), cd.summary(new))
        assert any(word in b for b in bad), (kw, bad)


def test_bump_release(tmp_path):
    import bump_release as br
    f = tmp_path / "release.json"
    f.write_text(json.dumps({"version": "0.1.0", "data_cutoff_utc": "2026-11-13"}))
    assert br.main(["--cutoff", "2026-11-13"], f) == "0.1.0"          # same cut-off: unchanged
    assert br.main(["--cutoff", "2026-12-01"], f) == "0.1.1"
    assert json.loads(f.read_text()) == {"version": "0.1.1", "data_cutoff_utc": "2026-12-01"}
    assert br.main(["--cutoff", "2027-01-01", "--part", "minor"], f) == "0.2.0"
    assert br.main(["--part", "minor"], f) == "0.3.0"                 # method change: cut-off kept
    assert json.loads(f.read_text()) == {"version": "0.3.0", "data_cutoff_utc": "2027-01-01"}
    with pytest.raises(SystemExit):
        br.main([], f)                                                 # no cut-off and patch: refused


def test_jdump_writes_null_for_nan_everywhere(tmp_path):
    import common
    obj = {"a": float("nan"), "b": np.float64("inf"), "c": np.array([1.0, np.nan]), "d": [np.float32(2.5), None],
           "e": {"f": np.int64(3), "g": np.bool_(True)}}
    f = tmp_path / "x.json"
    common.jdump(obj, f)
    txt = f.read_text()
    assert "NaN" not in txt and "Infinity" not in txt
    assert json.loads(txt) == {"a": None, "b": None, "c": [1.0, None], "d": [2.5, None], "e": {"f": 3, "g": True}}
