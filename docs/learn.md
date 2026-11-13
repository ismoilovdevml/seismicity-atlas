# Learn: concept pages

The **Learn** view (`#v=learn`) explains every label and metric of the atlas. Each concept page has the same
structure: one sentence, a simple explanation with an everyday picture, a **real example read from `site/data`
at run time**, an interactive diagram, technical details, further reading and previous/next navigation.
A concept page is `#v=learn&t=<concept-id>`; the index is `#v=learn`.

Phase 1 (this document's first version) adds the view, the content in four languages and the `infoButton`
helper. Phase 2 places the (i) buttons in the map, panel, legend and pages, using the table at the end.

## Files

| Path | What it holds |
|---|---|
| `site/js/info.js` | `infoButton(conceptId, label)`: the (i) link, `#v=learn&t=<id>`, accessible name "What is {label}? Open the explanation" |
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

Shared-file hooks are deliberately small: `app.js` registers the `learn` view, the `t` hash parameter, a
remembered return hash and a dynamic `import('./learn/view.js')`; `index.html` adds one nav link, one section and
one stylesheet link. Nothing under `site/js/learn/` is fetched on a first visit to the map (covered by a test).

## Concept registry

Groups: **Magnitudes**, **Completeness & b-value**, **Uncertainty & quality**, **Sequences**, **Space & tectonics**,
**Data & caveats**. Languages: all 18 concepts are complete in English, Uzbek (Latin), Russian and Spanish.

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

\* **Main cell**: the shallow quality-A cell with the most events above threshold inside the Tonga-Kermadec box
(14–38° S, 172° E–170° W); if there is none, the quality-A cell with the most events anywhere. Selection is by rule,
so the examples survive the monthly refresh; all numbers in the example text are placeholders filled from the data.

**Synthetic diagrams** (`saturation`, `b-positive`, `decluster`, the strip of the `omori` diagram, the random row of
`poisson`) say so in their captions and use seeded random numbers, so they look the same on every visit.

**Numbers in the text.** Every result number on a page is a `{placeholder}` filled from `site/data`. The text itself
contains only method constants that are documented in `docs/method.md` and `docs/data-schema.md` (for example
MAXC + 0.2, the 70 km depth split, the Gardner-Knopoff window formulas, 1964–2021 for the rate).

**Further reading.** All references are cited in `docs/*.md` or the README, except **Båth (1965)**,
doi:10.1016/0040-1951(65)90003-X, and **Hayes et al. (2018, Slab2)**, doi:10.1126/science.aat4723, which were added
for Learn. All DOIs except the CORSSA one (DataCite, taken from `docs/prior-work.md`) were checked against Crossref on
2026-11-14.

## Adding a concept

1. Add `{ id, group, diagram }` to `CONCEPTS` in `registry.js`, at the place it should appear in the reading order.
   Ids are stable kebab-case; they appear in URLs and in phase-2 buttons, so never rename one.
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
7. Add the id to `CONCEPTS` in `tests/e2e/test_learn.py` and run the tests.

## Languages

The page follows the interface language (`lang` in the hash, else `localStorage['gsa-lang']`, else the browser).
Interface strings are in the `// learn` block of `site/js/i18n/<lang>.js`; concept text in `content/<lang>/`.
Scientific symbols (b, Mc, Mw, mb, MAXC) and catalogue names stay untranslated; place names inside examples come from
the data in English.

## Tests

```
E2E_BROWSERS=chromium,firefox,webkit python -m pytest tests/e2e/test_learn.py -q
```

They check the registry, the index, every concept in all four languages (no unfilled placeholder, no error, no
pending note, diagram and map link present), the diagram controls (including keyboard on a slider), reduced motion,
the info button, "Back to where I was", "Show this on the map", language persistence across links and reloads, an
unknown id, and that the map's first load does not fetch Learn code.

## Phase 2: where the (i) buttons go

Use `infoButton(id, label)` from `site/js/info.js`, placed right after the visible label; `label` is the same
translated text the element already shows. The button is a link, so it works from any view; the Learn page offers
"Back to where I was", which returns to the exact previous hash (layer, depth, cell, map position, comparison).

### Map controls (`index.html`, `app.js`)

| UI element | Where (file, selector or i18n key) | Concept id |
|---|---|---|
| Layer chip "b-value" | `#chips [data-layer=b]`, `chip.b` | `gutenberg-richter-b-value` |
| Layer chip "Quality" | `#chips [data-layer=q]`, `chip.q` | `quality-codes` |
| Layer chip "Mc" | `#chips [data-layer=mc]`, `chip.mc` | `magnitude-of-completeness` |
| Layer chip "Agreement" | `#chips [data-layer=cc]`, `chip.cc` | `catalogue-consistency` |
| Layer chip "M6+ rate" | `#chips [data-layer=rate]`, `chip.rate` | `rate-m6` |
| Depth chip / Depth group | `#chip-depth`, `rail.depth` legend of `#depth-seg` | `depth-and-slabs` |
| Layer list "b-value with 95 % interval" | `#layer-list input[value=b]`, `ll.b` | `gutenberg-richter-b-value` |
| Layer list hint "Quality-gated" | `ll.bHint` | `quality-codes` |
| Layer list "Estimate quality" | `ll.q` | `quality-codes` |
| Layer list "Completeness Mc" | `ll.mc` | `magnitude-of-completeness` |
| Layer list "Catalogue disagreement" | `ll.cc` | `catalogue-consistency` |
| Layer list "Mw ≥ 6 rate" | `ll.rate` | `rate-m6` |
| Regional catalogues group | `#reg-group` legend, `reg.group` | `regional-catalogues` |
| Overlay "Plate boundaries (PB2002)" | `#chk-plates` label, `rail.plates` | `plate-boundary-classes` |
| Overlay "Events M ≥ 6 / M ≥ 5" | `#lbl-m6`, `#lbl-m5` | `magnitude-types` |
| "Statistics window" and its hint | `rail.window`, `rail.windowHint` | `direct-vs-proxy-mw` |
| Disclaimer strip | `#disclaimer`, `disc.strong` | `not-a-forecast` |

### Legend (`layers.js` / `map.js`, keys `layer.*`, `lg.*`)

| UI element | i18n key | Concept id |
|---|---|---|
| b legend title | `layer.b.title` | `gutenberg-richter-b-value` |
| b legend unit line ("events within {r} km of the cell centre") | `layer.b.unit` | `h3-cells-and-sample-radius` |
| Quality A / B / C rows, "Insufficient" row | `layer.b.qA`, `layer.b.qB`, `layer.b.qC`, `layer.insufficient`, `layer.q.*` | `quality-codes` |
| Quality legend unit ("bootstrap 95 % interval") | `layer.q.unit` | `confidence-interval-bootstrap` |
| Mc legend titles | `layer.mc.title.ig`, `.cc`, `.cc0` | `magnitude-of-completeness` |
| Mc ComCat note ("not on the same scale as ISC-GEM") | `layer.mc.noteCc` | `magnitude-types` |
| Agreement legend, ΔMw, epicentre difference | `layer.cc.title`, `layer.dmw.title`, `layer.dloc.title` | `catalogue-consistency` |
| Rate legend title and note | `layer.rate.title`, `layer.rate.note` | `rate-m6` (note: `not-a-forecast`) |
| Plate boundary legend line | `lg.plates` | `plate-boundary-classes` |
| Earthquakes legend ("Earthquakes by magnitude") | `lg.quakes` | `magnitude-types` |
| Regional legend block | regional name / licence line | `regional-catalogues` |

### Cell panel (`panel.js`, keys `panel.*`, `fmd.*`, `mct.*`, `bc.*`, `agree.*`, `yr.*`)

| UI element | i18n key | Concept id |
|---|---|---|
| Panel meta "{pb}, {r} km sample radius, {depth}" | `panel.meta` | `h3-cells-and-sample-radius` (plate class part: `plate-boundary-classes`) |
| Big "b-value" label | `panel.bvalue` | `gutenberg-richter-b-value` |
| "95 % CI lo – hi" and the interval scale bar | `panel.ci` | `confidence-interval-bootstrap` |
| Quality pill (A/B/C/insufficient) | `qPill()` in `panel.js` | `quality-codes` |
| "Cutoff-unstable" note | `panel.unstable` | `quality-codes` |
| "Why no b" text (C or too few) | `panel.whyC`, `panel.whyFew`, `panel.noB.*` | `quality-codes` |
| Tile "Mc, ISC-GEM" / "Mc, ComCat 2010+" | `panel.mcIg`, `panel.mcCc` | `magnitude-of-completeness` |
| Tile "Events above Mc" | `panel.nAboveMc` | `magnitude-of-completeness` |
| "b-positive" | `panel.bpos` | `b-positive` |
| "Declustered (GK)" | `panel.bdecl` | `declustering` |
| Agreement flag and list | `panel.flag.*`, `agree.h` | `catalogue-consistency` |
| FMD section and chart | `fmd.h`, `fmd.title` | `frequency-magnitude-distribution` |
| "The two catalogues use different magnitude scales." | `fmd.scales` | `magnitude-types` |
| Completeness over time | `mct.h` | `magnitude-of-completeness` |
| b against magnitude cutoff | `bc.h` | `gutenberg-richter-b-value` |
| Yearly counts section | `yr.h` | `rate-m6` |
| Regional cell source block | `regionalSource()` | `regional-catalogues` |

### Comparison view (`compare.js`, keys `cmp.*`)

| UI element | i18n key | Concept id |
|---|---|---|
| Chart title "b with 95 % interval" | `cmp.chartTitle` | `confidence-interval-bootstrap` |
| Verdict heading (overlap / do not overlap / no comparison) | `cmp.overlapHead`, `cmp.separateHead`, `cmp.missingHead` | `confidence-interval-bootstrap` |
| "These two cells share events" note | `cmp.shared` | `h3-cells-and-sample-radius` |
| "Different catalogues" note | `cmp.mixedCatalogues` | `regional-catalogues` |

### Tooltip (`map.js`, keys `tt.*`)

Tooltips are hover-only and short; no buttons there. Their content is covered by the panel buttons above.

### Pages (`pages.js`)

| UI element | i18n key | Concept id |
|---|---|---|
| Sequences page title / lede | `seq.h1`, `seq.lede` | `omori-utsu` |
| Per-sequence p, c, K values and "c not resolved" | `seq.cUnres`, `seq.notResolved`, `om.title` | `omori-utsu` |
| Sequence quality badge | sequence card badge | `omori-utsu` |
| "Second large event in window" | `seq.contaminated` | `aftershock-productivity-bath` |
| Sequence Monitor (upcoming, `feat/monitor`): productivity, expected aftershock numbers, Båth | – | `aftershock-productivity-bath` |
| Validation "How a cell value is made" steps | `step.cells`, `step.cat`, `step.mc`, `step.b`, `step.gate`, `step.robust` | `h3-cells-and-sample-radius`, `direct-vs-proxy-mw`, `magnitude-of-completeness`, `confidence-interval-bootstrap`, `quality-codes`, `b-positive` |
| Validation "b-value by plate-boundary class" | `val.plateH` | `plate-boundary-classes` |
| Validation "Subduction b, young against old slabs" | `slab.title` | `depth-and-slabs` |
| Validation "Global completeness floors" | `val.floorsH` | `magnitude-of-completeness` |
| Validation "Omori-Utsu fitting, synthetic check" | `val.omoriH` | `omori-utsu` |
| Validation "Limitations" item 7 | `lim.7` | `not-a-forecast` |
| About page hazard notice | `about.hazard` | `not-a-forecast` |
| 3D depth view (upcoming, `feat/terrain3d`) | its title | `depth-and-slabs` |

## Known limits

- The saturation diagram is schematic: it shows shapes, not a calibration, and says so.
- The Båth gap uses the M ≥ 6 event layer, whose magnitudes mix ISC-GEM Mw and ComCat types; sequences without a
  later M ≥ 6 event in the window are listed with "–". It is indicative only.
- The bootstrap diagram re-estimates b with a fixed Mc; the atlas also re-estimates Mc, so its interval is usually a
  little wider. The diagram shows both.
- The quality-code slider uses the textbook width approximation 2 × 1.96 × b/√n; real cells are placed by their
  measured bootstrap width.
