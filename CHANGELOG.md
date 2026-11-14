# Changelog

Versions follow `scripts/release.json` (shown on the site from `site/data/manifest.json`). A patch is a data refresh
with the same schema, a minor version a method, schema or website change; see [docs/release.md](docs/release.md).

## 0.3.0 (2026-11-14)

Website release. Method and data cut-off are those of 0.2.0.

- Two modes: a Simple view for everyone (earthquake dots coloured by depth, a density shading, offline place search,
  a place card with counts, the largest and latest event and a recording rating) and the Scientist view (the 0.2
  interface). Links made before 0.3 open in the Scientist view.
- Globe projection by default in both modes, turned to the visitor's longitude from the time-zone offset. The flat
  map stays one button away; the choice is stored in the browser (`gsa-proj`) and always written to the URL (`g=1`
  or `g=0`). A link without `g` opens in the stored choice, else on the globe.
- Learn: one page per concept in English, Uzbek, Russian and Spanish, with real-data examples and diagrams, opened by
  (i) buttons next to the labels.
- Sequence Monitor ("Ongoing", "Recent big quakes" in the Simple view): M ≥ 7 mainshocks of the last 365 days,
  updated daily by a workflow; descriptive only.
- Base map: shaded relief, lakes and rivers; optional 3D terrain; the Depth 3D view with Slab2.
- The Simple view no longer loads `cells.geojson`; the place card reads `rating.json` (`scripts/build_rating.py`),
  and the cells load with the Scientist view or Depth 3D.
- Place search ranks by match quality, then population ("San" lists Santiago, San Francisco and San Diego before
  San, Mali); visible loading and error states for the place list and the rating.
- Wider coastline when zoomed in, a title on the globe button and a globe hint in the first-visit tip.

## 0.2.0 (2026-11-13)

- b from direct-Mw ISC-GEM events only (magnitude uncertainty ≤ 0.10); proxy Mw converted from Ms and mb is left out
  of every b. Global shallow b 1.043 → 1.035, deeper 0.969 → 0.936; trusted shallow cells 204 → 170.
- The Kagan (2010) and Kagan & Jackson (2013) comparisons now match.
- `manifest.json` → `method` gains `b_sample` and `b_magerr_max`.

## 0.1.0 (2026-11-13)

- First release: catalogue fetch and preparation (ISC-GEM, USGS ComCat), H3 resolution 2 cells with a 300 km sample
  radius, Mc, b with bootstrap 95 % intervals and quality codes, ISC-GEM vs ComCat consistency, Omori-Utsu fits for
  40 sequences, validation against published values, figures, and the static website (map, cell panel, comparison,
  sequences, validation and about pages) on GitHub Pages.
