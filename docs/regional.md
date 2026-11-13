# Regional layers

The global layer uses ISC-GEM Mw with completeness 5.2–5.7, so only 274 cells carry a b-value. Regional networks
are complete one to three magnitude units lower inside their footprint, which gives many more events per km² and a
much finer map. Four regional layers are built: **Italy, New Zealand, Southern California and Iceland**.

> **Regional layers are shown separately and are never merged with the global cells.** Each layer uses its network's
> own local magnitude (ML or MLv), and these are not moment magnitude. A regional b-value at ML 1.5 and a global
> b-value at Mw 5.5 measure different parts of the magnitude range on different scales.

Code: `scripts/regional/` (`regions.py` configuration, `fetch_regional.py` clients, `regionlib.py` estimator,
`build_regional.py` layers, `validate_regional.py` validation numbers). Tests: `tests/test_regional.py`.
Every number below was produced by `build_regional.py` and `validate_regional.py` (see "Reproduce").

__RESULTS__

## Method

### Catalogues and one magnitude type per region

| Region | Source | Window | Magnitude used | Filters |
|---|---|---|---|---|
| Italy | INGV FDSN event service (ISIDe) | 2010–2025 | ML | authors `BULLETIN-INGV`, `BULLETIN-SISPICK`, `SURVEY-INGV`; natural events only |
| New Zealand | GeoNet FDSN event service | 2013–2025 | GeoNet `M` / `MLv` | natural or unclassified events |
| Southern California | USGS ComCat, `catalog=ci` (SCSN) | 2006–2025 | ML (`ml`) | reviewed events only |
| Iceland | IMO Quakes API, SeisComP system | 2020-01-01 to 2026-10-31 | SeisComP local magnitude | reviewed (`manual`) events only; depth 0–40 km |

- **Largest events.** Networks report Mw (or mB) as the preferred magnitude of their largest events. Dropping those
  events would cut the top of the frequency-magnitude distribution and bias b upward; keeping them would mix two
  scales. For every such event the network's own local magnitude is read from the per-event QuakeML (all magnitudes;
  INGV and GeoNet event services, SCEDC event service for SCSN) and used instead. Counts are in the results table.
- **Small events with another local type** are excluded and counted: Italy `Md` (duration magnitude, median 1.3,
  mostly central Italy and the volcanic areas), Southern California `mh` (analyst-assigned) below 2.0. They are small,
  so they mainly reduce the counts below Mc.
- **Italy:** INGV reviews its bulletin with a delay of a year or more. Recent events are `SURVEY-INGV` (located and
  checked by the surveillance room), older ones `BULLETIN-INGV`. Both are used. Foreign-agency solutions (CSEM, USGS)
  and the local observatory solutions with Md are not.
- **New Zealand:** since the 2012 move to SeisComP, GeoNet's preferred magnitude is the summary magnitude `M`
  (2012–2022) and then `MLv`. For small events `M` equals `MLv` (checked on the QuakeML of sample events). The window
  starts in 2013 to stay inside the SeisComP era; the pre-2012 legacy `ML` is not used. GeoNet has since published a
  revised local magnitude (MLNZ20, Rhoades et al. 2021) that is not served by the FDSN service, so it is not used.
- **Southern California:** SCSN `ml` is the preferred magnitude of at least 96.7 % of the events in every year from
  2006 on (counted from the download). Before 2006 a
  large share is `mh` or `mc`, so the window starts in 2006. Northern California (NCSN, duration magnitude Md) is not
  included, so the layer is called Southern California.
- **Iceland:** only the SeisComP system's reviewed events. The legacy SIL magnitudes are about 0.6 higher for the same
  events (median of 49,531 matched events), so the two systems are never mixed. Reviewed SeisComP events exist from
  2020 on; the SIL system stopped in early 2026.

### Cells

- **Display cells:** H3 resolution 4 (mean area about 1,770 km², edge about 23 km) for Italy, New Zealand and
  Southern California; resolution 5 (about 250 km², edge about 9 km) for Iceland, whose plate-boundary zones are
  narrow (tens of km).
- **Sampling circle:** 30 km around the cell centre (15 km in Iceland). The circle is about 1.6 (Iceland 2.8) times
  the cell area, so neighbouring cells overlap, as in the global layer.
