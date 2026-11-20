"""Seismic-deficit layer, Tien Shan pilot: geodetic vs seismic moment rate per region and per H3 cell.

Usage:  python -I scripts/deficit/fetch_deficit.py      (once; downloads and grids the strain-rate models)
        python -I scripts/deficit/build_deficit.py

Inputs   data/work/deficit/strain_<model>.npz  (fetch_deficit.py), data/processed/iscgem.csv, data/processed/comcat_m45.csv
Outputs  site/data/deficit/index.json, regions.geojson, cells.geojson   (data contract: docs/deficit.md)
         data/work/deficit/results.json                                 (everything, incl. Monte Carlo summaries)

Method (docs/deficit.md): geodetic moment rate 2 mu H sum(A e_SS) (Kostrov 1974; Savage & Simpson 1997) with
mu, H and the strain-rate model drawn in a Monte Carlo; seismic moment rate (a) observed, summed per magnitude band over
that band's complete period (Michael 2014 ISC-GEM completeness), and (b) long-term tapered G-R (Kagan 2002) from the
rate of Mw >= 6 events, beta and a corner-magnitude range; a catalogue-length test simulates the band-wise estimate
under full coupling with the corner magnitude that balances the geodetic budget (Bird & Kagan 2004).
NOT a forecast: a ratio over ~120 years of catalogue for a process with recurrence times of centuries or longer.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import h3
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import Polygon, box, mapping

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import momentlib as ml  # noqa: E402
import seislib as sl  # noqa: E402
from common import (CUTOFF, ISCGEM_END, ISCGEM_LAST_YEAR, MW_TYPES, PROC, SITE, VERSION, WORK,  # noqa: E402
                    decimal_year, jdump)

OUT = SITE / "deficit"
WD = WORK / "deficit"
SEED = 20261114
N_MC = 20000          # Monte Carlo draws per zone
N_SIM = 4000          # synthetic catalogues per zone for the catalogue-length test
MIN_COV = 0.70        # a strain model enters a zone only if it covers >= 70 % of the zone area
MU_RANGE = (28e9, 33e9)          # Pa, uniform
H_RANGE = (15e3, 25e3)           # m, uniform
MC_RANGE = (7.75, 8.5)           # corner magnitude, uniform (tapered G-R long-term rate)
MW_T = 6.0                       # threshold of the rate alpha, counted from YEAR_T
MC_SEARCH = (6.0, 10.5)          # corner magnitudes searched for the moment balance
YEAR_T = 1964.0
B_MIN = 5.8                      # b from Mw >= 5.8, 1976 - cut-off (whole belt; sub-zones are too small)
DM = 0.1                         # magnitude bin of the b estimate: bin 5.8 holds Mw 5.75-5.84
# Michael (2014) ISC-GEM shallow completeness, as magnitude bands with the first complete year
BANDS = [(5.8, 6.0, 1976.0), (6.0, 6.5, 1964.0), (6.5, 6.8, 1955.0), (6.8, 7.0, 1940.0), (7.0, 7.7, 1918.0),
         (7.7, 99.0, 1904.0)]
MODELS = ["ou2026", "chang_bforstrain", "chang_gpsgridder", "chang_locavggrad", "chang_visr"]
H3_RES = 2
CELL_OVERLAP = 0.25

# Tien Shan outline (lon, lat): south edge along the Tarim / Fergana-Alai margin (Pamir excluded), north edge along
# the Kazakh-Junggar foreland (Dzungarian Alatau excluded). A hand-drawn envelope, documented in docs/deficit.md.
TIENSHAN = [(69.0, 40.0), (72.0, 39.6), (74.0, 39.2), (76.0, 39.2), (78.0, 39.8), (80.0, 40.6), (82.0, 41.0),
            (84.0, 41.4), (86.0, 41.6), (88.0, 42.2), (90.0, 42.0), (92.0, 42.2), (92.0, 44.2), (90.0, 44.4),
            (88.0, 44.6), (86.0, 44.8), (84.0, 44.8), (82.0, 44.6), (80.0, 44.0), (78.0, 43.8), (76.0, 43.6),
            (74.0, 43.3), (72.0, 43.0), (69.0, 42.6)]
REGIONS = [("tienshan", "Tien Shan (69-92 E)", None), ("ts_west", "Western Tien Shan (69-76 E)", (69, 76)),
           ("ts_central", "Central Tien Shan (76-82 E)", (76, 82)), ("ts_east", "Eastern Tien Shan (82-92 E)", (82, 92))]


# ----------------------------------------------------------------------------------------------- inputs
def load_models():
    g = {}
    for m in MODELS:
        z = np.load(WD / f"strain_{m}.npz")
        g[m] = {"ess": ml.savage_simpson_rate(z["exx"], z["eyy"], z["exy"]),
                "sec": ml.second_invariant(z["exx"], z["eyy"], z["exy"]),
                "exx": z["exx"], "eyy": z["eyy"], "exy": z["exy"]}
        lon, lat = z["lon"], z["lat"]
    LA, LO = np.meshgrid(lat, lon, indexing="ij")
    area = ml.node_area_m2(LA, lon[1] - lon[0], lat[1] - lat[0])
    return g, LO, LA, area


def load_catalogue():
    t_end = float(decimal_year(pd.Series(pd.to_datetime([CUTOFF], utc=True)))[0])
    a = pd.read_csv(PROC / "iscgem.csv", usecols=["time", "latitude", "longitude", "depth", "mag", "magError", "id"])
    a["time"] = pd.to_datetime(a["time"], utc=True, format="ISO8601")
    a = a[a["time"] < pd.Timestamp(ISCGEM_END, tz="UTC")]           # ISC-GEM to its last year, ComCat after
    a["src"] = "iscgem"
    a["magError"] = a["magError"].fillna(0.2)          # ISC-GEM Mw uncertainty; 0.2 where missing
    c = pd.read_csv(PROC / "comcat_m45.csv", usecols=["time", "latitude", "longitude", "depth", "mag", "magType", "id"])
    c["time"] = pd.to_datetime(c["time"], utc=True, format="ISO8601")
    c = c[(c["time"] >= pd.Timestamp(ISCGEM_END, tz="UTC")) & c["magType"].str.lower().isin(MW_TYPES)]
    c = c.drop(columns="magType")
    c["src"] = "comcat"
    c["magError"] = 0.1                                 # assumed for ComCat Mww/Mwr after ISC-GEM - cut-off
    e = pd.concat([a, c], ignore_index=True)
    # Mw >= B_MIN - DM/2: the lowest bin of the b estimate (moment bands and counts use Mw >= B_MIN, see zone_inputs)
    e = e[(e["depth"].fillna(0) <= 70.0) & (e["mag"] >= B_MIN - DM / 2 - 1e-9)]
    e = e[e["longitude"].between(60, 95) & e["latitude"].between(35, 52)].copy()
    e["year"] = decimal_year(e["time"])
    return e.reset_index(drop=True), t_end


# ----------------------------------------------------------------------------------------------- per zone
def zone_inputs(poly, g, LO, LA, area, ev):
    inside = shapely.contains_xy(poly, LO, LA)
    a_zone = float(area[inside].sum())
    integ, cov, integ_meant = {}, {}, {}
    for m, d in g.items():
        ok = inside & np.isfinite(d["ess"])
        c = float(area[ok].sum() / a_zone) if a_zone > 0 else 0.0
        cov[m] = c
        if c >= MIN_COV:
            # density extrapolation to the uncovered part of the zone (recorded through `cov`)
            integ[m] = float((d["ess"][ok] * area[ok]).sum() / c)
            w = area[ok] / area[ok].sum()
            integ_meant[m] = float(ml.savage_simpson_rate((d["exx"][ok] * w).sum(), (d["eyy"][ok] * w).sum(),
                                                          (d["exy"][ok] * w).sum()) * a_zone)
    sel = shapely.contains_xy(poly, ev["longitude"].to_numpy(), ev["latitude"].to_numpy()) & \
        (ev["mag"].to_numpy(float) >= B_MIN - 1e-9)
    return {"area_m2": a_zone, "integ": integ, "integ_meantensor": integ_meant, "cov": cov, "events": ev[sel]}


def zone_mc(zi, t_end, b_boot, rng):
    ev = zi["events"]
    mw, yr = ev["mag"].to_numpy(float), ev["year"].to_numpy(float)
    ms_obs, bands = ml.bandwise_moment_rate(mw, yr, BANDS, t_end)
    # the same with the event of largest moment removed (shows how much one earthquake decides the ratio)
    if len(mw):
        keep = np.arange(len(mw)) != np.argmax(mw)
        ms_x1, _ = ml.bandwise_moment_rate(mw[keep], yr[keep], BANDS, t_end)
    else:
        ms_x1 = 0.0
    n6 = int(((mw >= MW_T - 1e-9) & (yr >= YEAR_T)).sum())
    T6 = t_end - YEAR_T
    out = {"ms_obs": ms_obs, "bands": bands, "n6": n6, "n_events": int(len(ev)),
           "mw_max": float(mw.max()) if len(mw) else None,
           "mw_max_year": int(np.floor(yr[np.argmax(mw)])) if len(mw) else None,
           "models": sorted(zi["integ"]), "cov": zi["cov"]}
    if not zi["integ"]:
        out["q"] = "nogeod"
        return out
    models = sorted(zi["integ"])
    mi = rng.integers(0, len(models), N_MC)
    integ = np.array([zi["integ"][m] for m in models])[mi]
    mu = rng.uniform(*MU_RANGE, N_MC)
    H = rng.uniform(*H_RANGE, N_MC)
    mg = 2.0 * mu * H * integ
    alpha6 = rng.gamma(n6 + 0.5, 1.0 / T6, N_MC)                        # Jeffreys posterior of the Poisson rate
    beta = 2.0 / 3.0 * rng.choice(b_boot, N_MC)
    mc = rng.uniform(*MC_RANGE, N_MC)
    ms_tgr = alpha6 * ml.tgr_mean_moment(ml.mw_to_m0(MW_T), beta, ml.mw_to_m0(mc))
    ms_draw = ml.bandwise_rate_draws(mw, ev["magError"].to_numpy(float), yr, BANDS, t_end, N_MC, rng)
    out.update({"mg": ml.ratio_summary(mg), "ms_tgr": ml.ratio_summary(ms_tgr), "ms_obs_draws": ml.ratio_summary(ms_draw),
                "r_obs": ml.ratio_summary(ms_draw / mg), "r_tgr": ml.ratio_summary(ms_tgr / mg),
                "r_obs_point": ml.ratio_summary(ms_obs / mg),
                "ms_obs_x1": ms_x1, "r_obs_x1": ml.ratio_summary(ms_x1 / mg),
                "mg_by_model": {m: ml.ratio_summary(mg[mi == k]) for k, m in enumerate(models)},
                "mg_meantensor_over_cells": float(np.mean([zi["integ_meantensor"][m] / zi["integ"][m]
                                                            for m in models]))})
    # catalogue-length test: corner magnitude that balances chi * Mdot_geod, then simulated band-wise estimates
    k = np.arange(N_SIM)
    for chi, key in ((1.0, "full"), (0.5, "half")):
        mcb = np.array([ml.balance_corner_mw(chi * mg[i], alpha6[i], MW_T, beta[i], *MC_SEARCH) for i in k])
        unbal = mcb == np.inf            # no corner up to 10.5 balances the budget: those draws use 10.5
        over = mcb == -np.inf            # the observed rate exceeds the budget even with a corner at 6.0: use 6.0
        mcb_use = np.where(unbal, MC_SEARCH[1], np.where(over, MC_SEARCH[0], mcb))
        mcb_use = np.where(np.isfinite(mcb_use), mcb_use, MC_SEARCH[1])
        # rate above B_MIN implied by alpha6 and the tapered G-R survivor between B_MIN and MW_T
        m0t, m06 = ml.mw_to_m0(B_MIN), ml.mw_to_m0(MW_T)
        surv = (m0t / m06) ** beta[k] * np.exp((m0t - m06) / ml.mw_to_m0(mcb_use))
        rate_t = alpha6[k] / surv
        counts = rng.poisson(rate_t * (t_end - 1904.0))
        sim = np.repeat(k, counts)
        mws = np.concatenate([ml.tgr_sample_mw(c, B_MIN, beta[i], mcb_use[i], rng) for i, c in zip(k, counts)])
        yrs = rng.uniform(1904.0, t_end, counts.sum())
        est = np.zeros(N_SIM)
        for lo, hi, y0 in BANDS:
            s = (mws >= lo) & (mws < hi) & (yrs >= y0)
            est += np.bincount(sim[s], weights=ml.mw_to_m0(mws[s]), minlength=N_SIM) / (t_end - y0)
        out[f"p_{key}"] = float((est <= ms_obs).mean())
        ok = np.isfinite(mcb)
        out[f"mc_bal_{key}"] = ml.ratio_summary(mcb[ok]) if ok.any() else {"lo": None, "med": None, "hi": None}
        out[f"unbalanced_{key}"] = float(unbal.mean())
        out[f"over_budget_{key}"] = float(over.mean())
        out[f"sim_med_ratio_{key}"] = float(np.median(est / (chi * mg[k])))
    out["q"] = "ok" if n6 >= 5 else "few"
    return out


# ----------------------------------------------------------------------------------------------- validation
def validate_chang_west_fraction(g, LO, LA, area):
    """Chang et al. (2025): 'approximately 70% of the total strain occurs west of 82°E' (their Table S3)."""
    res = {}
    for m in MODELS[1:]:
        z = np.load(WD / f"strain_{m}.npz")
        lon = z["pts_lon"]
        sec = ml.second_invariant(z["pts_exx"], z["pts_eyy"], z["pts_exy"])
        ess = ml.savage_simpson_rate(z["pts_exx"], z["pts_eyy"], z["pts_exy"])
        d = g[m]
        ok = np.isfinite(d["ess"])
        w = ok & (LO < 82)
        res[m] = {"points_sec_inv": float(sec[lon < 82].sum() / sec.sum()),
                  "points_ess": float(ess[lon < 82].sum() / ess.sum()),
                  "area_sec_inv": float((d["sec"] * area)[w].sum() / (d["sec"] * area)[ok].sum()),
                  "area_ess": float((d["ess"] * area)[w].sum() / (d["ess"] * area)[ok].sum())}
    # same for Ou et al. over the common Chang domain (72-92.4 E)
    d = g["ou2026"]
    ok = np.isfinite(d["ess"]) & (LO >= 72) & np.isfinite(g["chang_bforstrain"]["ess"])
    w = ok & (LO < 82)
    res["ou2026_on_chang_domain"] = {"area_sec_inv": float((d["sec"] * area)[w].sum() / (d["sec"] * area)[ok].sum()),
                                     "area_ess": float((d["ess"] * area)[w].sum() / (d["ess"] * area)[ok].sum())}
    return res


# Molnar & Ghose (2000) Table 1 (read from the publisher PDF): date, lat, lon, seismic moment and its uncertainty
# (1e20 N m). Their parameters: mu 3.3e10 Pa, depth 20 km, length 1800 km, width 300 km, 100 years;
# M_NN = -16.3 (+/- 4.4) e20 N m -> 7 (+/- 2) mm/yr.
MG2000 = [("1902-08-22", 40.0, 77.0, 5.0, 3.0), ("1906-12-22", 44.0, 86.0, 1.3, 0.9), ("1911-01-03", 42.8, 77.3, 7.5, 2.9),
          ("1914-08-04", 43.3, 93.1, 0.6, 0.3), ("1946-11-02", 41.9, 71.8, 1.1, 0.3), ("1985-08-23", 39.4, 75.3, 0.2, 0.1),
          ("1992-08-19", 42.1, 73.3, 0.8, 0.2)]
MG_PAR = {"mu": 3.3e10, "h": 20e3, "length": 1800e3, "width": 300e3, "years": 100.0, "m_nn": 16.3e20}


def validate_molnar_ghose(zi, rng, ev_all, t_end):
    """Reproduce Molnar & Ghose (2000) and say where ISC-GEM differs.

    (1) their Kostrov arithmetic from their M_NN and from the sum of their Table 1 scalar moments;
    (2) the same arithmetic with ISC-GEM Mw moments for the same earthquakes (1902 is before ISC-GEM: their value kept);
    (3) our whole-belt ratio with their moments substituted for the matched ISC-GEM events;
    (4) Kostrov-equivalent shortening of our geodetic and seismic rates over the outline's along-strike length."""
    P = MG_PAR
    u_paper = ml.kostrov_shortening(P["m_nn"], P["mu"], P["h"], P["length"], P["years"]) * 1e3
    tab_sum = sum(r[3] for r in MG2000) * 1e20
    u_table = ml.kostrov_shortening(tab_sum, P["mu"], P["h"], P["length"], P["years"]) * 1e3
    rows, iscgem_sum, sub = [], 0.0, {}
    for d, la, lo, m0, sm in MG2000:
        t = pd.Timestamp(d, tz="UTC")
        cand = ev_all[(ev_all["time"] - t).abs() <= pd.Timedelta(days=1)]
        cand = cand[(cand["latitude"] - la).abs().le(1.5) & (cand["longitude"] - lo).abs().le(2.0)]
        if len(cand):
            r = cand.loc[cand["mag"].idxmax()]
            m_isc = float(ml.mw_to_m0(r["mag"]))
            sub[r["id"]] = m0 * 1e20
            rows.append({"date": d, "m0_mg2000": m0 * 1e20, "mw_mg2000": float(ml.m0_to_mw(m0 * 1e20)),
                         "iscgem_id": r["id"], "iscgem_mw": float(r["mag"]), "iscgem_mw_err": float(r["magError"]),
                         "m0_iscgem": m_isc})
            iscgem_sum += m_isc
        else:
            rows.append({"date": d, "m0_mg2000": m0 * 1e20, "mw_mg2000": float(ml.m0_to_mw(m0 * 1e20)), "iscgem_id": None})
            iscgem_sum += m0 * 1e20
    u_iscgem = ml.kostrov_shortening(iscgem_sum, P["mu"], P["h"], P["length"], P["years"]) * 1e3

    ev = zi["events"].copy()
    m0_sub = np.where(ev["id"].isin(sub), ev["id"].map(sub).astype(float), ml.mw_to_m0(ev["mag"].to_numpy(float)))
    mw_sub = ml.m0_to_mw(m0_sub)
    ms_sub, _ = ml.bandwise_moment_rate(mw_sub, ev["year"].to_numpy(float), BANDS, t_end)
    ms, _ = ml.bandwise_moment_rate(ev["mag"].to_numpy(float), ev["year"].to_numpy(float), BANDS, t_end)
    L = 0.0
    north = TIENSHAN[12:][::-1]            # the north edge, west to east, as the strike line
    for (x0, y0), (x1, y1) in zip(north[:-1], north[1:]):
        L += ml.R_EARTH * np.hypot(np.radians(x1 - x0) * np.cos(np.radians((y0 + y1) / 2)), np.radians(y1 - y0))
    mu = rng.uniform(*MU_RANGE, N_MC)
    H = rng.uniform(*H_RANGE, N_MC)
    models = sorted(zi["integ"])
    integ = np.array([zi["integ"][m] for m in models])[rng.integers(0, len(models), N_MC)]
    mg = 2 * mu * H * integ
    return {"u_paper_from_mnn_mm_yr": u_paper, "u_paper_from_table_sum_mm_yr": u_table,
            "u_same_events_iscgem_moments_mm_yr": u_iscgem, "events": rows,
            "published": {"u_seis_mm_yr": [7.0, 2.0], "u_gps_west_mm_yr": 20.0},
            "length_km": L / 1e3,
            "u_seis_ours_mm_yr": ml.ratio_summary(ms / (2 * mu * H * L) * 1e3),
            "u_geod_ours_mm_yr": ml.ratio_summary(mg / (2 * mu * H * L) * 1e3),
            "r_obs_iscgem": ml.ratio_summary(ms / mg),
            "r_obs_with_mg2000_moments": ml.ratio_summary(ms_sub / mg), "ms_obs_with_mg2000_moments": ms_sub}


