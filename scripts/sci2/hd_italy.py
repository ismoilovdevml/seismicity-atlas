"""Italy: our regional b layer against the high-definition (weighted-likelihood) b map of Taroni, Zhuang & Marzocchi
(2021), the quarry-blast criticism of Gulia, Gasperini & Wiemer (2022), and a pybvalue-style single-Mc estimator.

Inputs
- Our layer: site/data/regional/italy/cells.geojson (shallow b, quality A/B) and the INGV catalogue it was built from
  (data/work/regional/italy.pkl via build_regional.load_catalogue, so the event selection is identical).
- Taroni et al. (2021) input catalogue and night-time catalogue, as released by the authors with their MATLAB code
  (github.com/MatteoTaroniINGV/BvalueMapping, pinned commit below). It is a subset of the HORUS catalogue (Lolli et
  al. 2020, CC BY 4.0) with Mw-proxy magnitudes and a per-event completeness column. The repository states no
  licence, so the files are downloaded to the local cache for comparison only and are never redistributed.

What is computed
1. Reproduction of the published whole-catalogue B (1.04) and of the HD map on the authors' 0.1 degree grid
   (kernel sigma 30 km), with our re-implementation of their eqs. 4-5 (sci2lib.b_wle).
2. At the centre of every Italian cell where our shallow b is shown (quality A or B) and that lies inside the
   authors' study polygon: HD b from their catalogue (1960-2019, 2010-2019, night-time only), HD b from our own
   catalogue with a common Mc(t) (method effect on the same events), and our estimator on our events of 2010-2019
   (period effect).
3. Quarry blasts: day/night ratio per cell (local hours 07-19 vs 19-07, CET) and our b recomputed with night-time
   events only.
4. pybvalue-style estimator (one MAXC Mc per circle, Aki-Utsu, Shi-Bolt) on the same circles.

Outputs: results/sci2_italy_hd.json, results/sci2_pybvalue.json, docs/img/sci2-italy-hd.png

Usage: python -I scripts/sci2/hd_italy.py
"""
from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
for p in (HERE, ROOT / "scripts", ROOT / "scripts" / "regional"):
    sys.path.insert(0, str(p))
import build_regional as br  # noqa: E402
import regionlib as rl  # noqa: E402
import sci2lib as s2  # noqa: E402
from fetch import cache_get  # noqa: E402
from regions import REGIONS  # noqa: E402

TZ_COMMIT = "cb98a57592b3b0b9d9433e9458b90ae7df36c9b4"
TZ_RAW = f"https://raw.githubusercontent.com/MatteoTaroniINGV/BvalueMapping/{TZ_COMMIT}/"
SIGMA_KM = 30.0
TZ_BIN = 0.01          # Mw-proxy magnitudes with two decimals (as in the authors' script)
OUR_BIN = 0.1
INSIDE_KM = 8.0        # a cell centre is "inside the study polygon" when a grid node of the authors is this close
NEFF_MIN = 50
RNG = 20261114
NBOOT = 100
CET = 1                # local standard time offset used for day/night (no daylight saving)
OUT_JSON = ROOT / "results" / "sci2_italy_hd.json"
OUT_PYB = ROOT / "results" / "sci2_pybvalue.json"
OUT_FIG = ROOT / "docs" / "img" / "sci2-italy-hd.png"
# areas of the comment (Gulia et al. 2022, Fig. 1): 20 km circles
GGW_AREAS = {"2 (Marche, 43.35N 13.2E)": (43.35, 13.2), "3 (Marche, 43.35N 13.1E)": (43.35, 13.1),
             "4 (Apulia, 40.7N 16.7E)": (40.7, 16.7)}


def r(x, n=3):
    return None if x is None or not np.isfinite(x) else round(float(x), n)


