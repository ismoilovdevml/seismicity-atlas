"""Retrospective CSEP-style number test (N-test) of the monitor's descriptive Omori-Utsu fit on completed sequences.

Question: if the monitor had been run L days after the mainshock, does its fitted Omori-Utsu rate, integrated over
the rest of the first year, match the number of events that were later recorded? This is a consistency check of
the model description on held-out data, not a forecast; nothing here is shown on the site.

For each completed sequence (mainshock more than 365 days before the data end) and learning span L:
- data and rules exactly as the monitor (scripts/monitor): ComCat M >= 2.5 within R of the epicentre, Mcat from
  the learning data (MAXC + 0.2 after min(10 days, L/2)), Mc(t) of Helmstetter et al. (2006), Omori-Utsu MLE
  above Mc(t) with b from b-positive (>= 50 differences) or 1.0;
- the expected count above Mc(t) in (L, 365 days] is the integral of the fitted rate;
- Poisson N-test (pyCSEP definition): delta1 = P(N >= n_obs), delta2 = P(N <= n_obs); a value below 0.025 rejects
  at the 5 % level (two-sided: too few / too many expected);
- the same test with parameter uncertainty: a Poisson mixture over 200 bootstrap refits of the learning data
  (skipped when fewer than 100 refits converge);
- a diagnostic variant that adds a constant background: the rate of events above Mcat in the same circle in the
  year before the mainshock (the Omori model itself has no background term).

Output: results/sci2_ntest.json
Usage: python -I scripts/sci2/ntest_omori.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
for p in (HERE, ROOT / "scripts", ROOT / "scripts" / "monitor"):
    sys.path.insert(0, str(p))
import build_monitor as bm  # noqa: E402
import monitorlib as ml  # noqa: E402
import sci2lib as s2  # noqa: E402
import seislib as sl  # noqa: E402
from common import jdump  # noqa: E402
from fetch import TooMany  # noqa: E402

SEQUENCES = ["ci38457511", "us6000m0xl", "ak0219neiszm", "us6000qw60"]   # Ridgecrest, Noto, Chignik, Kamchatka
LEARN_DAYS = [3.0, 10.0, 30.0]
T_END = 365.0
NBOOT = 200
RNG = 20261114
OUT = ROOT / "results" / "sci2_ntest.json"


def load(eid):
    ms = bm.comcat_csv({"eventid": eid})
    if ms.empty:
        raise SystemExit(f"{eid}: not found")
    ms = ms.iloc[0]
    Mm, R = float(ms.mag), ml.wc_radius_km(float(ms.mag))
    end = ms.time + pd.Timedelta(days=T_END)
    q = {"latitude": round(float(ms.latitude), 4), "longitude": round(float(ms.longitude), 4),
         "maxradiuskm": round(R, 1), "starttime": ms.time.strftime("%Y-%m-%dT%H:%M:%S"),
         "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"), "minmagnitude": bm.QUERY_MINMAG}
    try:
        ev = bm.comcat_csv(q)
    except TooMany:
        q["minmagnitude"] = 3.5
        ev = bm.comcat_csv(q)
    ev = ev[ev.id != ms.id]
    t = ((ev.time - ms.time).dt.total_seconds() / 86400).to_numpy()
    k = (t > 0) & (t <= T_END)
    # the year before the mainshock, same circle: background level (not part of the Omori model)
    qb = dict(q, starttime=(ms.time - pd.Timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S"),
              endtime=ms.time.strftime("%Y-%m-%dT%H:%M:%S"))
    pre = sl.bin_mag(bm.comcat_csv(qb).mag.to_numpy(float), ml.DM)
    return ms, Mm, R, q["minmagnitude"], t[k], sl.bin_mag(ev.mag.to_numpy(float)[k], ml.DM), pre


def fit_learning(t, m, L, Mm, floor):
    tl, mlrn = t[t <= L], m[t <= L]
    mcat, how = ml.estimate_mcat(tl, mlrn, L, floor)
    bp = ml.b_positive_seq(tl, mlrn)
    b = bp["b"] if bp["b"] is not None else 1.0
    f = ml.omori_fit(tl, mlrn, L, Mm, mcat, b)
    return f, mcat, how, b


def expected_test(f, L, Mm, mcat, b):
    e = ml.expected_cum([L, T_END], f["K"], f["c"], f["p"], Mm, mcat, b)
    return float(e[1] - e[0])


def main():
    rng = np.random.default_rng(RNG)
    rows = []
    for eid in SEQUENCES:
        ms, Mm, R, qmin, t, m, pre = load(eid)
        for L in LEARN_DAYS:
            f, mcat, how, b = fit_learning(t, m, L, Mm, qmin + 0.2)
            if f.get("quality") == "insufficient":
                rows.append({"id": eid, "learn_days": L, "status": "insufficient", "n_learn": f["n"]})
                continue
            above = m >= ml.mc_t(t, Mm, mcat) - ml.DM / 2 + 1e-9
            n_obs = int((above & (t > L) & (t <= T_END)).sum())
            lam = expected_test(f, L, Mm, mcat, b)
            d1, d2 = s2.n_test_poisson(lam, n_obs)
            # parameter uncertainty: bootstrap the learning events and refit (Mcat and b held at the learning values)
            tl, mlrn = t[t <= L], m[t <= L]
            lams = []
            for _ in range(NBOOT):
                k = rng.integers(0, tl.size, tl.size)
                fb = ml.omori_fit(tl[k], mlrn[k], L, Mm, mcat, b)
                if fb.get("quality") != "insufficient" and np.isfinite(fb["p"]):
                    lams.append(expected_test(fb, L, Mm, mcat, b))
            lams = np.array(lams)
            lams = lams[np.isfinite(lams)]
            bg = float((pre >= mcat - 1e-9).sum()) * (T_END - L) / 365.0
            db1, db2 = s2.n_test_poisson(lam + bg, n_obs)
            m1, m2 = s2.n_test_mixture(lams, n_obs) if lams.size >= 100 else (float("nan"), float("nan"))
            rows.append({
                "id": eid, "place": ms.place, "time": bm.iso(ms.time), "mag": Mm, "depth": float(ms.depth),
                "radius_km": round(R, 1), "query_minmag": qmin, "learn_days": L, "test_window_days": [L, T_END],
                "mcat": mcat, "mcat_method": how, "b_used": round(b, 3), "n_learn": int(f["n"]),
                "K": round(f["K"], 3), "c": round(f["c"], 4), "p": round(f["p"], 3), "sp": round(f["sp"], 3),
                "n_obs_test": n_obs, "expected_test": round(lam, 1), "ratio_obs_expected": round(n_obs / lam, 3),
                "poisson_delta1": d1, "poisson_delta2": d2,
                "poisson_rejected_5pct": bool(min(d1, d2) < 0.025),
                "boot_n": int(lams.size), "boot_expected_p2_5_p50_p97_5": [round(float(x), 1) for x in
                                                                          np.percentile(lams, [2.5, 50, 97.5])]
                if lams.size else None,
                "mixture_delta1": m1, "mixture_delta2": m2, "mixture_rejected_5pct": bool(lams.size >= 100 and min(m1, m2) < 0.025),
                "pre_year_events_above_mcat": int((pre >= mcat - 1e-9).sum()), "background_test": round(bg, 1),
                "ratio_obs_to_expected_plus_background": round(n_obs / (lam + bg), 3),
                "with_background_delta1": db1, "with_background_delta2": db2,
                "with_background_rejected_5pct": bool(min(db1, db2) < 0.025)})
            r = rows[-1]
            print(f"{eid} {ms.place[:30]:30s} M{Mm} L={L:4.0f} n_learn {r['n_learn']:4d} p {r['p']:.2f} "
                  f"obs {n_obs:5d} exp {lam:7.1f} ratio {n_obs / lam:5.2f} d1 {d1:.3g} d2 {d2:.3g} | "
                  f"boot {r['boot_expected_p2_5_p50_p97_5']} "
                  f"m1 {m1:.3g} m2 {m2:.3g} bg {bg:.1f} ratio+bg {r['ratio_obs_to_expected_plus_background']}", flush=True)
    ok = [r for r in rows if "n_obs_test" in r]
    summary = {"tests": len(ok), "poisson_rejected": sum(r["poisson_rejected_5pct"] for r in ok),
               "mixture_rejected": sum(r["mixture_rejected_5pct"] for r in ok),
               "mixture_tests": sum(r["boot_n"] >= 100 for r in ok),
               "with_background_rejected": sum(r["with_background_rejected_5pct"] for r in ok),
               "over_predicted": sum(r["ratio_obs_expected"] < 1 for r in ok),
               "ratio_median": float(np.median([r["ratio_obs_expected"] for r in ok]))}
    jdump({"method": __doc__.split("Output")[0].strip(), "summary": summary, "rows": rows}, OUT, indent=1)
    print(summary)


if __name__ == "__main__":
    main()
