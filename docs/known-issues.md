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
  b against cutoff when present; it has no catalogue-agreement section. The regional contract was tested only with a
  synthetic fixture (`tests/e2e/fixtures/regional/`), not with a real regional catalogue.
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
