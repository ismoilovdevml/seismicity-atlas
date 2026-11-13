# Base map relief, 3D terrain and the Depth 3D view

This page records the sources, licences, attribution, processing, sizes and design choices behind three additions
to the website:

1. **Relief, lakes and rivers** on the map (on by default, self-hosted);
2. **3D terrain** on the map (off by default; the only external tile source);
3. the **Depth 3D** view (`#v=depth`): hypocentres below the surface, the USGS Slab2 slab surface and the atlas
   statistics for the same region.

The site still ships its own land, coastline and plate layers and needs no third-party basemap. Nothing in this
page changes a b-value, an interval or a quality code.

## 1. Relief and water (default on)

| | |
|---|---|
| Relief source | Natural Earth 1:50m Shaded Relief, `SR_50M.zip` (10,800 × 5,400 px, 2 arc-minutes), https://naciscdn.org/naturalearth/50m/raster/SR_50M.zip, SHA-256 `ff810f5f…0976ab7` |
| Water sources | Natural Earth 1:50m lakes (`ne_50m_lakes.zip`) and 1:50m rivers and lake centrelines (`ne_50m_rivers_lake_centerlines.zip`) |
| Licence | Public domain. Natural Earth terms of use: "All versions of Natural Earth raster + vector map data found on this website are in the public domain." (https://www.naturalearthdata.com/about/terms-of-use/, checked 2026-11-13) |
| Credit shown | "Natural Earth" in the map credit line (already present); suggested long form "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com." |
| Script | `scripts/basemap/build_basemap.py [relief|water|all]` (downloads are cached in `data/raw/basemap/` and logged with SHA-256 in `data/raw/basemap/manifest.jsonl`) |

**Processing.**

- *Relief tiles.* Web-Mercator raster tiles, 256 px, zoom 0–4, lossy WebP with alpha (`site/data/basemap/relief/{z}/{x}/{y}.webp`).
  Each zoom samples an area-averaged copy of the source (box filter), so low zooms are not speckled. The grey relief
  becomes a theme-neutral overlay: the flat value of `SR_50M` is 206 (ocean and flat land); darker pixels become a dark
  ink whose alpha grows with the shadow, brighter ones white whose alpha grows with the highlight. Flat land and
  the ocean are fully transparent, so the same tiles work on the light and the dark land colour. Tiles that would
  be empty are not written. `index.json` lists the 283 tiles that exist; a small MapLibre protocol (`gsarelief://`)
  answers every other tile with a 1 × 1 transparent PNG, so the browser never requests a missing tile (no 404s).
- *Water.* Lakes (polygons) and rivers (Natural Earth scalerank 1–5; lake centrelines dropped because they would
  cross the lake fills) in one GeoJSON (`site/data/basemap/water.geojson`), simplified with a 0.03° tolerance and
  rounded to 0.01°. The file loads after the first map paint.
- *Style.* All three layers sit **between the land fill and the cells**: a cell colour is never changed by the base
  map. Relief opacity is 0.6 (light) and 0.7 (dark); lakes use the ocean colour, rivers a muted grey-blue
  (`--water-line`, light `#a7b5bf`, dark `#3f4c57`). Where a cell is quality A (opacity 0.92) the relief shows only as a
  faint texture; under "insufficient" cells (opacity 0.22), outside the cells and with "No cell layer" it is clear.
- *Projections and the antimeridian.* Raster tiles wrap with the map's world copies in Mercator and drape on the
  globe; the sampling wraps in longitude, so tiles on both sides of 180° join. Natural Earth water is already split
  at 180°. Both cases are covered by a browser test.
- *Toggle.* "Relief, lakes and rivers" in the "Base map" group of the map controls; URL key `rl=0` when off.

**Sizes.** 283 relief tiles, 3.75 MB in total (z0 12 kB, z1 43 kB, z2 170 kB, z3 692 kB, z4 2.83 MB);
`index.json` 2.6 kB; `water.geojson` 251 kB (66 kB gzip). At the default world view the map loads about 0.2 MB of
relief tiles plus the water file, about 0.45 MB uncompressed in total.

**Choice.** Natural Earth was chosen over a hillshade computed from a DEM because it is public domain, already
hand-tuned for small scales, and needs no DEM download. Zoom 5 tiles would add about 11 MB, so the relief stops at
z4 (4,096 px around the equator) and is upsampled beyond that; at regional zooms it is soft but correct. A first
version with a hard black/white colour switch and point sampling was 18 MB at 512 px and speckled at low zooms.

## 2. 3D terrain (default off, external)

| | |
|---|---|
| Tiles | Terrain Tiles on AWS Open Data, Terrarium encoding: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (bucket `arn:aws:s3:::elevation-tiles-prod`, us-east-1; registry page https://registry.opendata.aws/terrain-tiles/) |
| Access | Public, no account or key; the bucket answers with `Access-Control-Allow-Origin: *` (checked with curl on 2026-11-13) |
| Licence | The registry page gives no single licence: it links the Tilezen Joerd attribution document (https://github.com/tilezen/joerd/blob/master/docs/attribution.md), which lists the sources and their terms: ETOPO1 (NOAA, US public domain), SRTM, GMTED2010 and 3DEP (USGS, public domain / no restrictions, credit requested), EU-DEM (Copernicus), Geoscience Australia (CC BY 4.0), LINZ (CC BY 3.0 NZ), Kartverket (CC BY 4.0), data.gov.uk (OGL v3), CDEM (OGL Canada), INEGI, DGM Österreich (CC BY 3.0 AT), ArcticDEM. The document says users are responsible for checking each project's terms. |
| Registry citation | "Terrain Tiles was accessed on DATE from https://registry.opendata.aws/terrain-tiles." |

**Attribution shown on the map while 3D terrain is on.** A short line, "3D terrain: Terrain Tiles (AWS Open Data,
Tilezen Joerd): ETOPO1, SRTM, GMTED2010, 3DEP and others.", and a "Full credits" button that opens the required
attribution block of the Joerd document, quoted verbatim:

```
* ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and
  funded under National Science Foundation awards 1043681, 1559691, and 1542736;
* Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;
* Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM)
  Österreich;
* Canada terrain data contains information licensed under the Open Government
  Licence – Canada;
* Europe terrain data produced using Copernicus data and information funded by the
  European Union - EU-DEM layers;
* Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration
* Mexico terrain data source: INEGI, Continental relief, 2016;
* New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New
  Zealand and the New Zealand Government (All rights reserved);
* Norway terrain data © Kartverket;
* United Kingdom terrain data © Environment Agency copyright and/or database right
  2015. All rights reserved;
* United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data
  courtesy of the U.S. Geological Survey.
```

The Joerd document has a second block that adds "Mapzen" for Mapzen's former hosted service; the site uses the
AWS bucket, so the general block is shown. The About page has one line naming this source and saying it is opt-in.

**Behaviour.** The checkbox "3D terrain (external tiles)" (URL key `tr=1`) adds a `raster-dem` source (Terrarium,
256 px, z0–10), `map.setTerrain({exaggeration: 3})`, tilts the map to 55°, and enables right-drag / Ctrl-drag and
two-finger tilt and rotation; turning it off removes the terrain and returns to pitch 0 and north up. While terrain
is on, the relief layer switches to a MapLibre `hillshade` of the same elevation tiles (sharper when zoomed in), so
relief is never drawn twice. An exaggeration of 3 was chosen because at the zooms this map allows (≤ 8) true-scale
relief is barely visible; it is stated in the control hint.

**Globe.** MapLibre GL JS supports terrain in globe projection since 5.0.0 (changelog: "Support Terrain in Globe
projection (#4976)"), so the switch stays available on the globe. The MapLibre changelog also lists a fix after
5.24.0 for a "camera jump on dragend with globe + terrain at low pitch" (#7736); see known issues.

**Privacy and tests.** Nothing is requested from AWS unless the box is ticked. The browser tests serve a synthetic
Terrarium tile through a request route and assert that no external request happens with the default settings, so
CI never contacts AWS.

### Satellite imagery: not added

EOX Sentinel-2 cloudless 2016 was checked as the only candidate with an open licence. The current EOX licence page
(https://cloudless.eox.at/documentation/license, read 2026-11-13) describes one unified licence for the EOxCloudless
data and viewing products: CC BY-NC-SA 4.0 for non-commercial use and a separate EOX commercial licence otherwise,
with sub-licensing only by agreement. It no longer states CC BY 4.0 for the 2016 layer, and it does not say that the
hosted tile service may be used by a public website without an agreement. Because the terms for the **service** are
unclear and the data terms now read as non-commercial, satellite imagery was skipped. It would also pull the map
towards a photographic look, which this atlas avoids.

## 3. Depth 3D view

### What it shows

- Presets: Japan, Chile and the Andes, Tonga–Kermadec, Hindu Kush–Pamir, Italy, Iceland, and "Current map view"
  (a box around the map position in the URL, 4°–40° wide). Boxes and cross-section lines are in `PRESETS` in
  `site/js/depth3d.js`; the Slab2 boxes in `scripts/basemap/build_slab2.py` must match.
- Events from `events_m6.json` (default) or `events_m5.json` ("Add M 5–6 events", 7.5 MB, loaded on request), at
  their catalogue depth, coloured by depth class and sized by magnitude (the same size rule in 3D and in the
  cross-section).
- Depth classes 0–35, 35–70, 70–150, 150–300, 300–500 and ≥ 500 km. The 70 km boundary is the atlas split between
  shallow and deeper statistics and is drawn as a dashed ring (3D) or line (cross-section).
- **Colour.** One-hue sequential ramp in OKLCH (hue 305), light to dark in the light theme (L 0.76 → 0.30) and dark
  to light in the dark theme (L 0.52 → 0.94), so deeper is always "stronger". A single hue keeps it readable with
  colour-vision deficiencies (only lightness carries the order). Depth is also encoded by position, and every
  class is labelled in the legend and the depth table. The `dataviz` validator (categorical checks) flags adjacent
  steps below its normal-vision ΔE floor of 15, which is expected for a 6-step one-hue ramp; the redundant encodings
  are the reason it is acceptable. The lightest light-theme step is 2.2:1 against white, so each disc has a ring in
  the surface colour.
- **Slab2** depth contours every 20 km (100 km steps stronger), coloured with the same depth classes. In the
  cross-section, the crossings of each contour with the profile line make one polyline per slab.
- **Statistics for the region** (cells whose centre is in the box): events per depth class (table with bars, which
  doubles as the colour legend) and, for shallow and deeper separately, every cell with a b-value (quality A or B)
  as an interval row with its value, interval and quality, linked to the cell on the map. Counts of C and
  insufficient cells are given. Nothing is re-estimated in the browser; the values come from `cells.geojson`.
- Controls: region, view (3D or cross-section), M 5–6 events, depth exaggeration (1–20, automatic by default: the box
  about a third as tall as it is wide), Slab2 on or off, reset view. URL keys: `p3` (preset), `m3=xs`, `e3=5`, `x3`
  (exaggeration, 0 or absent = automatic), `s3=0`.
- Interaction: drag to orbit, Shift-drag or right-drag to pan, wheel or pinch to zoom; on the focused canvas, arrows
  orbit, Shift + arrows pan, + and − zoom, 0 or Home resets. Hovering an event shows magnitude, date, depth and
  magnitude type. The depth axis is labelled in km on the vertical edge nearest the viewer.
- Phones: controls in two columns above the scene; the scene works with touch; the cross-section is one tap away.
- **Without WebGL 2** the view says so and shows the cross-section, with the same statistics.

### Slab2 data

| | |
|---|---|
| Model | USGS Slab2: Hayes, G.P., Moore, G.L., Portner, D.E., Hearne, M., Flamme, H., Furtney, M., Smoczyk, G.M. (2018), Slab2, a comprehensive subduction zone geometry model, *Science* 362, 58–61, doi:10.1126/science.aat4723 |
| Data release | Hayes, G. (2018), Slab2 – A Comprehensive Subduction Zone Geometry Model, U.S. Geological Survey data release, doi:10.5066/F7PV6JNV |
| Licence | U.S. Government work, public domain (USGS data releases carry no copyright; credit requested) |
| Files used | depth contours (`*_slab2_dep_*_contours.in`): `kur` Kuril–Japan, `izu` Izu–Bonin, `ryu` Ryukyu (Japan); `sam` South America (Chile); `ker` Kermadec–Tonga (Tonga); `hin` Hindu Kush and `pam` Pamir (Hindu Kush–Pamir); `cal` Calabria (Italy). Iceland has no subducting slab. |
| Output | `site/data/slab2/<preset>.json`, 51 kB in total (Japan 16 kB, Chile 17 kB, Tonga 11 kB, Hindu Kush–Pamir 4 kB, Italy 4 kB): contours cut to the preset box plus 1°, simplified (0.02°), rounded to 0.01°, longitudes continuous around the box centre |
| Script | `scripts/basemap/build_slab2.py`; SHA-256 of each source file in `scripts/basemap/slab2_sha256.json` |

**Where the files come from.** The official ScienceBase item (catalog item `5aa1b00ee4b0b1c392e86467`) is behind an
interactive browser check that answers scripted requests with HTTP 403, so a reproducible script cannot download
from it. The contour files are read unchanged from a public mirror of the release in the repository
`ndb38/arc-metals` (pinned commit `543bf32cabaa97384a28c0b83304975be4079ddb`,
`1_arc-metals/supporting_datasets/Hayes2018/Slab2_CONTOURS/`), whose README is the Slab2 distribution README.
Checks: the file names are those of the release; the git blob hashes of `izu` and `ryu` are identical in the
independent mirror `Oboue/4dssmtzimaging`, and those of `hin` and `pam` in `chelle0425/IntPyGMT`; the script
verifies the SHA-256 of each file. Anyone with browser access to ScienceBase can replace the mirror URL and compare
the hashes.

### Library: three.js 0.170.0

| Option | Size | Licence | Below-surface geometry | Verdict |
|---|---|---|---|---|
| **three.js 0.170.0** (`three.module.min.js`) | 692 kB (172 kB gzip), one ES module | MIT | Any coordinates; the scene is a plain 3D box in km | **chosen** |
| deck.gl with MapLibre | 1.44 MB for the `deck.gl@9.1.0` `dist.min.js` bundle alone | MIT | Negative z is possible, but in interleaved mode below-surface points are depth-tested against the map and hidden; an OrbitView without the map works but duplicates what three.js gives | not chosen |
| CesiumJS | 5.1 MB for `cesium@1.124.0` `Cesium.js`, plus workers and assets | Apache-2.0 | Yes (globe with depth), as the GFZ explorer uses | too heavy for a static atlas page |

three.js is loaded only when the Depth 3D view opens (`import()`), from `site/vendor/three-0.170.0/` (source:
https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js, SHA-256
`08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7`; npm `three@0.170.0`, licence MIT, `LICENSE`
included). Version 0.170 is the last release whose `three.module.min.js` is a single file (0.171 split out
`three.core.js`). The orbit control is a small custom one (spherical coordinates, clamped elevation) instead of the
`OrbitControls` add-on, because the add-on imports the bare specifier `three` (it would need an import map) and has
no keyboard orbit.

### Prior art

- **GFZ "3D Earthquake Explorer"** (helmholtz.software/software/3d-earthquake-explorer; EUPL-1.2) and the EGU26 abstract
  **EGU26-16635**, "Earthquake Explorer goes 3D: A Browser-Based Tool for Interactive Earthquake Visualization"
  (Meeßen, Volk, Brinckmann, Saul, Tilmann): CesiumJS, events from FDSN web services as magnitude-scaled spheres
  textured with their moment tensors (beachballs) at the hypocentre. Only the abstract and the project page were read;
  no code was looked at or reused.
- The niche here is different: a fixed, citable catalogue snapshot, the Slab2 surface, and the **atlas statistics for
  the same region next to the depth picture** (events per depth class and the shallow / deeper cell b-values with
  their intervals), without focal mechanisms or live data.

## Sizes, all new site files

| Files | Size |
|---|---|
| `site/data/basemap/relief/` (283 tiles + index) | 3.75 MB |
| `site/data/basemap/water.geojson` | 251 kB |
| `site/data/slab2/` (5 files) | 51 kB |
| `site/vendor/three-0.170.0/` | 692 kB |
| `site/js/basemap.js`, `hashx.js`, `depth3d.js`, `depth3d-scene.js`, `site/css/terrain3d.css` | 62 kB |
| **Total** | **about 4.8 MB** |

Start-up adds about 0.45 MB (uncompressed) at the default view: the relief index and tiles of the visible zoom, the
water file, and the small modules above. three.js, Slab2 and the M5 events load only in the Depth 3D view.

## Not tested

- The real AWS terrain in the browser tests: the tests use a synthetic tile. Real tiles were checked by hand once
  (Chromium, 2026-11-14, Himalaya at zoom 5: terrain, tilt, hillshade and the credits box shown, no console errors).
- Terrain on the globe at very low pitch while dragging (the MapLibre fix #7736 is not in 5.24.0).
- Very old GPUs and screen readers on the 3D canvas (it has a label and keyboard control, and the depth table and
  b-value rows carry the same information as text).