- **Why these resolutions.** With Mc 1–2.5, a 30 km circle holds a few hundred to tens of thousands of events in the
  active areas, enough for the A/B gate, while still separating the main fault systems. Resolution 5 everywhere would
  give about 7 times more cells, most with too few events, and much larger files; resolution 3 (edge about 60 km)
  would average across different tectonic units. Iceland's seismicity is dense and confined to narrow zones, so it
  gets resolution 5 with a 15 km circle.
- A cell is drawn when it holds at least 3 events; a detail file is written when the circle holds at least 50 events.

### Time-varying completeness

The global estimator uses one cell Mc plus a global floor per period. Regional networks changed faster and differ
more from place to place, so here **Mc is estimated per cell and per period** (`regionlib.cell_b_tv`):

- Periods: Italy 2010–13, 2014–17, 2018–21, 2022–25; New Zealand 2013–16, 2017–20, 2021–25; Southern California
  2006–09, 2010–13, 2014–17, 2018–21, 2022–25; Iceland 2020–21, 2022–23, 2024–26.
- Mc of a period = MAXC + 0.2 of the circle's events in that period, when the period holds ≥ 50 events. Otherwise
  max(MAXC + 0.2 of all the circle's events, regional floor of that period); the regional floor is
  max(MAXC + 0.2, MBS) of all the region's events in the period, as for the global floors.
- Each event's threshold is the Mc of its period, and b is the Aki-Utsu estimate with per-event thresholds
  (`seislib.b_varmc`, unchanged).
- **Uncertainty:** 200 bootstrap replicates, resampling events within each period (stratified). Every period Mc is
  re-estimated in every replicate, so the 95 % interval includes the Mc uncertainty.
- **Quality gate:** the global one, unchanged (`atlaslib.quality`): `A` interval ≤ 0.30, `B` ≤ 0.50, `C` wider (b
  withheld), `insufficient` fewer than 50 events above threshold.
- **Reported Mc** (`*_mc`) is the Mc of the **latest period**, with its bootstrap interval. The Mc of each period is in
  the detail file (`mc_periods`).
- b-positive (van der Elst 2021) uses the events above their own threshold in time order. Declustered b uses
  Gardner-Knopoff windows on the regional catalogue, as in the global layer.
- **Depth classes:** `sh` ≤ 70 km and `dp` > 70 km for Italy (southern Tyrrhenian slab) and New Zealand (Hikurangi
  and Fiordland slabs). Southern California and Iceland have only `sh`.

## Validation

__VALIDATION__

## Data contract (`site/data/regional/`)

`index.json`:

```json
{"regions": [{"id": "italy", "name": "Italy", "bbox": [w, s, e, n], "catalogue": "...", "licence": "CC BY 4.0",
              "attribution": "...", "source_url": "...", "period": ["2010-01-01", "2025-12-31"],
              "mc_typical": 1.5, "magtype": "...", "mc_periods": [[2010, 2013], ...], "h3_res": 4,
              "radius_km": 30, "n_events": 0, "n_cells": 0, "quality_counts": {...}, "depth_classes": ["sh", "dp"],
              "cells": "regional/italy/cells.geojson", "cell_detail_dir": "regional/italy/cells/",
              "summary": "regional/italy/summary.json", "bytes": 0}]}
```

- `mc_typical`: median Mc of the latest period over cells whose circle holds ≥ 50 events in that period.
- `period`: inclusive first and last day of the analysed window.

`regional/<id>/cells.geojson`: one Polygon per H3 cell, null-valued properties omitted (as in the global layer).

| Property | Meaning |
|---|---|
| `id`, `lat`, `lon`, `area_km2` | H3 index (resolution in `index.json`), centre, area |
| `n` | events in the cell itself (all depths) |
| `magtype` | magnitude type of the region (`ML`, `M`, `ml`, `ML_seiscomp`); the full label is in `index.json` |
| `detail` | `cells/<id>.json` exists |
| `d_n`, `d_nb` | events in the sampling circle; events above their threshold (`d` = `sh` or `dp`) |
| `d_mc`, `d_mc_lo`, `d_mc_hi` | Mc of the latest period and its bootstrap 95 % interval |
| `d_b`, `d_b_lo`, `d_b_hi` | b and its bootstrap 95 % interval; only when `d_q` is `A` or `B` |
| `d_q`, `d_ciw`, `d_unstable` | quality code, interval width (also for `C`), cutoff-stability flag: same meaning as global |
| `d_bpos`, `d_bpos_lo`, `d_bpos_hi` | b-positive ± 1.96 σ; only when `d_q` is `A` or `B` |
| `d_bdecl`, `d_bdecl_lo`, `d_bdecl_hi` | b after Gardner-Knopoff declustering, bootstrap 95 %; only when `d_q` is `A` or `B` |

The global properties `n_iscgem`, `n_comcat`, `rate_m6`, `pb`, `d_mc_cc*` and `c_*` (ISC-GEM/ComCat comparison) have
no regional equivalent and are absent.

`regional/<id>/cells/<h3>.json`:

```json
{"h3": "...", "lat": 0, "lon": 0, "radius_km": 30, "magtype": "...", "periods": [[2010, 2013], ...],
 "sh": {"fmd": [[m, n], ...], "mc_t": [[y0, y1, n, mc|null], ...], "mc_periods": [[y0, y1, n, mc], ...],
        "b_cutoff": [[mc, b, lo, hi, n], ...], "rate_years": [2010, 2025], "rate_above_thr": [...],
        "rate_all": [...], "stats": {...}},
 "dp": {...}}
```

- `fmd`: non-cumulative counts per 0.1 bin in the region's magnitude (the global files have `fmd_iscgem` and
  `fmd_comcat`; a regional file has one catalogue).
