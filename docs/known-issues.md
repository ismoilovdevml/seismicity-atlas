# Known issues

Status of the website (phase 2) on 2026-11-13. Data issues are documented here, not patched in the pipeline.

## Data (`site/data/`)

- **Fixed in the pipeline:** `rate_iscgem_above_thr` is now `null` outside 1976–2021 (it was 0), and
  `events_m5.json` now carries the `id` column. The site's own masking and M ≥ 6 id merge still work and can be
  simplified.
- **ISC-GEM-only events use `iscgem…` ids.** One was checked and resolves on the USGS event page
  (`iscgem610326271`, HTTP 200). The other 7,126 were not checked one by one.
- **b-positive above b (`sh_bpos` > `sh_b`).** In shown shallow cells the median gap is +0.046, and b-positive
  lies inside the b interval in 64.9 % of them. This is expected, not a bug (`bpositive.md`):
  - The direct-Mw b sample lacks many early aftershocks. b-positive partly corrects for that, Aki-Utsu b cannot.
  - Outside subduction zones the magnitude distribution likely bends at large M.

  Floors and estimators were tested and left unchanged.
- **0.1 binning of 0.01 magnitudes.** `seislib.bin_mag` rounds 74 % of magnitudes that end in 5 down (floating
  point and half-to-even rounding). That shifts the effective bin edges by about +0.002 and lowers every Aki-Utsu
  b by about 0.006 (global shallow direct b: 1.035 binned, 1.041 on the 0.01 values). This is within the global
  interval (±0.017). b-positive is unaffected. It was not changed because the fix would move every published b;
  it is a candidate for a future version bump.

## Website

Status on 2026-11-13 (branch with the browser suite, comparison, CSV, regional layers and languages).

- **Browsers.** `tests/e2e/` runs in Chromium (Chrome for Testing), Firefox and WebKit (Playwright 1.65.1) at
  1440 × 900 and 390 × 844. Real Safari, Edge, Samsung Internet and physical phones were not tested. CI runs Chromium
  as a required job and Firefox and WebKit as optional jobs.
- **WebKit keyboard.** As in Safari, plain Tab reaches only text fields; buttons, radios and checkboxes are reached with
  Option+Tab (or with "Press Tab to highlight each item" turned on). The test uses Alt+Tab in WebKit.
- **Benign browser messages.** Chromium logs GPU "ReadPixels"/"READ-usage buffer" warnings in headless mode, and
  Firefox and Chromium can report "ResizeObserver loop completed with undelivered notifications" while the panel or a
  chart resizes. Both are ignored by the tests; neither comes from a failed operation.
- **Regional index probe.** The site always requests `data/regional/index.json`. Until that file exists the request
  returns 404 (visible in the browser console as a failed resource) and the regional control stays hidden.
- **Regional layer scope.** Regional cells are always drawn with the b-value classes and quality rules, whatever the
  global layer; the legend says so. Mc, agreement and rate are not drawn for regional cells, because their scales are
  for teleseismic catalogues. The regional panel shows b, Mc, the FMD of every `fmd*` series in the detail file and
  b against cutoff when present; it has no catalogue-agreement section. Regional detail files use the keys `fmd`,
  `mc_t`, `mc_periods`, `b_cutoff`, `rate_years`, `rate_above_thr`, `rate_all` and `stats` (one catalogue per
  region); regional cell properties carry no Mc, so the Mc tile is filled from `stats.mc` once the detail file has
  loaded. The panel and the legend show the index fields `catalogue`, `magtype`, `licence`, `period`, `radius_km`,
  `attribution`, `caveat` and `source_url`. The committed tests use a synthetic fixture
  (`tests/e2e/fixtures/regional/`); the four real regional catalogues (Italy, New Zealand, southern California,
  Iceland) were checked locally from a temporary copy in Chromium, Firefox and WebKit (every region drew its cells and
  opened a quality A/B cell with 5 charts and the caveat, no page errors) but are not part of this branch.
- **Validation table.** Long "this atlas" values (over 32 characters) and verdict notes wrap inside the table card;
  verdicts "description only" and "robust" have their own labels. Tested with a synthetic table of long rows, not with
  the final 43-row table from the science branch.
- **Comparison.** The verdict reads only the two 95 % intervals ("overlap", "do not overlap", or "no comparison"
  when either cell has no b). Touching intervals count as overlapping. It is a conservative check, not a formal test,
  and the text says so; it also notes when the two sampling circles share events.
- **Translations.** Uzbek (Latin), Russian and Spanish strings were written for this release and checked
  automatically (every key present, the same placeholders) but have not yet been reviewed by native-speaking
  seismologists. Data-file text (validation-table rows, the disclaimer in `manifest.json`, place names, magnitude-type
  codes) stays in English. On phones a long Russian title is cut with an ellipsis.
- **Numbers.** Decimals always use a point, because intervals are written "0.98 [0.85, 1.12]". Thousands use a comma
  in English and a narrow no-break space in the other languages. Dates stay ISO 8601.
- **M5 event links.** When `events_m5.json` has an `id` column (same meaning as in `events_m6.json`), M5 events link to
  the USGS event page; without it the popup says that the event has no id. Both cases are tested; the second with a
  test-only copy of the file that adds ids.
- **Social card.** `site/og-image.png` is rendered from the map by `tests/e2e/tools/og_image.py` and must be
  re-rendered by hand when the data change; the link preview was checked only as metadata, not in the apps that show
  previews.
