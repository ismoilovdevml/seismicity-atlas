"""Build the place-search gazetteer for the website (site/data/places.json).

    .venv/bin/python -I scripts/basemap/build_places.py [--raw DIR]

Source (public domain, https://www.naturalearthdata.com/about/terms-of-use/):
  Natural Earth 1:10m Populated Places (ne_10m_populated_places, version 5.1.2), 7,342 places.

Output: one compact JSON file that the Simple view of the site loads on the first focus of the search box. The search
runs in the browser; no geocoding service is called. Columns (one row per place, sorted by population, largest
first):
  n  name as published (NAME, with accents)
  a  ASCII name (NAMEASCII), "" when equal to n
  c  index into the countries list (ADM0NAME)
  r  first-level region (ADM1NAME), "" when absent
  y, x  latitude and longitude, rounded to 0.001 degree
  p  maximum population estimate (POP_MAX), only used to rank matches
  ru, es  the Russian and Spanish names when Natural Earth has them and they differ from n, else ""
  alt  alternative names (NAMEALT, "|"-separated), used for matching only
Natural Earth has no Uzbek names, so none are added: Uzbek visitors match on the Latin name (n, a, alt).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetchlib  # noqa: E402

URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip"
NAME = "ne_10m_populated_places.zip"
SHA256 = "cd149186f03d2603e0410da399b980a4357d0ac32d3a2305a49ed3dffcc41d7b"
OUT = fetchlib.ROOT / "site" / "data" / "places.json"
FIELDS = "NAME,NAMEASCII,NAMEALT,ADM0NAME,ADM1NAME,LATITUDE,LONGITUDE,POP_MAX,NAME_RU,NAME_ES"


def read_places(zpath: Path) -> list[dict]:
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "places.geojson"
        subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-select", FIELDS, str(out), f"/vsizip/{zpath}"], check=True)
        return [f["properties"] for f in json.loads(out.read_text())["features"]]


def clean(s) -> str:
    return " ".join(str(s or "").split())


def build(rows: list[dict]) -> dict:
    countries: list[str] = []
    cidx: dict[str, int] = {}
    out = []
    for p in sorted(rows, key=lambda p: -(p.get("POP_MAX") or 0)):
        n = clean(p["NAME"])
        if not n:
            continue
        a = clean(p.get("NAMEASCII"))
        country = clean(p.get("ADM0NAME"))
        if country not in cidx:
            cidx[country] = len(countries)
            countries.append(country)
        ru = clean(p.get("NAME_RU"))
        es = clean(p.get("NAME_ES"))
        alt = "|".join(x for x in (clean(s) for s in str(p.get("NAMEALT") or "").split("|")) if len(x) >= 3 and x != n)
        out.append([n, "" if a == n else a, cidx[country], clean(p.get("ADM1NAME")),
                    round(float(p["LATITUDE"]), 3), round(float(p["LONGITUDE"]), 3), int(p.get("POP_MAX") or 0),
                    "" if ru == n else ru, "" if es == n else es, alt])
    return {
        "source": "Natural Earth 1:10m Populated Places v5.1.2",
        "url": "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/",
        "licence": "public domain (https://www.naturalearthdata.com/about/terms-of-use/)",
        "columns": ["n", "a", "c", "r", "y", "x", "p", "ru", "es", "alt"],
        "countries": countries,
        "rows": out,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--raw", type=Path, help="download cache directory (default data/raw/basemap)")
    args = ap.parse_args()
    if args.raw:
        # a copy downloaded elsewhere: only verify it
        zpath = args.raw / NAME
        digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
        if digest != SHA256:
            raise SystemExit(f"checksum mismatch for {zpath}: {digest}")
    else:
        zpath = fetchlib.fetch(URL, NAME, SHA256)
    doc = build(read_places(zpath))
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(fetchlib.ROOT)}: {len(doc['rows'])} places, {len(doc['countries'])} countries, "
          f"{OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
