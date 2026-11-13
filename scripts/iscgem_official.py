"""Optional reader for the official ISC-GEM catalogue CSV (isc.ac.uk/iscgem), as an alternative to the ComCat mirror.

The official file is handed out only through a personal request form, so it is never downloaded by this pipeline.
When a copy is placed at data/raw/iscgem_official/isc-gem-cat.csv, scripts/fetch.py uses it instead of the ComCat
mirror (catalog=iscgem) and writes data/processed/iscgem.csv in the same column layout as the mirror.

Expected layout (main catalogue file, not the supplementary one): comment lines starting with '#', the last of which
holds the comma-separated column names; data rows are comma-separated with space padding. Columns are found by
name, not by position. Required: date, lat, lon, depth, mw, eventid. Optional: smajax, unc (the first 'unc' after
'depth' is the depth uncertainty, the first after 'mw' the Mw uncertainty). A file that lacks a required column is
rejected with an error instead of being guessed at. The file is untrusted data: it is parsed as text only.

Ids are written as 'iscgem<eventid>', the form ComCat uses for its ISC-GEM mirror, so events keep their USGS links.
"""
from __future__ import annotations

import hashlib
import io
from pathlib import Path

import pandas as pd

REQUIRED = ("date", "lat", "lon", "depth", "mw", "eventid")
DEFAULT_PATH = Path(__file__).resolve().parents[1] / "data" / "raw" / "iscgem_official" / "isc-gem-cat.csv"


class FormatError(ValueError):
    pass


def _header(lines: list[str]) -> tuple[list[str], int]:
    """Column names from the last comment line before the data, and the index of the first data line."""
    last, first_data = None, None
    for i, ln in enumerate(lines):
        s = ln.strip()
        if not s:
            continue
        if s.startswith("#"):
            last = s.lstrip("#")
            continue
        first_data = i
        break
    if last is None or first_data is None:
        raise FormatError("no '#' header line followed by data rows")
    names = [c.strip().lower() for c in last.split(",")]
    for req in REQUIRED:
        if req not in names:
            raise FormatError(f"required column '{req}' not found in header {names}")
    return names, first_data


def _after(names: list[str], key: str, anchor: str) -> int | None:
    """Index of the first column called `key` that follows column `anchor`."""
    if anchor not in names:
        return None
    for j in range(names.index(anchor) + 1, len(names)):
        if names[j] == key:
            return j
    return None


def parse(text: str) -> pd.DataFrame:
    """Parse the official ISC-GEM CSV text into the ComCat-mirror column layout used by scripts/prepare.py."""
    lines = text.splitlines()
    names, i0 = _header(lines)
    body = "\n".join(ln for ln in lines[i0:] if ln.strip() and not ln.lstrip().startswith("#"))
    raw = pd.read_csv(io.StringIO(body), header=None, dtype=str, skipinitialspace=True)
    if raw.shape[1] < len(names):
        raise FormatError(f"{raw.shape[1]} data columns but {len(names)} header names")
    raw = raw.iloc[:, : len(names)].apply(lambda s: s.str.strip())

    def col(name, idx=None):
        j = names.index(name) if idx is None else idx
        return raw.iloc[:, j]

    def num(s):
        return pd.to_numeric(s.replace("", None), errors="coerce")

    t = pd.to_datetime(col("date"), utc=True, format="ISO8601", errors="coerce")
    if t.isna().any():
        bad = col("date")[t.isna()].head(3).tolist()
        raise FormatError(f"{int(t.isna().sum())} unparsable dates, e.g. {bad}")
    mw = num(col("mw"))
    eid = col("eventid")
    if eid.isna().any() or not eid.str.fullmatch(r"\d+").all():
        raise FormatError("eventid must be a positive integer on every row")
    ju, mu, sj = _after(names, "unc", "depth"), _after(names, "unc", "mw"), (
        names.index("smajax") if "smajax" in names else None)
    n = len(raw)
    out = pd.DataFrame({
        "time": t.dt.strftime("%Y-%m-%dT%H:%M:%S.%f").str[:-3] + "Z",
        "latitude": num(col("lat")), "longitude": num(col("lon")), "depth": num(col("depth")),
        "mag": mw, "magType": "mw", "net": "iscgem", "id": "iscgem" + eid,
        "place": "", "status": "reviewed",
        "horizontalError": num(col("smajax")) if sj is not None else [float("nan")] * n,
        "depthError": num(col("unc", ju)) if ju is not None else [float("nan")] * n,
        "magError": num(col("unc", mu)) if mu is not None else [float("nan")] * n,
        "magSource": "iscgem", "locationSource": "iscgem", "updated": "",
    })
    bad = out[["latitude", "longitude", "depth", "mag"]].isna().any(axis=1)
    if bad.any():
        raise FormatError(f"{int(bad.sum())} rows with missing lat/lon/depth/mw")
    if out["id"].duplicated().any():
        raise FormatError("duplicate eventid values")
    return out.sort_values("time").reset_index(drop=True)


def load(path: Path = DEFAULT_PATH) -> tuple[pd.DataFrame, dict]:
    """Parse the official file at `path`; return the frame and provenance (file name, bytes, sha256, span)."""
    b = path.read_bytes()
    df = parse(b.decode("utf-8", errors="strict"))
    info = {"source": "official", "file": path.name, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
            "n": len(df), "span": [df["time"].iloc[0], df["time"].iloc[-1]]}
    return df, info