# ----------------------------------------------------------------------------------------------- output
def r3(x, n=3):
    return None if x is None or not np.isfinite(x) else float(f"{x:.{n}g}")


def props(zid, name, res, area_m2):
    p = {"id": zid, "name": name, "area_km2": round(area_m2 / 1e6), "q": res["q"], "n6": res["n6"],
         "n_ev": res["n_events"], "mw_max": res["mw_max"], "mw_max_yr": res["mw_max_year"],
         "models": res["models"], "ms_obs": r3(res["ms_obs"])}
    if res["q"] == "nogeod":
        return p
    for k in ("mg", "ms_tgr", "r_obs", "r_tgr"):
        s = res[k]
        p[k], p[k + "_lo"], p[k + "_hi"] = r3(s["med"]), r3(s["lo"]), r3(s["hi"])
    # central r_obs: catalogue Mw as reported (geodetic spread only); its interval also carries the Mw uncertainty
    p["r_obs"] = r3(res["r_obs_point"]["med"])
    p["r_obs_x1"] = r3(res["r_obs_x1"]["med"])
    p["p_full"], p["p_half"] = r3(res["p_full"], 2), r3(res["p_half"], 2)
    p["mc_bal"] = r3(res["mc_bal_full"]["med"])
    p["unbal"] = r3(res["unbalanced_full"], 2)
    p["over"] = r3(res["over_budget_full"], 2)
    p["cov_min"] = r3(min(res["cov"][m] for m in res["models"]), 2)
    return p


