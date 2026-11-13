"""Build the regional layers: site/data/regional/index.json, <id>/cells.geojson, <id>/cells/<h3>.json, <id>/summary.json.

Usage:  python -I scripts/regional/build_regional.py [region ...] [--no-fetch]
A region whose download fails is skipped and its previous output (if any) is kept, so a service outage never
breaks the monthly run. Regional cells are never merged with the global cells (different magnitude scales).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import atlaslib as al  # noqa: E402
import regionlib as rl  # noqa: E402
import seislib as sl  # noqa: E402
from common import jdump  # noqa: E402
from fetch_regional import WORK, fetch  # noqa: E402
from regions import REGIONS  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / "site" / "data" / "regional"
DEPTH_SPLIT = 70.0
NBOOT = 200
RNG = 20261113
MIN_CELL_EVENTS = 3        # a cell is drawn when it holds at least this many events (all depths)
MIN_DETAIL = 50            # a depth class gets a detail block when its circle holds at least this many events

# named places used in the validation (docs/regional.md); Mc is read from the cell that contains the point
CHECKPOINTS = {
    "italy": {"L'Aquila (central Apennines)": (42.35, 13.40), "Norcia (central Apennines)": (42.79, 13.09),
              "Lecce (southern Apulia)": (40.35, 18.17), "Trapani (western Sicily)": (38.02, 12.51),
              "Cagliari (Sardinia)": (39.22, 9.12)},
    "nz": {"Gisborne (northern Hikurangi, onshore)": (-38.66, 178.00),
           "offshore northern Hikurangi": (-38.90, 178.90), "Whataroa (central Alpine Fault)": (-43.26, 170.36),
           "Wellington": (-41.29, 174.78)},
    "socal": {"Los Angeles": (34.05, -118.25), "Ridgecrest": (35.70, -117.55), "Imperial Valley": (32.85, -115.55),
              "offshore Channel Islands": (33.40, -119.80)},
    "iceland": {"Reykjanes Peninsula (Grindavik)": (63.85, -22.43), "Hengill": (64.05, -21.30),
                "South Iceland Seismic Zone": (63.97, -20.60), "Tjornes (Grimsey)": (66.55, -18.00)},
}

R = lambda x, n: None if x is None or not np.isfinite(x) else round(float(x), n)  # noqa: E731


def xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.c_[np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]


def cell_polygon(h, nd=3):
    ring = [[round(lo, nd), round(la, nd)] for la, lo in h3.cell_to_boundary(h)]
    return {"type": "Polygon", "coordinates": [ring + [ring[0]]]}


def fmd_pairs(m):
    if m.size == 0:
        return []
    bins, nc, _ = sl.fmd(m)
    return [[round(float(x), 1), int(y)] for x, y in zip(bins, nc)]


def mc_windows(m, years, y0, y1, nmin=50):
    rows = []
    for a in range(y0, y1 + 1):
        s = m[(years >= a) & (years < a + 1)]
        rows.append([a, a, int(s.size), float(sl.mc_maxc(s, correction=0.2)) if s.size >= nmin else None])
    return rows


def b_cutoff_curve(m, cutoffs):
    rows = []
    for c in cutoffs:
        b, sig, n = sl.b_aki(m, c)
        if n >= 30 and np.isfinite(b):
            rows.append([round(float(c), 1), round(b, 3), round(b - 1.96 * sig, 3), round(b + 1.96 * sig, 3), int(n)])
    return rows


# ------------------------------------------------------------------------------------------------ catalogue
def load_catalogue(cfg):
    """Apply the region's filters. Returns (events with the region's magnitude type, counts dict, other-type rows)."""
    df = pd.read_pickle(WORK / f"{cfg['id']}.pkl")
    w, s, e, n = cfg["bbox"]
    y0, y1 = cfg["periods"][0][0], cfg["periods"][-1][1]
    cnt = {"downloaded": int(len(df))}
    sel = (df.lon >= w) & (df.lon <= e) & (df.lat >= s) & (df.lat <= n) & (df.year >= y0) & (df.year < y1 + 1)
    sel &= df.etype.astype(str).str.lower().str.contains("earthquake")
    if cfg.get("authors"):
        sel &= df.author.isin(cfg["authors"])
    if "status" in df:
        sel &= df.status.astype(str).str.lower().eq("reviewed")
    df = df[sel & df.depth.notna()].copy()
    cnt["after_filters_all_types"] = int(len(df))
    is_t = df.magtype.isin(cfg["magtypes"])
    other = df[~is_t]
    cnt["other_magtype"] = {k: int(v) for k, v in other.magtype.value_counts().items()}
    df = df[is_t].reset_index(drop=True)
    df["mag"] = sl.bin_mag(df.mag.to_numpy())
    cnt["used"] = int(len(df))
    return df, cnt, other


def depth_sets(df, cfg):
    sets = {"sh": df.depth <= DEPTH_SPLIT}
    if cfg["depth_split"]:
        sets["dp"] = df.depth > DEPTH_SPLIT
    return sets


# ------------------------------------------------------------------------------------------------ one region
def build_region(rid):
    cfg = REGIONS[rid]
    periods = cfg["periods"]
    y0, y1 = periods[0][0], periods[-1][1]
    df, cnt, other = load_catalogue(cfg)
    df["per"] = rl.period_index(df.year.to_numpy(), periods)
    df["ms"] = sl.decluster_gk(df.year.to_numpy() * 365.25, df.lat.to_numpy(), df.lon.to_numpy(), df.mag.to_numpy())
    print(f"{rid}: {len(df)} events used, {cnt['other_magtype']} other types; mainshocks {df.ms.mean():.3f}",
          flush=True)
    rng = np.random.default_rng(RNG)
    radius = cfg["radius_km"]
    chord = 2 * np.sin(radius / (2 * 6371.0))

    summary = {"id": rid, "counts": cnt, "floors": {}, "region_b": {}, "generated_utc":
               datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    sets = {}
    for d, dsel in depth_sets(df, cfg).items():
        dd = df[dsel].reset_index(drop=True)
        fl = []
        for k, (a, b) in enumerate(periods):
            f, mx, mbs = rl.regional_floor(dd.mag[dd.per == k].to_numpy())
            fl.append(f)
            summary["floors"].setdefault(d, []).append({"period": [a, b], "n": int((dd.per == k).sum()),
                                                        "floor": f, "maxc02": mx, "mbs": mbs})
        fl = np.array(fl, float)
        thr = fl[dd.per.to_numpy()]
        rb = {"all": rl.b_region(dd.mag.to_numpy(), thr, rng=rng)}
        for k, (a, b) in enumerate(periods):
            s_ = dd.per.to_numpy() == k
            rb[f"{a}-{b}"] = rl.b_region(dd.mag.to_numpy()[s_], thr[s_], rng=rng)
        summary["region_b"][d] = rb
        sets[d] = (dd, fl, cKDTree(xyz(dd.lat.to_numpy(), dd.lon.to_numpy())))
    # sensitivity: region-wide shallow b when events with another preferred magnitude type are included
    if len(other):
        o = other[other.depth <= DEPTH_SPLIT]
        o_per = rl.period_index(o.year.to_numpy(), periods)
        fl = sets["sh"][1]
        m_all = np.r_[sets["sh"][0].mag.to_numpy(), sl.bin_mag(o.mag.to_numpy())]
        t_all = np.r_[fl[sets["sh"][0].per.to_numpy()], fl[o_per]]
        summary["region_b"]["sh_with_other_types"] = rl.b_region(m_all, t_all, rng=rng)
        summary["other_types_above_floor"] = int((sl.bin_mag(o.mag.to_numpy()) >= fl[o_per] - 1e-9).sum())

    df["h3"] = [h3.latlng_to_cell(a, b, cfg["h3_res"]) for a, b in zip(df.lat, df.lon)]
    ncell = df.groupby("h3").size()
    cells = sorted(ncell[ncell >= MIN_CELL_EVENTS].index)
    feats, details = [], {}
    for k, h in enumerate(cells):
        la, lo = h3.cell_to_latlng(h)
        p = xyz(np.array([la]), np.array([lo]))[0]
        props = {"id": h, "lat": round(la, 3), "lon": round(lo, 3), "area_km2": round(h3.cell_area(h, "km^2"), 1),
                 "n": int(ncell[h]), "magtype": cfg["magtypes"][0]}
        det = {"h3": h, "lat": props["lat"], "lon": props["lon"], "radius_km": radius,
               "magtype": cfg["magtype_label"], "periods": periods}
        for d, (dd, fl, tree) in sets.items():
            ii = np.array(sorted(tree.query_ball_point(p, chord)), dtype=int)
            m = dd.mag.to_numpy()[ii]
            per = dd.per.to_numpy()[ii]
            yr = dd.year.to_numpy()[ii]
            r = rl.cell_b_tv(m, per, fl, nboot=NBOOT, rng=rng) if ii.size else {"n_sample": 0,
                                                                                 "quality": "insufficient"}
            rd, rp = {}, {}
            if r.get("n_b", 0) >= al.NMIN_B:
                ms = dd.ms.to_numpy()[ii]
                rd = rl.cell_b_tv(m[ms], per[ms], fl, nboot=100, rng=rng)
                rp = rl.bpos_above_thr(m, rl.thresholds_time_order(r))
            show = r.get("quality") in ("A", "B")
            pre = f"{d}_"
            props.update({pre + "n": int(r.get("n_sample", 0)), pre + "nb": int(r.get("n_b", 0)),
                          pre + "mc": R(r.get("mc", np.nan), 1), pre + "mc_lo": R(r.get("mc_lo", np.nan), 1),
                          pre + "mc_hi": R(r.get("mc_hi", np.nan), 1),
                          pre + "b": R(r.get("b", np.nan), 3), pre + "b_lo": R(r.get("b_lo", np.nan), 3),
                          pre + "b_hi": R(r.get("b_hi", np.nan), 3), pre + "q": r.get("quality", "insufficient"),
                          pre + "ciw": R(r.get("b_hi_raw", np.nan) - r.get("b_lo_raw", np.nan), 3),
                          pre + "unstable": bool(r.get("cutoff_unstable", False))})
            if show:
                props.update({pre + "bpos": R(rp.get("bpos", np.nan), 3),
                              pre + "bpos_lo": R(rp.get("bpos_lo", np.nan), 3),
                              pre + "bpos_hi": R(rp.get("bpos_hi", np.nan), 3),
                              pre + "bdecl": R(rd.get("b_raw", np.nan), 3),
                              pre + "bdecl_lo": R(rd.get("b_lo_raw", np.nan), 3),
                              pre + "bdecl_hi": R(rd.get("b_hi_raw", np.nan), 3)})
            if ii.size >= MIN_DETAIL:
                stats = {kk: v for kk, v in r.items() if not kk.startswith("_") and kk != "thr_sorted_order"}
                thr = rl.thresholds_time_order(r) if "_thr" in r else np.full(m.size, np.nan)
                yy = np.arange(y0, y1 + 1)
                mcs = r.get("mc_periods") or []
                mc_low = min(mcs) if mcs else float(m.min())
                det[d] = {
                    "fmd": fmd_pairs(m),
                    "mc_t": mc_windows(m, yr, y0, y1),
                    "mc_periods": [[a, b, int(n_), R(mc, 1)] for (a, b), n_, mc in
                                   zip(periods, r.get("n_periods", [0] * len(periods)), mcs or [None] * len(periods))],
                    "b_cutoff": b_cutoff_curve(m, np.round(np.arange(mc_low - 0.3, mc_low + 2.05, 0.1), 1)),
                    "rate_years": [int(y0), int(y1)],
                    "rate_above_thr": np.bincount((yr[m >= thr - 1e-9] - y0).astype(int),
                                                  minlength=yy.size)[: yy.size].tolist(),
                    "rate_all": np.bincount((yr - y0).astype(int), minlength=yy.size)[: yy.size].tolist(),
                    "stats": {**stats, "b_decl": rd.get("b_raw"), "b_decl_lo": rd.get("b_lo_raw"),
                              "b_decl_hi": rd.get("b_hi_raw"), "n_decl": rd.get("n_b"), **rp},
                }
        props["detail"] = any(d in det for d in sets)
        if props["detail"]:
            details[h] = det
        props = {kk: v for kk, v in props.items() if v is not None}
        feats.append({"type": "Feature", "geometry": cell_polygon(h), "properties": props})
        if k % 200 == 0:
            print(f"  {rid} {k}/{len(cells)} cells", flush=True)

    rdir = OUT / rid
    cdir = rdir / "cells"
    cdir.mkdir(parents=True, exist_ok=True)
    for f in cdir.glob("*.json"):
        f.unlink()
    for h, det in details.items():
        jdump(det, cdir / f"{h}.json")
    jdump({"type": "FeatureCollection", "features": feats}, rdir / "cells.geojson")

    q = {d: pd.Series([f["properties"].get(f"{d}_q") for f in feats]).value_counts().to_dict() for d in sets}
    est = [f["properties"]["sh_mc"] for f in feats if f["properties"].get("sh_mc") is not None and
           details.get(f["properties"]["id"], {}).get("sh", {}).get("mc_periods", [[0, 0, 0]])[-1][2] >= rl.NMIN_P]
    summary.update({"n_cells": len(feats), "n_detail": len(details), "quality_counts": q,
                    "mc_cells_latest_period": {"n": len(est), "median": R(np.median(est), 1) if est else None,
                                               "p10": R(np.percentile(est, 10), 1) if est else None,
                                               "p90": R(np.percentile(est, 90), 1) if est else None},
                    "checkpoints": checkpoints(rid, cfg, feats)})
    jdump(summary, rdir / "summary.json", indent=1)
    size = sum(f.stat().st_size for f in rdir.rglob("*") if f.is_file())
    summary["bytes"] = size
    print(f"{rid}: {len(feats)} cells, {len(details)} detail files, quality {q}, {size / 1e6:.2f} MB", flush=True)
    return summary


def checkpoints(rid, cfg, feats):
    by = {f["properties"]["id"]: f["properties"] for f in feats}
    out = {}
    for name, (la, lo) in CHECKPOINTS.get(rid, {}).items():
        p = by.get(h3.latlng_to_cell(la, lo, cfg["h3_res"]), {})
        out[name] = {k: p.get(k) for k in ("id", "sh_n", "sh_mc", "sh_mc_lo", "sh_mc_hi", "sh_b", "sh_b_lo",
                                            "sh_b_hi", "sh_q", "sh_ciw")}
    return out


def index_entry(rid, s):
    cfg = REGIONS[rid]
    mc = s["mc_cells_latest_period"]
    return {"id": rid, "name": cfg["name"], "bbox": cfg["bbox"], "catalogue": cfg["catalogue"],
            "licence": cfg["licence"], "attribution": cfg["attribution"], "source_url": cfg["source_url"],
            "period": [cfg["start"], (pd.Timestamp(cfg["end"]) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")],
            "mc_periods": cfg["periods"], "mc_typical": mc["median"], "magtype": cfg["magtype_label"],
            "h3_res": cfg["h3_res"], "radius_km": cfg["radius_km"], "n_events": s["counts"]["used"],
            "n_cells": s["n_cells"], "quality_counts": s["quality_counts"],
            "depth_classes": sorted(s["quality_counts"], key=lambda d: d != "sh"),
            "cells": f"regional/{rid}/cells.geojson", "cell_detail_dir": f"regional/{rid}/cells/",
            "summary": f"regional/{rid}/summary.json", "bytes": s["bytes"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("regions", nargs="*", default=list(REGIONS))
    ap.add_argument("--no-fetch", action="store_true", help="use data/work/regional/<id>.pkl as is")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    idx_path = OUT / "index.json"
    old = {r["id"]: r for r in json.loads(idx_path.read_text())["regions"]} if idx_path.exists() else {}
    failed = []
    for rid in a.regions:
        try:
            if not a.no_fetch or not (WORK / f"{rid}.pkl").exists():
                fetch(rid)
            old[rid] = index_entry(rid, build_region(rid))
        except Exception:  # keep the previous output of this region; never break the whole run
            traceback.print_exc()
            failed.append(rid)
    regions = [old[r] for r in REGIONS if r in old]
    jdump({"note": ("Regional layers use each network's own local magnitude and are never merged with the global "
                    "cells. Not a forecast and not a hazard map."),
           "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "regions": regions,
           "sha256": {r["id"]: hashlib.sha256((OUT / r["id"] / "cells.geojson").read_bytes()).hexdigest()
                      for r in regions}}, idx_path, indent=1)
    if failed:
        print("regional build failed for:", failed, "(previous output kept)")


if __name__ == "__main__":
    main()
