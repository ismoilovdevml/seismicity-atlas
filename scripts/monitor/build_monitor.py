"""Sequence Monitor: a descriptive, regularly updated summary of ongoing large-earthquake aftershock sequences.

NOT A FORECAST. Every number describes events between a mainshock and the data cut-off. No probability, no
expected future count and no curve beyond the cut-off is produced. The USGS runs operational aftershock forecasts
(the ComCat `oaf` product); this monitor only describes what has happened so far.

Selection : ComCat mainshocks M >= 7.0 in the 365 days before the cut-off (M >= 6.5 if fewer than 5 are found).
            Largest first; an event inside the window of a larger mainshock (0-365 days after, within R), or a
            doublet within 1 day and 2 R of it, joins that sequence instead of starting its own.
Window    : epicentral radius R = max(100 km, 10^(-2.44 + 0.59 M)) (Wells & Coppersmith 1994, the atlas rule),
            from the mainshock to the cut-off. ComCat events M >= 2.5, as served (mixed magnitude types).
Mcat      : MAXC + 0.2 of the events after min(10 days, half the sequence age); 4.5 if fewer than 30 such events.
Mc(t)     : max(Mcat, Mm - 4.5 - 0.75 log10 t) (Helmstetter et al. 2006; Page et al. 2016).
Omori     : Omori-Utsu MLE above Mc(t) (seislib.omori_fit_mct), b = sequence b-positive if >= 50 differences, else 1.
            95 % intervals from the observed information; quality A/B/C as in the atlas sequence fits.
b         : Aki-Utsu with the per-event threshold Mc(t); 1000 bootstrap resamples with Mcat re-estimated; shown only
            for quality A (95 % interval width / b <= 0.30) or B (<= 0.50) with >= 50 events. b-positive (van der Elst 2021).
ZW2020    : optional, subduction-zone regimes only: count above Mc(t) divided by the direct-aftershock count of
            the Zhang & Werner (2020) Table 6 ETAS parameters over the same span, next to the same ratio for their
            own Case 3 sequences (descriptive; nothing is extrapolated past the cut-off).
Productivity : sequence a-value with p, c, b fixed at the generic values of Page et al. (2016) for the Garcia et
            al. (2012) tectonic region of the epicentre, compared with the regional mean a. "more" / "less" only
            when the 95 % interval of the sequence a excludes the regional mean; otherwise "typical".

Usage
  python -I scripts/monitor/build_monitor.py                      # cut-off = now (UTC, whole hour)
  python -I scripts/monitor/build_monitor.py --end 2026-11-13T00:00:00
"""
from __future__ import annotations

import argparse
import io
import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import monitorlib as ml  # noqa: E402
import seislib as sl  # noqa: E402
from fetch import COMCAT, PAUSE_S, TooMany, cache_get  # noqa: E402

ROOT = HERE.parents[1]
OUT = ROOT / "site" / "data" / "monitor"
METHOD_VERSION = "monitor-1.1"
MIN_MAG_MAIN, FALLBACK_MAG, MIN_SEQUENCES = 7.0, 6.5, 5
WINDOW_DAYS = 365
QUERY_MINMAG = 2.5
REGIME_URL = ("https://raw.githubusercontent.com/opensha/opensha-oaf/20431f4202b1a15904f381f4ca236fa8518daedb/"
              "src/main/resources/org/opensha/oaf/rj/TectonicRegimeTable.dat")
DISCLAIMER = ("Descriptive only, not a forecast. These numbers describe aftershocks recorded between each mainshock "
              "and the data cut-off. They do not give the probability or the number of future earthquakes. For "
              "official aftershock forecasts, see the USGS event pages and the national agencies of the affected "
              "countries.")


def iso(ts) -> str:
    return pd.Timestamp(ts).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


def comcat_csv(params, refresh=False) -> pd.DataFrame:
    body = cache_get(COMCAT, {"format": "csv", "eventtype": "earthquake", "orderby": "time-asc", **params},
                     "monitor", "csv", refresh)
    time.sleep(PAUSE_S)
    if not body.strip():
        return pd.DataFrame(columns=["time", "latitude", "longitude", "depth", "mag", "magType", "id", "place"])
    df = pd.read_csv(io.BytesIO(body), dtype={"id": str, "magType": str, "place": str})
    df = df[df["type"] == "earthquake"].dropna(subset=["mag"]).drop_duplicates("id")
    df["time"] = pd.to_datetime(df["time"], utc=True, format="ISO8601")
    return df.sort_values("time").reset_index(drop=True)


