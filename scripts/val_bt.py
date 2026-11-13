"""Retrospective b-value before and after the 40 Omori sequences (ISC-GEM Mw). A description, not a forecast.

For every sequence in site/data/sequences.json (written by sequences.py) this adds one field, `bt`, with b in four
windows around the mainshock, inside the sequence circle (radius_km, all depths):

  pre_5y      : 5 years before the mainshock (mainshock excluded)
  pre_1y      : 1 year before
  post_0_30d  : 0-30 days after
  post_30_365d: 30-365 days after

Catalogue  : ISC-GEM Mw, the atlas b sample (1976-2021, direct Mw only: common.b_sample_mask). A window that is
             not fully inside 1976-2021 is left empty with a reason, so sequences from 2022 on have no values.
Threshold  : per event, thr_i = max(period/depth floor of the atlas, MAXC+0.2 of the window sample) and, after the
             mainshock, also Mc(t) = Mm - 4.5 - 0.75 log10(t days) (Helmstetter et al. 2006 form; its coefficients
             were derived for California and are an assumption at teleseismic scale).
Estimator  : Aki-Utsu with per-event thresholds (seislib.b_varmc), bootstrap 95 % percentile interval with the
             window Mc re-estimated in each replicate; b-positive (van der Elst 2021) on events above the floor as
             an incompleteness-robust check. Quality codes as in the atlas (A/B shown, C and insufficient masked).
Validation : the 2004 Sumatra direction test against Srivastava et al. (2021, arXiv:2108.06557, ISC mb, 92-100 E):
             b 1.04 in the five years before 2004, 1.14 after. Our replication uses ISC-GEM Mw in the same longitude
             band (13 S-11 N), 2000-2004 vs 2005-2009. Only the direction can be compared (mb vs Mw).

Writes the `bt` field into site/data/sequences.json and results/val_bt.json (summary and table rows).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402
from atlas import floor_of  # noqa: E402
from common import RES, SITE, b_sample_mask, jdump, load_work  # noqa: E402
from validate import box  # noqa: E402

WINDOWS = {"pre_5y": (-5 * 365.25, 0.0), "pre_1y": (-365.25, 0.0), "post_0_30d": (0.0, 30.0),
           "post_30_365d": (30.0, 365.0)}
COVER = (pd.Timestamp("1976-01-01", tz="UTC"), pd.Timestamp("2022-01-01", tz="UTC"))
NBOOT = 500


def mc_after(t_days, mag_main, floor):
    """Time-dependent completeness after a mainshock, never below the floor."""
    return sl.mc_helmstetter(t_days, mag_main, floor)


def b_window(m, thr, nboot=NBOOT, rng=5, time_order=None):
    """b with per-event thresholds max(thr_i, MAXC+0.2 of the sample); bootstrap re-estimates the MAXC part."""
    m = sl.bin_mag(np.asarray(m, float))
    thr = sl.bin_mag(np.asarray(thr, float))
    out = {"n": int(m.size), "b": None, "b_raw": None, "b_lo": None, "b_hi": None, "n_b": 0, "q": "insufficient"}
    if m.size < 30:
        return out
    mc = float(sl.mc_maxc_fast(m))
    b, _, n = sl.b_varmc(m, np.maximum(thr, mc))
    r = np.random.default_rng(rng)
    bs = []
    for _ in range(nboot):
        i = r.integers(0, m.size, m.size)
        bs.append(sl.b_varmc(m[i], np.maximum(thr[i], sl.mc_maxc_fast(m[i])))[0])
    bs = np.array(bs)
    bs = bs[np.isfinite(bs)]
    lo, hi = (np.percentile(bs, [2.5, 97.5]) if bs.size > 0.8 * nboot else (np.nan, np.nan))
    q = al.quality(n, lo, hi)
    out.update(mc_window=mc, n_b=int(n), b_raw=float(b), b_lo_raw=float(lo), b_hi_raw=float(hi), q=q)
    if q in ("A", "B"):
        out.update(b=float(b), b_lo=float(lo), b_hi=float(hi))
    if time_order is not None:
        o = np.argsort(time_order)
        keep = m[o] >= thr[o] - 1e-9
        bp, sp, nd = sl.b_positive(m[o][keep])
        if nd >= al.NMIN_B and np.isfinite(bp):
            out.update(bpos=float(bp), bpos_lo=float(bp - 1.96 * sp), bpos_hi=float(bp + 1.96 * sp), n_bpos=int(nd))
    return out


def floors(g, fl):
    return np.where(g.deep.to_numpy(), floor_of(g.year.to_numpy(), fl["dp"]), floor_of(g.year.to_numpy(), fl["sh"]))


def sequence_bt(g, fl_all, seq):
    t0 = pd.Timestamp(seq["time"])
    d = sl.haversine_km(seq["lat"], seq["lon"], g.lat.to_numpy(), g.lon.to_numpy())
    dt = (g.time - t0).dt.total_seconds().to_numpy() / 86400
    near = d <= seq["radius_km"]
    # the mainshock in ISC-GEM: within 60 s and 100 km
    ms = np.where(near & (np.abs(dt) * 86400 <= 60) & (d <= 100))[0]
    mm = float(g.mag.iat[ms[0]]) if ms.size else float(seq["mag"])
    res = {"catalogue": "ISC-GEM Mw", "mainshock_in_iscgem": bool(ms.size), "mag_main_iscgem": mm}
    for k, (a, b) in WINDOWS.items():
        lo_t, hi_t = t0 + pd.Timedelta(days=a), t0 + pd.Timedelta(days=b)
        if lo_t < COVER[0] or hi_t > COVER[1]:
            res[k] = {"b": None, "q": "not covered", "reason": "window outside ISC-GEM 1976-2021"}
            continue
        sel = near & (dt > a) & (dt <= b) if a >= 0 else near & (dt >= a) & (dt < 0)
        if ms.size:
            sel[ms] = False
        thr = fl_all[sel]
        if a >= 0:
            thr = np.maximum(thr, mc_after(dt[sel], mm, thr))
        res[k] = b_window(g.mag.to_numpy()[sel], thr, time_order=dt[sel])
    return res


def overlap(a, b):
    return a["b"] is not None and b["b"] is not None and not (a["b_hi"] < b["b_lo"] or b["b_hi"] < a["b_lo"])


def main():
    g = load_work("iscgem")
    fl = json.loads((RES / "atlas_globals.json").read_text())["floors"]
    g = g[(g.year >= 1976) & (g.year <= 2021) & b_sample_mask(g.magerr)].reset_index(drop=True)
    fl_all = floors(g, fl)
    path = SITE / "sequences.json"
    doc = json.loads(path.read_text())
    rows = []
    for s in doc["sequences"]:
        s["bt"] = sequence_bt(g, fl_all, s)
        bt = s["bt"]
        rows.append({"time": s["time"][:10], "mag": s["mag"], "place": s["place"],
                     **{f"{k}_b": bt[k].get("b") for k in WINDOWS},
                     **{f"{k}_q": bt[k].get("q") for k in WINDOWS},
                     **{f"{k}_n": bt[k].get("n_b") for k in WINDOWS}})
    doc["bt_method"] = __doc__.strip()
    jdump(doc, path)
    df = pd.DataFrame(rows)

    # summary: how many sequences have a shown b (A/B) per window; pre_5y vs post_30_365d where both are shown
    shown = {k: int(df[f"{k}_q"].isin(["A", "B"]).sum()) for k in WINDOWS}
    pairs = [s["bt"] for s in doc["sequences"] if s["bt"]["pre_5y"].get("b") is not None
             and s["bt"]["post_30_365d"].get("b") is not None]
    diff = [p["post_30_365d"]["b"] - p["pre_5y"]["b"] for p in pairs]
    summary = {"n_sequences": len(df), "not_covered": int((df.pre_5y_q == "not covered").sum() +
                                                          ((df.pre_5y_q != "not covered") &
                                                           (df.post_30_365d_q == "not covered")).sum()),
               "shown_per_window": shown, "n_pairs_pre5y_post30_365": len(pairs),
               "median_post_minus_pre": float(np.median(diff)) if diff else None,
               "pairs_non_overlapping_ci": int(sum(not overlap(p["pre_5y"], p["post_30_365d"]) for p in pairs))}

    # validation: Srivastava et al. 2021 direction (Sumatra band, before vs after 2004)
    band = box(g, -13, 11, 92, 100)
    t = g.time
    v = {}
    for k, (a, b) in {"2000_2004": ("2000-01-01", "2004-12-26"), "2005_2009": ("2005-01-01", "2010-01-01")}.items():
        sel = (band & (t >= pd.Timestamp(a, tz="UTC")) & (t < pd.Timestamp(b, tz="UTC"))).to_numpy()
        v[k] = b_window(g.mag.to_numpy()[sel], fl_all[sel], time_order=g.t.to_numpy()[sel])
    pub = {"before": 1.04, "after": 1.14, "source": "Srivastava et al. 2021, arXiv:2108.06557, Discussion (ISC mb)"}
    same_dir = (v["2000_2004"]["b_raw"] is not None and v["2005_2009"]["b_raw"] is not None and
                v["2005_2009"]["b_raw"] > v["2000_2004"]["b_raw"])
    sig = not overlap({**v["2000_2004"], "b": v["2000_2004"]["b_raw"], "b_lo": v["2000_2004"]["b_lo_raw"],
                       "b_hi": v["2000_2004"]["b_hi_raw"]},
                      {**v["2005_2009"], "b": v["2005_2009"]["b_raw"], "b_lo": v["2005_2009"]["b_lo_raw"],
                       "b_hi": v["2005_2009"]["b_hi_raw"]})
    k_bad = next((k for k in v if v[k]["q"] not in ("A", "B")), None)
    valid = {"testable": k_bad is None, "published": pub, "ours": v, "same_direction": bool(same_dir), "ci_separated": bool(sig)}

    def f(r):
        return (f"{r['b_raw']:.3f} [{r['b_lo_raw']:.3f}, {r['b_hi_raw']:.3f}] n={r['n_b']} q={r['q']}"
                if r.get("b_raw") is not None else f"n={r['n']} {r['q']}")
    table = [{"test": "b(t) retrospective: Sumatra band 92-100 E, 2000-2004 vs 2005-2009, ISC-GEM Mw",
              "ours": f"before {f(v['2000_2004'])}; after {f(v['2005_2009'])}",
              "published": "before 1.04, after 1.14 (ISC mb; Srivastava et al. 2021 preprint)",
              "verdict": (f"not testable: {k_bad} window has q={v[k_bad]['q']} (n={v[k_bad]['n_b']})" if k_bad else
                          ("same direction" if same_dir else "opposite direction") +
                          ("" if sig else ", intervals overlap") + " (mb vs Mw: direction only)") +
                         " [needs human check]"},
             {"test": "b(t) retrospective: 40 sequences, pre 5 yr vs 30-365 d after (ISC-GEM Mw)",
              "ours": f"shown (A/B) per window {shown}; {len(pairs)} pair(s) with both shown; median post - pre "
                      f"{summary['median_post_minus_pre']:+.3f}; {summary['pairs_non_overlapping_ci']} with "
                      f"separated intervals" if pairs else "no pairs",
              "published": "no published Mw >= 5 before/after comparison found", "verdict": "description only"}]
    jdump({"summary": summary, "validation_sumatra": valid, "table_rows": table, "per_sequence": rows},
          RES / "val_bt.json", indent=1)
    pd.set_option("display.width", 250)
    print(df[["time", "mag"] + [f"{k}_b" for k in WINDOWS] + [f"{k}_q" for k in WINDOWS]].round(3).to_string())
    print(json.dumps(summary, indent=1))
    print(json.dumps({k: {kk: vv for kk, vv in r.items() if kk in ("b_raw", "b_lo_raw", "b_hi_raw", "n_b", "q",
                                                                    "bpos", "mc_window")} for k, r in v.items()}))
    for r in table:
        print(r)


if __name__ == "__main__":
    main()
