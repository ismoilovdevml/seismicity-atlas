"""Why b-positive sits above b on the direct-Mw sample (docs/bpositive.md).

In v0.2 the b sample keeps only direct Mw (common.b_sample_mask). b fell, b-positive did not, and the share of shown
shallow cells where b-positive lies inside the b interval dropped. This script tests four explanations on the
shallow (<= 70 km) shown cells of data/work/cells.pkl and on synthetic catalogues:

  (a) incompleteness of the direct sample above the period floors: b(threshold + k), Mc-Lilliefors per cell and
      for the global periods, direct sample against every event at the same floors;
  (b) temporal coverage: where the left-out proxy events sit in time (after large events), and b-positive with
      the time order of each period shuffled (the order-free part) against the real order;
  (c) b-positive's own bias at the cell sample sizes and magnitude resolutions (iid Gutenberg-Richter null);
  (d) subduction cells against the others.

Synthetic injection: a sequence catalogue with known b, then short-term aftershock incompleteness (STAI) or a
static detection ramp above the floor, to see which statistic moves.

Writes results/val_bpos.json and docs/img/bpos_*.png. Uses only the cached work tables.
"""
from __future__ import annotations

import sys
from pathlib import Path

import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402
from atlas import PERIODS, SAMPLE_R_KM, Y0, Y1, floor_of, global_floors, xyz  # noqa: E402
from common import C1, C2, C3, IMG, INK2, MUTED, RES, b_sample_mask, jdump, load_work, setup_mpl  # noqa: E402

RNG = 20261114
LOG10E = np.log10(np.e)
OFFSETS = (0.0, 0.1, 0.2, 0.3, 0.4)
NPERM = 400          # random time orders per cell for the shuffled b-positive
DT_EDGES = (0, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30, np.inf)   # days after a larger event


# ----------------------------------------------------------------------------------------------- helpers
def time_after_larger(t_days, lat, lon, mag, mmin=6.5, dmag=0.5, radius_km=300.0):
    """For every event, the time (days) since the latest earlier event with magnitude >= mmin that is at least
    dmag larger and within radius_km; inf when there is none."""
    t_days, mag = np.asarray(t_days, float), np.asarray(mag, float)
    p = xyz(np.asarray(lat, float), np.asarray(lon, float))
    tree = cKDTree(p)
    chord = 2 * np.sin(radius_km / (2 * 6371.0))
    out = np.full(t_days.size, np.inf)
    for i in np.where(mag >= mmin)[0]:
        nb = np.array(tree.query_ball_point(p[i], chord), dtype=int)
        nb = nb[(t_days[nb] > t_days[i]) & (mag[nb] <= mag[i] - dmag + 1e-9)]
        out[nb] = np.minimum(out[nb], t_days[nb] - t_days[i])
    return out


def bpos_shuffled(m, floor, groups, nperm=50, rng=None, dmc=0.2):
    """Mean b-positive over random time orders, shuffling only inside each group (e.g. a floor period, so that
    the floor change is crossed once, as in the real order). For iid magnitudes this equals b-positive in
    expectation; the real order minus this is the part of b-positive that comes from the time order."""
    rng = np.random.default_rng(rng)
    m, floor, groups = np.asarray(m, float), np.asarray(floor, float), np.asarray(groups)
    idx = [np.where(groups == gname)[0] for gname in pd.unique(groups)]
    vals = []
    for _ in range(nperm):
        p = np.concatenate([rng.permutation(i) for i in idx])
        vals.append(al.cell_bpos(m[p], floor[p], dmc=dmc)["bpos"])
    vals = np.asarray(vals, float)
    return float(np.nanmean(vals)) if np.isfinite(vals).any() else np.nan


def bpos_pairs(m, t_days, floor, dt_split=1.0, dm=0.1, dmc=0.2):
    """b-positive from successive pairs separated by <= dt_split days and by more. Returns ((b, n), (b, n))."""
    m = sl.bin_mag(m, dm)
    keep = m >= sl.bin_mag(floor, dm) - 1e-9
    d, dt = sl.bin_mag(np.diff(m[keep]), dm), np.diff(np.asarray(t_days, float)[keep])
    out = []
    for sel in (dt <= dt_split, dt > dt_split):
        x = d[sel]
        x = x[x >= dmc - dm / 2 + 1e-9]
        out.append((LOG10E / (x.mean() - (dmc - dm / 2)) if x.size >= 10 else np.nan, int(x.size)))
    return tuple(out)


