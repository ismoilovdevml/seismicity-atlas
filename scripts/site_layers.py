"""Write the website data contract (docs/data-schema.md) into site/data/."""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import h3
import numpy as np
import pandas as pd
from shapely.geometry import MultiLineString, mapping, shape
from shapely.ops import linemerge

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (AUX, CUTOFF, D_GCMT, D_INDEP, D_ISCGEM, D_NONE, ISCGEM_LAST_YEAR, PROC, RES, SITE,  # noqa: E402
                    V_DIFFERS, V_MATCH,
                    V_UNINF, VERSION, jdump, load_work, z_verdict)

R = lambda x, n: None if x is None or not np.isfinite(x) else round(float(x), n)  # noqa: E731


def cell_polygon(h):
    ring = [(lo, la) for la, lo in h3.cell_to_boundary(h)]
    lons = np.array([p[0] for p in ring])
    if lons.max() - lons.min() > 180:  # antimeridian: make longitudes continuous
        ring = [(lo + 360 if lo < 0 else lo, la) for lo, la in ring]
    ring = [[round(lo, 2), round(la, 2)] for lo, la in ring]
    return {"type": "Polygon", "coordinates": [ring + [ring[0]]]}


def cells_layer(cells, detail_ids):
    feats = []
    for r in cells.itertuples(index=False):
        p = {"id": r.h3, "lat": r.lat, "lon": r.lon, "area_km2": int(r.area_km2), "pb": r.pb_class,
             "n_iscgem": int(r.n_iscgem), "n_comcat": int(r.n_comcat), "rate_m6": R(r.rate_m6, 4),
             "detail": r.h3 in detail_ids}
        for d in ("sh", "dp"):
            g = lambda k: getattr(r, f"{d}_{k}")  # noqa: E731
            show = g("b_q") in ("A", "B")
            p.update({f"{d}_n": int(g("n_sample")), f"{d}_nb": int(g("n_b")), f"{d}_mc": R(g("mc"), 1),
                      f"{d}_mc_lo": R(g("mc_lo"), 1), f"{d}_mc_hi": R(g("mc_hi"), 1),
                      f"{d}_b": R(g("b"), 3), f"{d}_b_lo": R(g("b_lo"), 3), f"{d}_b_hi": R(g("b_hi"), 3),
                      f"{d}_q": g("b_q"), f"{d}_ciw": R(g("b_ci_w"), 3), f"{d}_ciwr": R(g("b_ci_rel"), 3),
                      f"{d}_unstable": bool(g("b_unstable")),
                      f"{d}_bpos": R(g("bpos"), 3) if show else None,
                      f"{d}_bpos_lo": R(g("bpos_lo"), 3) if show else None,
                      f"{d}_bpos_hi": R(g("bpos_hi"), 3) if show else None,
                      f"{d}_bdecl": R(g("b_decl"), 3) if show else None,
                      f"{d}_bdecl_lo": R(g("b_decl_lo"), 3) if show else None,
                      f"{d}_bdecl_hi": R(g("b_decl_hi"), 3) if show else None,
                      f"{d}_mc_cc": R(g("mc_cc_2010"), 1), f"{d}_mc_cc0": R(g("mc_cc_pre1990"), 1)})
        n = int(r.cons_n_matched)
        dmw, dloc = r.cons_dmag_mw, r.cons_dloc_km
        miss = (int(r.cons_iscgem_only) + int(r.cons_comcat_only_m6)) / n if n else np.nan
        flag = "few" if n < 10 else ("check" if ((np.isfinite(dmw) and abs(dmw) > 0.10) or
                                                 (np.isfinite(dloc) and dloc > 30) or miss > 0.10) else "ok")
        p.update({"c_n": n, "c_dmw": R(dmw, 2), "c_dmb": R(r.cons_dmag_mb, 2), "c_dloc": R(dloc, 1),
                  "c_ddep": R(r.cons_ddepth_km, 1), "c_gonly": int(r.cons_iscgem_only),
                  "c_conly": int(r.cons_comcat_only_m6), "c_flag": flag})
        p = {k: v for k, v in p.items() if v is not None}  # null-valued properties are omitted (schema)
        feats.append({"type": "Feature", "geometry": cell_polygon(r.h3), "properties": p})
    return {"type": "FeatureCollection", "features": feats}


