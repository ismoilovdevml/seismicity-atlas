"""Per-cell estimators for the regional layers: b with a time-varying, cell-specific completeness.

The global estimator (scripts/atlaslib.cell_b) uses one cell Mc plus a global floor per period. Regional networks
change faster and differ more from place to place, so here the completeness is estimated per cell AND per period:

  Mc_p      = MAXC + 0.2 of the cell's events in period p, when the period holds >= NMIN_P events;
              otherwise max(MAXC + 0.2 of all the cell's events, regional floor of period p).
  thr_i     = Mc of the period of event i.
  b         = binned maximum likelihood (Tinti & Mulargia 1987) with per-event thresholds (seislib.b_varmc).
  interval  = 95 % percentile bootstrap, resampling events within each period (stratified), with every Mc_p
              re-estimated in every replicate, so the interval includes the Mc uncertainty.
  quality   = the same A / B / C / insufficient gate as the global layer (atlaslib.quality).

Only shared helpers are imported; nothing in scripts/ is modified.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import atlaslib as al  # noqa: E402
import seislib as sl  # noqa: E402

NMIN_P = 50      # events in a period needed for its own Mc
NMIN_MC = 30     # events in the circle needed to try anything


def period_index(year, periods):
    """Index of the inclusive [y0, y1] period that holds each decimal year; -1 outside all periods."""
    year = np.asarray(year, float)
    out = np.full(year.shape, -1, int)
    for k, (a, b) in enumerate(periods):
        out[(year >= a) & (year < b + 1)] = k
    return out


def _blocks(per, nper):
    """Contiguous column blocks [a, b) per period for period-sorted data."""
    edges = np.searchsorted(per, np.arange(nper + 1), "left")
    return [(int(edges[k]), int(edges[k + 1])) for k in range(nper)]


def thresholds_rows(mm, blocks, fallback, dm=0.1, nmin_p=NMIN_P):
    """Per-event thresholds for every row of a (B, N) array whose columns are sorted by period.

    Returns (thr (B, N), mc per period (B, P), mc of all events (B,))."""
    B = mm.shape[0]
    mc_all = al.maxc_rows(mm, dm)
    thr = np.empty_like(mm, dtype=float)
    mcp = np.full((B, len(blocks)), np.nan)
    for p, (a, b) in enumerate(blocks):
        if b - a >= nmin_p:
            mc = al.maxc_rows(mm[:, a:b], dm)
        else:
            mc = np.fmax(mc_all, fallback[p])
        mcp[:, p] = mc
        thr[:, a:b] = mc[:, None]
    return np.round(thr, 6), np.round(mcp, 6), np.round(mc_all, 6)


def _sub_blocks(blocks, window):
    """Split each period block into consecutive windows of `window` events (a short remainder joins the previous
    window), so that intense sequences get their own, higher, Mc. window=None keeps the period blocks."""
    if not window:
        return blocks, list(range(len(blocks)))
    out, owner = [], []
    for p, (a, b) in enumerate(blocks):
        if b - a < 2 * window:
            out.append((a, b)); owner.append(p)
            continue
        edges = list(range(a, b, window))
        if b - edges[-1] < window:
            edges = edges[:-1]
        for k, e in enumerate(edges):
            out.append((e, edges[k + 1] if k + 1 < len(edges) else b)); owner.append(p)
    return out, owner


def cell_b_tv(m, per, fallback, nboot=al.NBOOT, rng=None, dm=0.1, nmin_p=NMIN_P, window=None):
    """b with a per-cell, per-period Mc. `m` and `per` must be in time order with periods chronological.

    `fallback[p]` is the regional floor of period p (used only when the period has fewer than nmin_p events).
    Returns a dict with the same keys as atlaslib.cell_b plus mc_periods / n_periods / mc_all; b fields are NaN
    unless the quality is A or B."""
    rng = np.random.default_rng(rng)
    m = sl.bin_mag(m, dm)
    per = np.asarray(per, int)
    nper = len(fallback)
    keep = per >= 0
    m, per = m[keep], per[keep]
    order = np.argsort(per, kind="stable")      # stable: keeps time order inside each period
    m, per = m[order], per[order]
    N = m.size
    out = {"n_sample": int(N)}
    if N < NMIN_MC:
        out.update(quality="insufficient", n_b=0)
        return out
    blocks = _blocks(per, nper)
    fb = np.asarray(fallback, float)
    sub, owner = _sub_blocks(blocks, window)
    fbs = fb[owner] if len(owner) else fb
    _, mcp, mca = thresholds_rows(m[None, :], blocks, fb, dm, nmin_p)     # calendar-period Mc (reported)
    thr, _, _ = thresholds_rows(m[None, :], sub, fbs, dm, nmin_p)          # thresholds actually used
    thr, mcp = thr[0], mcp[0]
    b, sig, n = sl.b_varmc(m, thr, dm)
    idx = np.concatenate([a + rng.integers(0, b_ - a, (nboot, b_ - a)) for a, b_ in sub if b_ > a], axis=1)
    mm = m[idx]
    _, mcpb, _ = thresholds_rows(mm, blocks, fb, dm, nmin_p)
    tb, _, _ = thresholds_rows(mm, sub, fbs, dm, nmin_p)
    bb, nb = al.b_rows(mm, tb, dm)
    ok = np.isfinite(bb) & (nb >= 2)
    lo, hi = (np.percentile(bb[ok], [2.5, 97.5]) if ok.sum() > 0.8 * nboot else (np.nan, np.nan))
    q = al.quality(n, lo, hi, b)
    b2 = sl.b_varmc(m, thr + 0.2, dm)[0]
    b4 = sl.b_varmc(m, thr + 0.4, dm)[0]
    unstable = bool(np.isfinite(b2) and np.isfinite(b4) and np.isfinite(lo) and
                    ((b2 > hi and b4 > hi) or (b2 < lo and b4 < lo)))
    last = nper - 1   # the reported cell Mc is the completeness of the latest period
    out.update(mc=float(mcp[last]), mc_lo=float(np.percentile(mcpb[:, last], 2.5)),
               mc_hi=float(np.percentile(mcpb[:, last], 97.5)), mc_all=float(mca[0]),
               mc_periods=[float(x) for x in mcp], n_periods=[b_ - a for a, b_ in blocks],
               n_b=int(n), b_raw=float(b), b_sigma_shibolt=float(sig), b_lo_raw=float(lo), b_hi_raw=float(hi),
               b_plus02=float(b2), b_plus04=float(b4), cutoff_unstable=unstable, quality=q)
    show = q in ("A", "B")
    out.update(b=float(b) if show else np.nan, b_lo=float(lo) if show else np.nan, b_hi=float(hi) if show else np.nan)
    out["thr_sorted_order"] = order  # internal: lets the caller map thresholds back to time order
    out["_thr"] = thr
    return out


def thresholds_time_order(res):
    """Per-event thresholds of a cell_b_tv result, in the caller's (time) order, for events inside the periods."""
    thr = np.empty_like(res["_thr"])
    thr[res["thr_sorted_order"]] = res["_thr"]
    return thr