def synth_sequences(n_main, b=1.0, mmin=5.25, k_prod=0.12, alpha=0.8, c=0.01, p=1.1, t_max=36500.0,
                    t_seq=365.0, res=0.01, rng=None):
    """Background mainshocks (Poisson in t_max days) with one generation of Omori-Utsu aftershocks, every
    magnitude Gutenberg-Richter with the same b above mmin (a bin edge), reported at resolution res.
    Aftershock count per mainshock: Poisson(k_prod * 10**(alpha (M - mmin))). Returns a time-sorted DataFrame
    with columns t (days), m, parent_m (NaN for mainshocks), dt (days after the parent)."""
    rng = np.random.default_rng(rng)
    beta = b / LOG10E
    tm = np.sort(rng.uniform(0, t_max, n_main))
    mm = mmin + rng.exponential(1 / beta, n_main)
    rows = [np.c_[tm, mm, np.full(n_main, np.nan), np.full(n_main, np.nan)]]
    na = rng.poisson(k_prod * 10 ** (alpha * (mm - mmin)))
    for t0, m0, k in zip(tm, mm, na):
        if k == 0:
            continue
        u = rng.uniform(size=k)
        a0, a1 = c ** (1 - p), (t_seq + c) ** (1 - p)
        dt = (a0 + u * (a1 - a0)) ** (1 / (1 - p)) - c    # inverse CDF of the truncated Omori-Utsu density
        ma = mmin + rng.exponential(1 / beta, k)
        rows.append(np.c_[t0 + dt, ma, np.full(k, m0), dt])
    a = np.vstack(rows)
    a = a[np.argsort(a[:, 0])]
    df = pd.DataFrame(a, columns=["t", "m", "parent_m", "dt"])
    df["m"] = np.round(df.m / res) * res
    return df


def stai_missed(df, g_off=1.0, h=0.75):
    """Short-term aftershock incompleteness (Helmstetter et al. 2006 form): an aftershock is missed when
    m < M_parent - g_off - h log10(dt days)."""
    with np.errstate(divide="ignore", invalid="ignore"):
        mc_t = df.parent_m.to_numpy() - g_off - h * np.log10(df.dt.to_numpy())
    return np.nan_to_num(df.m.to_numpy() < mc_t, nan=False).astype(bool)


def tgr_draw(n, m_corner, rng, beta=0.65, m_t=5.25):
    """Tapered Gutenberg-Richter (Kagan 2002) moment magnitudes above m_t: the minimum of a Pareto(beta) moment and
    m_t's moment plus an exponential with the corner moment as scale (survival = product of both survivals)."""
    mt, mc = 10 ** (1.5 * m_t + 9.1), 10 ** (1.5 * m_corner + 9.1)
    mo = np.minimum(mt * rng.uniform(size=n) ** (-1 / beta), mt + rng.exponential(mc, n))
    return (np.log10(mo) - 9.1) / 1.5


def stats_of(m, floor, groups, rng, nperm=20):
    m, floor = np.asarray(m, float), np.asarray(floor, float)
    b = sl.b_varmc(m, floor)[0]
    bp = sl.b_positive(sl.bin_mag(m)[sl.bin_mag(m) >= sl.bin_mag(floor) - 1e-9])[0]
    bs = bpos_shuffled(m, floor, groups, nperm, rng)
    return {"b": b, "bpos": bp, "bpos_shuffled": bs}


def med_ci(v, rng, nboot=2000):
    v = np.asarray(v, float)
    v = v[np.isfinite(v)]
    if v.size < 5:
        return {"median": np.nan, "ci95": [np.nan, np.nan], "n": int(v.size)}
    bs = np.median(rng.choice(v, (nboot, v.size)), axis=1)
    return {"median": round(float(np.median(v)), 4), "ci95": np.round(np.percentile(bs, [2.5, 97.5]), 4).tolist(),
            "n": int(v.size)}


# ----------------------------------------------------------------------------------------------- data
def cell_samples(g, sel, floors, cells, deep=False, radius=SAMPLE_R_KM):
    gg = g[(g.deep == deep) & (g.year >= Y0) & (g.year <= Y1) & sel].reset_index(drop=True)
    tree = cKDTree(xyz(gg.lat.to_numpy(), gg.lon.to_numpy()))
    flo = floor_of(gg.year.to_numpy(), floors["dp" if deep else "sh"])
    chord = 2 * np.sin(radius / (2 * 6371.0))
    out = {}
    for h in cells:
        la, lo = h3.cell_to_latlng(h)
        ig = np.array(sorted(tree.query_ball_point(xyz(np.array([la]), np.array([lo]))[0], chord)), dtype=int)
        out[h] = {"m": gg.mag.to_numpy()[ig], "f": flo[ig], "t": gg.t.to_numpy()[ig] * 365.25,
                  "y": gg.year.to_numpy()[ig]}
    return out


