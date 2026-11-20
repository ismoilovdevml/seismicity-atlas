# Learn: concept pages

The **Learn** view (`#v=learn`) explains every label and metric of the atlas. Each concept page has the same
structure: one sentence, a simple explanation with an everyday picture, a **real example read from `site/data`
at run time**, an interactive diagram, technical details, further reading and previous/next navigation.
A concept page is `#v=learn&t=<concept-id>`; the index is `#v=learn`.

The (i) buttons that open these pages from the rest of the site are listed in the table at the end.

## Files

| Path | What it holds |
|---|---|
| `site/js/info.js` | `infoButton(id)`, `withInfo(el, id)`, `infoKey(items)`: the (i) buttons, accessible name "About <concept>" |
| `site/js/info-rail.js` | places the buttons in the static map controls and the disclaimer |
| `tests/e2e/test_info.py` | browser tests of every button |
| `site/js/learn/registry.js` | `CONCEPTS` (id, group, diagram) in reading order and `GROUPS` |
| `site/js/learn/view.js` | `renderLearn(root, {topic, back})`: index and concept pages, language fallback, placeholder filling |
| `site/js/learn/examples.js` | one loader per concept: `{vars, map, data}` read from `site/data` |
| `site/js/learn/refs.js` | further reading per concept (language-independent) |
| `site/js/learn/kit.js` | SVG frame, sliders, toggles, the animation driver, seeded random numbers, estimators |
| `site/js/learn/diagrams/<diagram>.js` | one module per diagram, `mount(el, {dg, ex, vars})` returns a cleanup function |
| `site/js/learn/content/<lang>/_index.js` | titles and one-line summaries for the index |
| `site/js/learn/content/<lang>/<id>.js` | the text of one concept in one language |
| `site/css/learn.css` | Learn styles (tokens from `app.css`) |
| `site/js/i18n/<lang>.js`, block `// learn` | interface strings of the Learn view |
| `tests/e2e/test_learn.py` | browser tests |

Shared-file hooks of the Learn view itself are small: `app.js` registers the `learn` view, the `t` hash parameter, a
remembered return hash and a dynamic `import('./learn/view.js')`; `index.html` adds one nav link, one section and
one stylesheet link. Nothing under `site/js/learn/` is fetched on a first visit to the map (covered by a test).

## Concept registry

Groups: **Magnitudes**, **Completeness & b-value**, **Uncertainty & quality**, **Sequences**, **Space & tectonics**,
**Data & caveats**, **Case studies and budgets** (v0.3.1). Languages: all 21 concepts are complete in English, Uzbek
(Latin), Russian and Spanish.

