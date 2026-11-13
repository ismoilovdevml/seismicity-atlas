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
from common import AUX, CUTOFF, RES, SITE, VERSION, jdump, load_work  # noqa: E402

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
                      f"{d}_q": g("b_q"), f"{d}_ciw": R(g("b_ci_w"), 3), f"{d}_unstable": bool(g("b_unstable")),
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
    for name, thr, with_id in (("events_m6.json", 6.0, True), ("events_m5.json", 5.0, False)):
        e = ev[ev.mag >= thr - 1e-9]
        fields = ["lon", "lat", "depth", "mag", "year", "src", "mt"] + (["id"] if with_id else [])
        obj = {"n": len(e), "fields": fields, "codes": codes,
               "lon": np.round(e.lon, 2).tolist(), "lat": np.round(e.lat, 2).tolist(),
               "depth": np.round(e.depth).astype(int).tolist(), "mag": e.mag.tolist(),
               "year": np.round(e.year, 3).tolist(), "src": e.src.astype(int).tolist(), "mt": e.mt.astype(int).tolist()}
        if with_id:
            obj["id"] = e.id.astype(str).tolist()
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


def validation_table(v, seq):
    t = []
    mp = v["michael_pooled"]
    for k, lab in (("shallow_1918_2009", "Global b, shallow < 60 km, 1918-2009, Michael's Mc(t)"),
                   ("deep_1964_2009", "Global b, depth >= 60 km, 1964-2009, Mc 5.7")):
        r = mp[k]
        t.append({"test": lab, "ours": f"{r['b']:.3f} [{r['ci95'][0]:.3f}, {r['ci95'][1]:.3f}]",
                  "published": f"{r['published_b']:.2f} (Michael 2014)",
                  "verdict": "match" if r["ci95"][0] <= r["published_b"] <= r["ci95"][1] else "close, outside 95 % CI"})
    for r in v["michael_periods"]:
        mx = r["maxc02"][0]
        d = mx - r["michael_mc"]
        t.append({"test": f"Mc, {r['depth']}, {r['period']} (MAXC+0.2 / MBS)",
                  "ours": f"{mx:.1f} / {r['mbs'][0]:.1f}", "published": f"{r['michael_mc']:.1f} (Michael 2014)",
                  "verdict": "match" if abs(d) <= 0.1 else ("lower" if d < 0 else "higher") + f" by {abs(d):.1f}" +
                  (" (catalogue version differs)" if d < 0 else "")})
    for name, r in v["regions"].items():
        pub = r["published_b"]
        lo, hi = r["ci95"]
        ok = pub is not None and lo is not None and lo <= pub <= hi
        t.append({"test": f"Regional b, {name}, shallow, ISC-GEM 1976-2021",
                  "ours": f"{r['b']:.3f} [{lo:.3f}, {hi:.3f}] n={r['n_b']} q={r['quality']}",
                  "published": f"{pub:.2f}" if pub is not None else r["source"],
                  "verdict": ("not testable (n<50)" if r["quality"] == "insufficient" else
                              ("match" if ok else "mismatch") if pub is not None else "reference only")})
    pb = v["plate_boundary_types"]
    t.append({"test": "Plate-boundary b, SUB", "ours": f"{pb['SUB']['b']:.3f} [{pb['SUB']['ci95'][0]:.3f}, "
              f"{pb['SUB']['ci95'][1]:.3f}]", "published": "0.98 (beta 0.654 x 1.5, GCMT subduction, Kagan & Jackson)",
              "verdict": "match" if pb["SUB"]["ci95"][0] <= 0.981 <= pb["SUB"]["ci95"][1] else "mismatch"})
    t.append({"test": "Plate-boundary b, OSR (spreading ridges)", "ours": f"{pb['OSR']['b']:.3f} [{pb['OSR']['ci95'][0]:.3f}, "
              f"{pb['OSR']['ci95'][1]:.3f}]", "published": "1.2-1.65 (beta 0.8-1.1, Kagan 2002 via Kagan 2010)",
              "verdict": "match" if 1.2 <= pb["OSR"]["b"] <= 1.65 else "mismatch"})
    order = sorted(pb, key=lambda k: -pb[k]["b"])
    t.append({"test": "Ranking of b by boundary class", "ours": " > ".join(order),
              "published": "spreading highest (TRACE 2026, Kagan); thrust/convergent lowest (Schorlemmer 2005)",
              "verdict": "match" if order[0] == "OSR" else "mismatch"})
    sa = v["slab_age_groups"]
    t.append({"test": "Subduction b, young vs old slabs",
              "ours": f"young {sa['young']['b']:.3f} [{sa['young']['ci95'][0]:.3f}, {sa['young']['ci95'][1]:.3f}], "
                      f"old {sa['old']['b']:.3f} [{sa['old']['ci95'][0]:.3f}, {sa['old']['ci95'][1]:.3f}]",
              "published": "b increases with slab age (Nishikawa & Ide 2014)",
              "verdict": "match" if sa["young"]["ci95"][1] < sa["old"]["ci95"][0] else
              ("same direction, overlapping CI" if sa["young"]["b"] < sa["old"]["b"] else "mismatch")})
    s = seq["synthetic_check"]
    t.append({"test": "Omori p recovery, synthetic teleseismic sequence (20 runs)",
              "ours": f"p {s['p_mean']:.3f} (sd {s['p_sd_between']:.3f}, mean sigma {s['sp_mean']:.3f})",
              "published": f"true p {s['p_true']}", "verdict": "match" if abs(s["p_mean"] - s["p_true"]) < 2 * s["p_sd_between"] else "biased"})
    for f in ("val_chile.json", "val_literature.json"):  # rows from scripts/val_*.py, if those have been run
        if (RES / f).exists():
            t += json.loads((RES / f).read_text()).get("table_rows", [])
    return t


