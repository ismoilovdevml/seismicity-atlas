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


def test_iscgem_period_comes_from_release_json(tmp_path):
    import atlas
    import bump_release as br
    import common
    rel = json.loads((HERE.parents[0] / "scripts" / "release.json").read_text())
    assert common.ISCGEM_LAST_YEAR == rel["iscgem_last_year"] == 2021        # the current catalogue: unchanged
    assert common.ISCGEM_END == "2022-01-01"
    assert atlas.Y1 == common.ISCGEM_LAST_YEAR and atlas.PERIODS[-1] == (2004, common.ISCGEM_LAST_YEAR)
    assert atlas.Y1 - atlas.RATE_Y0 + 1 == 58                                # the old hard-coded 58.0 years
    f = tmp_path / "release.json"
    f.write_text(json.dumps({"version": "0.1.0", "data_cutoff_utc": "2026-11-13", "iscgem_last_year": 2021}))
    br.main(["--cutoff", "2026-12-01"], f)
    assert json.loads(f.read_text())["iscgem_last_year"] == 2021           # bump keeps the other keys


def test_fetch_drops_rows_below_the_query_minmag():
    import pandas as pd
    import fetch
    df = pd.DataFrame({"id": ["a", "nc21364840", "b"], "mag": [4.5, 3.38, 5.1]})
    assert fetch.drop_below_minmag(df, 4.5).id.tolist() == ["a", "b"]
    assert len(fetch.drop_below_minmag(df, None)) == 3                      # ISC-GEM: no magnitude limit


def test_declustered_b_withheld_unless_its_own_sample_passes_the_gate():
    # the declustered b was shown whenever the MAIN b was A/B, also from 7 events (Panama: 3.2 [0.78, 5.21])
    import pandas as pd
    import site_layers as sly
    base = {"h3": "826687fffffffff", "lat": 8.0, "lon": -82.0, "area_km2": 86000.0, "pb_class": "SUB",
            "n_iscgem": 300, "n_comcat": 500, "rate_m6": 1.0, "cons_n_matched": 50, "cons_dmag_mw": 0.0,
            "cons_dmag_mb": 0.1, "cons_dloc_km": 10.0, "cons_ddepth_km": 2.0, "cons_iscgem_only": 0,
            "cons_comcat_only_m6": 0}
    for d in ("sh", "dp"):
        base.update({f"{d}_{k}": v for k, v in dict(
            n_sample=200, n_b=120, mc=5.5, mc_lo=5.4, mc_hi=5.6, b=1.0, b_lo=0.85, b_hi=1.2, b_q="B", b_ci_w=0.35,
            b_ci_rel=0.35, b_unstable=False, bpos=1.05, bpos_lo=0.8, bpos_hi=1.3, b_decl=3.2, b_decl_lo=0.78,
            b_decl_hi=5.21, b_decl_q="insufficient", mc_cc_2010=4.7, mc_cc_pre1990=5.0).items()})
    good = dict(base, h3="82668ffffffffff", sh_b_decl=0.9, sh_b_decl_lo=0.8, sh_b_decl_hi=1.05, sh_b_decl_q="A")
    fc = sly.cells_layer(pd.DataFrame([base, good]), set())
    p0, p1 = (f["properties"] for f in fc["features"])
    assert "sh_bdecl" not in p0 and p0["sh_qdecl"] == "insufficient" and p0["sh_b"] == 1.0
    assert p1["sh_bdecl"] == 0.9 and p1["sh_qdecl"] == "A"


def test_manifest_checksums_match_the_published_files():
    # build_rating.py rewrote rating.json after site_layers.py had hashed it; run_all.sh now rehashes last
    import hashlib
    site = HERE.parents[0] / "site" / "data"
    man = json.loads((site / "manifest.json").read_text())
    on_disk = {f.name for f in list(site.glob("*.json")) + list(site.glob("*.geojson"))} - {"manifest.json"}
    assert set(man["files"]) == on_disk
    for name, rec in man["files"].items():
        b = (site / name).read_bytes()
        assert rec["bytes"] == len(b) and rec["sha256"] == hashlib.sha256(b).hexdigest(), name


def test_rehash_manifest_after_a_later_writer(tmp_path):
    import site_layers as sly
    (tmp_path / "rating.json").write_text('{"v": 1}')
    (tmp_path / "manifest.json").write_text(json.dumps({"version": "x", "files": sly.file_hashes(tmp_path)}))
    (tmp_path / "rating.json").write_text('{"v": 2}')                    # a writer after site_layers.py
    man = sly.rehash_manifest(tmp_path)
    assert man["version"] == "x" and man["files"] == sly.file_hashes(tmp_path)
    assert json.loads((tmp_path / "manifest.json").read_text())["files"]["rating.json"]["bytes"] == 8
    order = (HERE.parents[0] / "scripts" / "run_all.sh").read_text()
    assert order.index("scripts/build_rating.py") < order.index("scripts/site_layers.py --rehash")


def test_jdump_writes_null_for_nan_everywhere(tmp_path):
    import common
    obj = {"a": float("nan"), "b": np.float64("inf"), "c": np.array([1.0, np.nan]), "d": [np.float32(2.5), None],
           "e": {"f": np.int64(3), "g": np.bool_(True)}}
    f = tmp_path / "x.json"
    common.jdump(obj, f)
    txt = f.read_text()
    assert "NaN" not in txt and "Infinity" not in txt
    assert json.loads(txt) == {"a": None, "b": None, "c": [1.0, None], "d": [2.5, None], "e": {"f": 3, "g": True}}