def per_cell(samples, cells_df, rng, lilliefors=False):
    rows = []
    for h, s in samples.items():
        m, f = sl.bin_mag(s["m"]), sl.bin_mag(s["f"])
        if m.size < 30:
            continue
        r = al.cell_b(m, f, nboot=200, rng=rng)
        rp = al.cell_bpos(m, f)
        thr = np.maximum(float(sl.mc_maxc_fast(m)), f)
        row = {"h3": h, "pb": cells_df.loc[h, "pb_class"], "q": r.get("quality"), "b": r.get("b_raw", np.nan),
               "b_lo": r.get("b_lo_raw", np.nan), "b_hi": r.get("b_hi_raw", np.nan), "bpos": rp["bpos"],
               "n_bpos": rp["n_bpos"], "n_b": r.get("n_b", 0)}
        for k in OFFSETS:
            row[f"b_k{k:.1f}"] = sl.b_varmc(m, thr + k)[0]
        for dmc in (0.1, 0.3):
            row[f"bpos_dmc{dmc:.1f}"] = al.cell_bpos(m, f, dmc=dmc)["bpos"]
        keep = m >= f - 1e-9
        bp01, n01 = sl.b_positive(np.round(s["m"][keep], 2), dm=0.01, dmc=0.2)[:3:2]
        row["bpos_res001"] = bp01 if n01 >= al.NMIN_B else np.nan
        if np.isfinite(rp["bpos"]):
            row["bpos_shuf"] = bpos_shuffled(m, f, s["y"] <= 2003, NPERM, rng)
            (row["bpos_le1d"], row["n_le1d"]), (row["bpos_gt1d"], row["n_gt1d"]) = bpos_pairs(m, s["t"], f)
            if lilliefors:
                k, tab = sl.lilliefors_offset(s["m"], thr, np.arange(0, 0.81, 0.1), ndither=10, nsim=300, rng=rng)
                row["k_lill"], row["p_lill0"] = k, (tab[0][2] if tab else np.nan)
                row["b_lill"] = sl.b_varmc(m, thr + k)[0] if np.isfinite(k) else np.nan
        rows.append(row)
    return pd.DataFrame(rows).set_index("h3")


def summary(P, rng, label):
    E = P[P.q.isin(["A", "B"]) & P.bpos.notna()]
    out = {"label": label, "cells_shown": int(P.q.isin(["A", "B"]).sum()), "cells_with_bpos": int(len(E)),
           "inside_share": round(float(((E.bpos >= E.b_lo) & (E.bpos <= E.b_hi)).mean()), 4),
           "bpos_minus_b": med_ci(E.bpos - E.b, rng),
           "b_offset_minus_b": {f"{k:.1f}": med_ci(E[f"b_k{k:.1f}"] - E.b, rng) for k in OFFSETS[1:]},
           "bpos_dmc_minus_b": {"0.1": med_ci(E["bpos_dmc0.1"] - E.b, rng), "0.3": med_ci(E["bpos_dmc0.3"] - E.b, rng)},
           "bpos_res001_minus_b": med_ci(E.bpos_res001 - E.b, rng),
           "order_term_bpos_minus_shuffled": med_ci(E.bpos - E.bpos_shuf, rng),
           "shuffled_minus_b": med_ci(E.bpos_shuf - E.b, rng),
           "pairs_le1d_minus_b": med_ci(E.bpos_le1d - E.b, rng), "pairs_gt1d_minus_b": med_ci(E.bpos_gt1d - E.b, rng),
           "by_class": {}}
    for cls, sel in (("SUB", E.pb == "SUB"), ("other", E.pb != "SUB")):
        X = E[sel]
        out["by_class"][cls] = {"n": int(len(X)), "bpos_minus_b": med_ci(X.bpos - X.b, rng),
                                "order_term": med_ci(X.bpos - X.bpos_shuf, rng),
                                "order_free_term": med_ci(X.bpos_shuf - X.b, rng),
                                "inside_share": round(float(((X.bpos >= X.b_lo) & (X.bpos <= X.b_hi)).mean()), 4)}
    if "k_lill" in E:
        out["lilliefors"] = {"offset_counts": {str(k): int(v) for k, v in
                                               E.k_lill.value_counts(dropna=False).sort_index().items()},
                             "pass_at_atlas_threshold_share": round(float((E.p_lill0 >= 0.1).mean()), 4),
                             "b_lill_minus_b": med_ci(E.b_lill - E.b, rng),
                             "bpos_minus_b_lill": med_ci(E.bpos - E.b_lill, rng)}
    return out