def events_layers(g, c):
    gi = pd.DataFrame({"lon": g.lon, "lat": g.lat, "depth": g.depth, "mag": g.mag, "year": g.t,
                       "src": np.where(g.match >= 0, 0, 1), "mt": 0, "id": g.id})
    cid = c.id.to_numpy()
    gi.loc[g.match >= 0, "id"] = cid[g.match[g.match >= 0].to_numpy()]  # link to the ComCat event page
    co = c[c.match < 0]
    mt = np.select([co.proxy_rule == "mw", co.proxy_rule == "mb", co.proxy_rule == "ms"], [1, 2, 3], 4)
    ci = pd.DataFrame({"lon": co.lon, "lat": co.lat, "depth": co.depth, "mag": co.mw_proxy, "year": co.t,
                       "src": 2, "mt": mt, "id": co.id})
    ev = pd.concat([gi, ci], ignore_index=True)
    ev["mag"] = np.round(np.round(ev.mag / 0.1) * 0.1, 1)
    ev = ev[ev.mag >= 5.0].sort_values("year").reset_index(drop=True)
    codes = {"src": {"0": "ISC-GEM and ComCat", "1": "ISC-GEM only", "2": "ComCat only"},
             "mt": {"0": "ISC-GEM Mw", "1": "ComCat Mw-type", "2": "ComCat mb to Mw proxy",
                    "3": "ComCat Ms to Mw proxy", "4": "ComCat other magnitude, unchanged"}}
    out = {}
    for name, thr in (("events_m6.json", 6.0), ("events_m5.json", 5.0)):
        e = ev[ev.mag >= thr - 1e-9]
        fields = ["lon", "lat", "depth", "mag", "year", "src", "mt", "id"]
        obj = {"n": len(e), "fields": fields, "codes": codes,
               "lon": np.round(e.lon, 2).tolist(), "lat": np.round(e.lat, 2).tolist(),
               "depth": np.round(e.depth).astype(int).tolist(), "mag": e.mag.tolist(),
               "year": np.round(e.year, 3).tolist(), "src": e.src.astype(int).tolist(), "mt": e.mt.astype(int).tolist(),
               "id": e.id.astype(str).tolist()}
        jdump(obj, SITE / name)
        out[name] = {"n": len(e), "src_counts": e.src.value_counts().sort_index().to_dict()}
    return out


def plates_layer():
    st = json.loads((AUX / "PB2002_steps.json").read_text())["features"]
    by = {}
    for f in st:
        p = f["properties"]
        key = (p["PLATEBOUND"], p["STEPCLASS"])
        by.setdefault(key, []).append(shape(f["geometry"]))
    feats = []
    for (pb, cls), lines in sorted(by.items()):
        merged = linemerge(lines)
        geoms = merged.geoms if isinstance(merged, MultiLineString) else [merged]
        for gm in geoms:
            s = gm.simplify(0.02)
            coords = [[round(x, 2), round(y, 2)] for x, y in s.coords]
            feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                          "properties": {"boundary": pb, "class": cls}})
    return {"type": "FeatureCollection", "features": feats}


def simplify_layer(src, tol, nd=2):
    fc = json.loads((AUX / src).read_text())
    feats = []
    for f in fc["features"]:
        gm = shape(f["geometry"]).simplify(tol, preserve_topology=True)
        if gm.is_empty:
            continue
        gj = mapping(gm)

        def rnd(x):
            if isinstance(x, (list, tuple)) and x and isinstance(x[0], (int, float)):
                return [round(x[0], nd), round(x[1], nd)]
            return [rnd(y) for y in x]
        feats.append({"type": "Feature", "geometry": {"type": gj["type"], "coordinates": rnd(gj["coordinates"])},
                      "properties": {}})
    return {"type": "FeatureCollection", "features": feats}


def _zs(z):
    return f" (z {z:+.2f})" if z is not None else ""