| # | Concept id | Group | Diagram (module) | Real example: data and selection rule |
|---|---|---|---|---|
| 1 | `magnitude-types` | magnitudes | Saturation of mb, ML, Ms against Mw, schematic (`saturation`) | `events_m6.json` magnitude-type counts (`mt`); the Tohoku sequence in `sequences.json` |
| 2 | `direct-vs-proxy-mw` | magnitudes | Global b by cutoff for converted mb, ComCat as served and ISC-GEM (`proxy-b`) | `global.json` `b_cutoff_2004_2021`; `manifest.json` `global`, `method.b_sample` |
| 3 | `magnitude-of-completeness` | completeness | Mc slider greys out incomplete bins and recomputes b (`mc-slider`) | main cell*; `manifest.json` floors; `regional/index.json` (Italy) |
| 4 | `frequency-magnitude-distribution` | completeness | Per-bin vs cumulative, linear vs log (`fmd-views`) | main cell* FMD (`cells/<id>.json`) |
| 5 | `gutenberg-richter-b-value` | completeness | b slider pivots the G-R line on the real cumulative FMD (`b-pivot`) | main cell*; global shallow/deep b from `manifest.json` |
| 6 | `confidence-interval-bootstrap` | uncertainty | Bootstrap replicates build a histogram, then the 95 % band (animated) (`bootstrap`) | main cell*; `manifest.json` `nboot` |
| 7 | `quality-codes` | uncertainty | Events slider moves the interval width across the A/B/C zones; real cells as dots (`quality-width`) | `cells.geojson`: counts per code; the A and B cells with most events, the C and insufficient cells with most events in the circle; thresholds from `manifest.json` `method.quality` |
| 8 | `b-positive` | uncertainty | Synthetic catalogue: incompleteness after a large event lowers classic b, not b⁺ (`b-positive`) | main cell* `sh_bpos`; share of shown cells with b⁺ inside the b interval, median b⁺ − b |
| 9 | `declustering` | sequences | Gardner-Knopoff windows open one by one; window-scale slider (animated) (`decluster`) | main cell* `sh_bdecl`; median declustered − full over shown cells |
| 10 | `omori-utsu` | sequences | Real Tohoku rates on log-log axes, p and c sliders, animated aftershock strip (`omori`) | `sequences.json`, the sequence whose name contains "Tohoku" (else the largest quality-A one); `synthetic_check` |
| 11 | `aftershock-productivity-bath` | sequences | Mainshock minus largest aftershock for all sequences vs Båth's 1.2, Reasenberg-Jones count (`bath`) | `sequences.json` + largest later event in `events_m6.json` within each sequence radius and one year |
| 12 | `h3-cells-and-sample-radius` | space | Hexagon and circle to scale, global vs regional resolutions, radius slider (`h3-circle`) | main cell* `area_km2`; `manifest.json` radius and grid; median `area_km2` of the smallest regional file per resolution |
| 13 | `plate-boundary-classes` | space | b with 95 % interval per PB2002 class, selectable (`plate-classes`) | `global.json` `plate_boundary_types` |
| 14 | `depth-and-slabs` | space | Tonga cross-section of real hypocentres, year by year (animated) (`slab-section`) | `events_m6.json`, 16–24° S, 172° E–170° W; global shallow/deep b |
| 15 | `rate-m6` | space | Histogram of cell rates on a log axis, threshold slider (`rate`) | `cells.geojson` `rate_m6`; main cell* |
| 16 | `catalogue-consistency` | caveats | Histogram of per-cell ΔMw or Δmb (`consistency`) | `cells.geojson` `c_*`; the "ok" cell with most matched pairs |
| 17 | `regional-catalogues` | caveats | Magnitude ladder: regional typical Mc against the global floor (`regional-ladder`) | `regional/index.json`; latest shallow floor from `manifest.json` |
| 18 | `not-a-forecast` | caveats | Real yearly counts next to a random history with the same mean (animated) (`poisson`) | main cell* `rate_comcat_m45` yearly counts (`cells/<id>.json`) |
| 19 | `recording-rating` | caveats | Quality code, catalogue check and Mc controls give the rating; bars count the real cells per rating, with a data table (`rating-ladder`) | `cells.geojson` through `recordingRating()` (`places.js`), the same function as the place card; the Very good cell with most events above threshold, the Limited cell with most events; global shallow Mc from `manifest.json` |
| 20 | `induced-seismicity` | applied | Groningen annual production against the earthquakes of the same, next or second year, with the Spearman ρ recomputed for the chosen lag; play adds the years (`induced-lag`) | `induced/groningen/rates.json`: phase rates with intervals, peak production, correlations; the example button opens the Case studies view |
| 21 | `seismic-moment-budget` | applied | Geodetic budget of the whole Tien Shan belt against a seeded, fully coupled synthetic catalogue (observed Mw ≥ 6 rate, belt b, balancing corner magnitude); catalogue-length slider and a table of 200 histories (`moment-budget`) | `deficit/index.json`: whole-belt and central ratios, always with 95 % interval and p_full; the example button opens the map with the deficit layer |

\* **Main cell**: the shallow quality-A cell with the most events above threshold inside the Tonga-Kermadec box
(14–38° S, 172° E–170° W); if there is none, the quality-A cell with the most events anywhere. Selection is by rule,
so the examples survive the monthly refresh; all numbers in the example text are placeholders filled from the data.

**Synthetic diagrams** (`saturation`, `b-positive`, `decluster`, the strip of the `omori` diagram, the random row of
`poisson`, `moment-budget`) say so in their captions and use seeded random numbers, so they look the same on every visit.

**Numbers in the text.** Every result number on a page is a `{placeholder}` filled from `site/data`. The text itself
contains only method constants that are documented in `docs/method.md` and `docs/data-schema.md` (for example
MAXC + 0.2, the 70 km depth split, the Gardner-Knopoff window formulas, 1964–2021 for the rate).