def load_tz():
    z = zipfile.ZipFile(io.BytesIO(cache_get(TZ_RAW + "Code%20for%20Bvalue%20mapping.zip", None, "sci2_taroni2021", "zip")))
    full = np.loadtxt(io.BytesIO(z.read("Code for Bvalue mapping/Catalog_Final_Mc.txt")))
    grid = np.loadtxt(io.BytesIO(z.read("Code for Bvalue mapping/LongLat_InsideItaly.txt")))
    night = np.loadtxt(io.BytesIO(cache_get(TZ_RAW + "Catalog_Final_Mc_NightTime.txt", None, "sci2_taroni2021", "txt")))
    cols = ["lon", "lat", "year", "month", "day", "mag", "depth", "hour", "minute", "sec", "mc"]
    out = []
    for a in (full, night):
        d = pd.DataFrame(a, columns=cols)
        d["time"] = pd.to_datetime(dict(year=d.year.astype(int), month=d.month.astype(int), day=d.day.astype(int),
                                         hour=d.hour.astype(int), minute=d.minute.astype(int)), utc=True)
        out.append(d)
    return out[0], out[1], grid


def hd(df, lat_g, lon_g, dm):
    return s2.b_wle(lat_g, lon_g, df.lat.to_numpy(), df.lon.to_numpy(), df.mag.to_numpy(), df.mc.to_numpy(), dm,
                    SIGMA_KM)


def remove_short_term(df, mmin=5.5, days=3.0, km=30.0):
    df = df.sort_values("time").reset_index(drop=True)
    """Taroni et al. (2021): after every M >= 5.5, drop all events within 3 days and 30 km."""
    t = (df.time - df.time.min()).dt.total_seconds().to_numpy() / 86400
    drop = np.zeros(len(df), bool)
    for i in np.flatnonzero(df.mag.to_numpy() >= mmin - 1e-9):
        w = (t > t[i]) & (t <= t[i] + days)
        w &= s2.gc_km(df.lat.iat[i], df.lon.iat[i], df.lat.to_numpy(), df.lon.to_numpy()) <= km
        drop |= w
    return df[~drop], int(drop.sum())