def main():
    rng = np.random.default_rng(RNG)
    plt = setup_mpl()
    g = load_work("iscgem")
    cells = load_work("cells").set_index("h3")
    direct = b_sample_mask(g.magerr)
    every = np.ones(len(g), bool)
    fl_direct, fl_every = global_floors(g[direct]), global_floors(g)
    shown = cells.index[cells.sh_b_q.isin(["A", "B"])]
    res = {"rng_seed": RNG, "floors_direct": fl_direct, "floors_every_event": fl_every}

    # ---- (b) where the proxies sit: time after a larger event, magnitude, year (shallow, above the floor)
    s = g[(~g.deep) & (g.year >= Y0) & (g.year <= Y1)].reset_index(drop=True)
    sd = direct[(~g.deep) & (g.year >= Y0) & (g.year <= Y1)]
    mb = sl.bin_mag(s.mag.to_numpy())
    above = mb >= floor_of(s.year.to_numpy(), fl_direct["sh"]) - 1e-9
    dt = time_after_larger(s.t.to_numpy() * 365.25, s.lat, s.lon, mb)
    rows = []
    for lo, hi in zip(DT_EDGES[:-1], DT_EDGES[1:]):
        k = above & (dt >= lo) & (dt < hi)
        rows.append({"dt_days": [lo, None if np.isinf(hi) else hi], "n": int(k.sum()),
                     "proxy_share": round(float(1 - sd[k].mean()), 4)})
    k = above & ~np.isfinite(dt)
    res["proxy_share_after_larger"] = {"definition": "above-floor shallow events 1976-2021; parent M >= 6.5, "
                                       "at least 0.5 larger, within 300 km", "bins": rows,
                                       "no_parent": {"n": int(k.sum()), "proxy_share": round(float(1 - sd[k].mean()), 4)},
                                       "first_day": {"n": int((above & (dt < 1)).sum()),
                                                     "proxy_share": round(float(1 - sd[above & (dt < 1)].mean()), 4)},
                                       "after_first_day": {"n": int((above & (dt >= 1)).sum()), "proxy_share":
                                                           round(float(1 - sd[above & (dt >= 1)].mean()), 4)}}
    yr = s.year.to_numpy()
    res["proxy_share_by_year"] = {int(y): round(float(1 - sd[above & (yr == y)].mean()), 4) for y in range(Y0, Y1 + 1)}
    dshare = {}
    for a, z in PERIODS:
        ps = (yr >= a) & (yr <= z)
        t = pd.Series(sd[ps]).groupby(np.minimum(mb[ps], 6.8)).agg(["size", "mean"])
        dshare[f"{a}-{z}"] = {f"{m:.1f}": [int(r["size"]), round(float(r["mean"]), 4)] for m, r in t.iterrows()
                              if m >= 5.0}
    res["direct_share_by_magnitude"] = dshare

    # ---- (a) global per period: b(floor + k) direct vs every event, b-positive, Mc-Lilliefors
    rng = np.random.default_rng(RNG + 1)   # one stream per section: sections do not shift each other
    glob = {}
    for (a, z), key in zip(PERIODS, ("1976-2003", "2004-2021")):
        ps = (yr >= a) & (yr <= z)
        f0 = fl_direct["sh"][key]["floor"]
        rows = []
        for k in OFFSETS:
            f = np.full(mb.size, f0 + k)
            row = {"floor": round(f0 + k, 1)}
            for lab, sel in (("direct", ps & sd), ("every", ps)):
                b_, sig, n = sl.b_varmc(mb[sel], f[sel])
                kk = sel & (mb >= f0 + k - 1e-9)
                bp, sp, npos = sl.b_positive(mb[kk])
                row[lab] = {"b": round(b_, 4), "sigma": round(sig, 4), "n": int(n), "bpos": round(bp, 4),
                            "bpos_sigma": round(sp, 4), "n_bpos": int(npos)}
            rows.append(row)
        lill = {}
        for lab, sel in (("direct", ps & sd), ("every", ps)):
            mc, tab = sl.mc_lilliefors(s.mag.to_numpy()[sel], rng=rng, ndither=10, nsim=300, mc_range=(5.0, 7.0))
            lill[lab] = {"mc": mc, "table": [[t[0], t[1], round(t[2], 4)] for t in tab]}
        glob[key] = {"b_vs_floor": rows, "mc_lilliefors": lill}
    res["global_shallow"] = glob
    print("global done", flush=True)

    # ---- 0.1 binning of 0.01-resolution magnitudes: global direct b at the floors, binned (atlas) vs unbinned
    f_ = floor_of(yr, fl_direct["sh"])
    m01 = np.round(s.mag.to_numpy(), 2)
    k = sd & (m01 >= f_ - 0.05 - 1e-9)
    res["rounding_global_direct"] = {"b_binned_0.1": round(sl.b_varmc(mb[sd], f_[sd])[0], 4),
                                     "b_unbinned_0.01": round(float(LOG10E / np.mean(m01[k] - (f_[k] - 0.055))), 4),
                                     "share_at_x.x5_rounded_down": round(float(
                                         (mb[np.round(m01 * 100) % 10 == 5] < m01[np.round(m01 * 100) % 10 == 5]).mean()), 4)}

    # ---- blind windows: drop events within T days after a larger event (as above) from b, keep b-positive as is
    rng = np.random.default_rng(RNG + 2)   # one stream per section: sections do not shift each other
    dt_all = time_after_larger(g.t.to_numpy() * 365.25, g.lat, g.lon, sl.bin_mag(g.mag.to_numpy()))
    win = {}
    for T in (0.0, 0.25, 1.0, 2.0):
        w = dt_all < T
        row = {}
        for lab, sel in (("direct", direct), ("every", every)):
            gg = g[(~g.deep) & (g.year >= Y0) & (g.year <= Y1) & sel & ~w]
            row[f"global_b_{lab}"] = round(sl.b_varmc(gg.mag.to_numpy(), floor_of(gg.year.to_numpy(), fl_direct["sh"]))[0], 4)
        Pw = per_cell(cell_samples(g, direct & ~w, fl_direct, shown), cells, rng)
        Pb = per_cell(cell_samples(g, direct, fl_direct, shown), cells, rng)   # b-positive on the full direct sample
        Ew = Pw[Pw.q.isin(["A", "B"])].join(Pb[["bpos"]].rename(columns={"bpos": "bpos_full"}))
        Ew = Ew[Ew.bpos_full.notna()]
        row["per_cell"] = {"cells": int(len(Ew)), "median_b": round(float(Ew.b.median()), 4),
                           "bpos_minus_b": med_ci(Ew.bpos_full - Ew.b, rng),
                           "inside_share": round(float(((Ew.bpos_full >= Ew.b_lo) & (Ew.bpos_full <= Ew.b_hi)).mean()), 4)}
        win[f"T_{T}"] = row
    res["blind_windows"] = {"definition": "events within T days after an M >= 6.5 event at least 0.5 larger within 300 km"
                            " are left out of b (any depth class of the parent, any sample)", **win}
    print("windows done", flush=True)

    # ---- per cell (shown shallow cells of the atlas run): direct (atlas), every event at the v0.2 floors, v0.1
    rng = np.random.default_rng(RNG + 3)   # one stream per section: sections do not shift each other
    variants = {"direct_v02_floors": (direct, fl_direct, True), "every_event_v02_floors": (every, fl_direct, False),
                "every_event_v01_floors": (every, fl_every, False)}
    P = {}
    res["per_cell"] = {}
    for lab, (sel, fl, lill) in variants.items():
        P[lab] = per_cell(cell_samples(g, sel, fl, shown), cells, rng, lilliefors=lill)
        res["per_cell"][lab] = summary(P[lab], rng, lab)
        print(lab, "done", flush=True)
    # the atlas's own intervals for the direct sample (the 64.9 % figure)
    A = cells.loc[shown]
    A = A[A.sh_bpos.notna()]
    res["per_cell"]["atlas_cells_pkl"] = {"cells_with_bpos": int(len(A)), "inside_share": round(float(
        ((A.sh_bpos >= A.sh_b_lo) & (A.sh_bpos <= A.sh_b_hi)).mean()), 4), "bpos_minus_b": med_ci(A.sh_bpos - A.sh_b, rng)}
    d, e = P["direct_v02_floors"], P["every_event_v02_floors"]
    common_ = d.index[d.q.isin(["A", "B"]) & d.bpos.notna()].intersection(e.index)
    res["per_cell"]["direct_minus_every_same_floors"] = {
        "cells": int(len(common_)),
        "b": med_ci(d.loc[common_, "b"] - e.loc[common_, "b"], rng),
        "bpos": med_ci(d.loc[common_, "bpos"] - e.loc[common_, "bpos"], rng),
        **{f"b_k{k:.1f}": med_ci(d.loc[common_, f"b_k{k:.1f}"] - e.loc[common_, f"b_k{k:.1f}"], rng) for k in OFFSETS[1:]},
        "bpos_shuffled": med_ci(d.loc[common_, "bpos_shuf"] - e.loc[common_, "bpos_shuf"], rng),
        "order_term": med_ci((d.loc[common_, "bpos"] - d.loc[common_, "bpos_shuf"]) -
                             (e.loc[common_, "bpos"] - e.loc[common_, "bpos_shuf"]), rng)}

    # ---- (c) iid Gutenberg-Richter null with the real cells' floors and sizes
    E = d[d.q.isin(["A", "B"]) & d.bpos.notna()]
    samp = cell_samples(g, direct, fl_direct, E.index)
    rng = np.random.default_rng(RNG + 4)   # one stream per section: sections do not shift each other
    null = {}
    for resol in (0.01, 0.1):
        rows = []
        for _ in range(20):
            for h in E.index:
                f = sl.bin_mag(samp[h]["f"])
                f = f[sl.bin_mag(samp[h]["m"]) >= f - 1e-9]
                m = np.round((f - 0.05 + rng.exponential(LOG10E, f.size)) / resol) * resol   # b = 1
                r = al.cell_b(m, f, nboot=200, rng=rng)
                rp = al.cell_bpos(m, f)
                if r.get("quality") in ("A", "B") and np.isfinite(rp["bpos"]):
                    rows.append((r["b"], r["b_lo"], r["b_hi"], rp["bpos"]))
        R = np.array(rows)
        null[f"res_{resol}"] = {"cell_draws": int(len(R)), "median_b": round(float(np.median(R[:, 0])), 4),
                                "median_bpos": round(float(np.median(R[:, 3])), 4),
                                "median_bpos_minus_b": round(float(np.median(R[:, 3] - R[:, 0])), 4),
                                "inside_share": round(float(((R[:, 3] >= R[:, 1]) & (R[:, 3] <= R[:, 2])).mean()), 4)}
    res["null_iid_gr_b1"] = null

    # ---- synthetic injection: complete, STAI, static ramp above the floor, both
    rng = np.random.default_rng(RNG + 5)   # one stream per section: sections do not shift each other
    inj = {k: [] for k in ("complete", "stai", "static_ramp", "stai_and_ramp")}
    lost = []
    for rep in range(20):
        df = synth_sequences(4000, rng=rng)
        df = df[df.m >= 5.3 - 0.05 - 1e-9].reset_index(drop=True)
        miss = stai_missed(df)
        ramp = rng.uniform(size=len(df)) > np.clip(0.75 + 0.25 * (df.m.to_numpy() - 5.25) / 0.3, 0, 1)
        lost.append(float(miss[(df.dt < 1).to_numpy()].mean()))
        for k, drop in (("complete", np.zeros(len(df), bool)), ("stai", miss), ("static_ramp", ramp),
                        ("stai_and_ramp", miss | ramp)):
            x = df[~drop]
            inj[k].append(stats_of(x.m.to_numpy(), np.full(len(x), 5.3), np.zeros(len(x)), rng))
    res["synthetic_injection"] = {
        "setup": "b = 1; 4000 mainshocks M >= 5.25 in 100 yr, Omori c=0.01 d, p=1.1, productivity 0.12*10^(0.8(M-5.25));"
                 " floor 5.3 (0.1 bins); STAI: miss m < Mparent - 1.0 - 0.75 log10(dt d); static ramp: detection 0.75"
                 " at the floor edge rising linearly to 1 at +0.3; 20 replicates",
        "stai_missed_share_first_day": round(float(np.mean(lost)), 4),
        **{k: {s_: [round(float(np.mean([r[s_] for r in v])), 4), round(float(np.std([r[s_] for r in v])), 4)]
               for s_ in ("b", "bpos", "bpos_shuffled")} for k, v in inj.items()}}
    # ---- order-free part: shape of the distribution (tapered G-R, spatial mixture), iid, floor 5.3, n = 20000
    rng = np.random.default_rng(RNG + 6)   # one stream per section: sections do not shift each other
    shape = {}
    for name, draw in (("tgr_corner_7.0", lambda n: tgr_draw(n, 7.0, rng)), ("tgr_corner_7.5", lambda n: tgr_draw(n, 7.5, rng)),
                       ("tgr_corner_8.0", lambda n: tgr_draw(n, 8.0, rng)),
                       ("mixture_b0.8_b1.2", lambda n: 5.25 + rng.exponential(LOG10E / np.where(rng.random(n) < 0.5, 0.8, 1.2)))):
        v = []
        for _ in range(20):
            m = np.round(draw(20000), 2)
            v.append((sl.b_varmc(m, np.full(m.size, 5.3))[0], sl.b_positive(m)[0]))
        v = np.array(v)
        shape[name] = {"b": round(float(v[:, 0].mean()), 4), "bpos": round(float(v[:, 1].mean()), 4),
                       "bpos_minus_b": round(float((v[:, 1] - v[:, 0]).mean()), 4)}
    res["shape_checks_iid"] = shape
    # ---- power of the per-cell Lilliefors test against the static ramp used above (b = 1, floor 5.3)
    rng = np.random.default_rng(RNG + 7)   # one stream per section: sections do not shift each other
    power = {}
    for n in (170, 600):
        rej = 0
        for _ in range(40):
            m = 5.25 + rng.exponential(LOG10E, int(n * 1.2))
            det = np.clip(0.75 + 0.25 * (m - 5.25) / 0.3, 0, 1)
            m = np.round(m[rng.uniform(size=m.size) < det], 2)[:n]
            rej += sl.lilliefors_offset(m, 5.3, [0.0], ndither=10, nsim=300, rng=rng)[1][0][2] < 0.1
        power[str(n)] = rej / 40
    res["lilliefors_power_static_ramp"] = power
    jdump(res, RES / "val_bpos.json", indent=1)
    print("wrote results/val_bpos.json")
    figures(plt, res, P)