def validation_table(v, seq):
    """Rows of the site validation table. Every row: test, ours, published, verdict, data, z (docs/validation.md).

    verdict starts with one of: match / differs (|z| <= 1.96 or not, published uncertainty known), "consistent,
    uninformative" (no published uncertainty; our interval contains the published value), not testable, reference
    only, robust (internal check), description only. data says whether the published number comes from the same data
    as ours (GCMT-based, or ISC-GEM itself) or from independent data (common.D_*)."""
    t = []

    def row(test, ours, published, verdict, data, z=None):
        t.append({"test": test, "ours": ours, "published": published, "verdict": verdict, "data": data, "z": z})

    mp = v["michael_pooled"]
    for k, lab in (("shallow_1918_2009", "Global b, shallow < 60 km, 1918-2009, Michael's Mc(t)"),
                   ("deep_1964_2009", "Global b, depth >= 60 km, 1964-2009, Mc 5.7")):
        r = mp[k]
        vd, z = z_verdict(r["b"], r["ci95"][0], r["ci95"][1], r["published_b"])
        row(lab, f"{r['b']:.3f} [{r['ci95'][0]:.3f}, {r['ci95'][1]:.3f}]", f"{r['published_b']:.2f} (Michael 2014)",
            vd + ("" if vd != V_DIFFERS else ": published value outside our 95 % interval"), D_ISCGEM, z)
    for r in v["michael_periods"]:
        mx, mlo, mhi = r["maxc02"]
        d = mx - r["michael_mc"]
        vd, z = z_verdict(mx, mlo, mhi, r["michael_mc"])
        row(f"Mc, {r['depth']}, {r['period']} (MAXC+0.2 [95 %] / MBS)",
            f"{mx:.1f} [{mlo:.1f}, {mhi:.1f}] / {r['mbs'][0]:.1f}", f"{r['michael_mc']:.1f} (Michael 2014)",
            vd + ("" if vd != V_DIFFERS else f": {'lower' if d < 0 else 'higher'} by {abs(d):.1f}"
                  + (" (newer catalogue release; Mc here reflects the ISC-GEM inclusion thresholds)" if d < 0 else "")),
            D_ISCGEM, z)
    for name, r in v["regions"].items():
        pub = r["published_b"]
        lo, hi = r["ci95"]
        if r["quality"] == "insufficient":
            vd, z = "not testable (n<50)", None
        elif pub is None:
            vd, z = "reference only", None
        else:
            vd, z = z_verdict(r["b"], lo, hi, pub)
        data = D_NONE if (pub is None and name in ("Japan", "Chile")) else D_INDEP
        row(f"Regional b, {name}, shallow, ISC-GEM 1976-{ISCGEM_LAST_YEAR}",
            f"{r['b']:.3f} [{lo:.3f}, {hi:.3f}] n={r['n_b']} q={r['quality']}",
            f"{pub:.2f}" if pub is not None else r["source"], vd, data, z)
    pb = v["plate_boundary_types"]
    sub = pb["SUB"]
    vd, z = z_verdict(sub["b"], sub["ci95"][0], sub["ci95"][1], 0.981)
    row("Plate-boundary b, SUB", f"{sub['b']:.3f} [{sub['ci95'][0]:.3f}, {sub['ci95'][1]:.3f}]",
        "0.98 (beta 0.654 x 1.5, GCMT subduction, Kagan & Jackson)", vd, D_GCMT, z)
    osr = pb["OSR"]
    vd, z = z_verdict(osr["b"], osr["ci95"][0], osr["ci95"][1], (1.2, 1.65))
    row("Plate-boundary b, OSR (spreading ridges)", f"{osr['b']:.3f} [{osr['ci95'][0]:.3f}, {osr['ci95'][1]:.3f}]",
        "1.2-1.65 (beta 0.8-1.1, Kagan 2002 via Kagan 2010)", vd, D_GCMT, z)
    order = sorted(pb, key=lambda k: -pb[k]["b"])
    row("Ranking of b by boundary class", " > ".join(order),
        "spreading highest (TRACE 2026, Kagan); thrust/convergent lowest (Schorlemmer 2005)",
        (V_UNINF + ": qualitative ranking") if order[0] == "OSR" else V_DIFFERS, D_GCMT)
    sa = v["slab_age_groups"]
    y, o = sa["young"], sa["old"]
    sep = y["ci95"][1] < o["ci95"][0]
    row("Subduction b, young vs old slabs",
        f"young {y['b']:.3f} [{y['ci95'][0]:.3f}, {y['ci95'][1]:.3f}], old {o['b']:.3f} [{o['ci95'][0]:.3f}, "
        f"{o['ci95'][1]:.3f}]", "b increases with slab age (Nishikawa & Ide 2014, ANSS catalogue)",
        (V_UNINF + (": direction only; our two intervals do not overlap" if sep else
                    ": direction only; our two intervals overlap")) if y["b"] < o["b"] else V_DIFFERS, D_INDEP)
    s = seq["synthetic_check"]
    se = s["p_sd_between"] / np.sqrt(s["n_runs"])
    z = (s["p_mean"] - s["p_true"]) / se   # the true p is known exactly
    row(f"Omori p recovery, synthetic teleseismic sequence ({s['n_runs']} runs)",
        f"p {s['p_mean']:.3f} (sd {s['p_sd_between']:.3f}, se of the mean {se:.3f}, mean sigma {s['sp_mean']:.3f})",
        f"true p {s['p_true']}", (V_MATCH if abs(z) <= 1.96 else V_DIFFERS) + _zs(z) + " (bias of the mean)",
        D_INDEP, float(z))
    for r in v.get("synthetic_bias", []):
        row(f"b recovery, synthetic cells, {r['case'].replace('_', ' ')}, {r['n_cells']} cells with "
            f"{r['n_min']}-{r['n_max']} events above Mc",
            f"mean error {r['mean_err']:+.3f} (se {r['se']:.3f}); CI coverage {r['coverage']:.3f}",
            "true b (0.7-1.4)", (V_MATCH if abs(r["z"]) <= 1.96 else V_DIFFERS) + _zs(r["z"]) + " (bias of the mean)",
            D_INDEP, r["z"])
    for f in ("val_chile.json", "val_literature.json", "val_bt.json"):  # rows from scripts/val_*.py, if those have been run
        if (RES / f).exists():
            t += json.loads((RES / f).read_text()).get("table_rows", [])
    return t