def round_geom(geom):
    def rr(c):
        return [rr(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 3), round(c[1], 3)]
    gj = mapping(geom)
    return {"type": gj["type"], "coordinates": rr(gj["coordinates"])}


def main():
    rng = np.random.default_rng(SEED)
    g, LO, LA, area = load_models()
    ev, t_end = load_catalogue()
    ts = Polygon(TIENSHAN)
    # b (hence beta) for the whole belt, bootstrap
    sel = shapely.contains_xy(ts, ev["longitude"].to_numpy(), ev["latitude"].to_numpy()) & (ev["year"] >= 1976)
    mb = ev.loc[sel, "mag"].to_numpy(float)
    # binned estimate: b_aki bins to DM and keeps bins >= B_MIN, i.e. Mw >= B_MIN - DM/2 (before 0.6.0 the sample
    # was cut at Mw >= 5.80 first, so bin 5.8 lost its 5.75-5.79 events and b came out low)
    b, bsig, nb, _ = sl.b_aki(mb, B_MIN, DM)
    b_boot = np.array([sl.b_aki(rng.choice(mb, mb.size), B_MIN, DM)[0] for _ in range(2000)])
    b_boot = b_boot[np.isfinite(b_boot)]
    print(f"b (Mw>={B_MIN}, 1976-cut-off, whole belt) = {b:.3f} +/- {bsig:.3f}, n = {nb}; "
          f"bootstrap 95% [{np.percentile(b_boot, 2.5):.3f}, {np.percentile(b_boot, 97.5):.3f}]")

    regions, results = [], {"b": {"b": b, "sigma": bsig, "n": nb, "boot95": np.percentile(b_boot, [2.5, 97.5])}}
    zi_whole = None
    for zid, name, lons in REGIONS:
        poly = ts if lons is None else ts.intersection(box(lons[0], 30, lons[1], 50))
        zi = zone_inputs(poly, g, LO, LA, area, ev)
        if zid == "tienshan":
            zi_whole = zi
        res = zone_mc(zi, t_end, b_boot, rng)
        results[zid] = res
        regions.append({"type": "Feature", "geometry": round_geom(poly), "properties": props(zid, name, res, zi["area_m2"])})
        print(zid, {k: res[k] for k in ("n6", "ms_obs", "models")}, "r_obs", res.get("r_obs"), "r_tgr",
              res.get("r_tgr"), "p_full", res.get("p_full"), "mc_bal", res.get("mc_bal_full"))

    # H3 resolution-2 cells that overlap the outline by >= CELL_OVERLAP of their area (evaluated over the whole cell)
    cand = {h3.latlng_to_cell(la, lo, H3_RES) for la in np.arange(38.5, 46.0, 0.25) for lo in np.arange(68, 93, 0.25)}
    cells = []
    for c in sorted(cand):
        la, lo = h3.cell_to_latlng(c)
        poly = Polygon([(x, y) for y, x in h3.cell_to_boundary(c)])
        if poly.intersection(ts).area / poly.area < CELL_OVERLAP:
            continue
        zi = zone_inputs(poly, g, LO, LA, area, ev)
        res = zone_mc(zi, t_end, b_boot, rng)
        results["cell_" + c] = res
        p = props(c, c, res, zi["area_m2"])
        p.update({"lat": round(la, 3), "lon": round(lo, 3)})
        p.pop("name")
        cells.append({"type": "Feature", "geometry": round_geom(poly), "properties": p})
    print("cells", len(cells))

    val = {"chang2025_west_of_82E": validate_chang_west_fraction(g, LO, LA, area),
           "molnar_ghose2000": validate_molnar_ghose(zi_whole, rng, ev, t_end)}
    results["validation"] = val
    print(json.dumps(val, indent=1, default=float)[:3000])

    OUT.mkdir(parents=True, exist_ok=True)
    jdump({"type": "FeatureCollection", "features": regions}, OUT / "regions.geojson")
    jdump({"type": "FeatureCollection", "features": cells}, OUT / "cells.geojson")
    index = {
        "layer": "seismic deficit (pilot: Tien Shan)",
        "version": VERSION, "data_cutoff_utc": CUTOFF,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "disclaimer": ("Not a forecast and not a hazard map. The ratio compares about 120 years of earthquakes with "
                       "a few decades of geodetic strain; recurrence times of the largest Tien Shan earthquakes are "
                       "centuries or longer, part of the strain may be released aseismically, and full seismic "
                       "coupling is an assumption. A low ratio is not evidence that an earthquake is due."),
        "licence": {"data": "CC BY-SA 4.0 (derived from ISC-GEM CC BY-SA 3.0 and the strain-rate models CC BY 4.0)"},
        "attribution": ("Strain rates: Ou et al. (2026), doi:10.5281/zenodo.20293601, and Chang (2025), "
                        "doi:10.5281/zenodo.16547905, both CC BY 4.0. Earthquakes: ISC-GEM catalogue (CC BY-SA 3.0) "
                        "and USGS ComCat. Seismic-deficit analysis: Global Seismicity Atlas, CC BY-SA 4.0."),
        "sources": [
            {"name": "GNSS and InSAR velocities, vorticity and strain rates across the Tian Shan",
             "authors": "Ou, Q., Elliott, J., Maghsoudi, Y., Rollins, C., Lazecky, M., Wright, T.", "year": 2026,
             "doi": "10.5281/zenodo.20293601", "licence": "CC BY 4.0", "role": "strain-rate model ou2026",
             "files": "dvedx.nc, dvndy.nc, dxy.nc (0.05 degree, nanostrain/yr)"},
            {"name": "Geodetic Strain Rates, Slip Deficit Rates, and Seismic Potential in Tianshan, Central Asia (data)",
             "authors": "Chang, F.", "year": 2025, "doi": "10.5281/zenodo.16547905", "licence": "CC BY 4.0",
             "role": "strain-rate models chang_bforstrain, chang_gpsgridder, chang_locavggrad, chang_visr",
             "paper": "Chang et al. (2025) GRL 52, e2025GL118470, doi:10.1029/2025GL118470"},
            {"name": "ISC-GEM Global Instrumental Earthquake Catalogue", "licence": "CC BY-SA 3.0",
             "role": f"seismic moment 1904-{ISCGEM_LAST_YEAR}", "citation": "Storchak et al. 2013; Di Giacomo et al. 2018"},
            {"name": "USGS ComCat", "licence": "public domain",
             "role": f"seismic moment {ISCGEM_LAST_YEAR + 1}-cut-off, Mw types only"},
        ],
        "not_used": [{"name": "GSRM v2.1 (Kreemer et al. 2014, G3 15, 3849-3889)",
                      "reason": "GEM product page states CC BY-NC-SA 4.0 in its text and CC BY-SA 3.0 in its licence "
                                "heading; the non-commercial term is incompatible with this atlas's CC BY-SA 4.0 data "
                                "licence and the page is contradictory, so no global layer was built from it"}],
        "method": {
            "geodetic": "Mdot_g = 2 mu H sum(A max(|e1|,|e2|,|e1+e2|)) (Kostrov 1974; Savage & Simpson 1997), full coupling",
            "mu_pa": list(MU_RANGE), "h_m": list(H_RANGE), "strain_models": MODELS, "min_model_coverage": MIN_COV,
            "seismic_observed": "band-wise sum over each band's complete period (Michael 2014 ISC-GEM shallow)",
            "bands": [{"mw_lo": a, "mw_hi": None if c > 90 else c, "from": int(y)} for a, c, y in BANDS],
            "seismic_tgr": "alpha(Mw>=6.0 since 1964) x mean moment of a tapered G-R (Kagan 2002)",
            "b_whole_belt": {"b": r3(b), "sigma": r3(bsig), "n": nb, "mw_min": B_MIN, "years": [1976, CUTOFF[:4]]},
            "corner_mw": list(MC_RANGE), "depth_max_km": 70, "monte_carlo_draws": N_MC, "catalogue_sims": N_SIM,
            "seed": SEED,
        },
        "validation": {
            "chang2025_west_of_82E": {m: {k: r3(v, 3) for k, v in d.items()} for m, d in val["chang2025_west_of_82E"].items()},
            "molnar_ghose2000": {k: (r3(v) if isinstance(v, float) else v) for k, v in val["molnar_ghose2000"].items()
                                 if k != "events"},
        },
        "regions": [f["properties"] for f in regions],
        "files": {"regions.geojson": "one polygon per region", "cells.geojson": "one polygon per H3 res-2 cell"},
    }
    index["files"] = {f: {"what": w, "bytes": (OUT / f).stat().st_size}
                      for f, w in (("regions.geojson", "one polygon per region"),
                                   ("cells.geojson", "one polygon per H3 resolution-2 cell"))}
    jdump(index, OUT / "index.json", indent=1)
    jdump(results, WD / "results.json", indent=1)
    for f in ("index.json", "regions.geojson", "cells.geojson"):
        print(f, (OUT / f).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
