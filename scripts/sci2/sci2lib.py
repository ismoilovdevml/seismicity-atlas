"""Shared maths for the second round of scientific comparisons (scripts/sci2/).

Everything here is an independent re-implementation from the published equations; no third-party code is copied.

- Weighted-likelihood ("high-definition") b-value with a Gaussian kernel and per-event completeness, as written in
  Taroni, Zhuang & Marzocchi (2021, SRL 92(6), doi:10.1785/0220210017), eqs. 4-5.
- A single-Mc estimator in the style described by pybvalue v0.0.1 (doi:10.5281/zenodo.11508511): Mc by maximum
  curvature, Aki (1965) MLE with the Utsu bin correction, Shi & Bolt (1982) uncertainty.
- Day/night ratio for quarry-blast screening (Wiemer & Baer 2000).
- The Poisson number test of CSEP (as in pyCSEP, csep.core.poisson_evaluations._number_test_ndarray).
"""
from __future__ import annotations

import math

import numpy as np
from scipy import stats

R_EARTH = 6371.0
LOG10E = math.log10(math.e)


def gc_km(lat0, lon0, lat, lon):
    """Great-circle distance (km), spherical law of cosines as in the Taroni et al. code (clipped for safety)."""
    la0, lo0, la, lo = map(np.radians, (lat0, lon0, lat, lon))
    x = np.sin(la0) * np.sin(la) + np.cos(la0) * np.cos(la) * np.cos(lo - lo0)
    return np.arccos(np.clip(x, -1.0, 1.0)) * R_EARTH


# ----------------------------------------------------------------------------------------------- b estimators
def b_whole_tz(m, mc, dm):
    """Whole-catalogue b with per-event completeness (Taroni 2021): ((N-1)/N) / (ln10 (mean(m - mc) + dm/2)).
    Events must already be at or above their own mc. Returns (b, n, sigma = b / sqrt(n))."""
    x = np.asarray(m, float) - np.asarray(mc, float)
    n = x.size
    b = ((n - 1) / n) / (math.log(10) * (x.mean() + dm / 2))
    return b, n, b / math.sqrt(n)


def b_wle(lat_g, lon_g, lat, lon, m, mc, dm, sigma_km):
    """Weighted-likelihood b at each grid point (Taroni et al. 2021, eqs. 4-5).

    w_i = exp(-r_i^2 / (2 s^2)) (the normalising constant cancels), b = sum w / (ln10 sum w (m - mc + dm/2)),
    sigma_b = b sqrt(sum w^2) / sum w. Also returns n_eff = (sum w)^2 / sum w^2 (Kish effective sample size).
    Events must already be at or above their own mc."""
    lat_g, lon_g = np.atleast_1d(lat_g).astype(float), np.atleast_1d(lon_g).astype(float)
    x = np.asarray(m, float) - np.asarray(mc, float) + dm / 2
    b = np.empty(lat_g.size)
    s = np.empty(lat_g.size)
    ne = np.empty(lat_g.size)
    for k in range(lat_g.size):
        r = gc_km(lat_g[k], lon_g[k], lat, lon)
        w = np.exp(-r * r / (2 * sigma_km ** 2))
        sw, sw2 = w.sum(), (w * w).sum()
        if sw <= 0:
            b[k] = s[k] = ne[k] = np.nan
            continue
        b[k] = sw / (math.log(10) * (w * x).sum())
        s[k] = b[k] * math.sqrt(sw2) / sw
        ne[k] = sw * sw / sw2
    return b, s, ne


def maxc(m, dm=0.1):
    """Maximum-curvature Mc: the most frequent magnitude bin (Wiemer & Wyss 2000)."""
    mb = np.round(np.asarray(m, float) / dm) * dm
    vals, cnt = np.unique(np.round(mb, 6), return_counts=True)
    return float(vals[np.argmax(cnt)])


def b_single_mc(m, dm=0.1, correction=0.0, nmin=50):
    """pybvalue-style estimate: one Mc = MAXC (+ correction) for all events, Aki (1965) MLE with the Utsu bin
    correction b = log10(e) / (mean - (Mc - dm/2)), Shi & Bolt (1982) sigma. Returns dict (b, sigma, n, mc)."""
    m = np.round(np.asarray(m, float) / dm) * dm
    if m.size < nmin:
        return {"b": np.nan, "sigma": np.nan, "n": int(m.size), "mc": np.nan}
    mc = maxc(m, dm) + correction
    x = m[m >= mc - 1e-9]
    n = x.size
    if n < nmin:
        return {"b": np.nan, "sigma": np.nan, "n": int(n), "mc": mc}
    b = LOG10E / (x.mean() - (mc - dm / 2))
    sig = 2.3 * b * b * math.sqrt(((x - x.mean()) ** 2).sum() / (n * (n - 1)))
    return {"b": float(b), "sigma": float(sig), "n": int(n), "mc": float(mc)}


# ----------------------------------------------------------------------------------------------- quarry blasts
def is_daytime(hour_local, day_start=7, day_end=19):
    """Daytime = local hours [day_start, day_end), 12 hours by default; night is the other 12 hours."""
    h = np.asarray(hour_local) % 24
    return (h >= day_start) & (h < day_end)


def day_night_ratio(hour_local, day_start=7, day_end=19):
    """D/N = daytime count / night-time count, normalised by the hours in each (equal for the 12/12 default).
    About 1 (slightly below) for natural seismicity; > 1.5 suggests blast contamination (Wiemer & Baer 2000)."""
    d = is_daytime(hour_local, day_start, day_end)
    hd = day_end - day_start
    nd, nn = int(d.sum()), int((~d).sum())
    if nn == 0:
        return np.inf if nd else np.nan
    return (nd / hd) / (nn / (24 - hd))


# ----------------------------------------------------------------------------------------------- comparison stats
def compare(x, y):
    """Agreement statistics of y against x (paired, finite pairs only)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    n = int(x.size)
    if n < 3:
        return {"n": n}
    d = y - x
    return {"n": n, "pearson_r": float(stats.pearsonr(x, y)[0]), "spearman_rho": float(stats.spearmanr(x, y)[0]),
            "median_diff": float(np.median(d)), "mean_diff": float(d.mean()), "rms_diff": float(np.sqrt((d * d).mean())),
            "mad_diff": float(np.median(np.abs(d - np.median(d)))), "sd_x": float(x.std(ddof=1)),
            "sd_y": float(y.std(ddof=1))}


# ----------------------------------------------------------------------------------------------- CSEP N-test
def n_test_poisson(expected, observed, eps=1e-6):
    """CSEP Poisson number test (Zechar et al. 2010; pyCSEP's _number_test_ndarray):
    delta1 = P(N >= n_obs), delta2 = P(N <= n_obs) for N ~ Poisson(expected)."""
    d1 = 1.0 - stats.poisson.cdf(observed - eps, expected)
    d2 = stats.poisson.cdf(observed + eps, expected)
    return float(d1), float(d2)


def n_test_mixture(expected_samples, observed):
    """Number test against a Poisson mixture over parameter samples (each sample a Poisson rate):
    delta1 = P(N >= n_obs), delta2 = P(N <= n_obs), averaged over the samples."""
    lam = np.asarray(expected_samples, float)
    d1 = float(np.mean(1.0 - stats.poisson.cdf(observed - 1e-6, lam)))
    d2 = float(np.mean(stats.poisson.cdf(observed + 1e-6, lam)))
    return d1, d2
