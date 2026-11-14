"""Figures for the seismic-deficit layer: docs/img/deficit-map.png, deficit-cumulative.png, deficit-ratios.png.

Usage:  python -I scripts/deficit/figures_deficit.py   (after build_deficit.py)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import momentlib as ml  # noqa: E402
from build_deficit import (BANDS, MODELS, TIENSHAN, WD, load_catalogue, load_models)  # noqa: E402
from common import C1, C2, C3, C4, IMG, INK, INK2, MUTED, SITE, setup_mpl  # noqa: E402

plt = setup_mpl()
OUT = SITE / "deficit"


def fig_map(g, LO, LA, ev):
    from matplotlib.colors import LogNorm
    stack = np.stack([g[m]["ess"] for m in MODELS])
    with np.errstate(invalid="ignore"):
        mean = np.nanmean(np.where(np.isfinite(stack), stack, np.nan), axis=0) * 1e9
    fig, ax = plt.subplots(figsize=(10, 5.2))
    ax.set_facecolor("#f0efec")
    pm = ax.pcolormesh(LO, LA, np.ma.masked_invalid(mean), cmap="magma_r", norm=LogNorm(3, 100), shading="nearest",
                       rasterized=True)
    cb = fig.colorbar(pm, ax=ax, shrink=0.8, pad=0.01)
    cb.set_label("Savage-Simpson strain rate, nanostrain/yr\n(mean of the available models)")
    x, y = zip(*(TIENSHAN + TIENSHAN[:1]))
    ax.plot(x, y, color=C1, lw=1.8, label="Tien Shan outline")
    for lon in (76, 82):
        seg = Polygon(TIENSHAN).intersection(shapely.LineString([(lon, 30), (lon, 50)]))
        xs, ys = seg.xy
        ax.plot(xs, ys, color=C1, lw=1.0, ls="--")
    cells = json.loads((OUT / "cells.geojson").read_text())
    for f in cells["features"]:
        xy = np.array(f["geometry"]["coordinates"][0])
        ax.plot(xy[:, 0], xy[:, 1], color=INK2, lw=0.6)
        p = f["properties"]
        if p.get("r_obs") is not None:
            ax.text(p["lon"], p["lat"], f"{p['r_obs']:.2g}\np={p['p_full']:.2f}", ha="center", va="center", fontsize=7,
                    color=INK, bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.75))
    big = ev[ev["mag"] >= 6.5]
    ax.scatter(big["longitude"], big["latitude"], s=6 * 4 ** (big["mag"] - 6.5) * 3, facecolor="none", edgecolor=C3,
               lw=1.1, label="Mw ≥ 6.5 (1904–cut-off), size ∝ Mw")
    for _, r in big[big["mag"] >= 7.5].iterrows():
        ax.annotate(f"{int(r['year'])} Mw {r['mag']:.2f}", (r["longitude"], r["latitude"]), xytext=(4, 6),
                    textcoords="offset points", fontsize=7.5, color=INK)
    ax.set_xlim(66, 93)
    ax.set_ylim(37.5, 47.5)
    ax.set_aspect(1 / np.cos(np.radians(42)))
    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.set_title("Tien Shan strain rate; H3 cells labelled with observed seismic/geodetic ratio and p(full)", fontsize=10)
    ax.legend(loc="lower right", fontsize=8)
    ax.grid(False)
    fig.tight_layout()
    fig.savefig(IMG / "deficit-map.png")
    plt.close(fig)


def fig_cumulative(ev, t_end, res):
    poly = Polygon(TIENSHAN)
    e = ev[shapely.contains_xy(poly, ev["longitude"].to_numpy(), ev["latitude"].to_numpy())].sort_values("year")
    fig, ax = plt.subplots(figsize=(8, 4.4))
    t = np.r_[1904, e["year"].to_numpy(), t_end]
    c = np.r_[0, np.cumsum(ml.mw_to_m0(e["mag"].to_numpy())), np.nan]
    c[-1] = c[-2]
    ax.step(t, c / 1e21, where="post", color=C2, lw=2, label="ISC-GEM / ComCat Mw ≥ 5.8, cumulative")
    mg = res["tienshan"]["mg"]
    tt = np.array([1904, t_end])
    ax.fill_between(tt, mg["lo"] * (tt - 1904) / 1e21, mg["hi"] * (tt - 1904) / 1e21, color=C1, alpha=0.18,
                    label="geodetic accumulation, full coupling (95 % range)")
    ax.plot(tt, mg["med"] * (tt - 1904) / 1e21, color=C1, lw=1.5)
    cum = np.cumsum(ml.mw_to_m0(e["mag"].to_numpy()))
    for (_, r), cv in zip(e.iterrows(), cum):
        if r["mag"] >= 7.5:
            ax.annotate(f"{int(r['year'])} Mw {r['mag']:.2f}", (r["year"], cv / 1e21), xytext=(5, -4),
                        textcoords="offset points", fontsize=7.5, ha="left", va="top", color=INK2)
    ax.set_xlabel("Year")
    ax.set_ylabel("Seismic moment, 10²¹ N m")
    ax.set_xlim(1904, t_end)
    ax.set_ylim(0, None)
    ax.set_title("Tien Shan (69–92 °E): released vs accumulated moment since 1904")
    ax.legend(loc="upper left", fontsize=8)
    fig.tight_layout()
    fig.savefig(IMG / "deficit-cumulative.png")
    plt.close(fig)


def fig_ratios(res):
    regions = [("tienshan", "Tien Shan"), ("ts_west", "West 69–76 °E"), ("ts_central", "Central 76–82 °E"),
               ("ts_east", "East 82–92 °E")]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    y = np.arange(len(regions))[::-1] * 1.0
    for yi, (rid, _) in zip(y, regions):
        r = res[rid]
        ro, rt = r["r_obs"], r["r_tgr"]
        pt = r["r_obs_point"]["med"]
        ax.plot([ro["lo"], ro["hi"]], [yi + 0.18] * 2, color=C2, lw=2)
        ax.plot(pt, yi + 0.18, "o", color=C2, ms=6)
        ax.plot(r["r_obs_x1"]["med"], yi + 0.18, "x", color=C2, ms=7, mew=1.8)
        ax.plot([rt["lo"], rt["hi"]], [yi - 0.18] * 2, color=C1, lw=2)
        ax.plot(rt["med"], yi - 0.18, "s", color=C1, ms=5.5)
        ax.text(42, yi, f"p(full) = {r['p_full']:.2f}", va="center", fontsize=8, color=INK2)
    mg = res["validation"]["molnar_ghose2000"]["r_obs_with_mg2000_moments"]
    ax.plot([mg["lo"], mg["hi"]], [y[0] + 0.42] * 2, color=C4, lw=2)
    ax.plot(mg["med"], y[0] + 0.42, "D", color=C4, ms=5)
    ax.axvline(1, color=MUTED, lw=1)
    ax.set_xscale("log")
    ax.set_xlim(0.1, 100)
    ax.set_yticks(y, [r[1] for r in regions])
    ax.set_xlabel("Seismic / geodetic moment rate (full coupling = 1)")
    ax.set_title("Seismic/geodetic moment-rate ratio, 95 % intervals")
    from matplotlib.lines import Line2D
    h = [Line2D([], [], color=C2, marker="o", label="observed 1904–cut-off (interval incl. Mw uncertainty)"),
         Line2D([], [], color=C2, marker="x", ls="none", mew=1.8, label="observed, largest event removed"),
         Line2D([], [], color=C1, marker="s", label="tapered G-R long-term rate"),
         Line2D([], [], color=C4, marker="D", label="Tien Shan, Molnar & Ghose (2000) moments for 7 events")]
    ax.legend(handles=h, loc="lower center", bbox_to_anchor=(0.5, 1.08), ncol=2, fontsize=7.5)
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    fig.savefig(IMG / "deficit-ratios.png")
    plt.close(fig)


def main():
    res = json.loads((WD / "results.json").read_text())
    g, LO, LA, _ = load_models()
    ev, t_end = load_catalogue()
    fig_map(g, LO, LA, ev)
    fig_cumulative(ev, t_end, res)
    fig_ratios(res)
    for f in ("deficit-map.png", "deficit-cumulative.png", "deficit-ratios.png"):
        print(IMG / f, (IMG / f).stat().st_size)


if __name__ == "__main__":
    main()
