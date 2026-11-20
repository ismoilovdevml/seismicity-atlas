"""Catalogue statistics: completeness, Gutenberg-Richter b-value, declustering, Omori-Utsu.

All functions take plain numpy arrays. Magnitudes are binned to `dm` (default 0.1) before any estimate, rounding
half up (bin x holds [x - dm/2, x + dm/2)), so every bin has the same width also for magnitudes reported with two
decimals. b is the maximum-likelihood estimate for binned magnitudes (geometric distribution of the excess over the
lowest bin; Tinti & Mulargia 1987, as in van der Elst 2021 and SeismoStats); the Aki-Utsu formula with the dm/2
correction is its approximation and was used before 0.6.0 (-0.3 % at b = 1, -1 % at b = 1.5).

References
  Aki 1965; Utsu 1965; Tinti & Mulargia 1987 (b MLE); Shi & Bolt 1982 (b uncertainty); van der Elst 2021 (b-positive);
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
    """Nearest bin centre, ties (x.x5 for dm 0.1) up: bin x holds [x - dm/2, x + dm/2).

    Before 0.6.0 ties went to whichever side the float quotient fell (5.25, 5.35, 5.45 down, 5.15, 5.75 up), so for
    two-decimal magnitudes (ISC-GEM Mw: 9 % ties) the bins had unequal widths and b changed with the parity of the
    threshold by up to 0.015. The 1e-6 absorbs float noise in m / dm."""
    return np.round(np.floor(np.asarray(m, float) / dm + 0.5 + 1e-6) * dm, 6)


def b_from_excess(mean_excess, dm: float = 0.1):
    """b from the mean excess of binned magnitudes over their lowest kept bin (centre), maximum likelihood for
    binned data: beta = ln(1 + dm / mean) / dm (Tinti & Mulargia 1987), b = beta log10(e); dm = 0 gives the
    continuous estimator 1 / mean. NaN when the mean is not positive (every event in the lowest bin)."""
    x = np.asarray(mean_excess, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        beta = np.log1p(dm / x) / dm if dm > 0 else 1.0 / x
    b = np.where((x > 0) & np.isfinite(beta), beta * LOG10E, np.nan)
    return float(b) if b.ndim == 0 else b


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


# ----------------------------------------------------------------------------------------------- b-value
def b_aki(m, mc: float, dm: float = 0.1):
    """Maximum-likelihood b of binned magnitudes at or above the bin mc (b_from_excess), plus the Shi-Bolt (1982)
    standard error. Returns (b, sigma_b, n, a) where a is log10 N(>=mc)."""
    m = bin_mag(m, dm)
    m = m[m >= mc - dm / 2 + 1e-9]
    n = m.size
    if n < 2:
        return np.nan, np.nan, n, np.nan
    mean = m.mean()
    b = b_from_excess(mean - bin_mag(mc, dm), dm)
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
    """b-positive (van der Elst 2021): the binned maximum-likelihood b (b_from_excess) of the positive successive
    magnitude differences >= dmc.

    Insensitive to short-term aftershock incompleteness. Input must be ordered in time.
    Returns (b, sigma_b, n_differences)."""
    m = bin_mag(m_time_ordered, dm)
    d = bin_mag(np.diff(m), dm)
    d = d[d >= dmc - dm / 2 + 1e-9]
    n = d.size
    if n < 2:
        return np.nan, np.nan, n
    # differences of exponentials are Laplace; the positive side is exponential with the same beta (geometric
    # with the same ratio for binned magnitudes)
    b = b_from_excess(d.mean() - bin_mag(dmc, dm), dm)
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


def _ks_exp(x):
    """Kolmogorov-Smirnov distance between the sample x >= 0 and an exponential with the sample-mean scale.

    x has shape (..., n); returns shape (...)."""
    x = np.sort(x, axis=-1)
    n = x.shape[-1]
    F = 1.0 - np.exp(-x / x.mean(axis=-1, keepdims=True))
    i = np.arange(1, n + 1)
    return np.maximum((i / n - F).max(axis=-1), (F - (i - 1) / n).max(axis=-1))


def lilliefors_exp_p(x, nsim: int = 500, rng=None):
    """Lilliefors (1969) test of exponentiality with unknown scale; Monte Carlo p-value.

    The null distribution of the statistic does not depend on the scale, so it is simulated with unit-rate
    exponentials of the same size n (in chunks to bound memory)."""
    rng = np.random.default_rng(rng)
    x = np.asarray(x, float)
    d = _ks_exp(x)
    n = x.size
    chunk = max(1, int(2e6 // max(n, 1)))
    ge = 0
    for s in range(0, nsim, chunk):
        k = min(chunk, nsim - s)
        ge += int((_ks_exp(rng.exponential(1.0, (k, n))) >= d).sum())
    return (ge + 1) / (nsim + 1)


def _dither_trexp(m, res: float, beta: float, rng):
    """Spread magnitudes reported at resolution `res` inside their bin with a truncated exponential of rate beta.

    Uniform dithering of a geometric (binned exponential) sample does not give an exponential; the truncated
    exponential within each bin does (Stallone & Spassiani, Seismica, doi:10.26443/seismica.v5i1.2257)."""
    u = rng.random(m.size)
    # inverse CDF of exp(-beta y) on y in [0, res), measured from the lower bin edge
    y = -np.log1p(-u * (1.0 - np.exp(-beta * res))) / beta
    return m - res / 2 + y


def lilliefors_offset(m, thr, offsets, res: float = 0.01, step: float = 0.1, alpha: float = 0.1,
                      ndither: int = 20, nsim: int = 300, nmin: int = 50, rng=None):
    """Smallest offset k (from `offsets`, increasing) at which the excesses over a per-event threshold thr_i + k
    pass the Lilliefors exponentiality test (median p over `ndither` dithers >= alpha).

    Thresholds are bin centres on the `step` grid: event i is kept when m_i >= thr_i + k - step/2. Kept
    magnitudes, reported at resolution `res`, are spread within their `res` bin (truncated-exponential dither) and
    measured from the lower edge of the lowest kept `res` bin of their own threshold. Under Gutenberg-Richter
    the pooled excesses are exponential with one rate (memoryless property), as in b_varmc. Returns (k, table)
    with table rows (k, n, median p); k is NaN when no offset passes with at least nmin events."""
    rng = np.random.default_rng(rng)
    m = np.round(np.asarray(m, float) / res) * res
    thr = np.broadcast_to(np.asarray(thr, float), m.shape)
    table = []
    for k in np.round(np.asarray(offsets, float), 6):
        c = np.round((thr + k) / step) * step
        keep = m >= c - step / 2 - 1e-9
        s = m[keep]
        if s.size < nmin:
            break
        # lower edge of the lowest kept `res` bin: the first res-grid value >= c - step/2, minus res/2. ceil, not
        # round: with res == step, (c - step/2)/res ends in .5 and round-half-to-even moved the edge one bin down
        edge = np.ceil((c[keep] - step / 2) / res - 1e-6) * res - res / 2
        beta = 1.0 / (s - edge).mean()
        ps = [lilliefors_exp_p(_dither_trexp(s, res, beta, rng) - edge, nsim, rng) for _ in range(ndither)]
        p = float(np.median(ps))
        table.append((float(k), int(s.size), p))
        if p >= alpha:
            return float(k), table
    return np.nan, table


def mc_lilliefors(m, res: float = 0.01, step: float = 0.1, alpha: float = 0.1, ndither: int = 20,
                  nsim: int = 300, nmin: int = 50, rng=None, mc_range=None):
    """Mc-Lilliefors (Herrmann & Marzocchi 2021, SRL 92(2A), doi:10.1785/0220200337), independent implementation.

    Candidates are bin centres on the `step` grid with the same meaning as elsewhere here (candidate Mc keeps
    magnitudes >= Mc - step/2); see lilliefors_offset for the test. Mc is the smallest candidate whose median
    p-value is >= alpha. Returns (mc, table) with rows (candidate, n, median p); mc is NaN if none passes."""
    m = np.asarray(m, float)
    lo, hi = mc_range if mc_range is not None else (np.floor(m.min() / step) * step, m.max())
    k, table = lilliefors_offset(m, np.round(lo, 6), np.arange(0, hi - lo + step / 2, step), res, step, alpha,
                                 ndither, nsim, nmin, rng)
    table = [(round(lo + t[0], 6), t[1], t[2]) for t in table]
    return (round(lo + k, 6) if np.isfinite(k) else np.nan), table


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


def decluster_gk_layers(t_days, lat, lon, m, layer, fs_time_prop: float = 1.0):
    """decluster_gk run separately within each depth layer (e.g. shallow <= 70 km / deeper), so that an event of
    one layer can never remove an event of another: the windows are epicentral, and on the whole catalogue a
    400 km deep event removed shallow ones above it. Returns the same boolean array as decluster_gk."""
    layer = np.asarray(layer)
    t, la, lo, mm = (np.asarray(a, float) for a in (t_days, lat, lon, m))
    out = np.zeros(t.size, bool)
    for v in np.unique(layer):
        k = layer == v
        out[k] = decluster_gk(t[k], la[k], lo[k], mm[k], fs_time_prop)
    return out


def great_circle_midpoint(lat1, lon1, lat2, lon2):
    """Midpoint on the sphere of two points (degrees); correct across the antimeridian, where the arithmetic mean
    of the longitudes is not (179.7 and -179.2 give 0.2 instead of 180.2)."""
    la1, lo1, la2, lo2 = map(np.radians, (lat1, lon1, lat2, lon2))
    x = np.cos(la1) * np.cos(lo1) + np.cos(la2) * np.cos(lo2)
    y = np.cos(la1) * np.sin(lo1) + np.cos(la2) * np.sin(lo2)
    z = np.sin(la1) + np.sin(la2)
    return np.degrees(np.arctan2(z, np.hypot(x, y))), np.degrees(np.arctan2(y, x))


# ----------------------------------------------------------------------------------------------- Omori-Utsu
def _ou_integral(c, p, T1, T2):
    if abs(p - 1) < 1e-8:
        return np.log((T2 + c) / (T1 + c))
    return ((T2 + c) ** (1 - p) - (T1 + c) ** (1 - p)) / (1 - p)


C_MIN_DAYS = 1e-4          # lower bound of the Omori c in the fits (8.6 s; below any catalogue's timing resolution)
P_BOUNDS = (0.05, 5.0)     # search range of p (wide: only keeps the simplex out of meaningless values)


def _c_bounds(T2: float, c_min: float):
    return (np.log(c_min), np.log(max(float(T2), 1.0)))


def _ou_starts(p0: float, logc0, lo: float, hi: float):
    return [[p0, float(np.clip(x, lo, hi))] for x in logc0]


def omori_fit(t, T1: float, T2: float, c0: float = 0.05, p0: float = 1.1, fix_c: float | None = None,
              c_min: float = C_MIN_DAYS):
    """Maximum-likelihood Omori-Utsu fit, rate K/(t+c)^p on [T1, T2] (Ogata 1983). t in days after mainshock.

    K is profiled out analytically (K = n / integral). c is searched in [c_min, max(T2, 1)] days: without early
    data the likelihood keeps rising as c -> 0, the old unconstrained search then returned c ~ 1e-15 with a singular
    Hessian. When c ends at c_min (`c_at_bound`), c is reported as not resolved (sc NaN) and the standard errors
    of K and p are those for c fixed there. Returns dict with K, c, p, standard errors from the observed-information
    matrix, n and log-likelihood."""
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

    lo, hi = _c_bounds(T2, c_min)
    if fix_c is not None:
        starts, bounds = [[p0]], [P_BOUNDS]
    else:
        starts = _ou_starts(p0, [np.log(c0), np.log(0.005), np.log(0.5)], lo, hi) + [[0.9, max(np.log(0.02), lo)]]
        bounds = [P_BOUNDS, (lo, hi)]
    best = min((minimize(nll, s, method="Nelder-Mead", bounds=bounds,
                         options={"xatol": 1e-7, "fatol": 1e-9, "maxiter": 20000}) for s in starts),
               key=lambda r: r.fun)
    p = float(best.x[0])
    c = fix_c if fix_c is not None else float(np.exp(best.x[1]))
    at_bound = fix_c is None and best.x[1] - lo < 1e-3
    K = n / _ou_integral(c, p, T1, T2)
    se = _omori_se(t, T1, T2, K, c, p, fix_c is not None or at_bound)
    return {"K": K, "c": c, "p": p, "sK": se[0], "sc": se[1], "sp": se[2], "n": n, "T1": T1, "T2": T2,
            "logL": -best.fun, "c_at_bound": bool(at_bound)}


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
    out = np.full(3, np.nan)
    cov = _inv_cov(-H)
    if cov is not None:
        out[free] = np.sqrt(np.diag(cov))
    return out


def _inv_cov(info):
    """Inverse of an observed-information matrix, or None when it is not finite and positive definite."""
    if not np.isfinite(info).all():
        return None
    try:
        np.linalg.cholesky(info)
        cov = np.linalg.inv(info)
    except np.linalg.LinAlgError:
        return None
    return cov if np.isfinite(cov).all() and (np.diag(cov) > 0).all() else None


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
                  F: float = 1.0, G: float = 4.5, H: float = 0.75, fix_c: float | None = None, dm: float = 0.1,
                  c_min: float = C_MIN_DAYS):
    """Omori-Utsu MLE that keeps the early incomplete part of a sequence (Page et al. 2016 style).

    Only events with M >= Mc(t) are used; the expected rate of such events is
    K (t+c)^-p 10^(-b (Mc(t) - Mcat)), K being the rate of M >= Mcat events. c is searched in [c_min, max(T2, 1)]
    days (see omori_fit); `c_at_bound` marks a fit whose c ended at c_min.

    Standard errors: (p, log c) from the observed information of the profile likelihood; K = n / A(p, c) with n
    Poisson, so var(log K) = 1/n + g' Cov(p, log c) g, g = d log A / d(p, log c) (the K-K element of the inverse
    full information; the old K/sqrt(n) left out the covariance with p and c and was about half the true scatter).
    Non-finite or non-positive-definite information gives NaN errors. Returns the same dict as omori_fit."""
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

    lo, hi = _c_bounds(T2, c_min)
    if fix_c is not None:
        starts, bounds = [[1.1]], [P_BOUNDS]
    else:
        starts = [[1.1, max(np.log(0.01), lo)], [1.0, max(np.log(0.1), lo)], [1.2, max(np.log(0.001), lo)]]
        bounds = [P_BOUNDS, (lo, hi)]
    best = min((minimize(nll, s, method="Nelder-Mead", bounds=bounds,
                         options={"xatol": 1e-7, "fatol": 1e-9, "maxiter": 20000}) for s in starts),
               key=lambda r: r.fun)
    p = float(best.x[0])
    c = fix_c if fix_c is not None else float(np.exp(best.x[1]))
    at_bound = fix_c is None and best.x[1] - lo < 1e-3
    K = n / integral(c, p)

    # observed information of the profile likelihood in (p[, log c]); c at its bound -> p alone, c fixed there
    k = 1 if (fix_c is not None or at_bound) else 2
    x = np.array([p, np.log(c)])[:k]

    def f(v):
        return -nll(np.r_[v, np.log(c)] if (k == 1 and fix_c is None) else v)

    def log_a(v):
        return np.log(integral(c if k == 1 else np.exp(v[1]), v[0]))

    h = 1e-3
    Hm = np.zeros((k, k))
    g = np.zeros(k)
    for i in range(k):
        ei = np.zeros(k); ei[i] = h
        g[i] = (log_a(x + ei) - log_a(x - ei)) / (2 * h)
        for j in range(k):
            ej = np.zeros(k); ej[j] = h
            Hm[i, j] = (f(x + ei + ej) - f(x + ei - ej) - f(x - ei + ej) + f(x - ei - ej)) / (4 * h * h)
    cov = _inv_cov(-Hm)
    if cov is None:
        sp = sc = sK = np.nan
    else:
        sp = float(np.sqrt(cov[0, 0]))
        sc = float(c * np.sqrt(cov[1, 1])) if k > 1 else np.nan
        sK = float(K * np.sqrt(1.0 / n + g @ cov @ g))
    return {"K": K, "c": c, "p": p, "sK": sK, "sc": sc, "sp": sp, "n": n, "T1": T1, "T2": T2,
            "logL": -best.fun, "c_at_bound": bool(at_bound)}


# ----------------------------------------------------------------------------------------------- atlas additions
def b_varmc(m, thr, dm: float = 0.1):
    """Maximum-likelihood b with a per-event completeness threshold (e.g. Mc changing with time).

    Each event's excess over its own threshold bin is geometric with the same ratio (memoryless property), so b is
    b_from_excess of the mean of m_i - thr_i over events with m_i >= thr_i. Returns (b, sigma_b Shi-Bolt-type, n)."""
    m = bin_mag(m, dm)
    thr = bin_mag(thr, dm)
    keep = m >= thr - 1e-9
    x = m[keep] - thr[keep]
    n = x.size
    if n < 2:
        return np.nan, np.nan, n
    b = b_from_excess(x.mean(), dm)
    sig = 2.3 * b ** 2 * np.sqrt(np.sum((x - x.mean()) ** 2) / (n * (n - 1)))
    return b, sig, n


def mc_maxc_fast(m_binned, dm: float = 0.1, correction: float = 0.2):
    """MAXC on already-binned magnitudes (bincount), used inside bootstrap loops."""
    k = np.round(m_binned / dm).astype(int)
    k0 = k.min()
    return round((np.argmax(np.bincount(k - k0)) + k0) * dm + correction, 6)
