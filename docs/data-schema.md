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
| `manifest.json` | first | version, data cut-off, sources, licences, file list with byte sizes, global numbers |
| `cells.geojson` | first | one Polygon feature per H3 resolution-2 cell that holds at least one event |
| `events_m6.json` | first | deduplicated events M ≥ 6.0, columnar |
| `events_m5.json` | lazy | deduplicated events M ≥ 5.0, columnar (superset of `events_m6.json`) |
| `plates.geojson` | first | Bird (2003) PB2002 plate-boundary steps merged into lines per boundary class |
| `land.geojson` | first | Natural Earth 1:110m land polygons (fill) |
| `coastline.geojson` | first | Natural Earth 1:50m coastline, simplified (outline) |
| `sequences.json` | lazy | Omori-Utsu fits for the 40 largest independent sequences since 1990 |
| `global.json` | lazy | global charts: Mc by period vs Michael (2014), b vs cutoff, b by boundary class, validation table |
| `cells/<h3>.json` | lazy, on click | per-cell detail: FMDs, Mc(t), b(cutoff), yearly rates |

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
| `d_q` | code | `A` interval width ≤ 0.30, `B` ≤ 0.50, `C` wider (b masked), `insufficient` fewer than 50 events above threshold |
| `d_ciw` | – | interval width, also for `C` cells (explains the mask) |
| `d_unstable` | bool | b at threshold +0.2 and +0.4 both fall outside the interval on the same side |
| `d_bpos`, `d_bpos_lo`, `d_bpos_hi` | – | b-positive (van der Elst 2021), ±1.96 σ; `null` unless `d_q` is A/B |
| `d_bdecl`, `d_bdecl_lo`, `d_bdecl_hi` | – | b after Gardner-Knopoff declustering, bootstrap 95 %; `null` unless `d_q` is A/B |
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
{"n": 123, "fields": ["lon","lat","depth","mag","year","src","mt"],
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
| `id` | string (`events_m6.json` only) | ComCat event id (`https://earthquake.usgs.gov/earthquakes/eventpage/<id>`) |

## `cells/<h3>.json`

```json
{"h3": "...", "lat": 0, "lon": 0, "radius_km": 300,
 "sh": {"fmd_iscgem": [[m, n], ...], "fmd_comcat": [[m, n], ...],
        "mc_t_iscgem": [[y0, y1, n, mc|null], ...], "mc_t_comcat": [[y0, y1, n, mc|null], ...],
        "b_cutoff": [[mc, b, lo, hi, n], ...],
        "rate_years": [1973, 2026], "rate_iscgem_above_thr": [...], "rate_comcat_m45": [...],
        "stats": {...}},
 "dp": {...}}
```

- `fmd_*`: non-cumulative counts per 0.1 bin (ISC-GEM 1976–2021 in Mw; ComCat 1973–cut-off as served). The site
  derives the cumulative curve.
- `mc_t_iscgem`: MAXC + 0.2 in 10-year windows over 1904–2021; `mc_t_comcat`: 5-year windows, as served; `null`
  when a window has fewer than 50 events.
- `b_cutoff`: b for fixed cutoffs 5.0–7.0 (threshold max(cutoff, period floor)), Shi-Bolt ±1.96 σ, n ≥ 30.
- `rate_*`: yearly counts 1973–2026; ISC-GEM counts are events above their threshold (1976–2021 only).
- `stats`: the full output of the cell estimator (raw b, interval, Mc interval, quality) for that depth class.
- A depth key is absent when the circle holds fewer than 20 ISC-GEM and fewer than 50 ComCat events.

## `sequences.json`

`{"method": str, "synthetic_check": {...}, "sequences": [...]}`. Each sequence: `id`, `time` (ISO 8601 UTC),
`lat`, `lon`, `depth` (km), `mag`, `magtype`, `place`, `radius_km`, `mcat`, `n_window`, `n_fit`, `K`
(events/day ≥ Mcat), `c` (days), `p`, `sK`, `sc`, `sp` (standard errors), `b_seq`, `b_seq_source`, `contaminated`,
`c_resolved`, `quality` (`A`/`B`/`C`/`insufficient`), `rate_bins_days`, `rate_counts` (counts ≥ Mcat in log-spaced
day bins, for the decay chart).

## `global.json`

Chart-ready global series: `michael_periods`, `michael_pooled`, `b_cutoff_2004_2021`, `plate_boundary_types`,
`slab_age_groups`, `validation_table`, `floors`. Field names follow `results/validation.json`.

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
