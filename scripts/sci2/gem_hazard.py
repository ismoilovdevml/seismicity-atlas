"""Where does high modelled hazard (GEM Global Seismic Hazard Map v2026.1) coincide with thin catalogue data in the
global layer? Aggregate statistics only.

Licence: the GEM map is CC BY-NC-SA 4.0 (Zenodo record 20735384, README and LICENSE file in the archive). The atlas
publishes its data under CC BY-SA 4.0 and does not redistribute GEM data or anything derived cell by cell. This
script therefore
- reads a local copy of the GeoPackage that the user downloads (not cached in data/raw, not committed);
- computes per-cell PGA statistics in memory only;
- writes aggregate counts and medians (no coordinates, no per-cell values) to results/sci2_gem_hazard.json.
No figure and no site layer are produced.

Download (about 0.9 GB zip, 1.8 GB GeoPackage):
  https://zenodo.org/records/20735384  ->  gshm_v2026_1_vector.zip  ->  gshm_v2026_1_vector/gem_gshm_v2026.1.gpkg

Usage: python -I scripts/sci2/gem_hazard.py /path/to/gem_gshm_v2026.1.gpkg
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

import h3
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "results" / "sci2_gem_hazard.json"
RES = 2
# PGA classes (g, 10 % in 50 years, rock) at breaks of the GEM colour table (gshm-v2026_1.cpt)
BREAKS = [0.0, 0.08, 0.2, 0.35, 10.0]
LABELS = ["< 0.08 g", "0.08-0.2 g", "0.2-0.35 g", ">= 0.35 g"]
HIGH = 0.2


def load_gem(path):
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    n = con.execute("select count(*) from v2026").fetchone()[0]
    a = np.empty((n, 3))
    cur = con.execute("select lon, lat, pga from v2026")
    k = 0
    while True:
        rows = cur.fetchmany(500_000)
        if not rows:
            break
        a[k:k + len(rows)] = rows
        k += len(rows)
    con.close()
    return a[:k, 0], a[:k, 1], a[:k, 2]


def per_cell(lon, lat, pga):
    cells = np.empty(lon.size, dtype=object)
    for i in range(lon.size):
        cells[i] = h3.latlng_to_cell(lat[i], lon[i], RES)
    df = pd.DataFrame({"h3": cells, "pga": pga})
    return df.groupby("h3").pga.agg(pga_mean="mean", pga_p90=lambda x: float(np.percentile(x, 90)), n_pts="size")


def summarise(sub):
    q = sub.sh_b_q.fillna("none")
    return {"cells": int(len(sub)),
            "no_catalogue_cell": int((q == "none").sum()),
            "insufficient": int((q == "insufficient").sum()), "C": int((q == "C").sum()),
            "A_or_B": int(q.isin(["A", "B"]).sum()),
            "thin_share": round(float(q.isin(["none", "insufficient", "C"]).mean()), 3) if len(sub) else None,
            "mc_measured_cells": int(sub.sh_mc.notna().sum()),
            "mc_median": round(float(sub.sh_mc.median()), 2) if sub.sh_mc.notna().any() else None,
            "mc_ge_5_6": int((sub.sh_mc >= 5.6 - 1e-9).sum()),
            "iscgem_events_median": float(sub.n_iscgem.fillna(0).median())}


def check_matches_published(ours):
    """Stop unless the working cells file has the quality codes of the published layer (site/data/cells.geojson).

    The first run of this analysis (2026-11-14) read a cells.pkl overwritten by a sensitivity run and reported
    numbers that did not belong to the published map (docs/comparisons.md, correction of 2026-11-16)."""
    pub = json.loads((ROOT / "site" / "data" / "cells.geojson").read_text())
    q = {f["properties"]["id"]: f["properties"]["sh_q"] for f in pub["features"]}
    mism = [h for h, v in q.items() if h not in ours.index or ours.at[h, "sh_b_q"] != v]
    if mism or len(q) != len(ours):
        sys.exit(f"data/work/cells.pkl differs from site/data/cells.geojson ({len(mism)} cells, {len(ours)} vs "
                 f"{len(q)} rows): run scripts/run_all.sh first")


def main():
    gpkg = Path(sys.argv[1])
    lon, lat, pga = load_gem(gpkg)
    print(f"{lon.size} GEM points, PGA {np.nanmin(pga):.4f}-{np.nanmax(pga):.3f} g", flush=True)
    g = per_cell(lon, lat, pga)
    ours = pd.read_pickle(ROOT / "data" / "work" / "cells.pkl").set_index("h3")
    check_matches_published(ours)
    allc = g.join(ours[["sh_b_q", "sh_mc", "n_iscgem", "pb_class"]], how="left")
    allc["cls"] = pd.cut(allc.pga_mean, BREAKS, labels=LABELS, right=False)
    out = {"source": "GEM Global Seismic Hazard Map v2026.1, Johnson et al. (2026), doi:10.5281/zenodo.20735384 "
                     "(README cites the concept DOI 10.5281/zenodo.8409646)",
           "licence": "CC BY-NC-SA 4.0 (Zenodo metadata, README.txt and LICENSE-CC_BY-NC-SA.txt in the archive)",
           "use": "internal, non-commercial comparison; aggregate statistics only; GEM data not redistributed",
           "gem_points": int(lon.size), "h3_resolution": RES, "cells_with_gem_points": int(len(g)),
           "atlas_cells": int(len(ours)), "atlas_cells_matched": int(allc.sh_b_q.notna().sum()),
           "hazard_measure": "mean PGA of the GEM points inside the cell (g, 10 % in 50 years, Vs30 800 m/s)",
           "thin": "no atlas cell, or shallow b quality insufficient or C",
           "by_hazard_class": {}}
    for lab in LABELS:
        out["by_hazard_class"][lab] = summarise(allc[allc.cls == lab])
    hi = allc[allc.pga_mean >= HIGH]
    thin = hi.sh_b_q.isna() | hi.sh_b_q.isin(["insufficient", "C"])
    out["high_hazard"] = {
        "threshold_g": HIGH, **summarise(hi),
        "thin_and_mc_ge_5_6": int((thin & (hi.sh_mc >= 5.6 - 1e-9)).sum()),
        "thin_by_plate_boundary_class": {str(k): int(v) for k, v in hi[thin].pb_class.fillna("no atlas cell")
                                         .value_counts().items()},
        "thin_iscgem_events_median": float(hi[thin].n_iscgem.fillna(0).median()),
        "ab_iscgem_events_median": float(hi[~thin].n_iscgem.fillna(0).median()),
        "p90_based_cells_ge_0_2": int((allc.pga_p90 >= HIGH).sum())}
    # rank association: does the measured Mc rise with hazard? (cells with a measured Mc)
    m = allc.dropna(subset=["sh_mc"])
    from scipy import stats
    out["spearman_pga_vs_mc"] = round(float(stats.spearmanr(m.pga_mean, m.sh_mc)[0]), 3)
    out["spearman_pga_vs_iscgem_events"] = round(float(stats.spearmanr(allc.pga_mean, allc.n_iscgem.fillna(0))[0]), 3)
    OUT.write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
