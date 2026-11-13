"""Build the per-cell atlas: Mc, b (bootstrap CI + quality), b-positive, declustered b, rates, Mc(t), consistency.

Spatial unit : H3 resolution-2 cells (display and counting) with a fixed 300 km sampling circle around each cell
               centre for the statistics (Mc, b), so every estimate has the same spatial support.
b catalogue  : ISC-GEM Mw, 1976-2021 (the GCMT era: mostly direct Mw), shallow (<= 70 km) and deeper separately.
Thresholds   : per event, max(cell MAXC+0.2, global floor of its period). Floors are estimated from the global
               ISC-GEM data per depth class as max(MAXC+0.2, MBS) for 1976-2003 and 2004-2021.
Outputs      : data/work/cells.pkl, results/atlas_globals.json, site/data/cells/<h3>.json (per-cell detail)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402
from common import CUTOFF_YEAR, H3_RES, RES, SAMPLE_R_KM, SITE, WORK, jdump, load_work  # noqa: E402

PERIODS = [(1976, 2003), (2004, 2021)]
Y0, Y1 = 1976, 2021
NBOOT = 200
RNG = 20261113


def xyz(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.c_[np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]


def global_floors(g):
    fl = {}
    for dname, sel in (("sh", ~g.deep), ("dp", g.deep)):
        fl[dname] = {}
        for a, b in PERIODS:
            m = g[sel & (g.year >= a) & (g.year <= b)].mag.to_numpy()
            mx = sl.mc_maxc(m, correction=0.2)
            mbs = sl.mc_mbs(m)
            gft = sl.mc_gft(m)[0]
            fl[dname][f"{a}-{b}"] = {"n": int(m.size), "maxc02": mx, "mbs": mbs, "gft": gft,
                                     "floor": float(max(mx, mbs if np.isfinite(mbs) else mx))}
    return fl


def floor_of(year, fl):
    out = np.full(year.shape, np.nan)
    for (a, b) in PERIODS:
        out[(year >= a) & (year <= b)] = fl[f"{a}-{b}"]["floor"]
    return out


def mc_windows(m, years, y0, y1, step, nmin=50):
    rows = []
    for a in range(y0, y1 + 1, step):
        s = m[(years >= a) & (years < a + step)]
        rows.append([a, min(a + step - 1, y1), int(s.size), float(sl.mc_maxc(s, correction=0.2)) if s.size >= nmin
                     else None])
    return rows


def fmd_pairs(m):
    if m.size == 0:
        return []
    bins, nc, _ = sl.fmd(m)
    return [[round(float(x), 1), int(y)] for x, y in zip(bins, nc)]


def b_cutoff_curve(m, floor, mc_list):
    rows = []
    for mc in mc_list:
        thr = np.maximum(mc, floor)
        b, sig, n = sl.b_varmc(m, thr)
        if n >= 30 and np.isfinite(b):
            rows.append([round(mc, 1), round(b, 3), round(b - 1.96 * sig, 3), round(b + 1.96 * sig, 3), int(n)])
    return rows


def yearly_counts(years, y0, y1, cover=None):
    """Counts per calendar year y0..y1 (inclusive). Years outside cover = (a, b) are None: no data, not zero."""
    yy = np.arange(y0, y1 + 1)
    years = np.asarray(years, dtype=int)
    n = np.bincount(years[(years >= y0) & (years <= y1)] - y0, minlength=yy.size).tolist()
    if cover is not None:
        n = [v if cover[0] <= y <= cover[1] else None for y, v in zip(yy, n)]
    return n


def main(radius=SAMPLE_R_KM):
    sens = radius != SAMPLE_R_KM
    g = load_work("iscgem")
    c = load_work("comcat")
    mt = load_work("matches")
    fl = global_floors(g)
    print(json.dumps(fl, indent=1))

    cells = sorted(set(g.h3) | set(c.h3))
    cen = np.array([h3.cell_to_latlng(h) for h in cells])
    chord = 2 * np.sin(radius / (2 * 6371.0))
    rows, details = [], {}
    rng = np.random.default_rng(RNG)

    # rate / membership counts (cell, not circle)
    area = {h: h3.cell_area(h, "km^2") for h in cells}
    g64 = g[(g.year >= 1964) & (g.year <= 2021)]
    n_m6 = g64[g64.mag >= 5.95].groupby("h3").size()
    n_g = g.groupby("h3").size()
    n_c = c.groupby("h3").size()
    pb = g[~g.deep].groupby("h3")["pb_class"].agg(lambda s: s.value_counts().index[0])

    # consistency, cell membership of the ISC-GEM event, 1973-2021
    gi = g.iloc[mt.g_index.to_numpy()]
    mt = mt.assign(h3=gi.h3.to_numpy())
    cons = mt.groupby("h3").agg(cons_n_matched=("dist_km", "size"), cons_dloc_km=("dist_km", "median"),
                                cons_ddepth_km=("ddepth", "median"))
    mtw = mt[mt.type_c.isin({"mww", "mwc", "mwb", "mwr", "mw"})]
    cons["cons_dmag_mw"] = (mtw.mag_c - mtw.mw_g).groupby(mtw.h3).median()
    cons["cons_n_mw"] = mtw.groupby("h3").size()
    mtb = mt[mt.type_c == "mb"]
    cons["cons_dmag_mb"] = (mtb.mag_c - mtb.mw_g).groupby(mtb.h3).median()
    cons["cons_n_mb"] = mtb.groupby("h3").size()
    ov = (g.time >= c.time.min()) & (g.year <= 2021)
    cons_g_only = g[ov & (g.match < 0)].groupby("h3").size()
    cons_c_only = c[(c.year <= 2021) & (c.match < 0) & (c.mw_proxy >= 5.95)].groupby("h3").size()

    sets = {}
    for dname, dsel_g, dsel_c in (("sh", ~g.deep, ~c.deep), ("dp", g.deep, c.deep)):
        gg = g[dsel_g & (g.year >= Y0) & (g.year <= Y1)].reset_index(drop=True)
        cc = c[dsel_c].reset_index(drop=True)
        sets[dname] = (gg, cc, cKDTree(xyz(gg.lat.to_numpy(), gg.lon.to_numpy())),
                       cKDTree(xyz(cc.lat.to_numpy(), cc.lon.to_numpy())), floor_of(gg.year.to_numpy(), fl[dname]))
    full = {}
    for dname, dsel in (("sh", ~g.deep), ("dp", g.deep)):
        ga = g[dsel].reset_index(drop=True)
        full[dname] = (ga, cKDTree(xyz(ga.lat.to_numpy(), ga.lon.to_numpy())))

    for k, h in enumerate(cells):
        la, lo = cen[k]
        row = {"h3": h, "lat": round(float(la), 3), "lon": round(float(lo), 3), "area_km2": round(area[h], 0),
               "n_iscgem": int(n_g.get(h, 0)), "n_comcat": int(n_c.get(h, 0)),
               "rate_m6": round(float(n_m6.get(h, 0)) / 58.0 / area[h] * 1e5, 4),
               "pb_class": pb.get(h, "none")}
        p = xyz(np.array([la]), np.array([lo]))[0]
        det = {"h3": h, "lat": row["lat"], "lon": row["lon"], "radius_km": SAMPLE_R_KM}
        for dname, (gg, cc, tg, tc, flo) in sets.items():
            ig = np.array(sorted(tg.query_ball_point(p, chord)), dtype=int)
            ic = np.array(sorted(tc.query_ball_point(p, chord)), dtype=int)
            mg = gg.mag.to_numpy()[ig] if ig.size else np.array([])
            yg = gg.year.to_numpy()[ig] if ig.size else np.array([])
            fg = flo[ig] if ig.size else np.array([])
            mc_ = cc.mag.to_numpy()[ic] if ic.size else np.array([])
            yc = cc.year.to_numpy()[ic] if ic.size else np.array([])
            r = al.cell_b(mg, fg, nboot=NBOOT, rng=rng) if ig.size else {"n_sample": 0, "quality": "insufficient"}
            if r.get("n_b", 0) >= al.NMIN_B:
                ms = gg.mainshock.to_numpy()[ig]
                rd = al.cell_b(mg[ms], fg[ms], nboot=100, rng=rng)
                rp = al.cell_bpos(mg, fg)  # ig is time-sorted because gg is time-sorted
            else:
                rd, rp = {}, {}
            # ComCat Mc as served (native preferred magnitude)
            mc_rec = (sl.mc_maxc(mc_[yc >= 2010], correction=0.2) if (yc >= 2010).sum() >= 50 else np.nan)
            mc_old = (sl.mc_maxc(mc_[yc <= 1989], correction=0.2) if (yc <= 1989).sum() >= 50 else np.nan)
            pre = f"{dname}_"
            row.update({pre + "n_sample": r.get("n_sample", 0), pre + "n_b": r.get("n_b", 0),
                        pre + "mc": r.get("mc", np.nan), pre + "mc_lo": r.get("mc_lo", np.nan),
                        pre + "mc_hi": r.get("mc_hi", np.nan),
                        pre + "b": r.get("b", np.nan), pre + "b_lo": r.get("b_lo", np.nan),
                        pre + "b_hi": r.get("b_hi", np.nan), pre + "b_q": r.get("quality", "insufficient"),
                        pre + "b_raw": r.get("b_raw", np.nan), pre + "b_ci_w": (r.get("b_hi_raw", np.nan) -
                                                                                r.get("b_lo_raw", np.nan)),
                        pre + "b_unstable": r.get("cutoff_unstable", False),
                        pre + "b_decl": rd.get("b_raw", np.nan), pre + "b_decl_lo": rd.get("b_lo_raw", np.nan),
                        pre + "b_decl_hi": rd.get("b_hi_raw", np.nan), pre + "n_decl": rd.get("n_b", 0),
                        pre + "bpos": rp.get("bpos", np.nan), pre + "bpos_lo": rp.get("bpos_lo", np.nan),
                        pre + "bpos_hi": rp.get("bpos_hi", np.nan), pre + "n_bpos": rp.get("n_bpos", 0),
                        pre + "mc_cc_2010": mc_rec, pre + "mc_cc_pre1990": mc_old, pre + "n_cc_sample": int(ic.size)})
            if not sens and (ig.size >= 20 or ic.size >= 50):
                ga, tga = full[dname]  # full-period ISC-GEM (1904-2021) for Mc(t), restricted to the circle
                ia = np.array(sorted(tga.query_ball_point(p, chord)), dtype=int)
                ry0, ry1 = 1973, CUTOFF_YEAR
                thr = np.maximum(r.get("mc", np.nan), fg) if ig.size else np.array([])
                det[dname] = {
                    "fmd_iscgem": fmd_pairs(sl.bin_mag(mg)) if ig.size else [],
                    "fmd_comcat": fmd_pairs(sl.bin_mag(mc_)) if ic.size else [],
                    "mc_t_iscgem": mc_windows(ga.mag.to_numpy()[ia], ga.year.to_numpy()[ia], 1904, 2021, 10)
                    if ia.size else [],
                    "mc_t_comcat": mc_windows(mc_, yc, 1973, CUTOFF_YEAR, 5) if ic.size else [],
                    "b_cutoff": b_cutoff_curve(sl.bin_mag(mg), sl.bin_mag(fg), np.round(np.arange(5.0, 7.01, 0.1), 1))
                    if ig.size else [],
                    "rate_years": [ry0, ry1],
                    # ISC-GEM b-period events exist only for Y0..Y1: other years are null, not 0
                    "rate_iscgem_above_thr": yearly_counts(yg[mg >= thr - 1e-9], ry0, ry1, (Y0, Y1))
                    if ig.size and np.isfinite(r.get("mc", np.nan)) else [],
                    "rate_comcat_m45": yearly_counts(yc, ry0, ry1) if ic.size else [],
                    "stats": {kk: v for kk, v in r.items()},
                }
        if any(d in det for d in ("sh", "dp")):
            details[h] = det
        rows.append(row)
        if k % 500 == 0:
            print(f"{k}/{len(cells)} cells", flush=True)

    df = pd.DataFrame(rows).set_index("h3")
    df = df.join(cons).join(cons_g_only.rename("cons_iscgem_only")).join(cons_c_only.rename("cons_comcat_only_m6"))
    for col in ("cons_iscgem_only", "cons_comcat_only_m6", "cons_n_matched", "cons_n_mw", "cons_n_mb"):
        df[col] = df[col].fillna(0).astype(int)
    if sens:
        df.reset_index().to_pickle(WORK / f"cells_r{int(radius)}.pkl")
        print("sensitivity run", radius, {d: df[f"{d}_b_q"].value_counts().to_dict() for d in ("sh", "dp")})
        return
    df.reset_index().to_pickle(WORK / "cells.pkl")
    ddir = SITE / "cells"
    ddir.mkdir(parents=True, exist_ok=True)
    for f in ddir.glob("*.json"):
        f.unlink()
    for h, det in details.items():
        jdump(det, ddir / f"{h}.json")
    jdump({"floors": fl, "periods": PERIODS, "years": [Y0, Y1], "n_cells": len(df), "n_detail": len(details),
           "sample_radius_km": SAMPLE_R_KM, "h3_res": H3_RES, "nboot": NBOOT, "rng_seed": RNG},
          RES / "atlas_globals.json", indent=1)
    for d in ("sh", "dp"):
        print(d, df[f"{d}_b_q"].value_counts().to_dict())
    print("cells", len(df), "detail files", len(details))


if __name__ == "__main__":
    main(float(sys.argv[1]) if len(sys.argv) > 1 else SAMPLE_R_KM)