def main():
    rng = np.random.default_rng(RNG)
    out = {"sigma_km": SIGMA_KM, "tz_commit": TZ_COMMIT}

    # ------------------------------------------------------------------ 1. reproduce Taroni et al. (2021)
    tz, tzn, grid = load_tz()
    B, N, sB = s2.b_whole_tz(tz.mag, tz.mc, TZ_BIN)
    Bn, Nn, sBn = s2.b_whole_tz(tzn.mag, tzn.mc, TZ_BIN)
    bg, sg, _ = hd(tz, grid[:, 1], grid[:, 0], TZ_BIN)
    sig = (B < bg - 1.96 * sg) | (B > bg + 1.96 * sg)
    out["reproduction"] = {
        "catalogue_events": int(N), "published_events": 56309, "B_whole": r(B, 4), "B_sigma": r(sB, 4),
        "published_B": 1.04, "night_events": int(Nn), "B_whole_night": r(Bn, 4),
        "years": [int(tz.year.min()), int(tz.year.max())], "mc_values": sorted(set(np.round(tz.mc, 2).tolist())),
        "grid_points": int(len(grid)), "hd_b_p10_p50_p90": [r(x) for x in np.nanpercentile(bg, [10, 50, 90])],
        "hd_b_min_max": [r(np.nanmin(bg)), r(np.nanmax(bg))],
        "grid_points_significant": int(sig.sum()), "significant_high": int((sig & (bg > B)).sum()),
        "significant_low": int((sig & (bg < B)).sum())}
    print("reproduction", out["reproduction"], flush=True)

    # ------------------------------------------------------------------ our layer and catalogue
    cfg = REGIONS["italy"]
    feats = json.loads((ROOT / "site/data/regional/italy/cells.geojson").read_text())["features"]
    cells = pd.DataFrame([f["properties"] for f in feats])
    ab = cells[cells.sh_q.isin(["A", "B"])].reset_index(drop=True)
    df, _, _ = br.load_catalogue(cfg)
    df["per"] = rl.period_index(df.year.to_numpy(), cfg["periods"])
    sh = df[df.depth <= br.DEPTH_SPLIT].reset_index(drop=True)
    floors = []
    for k in range(len(cfg["periods"])):
        floors.append(rl.regional_floor(sh.mag[sh.per == k].to_numpy())[0])
    floors = np.array(floors, float)
    tree = cKDTree(br.xyz(sh.lat.to_numpy(), sh.lon.to_numpy()))
    chord = 2 * np.sin(cfg["radius_km"] / (2 * 6371.0))
    hour_local = (sh.time.dt.hour.to_numpy() + CET) % 24
    night = ~s2.is_daytime(hour_local)

    gtree = cKDTree(br.xyz(grid[:, 1], grid[:, 0]))
    dnear = gtree.query(br.xyz(ab.lat.to_numpy(), ab.lon.to_numpy()))[0] * 6371.0
    ab["inside"] = dnear <= INSIDE_KM

    # HD at our cell centres: authors' catalogue (all, 2010-2019, night) and our catalogue with a common Mc(t)
    la, lo = ab.lat.to_numpy(), ab.lon.to_numpy()
    tz30, n30 = remove_short_term(tz, days=30.0)
    out["tz_extra_removal_30d_30km"] = int(n30)
    for key, d in (("tz_all", tz), ("tz_2010_2019", tz[tz.year >= 2010]), ("tz_night", tzn), ("tz_rm30d", tz30)):
        b_, s_, ne = hd(d, la, lo, TZ_BIN)
        ab[key], ab[key + "_sig"], ab[key + "_neff"] = b_, s_, ne
    ours_c = sh.assign(mc=floors[sh.per.to_numpy()])
    ours_c = ours_c[ours_c.mag >= ours_c.mc - 1e-9]
    ours_c, n_drop = remove_short_term(ours_c)
    b_, s_, ne = hd(ours_c, la, lo, OUR_BIN)
    ab["hd_ours"], ab["hd_ours_sig"], ab["hd_ours_neff"] = b_, s_, ne

    # per cell: our estimator 2010-2019, night-only, D/N, pybvalue-style
    per1019 = rl.period_index(sh.year.to_numpy(), [[2010, 2013], [2014, 2017], [2018, 2019]])
    rows = []
    for i, c in ab.iterrows():
        p = br.xyz(np.array([c.lat]), np.array([c.lon]))[0]
        ii = np.array(sorted(tree.query_ball_point(p, chord)), dtype=int)
        m, per = sh.mag.to_numpy()[ii], sh.per.to_numpy()[ii]
        rec = {}
        r1 = rl.cell_b_tv(m, per1019[ii], floors[:3], nboot=NBOOT, rng=rng, window=br.MC_WINDOW)
        rec["ours_2010_2019"] = r1.get("b_raw", np.nan)
        rec["ours_2010_2019_q"] = r1.get("quality")
        r0 = rl.cell_b_tv(m, per, floors, nboot=20, rng=rng, window=br.MC_WINDOW)
        used = m >= rl.thresholds_time_order(r0) - 1e-9
        rec["dn_ratio"] = s2.day_night_ratio(hour_local[ii][used])
        rec["n_used"] = int(used.sum())
        nt = night[ii]
        rn = rl.cell_b_tv(m[nt], per[nt], floors, nboot=NBOOT, rng=rng, window=br.MC_WINDOW)
        rec["ours_night"], rec["ours_night_q"] = rn.get("b_raw", np.nan), rn.get("quality")
        rec["ours_night_lo"], rec["ours_night_hi"] = rn.get("b_lo_raw", np.nan), rn.get("b_hi_raw", np.nan)
        for corr, key in ((0.0, "pyb"), (0.2, "pyb02")):
            q = s2.b_single_mc(m, OUR_BIN, corr)
            rec[key], rec[key + "_sig"], rec[key + "_mc"], rec[key + "_n"] = q["b"], q["sigma"], q["mc"], q["n"]
        rows.append(rec)
    ab = pd.concat([ab, pd.DataFrame(rows)], axis=1)

    # ------------------------------------------------------------------ comparisons
    ins = ab[ab.inside & (ab.tz_all_neff >= NEFF_MIN)]
    cmp = {
        "ours_vs_tz_all": s2.compare(ins.sh_b, ins.tz_all),
        "ours_vs_tz_2010_2019": s2.compare(ins.sh_b, ins.tz_2010_2019),
        "ours_vs_tz_night": s2.compare(ins.sh_b, ins.tz_night),
        "ours_vs_tz_rm30d": s2.compare(ins.sh_b, ins.tz_rm30d),
        "ours_2010_2019_vs_tz_2010_2019": s2.compare(ins.ours_2010_2019, ins.tz_2010_2019),
        "ours_vs_hd_ours_same_events": s2.compare(ab.sh_b, ab.hd_ours),
        "tz_all_vs_hd_ours": s2.compare(ins.tz_all, ins.hd_ours),
    }
    # does the published significance pattern (relative to the whole-catalogue B) carry over?
    tz_sig_hi = ins.tz_all - 1.96 * ins.tz_all_sig > B
    tz_sig_lo = ins.tz_all + 1.96 * ins.tz_all_sig < B
    ours_med = float(np.median(ab.sh_b))
    ab["ours_hi"], ab["ours_lo"] = ab.sh_b_lo > ours_med, ab.sh_b_hi < ours_med
    agree = {"cells": int(len(ins)), "tz_significant_high": int(tz_sig_hi.sum()), "tz_significant_low": int(tz_sig_lo.sum()),
             "of_tz_high_ours_also_high": int((tz_sig_hi & ins.sh_b_lo.gt(ours_med)).sum()),
             "of_tz_high_ours_low": int((tz_sig_hi & ins.sh_b_hi.lt(ours_med)).sum()),
             "of_tz_low_ours_also_low": int((tz_sig_lo & ins.sh_b_hi.lt(ours_med)).sum()),
             "of_tz_low_ours_high": int((tz_sig_lo & ins.sh_b_lo.gt(ours_med)).sum()),
             "ours_reference_median_b": r(ours_med)}
    ins = ab[ab.inside & (ab.tz_all_neff >= NEFF_MIN)]
    diff = (ins.tz_all - ins.sh_b)
    z = (ins.tz_all - ins.tz_all.mean()) / ins.tz_all.std() - (ins.sh_b - ins.sh_b.mean()) / ins.sh_b.std()
    big = ins.assign(diff=diff, zdiff=z).reindex(z.abs().sort_values(ascending=False).index).head(8)
    where = [{"h3": c.id, "lat": c.lat, "lon": c.lon, "ours_b": r(c.sh_b), "ours_lo": r(c.sh_b_lo),
              "ours_hi": r(c.sh_b_hi), "tz_all": r(c.tz_all), "tz_sigma": r(c.tz_all_sig), "tz_night": r(c.tz_night), "tz_rm30d": r(c.tz_rm30d),
              "ours_night": r(c.ours_night), "dn_ratio": r(c.dn_ratio, 2), "standardised_diff": r(c.zdiff, 2)}
             for c in big.itertuples()]

    # quarry blasts: cells with a high day/night ratio vs the others
    hi_dn = ab.dn_ratio > 1.5
    dnight = (ab.ours_night - ab.sh_b).where(ab.ours_night_q.isin(["A", "B"]))
    qb = {"day_hours_local": "07-19 CET (UTC+1, no daylight saving)", "threshold": 1.5,
          "cells_ab": int(len(ab)), "dn_median": r(ab.dn_ratio.median(), 2),
          "dn_p10_p90": [r(x, 2) for x in np.percentile(ab.dn_ratio, [10, 90])],
          "cells_dn_gt_1_5": int(hi_dn.sum()), "cells_dn_gt_2": int((ab.dn_ratio > 2).sum()),
          "night_minus_all_median_dn_gt_1_5": r(dnight[hi_dn].median()) if hi_dn.any() else None,
          "night_minus_all_median_dn_le_1_5": r(dnight[~hi_dn].median()),
          "night_ab_cells": int(dnight.notna().sum()),
          "night_minus_all_median_all_cells": r(dnight.median()),
          "night_b_outside_all_interval": int((dnight.notna() & ((ab.ours_night < ab.sh_b_lo) |
                                                                 (ab.ours_night > ab.sh_b_hi))).sum()),
          "night_b_quality_counts": ab.ours_night_q.value_counts().to_dict(),
          "corr_dn_vs_b": r(float(np.corrcoef(ab.dn_ratio, ab.sh_b)[0, 1])),
          "cells_dn_gt_1_5_list": [{"h3": c.id, "lat": c.lat, "lon": c.lon, "dn": r(c.dn_ratio, 2), "b": r(c.sh_b),
                                    "b_night": r(c.ours_night), "night_q": c.ours_night_q, "n_used": c.n_used}
                                   for c in ab[hi_dn].sort_values("dn_ratio", ascending=False).itertuples()]}
    # the three comment areas: our events in 20 km circles, above the regional floor
    areas = {}
    for name, (la0, lo0) in GGW_AREAS.items():
        d = s2.gc_km(la0, lo0, sh.lat.to_numpy(), sh.lon.to_numpy())
        s = (d <= 20) & (sh.mag.to_numpy() >= floors[sh.per.to_numpy()] - 1e-9)
        dk = s2.gc_km(la0, lo0, ab.lat.to_numpy(), ab.lon.to_numpy())
        k = int(np.argmin(dk))
        areas[name] = {"events_above_floor_20km": int(s.sum()), "dn_ratio": r(s2.day_night_ratio(hour_local[s]), 2),
                       "nearest_ab_cell_km": r(dk[k], 1), "nearest_cell_b": r(ab.sh_b.iat[k]),
                       "nearest_cell_b_night": r(ab.ours_night.iat[k]), "tz_all_there": r(ab.tz_all.iat[k]),
                       "tz_night_there": r(ab.tz_night.iat[k])}
    qb["comment_areas"] = areas
    excluded_blasts = int((pd.read_pickle(br.WORK / "italy.pkl").etype.astype(str).str.lower() == "quarry blast").sum())
    qb["quarry_blasts_flagged_by_ingv_and_excluded"] = excluded_blasts

    out.update({
        "our_cells_ab_shallow": int(len(ab)), "inside_polygon_neff_ge_50": int(len(ins)),
        "hd_ours_events": int(len(ours_c)), "hd_ours_dropped_short_term": n_drop,
        "hd_ours_floors": floors.tolist(),
        "comparisons": {k: {kk: r(v, 3) if isinstance(v, float) else v for kk, v in d.items()} for k, d in cmp.items()},
        "significance_agreement": agree, "largest_standardised_differences": where, "quarry_blasts": qb,
        "notes": ["Ours: INGV ML, 2010-2025, depth <= 70 km, 30 km circle, per-cell per-period MAXC+0.2 with 200-event "
                  "windows. Taroni et al.: HORUS Mw proxy, 1960-2019, depth <= 30 km, Gaussian kernel sigma 30 km, "
                  "published per-period Mc, events after M >= 5.5 within 3 days and 30 km removed.",
                  "b in ML and b in Mw differ by the slope of the ML-Mw relation, so a constant ratio between the two "
                  "is expected; correlation and ranks are the like-for-like part of the comparison."]})
    OUT_JSON.write_text(json.dumps(out, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))

    pyb = {"package": "pybvalue v0.0.1 (doi:10.5281/zenodo.11508511)", "licence": "MIT (LICENSE in the Zenodo archive)",
           "archive_contents": "README, LICENSE, ProjectDescription.pdf, one notebook (catalogue download and reading "
                               "only), two catalogue text files; no b-value or Mc function",
           "method_as_documented": "Mc by maximum curvature; Aki (1965) MLE with bin correction; Shi & Bolt (1982) "
                                   "sigma; spatial mapping after Schorlemmer et al. (2004)",
           "reimplementation": "sci2lib.b_single_mc on the same 30 km circles and events as our layer (shallow, 2010-2025)",
           "cells": int(len(ab)),
           "maxc": {k: r(v, 3) if isinstance(v, float) else v for k, v in s2.compare(ab.sh_b, ab.pyb).items()},
           "maxc_plus_0_2": {k: r(v, 3) if isinstance(v, float) else v for k, v in s2.compare(ab.sh_b, ab.pyb02).items()},
           "maxc_inside_our_interval": int(((ab.pyb >= ab.sh_b_lo) & (ab.pyb <= ab.sh_b_hi)).sum()),
           "maxc02_inside_our_interval": int(((ab.pyb02 >= ab.sh_b_lo) & (ab.pyb02 <= ab.sh_b_hi)).sum()),
           "mc_single_minus_ours_latest_median": r(float(np.nanmedian(ab.pyb_mc - ab.sh_mc)) if "sh_mc" in ab else np.nan)}
    OUT_PYB.write_text(json.dumps(pyb, indent=1))
    print(json.dumps(out["comparisons"], indent=1))
    print(json.dumps(agree), json.dumps(pyb, indent=1))
    print(json.dumps({k: v for k, v in qb.items() if k != "cells_dn_gt_1_5_list"}, indent=1))
    ab.to_pickle(ROOT / "data" / "work" / "sci2_italy_cells.pkl")
    figure(ab, ins, grid, bg, B)


