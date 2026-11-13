"""Download regional earthquake catalogues (cached) and normalise them to one table per region.

Every raw response is written once to data/raw/regional/<id>/<key>.<ext> and reused on later runs (use --refresh
to re-download). Downloads are untrusted data: they are parsed as CSV / pipe-separated text only.

Clients
  fdsn_text  FDSN event service, format=text (INGV, GeoNet). Monthly chunks, split in two when a chunk reaches the
             server's row limit.
  comcat     USGS ComCat FDSN event service, format=csv (catalog=ci for the Southern California Seismic Network).
             Monthly chunks, split when ComCat answers 400 (more than 20,000 events).
  imo        Icelandic Met Office Quakes API (https://api.vedur.is/quakes/), CSV, windows split by /events/count.

Output: data/work/regional/<id>.pkl with columns time, year, lat, lon, depth, mag, magtype, author, id.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from regions import REGIONS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "regional"
WORK = ROOT / "data" / "work" / "regional"
UA = {"User-Agent": "seismicity-atlas research client (python-requests)"}
PAUSE_S = 0.5  # pause between uncached requests


class TooMany(Exception):
    """The server refused or truncated a request because it holds too many events."""


def cache_get(url: str, params: dict, rid: str, ext: str, refresh: bool = False, timeout: int = 300,
              retries: int = 4) -> bytes:
    """GET with an on-disk cache keyed by the full URL. HTTP 204 (FDSN 'no data') is cached as an empty body."""
    full = requests.Request("GET", url, params=params).prepare().url
    d = RAW / rid
    d.mkdir(parents=True, exist_ok=True)
    f = d / f"{hashlib.sha1(full.encode()).hexdigest()[:16]}.{ext}"
    if f.exists() and not refresh:
        return f.read_bytes()
    last = None
    for k in range(retries):
        try:
            r = requests.get(full, headers=UA, timeout=timeout)
            if r.status_code == 204:
                body = b""
            elif r.status_code in (400, 413):
                raise TooMany(r.text[:300])
            else:
                r.raise_for_status()
                body = r.content
            f.write_bytes(body)
            with open(d / "manifest.jsonl", "a") as m:
                m.write(json.dumps({"url": full, "file": f.name, "status": r.status_code, "bytes": len(body),
                                    "sha256": hashlib.sha256(body).hexdigest(),
                                    "fetched_utc": datetime.now(timezone.utc).isoformat()}) + "\n")
            time.sleep(PAUSE_S)
            return body
        except TooMany:
            raise
        except requests.RequestException as e:
            last = e
            time.sleep(5 * (k + 1))
    raise RuntimeError(f"failed after {retries} tries: {full}: {last}")


def month_chunks(start: str, end: str):
    t = datetime.fromisoformat(start)
    t1 = datetime.fromisoformat(end)
    while t < t1:
        nxt = (t.replace(day=1) + timedelta(days=32)).replace(day=1)
        yield t, min(nxt, t1)
        t = nxt


def _split(t0, t1):
    mid = t0 + (t1 - t0) / 2
    return [(t0, mid), (mid, t1)]


# ------------------------------------------------------------------------------------------------ FDSN text
def parse_fdsn_text(txt: str) -> pd.DataFrame:
    """Parse FDSN 'format=text' (pipe-separated, '#EventID' header; GeoNet pads with spaces)."""
    if not txt.strip():
        return pd.DataFrame()
    df = pd.read_csv(io.StringIO(txt), sep="|", dtype=str, skipinitialspace=True)
    df.columns = [c.strip().lstrip("#").strip() for c in df.columns]
    df = df.apply(lambda s: s.str.strip())
    dcol = [c for c in df.columns if c.lower().startswith("depth")][0]
    return pd.DataFrame({
        "time": pd.to_datetime(df["Time"], utc=True, format="ISO8601"),
        "lat": pd.to_numeric(df["Latitude"], errors="coerce"), "lon": pd.to_numeric(df["Longitude"], errors="coerce"),
        "depth": pd.to_numeric(df[dcol], errors="coerce"), "mag": pd.to_numeric(df["Magnitude"], errors="coerce"),
        "magtype": df["MagType"].fillna(""), "author": df["Author"].fillna(""), "id": df["EventID"],
        "etype": df.get("EventType", pd.Series("earthquake", index=df.index)).fillna("earthquake")})


def fdsn_text_chunk(cfg, t0, t1, refresh, out):
    p = {"format": "text", "starttime": t0.isoformat(), "endtime": t1.isoformat(), "orderby": "time-asc",
         "minmagnitude": cfg["download_minmag"], **bbox_params(cfg["bbox"])}
    try:
        body = cache_get(cfg["url"], p, cfg["id"], "txt", refresh)
        txt = body.decode("utf-8", errors="replace")
        if txt.strip() and not txt.lstrip().startswith("#"):
            if "no events" in txt.lower() or "nodata" in txt.lower():
                return
            raise RuntimeError(f"unexpected response {t0}..{t1}: {txt[:200]}")
        df = parse_fdsn_text(txt)
        if len(df) >= cfg["row_limit"]:
            raise TooMany(f"{len(df)} rows")
    except TooMany:
        if t1 - t0 < timedelta(hours=1):
            raise RuntimeError(f"cannot split further: {t0}..{t1}")
        for a, b in _split(t0, t1):
            fdsn_text_chunk(cfg, a, b, refresh, out)
        return
    if len(df):
        out.append(df)


def bbox_params(bb):
    w, s, e, n = bb
    return {"minlatitude": s, "maxlatitude": n, "minlongitude": w, "maxlongitude": e}


# ------------------------------------------------------------------------------------------------ ComCat CSV
def comcat_chunk(cfg, t0, t1, refresh, out):
    p = {"format": "csv", "starttime": t0.isoformat(), "endtime": t1.isoformat(), "orderby": "time-asc",
         "eventtype": "earthquake", "minmagnitude": cfg["download_minmag"], "catalog": cfg["comcat_catalog"],
         **bbox_params(cfg["bbox"])}
    try:
        body = cache_get(cfg["url"], p, cfg["id"], "csv", refresh)
    except TooMany:
        for a, b in _split(t0, t1):
            comcat_chunk(cfg, a, b, refresh, out)
        return
    if not body.strip():
        return
    df = pd.read_csv(io.BytesIO(body), dtype={"id": str})
    out.append(pd.DataFrame({
        "time": pd.to_datetime(df["time"], utc=True, format="ISO8601"), "lat": df["latitude"], "lon": df["longitude"],
        "depth": df["depth"], "mag": df["mag"], "magtype": df["magType"].astype(str), "author": df["net"].astype(str),
        "id": df["id"], "etype": df["type"].astype(str), "status": df["status"].astype(str)}))


# ------------------------------------------------------------------------------------------------ IMO Quakes API
def imo_window(cfg, t0, t1, refresh, out):
    w, s, e, n = cfg["bbox"]
    base = {"polygon": f"POLYGON(({w} {s}, {w} {n}, {e} {n}, {e} {s}, {w} {s}))", "system": cfg["imo_system"],
            "evaluation_mode": "manual", "depth_min": 0, "depth_max": cfg["imo_depth_max"], "size_min": -3,
            "size_max": 10, "start_time": t0.isoformat(), "end_time": t1.isoformat()}
    cnt = int(cache_get(cfg["url"] + "/events/count", base, cfg["id"], "count", refresh).decode().strip())
    if cnt == 0:
        return
    if cnt > cfg["row_limit"] and (t1 - t0) > timedelta(hours=6):
        for a, b in _split(t0, t1):
            imo_window(cfg, a, b, refresh, out)
        return
    body = cache_get(cfg["url"] + "/events", dict(base, format="csv"), cfg["id"], "csv", refresh)
    df = pd.read_csv(io.BytesIO(body), dtype={"event_id": str})
    if len(df) != cnt:
        print(f"  warning: count {cnt} but {len(df)} rows for {t0}..{t1}", flush=True)
    out.append(pd.DataFrame({
        "time": pd.to_datetime(df["time"], utc=True, format="ISO8601"), "lat": df["latitude"], "lon": df["longitude"],
        "depth": df["depth"], "mag": df["magnitude"], "magtype": cfg["magtype_label_short"],
        "author": df["evaluation_mode"].astype(str), "id": df["event_id"], "etype": df["type"].astype(str)}))


# ------------------------------------------------------------------------------------------------ per-event magnitudes
# Large events usually have Mw (or mB) as their preferred magnitude, so a catalogue filtered on the local magnitude
# loses its largest events and b is biased high. For those events the region's own local magnitude is read from the
# per-event QuakeML (all magnitudes) and used instead. Results are cached per event as small JSON files.
MAG_RE = re.compile(r"<magnitude publicID=\"[^\"]*\"(.*?)</magnitude>", re.S)


def parse_magnitudes(xml: str) -> list:
    """[(type, value, author)] of the event-level <magnitude> elements (station magnitudes are ignored)."""
    out = []
    for blk in MAG_RE.findall(xml):
        t = re.search(r"<type>([^<]*)</type>", blk)
        v = re.search(r"<mag>\s*<value>([^<]*)</value>", blk)
        a = re.search(r"<author>([^<]*)</author>", blk)
        if t and v:
            out.append((t.group(1).strip(), float(v.group(1)), a.group(1).strip() if a else ""))
    return out


def pick_local(mags: list, cfg) -> float | None:
    """The region's local magnitude for one event: the last listed value of the wanted type, preferring the
    authors listed first in cfg['altmag_authors'] (e.g. the reviewed INGV bulletin)."""
    want = cfg["altmag_type"].lower()
    cand = [(t, v, a) for t, v, a in mags if t.lower() == want]
    if not cand:
        return None
    for pref in cfg.get("altmag_authors", []):
        c = [x for x in cand if x[2] == pref]
        if c:
            return c[-1][1]
    return cand[-1][1]


def _get_prefix(url: str, params: dict, stop: bytes, max_bytes: int = 3_000_000) -> str:
    """Stream a response and stop at the first `stop` marker (amplitudes follow the magnitudes)."""
    for k in range(4):
        try:
            with requests.get(url, params=params, headers=UA, timeout=(10, 30), stream=True) as r:
                if r.status_code == 204:
                    return ""
                r.raise_for_status()
                buf = b""
                for chunk in r.iter_content(65536):
                    buf += chunk
                    if stop in buf or len(buf) > max_bytes:
                        break
                return buf.decode("utf-8", errors="replace")
        except requests.RequestException:
            time.sleep(5 * (k + 1))
    raise RuntimeError(f"per-event magnitudes failed: {url} {params}")


def fetch_altmag(rid: str, ids, refresh: bool = False, workers: int = 3) -> dict:
    """Local magnitude for each event id in `ids` (None when the event has none). Cached per event.

    At most `workers` requests run at the same time (the per-event service is slow but light)."""
    from concurrent.futures import ThreadPoolExecutor
    cfg = REGIONS[rid]
    d = RAW / rid / "altmag"
    d.mkdir(parents=True, exist_ok=True)
    pre = cfg.get("altmag_id_prefix", "")

    def one(eid):
        f = d / f"{eid}.json"
        if f.exists() and not refresh:
            return eid, json.loads(f.read_text())
        qid = str(eid)[len(pre):] if pre and str(eid).startswith(pre) else str(eid)
        try:
            xml = _get_prefix(cfg["altmag_url"], {"eventid": qid, **cfg.get("altmag_params", {})}, b"<amplitude ")
        except RuntimeError as e:   # not cached: retried on the next run
            print(f"  {e}", flush=True)
            return eid, []
        mags = parse_magnitudes(xml)
        f.write_text(json.dumps(mags))
        time.sleep(PAUSE_S)
        return eid, mags

    out = {}
    with ThreadPoolExecutor(workers) as ex:
        for k, (eid, mags) in enumerate(ex.map(one, list(ids))):
            out[eid] = pick_local([tuple(x) for x in mags], cfg)
            if k % 100 == 0:
                print(f"  {rid} per-event magnitudes {k}/{len(ids)}", flush=True)
    return out


# ------------------------------------------------------------------------------------------------ driver
def decimal_year(t: pd.Series) -> np.ndarray:
    t = pd.DatetimeIndex(t)
    start = pd.to_datetime(t.year.astype(str) + "-01-01", utc=True)
    end = pd.to_datetime((t.year + 1).astype(str) + "-01-01", utc=True)
    return (t.year + (t - start) / (end - start)).to_numpy(float)


def fetch(rid: str, refresh: bool = False) -> pd.DataFrame:
    cfg = REGIONS[rid]
    frames: list = []
    fn = {"fdsn_text": fdsn_text_chunk, "comcat": comcat_chunk, "imo": imo_window}[cfg["client"]]
    for t0, t1 in month_chunks(cfg["start"], cfg["end"]):
        fn(cfg, t0, t1, refresh, frames)
    df = pd.concat(frames, ignore_index=True)
    df = df.drop_duplicates("id").dropna(subset=["lat", "lon", "mag", "time"]).sort_values("time")
    df["year"] = decimal_year(df["time"])
    df = df.reset_index(drop=True)
    WORK.mkdir(parents=True, exist_ok=True)
    df.to_pickle(WORK / f"{rid}.pkl")
    print(f"{rid}: {len(df)} rows, {df.time.min()} .. {df.time.max()}", flush=True)
    print(df.magtype.value_counts().head(8).to_dict(), flush=True)
    return df


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("regions", nargs="*", default=list(REGIONS))
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    for r in a.regions:
        fetch(r, a.refresh)
