"""Maths for the Sequence Monitor: a descriptive summary of ongoing aftershock sequences.

Nothing here forecasts. Every function describes events that have already happened, between the mainshock and
the data cut-off. Fitted curves are evaluated only up to the cut-off.

Estimators are reused from scripts/seislib.py (Omori-Utsu MLE with time-dependent completeness, Aki-Utsu with a
per-event threshold, b-positive). This module adds the sequence selection, the per-sequence summary and the
comparison with the generic regional parameters of Page et al. (2016).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import seislib as sl  # noqa: E402

DM = 0.1
F_MC, G_MC, H_MC = 1.0, 4.5, 0.75   # Mc(t) = max(Mcat, F Mm - G - H log10 t), Helmstetter et al. 2006; Page et al. 2016
MCAT_DEFAULT = 4.5                  # used when a sequence has too few events to estimate its completeness
NBOOT = 200
LN10 = math.log(10)

# Page et al. (2016, BSSA 106(5), 2290-2301, doi:10.1785/0120160073), generic Reasenberg-Jones parameters per
# Garcia et al. (2012) tectonic region, as distributed with the USGS aftershock forecast software
# (github.com/opensha/opensha-oaf, file PageEtAlGenericParams_032116.csv). b = 1.0 and c = 0.018 day for every region.
# Columns: p, a_mean, a_sigma (magnitude independent), a_sigma1, a_sigma0 (magnitude-dependent sigma, see a_sigma()).
PAGE2016 = {
    "ANSR-DEEPCON": (0.98, -2.13, 0.52, 250, 0.49),
    "ANSR-HOTSPOT": (1.12, -3.00, 0.68, 680, 0.49),
    "ANSR-OCEANBD": (1.08, -3.19, 0.60, 500, 0.49),
    "ANSR-SHALCON": (0.98, -2.42, 0.63, 570, 0.49),
    "ANSR-ABSLDEC": (1.01, -2.29, 0.63, 560, 0.49),
    "ANSR-ABSLOCB": (0.64, -2.82, 0.80, 890, 0.49),
    "ANSR-ABSLSHC": (1.06, -2.85, 0.75, 800, 0.49),
    "SCR-ABVSLAB": (0.73, -2.85, 0.78, 870, 0.49),
    "SCR-GENERIC": (0.73, -2.85, 0.78, 870, 0.49),
    "SOR-ABVSLAB": (0.97, -3.04, 0.67, 650, 0.49),
    "SOR-GENERIC": (0.97, -3.04, 0.67, 650, 0.49),
    "SZ-GENERIC": (0.88, -2.47, 0.63, 570, 0.49),
    "SZ-INLBACK": (0.86, -2.43, 0.66, 640, 0.49),
    "SZ-ONSHORE": (0.81, -2.34, 0.60, 500, 0.49),
    "SZ-OUTERTR": (0.92, -2.42, 0.64, 540, 0.49),
}
PAGE_B, PAGE_C = 1.0, 0.018
# Region order of the OpenSHA tectonic-regime grid (TectonicRegimeTable.java, strec_name / garcia_regions).
REGIME_ORDER = ["ANSR-DEEPCON", "ANSR-HOTSPOT", "ANSR-OCEANBD", "ANSR-SHALCON", "ANSR-ABSLDEC", "ANSR-ABSLOCB",
                "ANSR-ABSLSHC", "SCR-ABVSLAB", "SCR-GENERIC", "SOR-ABVSLAB", "SOR-GENERIC", "SZ-GENERIC",
                "SZ-INLBACK", "SZ-ONSHORE", "SZ-OUTERTR"]


def wc_radius_km(mag: float) -> float:
    """Sequence radius used across the atlas: max(100 km, L), L = 10^(-2.44 + 0.59 M) (Wells & Coppersmith 1994)."""
    return max(100.0, 10 ** (-2.44 + 0.59 * mag))


def a_sigma(regime: str, mag: float) -> float:
    """Magnitude-dependent spread of the regional a-value: sqrt(s0^2 + s1^2 / 10^max(M, 6)) (OpenSHA OAF)."""
    _, _, _, s1, s0 = PAGE2016[regime]
    return math.sqrt(s0 ** 2 + s1 ** 2 / 10 ** max(mag, 6.0))


# ----------------------------------------------------------------------------------------------- regime grid
class RegimeTable:
    """Garcia et al. (2012) tectonic regime on a 0.05 degree grid, decoded from OpenSHA's TectonicRegimeTable.dat.

    File: 15 point counts, then per latitude row (-90..90): N, N start columns, N regime indices."""
    LAT_N, LON_N = 3601, 7201

    def __init__(self, text: str):
        v = np.array(text.split(), dtype=np.int64)
        pos = len(REGIME_ORDER)
        self.cols, self.idx = [], []
        for _ in range(self.LAT_N):
            n = int(v[pos]); pos += 1
            self.cols.append(v[pos:pos + n]); pos += n
            self.idx.append(v[pos:pos + n]); pos += n
        if pos != v.size:
            raise ValueError(f"regime table: {v.size - pos} values left over")

    def regime(self, lat: float, lon: float) -> str:
        row = int(round((min(90.0, max(-90.0, lat)) + 90.0) / 180.0 * (self.LAT_N - 1)))
        lon = ((lon + 180.0) % 360.0) - 180.0
        col = int(round((lon + 180.0) / 360.0 * (self.LON_N - 1))) % self.LON_N
        k = int(np.searchsorted(self.cols[row], col, side="right")) - 1
        return REGIME_ORDER[int(self.idx[row][max(k, 0)])]


# ----------------------------------------------------------------------------------------------- selection
def select_mainshocks(t_days, lat, lon, mag):
    """Largest first. An event belongs to a larger chosen mainshock's sequence (it does not start its own) when it
    lies inside that mainshock's window (0-365 days after, within R) or is a near-simultaneous doublet
    (|dt| <= 1 day, within 2 R). Returns (independent indices, {independent index: [absorbed indices]}).
    The caller keeps only the independent events inside its own time range; older ones are passed in so that they
    can absorb their own aftershocks."""
    order = np.argsort(-np.asarray(mag, float), kind="stable")
    chosen, absorbed = [], {}
    for i in order:
        parent = None
        for j in chosen:
            R = wc_radius_km(mag[j])
            dt = t_days[i] - t_days[j]
            d = sl.haversine_km(lat[i], lon[i], lat[j], lon[j])
            if (0 <= dt <= 365 and d <= R) or (abs(dt) <= 1 and d <= 2 * R):
                parent = j
                break
        if parent is None:
            chosen.append(int(i))
        else:
            absorbed.setdefault(parent, []).append(int(i))
    return chosen, absorbed


# ----------------------------------------------------------------------------------------------- completeness
def mc_t(t, mag_main: float, mcat: float):
    return sl.mc_helmstetter(t, mag_main, mcat, F_MC, G_MC, H_MC)


def estimate_mcat(t, m, age_days: float, floor: float):
    """MAXC + 0.2 of the events after min(10 days, half the sequence age); MCAT_DEFAULT with fewer than 30 events."""
    late = m[t >= min(10.0, 0.5 * age_days)]
    if late.size < 30:
        return MCAT_DEFAULT, "default"
    return max(floor, float(sl.mc_maxc(late, DM, correction=0.2))), "maxc+0.2"


# ----------------------------------------------------------------------------------------------- Omori-Utsu
def weight(t, mag_main, mcat, b):
    """Fraction of M >= Mcat events that are above Mc(t) for a GR distribution with this b."""
    return 10 ** (-b * (mc_t(t, mag_main, mcat) - mcat))


def _grid(T2, n=4000):
    return np.unique(np.r_[np.geomspace(1e-6, T2, n), T2])


def expected_cum(tq, K, c, p, mag_main, mcat, b):
    """Expected number of events above Mc(t) between the mainshock and each time in tq (no extrapolation is done
    by the caller: tq never exceeds the data cut-off)."""
    tq = np.atleast_1d(np.asarray(tq, float))
    g = _grid(max(float(tq.max()), 1e-5))
    f = K * weight(g, mag_main, mcat, b) * (g + c) ** (-p)
    cum = np.r_[0.0, np.cumsum(0.5 * (f[1:] + f[:-1]) * np.diff(g))]
    return np.interp(tq, g, cum)


def omori_fit(t, m, T2, mag_main, mcat, b):
    """Omori-Utsu MLE with time-dependent completeness (seislib.omori_fit_mct) plus 95 % intervals and a quality code.

    Quality as in scripts/sequences.py: A = n >= 100, sigma_p <= 0.10, 0.5 <= p <= 2, no second event within 0.5 of
    the mainshock; B = n >= 50, sigma_p <= 0.20, 0.5 <= p <= 2.5; C otherwise; insufficient below 20 events."""
    keep = sl.bin_mag(m, DM) >= mc_t(t, mag_main, mcat) - DM / 2 + 1e-9
    n = int(keep.sum())
    if n < 20:
        return {"quality": "insufficient", "n": n}
    f = sl.omori_fit_mct(t, m, 0.0, T2, mag_main, mcat, b, F_MC, G_MC, H_MC)
    sp, sc, sK = f["sp"], f["sc"], f["sK"]
    out = {"n": int(f["n"]), "K": f["K"], "c": f["c"], "p": f["p"], "sK": sK, "sc": sc, "sp": sp,
           "p_lo": f["p"] - 1.96 * sp if np.isfinite(sp) else None,
           "p_hi": f["p"] + 1.96 * sp if np.isfinite(sp) else None,
           "K_lo": max(0.0, f["K"] - 1.96 * sK), "K_hi": f["K"] + 1.96 * sK,
           "c_resolved": bool(f["c"] >= 1e-3 and np.isfinite(sc))}
    if out["c_resolved"]:
        s = sc / f["c"]
        out["c_lo"], out["c_hi"] = f["c"] * math.exp(-1.96 * s), f["c"] * math.exp(1.96 * s)
    return out


def omori_quality(fit, contaminated: bool):
    if fit.get("quality") == "insufficient":
        return "insufficient"
    okp = fit["sp"] is not None and np.isfinite(fit["sp"])
    if fit["n"] >= 100 and okp and fit["sp"] <= 0.10 and 0.5 <= fit["p"] <= 2 and not contaminated:
        return "A"
    if fit["n"] >= 50 and okp and fit["sp"] <= 0.20 and 0.5 <= fit["p"] <= 2.5:
        return "B"
    return "C"


def productivity(t, m, T2, mag_main, mcat, regime):
    """Sequence a-value with the regional generic p, c and b of Page et al. (2016) held fixed (only a is free, as in
    the USGS sequence-specific RJ update), compared with the regional distribution of a (mean, sigma).

    Class: "more" when the 95 % interval of the sequence a lies above the middle half of the regional distribution
    (above its 75th percentile), "less" when it lies below the 25th percentile, "typical" otherwise, and
    "insufficient" with fewer than 10 events above Mc(t).

    With p, c, b fixed, the MLE of K is n / expected count per unit K, and sigma(log10 K) = 1 / (ln 10 sqrt n)."""
    p_reg, a_mean = PAGE2016[regime][0], PAGE2016[regime][1]
    keep = sl.bin_mag(m, DM) >= mc_t(t, mag_main, mcat) - DM / 2 + 1e-9
    n = int(keep.sum())
    unit = float(expected_cum([T2], 1.0, PAGE_C, p_reg, mag_main, mcat, PAGE_B)[0])
    if n == 0 or unit <= 0:
        return {"regime": regime, "n": n, "class": "insufficient", "a_regional": a_mean,
                "a_regional_sigma": a_sigma(regime, mag_main), "p_regional": p_reg}
    a = math.log10(n / unit) - PAGE_B * (mag_main - mcat)
    sa = 1.0 / (LN10 * math.sqrt(n))
    lo, hi = a - 1.96 * sa, a + 1.96 * sa
    sig_reg = a_sigma(regime, mag_main)
    # "typical" = the middle half of the regional a-value distribution (25th to 75th percentile)
    q = 0.6745 * sig_reg
    cls = "more" if lo > a_mean + q else "less" if hi < a_mean - q else "typical"
    if n < 10:
        cls = "insufficient"
    return {"regime": regime, "n": n, "a": a, "a_lo": lo, "a_hi": hi, "a_regional": a_mean,
            "a_regional_sigma": sig_reg, "p_regional": p_reg, "c_regional": PAGE_C, "b_regional": PAGE_B,
            "typical_lo": a_mean - q, "typical_hi": a_mean + q,
            "ratio": 10 ** (a - a_mean), "ratio_lo": 10 ** (lo - a_mean), "ratio_hi": 10 ** (hi - a_mean),
            "percentile": 100 * 0.5 * (1 + math.erf((a - a_mean) / (sig_reg * math.sqrt(2)))),
            "class": cls}


# ----------------------------------------------------------------------------------------------- b-values
def b_quality(n, lo, hi):
    if n < 50 or lo is None or hi is None:
        return "insufficient"
    w = hi - lo
    return "A" if w <= 0.30 else "B" if w <= 0.50 else "C"


def b_bootstrap_seq(t, m, age_days, mag_main, floor, nboot=NBOOT, rng=0):
    """Aki-Utsu b with the per-event threshold Mc(t) (seislib.b_varmc); 95 % percentile interval from `nboot`
    resamples of the whole sequence, Mcat re-estimated in every replicate. Quality gate as for the map cells."""
    mcat, _ = estimate_mcat(t, m, age_days, floor)
    b, _, n = sl.b_varmc(m, mc_t(t, mag_main, mcat), DM)
    if n < 50 or not np.isfinite(b):
        return {"b": None, "b_raw": float(b) if np.isfinite(b) else None, "lo": None, "hi": None, "n": int(n),
                "q": "insufficient"}
    r = np.random.default_rng(rng)
    bs = []
    for _ in range(nboot):
        k = r.integers(0, t.size, t.size)
        mc_k, _ = estimate_mcat(t[k], m[k], age_days, floor)
        bb, _, nn = sl.b_varmc(m[k], mc_t(t[k], mag_main, mc_k), DM)
        if nn >= 2 and np.isfinite(bb):
            bs.append(bb)
    lo, hi = (float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))) if len(bs) >= nboot // 2 else (None, None)
    q = b_quality(n, lo, hi)
    return {"b": float(b) if q in ("A", "B") else None, "b_raw": float(b), "lo": lo, "hi": hi, "n": int(n), "q": q}


def b_positive_seq(t, m):
    o = np.argsort(t)
    b, s, n = sl.b_positive(m[o], DM, 0.2)
    if n < 50 or not np.isfinite(b):
        return {"b": None, "lo": None, "hi": None, "n": int(n)}
    return {"b": float(b), "lo": float(b - 1.96 * s), "hi": float(b + 1.96 * s), "n": int(n)}


# ----------------------------------------------------------------------------------------------- other summaries
def bath(m_after, mag_main):
    """Largest aftershock and the Bath's-law difference Mm - Mmax (typically about 1.2; Bath 1965)."""
    if m_after.size == 0:
        return None
    mx = float(np.max(m_after))
    return {"mag": mx, "dm": round(mag_main - mx, 2)}


def daily_counts(t, m, age_days, mcat):
    nd = max(1, int(math.ceil(age_days)))
    edges = np.arange(nd + 1, dtype=float)
    return (np.histogram(t, edges)[0].tolist(),
            np.histogram(t[sl.bin_mag(m, DM) >= mcat - DM / 2 + 1e-9], edges)[0].tolist())


def cum_grid(age_days):
    """Times (days) at which the cumulative curves are tabulated: first hours, then whole days, then the cut-off."""
    g = [x for x in (1 / 24, 0.25, 0.5) if x < age_days]
    g += list(np.arange(1, math.floor(age_days) + 1, dtype=float))
    if not g or g[-1] < age_days - 1e-6:
        g.append(age_days)
    return np.round(np.array(g, float), 4)


def magtype_mix(magtypes):
    """Share of each magnitude type (lower case), largest first."""
    if len(magtypes) == 0:
        return []
    u, c = np.unique(np.char.lower(np.asarray(magtypes, str)), return_counts=True)
    o = np.argsort(-c)
    return [[str(u[i]), round(float(c[i]) / len(magtypes), 3)] for i in o[:4]]