def validation_counts(t):
    """Verdict counts per data group (same data vs independent) for the table and the docs."""
    out = {}
    for r in t:
        g = out.setdefault(r.get("data", D_NONE), {})
        k = r["verdict"].split(" (")[0].split(":")[0].split(";")[0]
        g[k] = g.get(k, 0) + 1
    return out


def main():
    cells = load_work("cells")
    g, c = load_work("iscgem"), load_work("comcat")
    v = json.loads((RES / "validation.json").read_text())
    ag = json.loads((RES / "atlas_globals.json").read_text())
    prep = json.loads((RES / "prepare.json").read_text())
    seq = json.loads((SITE / "sequences.json").read_text())
    detail_ids = {p.stem for p in (SITE / "cells").glob("*.json")}
    srcf = PROC / "iscgem_source.json"
    isrc = json.loads(srcf.read_text()) if srcf.exists() else {"source": "comcat-mirror"}
    iscgem_access = ("official ISC-GEM CSV, sha256 " + isrc["sha256"] if isrc["source"] == "official"
                     else "USGS ComCat copy, catalog=iscgem (version not stated by ComCat, events to "
                          f"{str(prep['iscgem_span'][1])[:10]})")
    jdump(cells_layer(cells, detail_ids), SITE / "cells.geojson")
    ev = events_layers(g, c)
    jdump(plates_layer(), SITE / "plates.geojson")
    jdump(simplify_layer("ne_110m_land.geojson", 0.0), SITE / "land.geojson")
    jdump(simplify_layer("ne_50m_coastline.geojson", 0.08), SITE / "coastline.geojson")
    vt = validation_table(v, seq)
    jdump({"michael_periods": v["michael_periods"], "michael_pooled": v["michael_pooled"],
           "b_cutoff_2004_2021": v["comcat_proxy_vs_iscgem_b_2004_2021"],
           "plate_boundary_types": v["plate_boundary_types"], "slab_age_groups": v["slab_age_groups"],
           "floors": ag["floors"], "validation_table": vt, "validation_counts": validation_counts(vt)}, SITE / "global.json")
    jdump(vt, RES / "validation_table.json", indent=1)

    files = {}
    for f in sorted(SITE.glob("*.json")) + sorted(SITE.glob("*.geojson")):
        if f.name == "manifest.json":
            continue
        b = f.read_bytes()
        files[f.name] = {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
    det = list((SITE / "cells").glob("*.json"))
    manifest = {
        "name": "Global Seismicity Atlas", "version": VERSION,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_cutoff_utc": CUTOFF,
        "coverage": {"iscgem": prep["iscgem_span"], "comcat": prep["comcat_span"]},
        "disclaimer": ("Catalogue statistics for research and education. Not an earthquake forecast and not an "
                       "official seismic hazard map."),
        "licence": {"data": "CC BY-SA 4.0 (derived from ISC-GEM, CC BY-SA 3.0)", "code": "MIT",
                    "exceptions": ["plates.geojson: PB2002 (Bird 2003) via fraxen/tectonicplates, ODC-BY 1.0",
                                   "land.geojson, coastline.geojson, basemap/ and places.json: Natural Earth, public domain",
                                   "slab2/: USGS Slab2 (Hayes et al. 2018), CC0 1.0"]},
        "sources": [
            {"name": "ISC-GEM Global Instrumental Earthquake Catalogue", "access": iscgem_access,
             "url": "https://www.isc.ac.uk/iscgem/", "licence": "CC BY-SA 3.0",
             "licence_url": "https://creativecommons.org/licenses/by-sa/3.0/",
             "attribution": "© International Seismological Centre and GEM Foundation",
             "citation": ("International Seismological Centre (2026), ISC-GEM Earthquake Catalogue, doi:10.31905/D808B825; "
                          "Storchak et al. 2013 SRL 84(5), 810-815; Storchak et al. 2015 PEPI 239, 48-63; "
                          "Di Giacomo et al. 2018 ESSD 10, 1877")},
            {"name": "USGS ANSS ComprehensiveCatalog (ComCat)", "url": "https://earthquake.usgs.gov/fdsnws/event/1/",
             "licence": "public domain (U.S. Government work)", "query": "minmagnitude=4.5, 1973-01-01 to cut-off"},
            {"name": "PB2002 plate boundaries (Bird 2003)", "url": "https://github.com/fraxen/tectonicplates",
             "licence": "ODC-BY 1.0", "citation": "Bird 2003 G3 4(3) 1027; conversion by Hugo Ahlenius, Nordpil"},
            {"name": "Natural Earth (land, coastline, shaded relief, lakes and rivers, populated places)",
             "url": "https://www.naturalearthdata.com/", "licence": "public domain"},
            {"name": "USGS Slab2 subduction zone geometry (Depth 3D view)", "url": "https://doi.org/10.5066/F7PV6JNV",
             "licence": "CC0 1.0", "citation": "Hayes et al. 2018 Science 362, 58-61, doi:10.1126/science.aat4723"}],
        "method": {"cells": "H3 resolution 2", "sample_radius_km": ag["sample_radius_km"],
                   "b_catalogue": f"ISC-GEM Mw 1976-{ISCGEM_LAST_YEAR}", "b_sample": ag.get("b_sample", "all events"),
                   "b_magerr_max": ag.get("b_magerr_max"), "floors": ag["floors"], "nboot": ag["nboot"],
                   "quality": {"A": "95 % CI width / b <= 0.30", "B": "<= 0.50", "C": "wider: b masked",
                               "insufficient": "< 50 events above threshold"},
                   "quality_width": "relative: (hi - lo) / b, b = the point estimate of the cell (since 0.5.0)"},
        "global": {"b_shallow_1976_2021": v["global_atlas_method"]["shallow"],
                   "b_deep_1976_2021": v["global_atlas_method"]["deep"]},
        "files": files, "cell_detail_files": {"count": len(det), "bytes": sum(p.stat().st_size for p in det)},
        "events": ev,
    }
    jdump(manifest, SITE / "manifest.json", indent=1)
    tot = sum(x["bytes"] for x in files.values()) + manifest["cell_detail_files"]["bytes"]
    for k, x in files.items():
        print(f"{k:22s} {x['bytes']/1e6:7.3f} MB")
    print(f"cells/ {len(det)} files {manifest['cell_detail_files']['bytes']/1e6:.2f} MB; total {tot/1e6:.2f} MB")
    print(json.dumps(ev))


if __name__ == "__main__":
    main()
