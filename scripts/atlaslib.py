"""Per-cell estimators of the atlas (vectorised bootstrap). Used by atlas.py and by the synthetic recovery tests."""
from __future__ import annotations

import numpy as np

import seislib as sl

LOG10E = np.log10(np.e)
NMIN_B = 50          # minimum events above the threshold for any b-value
Q_A, Q_B = 0.30, 0.50  # 95 % CI width limits for quality A and B; wider -> C (b masked)


def maxc_rows(mm, dm=0.1, corr=0.2):
    """MAXC + corr for every row of a (B, N) array of binned magnitudes."""
    k = np.round(mm / dm).astype(np.int64)
    k0 = k.min()
    K = int(k.max() - k0 + 1)
    B = mm.shape[0]
    flat = (np.arange(B)[:, None] * K + (k - k0)).ravel()
    cnt = np.bincount(flat, minlength=B * K).reshape(B, K)
    return (np.argmax(cnt, axis=1) + k0) * dm + corr


def b_rows(mm, thr, dm=0.1):
    keep = mm >= thr - 1e-9
    n = keep.sum(axis=1)
    s = np.where(keep, mm - (thr - dm / 2), 0.0).sum(axis=1)
    with np.errstate(divide="ignore", invalid="ignore"):
        b = LOG10E / (s / n)
    b[n < 2] = np.nan
    return b, n


def quality(n, lo, hi):
    if n < NMIN_B or not np.isfinite(lo) or not np.isfinite(hi):
        return "insufficient"
    w = hi - lo
    return "A" if w <= Q_A else "B" if w <= Q_B else "C"


def cell_b(m, floor, nboot=200, rng=None, dm=0.1, nmin_mc=30):
    """b with a per-event threshold thr_i = max(Mc_cell, floor_i), Mc_cell = MAXC + 0.2 of the sample.

    The bootstrap resamples events and re-estimates Mc_cell in every replicate, so the b interval includes the
    Mc uncertainty (Woessner & Wiemer 2005). Returns a dict; b fields are NaN when quality is not A or B."""
    rng = np.random.default_rng(rng)
    m = sl.bin_mag(m, dm)
    floor = sl.bin_mag(floor, dm)
    N = m.size
    out = {"n_sample": int(N)}
    if N < nmin_mc:
        out.update(quality="insufficient", n_b=0)
        return out
    mc = float(sl.mc_maxc_fast(m, dm))
    thr = np.maximum(mc, floor)
    b, sig, n = sl.b_varmc(m, thr, dm)
    idx = rng.integers(0, N, (nboot, N))
    mm = m[idx]
    mcb = maxc_rows(mm, dm)
    bb, nb = b_rows(mm, np.maximum(mcb[:, None], floor[idx]), dm)
    ok = np.isfinite(bb) & (nb >= 2)
    lo, hi = (np.percentile(bb[ok], [2.5, 97.5]) if ok.sum() > 0.8 * nboot else (np.nan, np.nan))
    q = quality(n, lo, hi)
    # cutoff stability: b with the threshold raised by 0.2 and 0.4
    b2 = sl.b_varmc(m, thr + 0.2, dm)[0]
    b4 = sl.b_varmc(m, thr + 0.4, dm)[0]
    unstable = bool(np.isfinite(b2) and np.isfinite(b4) and np.isfinite(lo) and
                    ((b2 > hi and b4 > hi) or (b2 < lo and b4 < lo)))
    out.update(mc=mc, mc_lo=float(np.percentile(mcb, 2.5)), mc_hi=float(np.percentile(mcb, 97.5)),
               n_b=int(n), b_raw=float(b), b_sigma_shibolt=float(sig), b_lo_raw=float(lo), b_hi_raw=float(hi),
               b_plus02=float(b2), b_plus04=float(b4), cutoff_unstable=unstable, quality=q)
    show = q in ("A", "B")
    out.update(b=float(b) if show else np.nan, b_lo=float(lo) if show else np.nan, b_hi=float(hi) if show else np.nan)
    return out


def cell_bpos(m_time_ordered, floor, dm=0.1, dmc=0.2):
    """b-positive on events above the period floor, with a +-1.96 sigma interval."""
    m = sl.bin_mag(m_time_ordered, dm)
    keep = m >= sl.bin_mag(floor, dm) - 1e-9
    b, sig, n = sl.b_positive(m[keep], dm, dmc)
    if n < NMIN_B or not np.isfinite(b):
        return {"bpos": np.nan, "bpos_lo": np.nan, "bpos_hi": np.nan, "n_bpos": int(n)}
    return {"bpos": float(b), "bpos_lo": float(b - 1.96 * sig), "bpos_hi": float(b + 1.96 * sig), "n_bpos": int(n)}
