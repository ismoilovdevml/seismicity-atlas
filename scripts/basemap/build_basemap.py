"""Build the self-hosted relief and water layers for the website (site/data/basemap/).

    .venv/bin/python -I scripts/basemap/build_basemap.py [relief|water|all]

Sources (public domain, https://www.naturalearthdata.com/about/terms-of-use/):
  - Natural Earth 1:50m Shaded Relief (SR_50M, 10800 x 5400, 2 arc-minutes)
  - Natural Earth 1:50m lakes and 1:50m rivers + lake centrelines

relief: Web-Mercator raster tiles, 512 px, zoom 0-4, lossy WebP with alpha. The grey shaded relief is turned into
  a theme-neutral overlay: each pixel keeps its grey, and its alpha grows with the distance from the flat value
  (206, also the ocean value): proportional to the shadow below it and to the highlight above it. Flat land and the
  ocean are fully transparent, and tiles with nothing in them are not written; index.json lists the tiles that
  exist, so the site never requests a missing tile.
water: lakes (polygons) and rivers (lines) in one GeoJSON, simplified, coordinates rounded to 0.01 degree.
"""
from __future__ import annotations

import io
import json
import math
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import mapping, shape

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetchlib import ROOT, fetch  # noqa: E402

OUT = ROOT / "site" / "data" / "basemap"
NE = "https://naciscdn.org/naturalearth"
SR = (f"{NE}/50m/raster/SR_50M.zip", "SR_50M.zip", "ff810f5f2747463fd8ffa612b23e5f5e5d593a345218976872b6749610976ab7")
LAKES = (f"{NE}/50m/physical/ne_50m_lakes.zip", "ne_50m_lakes.zip", None)
RIVERS = (f"{NE}/50m/physical/ne_50m_rivers_lake_centerlines.zip", "ne_50m_rivers_lake_centerlines.zip", None)

TILE = 256
ZMAX = 4             # 256 px tiles at z4 = 4096 px around the equator (the source has 10800); see docs/basemap.md
FLAT = 206           # grey value of flat land and of the ocean in SR_50M
SHADOW_GAIN = 1.0    # alpha = gain * (FLAT - v) / FLAT for shadows
LIGHT_GAIN = 0.7     # alpha = gain * (v - FLAT) / (255 - FLAT) for highlights
WEBP_Q = 60
WEBP_ALPHA_Q = 50
RIVER_MAX_RANK = 6   # keep rivers with Natural Earth scalerank 1-5


def load_relief() -> np.ndarray:
    zpath = fetch(*SR)
    Image.MAX_IMAGE_PIXELS = None
    with zipfile.ZipFile(zpath) as z:
        with z.open("SR_50M.tif") as f:
            im = Image.open(io.BytesIO(f.read()))
            im.load()
    a = np.asarray(im.convert("L"), dtype=np.float32)
    if a.shape != (5400, 10800):
        raise SystemExit(f"unexpected SR_50M shape {a.shape}")
    return a


def tile_lonlat(z: int, x: int, y: int):
    n = 2 ** z
    px = (np.arange(TILE) + 0.5) / TILE
    lon = (x + px) / n * 360.0 - 180.0
    my = (y + px) / n
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * my))))
    return np.meshgrid(lon, lat)