- Documentation links ("docs/method.md in the project repository") point to the public repository on GitHub.
- Map labels (place names) are intentionally absent: no glyph server or third-party tiles are used.
- The map position (`at=` in the URL) is written after the first move or resize, so an untouched first load has a
  shorter URL.
- The map object is no longer exposed with `?debug`. The tests define `window.__gsaTestHook` in an init script before
  the page loads; normal visits never define it (tested: `?debug` leaves `window.__map` undefined).
- Contrast was computed for the main text tokens (all ≥ 5.6:1 in both themes). Map fill colours were not checked
  against WCAG non-text contrast; the hover tooltip, legend counts and the cell table give the values without
  colour.
- CI (GitHub Actions, Ubuntu, headless Firefox without a GPU): the cell-comparison tests log a bare
  `console.error: Error` at teardown. The same tests pass in Firefox on macOS (5/5 locally, 2026-11-13), so this looks
  specific to the runner's WebGL setup. Firefox and WebKit jobs are `continue-on-error`; Chromium is the required job.

## Simple view (v0.3)

- **Gazetteer coverage.** The place search knows the 7,342 places of Natural Earth 1:10m Populated Places (capitals,
  regional capitals and larger towns). Villages, streets and postcodes are not found; clicking the map works anywhere.
  Natural Earth has no Uzbek names, so Uzbek visitors search with the Latin name as published (for example
  "Tashkent"; "Samarqand" and "Andijon" work through Natural Earth's ASCII and alternative names). Russian and Spanish
  names match when Natural Earth has them. Some Natural Earth alternative names are truncated in the source (for
  example "Ciudad de M"); they are used for matching only and never shown.
- **Counting radius.** Place counts use great-circle distance on a sphere of radius 6,371 km to the epicentre. The
  100 km and 300 km circles are drawn the same way; at high latitudes they look stretched on the Mercator map.
- **Magnitudes in the place card.** The card counts the events of `events_m6.json`, which mixes ISC-GEM Mw and
  ComCat magnitude types (the map tooltip and the event popup name the type). It always counts M6+ and M7+, whatever
  the magnitude control shows. The years follow the Years control.
- **M5+ before 1973.** `events_m5.json` has few M5 events before 1973 (ComCat starts in 1973; ISC-GEM is complete for
  M5 only in places). The legend says so when M5+ is chosen with all years.
- **Recording rating.** It uses the shallow statistics of one cell and the global shallow Mc; it is not computed for
  deeper events, and it describes global catalogues, not local networks. The mapping is in `docs/learn.md`.
- **Density shading.** A MapLibre heatmap of the drawn events: its look depends on zoom (radius in pixels) and on the
  filter. It has no numeric scale on purpose (it is not a rate or hazard surface); the Scientist view has the M6+ rate
  per 100,000 km² per year.
- **Tested.** `tests/e2e/test_simple.py` (26 tests) passes in Chromium, Firefox and WebKit, and the whole suite
  (117 tests) in Chromium, on 2026-11-14. The older tests run in the Scientist view through the `mode="pro"`
  default of the test fixture.
- **Not tested.** Screen readers (VoiceOver, NVDA, TalkBack) on the search combobox and the bottom sheet; a swipe to
  resize the bottom sheet (it scrolls, it does not drag); real phones; right-to-left languages (none offered).

## Relief, 3D terrain and the Depth 3D view

Status on 2026-11-14 (branch `feat/terrain3d`); details in [basemap.md](basemap.md).

- **Relief resolution.** The Natural Earth relief tiles stop at zoom 4 (to keep the site small) and are upsampled at
  zoom 5–8, where they look soft. Turning on 3D terrain replaces them with a hillshade of the elevation tiles.
- **Relief under cells.** Relief, lakes and rivers are drawn under the cell layer on purpose, so cell colours are
  exact. Under quality A cells (opacity 0.92) the relief is only a faint texture; choose "No cell layer" to see it.
- **3D terrain is external.** It loads AWS Terrain Tiles and works only online; the browser tests use a synthetic
  tile, so the real service is not covered by CI. The MapLibre changelog lists a fix after 5.24.0 for a camera jump
  on drag with globe + terrain at low pitch (#7736); not reproduced here, not tested.
- **Terrain and the URL.** The map position in the URL keeps zoom and centre but not pitch or bearing; a link with
  `tr=1` opens at the default 55° tilt, north up.
- **Slab2 source.** The Slab2 contours were taken from a public mirror (hashes cross-checked against two other
  mirrors) because the ScienceBase download blocks scripted access. They were not compared byte for byte with the
  official files.
- **Depth 3D events.** The events are all catalogued events in the box (M ≥ 6, or M ≥ 5 on request), also below
  completeness and with catalogue depths as published; ISC-GEM fixed depths (for example 10, 15 or 35 km) appear
  as flat layers. The per-depth counts are counts, not rates.
- **Depth 3D colours.** The one-hue depth ramp has adjacent steps that are hard to tell apart by colour alone (by
  design, as for any 6-step one-hue ramp); depth is also the vertical position, and the classes are listed in the
  legend and the depth table.
- **Depth 3D accessibility.** The canvas has a label and keyboard orbit, and the statistics are HTML tables and
  lists. Screen readers were not tested. Very large boxes with M ≥ 5 (tens of thousands of points) were checked only
  in Chromium on an Apple M-series laptop.
- **WebGL 2.** three.js 0.170 needs WebGL 2; without it the view shows the cross-section (tested by disabling WebGL in
  the browser test, not on a real old device).
