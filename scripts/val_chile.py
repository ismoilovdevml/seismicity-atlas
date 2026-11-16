"""Chile b-value investigation: why the atlas Chile b (about 0.85 on direct Mw; 0.91 on every event in v0.1) sits
below the 'b ~ 1' reference.

Every variant uses ISC-GEM Mw, shallow (<= 70 km), and either the atlas estimator (per-event threshold
max(MAXC+0.2 of the sample, period floor), bootstrap 95 % interval, `atlaslib.cell_b`) or Aki-Utsu at a fixed
threshold with a bootstrap percentile interval. Variants:

  b sample     : every variant below uses the atlas b sample (common.b_sample_mask: direct Mw only by default);
                 the baseline is also given on every event (`baseline_all_events`)
  magnitude    : ISC-GEM magnitude uncertainty 0.10 (direct, GCMT-type Mw; see docs/method.md) vs larger
                 uncertainties (proxy Mw), always on every event
  completeness : fixed thresholds 5.2-6.4, and MAXC / MBS / GFT Mc of the box sample
  sequences    : the five Mw >= 7.9 mainshocks in the box (1985 Valparaiso, 1995 Antofagasta, 2010 Maule,
                 2014 Iquique, 2015 Illapel) with their space-time windows removed (radius max(100 km, Wells &
                 Coppersmith L), 30 days before to 365 days after), Gardner-Knopoff mainshocks only, b-positive
  box          : interface events only (PB2002 subduction step within 200 km), coastal strip, latitude segments
  depth        : <= 40 km, 40-70 km
  period       : 1976-2009 vs 2010-2021
  literature   : the same settings as Kagan & Jackson (2013, Table 1: GCMT 1977-2010, 0-70 km, m >= 5.8)

Writes results/val_chile.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seislib as sl  # noqa: E402
from common import (D_GCMT, D_INDEP, D_NONE, RES, b_sample_label, b_sample_mask, jdump, load_work,  # noqa: E402
                    z_verdict)
from validate import b_region, box  # noqa: E402

CHILE = (-45, -18, -76, -66)        # atlas validation box, S N W E
RNG = 31


def b_fixed(m, thr, nboot=1000, rng=RNG):
    """Aki-Utsu b at a fixed threshold with a bootstrap 95 % percentile interval."""
    m = sl.bin_mag(np.asarray(m, float))
    m = m[m >= thr - 1e-9]
    b, sig, n, _ = sl.b_aki(m, thr)
    if n < 20:
        return {"b": None, "ci95": [None, None], "n": int(n), "thr": thr}
    r = np.random.default_rng(rng)
    bs = [sl.b_aki(r.choice(m, m.size), thr)[0] for _ in range(nboot)]
    return {"b": float(b), "ci95": [float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))],
            "sigma_shibolt": float(sig), "n": int(n), "thr": thr}


def seq_mask(s, mains, before_days=30, after_days=365):
    """True for events inside the space-time window of any of the given mainshocks."""
    out = np.zeros(len(s), bool)
    for _, e in mains.iterrows():
        R = max(100.0, 10 ** (-2.44 + 0.59 * e.mag))
        dt = (s.time - e.time).dt.total_seconds().to_numpy() / 86400
        d = sl.haversine_km(e.lat, e.lon, s.lat.to_numpy(), s.lon.to_numpy())
        out |= (dt >= -before_days) & (dt <= after_days) & (d <= R)
    return out


def _f(r):
    return f"{r['b']:.3f} [{r['ci95'][0]:.3f}, {r['ci95'][1]:.3f}] n={r.get('n_b', r.get('n'))}"


def table_rows(out):
    """Rows for the site validation table (site_layers.validation_table appends them); verdicts as common.z_verdict."""
    var = [r for grp in ("box", "depth", "period") for r in out[grp].values() if r.get("quality") in ("A", "B")]
    var += [r for k, r in out["sequences"].items() if k.startswith("without_") and r.get("quality") in ("A", "B")]
    var += [r for r in out["fixed_threshold"] if r["b"] is not None]
    lo, hi = min(r["b"] for r in var), max(r["b"] for r in var)
    kj = out["kj2013_settings"]
    c = kj["chile_box_m58"]
    vkj, z = z_verdict(c["b"], c["ci95"][0], c["ci95"][1], kj["published"]["b_equiv"], kj["published"]["b_equiv_sigma"])
    w = out["sequences"]["without_all_five"]
    vw, _ = z_verdict(w["b"], w["ci95"][0], w["ci95"][1], 1.0)
    return [
        {"test": "Chile b: spread over box, depth, period, sequence-removal and fixed-threshold variants",
         "ours": f"baseline {_f(out['baseline'])}; {len(var)} variants {lo:.3f}-{hi:.3f}",
         "published": "b ~1 (2018 national-catalogue study, weak source)",
         "verdict": f"robust: {lo:.2f}-{hi:.2f}" + ("; the highest b is without all five large-sequence windows"
                                                    if w.get("quality") in ("A", "B") and abs(w["b"] - hi) < 1e-9
                                                    else "") + " (internal sensitivity, not a comparison)",
         "data": D_NONE, "z": None},
        {"test": "Chile b without the five Mw >= 7.9 sequence windows (1985, 1995, 2010, 2014, 2015)",
         "ours": _f(w), "published": "b ~1 (2018 national-catalogue study, weak source)",
         "verdict": vw, "data": D_INDEP, "z": None},
        {"test": "Chile box at Kagan & Jackson (2013) settings: 1977-2010, <= 70 km, m >= 5.8",
         "ours": _f(c), "published": "Andean S. America (FE region 8) beta 0.57 +-0.04 -> b 0.855 +-0.06, GCMT",
         "verdict": vkj + f" (z {z:+.2f}; FE region 8 is larger than the Chile box)", "data": D_GCMT, "z": z},
    ]


def main():
    g_all = load_work("iscgem")
    fl = json.loads((RES / "atlas_globals.json").read_text())["floors"]
    a76 = g_all[(g_all.year >= 1976) & (g_all.year <= 2021)].reset_index(drop=True)
    a_base = ~a76.deep & box(a76, *CHILE)

    # ---------------------------------------------------------------- magnitude type mix (every event)
    direct = (a76.magerr <= 0.1001).to_numpy()
    out = {"box_SNWE": CHILE, "b_sample": b_sample_label()}
    out["baseline_all_events"] = b_region(a76, a_base, "sh", fl, 11)
    out["magnitude"] = {
        "share_magerr_0.10_chile": float(direct[a_base.to_numpy()].mean()),
        "share_magerr_0.10_global_shallow": float(direct[(~a76.deep).to_numpy()].mean()),
        "magerr_0.10_only": b_region(a76, a_base & direct, "sh", fl, 11),
        "magerr_gt_0.10_only": b_region(a76, a_base & ~direct, "sh", fl, 11),
    }

    # every other variant: the atlas b sample
    g = g_all[b_sample_mask(g_all.magerr)]
    g76 = g[(g.year >= 1976) & (g.year <= 2021)].reset_index(drop=True)
    sh = ~g76.deep
    inbox = box(g76, *CHILE)
    base = sh & inbox
    s = g76[base]
    out["n_events_box"] = int(base.sum())

    def atl(sel, seed=11):
        return b_region(g76, sel, "sh", fl, seed)

    out["baseline"] = atl(base)

    # ---------------------------------------------------------------- completeness
    m = sl.bin_mag(s.mag.to_numpy())
    out["mc_box"] = {}
    for a, b in ((1976, 2003), (2004, 2021)):
        mm = sl.bin_mag(s[(s.year >= a) & (s.year <= b)].mag.to_numpy())
        out["mc_box"][f"{a}-{b}"] = {"n": int(mm.size), "maxc02": float(sl.mc_maxc(mm, correction=0.2)),
                                     "mbs": float(sl.mc_mbs(mm)), "gft": float(sl.mc_gft(mm)[0])}
    out["fixed_threshold"] = [b_fixed(m, round(t, 1)) for t in np.arange(5.2, 6.45, 0.1)]

    # ---------------------------------------------------------------- sequences
    mains = s[s.mag >= 7.9].sort_values("time")
    out["large_mainshocks"] = [{"time": e.time.isoformat(), "lat": e.lat, "lon": e.lon, "mag": e.mag,
                                "radius_km": round(max(100.0, 10 ** (-2.44 + 0.59 * e.mag)), 1)}
                               for _, e in mains.iterrows()]
    seq = {}
    win_all = seq_mask(g76, mains)
    for _, e in mains.iterrows():
        w = seq_mask(g76, mains[mains.time == e.time])
        seq[f"without_{e.time.year}_M{e.mag:.1f}"] = {"removed": int((base & w).sum()), **atl(base & ~w)}
    seq["without_all_five"] = {"removed": int((base & win_all).sum()), **atl(base & ~win_all)}
    seq["gk_mainshocks_only"] = atl(base & g76.mainshock)
    # b-positive on events above their period floor, time ordered
    st = s.sort_values("time")
    flo = np.where(st.year <= 2003, fl["sh"]["1976-2003"]["floor"], fl["sh"]["2004-2021"]["floor"])
    mt = sl.bin_mag(st.mag.to_numpy())
    keep = mt >= flo - 1e-9
    bp, sp, n = sl.b_positive(mt[keep])
    seq["b_positive"] = {"b": float(bp), "ci95": [float(bp - 1.96 * sp), float(bp + 1.96 * sp)], "n_diff": int(n)}
    out["sequences"] = seq

    # ---------------------------------------------------------------- box and depth
    sub = (g76.pb_class == "SUB") & (g76.pb_dist_km <= 200)
    out["box"] = {
        "interface_only_SUB_200km": atl(base & sub),
        "coastal_strip_76W_69W": atl(sh & box(g76, -45, -18, -76, -69)),
        "north_18S_27S": atl(sh & box(g76, -27, -18, -76, -66)),
        "central_27S_33S": atl(sh & box(g76, -33, -27, -76, -66)),
        "south_central_33S_45S": atl(sh & box(g76, -45, -33, -76, -66)),
        "extended_to_56S": atl(sh & box(g76, -56, -18, -80, -64)),
    }
    out["depth"] = {"le_40km": atl(base & (g76.depth <= 40)), "40_70km": atl(base & (g76.depth > 40))}
    out["period"] = {"1976_2009": atl(base & (g76.year <= 2009)), "2010_2021": atl(base & (g76.year >= 2010))}

    # ---------------------------------------------------------------- Kagan & Jackson (2013) settings
    kj = (g.year >= 1977) & (g.year <= 2010) & ~g.deep
    out["kj2013_settings"] = {
        "published": {"beta": 0.57, "beta_sigma": 0.04, "b_equiv": 0.855, "b_equiv_sigma": 0.06, "n": 286,
                      "region": "Flinn-Engdahl seismic region 8, Andean S. America (polygon)"},
        "chile_box_m58": b_fixed(g[kj & box(g, *CHILE)].mag, 5.8),
        "andean_box_approx_m58": b_fixed(g[kj & box(g, -56, 13, -82, -63)].mag, 5.8),
        "andean_box_approx_m58_sub": b_fixed(g[kj & box(g, -56, 13, -82, -63) & (g.pb_class == "SUB")].mag, 5.8),
    }
    out["table_rows"] = table_rows(out)
    jdump(out, RES / "val_chile.json", indent=1)

    def line(k, r):
        ci = r.get("ci95", [None, None])
        if r.get("b") is None:
            print(f"{k:36s} n={r.get('n_b', r.get('n'))} b=None q={r.get('quality')}")
            return
        print(f"{k:36s} b={r['b']:.3f} [{ci[0]:.3f}, {ci[1]:.3f}] n={r.get('n_b', r.get('n', r.get('n_diff')))} "
              f"q={r.get('quality', '-')} mc={r.get('mc', r.get('thr', '-'))}")
    line("baseline", out["baseline"])
    for grp in ("magnitude", "sequences", "box", "depth", "period", "kj2013_settings"):
        for k, r in out[grp].items():
            if isinstance(r, dict) and ("b" in r or "quality" in r):
                line(f"{grp}.{k}", r)
    print({k: v for k, v in out["magnitude"].items() if k.startswith("share")})
    print(out["mc_box"])
    for r in out["fixed_threshold"]:
        line(f"fixed {r['thr']}", r)


if __name__ == "__main__":
    main()