**Further reading.** The v0.3.1 concepts cite works named in `docs/induced.md` and `docs/deficit.md` (Dost et al. 2017,
Bourne et al. 2014, Kraaijpoel et al. 2022, Gulia & Wiemer 2026, the KNMI network DOI, Savage & Simpson 1997, Molnar &
Ghose 2000, Kagan 2002, Bird & Kagan 2004, Chang et al. 2025, Ou et al. 2026); their DOIs were checked against Crossref
(DataCite for the two data DOIs) on 2026-11-15. All references are cited in `docs/*.md` or the README, except **Båth (1965)**,
doi:10.1016/0040-1951(65)90003-X, and **Hayes et al. (2018, Slab2)**, doi:10.1126/science.aat4723, which were added
for Learn. All DOIs except the CORSSA one (DataCite, taken from `docs/prior-work.md`) were checked against Crossref on
2026-11-14.

## Adding a concept

1. Add `{ id, group, diagram }` to `CONCEPTS` in `registry.js`, at the place it should appear in the reading order.
   Ids are stable kebab-case; they appear in URLs and in the (i) buttons, so never rename one.
2. Add a loader to `EXAMPLES` in `examples.js` returning `{ vars, map, data }`. Choose the example by a rule, format
   every number with `fmt.js`, and build the map link with `mapHash()` (no language: the current one is kept).
3. Write `diagrams/<name>.js` (or reuse one) with `figure()`, `frame()`, `slider()`, `toggle()` and, for motion,
   `animator()` from `kit.js`. Give every control a `name` (used as `data-ctl` by tests), keep a text readout in
   `fig.say()`, and add `fig.table()` where the diagram shows data. Never start motion under reduced motion:
   `animator().start()` already draws the final frame instead.
4. Write `content/en/<id>.js` with `sentence`, `simple[]`, `analogy`, `example {title, body[]}`, `diagram {...}` and
   `tech[]`, and add the title and summary to `content/en/_index.js`. HTML is allowed in content (trusted); data values
   only enter through `{placeholders}`, which are escaped.
5. Add references to `refs.js` (only works cited in `docs/`; check the DOI).
6. Translate into `uz`, `ru`, `es` with the same keys and placeholders, and add the id to each `_index.js`. A language
   whose `_index.js` lacks the id shows the English page with a "translation pending" note, never an empty page.