def load_regimes(refresh=False) -> ml.RegimeTable:
    return ml.RegimeTable(cache_get(REGIME_URL, None, "opensha", "dat", refresh).decode("ascii"))


def r4(x, d=4):
    return None if x is None or not np.isfinite(x) else round(float(x), d)


def overlapping(ms, cand, end):
    """Other M >= 6.5 events after this mainshock whose sequence circle intersects this one (their aftershocks can
    enter this window)."""
    R = ml.wc_radius_km(float(ms.mag))
    after = cand[(cand.time > ms.time) & (cand.time <= end) & (cand.id != ms.id)]
    out = []
    for r in after.itertuples():
        d = float(sl.haversine_km(ms.latitude, ms.longitude, r.latitude, r.longitude))
        if R < d <= R + ml.wc_radius_km(float(r.mag)):
            out.append({"id": r.id, "time": iso(r.time), "mag": float(r.mag), "dist_km": round(d)})
    return out


def sequence(ms, absorbed, overlaps, end, regimes, refresh):
    Mm, R = float(ms.mag), ml.wc_radius_km(float(ms.mag))
    t0 = ms.time
    age = (end - t0).total_seconds() / 86400
    q = {"latitude": round(float(ms.latitude), 4), "longitude": round(float(ms.longitude), 4),
         "maxradiuskm": round(R, 1), "starttime": t0.strftime("%Y-%m-%dT%H:%M:%S"),
         "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"), "minmagnitude": QUERY_MINMAG}
    try:
        ev = comcat_csv(q, refresh)
    except TooMany:
        q["minmagnitude"] = 3.5
        ev = comcat_csv(q, refresh)
    ev = ev[(ev.id != ms.id)]
    t = ((ev.time - t0).dt.total_seconds() / 86400).to_numpy()
    keep = (t > 0) & (t <= age)
    ev, t = ev[keep].reset_index(drop=True), t[keep]
    m = sl.bin_mag(ev.mag.to_numpy(float), ml.DM)
    regime = regimes.regime(float(ms.latitude), float(ms.longitude))
    mcat, mcat_how = ml.estimate_mcat(t, m, age, q["minmagnitude"] + 0.2)
    contaminated = bool((m >= Mm - 0.5).any() or any(o["mag"] >= Mm - 0.5 for o in overlaps))

    bp = ml.b_positive_seq(t, m)
    b_fit = bp["b"] if bp["b"] is not None else 1.0
    fit = ml.omori_fit(t, m, age, Mm, mcat, b_fit)
    fit["quality"] = ml.omori_quality(fit, contaminated)
    bb = ml.b_bootstrap_seq(t, m, age, Mm, q["minmagnitude"] + 0.2)
    prod = ml.productivity(t, m, age, Mm, mcat, regime)
    if prod.get("class") != "insufficient" and fit["quality"] == "insufficient":
        prod["class"] = "insufficient"
    depth = float(ms.depth) if pd.notna(ms.depth) else None
    zw = ml.zw2020_productivity(t, m, age, Mm, mcat, regime, depth)
    if zw.get("applicable") and zw.get("class") != "insufficient" and fit["quality"] == "insufficient":
        zw["class"] = "insufficient"

    largest = None
    if m.size:
        k = int(np.argmax(ev.mag.to_numpy(float)))
        bt = ml.bath(m, Mm)
        largest = {"id": ev.id.iat[k], "time": iso(ev.time.iat[k]), "mag": bt["mag"], "magtype": ev.magType.iat[k],
                   "days": r4(t[k], 3), "dm": bt["dm"]}
    d_all, d_mcat = ml.daily_counts(t, m, age, mcat)
    g = ml.cum_grid(age)
    above = m >= ml.mc_t(t, Mm, mcat) - ml.DM / 2 + 1e-9
    cum = {"t": g.tolist(), "obs": np.searchsorted(np.sort(t[above]), g, side="right").tolist(),
           "obs_mcat": np.searchsorted(np.sort(t[m >= mcat - 1e-9]), g, side="right").tolist()}
    if fit.get("K") is not None:
        cum["fit"] = [round(float(x), 2) for x in ml.expected_cum(g, fit["K"], fit["c"], fit["p"], Mm, mcat, b_fit)]
    # time after which Mc(t) has fallen to Mcat
    t_mcat = 10 ** ((ml.F_MC * Mm - ml.G_MC - mcat) / ml.H_MC)

    rec = {
        "id": ms.id, "time": iso(t0), "lat": round(float(ms.latitude), 3), "lon": round(float(ms.longitude), 3),
        "depth": r4(ms.depth, 1), "mag": Mm, "magtype": ms.magType, "place": ms.place,
        "url": f"https://earthquake.usgs.gov/earthquakes/eventpage/{ms.id}",
        "regime": regime, "radius_km": round(R, 1), "age_days": round(age, 2),
        "absorbed": absorbed, "overlaps": overlaps,
        "query": {k: v for k, v in q.items()},
        "counts": {"n_all": int(m.size), "n_mcat": int((m >= mcat - 1e-9).sum()), "n_fit": int(above.sum()),
                   "n_last7": int((t > age - 7).sum()), "n_last7_mcat": int(((t > age - 7) & (m >= mcat - 1e-9)).sum()),
                   "last_event": iso(ev.time.iat[-1]) if m.size else None},
        "mcat": mcat, "mcat_method": mcat_how,
        "mc_t": {"F": ml.F_MC, "G": ml.G_MC, "H": ml.H_MC, "days_until_mcat": r4(t_mcat, 4)},
        "magtypes": ml.magtype_mix(ev.magType.fillna("?").to_numpy(str)),
        "contaminated": contaminated,
        "omori": {k: (r4(v) if isinstance(v, float) else v) for k, v in fit.items()},
        "omori_b": round(b_fit, 3), "omori_b_source": "b-positive" if bp["b"] is not None else "fixed 1.0",
        "b": {k: (r4(v, 3) if isinstance(v, float) else v) for k, v in bb.items()},
        "bpos": {k: (r4(v, 3) if isinstance(v, float) else v) for k, v in bp.items()},
        "largest_aftershock": largest, "bath_typical_dm": 1.2,
        "productivity": {k: (r4(v) if isinstance(v, float) else v) for k, v in prod.items()},
        "productivity_zw2020": {k: (r4(v) if isinstance(v, float) else v) for k, v in zw.items()},
        "daily": {"all": d_all, "mcat": d_mcat},
        "cum": cum,
    }
    return rec


