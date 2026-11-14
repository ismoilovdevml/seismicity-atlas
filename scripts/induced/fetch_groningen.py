"""Download the open inputs of the Groningen induced-seismicity case study (cached).

Sources (docs/induced.md has the licences and exact attribution)
  KNMI FDSN event service   https://rdsa.knmi.nl/fdsnws/event/1/query (format=text), yearly chunks, box around the
                            field. Local magnitudes (ML), event types as published by KNMI.
  NLOG production figures   https://www.nlog.nl/nlog-mapviewer-api/rest/prodfigures/field (the JSON service behind the
                            NLOG datacenter), monthly gas production of the Groningen field, 2003 onwards.
  NLOG field outline        https://www.nlog.nl/standalone/rest/services/nlog_gdn/gdw_ng_field_utm_v1/MapServer/0
                            (ArcGIS REST, FIELD_CODE = 'GRO', returned as GeoJSON in WGS84).

Every raw response is written once to data/raw/induced/groningen/<sha1>.<ext> (manifest.jsonl next to it) and
reused on later runs; --refresh downloads again. Responses are untrusted data and are parsed as text / JSON only.

Output: data/work/induced/groningen_events.pkl, groningen_production.csv, groningen_outline.geojson
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "regional"))
from fetch_regional import parse_fdsn_text  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "induced" / "groningen"
WORK = ROOT / "data" / "work" / "induced"
UA = {"User-Agent": "seismicity-atlas research client (python-requests)"}

KNMI_URL = "https://rdsa.knmi.nl/fdsnws/event/1/query"
BOX = dict(minlatitude=52.90, maxlatitude=53.70, minlongitude=6.20, maxlongitude=7.40)  # field outline + margin
YEAR0 = 1986
CUTOFF = "2026-11-01"           # catalogue cut-off (exclusive), UTC
NLOG_PROD = "https://www.nlog.nl/nlog-mapviewer-api/rest/prodfigures/field"
NLOG_FIELD = ("https://www.nlog.nl/standalone/rest/services/nlog_gdn/gdw_ng_field_utm_v1/MapServer/0/query")
MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split()


def cached(method: str, url: str, params: dict | None, body: dict | None, ext: str, refresh: bool) -> bytes:
    full = requests.Request(method, url, params=params).prepare().url
    key = full + ("" if body is None else json.dumps(body, sort_keys=True))
    RAW.mkdir(parents=True, exist_ok=True)
    f = RAW / f"{hashlib.sha1(key.encode()).hexdigest()[:16]}.{ext}"
    if f.exists() and not refresh:
        return f.read_bytes()
    last = None
    for k in range(4):
        try:
            if method == "POST":
                r = requests.post(full, json=body, headers=UA, timeout=300)
            else:
                r = requests.get(full, headers=UA, timeout=300)
            if r.status_code == 204:
                data = b""
            else:
                r.raise_for_status()
                data = r.content
            f.write_bytes(data)
            with open(RAW / "manifest.jsonl", "a") as m:
                m.write(json.dumps({"method": method, "url": full, "body": body, "file": f.name,
                                    "status": r.status_code, "bytes": len(data),
                                    "sha256": hashlib.sha256(data).hexdigest(),
                                    "fetched_utc": datetime.now(timezone.utc).isoformat()}) + "\n")
            time.sleep(0.5)
            return data
        except requests.RequestException as e:
            last = e
            time.sleep(5 * (k + 1))
    raise RuntimeError(f"failed: {full}: {last}")


def fetch_events(refresh=False) -> pd.DataFrame:
    end_year = int(CUTOFF[:4])
    parts = []
    for y in range(YEAR0, end_year + 1):
        t1 = f"{y + 1}-01-01" if y < end_year else CUTOFF
        txt = cached("GET", KNMI_URL, dict(starttime=f"{y}-01-01", endtime=t1, format="text", **BOX), None,
                     "txt", refresh).decode("utf-8", "replace")
        df = parse_fdsn_text(txt)
        if len(df):
            parts.append(df)
    ev = pd.concat(parts, ignore_index=True).drop_duplicates("id").sort_values("time").reset_index(drop=True)
    return ev


def parse_production(records: list) -> pd.DataFrame:
    """NLOG field records (one per year, keys jan..dec) -> monthly table; volume in 1e3 m3 as served."""
    rows = []
    for r in records:
        y = int(r["year"])
        for i, mname in enumerate(MONTHS):
            v = r.get(mname)
            rows.append({"month": f"{y}-{i + 1:02d}", "gas_1e3m3": None if v is None else float(v)})
    return pd.DataFrame(rows).sort_values("month").reset_index(drop=True)


def fetch_production(refresh=False) -> pd.DataFrame:
    body = {"name": "Groningen", "yearStart": 2003, "yearEnd": int(CUTOFF[:4]), "product": "Gas",
            "production": "Produced"}
    recs = json.loads(cached("POST", NLOG_PROD, None, body, "json", refresh))
    recs = [r for r in recs if r.get("name") == "Groningen"]
    return parse_production(recs)


def fetch_outline(refresh=False) -> dict:
    gj = json.loads(cached("GET", NLOG_FIELD, dict(where="FIELD_CODE='GRO'", outFields="FIELD_NAME,FIELD_CODE",
                                                   outSR=4326, f="geojson"), None, "geojson", refresh))
    assert len(gj["features"]) == 1 and gj["features"][0]["properties"]["FIELD_CODE"] == "GRO"
    return gj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)
    ev = fetch_events(a.refresh)
    ev.to_pickle(WORK / "groningen_events.pkl")
    print(f"KNMI events in box: {len(ev)}  {ev.time.min()} .. {ev.time.max()}")
    print("magtypes:", ev.magtype.value_counts().to_dict())
    print("etypes:", ev.etype.value_counts().to_dict())
    pr = fetch_production(a.refresh)
    pr.to_csv(WORK / "groningen_production.csv", index=False)
    print(f"NLOG production months: {pr.gas_1e3m3.notna().sum()}  {pr.month.min()} .. {pr.month.max()}")
    gj = fetch_outline(a.refresh)
    (WORK / "groningen_outline.geojson").write_text(json.dumps(gj))
    print("outline rings:", len(gj["features"][0]["geometry"]["coordinates"]))


if __name__ == "__main__":
    main()
