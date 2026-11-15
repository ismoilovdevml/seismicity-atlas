"""Compare the atlas with published b / beta / Mc values read from the literature (scripts/val_literature.json).

Each literature entry carries the exact quote it was taken from and a `compare` block that says how to reproduce
the published setting on ISC-GEM: region (lat/lon box, PB2002 class, or global), period, depth limit, magnitude
threshold and declustering. For every entry two numbers are computed on the same selection:

  b_aki : the atlas b estimator at a fixed threshold (Aki-Utsu, 0.1 bins, bootstrap 95 % interval)
  b_tgr : 1.5 x beta of a tapered Gutenberg-Richter fit (maximum likelihood, beta and corner moment free,
          Kagan 2002), bootstrap 95 % interval. This is the like-for-like estimator for the Kagan / Bird values.

Both are computed on the atlas b sample (common.b_sample_mask: direct Mw only by default, the GCMT-type magnitudes
the published values were made from). For comparison the same two numbers are also given on every event
(`*_all_events`, the v0.1 behaviour) and on the magnitude-uncertainty-0.10 events (`*_magerr010`).

Verdict: z = (ours - published) / sqrt(se_ours^2 + se_pub^2), se_ours = CI width / 3.92, se_pub from the printed
uncertainty (0 if none). |z| <= 1.96 -> match, else mismatch. The PB2002 class entry (Bird & Kagan 2004) applies the
same rule per class against their Table 5. Entries whose region is only approximated (an
envelope box for a Flinn-Engdahl polygon, PB2002 class for 'trenches') are marked 'approximate region'.
All entries keep needs_human_check = true: the quotes were extracted with LLM assistance and must be checked.

Writes results/val_literature.json (including `table_rows` for the site validation table).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seislib as sl  # noqa: E402
from common import RES, b_sample_label, b_sample_mask, jdump, load_work  # noqa: E402
from val_chile import b_fixed  # noqa: E402
from validate import box  # noqa: E402

LIT = Path(__file__).resolve().parent / "val_literature.json"
CLASSES = ("SUB", "CCB", "OCB", "CTF", "OTF", "CRB", "OSR")


def tgr_beta(m, mt):
    """Tapered G-R MLE on magnitudes m >= mt (moment log10 M = 1.5 m + 9.1). Returns (beta, corner magnitude)."""
    m = np.asarray(m, float)
    m = m[m >= mt - 1e-9]
    if m.size < 20:
        return np.nan, np.nan
    x = 10 ** (1.5 * (m - mt))           # M / Mt
    slx, sx, n = np.log(x).sum(), x.sum(), m.size

    def nll(p):
        beta, th = p                      # th = Mt / Mcorner
        return -(-beta * slx + th * (n - sx) + np.log(beta / x + th).sum())
    best = None
    for th0 in (1e-4, 1e-3, 1e-2):
        r = minimize(nll, [0.65, th0], bounds=[(0.05, 3.0), (0.0, 1.0)], method="L-BFGS-B")
        if best is None or r.fun < best.fun:
            best = r
    beta, th = best.x
    mcorner = mt + np.log10(1 / th) / 1.5 if th > 0 else np.inf
    return float(beta), float(mcorner)


def b_tgr(m, mt, nboot=300, rng=41):
    m = np.asarray(m, float)
    m = m[m >= mt - 1e-9]
    beta, mc = tgr_beta(m, mt)
    if not np.isfinite(beta):
        return {"b": None, "ci95": [None, None], "n": int(m.size)}
    r = np.random.default_rng(rng)
    bs = np.array([tgr_beta(r.choice(m, m.size), mt)[0] for _ in range(nboot)])
    bs = bs[np.isfinite(bs)]
    return {"beta": beta, "b": 1.5 * beta, "ci95": [1.5 * float(np.percentile(bs, 2.5)),
            1.5 * float(np.percentile(bs, 97.5))], "corner_mag": mc, "n": int(m.size), "thr": mt}


def select(g, c):
    y0, y1 = c["years"]
    s = (g.year >= y0) & (g.year <= y1) & (g.depth <= c["depth_max_km"])
    if c["kind"] == "box":
        s &= box(g, *c["box_SNWE"])
    elif c["kind"] == "class":
        s &= g.pb_class == c["pb_class"]
    if c.get("declustered"):
        s &= g.mainshock
    return s


def verdict(ours, pub, pub_se, approx):
    if ours.get("b") is None:
        return "not testable", None
    lo, hi = ours["ci95"]
    se = (hi - lo) / 3.92
    z = (ours["b"] - pub) / np.sqrt(se ** 2 + pub_se ** 2)
    v = "match" if abs(z) <= 1.96 else "mismatch"
    return v + (" (approximate region)" if approx else ""), float(z)


def pub_b(e):
    """Published value in b units and its standard error (b = 1.5 beta)."""
    k = 1.5 if e["quantity"] == "beta" else 1.0
    u = e.get("uncertainty")
    se = 0.0
    if isinstance(u, str) and u.strip().startswith("±"):
        se = k * float(u.strip()[1:])
    return k * float(e["value"]), se


def fmt(r):
    return f"{r['b']:.3f} [{r['ci95'][0]:.3f}, {r['ci95'][1]:.3f}] n={r['n']}" if r.get("b") is not None else "n/a"


def main():
    g_all = load_work("iscgem")
    g = g_all[b_sample_mask(g_all.magerr)]
    lit = json.loads(LIT.read_text())
    res, rows = [], []
    for e in lit:
        c = e["compare"]
        s = select(g, c)
        out = {"id": e["id"], "citation": e["citation"], "doi": e.get("doi"), "compare": c,
               "needs_human_check": e.get("needs_human_check", True)}
        short = e["citation"].split("(")[0].strip().rstrip(",") + " " + e["citation"].split("(")[1][:4]
        if c["kind"] in ("box", "class", "global"):
            m = g[s].mag.to_numpy()
            out["b_sample"] = b_sample_label()
            out["b_aki"] = b_fixed(m, c["threshold"])
            out["b_tgr"] = b_tgr(m, c["threshold"])
            s_all = select(g_all, c)
            out["b_aki_all_events"] = b_fixed(g_all[s_all].mag.to_numpy(), c["threshold"])
            out["b_tgr_all_events"] = b_tgr(g_all[s_all].mag.to_numpy(), c["threshold"])
            s10 = s_all & (g_all.magerr <= 0.1001)
            out["b_aki_magerr010"] = b_fixed(g_all[s10].mag.to_numpy(), c["threshold"])
            out["b_tgr_magerr010"] = b_tgr(g_all[s10].mag.to_numpy(), c["threshold"])
            pb, pse = pub_b(e)
            out["published_b"], out["published_b_se"] = pb, pse
            out["published_n"] = e.get("published_n")
            key = "b_tgr" if e["quantity"] == "beta" else "b_aki"
            approx = c.get("approximate", False)
            out["verdict"], out["z"] = verdict(out[key], pb, pse, approx)
            out["verdict_all_events"], out["z_all_events"] = verdict(out[key + "_all_events"], pb, pse, approx)
            out["verdict_magerr010"], out["z_magerr010"] = verdict(out[key + "_magerr010"], pb, pse, approx)
            where = (f"box {c['box_SNWE']}" if c["kind"] == "box" else
                     f"PB2002 {c['pb_class']}" if c["kind"] == "class" else "global")
            rows.append({"test": f"Literature b: {e['id']} ({where}, {c['years'][0]}-{c['years'][1]}, "
                                 f"<= {c['depth_max_km']} km, m >= {c['threshold']}"
                                 f"{', declustered' if c.get('declustered') else ''})",
                         "ours": f"TGR {fmt(out['b_tgr'])}; Aki {fmt(out['b_aki'])} ({out['b_sample']}); "
                                 f"all events: TGR {fmt(out['b_tgr_all_events'])}",
                         "published": f"{e['quantity']} {e['value']}{' ' + e['uncertainty'] if e.get('uncertainty') else ''}"
                                      f" (b {pb:.3f}; {short}, {e['location_in_source'].split(':')[0]})",
                         "verdict": out["verdict"] + f"; all events: {out['verdict_all_events'].split(' (')[0]}"
                                    " [needs human check]"})
        elif c["kind"] == "class_range":
            # Same rule as the other entries: z = (ours - published) / sqrt(se_ours^2 + se_pub^2), |z| <= 1.96 -> match,
            # per PB2002 class against Bird & Kagan (2004) Table 5. se_pub comes from the published 95 % range on the side
            # facing our value (the OSR ranges are asymmetric). Where they split a class (OSR by mechanism, OTF by
            # spreading rate) and we do not, the class agrees when it matches at least one of their subcatalogs.
            pubc = e["per_class_published"]
            per = {}
            for k in CLASSES:
                sel = s & (g.pb_class == k)
                r = b_tgr(g[sel].mag.to_numpy(), c["threshold"])
                beta = r.get("beta")
                lo, hi = (r["ci95"][0] / 1.5, r["ci95"][1] / 1.5) if beta is not None else (None, None)
                rows_k = []
                for q in pubc.get(k, []):
                    if beta is None:
                        rows_k.append({"label": q["label"], "z": None})
                        continue
                    se_o = (hi - lo) / 3.92
                    se_p = ((q["hi95"] - q["beta"]) if beta > q["beta"] else (q["beta"] - q["lo95"])) / 1.96
                    rows_k.append({"label": q["label"], "z": float((beta - q["beta"]) / np.sqrt(se_o ** 2 + se_p ** 2))})
                ok_k = any(x["z"] is not None and abs(x["z"]) <= 1.96 for x in rows_k)
                per[k] = {"beta": beta, "ci95": [lo, hi], "n": r["n"], "vs_table5": rows_k, "match": ok_k}
            out["per_class_beta"] = per
            lo_o, hi_o = min(v["beta"] for v in per.values()), max(v["beta"] for v in per.values())
            out["ours_range"] = [lo_o, hi_o]
            # the v0.2 rule (our range of point values inside the abstract range 0.53-0.92, +-0.03), kept for reference
            out["range_rule_v02"] = "match" if (0.53 - 0.03 <= lo_o and hi_o <= 0.92 + 0.03) else "mismatch"
            ok = all(v["match"] for v in per.values())
            out["verdict"] = ("match" if ok else "mismatch") + " (approximate)"

            def best(v):
                zs = [x["z"] for x in v["vs_table5"] if x["z"] is not None]
                return min(zs, key=abs) if zs else float("nan")
            rows.append({"test": f"Literature beta by PB2002 class ({c['years'][0]}-{c['years'][1]}, "
                                 f"<= 70 km, m >= {c['threshold']}, TGR)",
                         "ours": "beta " + ", ".join(f"{k} {v['beta']:.2f} (z {best(v):+.2f})" for k, v in per.items()),
                         "published": "Table 5 per-class beta with 95 % ranges, 0.53 (OCB) to 0.92 (OSR normal faulting) "
                                      "(Bird & Kagan 2004)",
                         "verdict": out["verdict"] + "; OSR and OTF against the closest of their subcatalogs"
                                    " [needs human check]"})
        elif c["kind"] == "mc_global":
            m = sl.bin_mag(g[s].mag.to_numpy())
            out["maxc02"] = float(sl.mc_maxc(m, correction=0.2))
            out["mbs"] = float(sl.mc_mbs(m))
            out["gft"] = float(sl.mc_gft(m)[0])
            out["n"] = int(m.size)
            ok = 5.3 <= out["maxc02"] <= 5.6
            out["verdict"] = "match" if ok else "mismatch"
            rows.append({"test": "Literature Mc: GCMT 1980-2016, 0-50 km (Petruccelli 2018 thesis)",
                         "ours": f"global MAXC+0.2 {out['maxc02']:.1f}, MBS {out['mbs']:.1f}, GFT {out['gft']:.1f}",
                         "published": "most local Mc 5.4-5.5; 5.1-5.3 on ridges and Himalaya",
                         "verdict": out["verdict"] + " (global vs local map) [needs human check]"})
        res.append(out)
    # diagnostic: share and b of the non-0.10-uncertainty magnitudes, global shallow 1982-2008, m >= 5.6
    g = g_all
    s = (g.year >= 1982) & (g.year <= 2008) & (g.depth <= 70)
    big = g.magerr > 0.1001
    edges = (5.6, 6.0, 6.5, 7.0, 7.5, 10.0)
    share = {f"{a}-{b}": float(big[s & (g.mag >= a - 1e-9) & (g.mag < b - 1e-9)].mean())
             for a, b in zip(edges[:-1], edges[1:])}
    diag = {"share_magerr_gt_0.10_by_mag": share, "b_aki_magerr_gt_0.10": b_fixed(g[s & big].mag, 5.6),
            "b_aki_magerr_0.10": b_fixed(g[s & ~big].mag, 5.6)}
    print(diag)
    jdump({"entries": res, "table_rows": rows, "magerr_diagnostic_global_1982_2008": diag},
          RES / "val_literature.json", indent=1)
    for r in rows:
        print(f"{r['verdict']:42s} | {r['ours']:70s} | {r['published']} | {r['test']}")


if __name__ == "__main__":
    main()
