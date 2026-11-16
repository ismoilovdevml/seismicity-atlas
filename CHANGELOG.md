# Changelog

Versions follow `scripts/release.json` (shown on the site from `site/data/manifest.json`). A patch is a data refresh
with the same schema, a minor version a method, schema or website change; see [docs/release.md](docs/release.md).

## 0.5.0 (prepared 2026-11-16, not yet released)

Method release after a review; same data cut-off (2026-11-13). Every old → new number with its reason is in
[docs/changes-0.5.md](docs/changes-0.5.md).

- **Quality gate on the relative interval width** (hi − lo) / b, with b the cell's point estimate: A ≤ 0.30,
  B ≤ 0.50, C wider, insufficient below 50 events (`atlaslib.quality`). The absolute limits used until 0.4.0
  favoured low b, because the width grows with b. Shallow cells A/B/C 58/112/54 → 55/117/52 (shown 170 → 172),
  deeper 24/49/14 → 12/59/16 (shown 73 → 71). Global b unchanged: 1.035 [1.018, 1.052] shallow, 0.936
  [0.911, 0.961] deeper. The same gate now applies to the regional layers, the retrospective b(t), the Groningen
  case study and the Sequence Monitor (monitor data are rebuilt by its daily job, not in this commit).
- **1000 bootstrap replicates** (200 before) for the cell intervals, the declustered b, the validation intervals
  (500 and 300 before), the regional layers, b(t) and the Monitor. Seeds unchanged.
- New cell property `d_ciwr` (relative width, also for C cells; global and regional cells); `manifest.json`
  `method.quality` reads "95 % CI width / b <= 0.30" and gains `quality_width`; `sequences.json` `synthetic_check`
  gains `n_runs`; `global.json` validation rows gain `data` and `z`, and the file gains `validation_counts`.
- **Validation verdicts by z-score**: z = (ours − published) / √(σ_ours² + σ_pub²), |z| ≤ 1.96 match, else differs;
  without a published uncertainty, "consistent, uninformative" when our interval contains the value (until 0.4.0
  the Kagan 2010 rows used σ_pub = 0 and the regional and plate-class rows only "inside our interval"). Every row is
  tagged same data (GCMT-based), same data (ISC-GEM itself), independent data or no published value. New rows: a
  pooled bias test of the synthetic b recovery and a z-test of the Omori p recovery (both "differs" for one case,
  see docs/validation.md).
- Docs: the relative mask, the 1000 replicates and the Mc caveat (ISC-GEM inclusion thresholds) in `method.md`;
  `validation.md` re-classified; Learn pages `quality-codes` and `confidence-interval-bootstrap` updated in four
  languages (native review of uz/ru/es pending, `docs/learn.md`).
- `run_all.sh` runs the unit tests without `tests/e2e` (collecting both `test_monitor.py` files stopped pytest).
- The cell layer fixtures of the browser tests moved to cells that keep their code under the new gate.

### Also in 0.5.0 (committed before the review, listed under Unreleased until now)

- Search engines: 88 static Learn pages (21 concepts × 4 languages + 4 indexes) with canonical, hreflang and JSON-LD,
  generated from the same texts as the app (`scripts/seo_pages.mjs`); `sitemap.xml` and `robots.txt`; Dataset and
  WebSite JSON-LD on the home page (Google Dataset Search); a descriptive title; a `<noscript>` summary with links.
- New social card: dark globe of the western Pacific with only quality A/B cells and the live count of places with a
  trustworthy b-value.

## 0.4.0 (2026-11-15)

Licence and legal fixes and journal figures; no atlas number changes (data cut-off 2026-11-13, as in 0.3.1).
The data version is a minor step because `site/data/` changed shape (`fetched_utc` added to the regional layers,
epicentres removed from the Groningen `rates.json`).

- Citation metadata declare both licences: `CITATION.cff` lists MIT and CC-BY-SA-4.0; `.zenodo.json` labels the deposit
  CC BY-SA 4.0 and says in the notes that the code is MIT.
- Full ISC-GEM attribution (© International Seismological Centre and GEM Foundation, CC BY-SA 3.0, the ComCat copy,
  Storchak et al. 2015 added) in the README, `manifest.json` (from `scripts/site_layers.py`) and the About page.
