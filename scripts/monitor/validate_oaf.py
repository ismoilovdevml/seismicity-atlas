"""Reproduce the model parameters of the USGS operational aftershock forecasts (ComCat `oaf` product).

For every M >= 6.5 mainshock of the last 365 days that has an `oaf` product, read the parameters of the current
forecast (forecast.json: model name, a, p, c, b, Mc or Mcat, F/G/H, region circle) and refit them with our code on
ComCat data selected the same way: the same circle, the same completeness, the same b, and data from the
mainshock to the forecast's creation time.

- Reasenberg-Jones products: c and b fixed at the USGS values, (a, p) free. This is a like-for-like comparison of
  the sequence-specific part. A "Bayesian Combination" product also mixes in the generic prior, so a difference is
  expected there.
- ETAS products: the USGS ETAS model (van der Elst et al. 2022) separates mainshock productivity (ams) from
  secondary productivity (a). Our single Omori-Utsu fit lumps all generations together, so only p and c are
  compared directly; our RJ a is shown next to ams for orientation, not as a test.

Writes results/monitor_oaf_validation.json and prints a Markdown table.

Usage
  python -I scripts/monitor/validate_oaf.py --end 2026-11-13T00:00:00
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import monitorlib as ml  # noqa: E402
import seislib as sl  # noqa: E402
from build_monitor import comcat_csv, iso  # noqa: E402
from fetch import COMCAT, cache_get  # noqa: E402

ROOT = HERE.parents[1]


def event_detail(eid):
    return json.loads(cache_get(COMCAT, {"eventid": eid, "format": "geojson"}, "monitor", "json"))


def refit(ev_t0, mag_main, par, t_end):
    lat, lon, rad = par["regionCenterLat"], par["regionCenterLon"], par["regionRadius"]
    mcat = par.get("Mcat", par.get("Mc"))
    b = par["b"]
    q = {"latitude": lat, "longitude": lon, "maxradiuskm": rad, "starttime": ev_t0.strftime("%Y-%m-%dT%H:%M:%S"),
         "endtime": t_end.strftime("%Y-%m-%dT%H:%M:%S"), "minmagnitude": round(mcat - 0.25, 2)}
    ev = comcat_csv(q)
    t = ((ev.time - ev_t0).dt.total_seconds() / 86400).to_numpy()
    k = t > 1e-4
    t, m = t[k], ev.mag.to_numpy(float)[k]
    T2 = (t_end - ev_t0).total_seconds() / 86400
    F, G, H = par.get("F", 1.0), par.get("G", 4.5), par.get("H", 0.75)
    keep = sl.bin_mag(m, 0.1) >= sl.mc_helmstetter(t, mag_main, mcat, F, G, H) - 0.05 + 1e-9
    n = int(keep.sum())
    res = {"n_used": n, "T_days": round(T2, 2), "Mcat": mcat, "query": q}
    if n < 10:
        return res
    ffix = sl.omori_fit_mct(t, m, 0.0, T2, mag_main, mcat, b, F, G, H, fix_c=par["c"])
    a_fix = sl.rj_a_from_K(ffix["K"], b, mag_main, mcat)
    res["fixed_c"] = {"a": round(a_fix, 3), "sa": round(1 / (math.log(10) * math.sqrt(n)), 3),
                      "p": round(ffix["p"], 3), "sp": round(ffix["sp"], 3)}
    ffree = sl.omori_fit_mct(t, m, 0.0, T2, mag_main, mcat, b, F, G, H)
    res["free_c"] = {"a": round(sl.rj_a_from_K(ffree["K"], b, mag_main, mcat), 3), "p": round(ffree["p"], 3),
                     "sp": round(ffree["sp"], 3), "c": round(ffree["c"], 4),
                     "sc": None if not np.isfinite(ffree["sc"]) else round(ffree["sc"], 4)}
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--end", required=True)
    a = ap.parse_args()
    end = pd.Timestamp(a.end, tz="UTC") if pd.Timestamp(a.end).tzinfo is None else pd.Timestamp(a.end)
    cand = comcat_csv({"starttime": (end - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S"),
                       "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"), "minmagnitude": 6.5})
    rows = []
    for r in cand.sort_values("mag", ascending=False).itertuples():
        d = event_detail(r.id)
        oafs = d["properties"]["products"].get("oaf")
        if not oafs:
            continue
        prod = oafs[0]
        fc = json.loads(cache_get(prod["contents"]["forecast.json"]["url"], None, "monitor_oaf", "json"))
        par = fc["model"]["parameters"]
        created = pd.Timestamp(fc["creationTime"], unit="ms", tz="UTC")
        t0 = r.time
        row = {"id": r.id, "mag": float(r.mag), "place": r.place, "time": iso(t0), "model": fc["model"]["name"],
               "usgs": par, "forecast_created": iso(created), "product_update_ms": prod["updateTime"],
               "days_after": round((created - t0).total_seconds() / 86400, 1),
               "ours": refit(t0, float(par.get("magMain", r.mag)), par, created)}
        rows.append(row)
        print(json.dumps(row)[:600])
    out = ROOT / "results" / "monitor_oaf_validation.json"
    out.write_text(json.dumps({"cutoff": iso(end), "method": __doc__.split("Usage")[0].strip(), "rows": rows}, indent=1))

    print("\n| Mainshock | USGS model | Data to (days) | n | USGS a | ours a | USGS p | ours p | USGS c | ours c (free) |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for x in rows:
        u, o = x["usgs"], x["ours"]
        fx, fr = o.get("fixed_c", {}), o.get("free_c", {})
        ua = f"{u['a']}" + (f" ± {u['aSigma']}" if "aSigma" in u else f" (ams {u['ams']})" if "ams" in u else "")
        up = f"{u['p']}" + (f" ± {u['pSigma']}" if u.get("pSigma") else "")
        oa = f"{fx['a']} ± {fx['sa']}" if fx else "–"
        op = f"{fx['p']} ± {fx['sp']}" if fx else "–"
        oc = f"{fr['c']}" + (f" ± {fr['sc']}" if fr.get("sc") else "") if fr else "–"
        print(f"| M {x['mag']} {x['place']} | {x['model']} | {x['days_after']} | {o['n_used']} | {ua} | {oa} | {up} | "
              f"{op} | {u['c']} | {oc} |")


if __name__ == "__main__":
    main()
