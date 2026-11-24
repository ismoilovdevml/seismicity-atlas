"""Data contract of site/data/deficit/ (docs/deficit.md): keys, types and interval ordering."""
import json
from pathlib import Path

import pytest

D = Path(__file__).resolve().parents[1] / "site" / "data" / "deficit"
pytestmark = pytest.mark.skipif(not (D / "index.json").exists(), reason="deficit layer not built")

REQ = {"id", "q", "n6", "n_ev", "models", "ms_obs", "area_km2"}
CI = ("mg", "ms_tgr", "r_tgr")


def _features(name):
    return json.loads((D / name).read_text())["features"]


@pytest.mark.parametrize("name", ["regions.geojson", "cells.geojson"])
def test_features(name):
    feats = _features(name)
    assert feats
    for f in feats:
        p = f["properties"]
        assert REQ <= set(p), p["id"]
        assert p["q"] in {"ok", "few", "nogeod"}
        assert f["geometry"]["type"] in {"Polygon", "MultiPolygon"}
        if p["q"] == "nogeod":
            assert "mg" not in p
            continue
        for k in CI:
            assert p[k + "_lo"] <= p[k] <= p[k + "_hi"], (p["id"], k)
        assert p["r_obs_lo"] <= p["r_obs_hi"]
        assert 0.0 <= p["p_full"] <= 1.0 and 0.0 <= p["p_half"] <= 1.0
        assert p["p_half"] >= p["p_full"] - 0.05          # less coupling -> observed release less surprising
        assert p["ms_obs"] >= 0 and p["mg"] > 0


def test_index():
    ix = json.loads((D / "index.json").read_text())
    for k in ("disclaimer", "licence", "attribution", "sources", "method", "validation", "regions", "files"):
        assert k in ix
    assert "not a forecast" in ix["disclaimer"].lower()
    assert all(s.get("licence") for s in ix["sources"])
    assert {r["id"] for r in ix["regions"]} == {f["properties"]["id"] for f in _features("regions.geojson")}
    for f, meta in ix["files"].items():
        assert (D / f).stat().st_size == meta["bytes"]
    y = ix["method"]["b_whole_belt"]["years"]                    # was [1976, "2026"]: int and string mixed
    assert all(type(v) is int for v in y) and y[0] < y[1]
