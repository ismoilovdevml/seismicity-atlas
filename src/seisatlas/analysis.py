"""Mc and b-value of one earthquake catalogue (or one region of it), with the same estimators as the atlas.

    from seisatlas import read_catalog, analyze
    res = analyze(read_catalog("events.csv"))
    res["b"]["b"], res["b"]["b_lo"], res["b"]["b_hi"], res["b"]["quality"]

Method (as in the atlas, docs/method.md):
- Mc = MAXC + 0.2 (maximum curvature plus the usual correction); MBS and GFT are reported for comparison.
- b = Aki-Utsu maximum likelihood with the binning correction and a per-event threshold max(Mc, floor_i), where
  floor_i is an optional completeness floor per period (for catalogues whose completeness changed with time).
- 95 % interval from bootstrap replicates that re-estimate Mc in every replicate.
- Quality: A if (hi - lo) / b <= 0.30, B if <= 0.50, C if wider (b withheld), insufficient below 50 events above the
  threshold. The width is relative because the standard error of b grows with b.
- b-positive (van der Elst 2021) on time-ordered events above the threshold, as a robustness column.
The result describes the catalogue. It is not a forecast and not a hazard assessment.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import atlaslib as al
from . import seislib as sl
from .catalog import Catalog

DISCLAIMER = ("Descriptive catalogue statistics. Not an earthquake forecast and not a seismic hazard assessment; "
              "b-values from fewer than about 1000 events should not be used to claim differences between places "
              "(Marzocchi et al. 2020).")


def _floors(cat: Catalog, floor, floor_periods):
    """Per-event completeness floor: max of a scalar floor and the floor of the event's period."""
    n = len(cat)
    f = np.full(n, -np.inf if floor is None else float(floor))
    if floor_periods:
        if not cat.has_time:
            raise ValueError("floor_periods needs a time column")
        yr = cat.events["time"].dt.year.to_numpy()
        for y0, y1, fl in floor_periods:
            sel = (yr >= int(y0)) & (yr <= int(y1))
            f[sel] = np.maximum(f[sel], float(fl))
    return f


def _f(x, nd=3):
    return None if x is None or not np.isfinite(x) else round(float(x), nd)


def mc_by_year(cat: Catalog, dm: float = 0.1, nmin: int = 50):
    """MAXC + 0.2 per calendar year with at least `nmin` events (a quick look at completeness changing in time)."""
    if not cat.has_time:
        return []
    ev = cat.events
    out = []
    for y, g in ev.groupby(ev["time"].dt.year):
        if len(g) >= nmin:
            out.append({"year": int(y), "n": int(len(g)),
                        "mc_maxc02": _f(sl.mc_maxc(g["mag"].to_numpy(), dm, 0.2), 1)})
    return out


