"""Groningen induced-seismicity case study: event rate vs production, b in time and space, validation.

Inputs: data/work/induced/ (written by fetch_groningen.py). Outputs: site/data/induced/groningen/*.json and
docs/img/induced-groningen-*.png. Everything here is a retrospective description of the published catalogue and
production record. Nothing is a forecast.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import atlaslib as al  # noqa: E402
import common  # noqa: E402
import inducedlib as il  # noqa: E402
import seislib as sl  # noqa: E402
from fetch_groningen import CUTOFF  # noqa: E402

WORK = common.ROOT / "data" / "work" / "induced"
OUT = common.SITE / "induced" / "groningen"
IMG = common.IMG
SEED = 20261114
NBOOT = 1000

REGION_BUFFER_M = 2000.0     # study region = NLOG field outline + 2 km (reproduces Dost et al. 2017 event counts)
MC_RATE = 1.5                # ML; the network design level, "Until 2014 Mc = 1.5 was adopted" (Dost et al. 2017)
BPOS_FLOOR = 0.5             # ML; lowest magnitude entering b-positive ("down to ~ ML = 0.5", Dost et al. 2017)
NS_SPLIT_RD_Y = 593000.0     # RD northing that divides the north and south sub-fields (Gulia 2023; Gulia & Wiemer 2026)
MAP_SPACING_M, MAP_RADIUS_M = 1000.0, 5000.0   # as in Gulia (2023) and Gulia & Wiemer (2026)
MOVING_WINDOW = 200          # events per moving window (Gulia & Wiemer 2026)

# Milestones. Each one is either a catalogue fact or quoted in docs/induced.md with its source.
MILESTONES = [
    {"date": "2012-08-16", "label": "Huizinge ML 3.6", "kind": "event", "short": "Huizinge ML 3.6"},
    {"date": "2014-01-01", "label": "Production restrictions begin (early 2014)", "kind": "policy", "short": "Restrictions"},
    {"date": "2018-01-08", "label": "Zeerijp ML 3.4", "kind": "event", "short": "Zeerijp ML 3.4"},
    {"date": "2023-10-01", "label": "Production stopped", "kind": "policy", "short": "Production stop"},
    {"date": "2024-04-17", "label": "Closure act (Wet van 17 april 2024)", "kind": "policy", "short": "Closure act"},
    {"date": "2025-11-14", "label": "Zeerijp ML 3.4", "kind": "event", "short": "Zeerijp ML 3.4"},
]
PHASES = [  # [start, end) in months
    ("1991-01", "2003-01", "1991-2002: before the production rise"),
    ("2003-01", "2014-01", "2003-2013: rising production"),
    ("2014-01", "2019-01", "2014-2018: production restrictions"),
    ("2019-01", "2023-10", "2019-Sep 2023: phase-out"),
    ("2023-10", CUTOFF[:7], "Oct 2023-Oct 2026: after shut-in"),
]
MAP_PERIODS = [(1991, 2014, "1991-2013"), (2014, 2026.84, "2014-Oct 2026")]


# ------------------------------------------------------------------------------------------------ load
def load():
    ev = pd.read_pickle(WORK / "groningen_events.pkl")
    ev = ev[(ev.etype == "induced or triggered event") & ev.mag.notna()].copy()
    gj = json.loads((WORK / "groningen_outline.geojson").read_text())
    geom = il.outline_rd(gj)
    ev["x"], ev["y"] = il.to_rd(ev.lon.values, ev.lat.values)
    ev["in_outline"] = il.inside(geom, ev.x, ev.y)
    ev["in_region"] = il.inside(geom, ev.x, ev.y, REGION_BUFFER_M)
    ev["yr"] = common.decimal_year(ev.time)
    ev["mb"] = sl.bin_mag(ev.mag.values)
    ev = ev.sort_values("time").reset_index(drop=True)
    pr = pd.read_csv(WORK / "groningen_production.csv")
    pr["bcm"] = pr.gas_1e3m3 / 1e6        # 1e3 m3 -> 1e9 m3
    return ev, pr, geom, gj


def poisson_ci(k, T):
    lo = stats.chi2.ppf(0.025, 2 * k) / 2 if k > 0 else 0.0
    hi = stats.chi2.ppf(0.975, 2 * (k + 1)) / 2
    return k / T, lo / T, hi / T


# ------------------------------------------------------------------------------------------------ rates
def rates(ev, pr):
    reg = ev[ev.in_region]
    months = pd.period_range("1991-01", pd.Period(CUTOFF[:7], "M") - 1, freq="M")
    n15 = il.monthly_counts(reg.time, reg.mag.values, MC_RATE, months)
    prod = pr.set_index("month").bcm.reindex(months.astype(str))
    monthly = pd.DataFrame({"month": months.astype(str), "n_ge15": n15, "prod_bcm": prod.values})
    monthly["year"] = monthly.month.str[:4].astype(int)
    ann = monthly.groupby("year").agg(n_ge15=("n_ge15", "sum"), prod_bcm=("prod_bcm", lambda s: s.sum(min_count=12)),
                                       months=("n_ge15", "size")).reset_index()
    both = ann[(ann.year >= 2003) & (ann.year <= 2024)]
    rho, p = stats.spearmanr(both.prod_bcm, both.n_ge15)
    # one-year lag: production in year y vs events in year y+1
    lag = ann.set_index("year")
    yl = np.arange(2003, 2025)
    rho1, p1 = stats.spearmanr(lag.prod_bcm.reindex(yl).values, lag.n_ge15.reindex(yl + 1).values)
    ph = []
    for a, b, lab in PHASES:
        sel = (monthly.month >= a) & (monthly.month < b)
        T = sel.sum() / 12.0
        k = int(monthly.n_ge15[sel].sum())
        r, lo, hi = poisson_ci(k, T)
        pp = monthly.prod_bcm[sel]
        ph.append({"label": lab, "start": a, "end": b, "years": round(T, 3), "n_ge15": k, "rate_per_yr": r,
                   "rate_lo": lo, "rate_hi": hi,
                   "prod_bcm_per_yr": float(pp.sum() / T) if pp.notna().all() else None,
                   "prod_note": None if pp.notna().all() else "NLOG monthly figures start in 2003"})
    big = reg[reg.mb >= 3.0][["time", "lat", "lon", "mag", "id"]]
    return monthly, ann, ph, {"spearman_rho": rho, "p": p, "years": "2003-2024", "lag1_rho": rho1, "lag1_p": p1,
                              "n_years": int(len(both))}, big


# ------------------------------------------------------------------------------------------------ b in time
def period_b(m_ordered, rng):
    """Atlas cell_b (data-driven Mc) + fixed-Mc 1.5 b + b-positive for one sample of time-ordered magnitudes."""
    r = al.cell_b(m_ordered, np.full(m_ordered.size, -9.0), nboot=NBOOT, rng=rng)
    f = il.b_fixed(m_ordered, MC_RATE, nboot=NBOOT, rng=rng)
    p = al.cell_bpos(m_ordered, BPOS_FLOOR)
    return {"n_all": int(m_ordered.size),
            "atlas": {k: r.get(k) for k in ("mc", "n_b", "b_raw", "b_lo_raw", "b_hi_raw", "quality")},
            "mc15": f, "bpos": p}


def b_time(ev, rng):
    reg = ev[ev.in_region]
    phases = []
    for a, b, lab in PHASES:
        s = reg[(reg.time >= f"{a}-01") & (reg.time < f"{b}-01")]
        phases.append({"label": lab, "start": a, "end": b, **period_b(s.mag.values, rng)})
    moving = {}
    for name, sel in (("field", np.ones(len(reg), bool)), ("north", reg.y.values >= NS_SPLIT_RD_Y),
                      ("south", reg.y.values < NS_SPLIT_RD_Y)):
        s = reg[sel]
        moving[name] = il.moving_bpos(s.yr.values, s.mag.values, BPOS_FLOOR, MOVING_WINDOW, step=5, nboot=200,
                                      rng=rng)
    return phases, moving


# ------------------------------------------------------------------------------------------------ b in space
def b_maps(ev, geom, rng):
    reg = ev[ev.in_region]
    nx, ny = il.grid_nodes(geom, MAP_SPACING_M, REGION_BUFFER_M)
    out = {}
    for y0, y1, lab in MAP_PERIODS + [(2014, 2023, "2014-2022")]:
        s = reg[(reg.yr >= y0) & (reg.yr < y1)]
        floor_mc = float(sl.mc_maxc(s.mb.values, 0.1, 0.2))      # field-wide MAXC + 0.2 of the period
        df = il.b_map(nx, ny, s.x.values, s.y.values, s.mag.values, np.full(len(s), floor_mc), BPOS_FLOOR,
                      MAP_RADIUS_M, nboot=200, rng=rng)
        df["lon"], df["lat"] = il.from_rd(df.x.values, df.y.values)
        out[lab] = {"floor_mc": floor_mc, "n_events": int(len(s)), "nodes": df}
    return out


# ------------------------------------------------------------------------------------------------ validation
def verdict_sigma(pub, sig_pub, ours, lo, hi):
    so = (hi - lo) / 3.92
    z = abs(ours - pub) / np.hypot(sig_pub, so)
    return ("consistent" if z <= 1.96 else "differs"), float(z)


def verdict_range(a, b, lo, hi):
    return "consistent" if (lo <= b and hi >= a) else "differs"


def validation(ev, moving, maps, geom, rng):
    rows = []
    reg = ev[ev.in_region]
    out = ev[ev.in_outline]
    # Kraaijpoel et al. 2022: outline only, 1995-01-01 .. 2022-01-01, unrounded ML >= 1.45
    k = out[(out.time >= "1995-01-01") & (out.time < "2022-01-01")]
    n145 = int((k.mag >= 1.45).sum())
    rows.append({"id": "K22-n", "source": "Kraaijpoel et al. 2022", "quantity": "events ML>=1.45, 1995-2021, outline",
                 "published": 336, "ours": n145, "verdict": "matches" if abs(n145 - 336) / 336 <= 0.03 else "differs",
                 "note": "NLOG outline vs NAM (2021) outline used in the paper"})
    f = il.b_fixed(k.mag.values, 1.5, nboot=NBOOT, rng=rng)
    mm = k.mag.values[k.mag.values >= 1.45]
    b_unb = float(sl.LOG10E / (mm.mean() - 1.45))
    v, z = verdict_sigma(0.96, 0.0, f["b"], f["lo"], f["hi"])
    rows.append({"id": "K22-b", "source": "Kraaijpoel et al. 2022", "quantity": "field b, ML>=1.45, 1995-2021",
                 "published": 0.96, "ours": f["b"], "ours_lo": f["lo"], "ours_hi": f["hi"], "n": f["n"],
                 "ours_unbinned": b_unb, "verdict": v, "z": z,
                 "note": "binned Aki-Utsu (atlas) and unbinned MLE (paper's choice) both shown"})
    # Dost et al. 2017: event counts (all magnitudes) and b per interval; Mc of the b-values is not stated
    for a, b, n, bp, sp in [("1996", "2003", 99, 1.06, 0.07), ("2003", "2017", 887, 0.93, 0.03),
                            ("2004", "2010", 204, 0.91, 0.06), ("2010", "2013", 210, 1.06, 0.07),
                            ("2013", "2015", 199, 0.88, 0.06), ("2015", "2017", 227, 0.93, 0.06)]:
        q = reg[(reg.time >= f"{a}-01-01") & (reg.time < f"{b}-01-01")]
        r = al.cell_b(q.mag.values, np.full(len(q), -9.0), nboot=NBOOT, rng=rng)
        v, z = verdict_sigma(bp, sp, r["b_raw"], r["b_lo_raw"], r["b_hi_raw"])
        if r["n_b"] < al.NMIN_B:
            v = "not testable"
        sens = {f"{mc:.1f}": round(il.b_fixed(q.mag.values, mc, nboot=200, rng=rng)["b"], 3) for mc in (1.0, 1.2, 1.5)}
        rows.append({"id": f"D17-{a}-{b}", "source": "Dost et al. 2017", "quantity": f"b {a}-{b}",
                     "published": bp, "published_sigma": sp, "published_n_all": n, "ours_n_all": int(len(q)),
                     "ours": r["b_raw"], "ours_lo": r["b_lo_raw"], "ours_hi": r["b_hi_raw"], "ours_mc": r["mc"],
                     "n": r["n_b"], "b_at_fixed_mc": sens, "verdict": v, "z": z,
                     "note": "ours: atlas MAXC+0.2 estimator; the paper does not state its Mc"})
    # Gulia & Wiemer 2026, time series (KNMI pre-2015 + SIR24 2015-2022): north ~0.8, south 1.0-1.3, 2012-mid 2015
    for name, pub, kind in (("north", (0.8, 0.8), "approx"), ("south", (1.0, 1.3), "range")):
        s = reg[(reg.time >= "2012-01-01") & (reg.time < "2015-07-01")]
        s = s[(s.y >= NS_SPLIT_RD_Y) if name == "north" else (s.y < NS_SPLIT_RD_Y)]
        p = al.cell_bpos(s.mag.values, BPOS_FLOOR)
        mv = moving[name]
        mv = mv[(mv.t >= 2012.0) & (mv.t < 2015.5)]
        lo, hi = p["bpos_lo"], p["bpos_hi"]
        v = verdict_range(pub[0], pub[1], lo, hi) if np.isfinite(p["bpos"]) else "not testable"
        rows.append({"id": f"GW26-ts-{name}", "source": "Gulia & Wiemer 2026",
                     "quantity": f"b {name} sub-field, 2012-mid 2015",
                     "published": pub[0] if kind == "approx" else list(pub), "ours": p["bpos"], "ours_lo": lo,
                     "ours_hi": hi, "n": p["n_bpos"],
                     "ours_moving_range": [round(float(mv.b.min()), 3), round(float(mv.b.max()), 3)] if len(mv) else None,
                     "verdict": v, "note": "ours: b-positive on KNMI only, ML>=0.5, all events of the interval pooled (needs >= 50"
                                                 " differences); moving 200-event windows ending in the interval"
                                                 " give the range shown; paper: composite catalogue"})
    # Gulia & Wiemer 2026: the north and south series "converge towards comparable values (0.9 around 2022)"
    for name in ("north", "south"):
        mv = moving[name]
        w = mv.iloc[int(np.argmin(np.abs(mv.t.values - 2022.5)))]
        rows.append({"id": f"GW26-2022-{name}", "source": "Gulia & Wiemer 2026",
                     "quantity": f"b {name} sub-field around 2022", "published": 0.9, "ours": float(w.b),
                     "ours_lo": float(w.lo), "ours_hi": float(w.hi), "n": int(w.n_diff),
                     "window_years": [round(float(w.t0), 2), round(float(w.t), 2)],
                     "verdict": "consistent" if w.lo <= 0.9 <= w.hi else "differs",
                     "note": "ours: b-positive, the 200-event window (ML>=0.5, KNMI only) ending closest to mid-2022"})
    # Gulia & Wiemer 2026 maps 2014-2022: "values typically in the range 0.8-1.0"
    nd = maps["2014-2022"]["nodes"]
    ok = nd[np.isfinite(nd.bpos)]
    q25, q50, q75 = np.percentile(ok.bpos, [25, 50, 75]) if len(ok) else (np.nan,) * 3
    sens = {}
    for rad in (7000.0, 10000.0):
        s = reg[(reg.yr >= 2014) & (reg.yr < 2023)]
        nx, ny = il.grid_nodes(geom, MAP_SPACING_M, REGION_BUFFER_M)
        d2 = il.b_map(nx, ny, s.x.values, s.y.values, s.mag.values, np.full(len(s), 9.0), BPOS_FLOOR, rad,
                      nboot=1, rng=rng)
        okr = np.isfinite(d2.bpos)
        sens[f"{rad/1e3:.0f}km"] = {"n_nodes_mapped": int(okr.sum()),
                                     "median": float(np.median(d2.bpos[okr])) if okr.any() else None}
    rows.append({"id": "GW26-map", "source": "Gulia & Wiemer 2026", "quantity": "b-positive map 2014-2022, mapped nodes",
                 "published": [0.8, 1.0], "ours": float(q50), "ours_lo": float(q25), "ours_hi": float(q75),
                 "n": int(len(ok)), "n_nodes": int(len(nd)), "radius_sensitivity": sens,
                 "verdict": verdict_range(0.8, 1.0, q25, q75),
                 "note": "ours: median and inter-quartile range of node b-positive (KNMI only, 1-km grid, 5-km radius,"
                         " >=50 differences); paper: composite catalogue"})
    # field-wide 2015-2022 vs SIR24 deep-learning catalogue b ~ 0.86 (different catalogue, context only)
    s = reg[(reg.time >= "2015-01-01") & (reg.time < "2023-01-01")]
    r = al.cell_b(s.mag.values, np.full(len(s), -9.0), nboot=NBOOT, rng=rng)
    p = al.cell_bpos(s.mag.values, BPOS_FLOOR)
    rows.append({"id": "SIR24-field", "source": "Sirorattanakul et al. 2024 (quoted by Gulia & Wiemer 2026)",
                 "quantity": "field b 2015-2022", "published": 0.86, "ours": r["b_raw"], "ours_lo": r["b_lo_raw"],
                 "ours_hi": r["b_hi_raw"], "ours_mc": r["mc"], "n": r["n_b"], "ours_bpos": p["bpos"],
                 "ours_bpos_ci": [p["bpos_lo"], p["bpos_hi"]],
                 "verdict": "consistent" if r["b_lo_raw"] <= 0.86 <= r["b_hi_raw"] else "differs",
                 "note": "the published value comes from a different (deep-learning) catalogue: context, not a strict test"})
    # Gulia 2023 as quoted by Gulia & Wiemer 2026: "~0.7-0.8 in the field following the shift in production in 2014"
    s = reg[(reg.time >= "2014-01-01") & (reg.time < "2023-01-01")]
    r = al.cell_b(s.mag.values, np.full(len(s), -9.0), nboot=NBOOT, rng=rng)
    rows.append({"id": "G23-post2014", "source": "Gulia 2023 (quoted by Gulia & Wiemer 2026)",
                 "quantity": "field b 2014-2022", "published": [0.7, 0.8], "ours": r["b_raw"], "ours_lo": r["b_lo_raw"],
                 "ours_hi": r["b_hi_raw"], "ours_mc": r["mc"], "n": r["n_b"],
                 "verdict": verdict_range(0.7, 0.8, r["b_lo_raw"], r["b_hi_raw"]),
                 "note": "ours: atlas MAXC+0.2 estimator, region pooled; paper's period and estimator details differ"})
    return rows


# ------------------------------------------------------------------------------------------------ figures
def fig_rate(monthly, ph, big):
    plt = common.setup_mpl()
    import matplotlib.dates as mdates
    t = pd.PeriodIndex(monthly.month, freq="M").to_timestamp()
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(9.5, 6.2), sharex=True, gridspec_kw={"height_ratios": [1, 1.25]})
    a1.bar(t, monthly.prod_bcm, width=25, color=common.C1, lw=0)
    a1.set_ylabel("Gas production\n(10⁹ m³ per month)")
    top = float(np.nanmax(monthly.prod_bcm)) * 1.55
    a1.set_ylim(0, top)
    a1.set_title("Groningen: monthly gas production (NLOG) and earthquakes ML ≥ 1.5 (KNMI)", loc="left")
    a2.bar(t, monthly.n_ge15, width=25, color=common.MUTED, lw=0, label="events per month")
    roll = monthly.n_ge15.rolling(12, center=True).sum()
    a2b = a2.twinx()
    a2b.plot(t, roll, color=common.C2, lw=1.8, label="12-month running total")
    a2b.set_ylabel("12-month total", color=common.C2)
    a2b.spines["right"].set_visible(True)
    a2b.grid(False)
    a2.set_ylabel("Events ML ≥ 1.5 per month")
    for m in MILESTONES:
        d = pd.Timestamp(m["date"])
        for ax in (a1, a2):
            ax.axvline(d, color=common.INK2 if m["kind"] == "policy" else common.C8, lw=0.8,
                       ls="--" if m["kind"] == "policy" else ":")
        a1.text(d, top * 0.99, m["short"], rotation=90, va="top", ha="right", fontsize=7, color=common.INK2,
                bbox=dict(boxstyle="square,pad=0.1", fc=common.SURFACE, ec="none"))
    for _, r in big.iterrows():
        a2.plot(r.time.tz_localize(None), monthly.n_ge15.max() * 1.02, marker="v", color=common.C8, ms=4 + 3 * (r.mag - 3))
    a2.text(0.005, 0.97, "▼ ML ≥ 3.0 events", transform=a2.transAxes, color=common.C8, fontsize=7.5, va="top")
    a2.xaxis.set_major_locator(mdates.YearLocator(4))
    a2.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    a2.set_xlim(pd.Timestamp("1991-01-01"), pd.Timestamp(CUTOFF))
    fig.text(0.01, 0.005, "Retrospective description, not a forecast. NLOG monthly production starts in 2003. "
             "Study region: NLOG field outline + 2 km.", fontsize=7, color=common.MUTED)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(IMG / "induced-groningen-rate.png")
    plt.close(fig)


def fig_btime(phases, moving):
    plt = common.setup_mpl()
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(10, 3.9), gridspec_kw={"width_ratios": [1, 1.6]})
    lab = [p["label"].split(":")[0] for p in phases]
    xs = np.arange(len(phases))
    for off, key, col, name in ((-0.18, "atlas", common.C1, "atlas b (MAXC+0.2)"),
                                (0.0, "mc15", common.C7, "Aki-Utsu, fixed ML 1.5"),
                                (0.18, "bpos", common.C2, "b-positive (ML ≥ 0.5)")):
        if key == "mc15":
            b = [p["mc15"]["b"] for p in phases]
            lo = [p["mc15"]["lo"] for p in phases]
            hi = [p["mc15"]["hi"] for p in phases]
        elif key == "atlas":
            b = [p["atlas"]["b_raw"] for p in phases]
            lo = [p["atlas"]["b_lo_raw"] for p in phases]
            hi = [p["atlas"]["b_hi_raw"] for p in phases]
        else:
            b = [p["bpos"]["bpos"] for p in phases]
            lo = [p["bpos"]["bpos_lo"] for p in phases]
            hi = [p["bpos"]["bpos_hi"] for p in phases]
        b, lo, hi = (np.array(v, float) for v in (b, lo, hi))
        a1.errorbar(xs + off, b, yerr=[b - lo, hi - b], fmt="o", color=col, capsize=3, label=name)
    a1.set_xticks(xs, lab, rotation=25, ha="right", fontsize=8)
    a1.set_ylabel("b (95 % interval)")
    a1.set_title("b by production phase", loc="left")
    a1.legend(fontsize=7.5, loc="upper left")
    for name, col in (("north", common.C8), ("south", common.C3)):
        mv = moving[name]
        a2.fill_between(mv.t, mv.lo, mv.hi, color=col, alpha=0.18, lw=0)
        a2.plot(mv.t, mv.b, color=col, lw=1.5, label=f"{name} of RD y = 593 km")
    a2.set_title(f"b-positive, moving {MOVING_WINDOW}-event windows (ML ≥ {BPOS_FLOOR})", loc="left")
    a2.set_ylabel("b-positive (95 % bootstrap)")
    a2.axvline(2014.04, color=common.INK2, lw=0.8, ls="--")
    a2.axvline(2023.75, color=common.INK2, lw=0.8, ls="--")
    a2.legend(fontsize=7.5, loc="upper left")
    fig.text(0.01, 0.005, "KNMI catalogue only; window time = last event. Retrospective description, not a forecast.",
             fontsize=7, color=common.MUTED)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(IMG / "induced-groningen-b-time.png")
    plt.close(fig)


def fig_bmap(maps, geom, ev):
    plt = common.setup_mpl()
    from matplotlib.colors import Normalize
    labs = [lab for _, _, lab in MAP_PERIODS]
    fig, axs = plt.subplots(1, 2, figsize=(10, 4.9), sharex=True, sharey=True)
    norm = Normalize(0.6, 1.4)
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list("b", ["#b2182b", "#f0efec", "#2166ac"])
    for ax, lab in zip(axs, labs):
        nd = maps[lab]["nodes"]
        ok = np.isfinite(nd.bpos)
        ax.scatter(nd.x[~ok] / 1e3, nd.y[~ok] / 1e3, s=4, color=common.GRID, marker="s", lw=0)
        sc = ax.scatter(nd.x[ok] / 1e3, nd.y[ok] / 1e3, c=nd.bpos[ok], s=9, marker="s", cmap=cmap, norm=norm, lw=0)
        polys = geom.geoms if hasattr(geom, "geoms") else [geom]
        for pg in polys:
            xx, yy = pg.exterior.xy
            ax.plot(np.array(xx) / 1e3, np.array(yy) / 1e3, color=common.INK, lw=0.9)
            for r in pg.interiors:
                xx, yy = r.xy
                ax.plot(np.array(xx) / 1e3, np.array(yy) / 1e3, color=common.INK, lw=0.6)
        ax.axhline(NS_SPLIT_RD_Y / 1e3, color=common.INK2, lw=0.7, ls=":")
        h = ev[(ev.mb >= 3.0) & ev.in_region]
        y0, y1 = [(a, b) for a, b, l in MAP_PERIODS if l == lab][0]
        h = h[(h.yr >= y0) & (h.yr < y1)]
        ax.scatter(h.x / 1e3, h.y / 1e3, marker="*", s=40, color=common.INK, lw=0, label="ML ≥ 3.0")
        ax.set_title(f"{lab}\nb-positive at {int(ok.sum())} of {len(nd)} nodes", loc="left")
        ax.set_aspect("equal")
        ax.set_xlabel("RD x (km)")
        ax.legend(fontsize=7.5, loc="lower right")
    axs[0].set_ylabel("RD y (km)")
    cb = fig.colorbar(sc, ax=axs, shrink=0.8, pad=0.02)
    cb.set_label("b-positive")
    fig.text(0.01, 0.01, f"1-km grid, {MAP_RADIUS_M/1e3:.0f}-km radius, ≥ 50 positive differences (ML ≥ {BPOS_FLOOR}); "
             "grey = not enough events. KNMI catalogue, NLOG field outline. Retrospective, not a forecast.",
             fontsize=7, color=common.MUTED)
    fig.savefig(IMG / "induced-groningen-b-map.png", bbox_inches="tight")
    plt.close(fig)


def fig_validation(rows):
    plt = common.setup_mpl()
    rr = [r for r in rows if isinstance(r.get("ours"), float) and np.isfinite(r["ours"]) and r["verdict"] != "not testable"]
    fig, ax = plt.subplots(figsize=(10, 0.42 * len(rr) + 1.2))
    for i, r in enumerate(rr):
        pub = r["published"]
        if isinstance(pub, list):
            ax.plot(pub, [i + 0.15] * 2, color=common.INK2, lw=4, alpha=0.5, solid_capstyle="butt")
        else:
            sp = r.get("published_sigma", 0.0) * 1.96
            ax.errorbar(pub, i + 0.15, xerr=sp if sp else None, fmt="s", color=common.INK2, ms=5, capsize=3)
        lo, hi = r.get("ours_lo"), r.get("ours_hi")
        col = common.C3 if r["verdict"] in ("consistent", "matches") else common.C8
        ax.errorbar(r["ours"], i - 0.15, xerr=[[r["ours"] - lo], [hi - r["ours"]]] if lo is not None else None,
                    fmt="o", color=col, capsize=3, ms=5)
    ax.set_yticks(range(len(rr)), [f'{r["source"].split(" (")[0].replace(" et al.", "")}: {r["quantity"]}' for r in rr], fontsize=7.5)
    ax.invert_yaxis()
    ax.set_xlabel("b-value")
    ax.set_title("Published (grey) vs this work (green: consistent, red: differs)", loc="left")
    fig.tight_layout()
    fig.savefig(IMG / "induced-groningen-validation.png")
    plt.close(fig)


# ------------------------------------------------------------------------------------------------ JSON
def r3(v):
    return None if v is None or (isinstance(v, float) and not np.isfinite(v)) else round(float(v), 3)


def write_json(ev, pr, gj, monthly, ann, ph, corr, big, phases, moving, maps, rows):
    OUT.mkdir(parents=True, exist_ok=True)
    common.jdump({
        "monthly": {"month": monthly.month.tolist(), "n_ge15": monthly.n_ge15.tolist(),
                    "prod_bcm": [r3(v) for v in monthly.prod_bcm]},
        "annual": {"year": ann.year.tolist(), "n_ge15": ann.n_ge15.tolist(),
                   "prod_bcm": [r3(v) for v in ann.prod_bcm], "months": ann.months.tolist()},
        "phases": [{k: (r3(v) if isinstance(v, float) else v) for k, v in p.items()} for p in ph],
        "correlation": {k: (float(f"{v:.3g}") if isinstance(v, float) else v) for k, v in corr.items()},
        "milestones": MILESTONES,
        "events_ge3": {"time": [t.strftime("%Y-%m-%dT%H:%M:%SZ") for t in big.time], "lat": [r3(v) for v in big.lat],
                       "lon": [r3(v) for v in big.lon], "ml": [round(float(v), 2) for v in big.mag],
                       "id": big.id.tolist()},
        "mc": MC_RATE,
    }, OUT / "rates.json")

    def mv(df):
        return {"t0": [round(v, 3) for v in df.t0], "t": [round(v, 3) for v in df.t], "b": [r3(v) for v in df.b], "lo": [r3(v) for v in df.lo],
                "hi": [r3(v) for v in df.hi], "n_diff": df.n_diff.tolist()}

    def ph_b(p):
        a, f, q = p["atlas"], p["mc15"], p["bpos"]
        return {"label": p["label"], "start": p["start"], "end": p["end"], "n_all": p["n_all"],
                "atlas": {"b": r3(a["b_raw"]), "lo": r3(a["b_lo_raw"]), "hi": r3(a["b_hi_raw"]), "mc": r3(a["mc"]),
                          "n": a["n_b"], "q": a["quality"]},
                "mc15": {"b": r3(f["b"]), "lo": r3(f["lo"]), "hi": r3(f["hi"]), "n": f["n"],
                         "q": al.quality(f["n"], f["lo"], f["hi"])},
                "bpos": {"b": r3(q["bpos"]), "lo": r3(q["bpos_lo"]), "hi": r3(q["bpos_hi"]), "n": q["n_bpos"]}}
    common.jdump({"phases": [ph_b(p) for p in phases], "moving": {k: mv(v) for k, v in moving.items()},
                  "window": MOVING_WINDOW, "bpos_floor": BPOS_FLOOR, "ns_split_rd_y": NS_SPLIT_RD_Y},
                 OUT / "btime.json")
    mp = {}
    for lab, d in maps.items():
        nd = d["nodes"]
        nd = nd[np.isfinite(nd.bpos) | np.isfinite(nd.b)]
        mp[lab] = {"n_nodes_grid": int(len(d["nodes"])),"floor_mc": d["floor_mc"], "n_events": d["n_events"],
                   "lon": [round(v, 4) for v in nd.lon], "lat": [round(v, 4) for v in nd.lat],
                   "n": nd.n.tolist(), "bpos": [r3(v) for v in nd.bpos], "bpos_lo": [r3(v) for v in nd.bpos_lo],
                   "bpos_hi": [r3(v) for v in nd.bpos_hi], "n_bpos": nd.n_bpos.tolist(),
                   "b": [r3(v) for v in nd.b], "b_lo": [r3(v) for v in nd.b_lo], "b_hi": [r3(v) for v in nd.b_hi],
                   "q": nd.q.tolist(), "mc": [r3(v) for v in nd.mc]}
    outline = gj["features"][0]["geometry"]
    outline = {"type": outline["type"],
               "coordinates": [[[round(x, 4), round(y, 4)] for x, y in ring] for ring in outline["coordinates"]]}
    common.jdump({"spacing_m": MAP_SPACING_M, "radius_m": MAP_RADIUS_M, "periods": mp, "outline": outline},
                 OUT / "bmap.json")
    common.jdump({"rows": [{k: (r3(v) if isinstance(v, float) else v) for k, v in r.items()} for r in rows]},
                 OUT / "validation.json", indent=1)
    files = sorted(p.name for p in OUT.glob("*.json") if p.name != "index.json")
    common.jdump({
        "id": "groningen", "title": "Groningen gas field (Netherlands)", "contract_version": 1,
        "catalogue_cutoff_utc": CUTOFF + "T00:00:00Z",
        "region": f"NLOG Groningen field outline (FIELD_CODE GRO) buffered by {REGION_BUFFER_M/1e3:.0f} km",
        "magnitude": "KNMI local magnitude ML (MagType MLn / MLnq), binned to 0.1 for statistics",
        "n_events_region": int(ev.in_region.sum()),
        "statement": "Retrospective description of the published catalogue and production record. "
                     "Not a forecast, not a hazard assessment.",
        "files": {f: (OUT / f).stat().st_size for f in files},
        "sources": [
            {"name": "KNMI earthquake catalogue (FDSN event service rdsa.knmi.nl)", "licence": "CC BY 4.0",
             "attribution": "Royal Netherlands Meteorological Institute (KNMI); Netherlands Seismic and Acoustic "
                            "Network, doi:10.21944/e970fd34-23b9-3411-b366-e4f72877d2c5",
             "redistributed": "derived aggregates and the list of ML >= 3.0 events only"},
            {"name": "NLOG production figures, Groningen field, monthly gas produced", "licence":
                "NLOG terms of use: reuse permitted provided NLOG.NL is quoted as the source",
             "attribution": "Source: NLOG.NL (TNO - Geological Survey of the Netherlands)",
             "redistributed": "monthly and annual totals"},
            {"name": "NLOG field outlines (gdw_ng_field_utm_v1, FIELD_CODE GRO)", "licence":
                "NLOG terms of use: reuse permitted provided NLOG.NL is quoted as the source",
             "attribution": "Source: NLOG.NL", "redistributed": "outline rings rounded to 1e-4 degrees"}],
    }, OUT / "index.json", indent=1)


def main():
    rng = np.random.default_rng(SEED)
    ev, pr, geom, gj = load()
    print(f"events: {len(ev)} induced in box, {ev.in_outline.sum()} in outline, {ev.in_region.sum()} in region")
    monthly, ann, ph, corr, big = rates(ev, pr)
    phases, moving = b_time(ev, rng)
    maps = b_maps(ev, geom, rng)
    rows = validation(ev, moving, maps, geom, rng)
    write_json(ev, pr, gj, monthly, ann, ph, corr, big, phases, moving, maps, rows)
    fig_rate(monthly, ph, big)
    fig_btime(phases, moving)
    fig_bmap(maps, geom, ev)
    fig_validation(rows)
    print(json.dumps({"corr": corr}, default=float))
    for p in ph:
        print(p)
    for p in phases:
        print(p["label"], p["n_all"], p["atlas"], {k: round(v, 3) if isinstance(v, float) else v for k, v in p["mc15"].items()}, p["bpos"])
    for lab, d in maps.items():
        nd = d["nodes"]
        ok = np.isfinite(nd.bpos)
        oka = np.isfinite(nd.b)
        print(lab, "floor", d["floor_mc"], "n", d["n_events"], "nodes", len(nd), "bpos mapped", ok.sum(),
              "median", np.nanmedian(nd.bpos), "atlas mapped", oka.sum())
    for r in rows:
        print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()})


if __name__ == "__main__":
    main()
