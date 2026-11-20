"""Omori-Utsu parameters for the largest independent sequences since 1990 (ComCat, as-served magnitudes).

Selection : ComCat events M >= 7.5 since 1990-01-01, largest first; an event is skipped if it lies inside the
            space-time window of a larger selected mainshock. The first 40 independent mainshocks are kept.
Window    : epicentral radius R = max(100 km, L), L = 10^(-2.44 + 0.59 M) (Wells & Coppersmith 1994, all types);
            time 0-365 days after the mainshock.
Mcat      : MAXC + 0.2 of the sequence events in days 10-365 (never below 4.5).
Fit       : omori_fit_mct (seislib): Omori-Utsu MLE with the time-dependent completeness
            Mc(t) = max(Mcat, Mm - 4.5 - 0.75 log10 t) (Helmstetter et al. 2006; Page et al. 2016), b = b-positive of
            the sequence (1.0 if it cannot be estimated).
Quality   : A = n >= 100, sigma_p <= 0.10, 0.5 <= p <= 2, no other event >= Mm - 0.5 in the window;
            B = n >= 50, sigma_p <= 0.20, 0.5 <= p <= 2.5; else C. 'contaminated' marks a second large event.
            c_resolved is False when c < 0.001 day or has no standard error: with a teleseismic catalogue
            (Mcat ~4.7) the earliest hours are missing and c is then not constrained; K and p remain usable.
            c is searched in [1e-4 day, 365 days]; c_at_bound marks a fit that ended at 1e-4 day (sc null, the
            errors of K and p are then those for c fixed there). sK includes the covariance of K with p and c.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seislib as sl  # noqa: E402
from common import RES, SITE, jdump, load_work  # noqa: E402

N_SEQ = 40


def synthetic_check(rng=3):
    """Teleseismic-like synthetic: K, c, p known, magnitudes GR b=1 above 4.5, early part lost below Mc(t)."""
    rows = []
    r = np.random.default_rng(rng)
    for s in range(20):
        p_true, c_true, K = 1.05, 0.05, 60.0
        t = sl.synth_omori(K, c_true, p_true, 0.0, 365.0, rng=r.integers(1e9))
        m = sl.synth_gr(t.size, 1.0, 4.5, rng=r.integers(1e9))
        keep = m >= sl.mc_helmstetter(t, 8.0, 4.5) - 1e-9
        f = sl.omori_fit_mct(t[keep], m[keep], 0.0, 365.0, 8.0, 4.5, 1.0)
        rows.append((f["p"], f["sp"], f["c"], f["n"]))
    a = np.array(rows)
    return {"p_true": 1.05, "c_true": 0.05, "p_mean": float(a[:, 0].mean()), "p_sd_between": float(a[:, 0].std(ddof=1)),
            "sp_mean": float(a[:, 1].mean()), "c_median": float(np.median(a[:, 2])), "n_mean": float(a[:, 3].mean()),
            "n_runs": int(len(a))}


def main():
    c = load_work("comcat")
    c = c[c.time >= pd.Timestamp("1990-01-01", tz="UTC")].reset_index(drop=True)
    tday = ((c.time - c.time.min()).dt.total_seconds() / 86400).to_numpy()
    lat, lon, mag = c.lat.to_numpy(), c.lon.to_numpy(), c.mag.to_numpy()
    cand = np.where(mag >= 7.5)[0]
    cand = cand[np.argsort(-mag[cand], kind="stable")]
    chosen = []
    for i in cand:
        if len(chosen) >= N_SEQ:
            break
        dep = False
        for j in chosen:
            R = max(100.0, 10 ** (-2.44 + 0.59 * mag[j]))
            if 0 <= tday[i] - tday[j] <= 365 and sl.haversine_km(lat[i], lon[i], lat[j], lon[j]) <= R:
                dep = True
                break
        if not dep:
            chosen.append(i)
    out = []
    for i in chosen:
        Mm = float(mag[i])
        R = max(100.0, 10 ** (-2.44 + 0.59 * Mm))
        dt = tday - tday[i]
        d = sl.haversine_km(lat[i], lon[i], lat, lon)
        sel = (dt > 0) & (dt <= 365) & (d <= R)
        t, m = dt[sel], mag[sel]
        late = m[t >= 10]
        mcat = max(4.5, float(sl.mc_maxc(late, correction=0.2))) if late.size >= 20 else 4.5
        bp = sl.b_positive(m[np.argsort(t)])
        b = float(bp[0]) if np.isfinite(bp[0]) and bp[2] >= 50 else 1.0
        rec = {"id": c.id.iat[i], "time": c.time.iat[i].isoformat(), "lat": round(float(lat[i]), 3),
               "lon": round(float(lon[i]), 3), "depth": float(c.depth.iat[i]), "mag": Mm, "magtype": c.magtype.iat[i],
               "place": None, "radius_km": round(R, 1), "mcat": mcat, "n_window": int(sel.sum()),
               "b_seq": b, "b_seq_source": "b-positive" if b != 1.0 else "fixed 1.0",
               "contaminated": bool((m >= Mm - 0.5).any())}
        if (m >= mcat - 1e-9).sum() >= 20:
            f = sl.omori_fit_mct(t, m, 0.0, 365.0, Mm, mcat, b)
            rec.update({k: float(f[k]) for k in ("K", "c", "p", "sK", "sc", "sp")}, n_fit=int(f["n"]),
                       c_at_bound=f["c_at_bound"])
            okp = np.isfinite(f["sp"])
            rec["c_resolved"] = bool(f["c"] >= 1e-3 and np.isfinite(f["sc"]))
            if (f["n"] >= 100 and okp and f["sp"] <= 0.10 and 0.5 <= f["p"] <= 2 and not rec["contaminated"]):
                q = "A"
            elif f["n"] >= 50 and okp and f["sp"] <= 0.20 and 0.5 <= f["p"] <= 2.5:
                q = "B"
            else:
                q = "C"
            rec["quality"] = q
            # daily counts above Mcat for the site chart (days 0-365, log-spaced bins)
            edges = np.r_[0, np.geomspace(0.01, 365, 30)]
            rec["rate_bins_days"] = [round(float(x), 4) for x in edges]
            rec["rate_counts"] = np.histogram(t[m >= mcat - 1e-9], edges)[0].tolist()
        else:
            rec.update(quality="insufficient", n_fit=int((m >= mcat - 1e-9).sum()))
        out.append(rec)
    # place names from the ComCat 'place' column of the raw CSV
    raw = pd.read_csv(RES.parent / "data" / "processed" / "comcat_m45.csv", usecols=["id", "place"], low_memory=False)
    place = dict(zip(raw.id.astype(str), raw.place))
    for r in out:
        r["place"] = place.get(r["id"])
    syn = synthetic_check()
    jdump({"method": __doc__.strip(), "synthetic_check": syn, "sequences": out}, SITE / "sequences.json")
    jdump({"synthetic_check": syn, "n": len(out),
           "quality_counts": pd.Series([r["quality"] for r in out]).value_counts().to_dict()}, RES / "sequences.json",
          indent=1)
    df = pd.DataFrame(out)
    print(df[["time", "mag", "place", "n_fit", "mcat", "p", "sp", "c", "quality", "contaminated"]].to_string())
    print(syn)


if __name__ == "__main__":
    main()
