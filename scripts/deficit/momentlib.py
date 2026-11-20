"""Moment-rate maths for the seismic-deficit layer (pure functions, no I/O).

Units: SI throughout (N m, m, Pa, 1/yr) unless a name says otherwise. Strain rates enter in 1/yr.

References
  Kostrov, B. V. (1974). Seismic moment and energy of earthquakes, and seismic flow of rock. Izv. Phys. Solid Earth 1, 23-40.
  Savage, J. C. & Simpson, R. W. (1997). Surface strain accumulation and the seismic moment tensor. BSSA 87(5), 1345-1353.
  Kagan, Y. Y. (2002). Seismic moment distribution revisited: I. Statistical results. GJI 148, 520-541.
  Vere-Jones, D., Robinson, R. & Yang, W. (2001). Remarks on the accelerated moment release model. GJI 144, 517-531
      (sampling a tapered Pareto as the minimum of a Pareto and an exponential variable).
  Bird, P. & Kagan, Y. Y. (2004). BSSA 94(6), 2380-2399 (moment-conservation corner magnitude).
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import brentq
from scipy.special import exp1, gamma, gammaincc

SEC_YR = 365.25 * 86400.0
MW_C = 9.1   # log10 M0 = 1.5 Mw + 9.1 (M0 in N m; IASPEI 2013 standard form, used by ISC-GEM)


def mw_to_m0(mw):
    return 10.0 ** (1.5 * np.asarray(mw, float) + MW_C)


def m0_to_mw(m0):
    return (np.log10(np.asarray(m0, float)) - MW_C) / 1.5


# ----------------------------------------------------------------------------------------------- geodetic side
def principal_horizontal(exx, eyy, exy):
    """Principal horizontal strain rates (e1 >= e2) of the 2-D tensor [[exx, exy], [exy, eyy]]."""
    exx, eyy, exy = (np.asarray(a, float) for a in (exx, eyy, exy))
    c = 0.5 * (exx + eyy)
    r = np.sqrt((0.5 * (exx - eyy)) ** 2 + exy ** 2)
    return c + r, c - r


def savage_simpson_rate(exx, eyy, exy):
    """Savage & Simpson (1997) scalar strain rate: max(|e1|, |e2|, |e1 + e2|).

    With incompressibility the vertical strain rate is -(e1 + e2), so this is the largest absolute principal value of
    the 3-D tensor. 2 mu H A times it is the minimum scalar moment rate of the double couples that produce the tensor.
    """
    e1, e2 = principal_horizontal(exx, eyy, exy)
    return np.maximum(np.maximum(np.abs(e1), np.abs(e2)), np.abs(e1 + e2))


def second_invariant(exx, eyy, exy):
    """sqrt(exx^2 + eyy^2 + 2 exy^2), the 'second invariant' of Kreemer et al. (2014) and Ou & Elliott (2026)."""
    exx, eyy, exy = (np.asarray(a, float) for a in (exx, eyy, exy))
    return np.sqrt(exx ** 2 + eyy ** 2 + 2.0 * exy ** 2)


def geodetic_moment_rate(e_ss, area_m2, mu_pa, h_m):
    """Kostrov / Savage-Simpson geodetic moment rate, N m / yr: sum over cells of 2 mu H A e_SS (full coupling)."""
    return 2.0 * mu_pa * h_m * float(np.nansum(np.asarray(e_ss, float) * np.asarray(area_m2, float)))


# ----------------------------------------------------------------------------------------------- seismic side
def upper_gamma(s, x):
    """Upper incomplete gamma function Gamma(s, x) for real s (also s <= 0) and x > 0.

    scipy's gammaincc is the regularised form and needs s > 0; for s <= 0 the recurrence
    Gamma(s, x) = (Gamma(s + 1, x) - x^s e^-x) / s is applied down from s + k > 0, with Gamma(0, x) = E1(x)."""
    s, x = np.broadcast_arrays(np.asarray(s, float), np.asarray(x, float))
    k = np.where(s > 0, 0, np.floor(-s) + 1).astype(int)          # steps up to s + k > 0 (s + k = 0 handled below)
    top = s + k
    zero = np.isclose(top, 1.0) & np.isclose(s, np.round(s)) & (s <= 0)   # integer s <= 0: start from Gamma(0, x)
    top = np.where(zero, 0.0, top)
    k = np.where(zero, k - 1, k)
    with np.errstate(invalid="ignore"):
        g = np.where(zero, exp1(x), gamma(np.where(zero, 1.0, top)) * gammaincc(np.where(zero, 1.0, top), x))
    for j in range(int(k.max()) if k.size else 0, 0, -1):      # Gamma(a - 1, x) = (Gamma(a, x) - x^(a-1) e^-x) / (a - 1)
        a = top - (k - j)                                       # current order for rows with k >= j
        step = k >= j
        g = np.where(step, (g - x ** (a - 1.0) * np.exp(-x)) / (a - 1.0), g)
    return g if g.ndim else float(g)


def tgr_mean_moment(m0_t, beta, m0_c):
    """Mean moment of a tapered G-R (Kagan 2002) above threshold moment m0_t, corner moment m0_c, beta > 0.

    Survivor F(M) = (Mt/M)^beta exp((Mt - M)/Mc), M >= Mt;  E[M] = Mt + Mt^beta e^(Mt/Mc) Mc^(1-beta) Gamma(1-beta, Mt/Mc).
    The exponential taper keeps the mean finite for every beta; for beta >= 1 (b >= 1.5) Gamma(1 - beta, x) has a
    non-positive order and comes from upper_gamma (before 0.6.0 such draws gave NaN through gammaincc).
    """
    x = m0_t / m0_c
    return m0_t + m0_t ** beta * np.exp(x) * m0_c ** (1.0 - beta) * upper_gamma(1.0 - beta, x)


def tgr_moment_rate(rate_t, mw_t, beta, mw_c):
    """Long-term seismic moment rate, N m / yr, for `rate_t` events / yr with Mw >= mw_t."""
    return rate_t * tgr_mean_moment(mw_to_m0(mw_t), beta, mw_to_m0(mw_c))


def tgr_sample_mw(n, mw_t, beta, mw_c, rng):
    """n magnitudes from a tapered G-R: M = min(Pareto, Mt + exponential(Mc)) (Vere-Jones et al. 2001)."""
    m0_t, m0_c = mw_to_m0(mw_t), mw_to_m0(mw_c)
    u1, u2 = rng.random(n), rng.random(n)
    pareto = m0_t * u1 ** (-1.0 / beta)
    expo = m0_t - m0_c * np.log(u2)
    return m0_to_mw(np.minimum(pareto, expo))


def balance_corner_mw(mdot, rate_t, mw_t, beta, mw_lo=6.0, mw_hi=10.5):
    """Corner magnitude at which the tapered G-R moment rate equals `mdot` (moment conservation, Bird & Kagan 2004).

    Outside the search range the side is kept: -inf when even a corner at mw_lo gives more moment than mdot (the
    observed rate alone exceeds the budget), +inf when a corner at mw_hi is not enough, nan when the rate is not
    finite. Before 0.6.0 both sides were nan and the caller used mw_hi for both.
    """
    f = lambda mc: tgr_moment_rate(rate_t, mw_t, beta, mc) - mdot  # noqa: E731
    lo, hi = f(mw_lo), f(mw_hi)
    if not (np.isfinite(lo) and np.isfinite(hi)):
        return float("nan")
    if lo > 0:
        return float("-inf")
    if hi < 0:
        return float("inf")
    return float(brentq(f, mw_lo, mw_hi, xtol=1e-4))


def bandwise_moment_rate(mw, year, bands, t_end):
    """Observed moment rate with a magnitude-dependent complete period.

    bands: list of (mw_lo, mw_hi, year_start). Each band's moment is summed over [year_start, t_end) and divided by
    its own window length, so early decades enter only for the magnitudes they record completely.
    Returns (total rate N m/yr, list of per-band dicts).
    """
    mw, year = np.asarray(mw, float), np.asarray(year, float)
    out, total = [], 0.0
    for lo, hi, y0 in bands:
        sel = (mw >= lo - 1e-9) & (mw < hi - 1e-9) & (year >= y0) & (year < t_end)
        T = t_end - y0
        rate = float(mw_to_m0(mw[sel]).sum() / T) if sel.any() else 0.0
        total += rate
        out.append({"mw_lo": lo, "mw_hi": hi, "year_start": y0, "years": T, "n": int(sel.sum()), "rate": rate})
    return total, out


def simulate_catalogue_sums(n_sim, rate_t, years, mw_t, beta, mw_c, rng):
    """Summed moment of n_sim synthetic catalogues (Poisson count, tapered G-R sizes) of length `years`."""
    counts = rng.poisson(rate_t * years, n_sim)
    allm = mw_to_m0(tgr_sample_mw(int(counts.sum()), mw_t, beta, mw_c, rng))
    idx = np.repeat(np.arange(n_sim), counts)
    return np.bincount(idx, weights=allm, minlength=n_sim)


def ratio_summary(x, q=(2.5, 50.0, 97.5)):
    x = np.asarray(x, float)
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"lo": None, "med": None, "hi": None}
    lo, med, hi = np.percentile(x, q)
    return {"lo": float(lo), "med": float(med), "hi": float(hi)}


R_EARTH = 6_371_008.8   # m, mean radius (IUGG)


def node_area_m2(lat_deg, dlon_deg, dlat_deg):
    """Exact spherical area of a lon/lat grid cell centred on lat_deg with sides dlon_deg x dlat_deg."""
    lat = np.radians(np.asarray(lat_deg, float))
    h = np.radians(dlat_deg) / 2.0
    return R_EARTH ** 2 * np.radians(dlon_deg) * (np.sin(lat + h) - np.sin(lat - h))


def bandwise_rate_draws(mw, sig, year, bands, t_end, n_draw, rng):
    """Band-wise moment rate with each event's moment drawn from its Mw uncertainty: M0 = 10^(1.5 (Mw + sig z) + 9.1).

    Band membership (the completeness decision) stays with the catalogue Mw, as completeness is a property of the
    reported magnitudes; only the moment of a counted event varies.
    """
    mw, sig, year = (np.asarray(a, float) for a in (mw, sig, year))
    if mw.size == 0:
        return np.zeros(n_draw)
    w = np.zeros(mw.size)                    # 1 / window length of the event's band, 0 when not counted
    for lo, hi, y0 in bands:
        s = (mw >= lo - 1e-9) & (mw < hi - 1e-9) & (year >= y0) & (year < t_end)
        w[s] = 1.0 / (t_end - y0)
    k = w > 0
    if not k.any():
        return np.zeros(n_draw)
    m0 = mw_to_m0(mw[k][None, :] + sig[k][None, :] * rng.standard_normal((n_draw, int(k.sum()))))
    return m0 @ w[k]


def kostrov_shortening(m0_sum, mu, h, length, years):
    """Shortening rate (m/yr) across a belt from a summed moment (N m) of pure thrusts striking along it:
    u = sum(M) / (2 mu H L T), the Kostrov (1974) average strain times the belt width (as in Molnar & Ghose 2000)."""
    return m0_sum / (2.0 * mu * h * length * years)
