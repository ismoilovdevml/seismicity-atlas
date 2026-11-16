"""Read an earthquake catalogue from CSV (or a pandas DataFrame) into the columns the estimators need.

Recognised column names (case-insensitive; the first match wins):

    magnitude  mag, magnitude, mw, ml, m
    time       time, datetime, origin_time, origintime, date_time, or date + time
    latitude   latitude, lat
    longitude  longitude, lon, long, lng
    depth      depth, depth_km, dep
    mag type   magtype, mag_type, magnitude_type, type

Only the magnitude is required. USGS ComCat, EMSC and ISC CSV exports and most national-network exports use
these names. Rows without a magnitude, or with a magnitude outside -3..10, are dropped and counted.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

ALIASES = {
    "mag": ("mag", "magnitude", "mw", "ml", "m"),
    "time": ("time", "datetime", "origin_time", "origintime", "date_time"),
    "latitude": ("latitude", "lat"),
    "longitude": ("longitude", "lon", "long", "lng"),
    "depth": ("depth", "depth_km", "dep"),
    "magtype": ("magtype", "mag_type", "magnitude_type", "type"),
}
MAG_RANGE = (-3.0, 10.0)


@dataclass
class Catalog:
    """Events with standard column names: mag (always), and time, latitude, longitude, depth, magtype if present."""

    events: pd.DataFrame
    source: str = ""
    dropped: dict = field(default_factory=dict)
    columns_used: dict = field(default_factory=dict)

    def __len__(self) -> int:
        return len(self.events)

    @property
    def has_time(self) -> bool:
        return "time" in self.events and self.events["time"].notna().any()

    @property
    def has_location(self) -> bool:
        return "latitude" in self.events and "longitude" in self.events


def _pick(cols: dict, names) -> str | None:
    for n in names:
        if n in cols:
            return cols[n]
    return None


def read_catalog(src, *, mag_type: str | None = None) -> Catalog:
    """Read a CSV path or a DataFrame. `mag_type` keeps only events of that magnitude type (needs a type column)."""
    if isinstance(src, pd.DataFrame):
        raw, name = src.copy(), "DataFrame"
    else:
        path = Path(src)
        raw = pd.read_csv(path, sep=None, engine="python", comment="#")
        name = path.name
    cols = {str(c).strip().lower(): c for c in raw.columns}
    used = {}
    for std, names in ALIASES.items():
        c = _pick(cols, names)
        if c is not None:
            used[std] = c
    if "mag" not in used:
        raise ValueError(f"no magnitude column found; expected one of {ALIASES['mag']}, got {list(raw.columns)}")
    ev = pd.DataFrame({std: raw[c] for std, c in used.items()})
    if "time" not in used and "date" in cols and "time" in cols:
        used["time"] = f"{cols['date']} + {cols['time']}"
        ev["time"] = raw[cols["date"]].astype(str) + " " + raw[cols["time"]].astype(str)
    dropped = {}
    ev["mag"] = pd.to_numeric(ev["mag"], errors="coerce")
    bad = ev["mag"].isna() | (ev["mag"] < MAG_RANGE[0]) | (ev["mag"] > MAG_RANGE[1])
    if bad.any():
        dropped["missing_or_out_of_range_magnitude"] = int(bad.sum())
        ev = ev[~bad]
    for c in ("latitude", "longitude", "depth"):
        if c in ev:
            ev[c] = pd.to_numeric(ev[c], errors="coerce")
    if "time" in ev:
        t = pd.to_datetime(ev["time"], errors="coerce", utc=True, format="mixed")
        if t.isna().all():
            ev = ev.drop(columns="time")
        else:
            if t.isna().any():
                dropped["unparsed_time_kept_without_time"] = int(t.isna().sum())
            ev["time"] = t.dt.tz_localize(None)
    if "magtype" in ev:
        ev["magtype"] = ev["magtype"].astype(str).str.strip().str.lower()
        if mag_type is not None:
            keep = ev["magtype"] == mag_type.strip().lower()
            dropped["other_magnitude_types"] = int((~keep).sum())
            ev = ev[keep]
    elif mag_type is not None:
        raise ValueError("mag_type given but the catalogue has no magnitude-type column")
    if "time" in ev:
        ev = ev.sort_values("time", kind="stable")
    return Catalog(events=ev.reset_index(drop=True), source=name, dropped=dropped, columns_used=used)


def select(cat: Catalog, *, lat: float | None = None, lon: float | None = None, radius_km: float | None = None,
           depth_min: float | None = None, depth_max: float | None = None, start=None, end=None) -> Catalog:
    """Events within radius_km of (lat, lon), in a depth range and a time window. Unset limits are not applied."""
    from .seislib import haversine_km

    ev = cat.events
    keep = np.ones(len(ev), bool)
    if radius_km is not None:
        if lat is None or lon is None or not cat.has_location:
            raise ValueError("radius_km needs lat, lon and a catalogue with latitude and longitude")
        keep &= haversine_km(lat, lon, ev["latitude"].to_numpy(), ev["longitude"].to_numpy()) <= radius_km
    if depth_min is not None or depth_max is not None:
        if "depth" not in ev:
            raise ValueError("a depth limit needs a depth column")
        d = ev["depth"].to_numpy()
        if depth_min is not None:
            keep &= d >= depth_min
        if depth_max is not None:
            keep &= d <= depth_max
    if start is not None or end is not None:
        if not cat.has_time:
            raise ValueError("a time window needs a time column")
        t = ev["time"]
        if start is not None:
            keep &= (t >= pd.Timestamp(start)).to_numpy()
        if end is not None:
            keep &= (t < pd.Timestamp(end)).to_numpy()
    return Catalog(events=ev[keep].reset_index(drop=True), source=cat.source, dropped=dict(cat.dropped),
                   columns_used=dict(cat.columns_used))
