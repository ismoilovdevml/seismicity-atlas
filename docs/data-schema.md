# Data contract: `site/data/`

This is the interface between the analysis (this repository) and the website. Property names, units and codes
below are stable for the 0.x series: new properties may be added, existing ones are not renamed or re-scaled
without a version bump in `manifest.json`.

General rules

- Coordinates are WGS84 longitude/latitude in degrees. Polygons and lines that cross the antimeridian use
  continuous longitudes (for example 179.5 → 180.4), which MapLibre renders correctly; the site must not wrap them.
- Missing values are JSON `null`; in `cells.geojson` null-valued properties are omitted to save bytes (MapLibre
  `["get", ...]` returns `null` for them). A `null` b-value always means "not shown" and the quality code says why.
- Magnitudes are moment magnitude Mw or an Mw proxy (see `mt` codes), binned to 0.1 for all statistics.
- Depth classes: `sh` = hypocentral depth ≤ 70 km, `dp` = depth > 70 km (intermediate and deep).
- Every b-value comes with a 95 % interval and a quality code. The site must never draw a b-value without both.

## Files

| File | Load | Content |
|---|---|---|
| `manifest.json` | first | version, data cut-off, sources (`name`, `url`, `licence`, optional `licence_url`, `attribution`, `citation`, `access`, `query`), licences (`data`, `code`, `exceptions[]`: files under another licence), file list with byte sizes, global numbers (version and cut-off come from `scripts/release.json`; see [release.md](release.md)) |
| `cells.geojson` | first | one Polygon feature per H3 resolution-2 cell that holds at least one event |
| `events_m6.json` | first | deduplicated events M ≥ 6.0, columnar |
| `events_m5.json` | lazy | deduplicated events M ≥ 5.0, columnar (superset of `events_m6.json`) |
| `plates.geojson` | first | Bird (2003) PB2002 plate-boundary steps merged into lines per boundary class |
| `land.geojson` | first | Natural Earth 1:110m land polygons (fill) |
| `coastline.geojson` | first | Natural Earth 1:50m coastline, simplified (outline) |
| `sequences.json` | lazy | Omori-Utsu fits for the 40 largest independent sequences since 1990 |
| `monitor/index.json` | lazy | Sequence Monitor: cut-off, update time, selection, disclaimer, one summary per ongoing sequence |
| `monitor/<event id>.json` | lazy | one ongoing sequence: counts, Omori fit, b, b-positive, productivity, daily and cumulative counts |
| `induced/groningen/*.json` | lazy | Case studies view: the Groningen gas-field case study (contract: [induced.md](induced.md#data-contract)) |
| `deficit/{index.json,regions.geojson,cells.geojson}` | lazy | Scientist view: the seismic-deficit layer, Tien Shan pilot (contract: [deficit.md](deficit.md#data-contract-sitedatadeficit)) |
| `global.json` | lazy | global charts: Mc by period vs Michael (2014), b vs cutoff, b by boundary class, validation table |
| `cells/<h3>.json` | lazy, on click | per-cell detail: FMDs, Mc(t), b(cutoff), yearly rates |

### `manifest.json` → `method` (b sample, since v0.2)

| Key | Type | Meaning |
|---|---|---|
| `b_catalogue` | string | catalogue and years of every b, `"ISC-GEM Mw 1976-2021"` (unchanged; the site parses the two years) |
| `b_sample` | string | which events enter b: `"Mw uncertainty <= 0.10 (direct Mw)"`, or `"all events"` when built with `ATLAS_B_MAGERR_MAX=all` |
| `b_magerr_max` | number or `null` | the uncertainty limit (0.1), `null` = every event (v0.1 behaviour) |
| `nboot` | number | bootstrap replicates per b interval: 1000 since 0.5.0 (200 before) |
| `quality` | object | the gate as text; the site reads the last number of each rule. Since 0.5.0 `A` reads `"95 % CI width / b <= 0.30"` (before: `"95 % CI width <= 0.30"`) |
| `quality_width` | string | since 0.5.0: `"relative: (hi - lo) / b, b = the point estimate of the cell (since 0.5.0)"` |

The site does not show `b_sample` yet. Suggested later UI (not done, site code unchanged): add it to the b layer's
unit line and to the method step on the about page, e.g. "ISC-GEM Mw 1976–2021, direct Mw only".

## `cells.geojson` feature properties

Cell identity and counts (the cell itself, not the sampling circle):

| Property | Type / unit | Meaning |
|---|---|---|
| `id` | string | H3 cell index (resolution 2) |
| `lat`, `lon` | degrees | cell centre |
| `area_km2` | km² | cell area (H3 cells are not exactly equal-area; normalise by this) |
| `pb` | code | dominant PB2002 boundary class of the shallow ISC-GEM events in the cell: `SUB` subduction, `CCB` continental convergent, `OCB` oceanic convergent, `CTF` continental transform, `OTF` oceanic transform, `CRB` continental rift, `OSR` oceanic spreading ridge, `none` farther than 200 km from any boundary step |
| `n_iscgem` | count | ISC-GEM events in the cell, 1904–2021, all depths |
| `n_comcat` | count | ComCat M ≥ 4.5 events in the cell, 1973–cut-off, all depths |
| `rate_m6` | events / yr / 100,000 km² | ISC-GEM Mw ≥ 6.0, 1964–2021, all depths |
| `detail` | bool | `cells/<id>.json` exists |

Statistics per depth class `d` ∈ {`sh`, `dp`}, from ISC-GEM 1976–2021 events within 300 km of the cell centre:

| Property | Type / unit | Meaning |
|---|---|---|
| `d_n` | count | events in the sampling circle |
| `d_nb` | count | events above their completeness threshold (used for b) |
| `d_mc`, `d_mc_lo`, `d_mc_hi` | Mw | cell Mc (MAXC + 0.2) and its bootstrap 95 % interval; the threshold actually used per event is max(`d_mc`, global floor of its period) |
| `d_b`, `d_b_lo`, `d_b_hi` | – | Gutenberg-Richter b and bootstrap 95 % interval (Mc re-estimated in every replicate); `null` unless `d_q` is `A` or `B` |
| `d_q` | code | since 0.5.0 on the **relative** width (`d_b_hi` − `d_b_lo`) / b, with b the cell's point estimate: `A` ≤ 0.30, `B` ≤ 0.50, `C` wider (b masked), `insufficient` fewer than 50 events above threshold. Until 0.4.0 the limits applied to the absolute width (`d_ciw`), which favoured low b ([method.md §4](method.md#4-b-value-uncertainty-and-the-mask)) |
| `d_ciw` | – | absolute interval width hi − lo, also for `C` cells (unchanged meaning) |
| `d_ciwr` | – | relative interval width (hi − lo) / b, the number the quality code is set by; also for `C` cells (since 0.5.0) |
| `d_unstable` | bool | b at threshold +0.2 and +0.4 both fall outside the interval on the same side |
| `d_bpos`, `d_bpos_lo`, `d_bpos_hi` | – | b-positive (van der Elst 2021), ±1.96 σ; `null` unless `d_q` is A/B |
| `d_bdecl`, `d_bdecl_lo`, `d_bdecl_hi` | – | b after Gardner-Knopoff declustering (per depth layer), bootstrap 95 %; `null` unless `d_q` is A/B and the declustered sample's own `d_qdecl` is A/B (since 0.6.0; before, a declustered b from a handful of events was shown when the full sample passed) |
| `d_qdecl` | – | quality code of the declustered sample (same A/B/C/insufficient rule as `d_q`); present when the declustered b was computed and `d_q` is A/B (since 0.6.0; the first 0.6.0 data also gave it next to a masked main b, where an A/B code could come without its value) |
| `d_mc_cc` | magnitude as served | ComCat Mc (MAXC + 0.2) of the preferred magnitudes, 2010–cut-off, ≥ 50 events else `null` |
| `d_mc_cc0` | magnitude as served | the same for 1973–1989 |

Catalogue consistency (matched ISC-GEM ↔ ComCat events located in the cell, 1973–2021):

| Property | Type / unit | Meaning |
|---|---|---|
| `c_n` | count | matched pairs (\|Δt\| ≤ 30 s, distance ≤ 100 km) |
| `c_dmw` | magnitude units | median ComCat Mw-type magnitude − ISC-GEM Mw |
| `c_dmb` | magnitude units | median ComCat mb − ISC-GEM Mw (mb offset; not an error) |
| `c_dloc` | km | median epicentre difference |
| `c_ddep` | km | median depth difference, ComCat − ISC-GEM |
| `c_gonly` | count | ISC-GEM events 1973–2021 with no ComCat match |
| `c_conly` | count | ComCat events 1973–2021 with Mw proxy ≥ 6.0 and no ISC-GEM match |
| `c_flag` | code | `few` if `c_n` < 10; `check` if \|`c_dmw`\| > 0.10, `c_dloc` > 30 km, or (`c_gonly` + `c_conly`) / `c_n` > 0.10; else `ok` |

## `events_m6.json`, `events_m5.json`

Columnar JSON, one array per field, same length:

```json
{"n": 123, "fields": ["lon","lat","depth","mag","year","src","mt","id"],
 "codes": {"src": {...}, "mt": {...}}, "lon": [...], "lat": [...], ...}
```

| Field | Unit | Meaning |
|---|---|---|
| `lon`, `lat` | degrees, 2 decimals | epicentre (ISC-GEM location when the event is in ISC-GEM) |
| `depth` | km, integer | hypocentral depth |
| `mag` | Mw or Mw proxy, 1 decimal | ISC-GEM Mw if in ISC-GEM, else ComCat magnitude converted by the rule in `mt` |
| `year` | decimal year, 3 decimals | origin time |
| `src` | code | 0 = both catalogues, 1 = ISC-GEM only, 2 = ComCat only |
| `mt` | code | 0 = ISC-GEM Mw, 1 = ComCat Mw-type, 2 = ComCat mb → Mw proxy, 3 = ComCat Ms → Mw proxy, 4 = ComCat other (ml, md, ...) unchanged |
| `id` | string | ComCat event id (`https://earthquake.usgs.gov/earthquakes/eventpage/<id>`): the matched ComCat event for `src` 0 and 2; for `src` 1 (ISC-GEM only) the `iscgem<ISC event id>` form that ComCat uses for its ISC-GEM mirror. Present in both files (earlier copies of `events_m5.json` lacked it). |

## `cells/<h3>.json`

```json
{"h3": "...", "lat": 0, "lon": 0, "radius_km": 300,
 "sh": {"fmd_iscgem": [[m, n], ...], "fmd_comcat": [[m, n], ...],
        "mc_t_iscgem": [[y0, y1, n, mc|null], ...], "mc_t_comcat": [[y0, y1, n, mc|null], ...],
        "b_cutoff": [[mc, b, lo, hi, n], ...],
        "rate_years": [1973, <cut-off year>], "rate_iscgem_above_thr": [...], "rate_comcat_m45": [...],
        "stats": {...}},
 "dp": {...}}
```

- `fmd_*`: non-cumulative counts per 0.1 bin (ISC-GEM 1976–2021 in Mw, the b sample: direct Mw only since v0.2;
  ComCat 1973–cut-off as served). The site derives the cumulative curve.
- `mc_t_iscgem`: MAXC + 0.2 in 10-year windows over 1904–2021, every event (not only the b sample); `mc_t_comcat`: 5-year windows from 1973 to the
  cut-off year, as served; `null` when a window has fewer than 50 events.
- `b_cutoff`: b for fixed cutoffs 5.0–7.0 (threshold max(cutoff, period floor)), Shi-Bolt ±1.96 σ, n ≥ 30, on
  the b sample.
- `rate_*`: yearly counts for every year in `rate_years` (1973 to the cut-off year, inclusive; the cut-off year is
  partial). `rate_iscgem_above_thr` counts ISC-GEM b-sample events (direct Mw since v0.2) above their threshold;
  it covers only the b period
  1976–2021 (`manifest.json` → `method.b_catalogue`) and is `null` for the other years (no data, not zero). A `0`
  inside the period is a real zero. An empty array means the cell has no estimate for that depth class.
- `stats`: the full output of the cell estimator (raw b, interval, Mc interval, quality) for that depth class.
- A depth key is absent when the circle holds fewer than 20 ISC-GEM and fewer than 50 ComCat events.

## `sequences.json`

`{"method": str, "synthetic_check": {...}, "sequences": [...]}`. Each sequence: `id`, `time` (ISO 8601 UTC),
`lat`, `lon`, `depth` (km), `mag`, `magtype`, `place`, `radius_km`, `mcat`, `n_window`, `n_fit`, `K`
(events/day ≥ Mcat), `c` (days), `p`, `sK`, `sc`, `sp` (standard errors), `b_seq`, `b_seq_source`, `contaminated`,
`c_resolved`, `quality` (`A`/`B`/`C`/`insufficient`), `rate_bins_days`, `rate_counts` (counts ≥ Mcat in log-spaced
day bins, for the decay chart). `synthetic_check` gained `n_runs` (20) in 0.5.0.

## `global.json`

Chart-ready global series: `michael_periods`, `michael_pooled`, `b_cutoff_2004_2021`, `plate_boundary_types`,
`slab_age_groups`, `validation_table`, `validation_counts`, `floors`. Field names follow `results/validation.json`. Since v0.2
`plate_boundary_types`, `slab_age_groups` and `floors` use the direct-Mw b sample; `michael_*` and
`b_cutoff_2004_2021` (a catalogue comparison) use every ISC-GEM event. The all-events class values are in
`results/validation.json` (`plate_boundary_types_all_events`), not in `global.json`.

Validation table rows (since 0.5.0): `test`, `ours`, `published` (text), `verdict` (text that starts with `match`,
`differs`, `consistent, uninformative`, `not testable`, `reference only`, `robust` or `description only`; the site
reads the pill from that first word), `data` (`same data (GCMT-based)`, `same data (ISC-GEM itself)`,
`independent data` or `no published value`) and `z` (number, or `null` when no published uncertainty exists or the
row is not a single comparison). `validation_counts` holds the verdict counts per `data` group. The rule is in
[validation.md](validation.md#how-a-comparison-is-judged-since-050).

### `sequences.json`: retrospective b before and after (`bt`, added by `scripts/val_bt.py`)

Each sequence has a `bt` object, and the file has a top-level `bt_method` string. These values are a
**retrospective description** of the catalogue. They are not a forecast and must not be presented as one.

- `catalogue`: always `"ISC-GEM Mw"`.
- `mainshock_in_iscgem`: whether the mainshock was found in ISC-GEM (within 60 s and 100 km).
- `mag_main_iscgem`: the ISC-GEM Mw of the mainshock, used in Mc(t).
- Windows `pre_5y`, `pre_1y`, `post_0_30d`, `post_30_365d` cover events inside the sequence circle (`radius_km`),
  at all depths. Each window holds:

| Property | Meaning |
|---|---|
| `n`, `n_b` | events in the window; events above their threshold |
| `b`, `b_lo`, `b_hi` | Aki-Utsu b with per-event threshold and bootstrap 95 % interval; `null` unless `q` is `A` or `B` |
| `b_raw`, `b_lo_raw`, `b_hi_raw` | the same, also for masked windows |
| `q` | `A` / `B` / `C` / `insufficient` as for cells; `not covered` when the window is outside ISC-GEM 1976–2021 |
| `mc_window` | MAXC + 0.2 of the window sample |
| `bpos`, `bpos_lo`, `bpos_hi`, `n_bpos` | b-positive ± 1.96 σ, present only with ≥ 50 positive differences |

The threshold of each event is the largest of three values:
- the atlas floor for its period and depth class;
- `mc_window`;
- after the mainshock only, Mc(t) = Mm − 4.5 − 0.75 log₁₀(t / day).

## `monitor/` (Sequence Monitor, updated daily)

**Descriptive only, not a forecast.** Every value covers the time from the mainshock to `data_cutoff_utc`. The
files hold no probability and no expected future count; `scripts/monitor/check_monitor.py` rejects forecast-like
keys and any curve past the cut-off. Method: [monitor.md](monitor.md). These files are rebuilt daily by
`.github/workflows/update-monitor.yml`, independently of the monthly atlas release.

`index.json`:

| Property | Meaning |
|---|---|
| `method_version` | `monitor-<major>.<minor>`; changes when a definition below changes |
| `generated_utc`, `data_cutoff_utc` | build time and the end of the ComCat queries (ISO 8601 UTC) |
| `disclaimer` | the "not a forecast" statement (English data text; the site shows its own translated notice) |
| `selection` | `min_mag` used, `default_min_mag` 7.0, `fallback_min_mag` 6.5, `fallback_used`, `window_days` 365, `query_minmag` 2.5, `catalogue` |
| `method`, `references` | method text and citations |
| `sequences` | summaries: `id`, `time`, `lat`, `lon`, `depth`, `mag`, `magtype`, `place`, `url`, `regime`, `radius_km`, `age_days`, `mcat`, `contaminated`, `overlaps`, `n_all`, `n_mcat`, `n_last7`, `omori` {`p`, `p_lo`, `p_hi`, `quality`}, `b` {`b`, `lo`, `hi`, `q`}, `productivity` {`class`, `ratio`, `ratio_lo`, `ratio_hi`, `percentile`}, `productivity_zw2020` {`applicable`, `class`, `ratio`, `ratio_lo`, `ratio_hi`, `in_calibration_range`} (short form; `null` values when not applicable), `largest_aftershock`, `file` |

`<event id>.json` (ComCat id of the mainshock):

| Property | Meaning |
|---|---|
| `id`, `time`, `lat`, `lon`, `depth`, `mag`, `magtype`, `place`, `url` | mainshock as served by ComCat; `url` is its USGS event page |
| `regime` | Garcia et al. (2012) tectonic regime of the epicentre (e.g. `SZ-GENERIC`) |
| `radius_km`, `age_days` | window radius max(100 km, Wells & Coppersmith L) and days from the mainshock to the cut-off |
| `absorbed` | larger-sequence members that would otherwise be mainshocks (in-window events or doublets): `id`, `time`, `mag`, `place` |
| `overlaps` | later M ≥ 6.5 events whose own circle intersects this one: `id`, `time`, `mag`, `dist_km` |
| `query` | the ComCat query parameters used |
| `counts` | `n_all` (M ≥ query minimum), `n_mcat` (≥ Mcat), `n_fit` (≥ Mc(t)), `n_last7`, `n_last7_mcat`, `last_event` |
| `mcat`, `mcat_method` | completeness (`maxc+0.2` or `default` 4.5) |
| `mc_t` | `F`, `G`, `H` of Mc(t) = max(Mcat, F Mm − G − H log₁₀ t) and `days_until_mcat` |
| `magtypes` | up to four `[type, share]` pairs of the aftershock magnitude types |
| `contaminated` | an event within 0.5 units of the mainshock is in or overlaps the window (bars Omori quality A) |
| `omori` | `n`, `K` (events/day ≥ Mcat), `c` (days), `p`, standard errors `sK`, `sc`, `sp`, 95 % bounds `p_lo`/`p_hi`, `K_lo`/`K_hi`, `c_lo`/`c_hi` (only when `c_resolved`), `c_resolved`, `quality` (`A`/`B`/`C`/`insufficient`; with `insufficient` only `n` is present) |
| `omori_b`, `omori_b_source` | b used inside the Omori likelihood (`b-positive` or `fixed 1.0`) |
| `b` | `b` (`null` unless `q` is A/B), `b_raw`, bootstrap 95 % `lo`, `hi`, `n`, `q` |
| `bpos` | b-positive `b`, `lo`, `hi` (± 1.96 σ), `n` differences; `null` values below 50 differences |
| `largest_aftershock` | `id`, `time`, `mag`, `magtype`, `days`, `dm` (Mm − Mmax); `bath_typical_dm` = 1.2 |
| `productivity` | `regime`, `n`, sequence `a` with `a_lo`/`a_hi` (95 %), `a_regional`, `a_regional_sigma`, `p_regional`, `c_regional`, `b_regional`, `typical_lo`/`typical_hi` (25th–75th percentile of the region), `ratio` = 10^(a − mean) with `ratio_lo`/`ratio_hi`, `percentile`, `class` (`more`/`typical`/`less`/`insufficient`) |
| `productivity_zw2020` | second productivity reference, Zhang, Werner & Goda (2020), BSSA 110(1), doi:10.1785/0120190121, since `monitor-1.1` (method: [monitor.md](monitor.md) §9). Not applicable (`applicable: false`, `reason`) outside the Garcia `SZ-*` subduction regimes. Otherwise: `n` (our count above Mc(t), as for `productivity`), `direct_count_zw` (D, their expected number of **direct** aftershocks above our Mc(t) from the Table 6 ETAS parameters, mainshock to cut-off), `mcut` (4.5, their magnitude cut), `ratio` = n / D with `ratio_lo`/`ratio_hi` (95 %: Poisson error of n and the standard error of K0), `ref_ratio_median`, `ref_ratio_min`, `ref_ratio_max`, `ref_n` (the same ratio for their own Case 3 sequences: median 3.42, range 1.50–10.75, 14 sequences), `ref_percentile` (position of `ratio` among them), `class` (`within`/`above`/`below` the reference range, or `insufficient`), `in_calibration_range` (false outside M 7.5–9.0 or for depth ≥ 100 km). The ratio is normally above 1 because n also counts secondary aftershocks and background events; it is read against the reference range, not against 1. The site shows it on the Ongoing cards next to the Page et al. (2016) comparison. |
| `daily` | `all`, `mcat`: event counts per whole day since the mainshock (the last day is partial) |
| `cum` | `t` (days; 1 h, 6 h, 12 h, then whole days, last value = `age_days`), `obs` (cumulative events ≥ Mc(t)), `obs_mcat` (≥ Mcat), `fit` (expected cumulative count ≥ Mc(t) from the Omori fit; absent without a fit) |