- Exceptions to the CC BY-SA data licence stated: PB2002 (ODC-BY 1.0), Natural Earth (public domain), Slab2 (CC0 1.0,
  no longer labelled U.S. public domain), and `results/sci2_gem_hazard.json` (aggregates of CC BY-NC-SA GEM data).
- About page: three.js and the Crameri colour maps listed with MapLibre; an "as is" data disclaimer, a privacy note
  and an accessibility note with a contact route, in all four languages. The "as is" line is also in the README.
- Regional layers: Southern California labelled "no licence stated" with the SCSN and SCEDC citations; `fetched_utc`
  per region and the download date in the Icelandic Met Office attribution; the NZ source link points to the GeoNet
  catalogue page.
- Groningen: `rates.json` keeps only time, ML and KNMI id of the 16 events of ML ≥ 3.0 (no epicentres); the README
  and docs describe this instead of "no single events".
- Paper figures: Mc by period and plate-boundary b at 300 dpi for 180 mm; validation
  figure with readable labels, the universal-b band for subduction and open markers for mismatches; new figure
  `consistency.png` (b against cutoff in three magnitude versions, median epicentre distance per cell).
- Journal figures without titles or footers (the captions carry that text), on white, written at 400 dpi with the
  effective dpi at 86 or 180 mm printed: new `fig1_b_maps.png` (shallow above deeper b map, one colour bar, no grey
  "too few events" cells, 194 mm tall at 180 mm); single-column FMD; universal b band on the plate-boundary figure;
  panel letters on the Mc figure. All six checked under simulated protanopia, deuteranopia and tritanopia.
- Literature values: all 16 re-read from the source PDFs (all match); pages, periods, estimators and the declustering
  method filled in (`checked_by_agent`; `needs_human_check` stays until the author's review). Bird & Kagan (2004)
  Table 5 is now read, and entry 15 uses the same z rule as the others, per class: mismatch → match (approximate).
  Site validation table: 25 match, 1 mismatch (the declustered Kagan 2010 value).
- Author ORCID iD (0009-0008-2785-3691) in `CITATION.cff` and `.zenodo.json`.

## 0.3.1 (2026-11-15)

Website and new science. The atlas statistics (method, data cut-off) are those of 0.3.0.

- Case studies view (`#v=cases&cs=groningen`): induced seismicity in the Groningen gas field. A plain-language summary,
  then monthly production and earthquake rate, phase rates with Poisson intervals, b by phase (three estimators),
  moving b-positive (north, south), b maps by period, and the validation against published studies. Shows "not a
  forecast", the KNMI attribution with the network DOI and "Source: NLOG.NL"; no single events are offered.
- Seismic-deficit layer, Tien Shan pilot (Scientist view, `df=1`, `dz=<zone>`, `dv=r|c`): regions or H3 cells, a legend
  with the headline "no detectable deficit beyond catalogue noise", and a regional panel. Ratios are shown only with
  their 95 % interval and p_full; `few` and `nogeod` zones are greyed and hatched.
- Ongoing cards: the Zhang & Werner (2020) ETAS productivity reference next to Page et al. (2016), with a note that puts
  a "more productive" label in context. `docs/data-schema.md` documents `productivity_zw2020`.
- Depth 3D: Türkiye 2023 (Kahramanmaraş) preset, with a link to the Lomax (2023) relocated catalogue.
- Learn: `induced-seismicity` and `seismic-moment-budget` (21 concepts, four languages), in a new group.
- Light-theme b classes: six steps of the Crameri Scientific colour map vik (MIT licence). The dark theme is unchanged.
- `scripts/paper_figures.py`: eight key figures at 300 dpi with Crameri maps in `docs/img/paper/`.
- README: key-results table generated from the data (`scripts/readme_numbers.py`, also run by `run_all.sh` and the
  monthly update), one screenshot script (`tests/e2e/tools/readme_shots.py`), and `tests/test_readme.py` as a guard.
  Old v0.2/v0.3 screenshots that no document used were removed; the social card shows the new b classes.

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
