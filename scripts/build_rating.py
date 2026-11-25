"""Build the small lookup the Simple view uses for the place card's recording rating (site/data/rating.json).

    .venv/bin/python -I scripts/build_rating.py [--check]

The Simple view needs, for the cell under a clicked or searched place, only the recording rating and its three
inputs (shallow quality code, shallow Mc, catalogue flag) plus the cell id, centre and area. cells.geojson carries
about 60 properties per cell (1.4 MB); this file carries those few, so the Simple view does not load cells.geojson
at all (it is loaded when the Scientist view is opened).

Input: site/data/cells.geojson and manifest.json (`global.b_shallow_1976_2021.mc`). Run after scripts/atlas.py
(run_all.sh does). `--check` only compares the file on disk with a fresh build and exits 1 when they differ.

Output columns, one row per cell in cells.geojson order:
  id    the H3 index without its constant tail (`id_tail`, "fffffffff" at resolution 2)
  lat, lon   the cell centre (properties lat / lon) times 1000, as integers (the published values have 3 decimals)
  r     rating index into `ratings` (vgood, good, limited, few), by the rule below
  q     shallow quality code index into `qualities` (sh_q)
  mc    shallow Mc (sh_mc) times 10, or null
  f     catalogue flag index into `flags` (c_flag)
  a     area in thousands of km2, rounded half up (the card prints it so)
  ring  the hexagon in hundredths of a degree (the published coordinates have 2 decimals): the first vertex, then
        the difference of each next vertex from the previous one; the closing vertex is left out
Integers divided by 100 or 1000 give exactly the doubles that parsing the published decimals gives, so the
browser's point-in-hexagon test (places.js cellAtPoint) finds the same cell as it does on cells.geojson.

The rating says how many large earthquakes the global ISC-GEM catalogue holds near a place (enough for a b-value or
not); it does not rate local seismic networks, so quiet but densely instrumented regions are "few" too.
The rule (docs/learn.md, "The recording rating"; places.js recordingRating), checked in this order:
  few      sh_q is not A, B or C ("insufficient")
  limited  sh_q is C, or c_flag is "check"
  vgood    sh_q is A, c_flag is "ok" and sh_mc <= global shallow Mc + 0.2
  good     every other A or B cell
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "site" / "data"
OUT = DATA / "rating.json"
RATINGS = ["vgood", "good", "limited", "few"]
QUALITIES = ["A", "B", "C", "insufficient"]
FLAGS = ["ok", "few", "check"]
ID_TAIL = "fffffffff"


def rating(p: dict, global_mc: float) -> str:
    """The same rule as recordingRating() in site/js/places.js."""
    q = p.get("sh_q")
    if q not in ("A", "B", "C"):
        return "few"
    if q == "C" or p.get("c_flag") == "check":
        return "limited"
    mc = p.get("sh_mc")
    if q == "A" and p.get("c_flag") == "ok" and isinstance(mc, (int, float)) and mc <= global_mc + 0.2 + 1e-9:
        return "vgood"
    return "good"


def fixed(v: float, k: int) -> int:
    """v times k as an exact integer; refuses values with more decimals than the format keeps."""
    n = round(v * k)
    if abs(n - v * k) > 1e-6:
        raise ValueError(f"{v} has more decimals than 1/{k}")
    return n


def encode_ring(ring: list) -> list[int]:
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    out: list[int] = []
    px = py = 0
    for i, (x, y) in enumerate(pts):
        ix, iy = fixed(x, 100), fixed(y, 100)
        out += [ix, iy] if i == 0 else [ix - px, iy - py]
        px, py = ix, iy
    return out


def build(cells: dict, manifest: dict) -> dict:
    gmc = manifest["global"]["b_shallow_1976_2021"]["mc"]
    rows = []
    for ft in cells["features"]:
        p = ft["properties"]
        if not p["id"].endswith(ID_TAIL):
            raise ValueError(f"cell id {p['id']} does not end with {ID_TAIL}")
        if ft["geometry"]["type"] != "Polygon":
            raise ValueError(f"cell {p['id']} is not a Polygon")
        mc = p.get("sh_mc")
        rows.append([
            p["id"][: -len(ID_TAIL)], fixed(p["lat"], 1000), fixed(p["lon"], 1000),
            RATINGS.index(rating(p, gmc)), QUALITIES.index(p["sh_q"]),
            None if mc is None else fixed(mc, 10), FLAGS.index(p["c_flag"]),
            (int(p["area_km2"]) + 500) // 1000, encode_ring(ft["geometry"]["coordinates"][0]),
        ])
    return {
        "about": "Recording rating lookup for the Simple view, built by scripts/build_rating.py from cells.geojson",
        "global_mc": gmc,
        "id_tail": ID_TAIL,
        "ratings": RATINGS,
        "qualities": QUALITIES,
        "flags": FLAGS,
        "columns": ["id", "lat", "lon", "r", "q", "mc", "f", "a", "ring"],
        "rows": rows,
    }


def dumps(doc: dict) -> str:
    return json.dumps(doc, separators=(",", ":")) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="compare with the file on disk, do not write")
    args = ap.parse_args()
    cells = json.loads((DATA / "cells.geojson").read_text())
    manifest = json.loads((DATA / "manifest.json").read_text())
    text = dumps(build(cells, manifest))
    if args.check:
        same = OUT.exists() and OUT.read_text() == text
        print(f"{OUT.relative_to(ROOT)}: {'up to date' if same else 'OUT OF DATE, run scripts/build_rating.py'}")
        sys.exit(0 if same else 1)
    OUT.write_text(text)
    print(f"{OUT.relative_to(ROOT)}: {len(cells['features'])} cells, {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