def summary(rec):
    o, b, p = rec["omori"], rec["b"], rec["productivity"]
    keys = ("id", "time", "lat", "lon", "depth", "mag", "magtype", "place", "url", "regime", "radius_km", "age_days",
            "mcat", "contaminated", "overlaps")
    s = {k: rec[k] for k in keys}
    s.update(n_all=rec["counts"]["n_all"], n_mcat=rec["counts"]["n_mcat"], n_last7=rec["counts"]["n_last7"],
             omori={k: o.get(k) for k in ("p", "p_lo", "p_hi", "quality")},
             b={k: b.get(k) for k in ("b", "lo", "hi", "q")},
             productivity={k: p.get(k) for k in ("class", "ratio", "ratio_lo", "ratio_hi", "percentile")},
             productivity_zw2020={k: rec["productivity_zw2020"].get(k) for k in
                                  ("applicable", "class", "ratio", "ratio_lo", "ratio_hi", "in_calibration_range")},
             largest_aftershock=rec["largest_aftershock"], file=f"{rec['id']}.json")
    return s


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--end", help="data cut-off, ISO 8601 UTC (default: now, whole hour)")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--refresh", action="store_true", help="re-download cached responses")
    a = ap.parse_args()
    end = (pd.Timestamp(a.end, tz="UTC") if a.end else
           pd.Timestamp(datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)))
    if end.tzinfo is None:
        end = end.tz_localize("UTC")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    # candidates: two windows back, so that an older large event can still absorb its own aftershocks
    cand = comcat_csv({"starttime": (end - timedelta(days=2 * WINDOW_DAYS)).strftime("%Y-%m-%dT%H:%M:%S"),
                       "endtime": end.strftime("%Y-%m-%dT%H:%M:%S"), "minmagnitude": FALLBACK_MAG}, a.refresh)
    start = end - timedelta(days=WINDOW_DAYS)
    td = ((cand.time - cand.time.min()).dt.total_seconds() / 86400).to_numpy()
    regimes = load_regimes(a.refresh)
    used_mag = None
    for thr in (MIN_MAG_MAIN, FALLBACK_MAG):
        sub = cand[cand.mag >= thr - 1e-9].reset_index(drop=True)
        tds = td[(cand.mag >= thr - 1e-9).to_numpy()]
        chosen, absorbed = ml.select_mainshocks(tds, sub.latitude.to_numpy(), sub.longitude.to_numpy(),
                                                sub.mag.to_numpy(float))
        chosen = [i for i in chosen if sub.time.iat[i] >= start]
        used_mag = thr
        if len(chosen) >= MIN_SEQUENCES:
            break
    recs = []
    for i in sorted(chosen, key=lambda i: sub.time.iat[i], reverse=True):
        ab = [{"id": sub.id.iat[j], "time": iso(sub.time.iat[j]), "mag": float(sub.mag.iat[j]), "place": sub.place.iat[j]}
              for j in absorbed.get(i, [])]
        rec = sequence(sub.iloc[i], ab, overlapping(sub.iloc[i], cand, end), end, regimes, a.refresh)
        recs.append(rec)
        o = rec["omori"]
        print(f"{rec['time'][:10]} M{rec['mag']:.1f} {rec['place'][:38]:38s} {rec['regime']:13s} age {rec['age_days']:6.1f} "
              f"n {rec['counts']['n_all']:5d} Mcat {rec['mcat']:.1f} nfit {rec['counts']['n_fit']:4d} "
              f"p {o.get('p')} q {o['quality']} b {rec['b']['b_raw']} [{rec['b']['lo']}, {rec['b']['hi']}] {rec['b']['q']} "
              f"prod {rec['productivity'].get('class')} x{rec['productivity'].get('ratio')}")

    for old in out.glob("*.json"):
        old.unlink()
    for rec in recs:
        (out / f"{rec['id']}.json").write_text(json.dumps(rec, separators=(",", ":"), allow_nan=False))
    index = {
        "method_version": METHOD_VERSION,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_cutoff_utc": iso(end),
        "disclaimer": DISCLAIMER,
        "selection": {"min_mag": used_mag, "default_min_mag": MIN_MAG_MAIN, "fallback_min_mag": FALLBACK_MAG,
                      "fallback_used": used_mag != MIN_MAG_MAIN, "window_days": WINDOW_DAYS,
                      "query_minmag": QUERY_MINMAG, "catalogue": "USGS ComCat, as served"},
        "method": __doc__.split("Usage")[0].strip(),
        "references": {
            "page2016": "Page, M. T., van der Elst, N., Hardebeck, J., Felzer, K., Michael, A. J. (2016), BSSA 106(5), "
                        "2290-2301, doi:10.1785/0120160073",
            "zw2020": "Zhang, L., Werner, M. J., Goda, K. (2020), BSSA 110(1), 191-212, doi:10.1785/0120190121 "
                      "(Table 6 ETAS parameters; Table 2 Case 3 counts as the reference ratios)",
            "regimes": "Garcia, D., Wald, D. J., Hearne, M. G. (2012), BSSA 102(1), 185-203; grid from OpenSHA OAF "
                       "(github.com/opensha/opensha-oaf)",
        },
        "sequences": [summary(r) for r in recs],
    }
    (out / "index.json").write_text(json.dumps(index, separators=(",", ":"), allow_nan=False))
    total = sum(f.stat().st_size for f in out.glob("*.json"))
    print(f"{len(recs)} sequences (M >= {used_mag}), cut-off {iso(end)}, {total / 1e6:.2f} MB in {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
