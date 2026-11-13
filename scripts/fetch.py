"""Fetch the open inputs of the atlas and cache every raw response under data/raw/ (gitignored).

Downloaded content is untrusted data: it is only parsed as CSV / JSON, never executed.
Every cached file is recorded in data/raw/manifest.jsonl (URL, time, bytes, sha256).

Sources
  comcat   USGS ComCat FDSN event service, global, M >= 4.5, 1973 .. cut-off, chunked by year
           (ComCat refuses queries above 20,000 events with HTTP 400; such chunks are split in two)
  iscgem   ISC-GEM Global Instrumental Earthquake Catalogue as served by ComCat (catalog=iscgem).
           The ISC download page requires a personal request form, so the ComCat mirror is used.
  aux      Natural Earth 110m land + 50m coastline (public domain) and Bird (2003) PB2002 plate boundaries
           and boundary steps via github.com/fraxen/tectonicplates (ODC-BY 1.0)

Usage
  python -I scripts/fetch.py all --end 2026-11-13
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
UA = "seismicity-atlas research client (python-requests)"
COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query"
AUX = {
    "ne_110m_land.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson",
    "ne_50m_coastline.geojson": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson",
    "PB2002_boundaries.json": "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json",
    "PB2002_steps.json": "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json",
}
KEEP = ["time", "latitude", "longitude", "depth", "mag", "magType", "net", "id", "place", "status",
        "horizontalError", "depthError", "magError", "magSource", "locationSource", "updated"]


class TooMany(Exception):
    pass


def cache_get(url: str, params: dict | None, source: str, ext: str, refresh=False, timeout=300, retries=4) -> bytes:
    full = requests.Request("GET", url, params=params).prepare().url
    key = hashlib.sha1(full.encode()).hexdigest()[:16]
    d = RAW / source
    d.mkdir(parents=True, exist_ok=True)
    f = d / f"{key}.{ext}"
    if f.exists() and not refresh:
        return f.read_bytes()
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(full, headers={"User-Agent": UA}, timeout=timeout)
            if r.status_code == 400:
                raise TooMany(r.text[:200])
            if r.status_code == 204:
                body = b""
            else:
                r.raise_for_status()
                body = r.content
            f.write_bytes(body)
            with open(RAW / "manifest.jsonl", "a") as m:
                m.write(json.dumps({"url": full, "file": str(f.relative_to(ROOT)), "bytes": len(body),
                                    "sha256": hashlib.sha256(body).hexdigest(),
                                    "fetched_utc": datetime.now(timezone.utc).isoformat()}) + "\n")
            return body
        except TooMany:
            raise
        except requests.RequestException as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"failed after {retries} tries: {full}: {last}")


def chunks(start: str, end: str, days: float):
    t0, t1 = datetime.fromisoformat(start), datetime.fromisoformat(end)
    while t0 < t1:
        t = min(t0 + timedelta(days=days), t1)
        yield t0.isoformat(), t.isoformat()
        t0 = t


def comcat_chunk(t0, t1, minmag, catalog, refresh, frames):
    p = {"format": "csv", "starttime": t0, "endtime": t1, "orderby": "time-asc"}
    if minmag is not None:
        p["minmagnitude"] = minmag
    if catalog:
        p["catalog"] = catalog
    else:
        p["eventtype"] = "earthquake"
    try:
        body = cache_get(COMCAT, p, catalog or "comcat", "csv", refresh)
    except TooMany:
        mid = datetime.fromisoformat(t0) + (datetime.fromisoformat(t1) - datetime.fromisoformat(t0)) / 2
        comcat_chunk(t0, mid.isoformat(), minmag, catalog, refresh, frames)
        comcat_chunk(mid.isoformat(), t1, minmag, catalog, refresh, frames)
        return
    if body.strip():
        frames.append(pd.read_csv(io.BytesIO(body), dtype={"id": str, "net": str, "magType": str}))
    time.sleep(0.5)


def fetch_catalog(name, start, end, minmag, chunk_days, catalog, refresh):
    frames: list = []
    for t0, t1 in chunks(start, end, chunk_days):
        comcat_chunk(t0, t1, minmag, catalog, refresh, frames)
    df = pd.concat(frames, ignore_index=True)
    n_raw = len(df)
    df = df.drop_duplicates("id")
    print(f"{name}: event types {df['type'].value_counts().to_dict()}")
    df = df[df["type"] == "earthquake"][[c for c in KEEP if c in df.columns]]
    PROC.mkdir(parents=True, exist_ok=True)
    out = PROC / f"{name}.csv"
    df.sort_values("time").to_csv(out, index=False)
    print(f"{name}: {n_raw} rows fetched, {len(df)} unique events, {df['time'].min()} .. {df['time'].max()} -> "
          f"{out.relative_to(ROOT)}")


def fetch_aux(refresh):
    d = PROC / "aux"
    d.mkdir(parents=True, exist_ok=True)
    for fname, url in AUX.items():
        body = cache_get(url, None, "aux", fname.split(".")[-1], refresh)
        json.loads(body)  # must parse as JSON; nothing else is done with it here
        (d / fname).write_bytes(body)
        print(f"aux {fname}: {len(body)/1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["comcat", "iscgem", "aux", "all"])
    ap.add_argument("--end", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    if a.what in ("iscgem", "all"):
        fetch_catalog("iscgem", "1900-01-01", a.end, None, 3652.5, "iscgem", a.refresh)
    if a.what in ("comcat", "all"):
        fetch_catalog("comcat_m45", "1973-01-01", a.end, 4.5, 365.25, None, a.refresh)
    if a.what in ("aux", "all"):
        fetch_aux(a.refresh)


if __name__ == "__main__":
    main()
