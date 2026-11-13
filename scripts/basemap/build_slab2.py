"""Cut the USGS Slab2 depth contours to the 3D-view presets (site/data/slab2/<preset>.json).

    .venv/bin/python -I scripts/basemap/build_slab2.py

Source: Hayes, G.P., et al. (2018), Slab2, a comprehensive subduction zone geometry model, Science 362, 58-61,
doi:10.1126/science.aat4723; data release Hayes, G. (2018), doi:10.5066/F7PV6JNV (U.S. public domain).

The official ScienceBase download sits behind an interactive browser check that scripts cannot pass. The contour
files are therefore read, unchanged, from a public mirror of the release (repository ndb38/arc-metals, pinned
commit below). Each file is checked against its SHA-256; izu, ryu, hin and pam also have the identical git blob in
two further independent mirrors (see docs/basemap.md).

Output per preset: {"slabs": [{"id", "name", "file", "contours": [{"d": depth_km, "lines": [[lon, lat, ...]]}]}]}.
Lines are cut to the preset box (plus a margin), simplified (0.02 degree) and rounded to 0.01 degree. Longitudes
are made continuous around the preset centre, so Tonga-Kermadec runs past 180 without a break.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, box

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetchlib import ROOT, fetch  # noqa: E402

OUT = ROOT / "site" / "data" / "slab2"
MIRROR = ("https://raw.githubusercontent.com/ndb38/arc-metals/543bf32cabaa97384a28c0b83304975be4079ddb/"
          "1_arc-metals/supporting_datasets/Hayes2018/Slab2_CONTOURS/")
FILES = {  # Slab2 id -> (file name, region name); checksums in slab2_sha256.json (written on the first run)
    "kur": ("kur_slab2_dep_02.24.18_contours.in", "Kuril-Japan"),
    "izu": ("izu_slab2_dep_02.24.18_contours.in", "Izu-Bonin"),
    "ryu": ("ryu_slab2_dep_02.26.18_contours.in", "Ryukyu"),
    "sam": ("sam_slab2_dep_02.23.18_contours.in", "South America"),
    "ker": ("ker_slab2_dep_02.24.18_contours.in", "Kermadec-Tonga"),
    "hin": ("hin_slab2_dep_02.24.18_contours.in", "Hindu Kush"),
    "pam": ("pam_slab2_dep_02.26.18_contours.in", "Pamir"),
    "cal": ("cal_slab2_dep_02.24.18_contours.in", "Calabria"),
}
SHA = json.loads((Path(__file__).resolve().parent / "slab2_sha256.json").read_text()) \
    if (Path(__file__).resolve().parent / "slab2_sha256.json").exists() else {}
# Must match PRESETS in site/js/depth3d.js (bbox: west, south, east, north; longitudes continuous)
PRESETS = {
    "japan": ((128, 28, 150, 46), ["kur", "izu", "ryu"]),
    "chile": ((-78, -40, -62, -15), ["sam"]),
    "tonga": ((172, -36, 192, -14), ["ker"]),
    "hindukush": ((66, 33, 78, 41), ["hin", "pam"]),
    "italy": ((6, 36, 20, 47), ["cal"]),
}
MARGIN = 1.0
TOL = 0.02


def parse_contours(text: str):
    """GMT multi-segment text: '> -660 contour -Z-660' then 'lon lat depth' rows. Yields (depth_km, Nx2 array)."""
    seg, depth = [], None
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith(">"):
            if seg:
                yield depth, np.array(seg, dtype=float)
            seg = []
            parts = line[1:].split()
            depth = abs(float(parts[0])) if parts else None
            continue
        vals = line.split()
        if len(vals) >= 3:
            seg.append((float(vals[0]), float(vals[1])))
            depth = abs(float(vals[2]))
    if seg:
        yield depth, np.array(seg, dtype=float)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    texts, shas = {}, {}
    for sid, (name, _) in FILES.items():
        p = fetch(MIRROR + name, name, SHA.get(sid))
        texts[sid] = p.read_text()
        shas[sid] = hashlib.sha256(p.read_bytes()).hexdigest()
    total = 0
    for preset, (bb, ids) in PRESETS.items():
        w, s, e, n = bb
        lon0 = (w + e) / 2
        clip = box(w - MARGIN, s - MARGIN, e + MARGIN, n + MARGIN)
        slabs = []
        for sid in ids:
            by_depth: dict[int, list] = {}
            for depth, xy in parse_contours(texts[sid]):
                lon = xy[:, 0].copy()
                lon = (lon - lon0 + 180) % 360 - 180 + lon0  # continuous around the preset centre
                if len(lon) < 2:
                    continue
                g = LineString(np.column_stack([lon, xy[:, 1]])).intersection(clip)
                if g.is_empty:
                    continue
                parts = getattr(g, "geoms", [g])
                for part in parts:
                    if part.geom_type != "LineString" or part.length < 0.05:
                        continue
                    part = part.simplify(TOL, preserve_topology=False)
                    flat = [round(v, 2) for xy2 in part.coords for v in xy2]
                    by_depth.setdefault(int(round(depth)), []).append(flat)
            if by_depth:
                slabs.append({"id": sid, "name": FILES[sid][1], "file": FILES[sid][0],
                              "contours": [{"d": d, "lines": by_depth[d]} for d in sorted(by_depth)]})
        doc = {"preset": preset, "bbox": list(bb),
               "source": "USGS Slab2 (Hayes et al. 2018, doi:10.1126/science.aat4723; data doi:10.5066/F7PV6JNV), "
                         "U.S. public domain. Depth contours every 20 km.",
               "slabs": slabs}
        p = OUT / f"{preset}.json"
        p.write_text(json.dumps(doc, separators=(",", ":")))
        total += p.stat().st_size
        nd = sum(len(sl["contours"]) for sl in slabs)
        print(f"{preset}: {len(slabs)} slabs, {nd} depth levels, {p.stat().st_size / 1e3:.0f} kB")
    (Path(__file__).resolve().parent / "slab2_sha256.json").write_text(json.dumps(shas, indent=1) + "\n")
    print(f"slab2 total {total / 1e3:.0f} kB")


if __name__ == "__main__":
    main()
