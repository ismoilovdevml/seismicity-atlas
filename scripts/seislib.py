"""Catalogue statistics: completeness, Gutenberg-Richter b-value, declustering, Omori-Utsu.

All functions take plain numpy arrays. Magnitudes are binned to `dm` (default 0.1) before any estimate.

References
  Aki 1965; Utsu 1965 (b MLE); Shi & Bolt 1982 (b uncertainty); van der Elst 2021 (b-positive);
  Wiemer & Wyss 2000 (MAXC, goodness of fit); Cao & Gao 2002, Woessner & Wiemer 2005 (b-stability, +0.2 MAXC);
  Gardner & Knopoff 1974 (declustering windows); Ogata 1983 (Omori-Utsu MLE);
  Reasenberg & Jones 1989; Page et al. 2016 (aftershock rate model, time-dependent completeness).
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import minimize

LOG10E = np.log10(np.e)


# ----------------------------------------------------------------------------------------------- magnitudes
def bin_mag(m, dm: float = 0.1):
    """Round magnitudes to the nearest bin centre (avoids float artefacts like 2.9999)."""
    return np.round(np.round(np.asarray(m, float) / dm) * dm, 6)


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


# ----------------------------------------------------------------------------------------------- b-value
def b_aki(m, mc: float, dm: float = 0.1):
    """Aki-Utsu maximum-likelihood b with the binning correction, plus Shi-Bolt (1982) standard error.

    Returns (b, sigma_b, n, a) where a is log10 N(>=mc)."""
    m = bin_mag(m, dm)
    m = m[m >= mc - dm / 2 + 1e-9]
    n = m.size
    if n < 2:
        return np.nan, np.nan, n, np.nan
    mean = m.mean()
    b = LOG10E / (mean - (mc - dm / 2))
    sig = 2.3 * b ** 2 * np.sqrt(np.sum((m - mean) ** 2) / (n * (n - 1)))
    return b, sig, n, np.log10(n)


def b_bootstrap(m, mc: float, dm: float = 0.1, nboot: int = 500, rng=None):
    """Bootstrap standard deviation of the Aki-Utsu b-value."""
    rng = np.random.default_rng(rng)
    m = bin_mag(m, dm)
    m = m[m >= mc - dm / 2 + 1e-9]
    if m.size < 10:
        return np.nan
    bs = [b_aki(rng.choice(m, m.size), mc, dm)[0] for _ in range(nboot)]
    return float(np.std(bs, ddof=1))


def b_positive(m_time_ordered, dm: float = 0.1, dmc: float = 0.2):
    """b-positive (van der Elst 2021): Aki-Utsu on positive successive magnitude differences >= dmc.

    Insensitive to short-term aftershock incompleteness. Input must be ordered in time.
    Returns (b, sigma_b, n_differences)."""
    m = bin_mag(m_time_ordered, dm)
    d = bin_mag(np.diff(m), dm)
    d = d[d >= dmc - dm / 2 + 1e-9]
    n = d.size
    if n < 2:
        return np.nan, np.nan, n
    # differences of exponentials are Laplace; the positive side is exponential with the same beta
    b = LOG10E / (d.mean() - (dmc - dm / 2))
    sig = 2.3 * b ** 2 * np.sqrt(np.sum((d - d.mean()) ** 2) / (n * (n - 1)))
    return b, sig, n


# ----------------------------------------------------------------------------------------------- completeness
def fmd(m, dm: float = 0.1):
    """Non-cumulative and cumulative frequency-magnitude distribution."""
    m = bin_mag(m, dm)
    lo, hi = m.min(), m.max()
    bins = bin_mag(np.arange(lo, hi + dm / 2, dm), dm)
    idx = np.round((m - lo) / dm).astype(int)
    nc = np.bincount(idx, minlength=bins.size)[: bins.size]
    cum = nc[::-1].cumsum()[::-1]
    return bins, nc, cum


def mc_maxc(m, dm: float = 0.1, correction: float = 0.0):
    """Maximum curvature: the bin with the highest non-cumulative count (+ optional correction)."""
    bins, nc, _ = fmd(m, dm)
    return float(bin_mag(bins[np.argmax(nc)] + correction, dm))


def mc_gft(m, dm: float = 0.1, levels=(95, 90)):
    """Goodness-of-fit test (Wiemer & Wyss 2000). Returns (mc, R%) or MAXC if no level is reached."""
    m = bin_mag(m, dm)
    bins, nc, cum = fmd(m, dm)
    m0 = mc_maxc(m, dm)
    trial = bins[(bins >= m0 - 0.4) & (bins <= m0 + 1.5)]
    res = []
    for mc in trial:
        b, _, n, _ = b_aki(m, mc, dm)
        if n < 25 or not np.isfinite(b):
            res.append(np.nan)
            continue
        sel = bins >= mc - dm / 2
        obs = cum[sel]
        syn = n * 10 ** (-b * (bins[sel] - mc))
        res.append(100 - 100 * np.sum(np.abs(obs - syn)) / np.sum(obs))
    res = np.array(res)
    for lev in levels:
        ok = np.where(res >= lev)[0]
        if ok.size:
            return float(trial[ok[0]]), float(res[ok[0]])
    return m0, float(np.nanmax(res)) if np.isfinite(res).any() else np.nan


def mc_mbs(m, dm: float = 0.1, span: float = 0.5, nmin: int = 50):
    """b-value stability (Cao & Gao 2002 with the Shi-Bolt criterion of Woessner & Wiemer 2005).

    First Mc at which |mean b over [Mc, Mc+span]| - b(Mc)| <= sigma_b(Mc)."""
    m = bin_mag(m, dm)
    bins, _, _ = fmd(m, dm)
    m0 = mc_maxc(m, dm)
    trial = bins[(bins >= m0 - 0.3) & (bins <= m0 + 2.0)]
    k = int(round(span / dm))
    bvals = {float(t): b_aki(m, t, dm) for t in bin_mag(np.arange(trial.min(), trial.max() + span + dm, dm), dm)}
    for mc in trial:
        b, sig, n, _ = bvals[float(mc)]
        if n < nmin or not np.isfinite(b):
            continue
        ahead = [bvals.get(float(bin_mag(mc + i * dm, dm)), (np.nan,))[0] for i in range(k + 1)]
        bave = np.nanmean(ahead)
        if abs(bave - b) <= sig:
            return float(mc)
    return np.nan


# ----------------------------------------------------------------------------------------------- declustering
def gk_windows(m):
    """Gardner & Knopoff (1974) space (km) and time (days) windows, as in ZMAP/OpenQuake."""
    m = np.asarray(m, float)
    L = 10 ** (0.1238 * m + 0.983)
    T = np.where(m >= 6.5, 10 ** (0.032 * m + 2.7389), 10 ** (0.5409 * m - 0.547))
    return L, T


def decluster_gk(t_days, lat, lon, m, fs_time_prop: float = 1.0):
    """Window declustering. Largest events first; events inside a mainshock's window are dependent.

    fs_time_prop scales the time window used *before* the mainshock (foreshocks); 1.0 = symmetric.
    Returns a boolean array: True = mainshock / independent event."""
    t = np.asarray(t_days, float)
    order_t = np.argsort(t)
    ts = t[order_t]
    L, T = gk_windows(m)
    cluster = np.full(t.size, -1)
    for i in np.argsort(-np.asarray(m, float), kind="stable"):
        if cluster[i] != -1:
            continue
        cluster[i] = i
        lo = np.searchsorted(ts, t[i] - fs_time_prop * T[i], "left")
        hi = np.searchsorted(ts, t[i] + T[i], "right")
        cand = order_t[lo:hi]
        cand = cand[cluster[cand] == -1]
        if cand.size == 0:
            continue
        d = haversine_km(lat[i], lon[i], lat[cand], lon[cand])
        cluster[cand[d <= L[i]]] = i
    return cluster == np.arange(t.size)


# ----------------------------------------------------------------------------------------------- Omori-Utsu
def _ou_integral(c, p, T1, T2):
    if abs(p - 1) < 1e-8:
        return np.log((T2 + c) / (T1 + c))
    return ((T2 + c) ** (1 - p) - (T1 + c) ** (1 - p)) / (1 - p)


def omori_fit(t, T1: float, T2: float, c0: float = 0.05, p0: float = 1.1, fix_c: float | None = None):
    """Maximum-likelihood Omori-Utsu fit, rate K/(t+c)^p on [T1, T2] (Ogata 1983). t in days after mainshock.

    K is profiled out analytically (K = n / integral). Returns dict with K, c, p, standard errors from the
    observed-information matrix, n and log-likelihood."""
    t = np.asarray(t, float)
    t = t[(t >= T1) & (t <= T2)]
    n = t.size

    def nll(theta):
        p = theta[0]
        c = fix_c if fix_c is not None else np.exp(theta[1])
        A = _ou_integral(c, p, T1, T2)
        if not np.isfinite(A) or A <= 0:
            return 1e30
        return -(n * np.log(n / A) - n - p * np.sum(np.log(t + c)))

    x0 = [p0] if fix_c is not None else [p0, np.log(c0)]
    best = None
    for start in ([x0] if fix_c is not None else [x0, [p0, np.log(0.005)], [p0, np.log(0.5)], [0.9, np.log(0.02)]]):
        r = minimize(nll, start, method="Nelder-Mead", options={"xatol": 1e-7, "fatol": 1e-9, "maxiter": 20000})
        if best is None or r.fun < best.fun:
            best = r
    p = best.x[0]
    c = fix_c if fix_c is not None else float(np.exp(best.x[1]))
    K = n / _ou_integral(c, p, T1, T2)
    se = _omori_se(t, T1, T2, K, c, p, fix_c is not None)
    return {"K": K, "c": c, "p": p, "sK": se[0], "sc": se[1], "sp": se[2], "n": n, "T1": T1, "T2": T2,
            "logL": -best.fun}


def _omori_loglik(t, T1, T2, K, c, p):
    return np.sum(np.log(K) - p * np.log(t + c)) - K * _ou_integral(c, p, T1, T2)


def _omori_se(t, T1, T2, K, c, p, fixed_c: bool):
    """Standard errors from a numerical Hessian of the full log-likelihood in (K, c, p)."""
    x = np.array([K, c, p], float)
    free = [0, 2] if fixed_c else [0, 1, 2]
    h = np.array([K * 1e-4, max(c * 1e-3, 1e-7), 1e-4])
    H = np.zeros((len(free), len(free)))

    def f(v):
        return _omori_loglik(t, T1, T2, *v)

    for a, i in enumerate(free):
        for b, j in enumerate(free):
            ei = np.zeros(3); ej = np.zeros(3)
            ei[i] = h[i]; ej[j] = h[j]
            H[a, b] = (f(x + ei + ej) - f(x + ei - ej) - f(x - ei + ej) + f(x - ei - ej)) / (4 * h[i] * h[j])
    try:
        cov = np.linalg.inv(-H)
        se = np.sqrt(np.clip(np.diag(cov), 0, None))
    except np.linalg.LinAlgError:
        se = np.full(len(free), np.nan)
    out = np.full(3, np.nan)
    out[free] = se
    return out


def rj_a_from_K(K: float, b: float, mag_main: float, mmin: float):
    """Reasenberg-Jones a-value from Omori K for events >= mmin: K = 10^(a + b (Mm - Mmin))."""
    return np.log10(K) - b * (mag_main - mmin)


def omori_cumulative(tgrid, K, c, p, T1):
    return K * np.array([_ou_integral(c, p, T1, tt) for tt in tgrid])


# ----------------------------------------------------------------------------------------------- synthetic data
def synth_gr(n: int, b: float, mmin: float, dm: float = 0.1, rng=None):
    """Synthetic Gutenberg-Richter magnitudes, continuous above mmin - dm/2 then binned."""
    rng = np.random.default_rng(rng)
    beta = b * np.log(10)
    return bin_mag(mmin - dm / 2 + rng.exponential(1 / beta, n), dm)


def synth_omori(K, c, p, T1, T2, rng=None):
    """Synthetic Omori-Utsu occurrence times on [T1, T2] by inverting the cumulative intensity."""
    rng = np.random.default_rng(rng)
    lam = K * _ou_integral(c, p, T1, T2)
    n = rng.poisson(lam)
    u = rng.uniform(0, 1, n) * _ou_integral(c, p, T1, T2)
    if abs(p - 1) < 1e-8:
        tt = (T1 + c) * np.exp(u) - c
    else:
        tt = ((T1 + c) ** (1 - p) + (1 - p) * u) ** (1 / (1 - p)) - c
    return np.sort(tt)


def mc_helmstetter(t, mag_main: float, mcat: float, F: float = 1.0, G: float = 4.5, H: float = 0.75):
    """Time-dependent aftershock completeness Mc(t) = max(Mcat, F*Mm - G - H log10 t) (Helmstetter et al. 2006;
    the F, G, H form used by the USGS operational aftershock forecasts)."""
    t = np.maximum(np.asarray(t, float), 1e-9)
    return np.maximum(mcat, F * mag_main - G - H * np.log10(t))


def omori_fit_mct(t, m, T1: float, T2: float, mag_main: float, mcat: float, b: float,
                  F: float = 1.0, G: float = 4.5, H: float = 0.75, fix_c: float | None = None, dm: float = 0.1):
    """Omori-Utsu MLE that keeps the early incomplete part of a sequence (Page et al. 2016 style).

    Only events with M >= Mc(t) are used; the expected rate of such events is
    K (t+c)^-p 10^(-b (Mc(t) - Mcat)), K being the rate of M >= Mcat events. Returns the same dict as omori_fit."""
    t = np.asarray(t, float)
    m = bin_mag(m, dm)
    mct = mc_helmstetter(t, mag_main, mcat, F, G, H)
    sel = (t >= T1) & (t <= T2) & (m >= mct - dm / 2 + 1e-9)
    ts = t[sel]
    n = ts.size
    grid = np.unique(np.r_[np.geomspace(max(T1, 1e-6), T2, 4000), T2])
    w = 10 ** (-b * (mc_helmstetter(grid, mag_main, mcat, F, G, H) - mcat))
    wi = 10 ** (-b * (mc_helmstetter(ts, mag_main, mcat, F, G, H) - mcat))

    def integral(c, p):
        f = w * (grid + c) ** (-p)
        return np.trapezoid(f, grid)

    def nll(theta):
        p = theta[0]
        c = fix_c if fix_c is not None else np.exp(theta[1])
        A = integral(c, p)
        return -(n * np.log(n / A) - n - p * np.sum(np.log(ts + c)) + np.sum(np.log(wi)))

    starts = [[1.1]] if fix_c is not None else [[1.1, np.log(0.01)], [1.0, np.log(0.1)], [1.2, np.log(0.001)]]
    best = min((minimize(nll, s, method="Nelder-Mead", options={"xatol": 1e-7, "fatol": 1e-9, "maxiter": 20000})
                for s in starts), key=lambda r: r.fun)
    p = best.x[0]
    c = fix_c if fix_c is not None else float(np.exp(best.x[1]))
    K = n / integral(c, p)

    # standard errors from a numerical Hessian of the profile likelihood in (p[, log c]), K from Poisson count
    def f(v):
        return -nll(v)
    x = best.x.copy()
    k = x.size
    h = 1e-3
    Hm = np.zeros((k, k))
    for i in range(k):
        for j in range(k):
            ei = np.zeros(k); ej = np.zeros(k); ei[i] = h; ej[j] = h
            Hm[i, j] = (f(x + ei + ej) - f(x + ei - ej) - f(x - ei + ej) + f(x - ei - ej)) / (4 * h * h)
    try:
        cov = np.linalg.inv(-Hm)
        sp = float(np.sqrt(cov[0, 0]))
        sc = float(c * np.sqrt(cov[1, 1])) if k > 1 else np.nan
    except np.linalg.LinAlgError:
        sp = sc = np.nan
    return {"K": K, "c": c, "p": p, "sK": K / np.sqrt(n), "sc": sc, "sp": sp, "n": n, "T1": T1, "T2": T2,
            "logL": -best.fun}


# ----------------------------------------------------------------------------------------------- atlas additions
def b_varmc(m, thr, dm: float = 0.1):
    """Aki-Utsu MLE with a per-event completeness threshold (e.g. Mc changing with time).

    Each event's excess over its own threshold is exponential with the same beta (memoryless property), so
    beta = n / sum(m_i - (thr_i - dm/2)) over events with m_i >= thr_i. Returns (b, sigma_b Shi-Bolt-type, n)."""
    m = bin_mag(m, dm)
    thr = bin_mag(thr, dm)
    keep = m >= thr - 1e-9
    x = m[keep] - (thr[keep] - dm / 2)
    n = x.size
    if n < 2:
        return np.nan, np.nan, n
    b = LOG10E / x.mean()
    sig = 2.3 * b ** 2 * np.sqrt(np.sum((x - x.mean()) ** 2) / (n * (n - 1)))
    return b, sig, n


def mc_maxc_fast(m_binned, dm: float = 0.1, correction: float = 0.2):
    """MAXC on already-binned magnitudes (bincount), used inside bootstrap loops."""
    k = np.round(m_binned / dm).astype(int)
    k0 = k.min()
    return round((np.argmax(np.bincount(k - k0)) + k0) * dm + correction, 6)