def figure(ab, ins, grid, bg, B):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.size": 8.5, "axes.titlesize": 9, "savefig.dpi": 200})
    fig, ax = plt.subplots(1, 3, figsize=(11.5, 4.0), gridspec_kw={"width_ratios": [1, 1, 1.05]})
    a = ax[0]
    a.errorbar(ins.sh_b, ins.tz_all, xerr=[ins.sh_b - ins.sh_b_lo, ins.sh_b_hi - ins.sh_b], yerr=1.96 * ins.tz_all_sig,
               fmt="o", ms=3, lw=0.4, color="#2b6ca3", ecolor="#c9d9e8", label="1960-2019, all hours")
    a.scatter(ins.sh_b, ins.tz_night, s=9, marker="x", color="#c0392b", lw=0.8, label="night-time catalogue", zorder=3)
    lim = [0.6, 1.6]
    a.plot(lim, lim, color="0.5", lw=0.7, ls="--")
    a.set_xlim(lim); a.set_ylim(lim)
    a.set_xlabel("this atlas: cell b (INGV ML, 2010-2025, 95 % CI)")
    a.set_ylabel("HD b at cell centre (HORUS Mw proxy, ±1.96σ)")
    st = ins[["sh_b", "tz_all"]].corr(method="spearman").iloc[0, 1]
    a.set_title(f"(a) vs HD b, Taroni et al. data\n{len(ins)} cells, Spearman {st:.2f}")
    a.legend(loc="upper left", frameon=False, fontsize=7.5)
    a = ax[1]
    a.scatter(ab.sh_b, ab.hd_ours, s=10, color="#2b6ca3")
    a.plot(lim, lim, color="0.5", lw=0.7, ls="--")
    a.set_xlim(lim); a.set_ylim(lim)
    st2 = ab[["sh_b", "hd_ours"]].corr(method="spearman").iloc[0, 1]
    a.set_xlabel("this atlas: cell b (30 km circle, local Mc)")
    a.set_ylabel("HD b, same INGV events (regional Mc(t), kernel 30 km)")
    a.set_title(f"(b) same INGV events, two estimators\n{len(ab)} cells, Spearman {st2:.2f}")
    a = ax[2]
    sc = a.scatter(grid[:, 0], grid[:, 1], c=bg, s=7.5, marker="s", cmap="RdBu_r", vmin=0.7, vmax=1.3, lw=0)
    a.scatter(ab.lon, ab.lat, c=ab.sh_b, s=26, cmap="RdBu_r", vmin=0.7, vmax=1.3, edgecolor="k", lw=0.4)
    hi = ab.dn_ratio > 1.5
    a.scatter(ab.lon[hi], ab.lat[hi], s=60, facecolor="none", edgecolor="#f39c12", lw=1.0, label="day/night > 1.5")
    a.set_aspect(1 / np.cos(np.radians(42)))
    a.set_xlim(6.4, 19.0); a.set_ylim(36.4, 47.2)
    a.set_xlabel("longitude"); a.set_ylabel("latitude")
    a.set_title(f"(c) HD b, 0.1° grid (whole-catalogue B = {B:.3f})\nand our A/B cells (circles)")
    a.legend(loc="lower left", frameon=False, fontsize=7.5)
    cb = fig.colorbar(sc, ax=a, shrink=0.8, pad=0.02)
    cb.set_label("b")
    fig.tight_layout()
    fig.savefig(OUT_FIG)
    print("figure", OUT_FIG)


if __name__ == "__main__":
    main()
