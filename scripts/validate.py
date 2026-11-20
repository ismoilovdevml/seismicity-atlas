"""Validation: synthetic recovery, global Mc/b vs Michael (2014), regional and plate-boundary-type b, sensitivities.

The atlas-method rows (global, regions, plate-boundary types, slab age) use the atlas b sample (common.b_sample_mask:
direct Mw only by default) and also report the same estimate on every event (`*_all_events`) for comparison.
The Michael (2014) rows use the whole catalogue, as Michael did.

Writes results/validation.json. Every number in docs/validation.md comes from that file.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402
from atlas import PERIODS, floor_of  # noqa: E402
from common import (B_MAGERR_MAX, ISCGEM_LAST_YEAR, MICHAEL_DEEP, MICHAEL_SHALLOW, RES, b_sample_label, b_sample_mask,  # noqa: E402
                    jdump, load_work)

RNG = 7
NBOOT = al.NBOOT  # 1000 since v0.5 for every published interval (200 / 500 / 100 before)


def synth_cell(n_above, b, mc, rng, width=0.1):
    m = sl.synth_gr(int(n_above * 40), b, mc - 1.5, rng=rng)
    p = 1 / (1 + np.exp(-(m - (mc - 0.2)) / width))
    m = m[rng.uniform(size=m.size) < p]
    k = int((m >= mc - 1e-9).sum())
    keep = rng.permutation(m.size)[: int(m.size * n_above / max(k, 1))]
    return m[keep]


def synthetic_recovery():
    """Synthetic cells: known b in [0.7, 1.4], known Mc in [5.0, 6.0], varying size; one-period and two-period cases."""
    rng = np.random.default_rng(RNG)
    rows = []
    for case in ("one_period", "two_period"):
        for n in (30, 50, 100, 200, 500, 1000):
            for _ in range(60):
                b, mc = rng.uniform(0.7, 1.4), np.round(rng.uniform(5.0, 6.0), 1)
                if case == "one_period":
                    m = synth_cell(n, b, mc, rng)
                    floor = np.full(m.size, 4.0)
                else:  # early half complete only above 5.7 (detection roll-off at 5.7), late half at mc
                    m1 = synth_cell(n // 2, b, max(mc, 5.7), rng)
                    m2 = synth_cell(n // 2, b, mc, rng)
                    m = np.r_[m1, m2]
                    floor = np.r_[np.full(m1.size, 5.7), np.full(m2.size, 4.0)]
                r = al.cell_b(m, floor, nboot=NBOOT, rng=rng)
                rows.append({"case": case, "n": n, "b_true": b, "mc_true": mc, **{k: r.get(k, np.nan) for k in
                             ("b_raw", "b_lo_raw", "b_hi_raw", "mc", "quality", "n_b")}})
    df = pd.DataFrame(rows)
    df["err"] = df.b_raw - df.b_true
    df["covered"] = (df.b_lo_raw <= df.b_true) & (df.b_true <= df.b_hi_raw)
    df["shown"] = df.quality.isin(["A", "B"])
    # the rule until 0.4.0 on the same intervals, for comparison: absolute width <= 0.50 and >= 50 events
    df["shown_abs_rule"] = (df.n_b >= al.NMIN_B) & np.isfinite(df.b_lo_raw) & (df.b_hi_raw - df.b_lo_raw <= al.Q_B)
    out = []
    for (case, n), s in df.groupby(["case", "n"]):
        v = s[np.isfinite(s.b_raw)]
        sh = v[v.shown]
        out.append({"case": case, "n_above_mc": int(n), "cells": len(s), "estimated": len(v),
                    "median_bias": float(v.err.median()) if len(v) else None,
                    "rmse": float(np.sqrt((v.err ** 2).mean())) if len(v) else None,
                    "ci95_coverage": float(v.covered.mean()) if len(v) else None,
                    "shown_fraction": float(v.shown.mean()) if len(v) else 0.0,
                    "shown_max_abs_err": float(sh.err.abs().max()) if len(sh) else None,
                    "mc_median_err": float((v.mc - v.mc_true).median()) if len(v) else None,
                    # the quality mask against true b (v0.5): share shown and mean error of the shown cells, b < 1.05
                    # and b >= 1.05 (true b is drawn from 0.7-1.4)
                    "shown_fraction_b_lt_1.05": float(v[v.b_true < 1.05].shown.mean()) if (v.b_true < 1.05).any() else None,
                    "shown_fraction_b_ge_1.05": float(v[v.b_true >= 1.05].shown.mean()) if (v.b_true >= 1.05).any() else None,
                    "shown_mean_err": float(sh.err.mean()) if len(sh) else None,
                    "median_n_b_b_lt_1.05": float(v[v.b_true < 1.05].n_b.median()) if (v.b_true < 1.05).any() else None,
                    "median_n_b_b_ge_1.05": float(v[v.b_true >= 1.05].n_b.median()) if (v.b_true >= 1.05).any() else None,
                    "abs_rule_shown_fraction_b_lt_1.05": float(v[v.b_true < 1.05].shown_abs_rule.mean())
                    if (v.b_true < 1.05).any() else None,
                    "abs_rule_shown_fraction_b_ge_1.05": float(v[v.b_true >= 1.05].shown_abs_rule.mean())
                    if (v.b_true >= 1.05).any() else None,
                    "abs_rule_shown_mean_err": float(v[v.shown_abs_rule].err.mean()) if v.shown_abs_rule.any() else None})
    # pooled bias test per case on the cells with >= 100 events above Mc: z = mean error / (sd / sqrt(k))
    bias = []
    for case, s in df[df.n >= 100].groupby("case"):
        v = s[np.isfinite(s.b_raw)]
        se = float(v.err.std(ddof=1) / np.sqrt(len(v)))
        bias.append({"case": case, "n_min": int(v.n.min()), "n_max": int(v.n.max()), "n_cells": len(v),
                     "mean_err": float(v.err.mean()), "se": se, "z": float(v.err.mean() / se),
                     "coverage": float(v.covered.mean())})
    return out, bias


def boot_mc(m, fn, nboot=None, rng=None):
    nboot = NBOOT if nboot is None else nboot
    rng = np.random.default_rng(rng)
    vals = [fn(rng.choice(m, m.size)) for _ in range(nboot)]
    vals = np.array([v for v in vals if np.isfinite(v)])
    return float(np.median(vals)), float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))


def global_vs_michael(g):
    rows = []
    for deep, table in ((False, MICHAEL_SHALLOW), (True, MICHAEL_DEEP)):
        for a, b, mm in table:
            sel = (g.year >= a) & (g.year <= b) & ((g.depth >= 60) if deep else (g.depth < 60))
            m = sl.bin_mag(g[sel].mag.to_numpy())
            r = {"depth": ">=60 km" if deep else "<60 km", "period": f"{a}-{b}", "n": int(m.size), "michael_mc": mm}
            r["maxc02"] = boot_mc(m, lambda x: sl.mc_maxc(x, correction=0.2), rng=1)
            r["gft"] = boot_mc(m, lambda x: sl.mc_gft(x)[0], rng=2)
            r["mbs"] = boot_mc(m, sl.mc_mbs, rng=3)
            bb = sl.b_aki(m, mm)
            r["b_at_michael_mc"] = [float(bb[0]), float(bb[1]), int(bb[2])]
            rows.append(r)
    # Michael's pooled b: each period's Mc applied to its events, 1918-2009 shallow (b = 1.05) and 1964-2009 deep (0.99)
    pooled = {}
    for name, deep, table, y0, pub in (("shallow_1918_2009", False, MICHAEL_SHALLOW, 1918, 1.05),
                                       ("deep_1964_2009", True, MICHAEL_DEEP, 1964, 0.99)):
        sel = (g.year >= y0) & (g.year <= 2009) & ((g.depth >= 60) if deep else (g.depth < 60))
        s = g[sel]
        thr = np.full(len(s), np.nan)
        for a, b, mm in table:
            thr[((s.year >= a) & (s.year <= b)).to_numpy()] = mm
        bv, sig, n = sl.b_varmc(s.mag.to_numpy(), thr)
        rng = np.random.default_rng(4)
        m_, t_ = sl.bin_mag(s.mag.to_numpy()), sl.bin_mag(thr)
        bs = [sl.b_varmc(m_[i], t_[i])[0] for i in (rng.integers(0, len(s), len(s)) for _ in range(NBOOT))]
        pooled[name] = {"b": float(bv), "sigma": float(sig), "ci95": [float(np.percentile(bs, 2.5)),
                        float(np.percentile(bs, 97.5))], "n": int(n), "published_b": pub}
    return rows, pooled


def b_region(g, sel, fl_key="sh", fl=None, rng=None):
    s = g[sel]
    r = al.cell_b(s.mag.to_numpy(), floor_of(s.year.to_numpy(), fl[fl_key]), nboot=NBOOT, rng=rng)
    return {"n_sample": r["n_sample"], "n_b": r.get("n_b", 0), "mc": r.get("mc"), "b": r.get("b_raw"),
            "ci95": [r.get("b_lo_raw"), r.get("b_hi_raw")], "quality": r.get("quality")}


def box(g, s, n, w, e):
    if w <= e:
        return (g.lat >= s) & (g.lat <= n) & (g.lon >= w) & (g.lon <= e)
    return (g.lat >= s) & (g.lat <= n) & ((g.lon >= w) | (g.lon <= e))


def main():
    import json
    g = load_work("iscgem")
    c = load_work("comcat")
    fl = json.loads((RES / "atlas_globals.json").read_text())["floors"]
    out = {}
    print("synthetic ...", flush=True)
    out["synthetic"], out["synthetic_bias"] = synthetic_recovery()
    print("global ...", flush=True)
    out["michael_periods"], out["michael_pooled"] = global_vs_michael(g)

    g76_all = g[(g.year >= 1976) & (g.year <= ISCGEM_LAST_YEAR)]
    bsel = b_sample_mask(g76_all.magerr)
    out["b_sample"] = {"rule": b_sample_label(), "b_magerr_max": B_MAGERR_MAX, "n_1976_2021": len(g76_all),
                       "n_in_sample": int(bsel.sum()), "n_excluded": int((~bsel).sum())}
    g76 = g76_all[bsel]
    sh = ~g76.deep
    out["global_atlas_method"] = {"shallow": b_region(g76, sh, "sh", fl, 5), "deep": b_region(g76, g76.deep, "dp", fl, 6)}
    out["global_atlas_method_all_events"] = {"shallow": b_region(g76_all, ~g76_all.deep, "sh", fl, 5),
                                             "deep": b_region(g76_all, g76_all.deep, "dp", fl, 6)}
    out["declustering_effect_global_shallow"] = {
        "full": out["global_atlas_method"]["shallow"],
        "gk_mainshocks": b_region(g76, sh & g76.mainshock, "sh", fl, 7)}

    regions = {  # name: (box S, N, W, E), published b, source, comparability note
        "California": ((32, 42, -125, -114), 1.0, "Hutton, Woessner & Hauksson 2010 (BSSA 100(2)): average b ~1.0, SCSN ML, M>=~1.8-3.25"),
        "Italy": ((36, 47, 6.5, 18.5), 1.0, "Italian hazard models use b close to 1.0 (Gulia & Meletti; MPS04/MPS19 practice)"),
        "Japan": ((30, 46, 128, 148), None, "no verified published number at Mw>=5.2 found; reported for reference only"),
        "Chile": ((-45, -18, -76, -66), None, "b ~1 from a 2018 national-catalogue study was a weak source; the GCMT reference (Andean S. America b 0.855 +-0.06, Kagan & Jackson 2013) and the sensitivity tests are in the Chile rows below (scripts/val_chile.py)"),
        "Zagros": ((27, 35, 45, 56), None, "qualitative: Zagros has the highest b of the Iranian units (Iranian Plateau catalogue, J. Seismol. 2020)"),
        "Makran": ((24, 27.5, 57, 66), None, "qualitative: Makran has the lowest b of the Iranian units (same source)"),
    }
    out["regions"] = {}
    for name, (bx, pub, src) in regions.items():
        r = b_region(g76, sh & box(g76, *bx), "sh", fl, 11)
        out["regions"][name] = {"box_SNWE": bx, "published_b": pub, "source": src, **r,
                                "all_events": b_region(g76_all, ~g76_all.deep & box(g76_all, *bx), "sh", fl, 11)}

    out["plate_boundary_types"] = {}
    for cls in ("SUB", "CCB", "OCB", "CTF", "OTF", "CRB", "OSR", "none"):
        out["plate_boundary_types"][cls] = b_region(g76, sh & (g76.pb_class == cls), "sh", fl, 13)
        out["plate_boundary_types_all_events"] = out.get("plate_boundary_types_all_events", {})
        out["plate_boundary_types_all_events"][cls] = b_region(g76_all, ~g76_all.deep & (g76_all.pb_class == cls),
                                                               "sh", fl, 13)

    slab = {"young": [("Mexico-Central America", (8, 20, -106, -83)), ("Nankai-Ryukyu", (24, 35, 123, 138)),
                      ("South-central Chile", (-46, -33, -76, -70)), ("Cascadia", (40, 50, -130, -121))],
            "old": [("Japan Trench", (35, 42, 140, 146)), ("Kuril-Kamchatka", (42, 56, 143, 165)),
                    ("Izu-Bonin-Mariana", (10, 34, 138, 150)), ("Tonga-Kermadec", (-38, -14, 178, -172))]}
    out["slab_age_groups"] = {}
    for grp, items in slab.items():
        sel = np.zeros(len(g76), bool)
        for _, bx in items:
            sel |= box(g76, *bx).to_numpy()
        out["slab_age_groups"][grp] = {"regions": [n for n, _ in items],
                                       **b_region(g76, sh & sel & (g76.pb_class == "SUB"), "sh", fl, 17)}

    # ComCat Mw-proxy vs ISC-GEM, same years, shallow: b against cutoff
    cc = c[(~c.deep) & (c.year >= 2004) & (c.year <= ISCGEM_LAST_YEAR)]
    gg = g[(~g.deep) & (g.year >= 2004)]
    out["comcat_proxy_vs_iscgem_b_2004_2021"] = [
        {"cutoff": mc, "comcat_proxy": list(map(float, sl.b_aki(cc.mw_proxy, mc)[:3])),
         "comcat_native": list(map(float, sl.b_aki(cc.mag, mc)[:3])),
         "iscgem": list(map(float, sl.b_aki(gg.mag, mc)[:3]))} for mc in (5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2)]

    # radius sensitivity (cells pickled by atlas runs with different radii, if present)
    sens = {}
    base = load_work("cells").set_index("h3")
    for r in (200, 400):
        f = Path(RES.parent / "data" / "work" / f"cells_r{r}.pkl")
        if f.exists():
            o = pd.read_pickle(f).set_index("h3")
            j = base.join(o[["sh_b", "sh_b_q"]], rsuffix="_o")
            both = j[j.sh_b.notna() & j.sh_b_o.notna()]
            sens[f"r{r}"] = {"shown_cells": int(o.sh_b.notna().sum()), "common_with_r300": len(both),
                             "median_abs_db": float((both.sh_b - both.sh_b_o).abs().median()) if len(both) else None}
    sens["r300"] = {"shown_cells": int(base.sh_b.notna().sum())}
    out["radius_sensitivity"] = sens

    # cells: declustering effect and b-positive agreement where b is shown
    s = base[base.sh_b.notna()]
    d = s[np.isfinite(s.sh_b_decl)]
    p = s[np.isfinite(s.sh_bpos)]
    out["cells_summary"] = {"shown_sh": len(s), "shown_dp": int(base.dp_b.notna().sum()),
                            "median_b_sh": float(s.sh_b.median()),
                            "decl_minus_full_median": float((d.sh_b_decl - d.sh_b_raw).median()),
                            "decl_n": len(d),
                            "bpos_minus_full_median": float((p.sh_bpos - p.sh_b_raw).median()),
                            "bpos_within_ci_fraction": float(((p.sh_bpos >= p.sh_b_lo) & (p.sh_bpos <= p.sh_b_hi)).mean()),
                            "unstable_fraction": float(s.sh_b_unstable.mean())}
    jdump(out, RES / "validation.json", indent=1)
    print(json.dumps({k: out[k] for k in ("b_sample", "michael_pooled", "global_atlas_method",
                                          "global_atlas_method_all_events", "regions", "plate_boundary_types",
                                          "slab_age_groups", "cells_summary", "radius_sensitivity")}, indent=1,
                     default=float))
    print(pd.DataFrame(out["synthetic"]).round(3).to_string())


if __name__ == "__main__":
    main()
