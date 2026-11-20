"""Shared paths, constants, loading helpers and figure style."""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data" / "processed"
AUX = PROC / "aux"
WORK = ROOT / "data" / "work"
RES = ROOT / "results"
IMG = ROOT / "docs" / "img"
SITE = ROOT / "site" / "data"
for d in (WORK, RES, IMG, SITE):
    d.mkdir(parents=True, exist_ok=True)

# Release identity: scripts/release.json is the single source of truth (updated by scripts/bump_release.py).
_RELEASE = json.loads((Path(__file__).resolve().parent / "release.json").read_text())
CUTOFF = _RELEASE["data_cutoff_utc"]    # data cut-off date (UTC) used for the ComCat download
CUTOFF_YEAR = int(CUTOFF[:4])
VERSION = _RELEASE["version"]
H3_RES = 2                      # display cells: H3 resolution 2 (mean area 86,802 km2)
SAMPLE_R_KM = 300.0             # sampling radius around each cell centre for Mc / b
DEPTH_SPLIT = 70.0              # km: shallow <= 70 < intermediate/deep
DM = 0.1
MW_TYPES = {"mww", "mwc", "mwb", "mwr", "mw", "mwp", "mi", "mwd"}

# b sample (docs/method.md, "Direct-Mw b sample"): every b-value is computed only from ISC-GEM events whose Mw
# uncertainty is at most B_MAGERR_MAX. In 1976-2021 the 0.10 class is, in effect, the direct (GCMT) Mw and the
# larger values the proxy Mw converted from Ms / mb; the ComCat mirror has no field that flags them directly. Rates, counts,
# Mc(t) and the event layers keep every event. Set the environment variable ATLAS_B_MAGERR_MAX=all to use every
# event (the v0.1 behaviour) or to a number for another limit.
_ENV_MAGERR = os.environ.get("ATLAS_B_MAGERR_MAX", "0.10").strip().lower()
B_MAGERR_MAX = None if _ENV_MAGERR in ("all", "none", "") else float(_ENV_MAGERR)

# Michael (2014, BSSA 104(4)) ISC-GEM completeness, shallow (< 60 km) and deep events
MICHAEL_SHALLOW = [(1900, 1917, 7.7), (1918, 1939, 7.0), (1940, 1954, 6.8), (1955, 1963, 6.5),
                   (1964, 1975, 6.0), (1976, 2003, 5.8), (2004, 2009, 5.7)]
MICHAEL_DEEP = [(1900, 1963, 7.1), (1964, 2009, 5.7)]

# Validation verdicts (since 0.5.0, docs/validation.md "How a comparison is judged"). Every comparison with a published
# number gets z = (ours - published) / sqrt(se_ours^2 + se_pub^2), se_ours = 95 % interval width / 3.92. With a
# published uncertainty: |z| <= 1.96 -> "match", else "differs". Without one, z is not computed: our interval
# containing the published value is only "consistent, uninformative", because a wide interval accepts almost anything.
V_MATCH, V_DIFFERS = "match", "differs"
V_UNINF = "consistent, uninformative (no published uncertainty)"
# Which data the published number was made from, relative to ours (ISC-GEM direct Mw, mostly GCMT moments since 1976)
D_GCMT = "same data (GCMT-based)"          # GCMT moment tensors: the source of most ISC-GEM direct Mw after 1976
D_ISCGEM = "same data (ISC-GEM itself)"    # a study of the ISC-GEM catalogue (an earlier release)
D_INDEP = "independent data"               # other catalogues, other magnitudes, or synthetic data with a known answer
D_NONE = "no published value"              # internal checks and reference rows: not a comparison


def z_verdict(ours, lo, hi, pub, se_pub=None):
    """Verdict and z of `ours` [lo, hi] (95 %) against a published value; se_pub None = no published uncertainty.

    Returns (verdict, z): z is None without a published uncertainty. `pub` may be a (low, high) range without an
    uncertainty: then the verdict is "consistent, uninformative" when our interval overlaps the range."""
    if ours is None or lo is None or hi is None or not np.isfinite([ours, lo, hi]).all():
        return "not testable", None
    if se_pub is None:
        a, b = (pub, pub) if np.isscalar(pub) else pub
        return (V_UNINF if lo <= b and hi >= a else V_DIFFERS), None
    z = (ours - pub) / np.hypot((hi - lo) / 3.92, se_pub)
    return (V_MATCH if abs(z) <= 1.96 else V_DIFFERS), float(z)


# validated reference palette (dataviz skill): categorical slots in fixed order, text inks, surfaces
C1, C2, C3, C4, C5, C6, C7, C8 = ("#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6",
                                  "#e34948")
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#8a8984", "#e4e3df", "#fcfcfb"
SEQ_BLUE = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf",
            "#1c5cab", "#184f95", "#104281", "#0d366b"]
DIV_NEUTRAL = "#f0efec"


def setup_mpl():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "axes.edgecolor": MUTED, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6, "axes.spines.top": False,
        "axes.spines.right": False, "font.size": 9.5, "axes.titlesize": 10.5, "axes.titleweight": "bold",
        "axes.titlecolor": INK, "legend.frameon": False, "lines.linewidth": 2.0, "savefig.dpi": 150,
        "font.family": "DejaVu Sans",
    })
    return plt


def decimal_year(t: pd.Series) -> np.ndarray:
    t = pd.DatetimeIndex(t)
    start = pd.to_datetime(t.year.astype(str) + "-01-01", utc=True)
    end = pd.to_datetime((t.year + 1).astype(str) + "-01-01", utc=True)
    return (t.year + (t - start) / (end - start)).to_numpy(float)


def _json_clean(o):
    """NaN / inf -> None everywhere (also inside numpy scalars and arrays), so the output is valid JSON."""
    if isinstance(o, (float, np.floating)):
        return float(o) if np.isfinite(o) else None
    if isinstance(o, (np.integer, np.bool_)):
        return o.item()
    if isinstance(o, np.ndarray):
        return _json_clean(o.tolist())
    if isinstance(o, dict):
        return {k: _json_clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_json_clean(v) for v in o]
    return o


def jdumps(obj, indent=None) -> str:
    """JSON text with NaN / inf written as null; allow_nan=False makes any value that slipped through an error
    instead of the invalid token NaN."""
    return json.dumps(_json_clean(obj), indent=indent, default=str, allow_nan=False,
                      separators=None if indent else (",", ":"))


def jdump(obj, path: Path, indent=None):
    path.write_text(jdumps(obj, indent))


def b_sample_mask(magerr, max_err=B_MAGERR_MAX) -> np.ndarray:
    """True for events that enter b estimates: Mw uncertainty <= max_err (all True when max_err is None).

    Events without an uncertainty are left out. If most events lack one (a catalogue file without the column), the
    filter cannot work and this raises instead of returning an almost empty sample."""
    e = np.asarray(magerr, dtype=float)
    if max_err is None:
        return np.ones(e.shape, bool)
    if e.size and np.isnan(e).mean() > 0.5:
        raise ValueError("most events have no Mw uncertainty: set ATLAS_B_MAGERR_MAX=all to use every event")
    return np.nan_to_num(e, nan=np.inf) <= max_err + 1e-6


def b_sample_label(max_err=B_MAGERR_MAX) -> str:
    return "all events" if max_err is None else f"Mw uncertainty <= {max_err:.2f} (direct Mw)"


def load_work(name: str) -> pd.DataFrame:
    return pd.read_pickle(WORK / f"{name}.pkl")