7. Add `learn.c.<id>` (the title, used in the buttons' "About …" name) to the `// learn` block of every i18n file.
8. Add the id to `CONCEPTS` in `tests/e2e/test_learn.py`, place buttons where the concept is shown (update the
   table below and `VIEWS` in `tests/e2e/test_info.py`) and run the tests.

## Languages

The page follows the interface language (`lang` in the hash, else `localStorage['gsa-lang']`, else the browser).
Interface strings are in the `// learn` block of `site/js/i18n/<lang>.js`; concept text in `content/<lang>/`.
Scientific symbols (b, Mc, Mw, mb, MAXC) and catalogue names stay untranslated; place names inside examples come from
the data in English.

**Release 0.5.0 text changes.** `quality-codes` (relative interval width (hi − lo) / b, a new technical paragraph on
why, the diagram on a width / b axis) and `confidence-interval-bootstrap` (a paragraph on why 1000 replicates) were
changed in English first and then in Uzbek, Russian and Spanish with the same keys and placeholders, as were the
interface strings of the quality legend, the C-cell tooltip and panel text, and the validation verdicts and data
groups. The three translations were written by the maintainer's assistant, not by a native-speaker reviewer:
**native review pending** for these strings (uz most of all).

## Tests

```
E2E_BROWSERS=chromium,firefox,webkit python -m pytest tests/e2e/test_learn.py -q
```

They check the registry, the index, every concept in all four languages (no unfilled placeholder, no error, no
pending note, diagram and map link present), the diagram controls (including keyboard on a slider), reduced motion,
the info button, "Back to where I was", "Show this on the map", language persistence across links and reloads, an
unknown id, and that the map's first load does not fetch Learn code.

## Info buttons: where each (i) points

`infoButton(id)` (`site/js/info.js`) is a `<button>` with the accessible name "About <concept title>" in the current
language (`learn.about` and `learn.c.<id>` in the `// learn` block of each i18n file), a 24 × 24 px target and a
16 px icon. Clicking it (or Enter/Space) sets `#v=learn&t=<id>`; `app.js` remembers the previous hash, and the Learn
page's "Back to where I was" restores it exactly (view, layer, depth, cell, comparison, map position, sequence).
Buttons in the static map controls are placed by `site/js/info-rail.js` and relabelled on a language change.

**Placement rules** (checked against the ui-ux-pro-max guidance: consistent position of help, web target ≥ 24 px,
≥ 8 px from the next target, no clutter):

- the button sits right after the label or heading it explains, never next to each number;
- at most one button per concept per block (control group, legend, panel section, card, notice). A concept can
  appear in two blocks of one view, for example b in the panel summary and again on the "b against cutoff" chart;
- list pages with many cards (Sequences, Ongoing) get one key strip of terms above the cards (`infoKey`), not a
  button on every card;
- tooltips get none (hover-only, too small); the cell panel that a click opens carries the same terms.

### Counts per view (desktop, measured)

| View | Buttons |
|---|---|
| Disclaimer strip (every view) | 1 |
| Map controls (rail) | 11 (v0.3.1: `seismic-moment-budget` next to the deficit overlay) |
| Legend (b layer with plates and events on; regional block when a region is chosen) | 1 title + 1 per overlay or region block (3 with plates and events) |
| Cell panel (global cell, with charts) | 12 |
| Comparison verdict | 2 (3 when the cells come from different catalogues) |
| Sequences | 3 (key strip) |
| Ongoing (Sequence Monitor) | 7 (notice + key strip of 6) |
| Depth 3D | 4 |
| Validation | 10 |
| About | 2 |
| Case studies (v0.3.1) | 6: `induced-seismicity` (title), `not-a-forecast` (notice), `confidence-interval-bootstrap` (phase rates), `b-positive` (b by phase, moving b-positive), `gutenberg-richter-b-value` (b map) |
| Deficit legend block and panel (v0.3.1) | 1 each: `seismic-moment-budget` |

### Simple view (v0.3: `simple.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| Legend title "Earthquakes M6+, 1904–2026" | `sx.lgTitle` | `magnitude-types` |
| Legend shading line ("Not a hazard map") | `sx.lgHeat` | `not-a-forecast` |
| Legend plate boundaries (when shown) | `sx.lgPlates` | `plate-boundary-classes` |
| Place card "How well are earthquakes recorded here?" | `sx.rateHead` | `recording-rating` |
| Disclaimer strip (shared) | `disc.strong` | `not-a-forecast` |

Four buttons in the Simple map view (five with the disclaimer), against 10 in the Scientist rail: the Simple view
keeps only the concepts a non-specialist meets on that screen. Search, the controls and the counts have none.

### The recording rating (Simple view, "How well are earthquakes recorded here?")

`recordingRating(cell, globalMc)` in `site/js/places.js` reads the **shallow (≤ 70 km)** statistics of the cell that
contains the place (point in hexagon, trying the longitude ± 360° for cells that cross the antimeridian; the nearest
cell centre if no hexagon contains it). `globalMc` is `manifest.json` `global.b_shallow_1976_2021.mc` (5.3 in 0.6.0; 5.2 in v0.2.0).
The rules are checked in this order:

| Rating | Card word | Condition |
|---|---|---|
| `few` | Too little data | `sh_q` is `insufficient` (fewer than 50 events above Mc, `method.quality.insufficient`) |
| `limited` | Limited | `sh_q` is `C`, or `c_flag` is `check` (ISC-GEM and ComCat disagree) |
| `vgood` | Very good | `sh_q` is `A`, `c_flag` is `ok` and `sh_mc` ≤ global shallow Mc + 0.2 (5.5 in 0.6.0; 5.4 in v0.2.0) |
| `good` | Good | every other `A` or `B` cell (B, or A with `c_flag` `few` or a higher Mc) |

In v0.2.0 this gives, over 2,598 cells: 56 Very good, 114 Good, 54 Limited, 2,374 Too little data (computed by the
browser test from `cells.geojson`; no cell has `c_flag` `check` and quality A or B). In 0.6.0 (`rating.json`): 32 Very good, 104 Good, 62 Limited,
2,400 Too little data. The cutoff-stability flag
(`sh_unstable`) and the deeper statistics are not used; the Scientist view shows them. The card prints the three
inputs under the word ("quality B, Mc 5.2, ISC-GEM and ComCat agree"), and its (i) opens the Learn page with the same
table. The rating describes the global catalogue at a few hundred kilometres, not local networks, and is not a hazard
or risk estimate.

Since v0.3.0 the place card reads the rating from `site/data/rating.json`, which `scripts/build_rating.py` computes
from `cells.geojson` with this rule and the manifest's global shallow Mc, together with the three inputs, the cell's
area and its hexagon, so the Simple view does not load `cells.geojson`. `tests/test_rating.py` checks that the file
is up to date and the rule branch by branch; `tests/e2e/test_v03.py` checks every cell against `recordingRating()`.

### Map controls (`index.html`, placed by `info-rail.js`)

| UI element | Selector / i18n key | Concept id |
|---|---|---|
| Disclaimer strip | `#disclaimer`, `disc.strong` | `not-a-forecast` |
| Depth group title | `#depth-seg` legend, `rail.depth` | `depth-and-slabs` |
| Layer "b-value with 95 % interval" | `#layer-list` row `b`, `ll.b` | `gutenberg-richter-b-value` |
| Layer "Estimate quality" | row `q`, `ll.q` | `quality-codes` |
| Layer "Completeness Mc" | row `mc`, `ll.mc` | `magnitude-of-completeness` |
| Layer "Catalogue disagreement" | row `cc`, `ll.cc` | `catalogue-consistency` |
| Layer "Mw ≥ 6 rate" | row `rate`, `ll.rate` | `rate-m6` |
| Layer "No cell layer" | row `none` | (none) |
| Regional catalogues group | `#reg-group` legend, `reg.group` | `regional-catalogues` |
| Overlay "Plate boundaries (PB2002)" | `#chk-plates` row, `rail.plates` | `plate-boundary-classes` |
| Overlay "Events M ≥ 6" | `#chk-events` row, `#lbl-m6` | `magnitude-types` |
| "Statistics window" | `.stat-window .group-title`, `rail.window` | `direct-vs-proxy-mw` |
| Phone layer chips | `#chips` | (none: chips are buttons; the same rail opens with "More") |
| Base map group (relief, 3D terrain) | `#bm-group` | (none, see below) |

### Legend (`map.js` `renderLegend`)

| UI element | i18n key | Concept id |
|---|---|---|
| Title, b layer | `layer.b.title` | `gutenberg-richter-b-value` |
| Title, quality layer | `layer.q.title` | `quality-codes` |
| Title, Mc layer (all variants) | `layer.mc.title.*` | `magnitude-of-completeness` |
| Title, agreement layer (all variants) | `layer.cc.title`, `layer.dmw.title`, `layer.dloc.title` | `catalogue-consistency` |
| Title, rate layer | `layer.rate.title` | `rate-m6` |
| Plate-boundary line | `lg.plates` | `plate-boundary-classes` |
| "Earthquakes by magnitude" | `lg.quakes` | `magnitude-types` |
| Regional block heading | `reg.legendHead` | `regional-catalogues` |

### Cell panel (`panel.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| Meta line (sample radius), global cell | `panel.meta` | `h3-cells-and-sample-radius` |
| Meta line, regional cell | `reg.panelMeta` | `regional-catalogues` |
| "b-value" label | `panel.bvalue` | `gutenberg-richter-b-value` |
| "95 % CI lo – hi" | `panel.ci` | `confidence-interval-bootstrap` |
| Quality pill (A/B) | `qPill()` | `quality-codes` |
| "No b-value shown" heading (C, insufficient) | `panel.noB.*` | `quality-codes` |
| Tile "Mc, ISC-GEM" (regional: "Mc") | `panel.mcIg` | `magnitude-of-completeness` |
| Tile "b-positive" | `panel.bpos` | `b-positive` |
| Tile "Declustered (GK)" | `panel.bdecl` | `declustering` |
| Section "Frequency-magnitude distribution" | `fmd.h` | `frequency-magnitude-distribution` |
| Section "Completeness over time" | `mct.h` | `magnitude-of-completeness` |
| Section "b against magnitude cutoff" | `bc.h` | `gutenberg-richter-b-value` |
| Section "Yearly counts" (global cells) | `yr.h` | `rate-m6` |
| Section "Catalogue agreement" | `agree.h` | `catalogue-consistency` |
| Section "Source" (regional cells) | `reg.sourceH` | `regional-catalogues` |

### Comparison view (`compare.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| Verdict "The 95 % intervals overlap" / "do not overlap" | `cmp.overlapHead`, `cmp.separateHead` | `confidence-interval-bootstrap` |
| Verdict "No comparison possible" | `cmp.missingHead` | `quality-codes` |
| "These two cells share events" (when shown) | `cmp.shared` | `h3-cells-and-sample-radius` |
| "Different catalogues" (when shown) | `cmp.mixedCatalogues` | `regional-catalogues` |

### Sequences (`pages.js`, key strip under the summary)

| Term | Concept id |
|---|---|
| p, c, K (and the fit quality badge) | `omori-utsu` |
| Mcat | `magnitude-of-completeness` |
| "Second large event in window" | `aftershock-productivity-bath` |

### Ongoing / Sequence Monitor (`monitor.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| "Not a forecast" notice | `mon.noticeStrong` | `not-a-forecast` |
| Key: p, c, K | – | `omori-utsu` |
| Key: b | – | `gutenberg-richter-b-value` |
| Key: Quality (Omori and b badges) | `col.quality` | `quality-codes` |
| Key: b-positive | `mon.bpos` | `b-positive` |
| Key: Productivity, Largest aftershock (Båth ΔM) | `mon.prod`, `mon.largest` | `aftershock-productivity-bath` |
| Key: Above completeness (Mcat) | `mon.nMcat` | `magnitude-of-completeness` |

### Depth 3D (`depth3d.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| "Slab2 slab surface" control | `d3.slab` | `depth-and-slabs` |
| "Events by depth" card (depth classes, 70 km split) | `d3.binsH` | `depth-and-slabs` |
| "b-value, shallow cells" card | `d3.bH.sh` | `gutenberg-richter-b-value` |
| Cell counts by quality under it | `d3.bSub` | `quality-codes` |
| "Depth exaggeration" | `d3.ex` | (none: a display setting, explained by its own hint) |

### Validation (`pages.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| "b-value by plate-boundary class" | `val.plateH` | `plate-boundary-classes` |
| Step "Cells and circles" | `step.cells` | `h3-cells-and-sample-radius` |
| Step "Catalogue for b" | `step.cat` | `direct-vs-proxy-mw` |
| Step "Completeness, Mc" | `step.mc` | `magnitude-of-completeness` |
| Step "b and its interval" | `step.b` | `confidence-interval-bootstrap` |
| Step "The quality gate" | `step.gate` | `quality-codes` |
| Step "Robustness checks" | `step.robust` | `b-positive` |
| "Global b in the atlas setting" | `val.globalH` | `gutenberg-richter-b-value` |
| "Omori-Utsu fitting, synthetic check" | `val.omoriH` | `omori-utsu` |
| "Limitations" | `val.limH` | `not-a-forecast` |

### About (`pages.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| Notice (not a forecast, hazard link) | `about.notice`, `about.hazard` | `not-a-forecast` |
| "Sources" | `about.sourcesH` | `catalogue-consistency` |

### Not covered, on purpose

- **Base map (relief, lakes, rivers, 3D terrain) and depth exaggeration.** These are display settings, not
  catalogue quantities; no existing concept explains them and a new concept was not clearly needed. The relief is
  documented in `docs/basemap.md` and on the About page; the Depth 3D view links `depth-and-slabs` from its slab
  control and depth card.
- **Map tooltip.** Hover-only and transient; the panel opened by the same click carries the buttons.
- **Phone layer chips.** They are buttons and cannot contain another button; "More" opens the rail with the same
  buttons.

The table is enforced by `tests/e2e/test_info.py`: per view, the set of concepts with a visible button must match,
no concept repeats inside one block, every button opens its concept and "Back to where I was" returns to the same
URL state; at 360 px every button is at least 24 px, inside the screen, on top and not overlapping another control.

## Known limits

- The saturation diagram is schematic: it shows shapes, not a calibration, and says so.
- The Båth gap uses the M ≥ 6 event layer, whose magnitudes mix ISC-GEM Mw and ComCat types; sequences without a
  later M ≥ 6 event in the window are listed with "–". It is indicative only.
- The bootstrap diagram re-estimates b with a fixed Mc; the atlas also re-estimates Mc, so its interval is usually a
  little wider. The diagram shows both.
- The quality-code slider uses the textbook width approximation 2 × 1.96 × b/√n; real cells are placed by their
  measured bootstrap width.