def render_tile(src: np.ndarray, z: int, x: int, y: int):
    lon, lat = tile_lonlat(z, x, y)
    H, W = src.shape
    # pixel centres of SR_50M: lon = -180 + (i + 0.5) * 360 / W, lat = 90 - (j + 0.5) * 180 / H
    ci = (lon + 180.0) / 360.0 * W - 0.5
    cj = (90.0 - lat) / 180.0 * H - 0.5
    # wrap in longitude (antimeridian), clamp in latitude
    v = ndimage.map_coordinates(src, [cj.ravel(), ci.ravel()], order=1, mode="grid-wrap").reshape(lon.shape)
    if z < ZMAX:  # mild pre-filter so low zooms do not alias
        v = ndimage.gaussian_filter(v, sigma=0.6)
    shadow = np.clip((FLAT - v) / FLAT * SHADOW_GAIN, 0, 1)
    light = np.clip((v - FLAT) / (255 - FLAT) * LIGHT_GAIN, 0, 1)
    alpha = np.where(v < FLAT, shadow, light)
    alpha = np.where(alpha < 0.02, 0, alpha)
    if not alpha.any():
        return None
    rgb = np.clip(np.round(v), 0, 255).astype(np.uint8)  # the grey itself: smooth, so it compresses well
    rgba = np.dstack([rgb, rgb, rgb, np.round(alpha * 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def build_relief():
    src = load_relief()
    out = OUT / "relief"
    tiles, total = [], 0
    for z in range(ZMAX + 1):
        n = 2 ** z
        for x in range(n):
            for y in range(n):
                im = render_tile(src, z, x, y)
                if im is None:
                    continue
                p = out / str(z) / str(x) / f"{y}.webp"
                p.parent.mkdir(parents=True, exist_ok=True)
                im.save(p, "WEBP", quality=WEBP_Q, alpha_quality=WEBP_ALPHA_Q, method=6)
                tiles.append(f"{z}/{x}/{y}")
                total += p.stat().st_size
    idx = {"source": "Natural Earth 1:50m Shaded Relief (SR_50M), public domain", "tileSize": TILE, "minzoom": 0,
           "maxzoom": ZMAX, "format": "webp", "flat": FLAT, "tiles": tiles, "bytes": total}
    (out / "index.json").write_text(json.dumps(idx, separators=(",", ":")))
    print(f"relief: {len(tiles)} tiles, {total / 1e6:.2f} MB")


def _round(geom):
    def r(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], 2), round(c[1], 2)]
        return [r(x) for x in c]
    g = mapping(geom)
    return {"type": g["type"], "coordinates": r(g["coordinates"])}


def read_geojson_from_zip(spec, member_suffix=".shp"):
    """Read a Natural Earth shapefile zip through GDAL's ogr2ogr into GeoJSON (no Python GDAL bindings needed)."""
    import subprocess
    import tempfile
    zpath = fetch(*spec)
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "out.geojson"
        subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-lco", "RFC7946=NO", str(out), f"/vsizip/{zpath}"], check=True)
        return json.loads(out.read_text())


def build_water():
    feats = []
    lakes = read_geojson_from_zip(LAKES)
    for f in lakes["features"]:
        if not f.get("geometry"):
            continue
        g = shape(f["geometry"]).simplify(0.03, preserve_topology=True)
        if g.is_empty or g.area < 0.01:
            continue
        feats.append({"type": "Feature", "properties": {"k": "l", "r": int(f["properties"].get("scalerank") or 0)},
                      "geometry": _round(g)})
    rivers = read_geojson_from_zip(RIVERS)
    for f in rivers["features"]:
        p = f["properties"]
        if not f.get("geometry"):
            continue
        if (p.get("featurecla") or "").lower().startswith("lake"):
            continue  # lake centrelines would draw lines across lake fills
        if int(p.get("scalerank") or 0) >= RIVER_MAX_RANK:
            continue  # minor rivers: clutter at a global scale
        g = shape(f["geometry"]).simplify(0.03, preserve_topology=False)
        if g.is_empty or g.length < 0.05:
            continue
        feats.append({"type": "Feature", "properties": {"k": "r", "r": int(p.get("scalerank") or 0)},
                      "geometry": _round(g)})
    fc = {"type": "FeatureCollection", "features": feats}
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / "water.geojson"
    p.write_text(json.dumps(fc, separators=(",", ":")))
    nl = sum(1 for f in feats if f["properties"]["k"] == "l")
    print(f"water: {nl} lakes, {len(feats) - nl} rivers, {p.stat().st_size / 1e3:.0f} kB")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("relief", "all"):
        build_relief()
    if what in ("water", "all"):
        build_water()
