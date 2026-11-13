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
