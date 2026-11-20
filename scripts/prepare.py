"""Standardise both catalogues, match them event-to-event, derive the mb -> Mw proxy, tag cells and boundary types.

Inputs : data/processed/iscgem.csv, data/processed/comcat_m45.csv, data/processed/aux/PB2002_steps.json
Outputs: data/work/{iscgem,comcat,matches}.pkl, results/prepare.json

Matching rule (ISC-GEM <-> ComCat, 1973-2021): |dt| <= 30 s and epicentral distance <= 100 km, one-to-one,
closest pair first by the score (dt / 10 s)^2 + (d / 50 km)^2.

mb -> Mw proxy: the slope is fixed to the published global value 0.85 (Scordilis 2006) and only the intercept is taken
from our data: the median of ISC-GEM Mw - 0.85 mb over matched pairs, using only mb bins in which at least 80 % of
ComCat events have an ISC-GEM match (below that, ISC-GEM's own magnitude cut-off truncates the pairs and biases any
fit). A free orthogonal regression on the same narrow range (mb 5.5-6.2) is reported but not used: mb saturates there.
Ms uses Scordilis' bilinear slopes (0.67 / 0.99) the same way. Mw-type magnitudes are used as they are.
"""
from __future__ import annotations

import json
import sys

import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
import seislib as sl  # noqa: E402
from common import (AUX, COMCAT_MINMAG, DEPTH_SPLIT, H3_RES, ISCGEM_LAST_YEAR, MW_TYPES, PROC, RES, WORK,  # noqa: E402
                    decimal_year, jdump)


def standardise(df: pd.DataFrame, src: str) -> pd.DataFrame:
    out = pd.DataFrame({
        "time": pd.to_datetime(df["time"], utc=True, format="ISO8601"),
        "lat": df["latitude"].astype(float), "lon": df["longitude"].astype(float),
        "depth": df["depth"].astype(float), "mag": df["mag"].astype(float),
        "magtype": df["magType"].astype(str).str.lower(), "net": df["net"].astype(str), "id": df["id"].astype(str),
        "magsrc": df["magSource"].astype(str).str.lower(), "herr": df["horizontalError"], "derr": df["depthError"],
        "magerr": df["magError"],
    })
    out = out.sort_values("time").reset_index(drop=True)
    out["t"] = decimal_year(out["time"])
    out["year"] = out["time"].dt.year
    out["deep"] = out["depth"] > DEPTH_SPLIT
    out["src"] = src
    return out


def match(g: pd.DataFrame, c: pd.DataFrame, dt_max=30.0, d_max=100.0):
    ep = pd.Timestamp("1970-01-01", tz="UTC")
    gs = (g["time"] - ep).dt.total_seconds().to_numpy()
    cs = (c["time"] - ep).dt.total_seconds().to_numpy()
    pairs = []
    for i in range(len(g)):
        lo, hi = np.searchsorted(cs, gs[i] - dt_max), np.searchsorted(cs, gs[i] + dt_max, "right")
        if lo == hi:
            continue
        j = np.arange(lo, hi)
        d = sl.haversine_km(g["lat"].iat[i], g["lon"].iat[i], c["lat"].to_numpy()[j], c["lon"].to_numpy()[j])
        dt = np.abs(cs[j] - gs[i])
        ok = d <= d_max
        for jj, dd, tt in zip(j[ok], d[ok], dt[ok]):
            pairs.append((i, jj, dd, tt, (tt / 10) ** 2 + (dd / 50) ** 2))
    p = pd.DataFrame(pairs, columns=["gi", "ci", "dist_km", "dt_s", "score"]).sort_values("score")
    used_g, used_c, keep = set(), set(), []
    for r in p.itertuples():
        if r.gi in used_g or r.ci in used_c:
            continue
        used_g.add(r.gi); used_c.add(r.ci); keep.append(r.Index)
    return p.loc[keep].reset_index(drop=True), len(p)


def gor(x, y, eta=1.0):
    """General orthogonal regression y = a + b x with error-variance ratio eta = var(ey)/var(ex)."""
    sx, sy = np.var(x, ddof=1), np.var(y, ddof=1)
    sxy = np.cov(x, y, ddof=1)[0, 1]
    b = (sy - eta * sx + np.sqrt((sy - eta * sx) ** 2 + 4 * eta * sxy ** 2)) / (2 * sxy)
    return float(np.mean(y) - b * np.mean(x)), float(b)


def boundary_class(lat, lon, steps, max_km=200.0):
    """Nearest PB2002 step (Bird 2003) to each epicentre; 'none' beyond max_km. Returns class, distance, age."""
    def xyz(la, lo):
        la, lo = np.radians(la), np.radians(lo)
        return np.c_[np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]
    tree = cKDTree(xyz(steps["lat"].to_numpy(), steps["lon"].to_numpy()))
    chord, idx = tree.query(xyz(lat, lon))
    d = 2 * 6371.0 * np.arcsin(np.clip(chord / 2, 0, 1))
    cls = steps["cls"].to_numpy()[idx].astype(object)
    cls[d > max_km] = "none"
    return cls, d, steps["age"].to_numpy()[idx], steps["vel"].to_numpy()[idx]