def analyze(cat: Catalog, *, dm: float = 0.1, nboot: int = al.NBOOT, seed: int = 20261116, floor: float | None = None,
            floor_periods=None) -> dict:
    """Mc, b with a 95 % interval and quality code, b-positive, FMD and warnings, as a JSON-serialisable dict."""
    ev = cat.events
    m = ev["mag"].to_numpy(float)
    res = {"source": cat.source, "n_events": int(m.size), "dropped": cat.dropped, "columns_used": cat.columns_used,
           "settings": {"dm": dm, "nboot": int(nboot), "seed": int(seed), "floor": floor,
                        "floor_periods": [list(p) for p in floor_periods] if floor_periods else None,
                        "quality_rule": "A: (hi - lo) / b <= 0.30; B: <= 0.50; C: wider; insufficient: < 50 events",
                        "method": "Mc = MAXC + 0.2; Aki-Utsu ML b with per-event threshold max(Mc, floor); "
                                  "bootstrap re-estimating Mc"},
           "disclaimer": DISCLAIMER, "warnings": []}
    W = res["warnings"]
    if m.size == 0:
        W.append("No events.")
        return res
    res["magnitude_range"] = [_f(m.min(), 2), _f(m.max(), 2)]
    if cat.has_time:
        res["time_range"] = [str(ev["time"].min()), str(ev["time"].max())]
    if "magtype" in ev:
        vc = ev["magtype"].value_counts()
        res["magnitude_types"] = {str(k): int(v) for k, v in vc.items()}
        major = vc[vc / vc.sum() >= 0.05]
        if len(major) > 1:
            W.append(f"Mixed magnitude types ({', '.join(f'{k} {v}' for k, v in major.items())}). Converted or mixed "
                     "magnitudes bias b; analyse one type (option --mag-type) where possible.")
    flo = _floors(cat, floor, floor_periods)
    cb = al.cell_b(m, np.where(np.isfinite(flo), flo, -9.0), nboot=nboot, rng=seed, dm=dm)
    res["mc"] = {"maxc02": _f(cb.get("mc"), 1), "maxc02_lo": _f(cb.get("mc_lo"), 1),
                 "maxc02_hi": _f(cb.get("mc_hi"), 1)}
    if m.size >= 50:
        gft = sl.mc_gft(m, dm)
        res["mc"].update(mbs=_f(sl.mc_mbs(m, dm), 1), gft=_f(gft[0], 1), gft_fit_percent=_f(gft[1], 1))
    q = cb.get("quality", "insufficient")
    res["b"] = {"quality": q, "n_above_threshold": int(cb.get("n_b", 0)),
                "b": _f(cb.get("b_raw")), "b_lo": _f(cb.get("b_lo_raw")), "b_hi": _f(cb.get("b_hi_raw")),
                "relative_width": _f(cb.get("b_relw")), "b_sigma_shi_bolt": _f(cb.get("b_sigma_shibolt")),
                "b_threshold_plus_0.2": _f(cb.get("b_plus02")), "b_threshold_plus_0.4": _f(cb.get("b_plus04")),
                "cutoff_unstable": bool(cb.get("cutoff_unstable", False)), "shown": q in ("A", "B")}
    if q == "insufficient":
        W.append(f"Fewer than {al.NMIN_B} events above the threshold: no b-value is given.")
        res["b"].update(b=None, b_lo=None, b_hi=None)
    elif q == "C":
        W.append("The 95 % interval is wider than half of b (quality C): the atlas would withhold this b. The value "
                 "is listed for reference only.")
    if res["b"]["cutoff_unstable"]:
        W.append("b changes when the threshold is raised by 0.2 and 0.4 (both outside the interval, same side): the "
                 "sample may be incomplete or not exponential above Mc.")
    if 0 < res["b"]["n_above_threshold"] < 200 and q in ("A", "B", "C"):
        W.append(f"Only {res['b']['n_above_threshold']} events above the threshold; small samples make b sensitive to "
                 "the largest events.")
    if cat.has_time and q != "insufficient":
        thr = np.maximum(cb["mc"], flo)
        bp = al.cell_bpos(m, thr, dm)
        res["b_positive"] = {"b": _f(bp["bpos"]), "b_lo": _f(bp["bpos_lo"]), "b_hi": _f(bp["bpos_hi"]),
                             "n_differences": int(bp["n_bpos"])}
    yrs = mc_by_year(cat, dm)
    res["mc_by_year"] = yrs
    mcs = [y["mc_maxc02"] for y in yrs if y["mc_maxc02"] is not None]
    if len(mcs) >= 3 and max(mcs) - min(mcs) >= 0.3 and floor_periods is None:
        W.append(f"Yearly Mc ranges from {min(mcs):.1f} to {max(mcs):.1f}: completeness changed with time. Give "
                 "per-period floors (floor_periods / --floor-period) or restrict the time window; a single Mc "
                 "then biases b.")
    bins, nc, cum = sl.fmd(m, dm)
    res["fmd"] = {"mag": [_f(b, 2) for b in bins], "count": [int(x) for x in nc], "cumulative": [int(x) for x in cum]}
    return res


def fmd_frame(res: dict) -> pd.DataFrame:
    """The frequency-magnitude distribution of an analyze() result as a DataFrame."""
    return pd.DataFrame(res["fmd"])
