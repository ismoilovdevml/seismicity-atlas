"""Helpers for the induced-seismicity case studies. Estimators are imported from the atlas (seislib, atlaslib).

Nothing here downloads data; every function takes plain arrays so it can be unit-tested on synthetic catalogues.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402

DM = 0.1
RD_EPSG = 28992        # Amersfoort / RD New, the coordinate system of the Groningen literature (metres)


# ------------------------------------------------------------------------------------------------ geometry
def to_rd(lon, lat):
    """WGS84 lon/lat (degrees) -> RD New x, y (metres)."""
    from pyproj import Transformer
    tr = Transformer.from_crs(4326, RD_EPSG, always_xy=True)
    x, y = tr.transform(np.asarray(lon, float), np.asarray(lat, float))
    return np.asarray(x), np.asarray(y)


def from_rd(x, y):
    from pyproj import Transformer
    tr = Transformer.from_crs(RD_EPSG, 4326, always_xy=True)
    lon, lat = tr.transform(np.asarray(x, float), np.asarray(y, float))
    return np.asarray(lon), np.asarray(lat)


def outline_rd(geojson: dict):
    """Field outline (GeoJSON Polygon/MultiPolygon, WGS84) -> shapely geometry in RD metres."""
    from shapely.geometry import shape
    from shapely.ops import transform
    from pyproj import Transformer
    tr = Transformer.from_crs(4326, RD_EPSG, always_xy=True)
    g = shape(geojson["features"][0]["geometry"] if "features" in geojson else geojson)
    return transform(lambda x, y, z=None: tr.transform(x, y), g)


def inside(geom_rd, x, y, buffer_m: float = 0.0) -> np.ndarray:
    """True for points inside the (optionally buffered) outline. Holes in the outline are honoured."""
    import shapely
    g = geom_rd.buffer(buffer_m) if buffer_m else geom_rd
    return np.asarray(shapely.contains_xy(g, np.asarray(x, float), np.asarray(y, float)))


# ------------------------------------------------------------------------------------------------ rates
def monthly_counts(times: pd.Series, mags, thr: float, months: pd.PeriodIndex) -> np.ndarray:
    """Number of events with binned magnitude >= thr in every calendar month of `months`."""
    m = sl.bin_mag(mags, DM)
    sel = m >= thr - 1e-9
    per = pd.DatetimeIndex(times[sel]).tz_localize(None).to_period("M")
    c = pd.Series(1, index=per).groupby(level=0).sum()
    return c.reindex(months, fill_value=0).to_numpy(int)


def annual_mc(years, mags, year_bins, nmin: int = 30):
    """MAXC + 0.2 (atlas Mc rule) of the events in each [y0, y1) bin; NaN with fewer than nmin events."""
    out = []
    for y0, y1 in year_bins:
        mm = sl.bin_mag(np.asarray(mags)[(years >= y0) & (years < y1)], DM)
        out.append(float(sl.mc_maxc(mm, DM, 0.2)) if mm.size >= nmin else np.nan)
    return np.array(out)


# ------------------------------------------------------------------------------------------------ b-values
def b_fixed(m, mc: float, nboot: int = al.NBOOT, rng=None) -> dict:
    """b (seislib.b_aki) at a fixed completeness (binned magnitudes >= mc), 95 % percentile bootstrap interval,
    plus the Shi-Bolt standard error. Used where the literature fixes Mc (e.g. ML 1.5 at Groningen)."""
    rng = np.random.default_rng(rng)
    m = sl.bin_mag(m, DM)
    m = m[m >= mc - 1e-9]
    n = m.size
    if n < 10:
        return {"mc": mc, "n": int(n), "b": np.nan, "lo": np.nan, "hi": np.nan, "sigma_shibolt": np.nan}
    b, sig, _, _ = sl.b_aki(m, mc, DM)
    mm = m[rng.integers(0, n, (nboot, n))]
    bb = sl.b_from_excess(mm.mean(axis=1) - sl.bin_mag(mc, DM), DM)
    lo, hi = np.percentile(bb, [2.5, 97.5])
    return {"mc": mc, "n": int(n), "b": float(b), "lo": float(lo), "hi": float(hi), "sigma_shibolt": float(sig)}


def moving_bpos(t_years, m, floor: float, window: int = 200, step: int = 10, nboot: int = al.NBOOT, rng=None):
    """b-positive in moving windows of `window` consecutive events (above `floor`), time = last event of the
    window (Tormann et al. 2013 convention), with a bootstrap 95 % interval over the window's differences."""
    rng = np.random.default_rng(rng)
    m = sl.bin_mag(m, DM)
    keep = m >= floor - 1e-9
    t, m = np.asarray(t_years)[keep], m[keep]
    rows = []
    for e in range(window, m.size + 1, step):
        w = m[e - window:e]
        d = sl.bin_mag(np.diff(w), DM)
        d = d[d >= 0.2 - DM / 2 + 1e-9]
        if d.size < al.NMIN_B:
            continue
        b = sl.b_from_excess(d.mean() - 0.2, DM)
        dd = d[rng.integers(0, d.size, (nboot, d.size))]
        bb = sl.b_from_excess(dd.mean(axis=1) - 0.2, DM)
        lo, hi = np.percentile(bb, [2.5, 97.5])
        rows.append((float(t[e - window]), float(t[e - 1]), float(b), float(lo), float(hi), int(d.size)))
    return pd.DataFrame(rows, columns=["t0", "t", "b", "lo", "hi", "n_diff"])


def grid_nodes(geom_rd, spacing_m: float = 1000.0, buffer_m: float = 0.0):
    """Regular RD grid nodes inside the (buffered) outline."""
    x0, y0, x1, y1 = (geom_rd.buffer(buffer_m) if buffer_m else geom_rd).bounds
    gx = np.arange(np.floor(x0 / spacing_m) * spacing_m, x1 + spacing_m, spacing_m)
    gy = np.arange(np.floor(y0 / spacing_m) * spacing_m, y1 + spacing_m, spacing_m)
    X, Y = np.meshgrid(gx, gy)
    X, Y = X.ravel(), Y.ravel()
    ok = inside(geom_rd, X, Y, buffer_m)
    return X[ok], Y[ok]


def b_map(nx, ny, ex, ey, em, floor, bpos_floor: float, radius_m: float = 5000.0, nboot: int = al.NBOOT, rng=0):
    """Per node: atlas cell_b (MAXC+0.2 with a per-event floor, bootstrap CI, A/B/C quality) and atlas
    cell_bpos (b-positive, at least 50 positive differences, as in Gulia & Wiemer 2026) of the events within
    radius_m. ex, ey, em, floor are aligned arrays of the events ORDERED IN TIME (b-positive needs the order)."""
    rng = np.random.default_rng(rng)
    rows = []
    for x, y in zip(nx, ny):
        sel = (ex - x) ** 2 + (ey - y) ** 2 <= radius_m ** 2
        r = al.cell_b(em[sel], floor[sel], nboot=nboot, rng=rng)
        p = al.cell_bpos(em[sel], bpos_floor)
        rows.append({"x": float(x), "y": float(y), "n": int(sel.sum()), "mc": r.get("mc", np.nan),
                     "n_b": r.get("n_b", 0), "b": r.get("b", np.nan), "b_lo": r.get("b_lo", np.nan),
                     "b_hi": r.get("b_hi", np.nan), "q": r["quality"], "bpos": p["bpos"], "bpos_lo": p["bpos_lo"],
                     "bpos_hi": p["bpos_hi"], "n_bpos": p["n_bpos"]})
    return pd.DataFrame(rows)
