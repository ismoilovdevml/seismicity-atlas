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


def test_parse_magnitudes_and_pick_local_prefers_bulletin():
    from fetch_regional import parse_magnitudes, pick_local
    xml = ("<event><stationMagnitude publicID=\"s1\"><mag><value>9.9</value></mag><type>ML</type></stationMagnitude>"
           "<magnitude publicID=\"m1\"><mag><value>6.5</value></mag><type>Mw</type>"
           "<creationInfo><author>tdmt_reviewer</author></creationInfo></magnitude>"
           "<magnitude publicID=\"m2\"><mag><value>6.2</value></mag><type>ML</type>"
           "<creationInfo><author>hew1_mole</author></creationInfo></magnitude>"
           "<magnitude publicID=\"m3\"><mag><value>6.1</value></mag><type>ML</type>"
           "<creationInfo><author>BULLETIN-INGV</author></creationInfo></magnitude>"
           "<magnitude publicID=\"m4\"><mag><value>6.0</value></mag><type>ML</type>"
           "<creationInfo><author>SURVEY-INGV</author></creationInfo></magnitude></event>")
    mags = parse_magnitudes(xml)
    assert [m[0] for m in mags] == ["Mw", "ML", "ML", "ML"]          # station magnitudes ignored
    cfg = {"altmag_type": "ML", "altmag_authors": ["BULLETIN-INGV", "SURVEY-INGV"]}
    assert pick_local(mags, cfg) == 6.1
    assert pick_local(mags, {"altmag_type": "ml"}) == 6.0             # case-insensitive, last listed
    assert pick_local(mags, {"altmag_type": "MLv"}) is None


def test_event_windows_remove_sequence_incompleteness():
    """A burst whose early part is incomplete above a higher Mc biases a per-period b low; 200-event windows fix it."""
    rng = np.random.default_rng(21)
    bg = synth_period(3000, 1.0, 1.0, rng)                     # background, complete above 1.0
    burst = synth_period(1000, 1.0, 2.2, rng)                  # sequence onset, complete only above 2.2
    m = np.r_[bg, burst]
    per = np.zeros(m.size, int)                                # one calendar period, time-ordered
    r0 = rl.cell_b_tv(m, per, [np.nan], nboot=100, rng=0)
    rw = rl.cell_b_tv(m, per, [np.nan], nboot=100, rng=0, window=200)
    assert r0["b_raw"] < 0.85, r0["b_raw"]
    assert abs(rw["b_raw"] - 1.0) < 0.08, rw["b_raw"]
    blocks, owner = rl._sub_blocks([(0, 1000), (1000, 1150)], 200)
    assert blocks[-1] == (1000, 1150) and blocks[-2] == (800, 1000) and set(owner) == {0, 1}


def test_magtype_filter_is_case_insensitive(tmp_path, monkeypatch):
    # ComCat serves 4 SoCal events as 'Ml' next to 252,189 'ml'; the filter dropped them (audit fix)
    import build_regional as br
    df = pd.DataFrame({"time": pd.to_datetime(["2010-01-01"] * 4, utc=True), "year": [2010.0] * 4,
                       "lat": [34.0] * 4, "lon": [-118.0] * 4, "depth": [10.0] * 4, "mag": [2.0, 2.1, 2.2, 2.3],
                       "magtype": ["ml", "Ml", "ML", "mh"], "author": ["ci"] * 4, "id": list("abcd"),
                       "etype": ["earthquake"] * 4})
    df.to_pickle(tmp_path / "t.pkl")
    monkeypatch.setattr(br, "WORK", tmp_path)
    cfg = {"id": "t", "bbox": [-120, 30, -110, 40], "periods": [[2010, 2011]], "magtypes": ["ml"], "authors": None}
    used, cnt, other = br.load_catalogue(cfg)
    assert sorted(used.id) == ["a", "b", "c"] and other.id.tolist() == ["d"]


def test_regional_polygons_do_not_jump_across_the_antimeridian():
    import build_regional as br
    import h3
    h = h3.latlng_to_cell(-38.0, 179.99, 4)
    xs = [c[0] for c in br.cell_polygon(h)["coordinates"][0]]
    assert max(xs) - min(xs) < 2, xs                     # before: about 359.8 for 14 NZ cells


def test_declustered_quality_code_never_comes_without_its_b():
    # Iceland 85074543fffffff had sh_q C (main b masked) but sh_qdecl B and no sh_bdecl
    import build_regional as br
    rd_b = {"quality": "B", "b_raw": 1.2, "b_lo_raw": 1.0, "b_hi_raw": 1.5, "n_b": 80}
    assert br.decl_props("sh_", False, rd_b) == {}                        # main b masked: no declustered code
    assert br.decl_props("sh_", True, rd_b) == {"sh_qdecl": "B", "sh_bdecl": 1.2, "sh_bdecl_lo": 1.0,
                                                "sh_bdecl_hi": 1.5}
    assert br.decl_props("sh_", True, {"quality": "insufficient", "b_raw": 3.2}) == {"sh_qdecl": "insufficient"}
    assert br.decl_props("sh_", True, {}) == {}                            # declustered b not computed


def test_published_regional_cells_with_quality_a_or_b_have_their_b():
    import json
    idx = json.loads((ROOT / "site" / "data" / "regional" / "index.json").read_text())
    for r in idx["regions"]:
        cells = json.loads((ROOT / "site" / "data" / "regional" / r["id"] / "cells.geojson").read_text())
        for f in cells["features"]:
            p = f["properties"]
            for d in ("sh", "dp"):
                for q, b in ((f"{d}_q", f"{d}_b"), (f"{d}_qdecl", f"{d}_bdecl")):
                    if p.get(q) in ("A", "B"):
                        assert all(p.get(b + s) is not None for s in ("", "_lo", "_hi")), (r["id"], p["id"], q)