def figures(plt, res, P):
    # proxy share after larger events, and direct share by magnitude
    fig, ax = plt.subplots(1, 2, figsize=(9.6, 3.6))
    bins = res["proxy_share_after_larger"]["bins"]
    x = [np.sqrt(max(b_["dt_days"][0], 0.005) * (b_["dt_days"][1] or 100.0)) for b_ in bins]
    ax[0].plot(x, [b_["proxy_share"] * 100 for b_ in bins], "o-", color=C2)
    for xi, b_ in zip(x, bins):
        ax[0].annotate(f"{b_['n']}", (xi, b_["proxy_share"] * 100), textcoords="offset points", xytext=(0, 6),
                       ha="center", fontsize=7, color=MUTED)
    ax[0].axhline(res["proxy_share_after_larger"]["no_parent"]["proxy_share"] * 100, color=MUTED, lw=1, ls="--")
    ax[0].set_xscale("log")
    ax[0].set_xlabel("time after a larger event (M ≥ 6.5, ΔM ≥ 0.5, ≤ 300 km), days")
    ax[0].set_ylabel("proxy-Mw share of events above the floor, %")
    ax[0].set_title("Left-out events are mostly early aftershocks")
    for (key, dd), col in zip(res["direct_share_by_magnitude"].items(), (C1, C3)):
        fl = res["floors_direct"]["sh"][key]["floor"]
        mm = [float(k) for k in dd if float(k) >= fl - 1e-9]
        ax[1].plot(mm, [dd[f"{m:.1f}"][1] * 100 for m in mm], "o-", color=col, label=f"{key} (floor {fl})")
    ax[1].set_xlabel("Mw bin (last bin: ≥ 6.8)")
    ax[1].set_ylabel("direct-Mw share, %")
    ax[1].set_title("Direct-Mw share above the floor, shallow")
    ax[1].legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(IMG / "bpos_proxy_time.png", bbox_inches="tight")
    plt.close(fig)

    # b vs threshold offset (per cell and global) with b-positive
    fig, ax = plt.subplots(1, 2, figsize=(9.6, 3.6))
    ks = list(OFFSETS)
    for lab, col, name in (("direct_v02_floors", C1, "direct Mw"), ("every_event_v02_floors", C2, "every event")):
        sm = res["per_cell"][lab]
        y = [0.0] + [sm["b_offset_minus_b"][f"{k:.1f}"]["median"] for k in ks[1:]]
        lo = [0.0] + [sm["b_offset_minus_b"][f"{k:.1f}"]["ci95"][0] for k in ks[1:]]
        hi = [0.0] + [sm["b_offset_minus_b"][f"{k:.1f}"]["ci95"][1] for k in ks[1:]]
        ax[0].plot(ks, y, "o-", color=col, label=f"b(threshold + k) − b, {name}")
        ax[0].fill_between(ks, lo, hi, color=col, alpha=0.15, lw=0)
        ax[0].axhline(sm["bpos_minus_b"]["median"], color=col, ls="--", lw=1.2, label=f"b-positive − b, {name}")
    ax[0].set_xlabel("threshold raised by k (Mw)")
    ax[0].set_ylabel("median over shown shallow cells")
    ax[0].set_title("Per cell: raising the threshold")
    ax[0].legend(fontsize=7.5, loc="upper left")
    for (key, gl), mk in zip(res["global_shallow"].items(), ("o", "s")):
        rows = gl["b_vs_floor"]
        fl = [r["floor"] for r in rows]
        ax[1].errorbar(fl, [r["direct"]["b"] for r in rows], [r["direct"]["sigma"] for r in rows], fmt=mk + "-",
                       color=C1, capsize=2, label=f"b direct, {key}")
        ax[1].plot(fl, [r["every"]["b"] for r in rows], mk + ":", color=C2, label=f"b every event, {key}")
        ax[1].plot(fl, [r["direct"]["bpos"] for r in rows], mk + "--", color=C3, label=f"b-positive direct, {key}")
    ax[1].set_xlabel("floor (Mw)")
    ax[1].set_ylabel("b, global shallow")
    ax[1].set_title("Global: b against the floor")
    ax[1].legend(fontsize=7, ncol=2, loc="lower left")
    fig.tight_layout()
    fig.savefig(IMG / "bpos_cutoff.png", bbox_inches="tight")
    plt.close(fig)

    # decomposition: real data vs synthetic injection
    fig, ax = plt.subplots(1, 2, figsize=(9.6, 3.4))
    labs = ["direct_v02_floors", "every_event_v02_floors"]
    names = ["direct Mw", "every event"]
    w = 0.38
    for j, (key, col, nm) in enumerate((("shuffled_minus_b", MUTED, "order-free part (shuffled b+ − b)"),
                                        ("order_term_bpos_minus_shuffled", C2, "time-order part (b+ − shuffled b+)"))):
        v = [res["per_cell"][lab][key] for lab in labs]
        xx = np.arange(2) + (j - 0.5) * w
        ax[0].bar(xx, [x_["median"] for x_ in v], w, color=col, label=nm)
        ax[0].errorbar(xx, [x_["median"] for x_ in v], np.abs(np.array([x_["ci95"] for x_ in v]).T -
                                                            np.array([x_["median"] for x_ in v])),
                       fmt="none", color=INK2, capsize=3, lw=1)
    ax[0].axhline(0, color=INK2, lw=0.8)
    ax[0].set_xticks(range(2), names)
    ax[0].set_ylabel("median over shown shallow cells")
    ax[0].set_title("Real data: b-positive − b, split")
    ax[0].legend(fontsize=7.5, loc="upper right")
    inj = res["synthetic_injection"]
    cases = ["complete", "stai", "static_ramp", "stai_and_ramp"]
    xx = np.arange(len(cases))
    for j, (s_, col, nm) in enumerate((("b", C1, "b (Aki-Utsu)"), ("bpos", C3, "b-positive"),
                                       ("bpos_shuffled", MUTED, "b-positive, shuffled"))):
        ax[1].errorbar(xx + (j - 1) * 0.22, [inj[c][s_][0] for c in cases], [inj[c][s_][1] for c in cases],
                       fmt="o", color=col, capsize=3, label=nm)
    ax[1].axhline(1.0, color=INK2, lw=0.8, ls="--")
    ax[1].set_xticks(xx, ["complete", "STAI", "static ramp", "both"])
    ax[1].set_ylabel("estimate (true b = 1)")
    ax[1].set_title("Synthetic: which statistic moves")
    ax[1].legend(fontsize=7.5, loc="lower left")
    fig.tight_layout()
    fig.savefig(IMG / "bpos_decomposition.png", bbox_inches="tight")
    plt.close(fig)
    print("wrote docs/img/bpos_*.png")


if __name__ == "__main__":
    main()
