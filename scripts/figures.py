"""Static figures for the docs (docs/img/) and the data profile numbers (results/profile.json).

Colour use follows the validated reference palette (common.py): categorical slots in fixed order, a one-hue blue
ramp for magnitude, a red <-> grey <-> blue diverging ramp for b around 1.0, text always in ink colours.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import box, shape

sys.path.insert(0, str(Path(__file__).resolve().parent))
import seislib as sl  # noqa: E402
from common import (AUX, C1, CUTOFF_YEAR, C2, C3, C4, DIV_NEUTRAL, GRID, IMG, INK, INK2, MUTED, RES, SEQ_BLUE, SITE, SURFACE,  # noqa: E402
                    jdump, load_work, setup_mpl)

plt = setup_mpl()
from matplotlib.collections import LineCollection, PolyCollection  # noqa: E402
from matplotlib.colors import BoundaryNorm, LinearSegmentedColormap, ListedColormap  # noqa: E402

LON0 = 150.0
SEAM = LON0 - 180.0
TR = Transformer.from_crs("EPSG:4326", f"+proj=eqearth +lon_0={LON0} +datum=WGS84 +units=m", always_xy=True)
CLIP = box(SEAM + 1e-6, -90, SEAM + 360 - 1e-6, 90)
DIV = LinearSegmentedColormap.from_list("div_b", ["#8f2424", "#e34948", "#f2a39b", DIV_NEUTRAL, "#9ec5f4",
                                                  "#3987e5", "#0d366b"])
SEQ = LinearSegmentedColormap.from_list("seq_blue", SEQ_BLUE)


def save(fig, name):
    fig.savefig(IMG / name, bbox_inches="tight")
    plt.close(fig)
    print("wrote", name)


# ----------------------------------------------------------------------------------------------- map helpers
def pieces(geom):
    out = []
    for k in (-1, 0, 1):
        g = translate(geom, xoff=360 * k).intersection(CLIP)
        if not g.is_empty:
            out.append(g)
    return out


def proj_coords(coords):
    x, y = TR.transform(*np.asarray(coords).T)
    return np.c_[x, y]


def polys(geom):
    res = []
    for g in pieces(geom):
        for p in getattr(g, "geoms", [g]):
            if p.geom_type == "Polygon":
                res.append(proj_coords(p.exterior.coords))
    return res


def lines(geom):
    res = []
    for g in pieces(geom):
        for p in getattr(g, "geoms", [g]):
            if p.geom_type == "LineString" and len(p.coords) > 1:
                res.append(proj_coords(p.coords))
    return res


_BASE = {}


def base_layers():
    if _BASE:
        return _BASE
    land = json.loads((SITE / "land.geojson").read_text())["features"]
    coast = json.loads((SITE / "coastline.geojson").read_text())["features"]
    plates = json.loads((SITE / "plates.geojson").read_text())["features"]
    _BASE["land"] = [p for f in land for p in polys(shape(f["geometry"]))]
    _BASE["coast"] = [ln for f in coast for ln in lines(shape(f["geometry"]))]
    _BASE["plates"] = [ln for f in plates for ln in lines(shape(f["geometry"]))]
    lon = np.r_[np.full(181, SEAM + 1e-6), np.linspace(SEAM, SEAM + 360, 361), np.full(181, SEAM + 360 - 1e-6)]
    lat = np.r_[np.linspace(-90, 90, 181), np.full(361, 90), np.linspace(90, -90, 181)]
    _BASE["frame"] = np.c_[TR.transform(lon, lat)]
    return _BASE


def map_axes(title, subtitle=None):
    b = base_layers()
    fig, ax = plt.subplots(figsize=(10, 5.4))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.fill(b["frame"][:, 0], b["frame"][:, 1], color="#f4f7fa", zorder=0)
    ax.add_collection(PolyCollection(b["land"], facecolor="#ecebe6", edgecolor="none", zorder=1))
    ax.add_collection(LineCollection(b["coast"], colors=MUTED, linewidths=0.35, zorder=3))
    ax.plot(b["frame"][:, 0], b["frame"][:, 1], color=MUTED, lw=0.6, zorder=6)
    ax.set_xlim(b["frame"][:, 0].min(), b["frame"][:, 0].max())
    ax.set_ylim(b["frame"][:, 1].min(), b["frame"][:, 1].max())
    ax.set_title(title, loc="left", color=INK, fontsize=11.5, fontweight="bold")
    if subtitle:
        ax.text(0, 1.0, subtitle, transform=ax.transAxes, color=INK2, fontsize=8.5, va="bottom")
    return fig, ax


def add_plates(ax):
    ax.add_collection(LineCollection(base_layers()["plates"], colors=INK2, linewidths=0.45, alpha=0.6, zorder=4))


def cell_geoms(df):
    out = []
    for h in df.h3:
        import h3
        ring = [(lo, la) for la, lo in h3.cell_to_boundary(h)]
        lons = np.array([p[0] for p in ring])
        if lons.max() - lons.min() > 180:
            ring = [(lo + 360 if lo < 0 else lo, la) for lo, la in ring]
        from shapely.geometry import Polygon
        out.append(polys(Polygon(ring)))
    return out


def draw_cells(ax, geoms, colors, z=2, hatch=None, edge="none", lw=0.0):
    P, C = [], []
    for g, col in zip(geoms, colors):
        for p in g:
            P.append(p)
            C.append(col)
    pc = PolyCollection(P, facecolors=C, edgecolors=edge, linewidths=lw, zorder=z)
    if hatch:
        pc.set_hatch(hatch)
    ax.add_collection(pc)


def footer(ax, text):
    ax.text(0, -0.02, text, transform=ax.transAxes, color=MUTED, fontsize=7.5, va="top")


# ----------------------------------------------------------------------------------------------- maps
def maps(cells):
    geoms = dict(zip(cells.h3, cell_geoms(cells)))
    for d, lab in (("sh", "shallow, depth ≤ 70 km"), ("dp", "intermediate and deep, depth > 70 km")):
        seis = cells[cells[f"{d}_n_sample"] >= 30]
        shown = cells[cells[f"{d}_b"].notna()]
        masked = cells[cells[f"{d}_b_q"] == "C"]
        fig, ax = map_axes(f"Gutenberg-Richter b-value, {lab}",
                           f"ISC-GEM Mw 1976–2021, 300 km circles on H3 res-2 cells. Coloured: 95 % CI width ≤ 0.5 "
                           f"({len(shown)} cells). Hatched: CI too wide, b withheld ({len(masked)}). "
                           f"Grey: < 50 events above Mc.")
        draw_cells(ax, [geoms[h] for h in seis.h3], ["#dddcd6"] * len(seis))
        norm = plt.Normalize(0.6, 1.4)
        draw_cells(ax, [geoms[h] for h in shown.h3], [DIV(norm(v)) for v in shown[f"{d}_b"]], z=2.5)
        draw_cells(ax, [geoms[h] for h in masked.h3], ["#f4f3ef"] * len(masked), z=2.4, hatch="//////",
                   edge=MUTED, lw=0.0)
        add_plates(ax)
        sm = plt.cm.ScalarMappable(norm=norm, cmap=DIV)
        cb = fig.colorbar(sm, ax=ax, orientation="horizontal", fraction=0.04, pad=0.04, aspect=45,
                          ticks=[0.6, 0.8, 1.0, 1.2, 1.4])
        cb.set_label("b  (lower: relatively more large events · higher: relatively more small events)", color=INK2)
        cb.outline.set_visible(False)
        footer(ax, "Not a forecast and not a hazard map. Plate boundaries: Bird (2003). Equal Earth projection, "
                   "centred 150°E.")
        save(fig, f"map_b_{d}.png")

    d = "sh"
    seis = cells[cells[f"{d}_n_sample"] >= 30]
    qcol = {"A": SEQ_BLUE[11], "B": SEQ_BLUE[6], "C": SEQ_BLUE[2], "insufficient": "#dddcd6"}
    fig, ax = map_axes("Can the b-value be trusted here? Shallow cells",
                       "Quality from the bootstrap 95 % interval of b: A width ≤ 0.30, B ≤ 0.50, C wider (b withheld), "
                       "grey: fewer than 50 events above Mc.")
    draw_cells(ax, [geoms[h] for h in seis.h3], [qcol[q] for q in seis[f"{d}_b_q"]])
    add_plates(ax)
    from matplotlib.patches import Patch
    cnt = seis[f"{d}_b_q"].value_counts()
    ax.legend(handles=[Patch(color=qcol[k], label=f"{k} ({cnt.get(k, 0)} cells)") for k in ("A", "B", "C", "insufficient")],
              loc="lower left", fontsize=8, ncol=4, bbox_to_anchor=(0.0, -0.09), labelcolor=INK2)
    save(fig, "map_quality_sh.png")

    v = cells[cells.sh_mc_cc_2010.notna()]
    bounds = np.round(np.arange(4.45, 5.36, 0.1), 2)
    cmap = ListedColormap([SEQ(x) for x in np.linspace(0.05, 1, len(bounds) - 1)])
    norm = BoundaryNorm(bounds, cmap.N)
    fig, ax = map_axes(f"Magnitude of completeness of the USGS M4.5+ catalogue, 2010–{CUTOFF_YEAR}",
                       f"ComCat preferred magnitude as served, MAXC + 0.2, shallow events within 300 km "
                       f"({len(v)} cells with ≥ 50 events).")
    draw_cells(ax, [geoms[h] for h in v.h3], [cmap(norm(x)) for x in v.sh_mc_cc_2010])
    add_plates(ax)
    cb = fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax, orientation="horizontal", fraction=0.04,
                      pad=0.04, aspect=45, ticks=np.round(bounds[:-1] + 0.05, 1))
    cb.set_label("Mc (mostly mb at these magnitudes)", color=INK2)
    cb.outline.set_visible(False)
    save(fig, "map_mc_comcat.png")

    v = cells[cells.cons_n_matched >= 10]
    bounds = [0, 5, 10, 15, 20, 30, 50, 100]
    cmap = ListedColormap([SEQ(x) for x in np.linspace(0.05, 1, len(bounds) - 1)])
    norm = BoundaryNorm(bounds, cmap.N)
    fig, ax = map_axes("Where do the two catalogues disagree on location?",
                       f"Median epicentre difference ComCat vs ISC-GEM for matched events 1973–2021 "
                       f"({len(v)} cells with ≥ 10 matched events).")
    draw_cells(ax, [geoms[h] for h in v.h3], [cmap(norm(x)) for x in v.cons_dloc_km])
    add_plates(ax)
    cb = fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax, orientation="horizontal", fraction=0.04,
                      pad=0.04, aspect=45)
    cb.set_label("median epicentre difference, km", color=INK2)
    cb.outline.set_visible(False)
    save(fig, "map_consistency_dloc.png")


# ----------------------------------------------------------------------------------------------- data profile
def profile(g, c, mt):
    prof = {}
    c = c.copy()
    fam = np.select([c.proxy_rule == "mb", c.proxy_rule == "mw", c.proxy_rule == "ms"], ["mb", "Mw-type", "Ms"], "other")
    c["fam"] = fam
    tab = pd.crosstab(c.year, c.fam)
    prof["comcat_magtype_counts"] = c.magtype.value_counts().to_dict()
    prof["comcat_family_by_decade"] = pd.crosstab((c.year // 10) * 10, c.fam).to_dict(orient="index")
    prof["iscgem_by_decade"] = g.groupby((g.year // 10) * 10).size().to_dict()
    prof["comcat_by_decade"] = c.groupby((c.year // 10) * 10).size().to_dict()
    for name, d in (("iscgem", g), ("comcat", c)):
        prof[f"{name}_depth"] = {"le70": int((d.depth <= 70).sum()), "70_300": int(((d.depth > 70) & (d.depth <= 300)).sum()),
                                 "gt300": int((d.depth > 300).sum()), "fixed_10km": int((d.depth == 10).sum()),
                                 "fixed_33km": int((d.depth == 33).sum()), "fixed_35km": int((d.depth == 35).sum()),
                                 "fixed_15km": int((d.depth == 15).sum()), "median": float(d.depth.median())}
        prof[f"{name}_n_cells"] = int(d.h3.nunique())
    prof["iscgem_mag_range"] = [float(g.mag.min()), float(g.mag.max())]

    fig, ax = plt.subplots(figsize=(9, 3.8))
    order = ["mb", "Mw-type", "Ms", "other"]
    cols = [C1, C2, C3, C4]
    bottom = np.zeros(len(tab))
    yrs = tab.index.to_numpy()
    for k, col in zip(order, cols):
        vals = tab.get(k, pd.Series(0, index=tab.index)).to_numpy()
        ax.bar(yrs, vals, bottom=bottom, color=col, width=0.8, edgecolor=SURFACE, linewidth=0.6, label=k)
        bottom += vals
    ax.set_title("USGS ComCat M ≥ 4.5: which magnitude type is the preferred one?", loc="left")
    ax.set_ylabel("events per year")
    ax.legend(ncol=4, loc="upper left", fontsize=8.5, labelcolor=INK2)
    ax.text(0.99, 0.97, "mb dominates every year: 80 % of all events", transform=ax.transAxes, ha="right", va="top",
            color=INK2, fontsize=8.5)
    ax.grid(axis="x", visible=False)
    save(fig, "data_magtypes.png")

    fig, ax = plt.subplots(figsize=(9, 3.6))
    gy = g.groupby("year").size()
    cy = c.groupby("year").size()
    ax.plot(gy.index, gy.values, color=C1, lw=1.6)
    ax.plot(cy.index, cy.values, color=C2, lw=1.6)
    ax.set_yscale("log")
    ax.text(gy.index[-1] + 0.5, gy.values[-1], "ISC-GEM (all, Mw ≥ ~5)", color=INK2, fontsize=8.5, va="center")
    ax.text(cy.index[-1] + 0.5, cy.values[-1], "ComCat M ≥ 4.5", color=INK2, fontsize=8.5, va="center")
    ax.plot([], [], color=C1, label="ISC-GEM")
    ax.plot([], [], color=C2, label="ComCat M ≥ 4.5")
    ax.legend(loc="upper left", fontsize=8.5, labelcolor=INK2)
    ax.set_xlim(1900, 2040)
    ax.set_title("Events per year in the two catalogues", loc="left")
    ax.set_ylabel("events per year (log scale)")
    save(fig, "data_counts.png")

    # magnitude difference ComCat - ISC-GEM by ISC-GEM Mw
    fig, ax = plt.subplots(figsize=(9, 3.8))
    for lab, sel, col in (("ComCat mb − ISC-GEM Mw", mt.type_c == "mb", C1),
                          ("ComCat Mw-type − ISC-GEM Mw", mt.type_c.isin(["mww", "mwc", "mwb", "mwr", "mw"]), C2)):
        s = mt[sel].copy()
        s["bin"] = sl.bin_mag(s.mw_g, 0.2)
        q = (s.mag_c - s.mw_g).groupby(s.bin).quantile([0.25, 0.5, 0.75]).unstack()
        n = s.groupby("bin").size()
        q = q[n >= 30]
        ax.fill_between(q.index, q[0.25], q[0.75], color=col, alpha=0.18, linewidth=0)
        ax.plot(q.index, q[0.5], color=col, lw=2, marker="o", ms=4, label=lab + " (median, IQR)")
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.set_xlabel("ISC-GEM Mw")
    ax.set_ylabel("magnitude difference")
    ax.set_title("Matched events 1973–2021: mb saturates, Mw agrees", loc="left")
    ax.legend(loc="lower left", fontsize=8.5, labelcolor=INK2)
    save(fig, "data_dmag.png")
    prof["dmag_mb_by_mw"] = {f"{k:.1f}": round(float(v), 3) for k, v in
                             (mt[mt.type_c == "mb"].mag_c - mt[mt.type_c == "mb"].mw_g)
                             .groupby(sl.bin_mag(mt[mt.type_c == "mb"].mw_g, 0.2)).median().items()}

    fig, ax = plt.subplots(figsize=(9, 3.6))
    bins = np.arange(0, 710, 10)
    for lab, d, col in (("ISC-GEM", g, C1), ("ComCat M ≥ 4.5", c, C2)):
        h, _ = np.histogram(d.depth.clip(0, 700), bins)
        ax.step(bins[:-1], h / h.sum(), where="post", color=col, lw=1.6, label=lab)
    ax.set_yscale("log")
    ax.axvline(70, color=MUTED, lw=0.8, ls="--")
    ax.text(72, 0.3, "70 km: shallow / deeper split", color=INK2, fontsize=8)
    ax.set_xlabel("depth, km (10 km bins)")
    ax.set_ylabel("fraction of events (log)")
    ax.set_title("Depth distribution", loc="left")
    ax.legend(loc="upper right", fontsize=8.5, labelcolor=INK2)
    save(fig, "data_depth.png")
    return prof


# ----------------------------------------------------------------------------------------------- validation
def validation_figs(v, g, c):
    rows = v["michael_periods"]
    fig, ax = plt.subplots(figsize=(9, 4))
    x = np.arange(len(rows))
    labels = [f"{r['period']}\n{'deep' if r['depth'].startswith('>') else 'shallow'}" for r in rows]
    for off, key, col, lab in ((-0.15, "maxc02", C1, "ours, MAXC + 0.2"), (0.15, "mbs", C2, "ours, MBS")):
        med = np.array([r[key][0] for r in rows])
        lo = np.array([r[key][1] for r in rows])
        hi = np.array([r[key][2] for r in rows])
        ax.errorbar(x + off, med, yerr=[med - lo, hi - med], fmt="o", color=col, ms=5, capsize=0, lw=1.4, label=lab)
    ax.scatter(x, [r["michael_mc"] for r in rows], marker="_", s=420, color=INK, lw=2, zorder=5,
               label="Michael (2014), ISC-GEM v1")
    ax.set_xticks(x, labels, fontsize=7.5)
    ax.set_ylabel("Mc (Mw)")
    ax.set_title("Completeness of ISC-GEM by period: today's catalogue vs Michael (2014)", loc="left")
    ax.legend(loc="upper right", fontsize=8, labelcolor=INK2)
    ax.grid(axis="x", visible=False)
    save(fig, "val_mc_michael.png")

    rows = v["comcat_proxy_vs_iscgem_b_2004_2021"]
    fig, ax = plt.subplots(figsize=(9, 3.8))
    for off, key, col, lab in ((-0.02, "iscgem", C1, "ISC-GEM Mw"), (0.0, "comcat_native", C2, "ComCat, as served"),
                               (0.02, "comcat_proxy", C3, "ComCat, mb/Ms converted to Mw proxy")):
        xs = np.array([r["cutoff"] for r in rows]) + off
        b = np.array([r[key][0] for r in rows])
        s = np.array([r[key][1] for r in rows])
        ax.errorbar(xs, b, yerr=1.96 * s, fmt="o-", color=col, ms=5, lw=1.4, capsize=0, label=lab)
    ax.set_xlabel("magnitude cutoff")
    ax.set_ylabel("b (± 1.96 σ)")
    ax.set_title("Global shallow b against the cutoff, 2004–2021, same years in both catalogues", loc="left")
    ax.legend(loc="upper right", fontsize=8.5, labelcolor=INK2)
    save(fig, "val_b_cutoff.png")

    pb = v["plate_boundary_types"]
    names = {"OSR": "oceanic spreading ridge", "OTF": "oceanic transform", "CTF": "continental transform",
             "SUB": "subduction", "CRB": "continental rift", "none": "> 200 km from a boundary",
             "OCB": "oceanic convergent", "CCB": "continental convergent"}
    order = sorted(pb, key=lambda k: pb[k]["b"])
    fig, ax = plt.subplots(figsize=(9, 4))
    y = np.arange(len(order))
    ax.axvspan(0.945, 1.005, color=GRID, alpha=0.8, lw=0)
    ax.text(0.975, len(order) - 1, "β 0.63–0.67\n(Kagan; b = 1.5 β)", ha="center", va="center", color=INK2,
            fontsize=7.5)
    ax.axvspan(1.2, 1.65, color=GRID, alpha=0.5, lw=0)
    ax.text(1.425, 0.15, "ridges β 0.8–1.1 (Kagan 2002)", ha="center", va="bottom", color=INK2, fontsize=7.5)
    for i, k in enumerate(order):
        r = pb[k]
        ax.plot(r["ci95"], [i, i], color=C1, lw=2)
        ax.plot(r["b"], i, "o", color=C1, ms=6)
        ax.text(r["ci95"][1] + 0.01, i, f"{r['b']:.2f}  (n = {r['n_b']})", va="center", color=INK2, fontsize=8)
    ax.set_yticks(y, [f"{k}  {names[k]}" for k in order], fontsize=8)
    ax.set_xlabel("b with bootstrap 95 % interval (ISC-GEM 1976–2021, shallow)")
    ax.set_title("b by plate-boundary class (Bird 2003 PB2002 steps, nearest step ≤ 200 km)", loc="left")
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0.85, 1.75)
    save(fig, "val_plate_b.png")

    syn = pd.DataFrame(v["synthetic"])
    fig, axs = plt.subplots(1, 2, figsize=(9, 3.4))
    for case, col, lab in (("one_period", C1, "one period"), ("two_period", C2, "two periods (Mc changes)")):
        s = syn[syn.case == case]
        axs[0].plot(s.n_above_mc, s.ci95_coverage, "o-", color=col, ms=5, label=lab)
        axs[1].plot(s.n_above_mc, s.rmse, "o-", color=col, ms=5, label=lab)
    axs[0].axhline(0.95, color=MUTED, lw=0.8, ls="--")
    axs[0].set_ylim(0.8, 1.02)
    axs[0].set_title("95 % CI coverage of true b", loc="left")
    axs[1].set_title("RMSE of b", loc="left")
    for a in axs:
        a.set_xscale("log")
        a.set_xlabel("events above Mc per synthetic cell")
    axs[0].legend(loc="lower right", fontsize=8, labelcolor=INK2)
    save(fig, "val_synthetic.png")

    # global Mc over time, both catalogues
    fig, ax = plt.subplots(figsize=(9, 3.6))
    for lab, d, mag, col, step in (("ISC-GEM Mw, shallow", g[~g.deep], "mag", C1, 5),
                                   ("ComCat as served, shallow", c[~c.deep], "mag", C2, 5)):
        y0s = np.arange(d.year.min() // step * step, CUTOFF_YEAR, step)
        mc = [sl.mc_maxc(d[(d.year >= a) & (d.year < a + step)][mag], correction=0.2)
              if ((d.year >= a) & (d.year < a + step)).sum() >= 100 else np.nan for a in y0s]
        ax.step(np.r_[y0s, y0s[-1] + step], np.r_[mc, mc[-1]], where="post", color=col, lw=1.8, label=lab)
    for a, b, mm in [(1900, 1917, 7.7), (1918, 1939, 7.0), (1940, 1954, 6.8), (1955, 1963, 6.5), (1964, 1975, 6.0),
                     (1976, 2003, 5.8), (2004, 2009, 5.7)]:
        ax.plot([a, b + 1], [mm, mm], color=INK, lw=1.2, ls=":")
    ax.plot([], [], color=INK, lw=1.2, ls=":", label="Michael (2014), ISC-GEM v1")
    ax.set_ylabel("Mc (MAXC + 0.2), 5-year windows")
    ax.set_title("Global completeness over time", loc="left")
    ax.legend(loc="upper right", fontsize=8.5, labelcolor=INK2)
    save(fig, "val_mc_time.png")


def sequences_fig(seq):
    s = pd.DataFrame(seq["sequences"])
    s = s[s.quality.isin(["A", "B", "C"])].sort_values("mag")
    fig, ax = plt.subplots(figsize=(9, 6.2))
    y = np.arange(len(s))
    for i, r in enumerate(s.itertuples()):
        filled = r.quality in ("A", "B")
        ax.plot([r.p - 1.96 * r.sp, r.p + 1.96 * r.sp], [i, i], color=C1 if filled else MUTED, lw=1.6)
        ax.plot(r.p, i, "o", color=C1 if filled else SURFACE, mec=C1 if filled else MUTED, ms=5.5, mew=1.4)
    ax.set_yticks(y, [f"{r.time[:4]} M{r.mag:.1f} {str(r.place)[:34]}  [{r.quality}]" for r in s.itertuples()],
                  fontsize=7)
    ax.axvline(1.0, color=MUTED, lw=0.8, ls="--")
    ax.set_xlabel("Omori-Utsu p (± 1.96 σ); open markers: quality C")
    ax.set_title("Aftershock decay of the largest sequences since 1990 (ComCat, first 365 days)", loc="left")
    ax.grid(axis="y", visible=False)
    save(fig, "seq_omori_p.png")


def prior_work_fig():
    tools = ["USGS Latest Earthquakes", "EMSC / LastQuake", "IRIS Earthquake Browser", "ISC / ISC-GEM search",
             "GEM Global Hazard Map", "ZMAP / SeismoStats (software)", "This atlas"]
    feats = ["event map", "Mc map", "Mc over time", "b-value map", "b uncertainty", "quality mask",
             "catalogue comparison", "Omori fits", "open data download"]
    # 2 = yes, 1 = partial, 0 = no; see docs/prior-work.md for the reasoning behind each entry
    M = np.array([[2, 0, 0, 0, 0, 0, 0, 1, 2],
                  [2, 0, 0, 0, 0, 0, 0, 0, 1],
                  [2, 0, 0, 0, 0, 0, 0, 0, 2],
                  [2, 0, 0, 0, 0, 0, 0, 0, 2],
                  [0, 0, 0, 0, 0, 0, 0, 0, 1],
                  [1, 2, 2, 2, 2, 1, 0, 2, 0],
                  [2, 2, 2, 2, 2, 2, 2, 2, 2]])
    fig, ax = plt.subplots(figsize=(9, 3.9))
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            v = M[i, j]
            if v == 2:
                ax.plot(j, i, "o", color=C1, ms=10)
            elif v == 1:
                ax.plot(j, i, "o", color=SURFACE, mec=C1, mew=1.6, ms=10)
            else:
                ax.plot(j, i, "o", color=SURFACE, mec=GRID, mew=1.0, ms=6)
    ax.set_xticks(range(len(feats)), feats, rotation=30, ha="right", fontsize=8)
    ax.set_yticks(range(len(tools)), tools, fontsize=8)
    ax.invert_yaxis()
    ax.grid(False)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_title("What existing global tools show (filled: yes, ring: partial or tool-only, dot: no)", loc="left")
    save(fig, "prior_work_matrix.png")


def main():
    g, c, mt = load_work("iscgem"), load_work("comcat"), load_work("matches")
    cells = load_work("cells")
    v = json.loads((RES / "validation.json").read_text())
    seq = json.loads((SITE / "sequences.json").read_text())
    prof = profile(g, c, mt)
    jdump(prof, RES / "profile.json", indent=1)
    validation_figs(v, g, c)
    sequences_fig(seq)
    prior_work_fig()
    maps(cells)


if __name__ == "__main__":
    main()