def bpos_above_thr(m_time_ordered, thr, dm=0.1, dmc=0.2):
    """b-positive on the events above their own threshold, in time order, with a +-1.96 sigma interval."""
    m = sl.bin_mag(m_time_ordered, dm)
    keep = m >= sl.bin_mag(thr, dm) - 1e-9
    b, sig, n = sl.b_positive(m[keep], dm, dmc)
    if n < al.NMIN_B or not np.isfinite(b):
        return {"bpos": np.nan, "bpos_lo": np.nan, "bpos_hi": np.nan, "n_bpos": int(n)}
    return {"bpos": float(b), "bpos_lo": float(b - 1.96 * sig), "bpos_hi": float(b + 1.96 * sig), "n_bpos": int(n)}


def regional_floor(m, dm=0.1):
    """Regional completeness of one period: max(MAXC + 0.2, MBS) of all events, as for the global floors."""
    m = sl.bin_mag(m, dm)
    if m.size < 50:
        return np.nan, np.nan, np.nan
    mx = sl.mc_maxc(m, dm, correction=0.2)
    mbs = sl.mc_mbs(m, dm)
    return float(max(mx, mbs) if np.isfinite(mbs) else mx), float(mx), float(mbs)


def b_region(m, thr, nboot=al.NBOOT, rng=None, dm=0.1):
    """Region-wide b with fixed per-event thresholds and a bootstrap 95 % interval (thresholds not re-estimated)."""
    rng = np.random.default_rng(rng)
    m = sl.bin_mag(m, dm)
    thr = sl.bin_mag(thr, dm)
    keep = m >= thr - 1e-9
    m, thr = m[keep], thr[keep]
    b, sig, n = sl.b_varmc(m, thr, dm)
    if n < al.NMIN_B:
        return {"b": np.nan, "lo": np.nan, "hi": np.nan, "n": int(n)}
    x = m - thr
    bs = sl.b_from_excess(np.array([x[rng.integers(0, n, n)].mean() for _ in range(nboot)]), dm)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    return {"b": float(b), "lo": float(lo), "hi": float(hi), "n": int(n), "sigma_shibolt": float(sig)}