def main():
    g = standardise(pd.read_csv(PROC / "iscgem.csv", low_memory=False), "iscgem")
    c = standardise(pd.read_csv(PROC / "comcat_m45.csv", low_memory=False), "comcat")
    late = g[g.year > ISCGEM_LAST_YEAR]
    if len(late):   # a newer ISC-GEM release: every ISC-GEM period ends at iscgem_last_year, so stop instead of cutting
        raise SystemExit(f"ISC-GEM holds {len(late)} events after {ISCGEM_LAST_YEAR} (to {g.time.max()}): set "
                         "iscgem_last_year in scripts/release.json to its last complete year")
    info = {"iscgem_n": len(g), "comcat_n": len(c), "iscgem_span": [str(g.time.min()), str(g.time.max())],
            "comcat_span": [str(c.time.min()), str(c.time.max())]}
    below = c.mag < COMCAT_MINMAG - 1e-9      # the query is M >= 4.5, but ComCat has served smaller events
    c = c[~below].reset_index(drop=True)
    info["comcat_dropped_below_minmag"] = {"n": int(below.sum()), "minmag": COMCAT_MINMAG}
    c = c[np.isfinite(c["depth"])].reset_index(drop=True)
    info["comcat_dropped_no_depth"] = info["comcat_n"] - len(c)

    # ------------------------------------------------------------------ matching
    gm = g[(g.time >= c.time.min()) & (g.time <= c.time.max())].reset_index()
    pairs, n_cand = match(gm, c)
    pairs["g_index"] = gm["index"].to_numpy()[pairs.gi]
    pairs["c_index"] = pairs.ci
    m = pairs[["g_index", "c_index", "dist_km", "dt_s"]].copy()
    m["mw_g"] = g["mag"].to_numpy()[m.g_index]
    m["mag_c"] = c["mag"].to_numpy()[m.c_index]
    m["type_c"] = c["magtype"].to_numpy()[m.c_index]
    m["ddepth"] = c["depth"].to_numpy()[m.c_index] - g["depth"].to_numpy()[m.g_index]
    g["match"] = -1
    g.loc[m.g_index, "match"] = m.c_index.to_numpy()
    c["match"] = -1
    c.loc[m.c_index, "match"] = m.g_index.to_numpy()
    info["matching"] = {"candidate_pairs": n_cand, "matched": len(m), "iscgem_in_overlap": len(gm),
                        "iscgem_unmatched": int(len(gm) - len(m)),
                        "dist_km_median": float(m.dist_km.median()), "dist_km_p90": float(m.dist_km.quantile(.9)),
                        "dt_s_median": float(m.dt_s.median()), "dt_s_p90": float(m.dt_s.quantile(.9))}

    # ------------------------------------------------------------------ mb -> Mw proxy
    def covered_bins(types):
        cov = c[(c.year <= ISCGEM_LAST_YEAR) & c.magtype.isin(types)].copy()
        cov["b"] = sl.bin_mag(cov["mag"])
        frac = cov.groupby("b")["match"].apply(lambda s: (s >= 0).mean())
        cnt = cov.groupby("b").size()
        return frac, cnt, frac[(frac >= 0.8) & (cnt >= 30)].index.to_numpy()

    def intercept(types, slope, lo, hi):
        """Median of Mw(ISC-GEM) - slope * m over matched pairs in covered bins within [lo, hi]."""
        pm = m[m.type_c.isin(types)]
        mb_ = sl.bin_mag(pm.mag_c)
        pm = pm[(mb_ >= lo - 1e-9) & (mb_ <= hi + 1e-9)]
        r = pm.mw_g - slope * pm.mag_c
        return float(r.median()), len(pm), float(r.std()), pm

    # mb: published slope 0.85 (Scordilis 2006, global ISC/NEIC mb, mb <= 6.2); intercept from our matched pairs
    frac, cnt, good = covered_bins(["mb"])
    mb_lo = float(good.min())
    a, n_mb, sd_mb, pm = intercept(["mb"], 0.85, mb_lo, 6.2)
    a_free, b_free = gor(pm.mag_c.to_numpy(), pm.mw_g.to_numpy())
    mw_pairs = m[m.type_c.isin(MW_TYPES)]
    info["mb_to_mw"] = {"slope": 0.85, "slope_source": "Scordilis (2006)", "intercept": a, "mb_range_used": [mb_lo, 6.2],
                        "n_pairs": n_mb, "resid_sd": sd_mb, "free_gor_on_same_pairs": {"a": a_free, "b": b_free},
                        "match_fraction_by_mb": {f"{k:.1f}": round(float(v), 3) for k, v in frac.items() if cnt[k] >= 30},
                        "mw_type_minus_iscgem_median": float((mw_pairs.mag_c - mw_pairs.mw_g).median()),
                        "mw_type_minus_iscgem_mad": float((mw_pairs.mag_c - mw_pairs.mw_g).abs().median()),
                        "mw_type_pairs": len(mw_pairs)}
    # Ms: published bilinear slopes 0.67 (Ms <= 6.1) and 0.99 (Ms >= 6.2) (Scordilis 2006); intercepts from pairs
    frac_s, cnt_s, good_s = covered_bins(["ms"])
    ms_lo = float(good_s.min()) if good_s.size else 6.2
    a_s1, n_s1, _, _ = intercept(["ms"], 0.67, ms_lo, 6.1)
    a_s2, n_s2, _, _ = intercept(["ms"], 0.99, max(ms_lo, 6.2), 8.2)
    info["ms_to_mw"] = {"low": {"slope": 0.67, "intercept": a_s1, "n_pairs": n_s1, "range": [ms_lo, 6.1]},
                        "high": {"slope": 0.99, "intercept": a_s2, "n_pairs": n_s2, "range": [max(ms_lo, 6.2), 8.2]}}
    if not np.isfinite(a_s1) or n_s1 < 30:  # no covered low-Ms pairs: keep continuity with the high branch at 6.15
        a_s1 = a_s2 + 0.99 * 6.15 - 0.67 * 6.15
        info["ms_to_mw"]["low"]["intercept_rule"] = "continuity with high branch at Ms 6.15"
    info["ms_to_mw"]["low"]["intercept"] = a_s1
    c["mw_proxy"] = c["mag"]
    c["proxy_rule"] = "native"
    is_mb = c.magtype.isin(["mb", "mb_lg", "mblg"])
    c.loc[is_mb, "mw_proxy"] = a + 0.85 * c.loc[is_mb, "mag"]
    c.loc[is_mb, "proxy_rule"] = "mb"
    is_ms = c.magtype.isin(["ms", "ms_20", "msz"])
    c.loc[is_ms, "mw_proxy"] = np.where(c.loc[is_ms, "mag"] <= 6.15, a_s1 + 0.67 * c.loc[is_ms, "mag"],
                                        a_s2 + 0.99 * c.loc[is_ms, "mag"])
    c.loc[is_ms, "proxy_rule"] = "ms"
    c.loc[c.magtype.isin(MW_TYPES), "proxy_rule"] = "mw"
    info["proxy_rule_counts"] = c.proxy_rule.value_counts().to_dict()

    # ------------------------------------------------------------------ cells, boundary class, declustering
    st = json.loads((AUX / "PB2002_steps.json").read_text())["features"]
    steps = pd.DataFrame([{"lat": (f["properties"]["STARTLAT"] + f["properties"]["FINALLAT"]) / 2,
                           "lon": (f["properties"]["STARTLONG"] + f["properties"]["FINALLONG"]) / 2,
                           "cls": f["properties"]["STEPCLASS"], "age": f["properties"]["SEAFLOORAG"],
                           "vel": f["properties"]["VELOCITYLE"]} for f in st])
    for d in (g, c):
        d["h3"] = [h3.latlng_to_cell(la, lo, H3_RES) for la, lo in zip(d.lat, d.lon)]
        cls, dist, age, vel = boundary_class(d.lat.to_numpy(), d.lon.to_numpy(), steps)
        d["pb_class"], d["pb_dist_km"], d["pb_age"], d["pb_vel"] = cls, dist, age, vel
        dd = ((d.time - pd.Timestamp("1900-01-01", tz="UTC")).dt.total_seconds() / 86400).to_numpy()
        mags = d["mag"].to_numpy() if d.src.iat[0] == "iscgem" else d["mw_proxy"].to_numpy()
        d["mainshock"] = sl.decluster_gk(dd, d.lat.to_numpy(), d.lon.to_numpy(), mags)
    info["declustering"] = {s: {"n": int(len(d)), "mainshocks": int(d.mainshock.sum())} for s, d in
                            (("iscgem", g), ("comcat", c))}
    info["pb_class_counts_iscgem_shallow"] = g[~g.deep].pb_class.value_counts().to_dict()

    g.to_pickle(WORK / "iscgem.pkl")
    c.to_pickle(WORK / "comcat.pkl")
    m.to_pickle(WORK / "matches.pkl")
    jdump(info, RES / "prepare.json", indent=1)
    print(json.dumps({k: v for k, v in info.items() if k != "mb_to_mw"}, indent=1, default=str))
    print("mb_to_mw:", {k: v for k, v in info["mb_to_mw"].items() if k != "match_fraction_by_mb"})
    print("match fraction by mb:", info["mb_to_mw"]["match_fraction_by_mb"])


if __name__ == "__main__":
    main()
