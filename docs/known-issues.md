# Known issues

Status of the website (phase 2) on 2026-11-13. Data issues are documented here, not patched in the pipeline.

## Data (`site/data/`)

- **ISC-GEM yearly counts outside 1976–2021 are 0, not null.** `cells/<id>.json` → `rate_iscgem_above_thr` covers
  1973–2026, but ISC-GEM b-period events exist only for 1976–2021, so 1973–1975 and 2022–2026 are written as 0.
  The site masks those years as "no data" using the b period from `manifest.json` (`method.b_catalogue`).
  Suggested fix in the pipeline: write `null` outside the period.
- **`events_m5.json` has no event ids.** Events of M 5.0–5.9 therefore cannot link to a USGS event page. The site
  merges `events_m6.json` (with ids) for M ≥ 6 and says so in the popup. Suggested fix: add the `id` column.
- **ISC-GEM-only events use `iscgem…` ids.** One was checked and resolves on the USGS event page
  (`iscgem610326271`, HTTP 200). The other 7,126 were not checked one by one.

## Website

- Tested in Chromium only (Playwright with Chrome for Testing). Firefox and Safari were not tested.
- The browser test log shows Chrome GPU "READ-usage buffer" performance warnings while screenshots are taken.
  They come from the headless WebGL driver, not from the site's code; there are no page errors.
- In globe view the area around the globe has almost the same colour as the ocean, so the globe edge is faint.
- Documentation links ("docs/method.md in the project repository") are plain text: the repository has no public
  URL yet. Add links when it is published.
- Map labels (place names) are intentionally absent: no glyph server or third-party tiles are used.
- The map position (`at=` in the URL) is written after the first move or resize, so an untouched first load has a
  shorter URL.
- `?debug` in the URL exposes the MapLibre map object as `window.__map`; it is used by the browser tests only.
- Contrast was computed for the main text tokens (all ≥ 5.6:1 in both themes). Map fill colours were not checked
  against WCAG non-text contrast; the hover tooltip, legend counts and the cell table give the values without
  colour.