def main():
    cells = load_work("cells")
    g, c = load_work("iscgem"), load_work("comcat")
    v = json.loads((RES / "validation.json").read_text())
    ag = json.loads((RES / "atlas_globals.json").read_text())
    prep = json.loads((RES / "prepare.json").read_text())
    seq = json.loads((SITE / "sequences.json").read_text())
    detail_ids = {p.stem for p in (SITE / "cells").glob("*.json")}
    jdump(cells_layer(cells, detail_ids), SITE / "cells.geojson")
    ev = events_layers(g, c)
    jdump(plates_layer(), SITE / "plates.geojson")
    jdump(simplify_layer("ne_110m_land.geojson", 0.0), SITE / "land.geojson")
    jdump(simplify_layer("ne_50m_coastline.geojson", 0.08), SITE / "coastline.geojson")
    vt = validation_table(v, seq)
    jdump({"michael_periods": v["michael_periods"], "michael_pooled": v["michael_pooled"],
           "b_cutoff_2004_2021": v["comcat_proxy_vs_iscgem_b_2004_2021"],
           "plate_boundary_types": v["plate_boundary_types"], "slab_age_groups": v["slab_age_groups"],
           "floors": ag["floors"], "validation_table": vt}, SITE / "global.json")
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
        "licence": {"data": "CC BY-SA 4.0 (derived from ISC-GEM, CC BY-SA 3.0)", "code": "MIT"},
        "sources": [
            {"name": "ISC-GEM Global Instrumental Earthquake Catalogue", "access": "USGS ComCat mirror, catalog=iscgem",
             "url": "https://www.isc.ac.uk/iscgem/", "licence": "CC BY-SA 3.0",
             "citation": "Storchak et al. 2013 SRL 84(5); Di Giacomo et al. 2018 ESSD 10, 1877; doi:10.31905/D808B825"},
            {"name": "USGS ANSS ComprehensiveCatalog (ComCat)", "url": "https://earthquake.usgs.gov/fdsnws/event/1/",
             "licence": "public domain (U.S. Government work)", "query": "minmagnitude=4.5, 1973-01-01 to cut-off"},
            {"name": "PB2002 plate boundaries (Bird 2003)", "url": "https://github.com/fraxen/tectonicplates",
             "licence": "ODC-BY 1.0", "citation": "Bird 2003 G3 4(3) 1027; conversion by Hugo Ahlenius, Nordpil"},
            {"name": "Natural Earth 1:110m land, 1:50m coastline", "url": "https://www.naturalearthdata.com/",
             "licence": "public domain"}],
        "method": {"cells": "H3 resolution 2", "sample_radius_km": ag["sample_radius_km"],
                   "b_catalogue": "ISC-GEM Mw 1976-2021", "floors": ag["floors"], "nboot": ag["nboot"],
                   "quality": {"A": "95 % CI width <= 0.30", "B": "<= 0.50", "C": "wider: b masked",
                               "insufficient": "< 50 events above threshold"}},
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