- `mc_t`: MAXC + 0.2 per calendar year (`null` below 50 events). `mc_periods`: the Mc actually used per period.
- `b_cutoff`: Aki-Utsu b for fixed cutoffs from the lowest period Mc − 0.3 to + 2.0, Shi-Bolt ± 1.96 σ, n ≥ 30.
- `rate_above_thr`: yearly counts above the per-event threshold; `rate_all`: all events in the circle.
- `stats`: the full estimator output (raw b, interval, Mc per period, b at threshold +0.2 and +0.4, b-positive,
  declustered b).
- A depth key is present when its circle holds at least 50 events.

`regional/<id>/summary.json`: counts and filters, regional floors, region-wide b at fixed thresholds per period,
cell quality counts, Mc distribution and the validation checkpoints.

## Licences and attribution

| Region | Licence | Attribution |
|---|---|---|
| Italy | CC BY 4.0 (stated on terremoti.ingv.it) | ISIDe Working Group (2007), Italian Seismological Instrumental and Parametric Database, INGV, doi:10.13127/ISIDE |
| New Zealand | CC BY 3.0 NZ (stated on geonet.org.nz/policy) | GeoNet Aotearoa New Zealand Earthquake Catalogue, doi:10.21420/0S8P-TZ38; "We acknowledge the New Zealand GeoNet programme and its sponsors NHC, Earth Sciences NZ, LINZ, NEMA and MBIE for providing data used in this study." |
| Southern California | public domain (USGS ComCat) | U.S. Geological Survey; Caltech (1926) Southern California Seismic Network, doi:10.7914/SN/CI; SCEDC (2013), doi:10.7909/C3WD3xH1 |
| Iceland | CC BY 4.0 (stated in the Quakes API OpenAPI document) | Icelandic Met Office (Veðurstofa Íslands), Quakes API, with the download date |

All four allow redistribution of derived data with attribution, so the regional files are published under the
repository's data licence (CC BY-SA 4.0) with the attributions above.

## Reproduce

```bash
.venv/bin/python -I scripts/regional/build_regional.py            # all regions; downloads are cached
.venv/bin/python -I scripts/regional/build_regional.py italy --no-fetch
.venv/bin/python -I scripts/regional/validate_regional.py > /tmp/regional_validation.json
```

`scripts/run_all.sh` runs the regional build after the global layers. Set `SKIP_REGIONAL=1` to skip it. If a
regional service is down, that region is skipped, its previous output is kept and the run continues.

- The first run downloads about 1,000 monthly chunks and about 3,000 per-event magnitude records. INGV's per-event
  QuakeML includes every station amplitude, so the client stops reading each response after the magnitudes.
  Requests are sequential per service, with at most 3 parallel per-event requests and a pause after each.
- Raw responses are cached in `data/raw/regional/<id>/` (not in git).
