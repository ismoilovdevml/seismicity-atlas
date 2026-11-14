"""site/data/rating.json (the Simple view's rating lookup) against cells.geojson and the documented rule."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_rating  # noqa: E402

DATA = ROOT / "site" / "data"


def load():
    return json.loads((DATA / "cells.geojson").read_text()), json.loads((DATA / "manifest.json").read_text())


def test_rating_json_is_up_to_date():
    cells, manifest = load()
    assert (DATA / "rating.json").read_text() == build_rating.dumps(build_rating.build(cells, manifest)), \
        "site/data/rating.json is stale: run scripts/build_rating.py"


def test_rows_decode_to_the_cells():
    cells, manifest = load()
    doc = json.loads((DATA / "rating.json").read_text())
    c = {k: i for i, k in enumerate(doc["columns"])}
    assert len(doc["rows"]) == len(cells["features"])
    for ft, r in zip(cells["features"], doc["rows"]):
        p = ft["properties"]
        assert r[c["id"]] + doc["id_tail"] == p["id"]
        assert (r[c["lat"]] / 1000, r[c["lon"]] / 1000) == (p["lat"], p["lon"])
        assert doc["qualities"][r[c["q"]]] == p["sh_q"] and doc["flags"][r[c["f"]]] == p["c_flag"]
        assert (None if r[c["mc"]] is None else r[c["mc"]] / 10) == p.get("sh_mc")
        ring, x, y = [], 0, 0
        v = r[c["ring"]]
        for i in range(0, len(v), 2):
            x, y = (v[0], v[1]) if i == 0 else (x + v[i], y + v[i + 1])
            ring.append([x / 100, y / 100])
        assert ring + [ring[0]] == ft["geometry"]["coordinates"][0]


def test_rule_table():
    """The rule of docs/learn.md, branch by branch (globalMc 5.2: Very good up to Mc 5.4)."""
    g = 5.2
    r = build_rating.rating
    assert r({"sh_q": "insufficient", "c_flag": "ok"}, g) == "few"
    assert r({"sh_q": "C", "c_flag": "ok", "sh_mc": 5.2}, g) == "limited"
    assert r({"sh_q": "A", "c_flag": "check", "sh_mc": 5.2}, g) == "limited"
    assert r({"sh_q": "A", "c_flag": "ok", "sh_mc": 5.4}, g) == "vgood"
    assert r({"sh_q": "A", "c_flag": "ok", "sh_mc": 5.5}, g) == "good"
    assert r({"sh_q": "A", "c_flag": "few", "sh_mc": 5.2}, g) == "good"
    assert r({"sh_q": "B", "c_flag": "ok", "sh_mc": 5.2}, g) == "good"
