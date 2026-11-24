# Regional layers

The global layer uses ISC-GEM Mw with completeness 5.2–6.3, so only 202 cells carry a b-value. Regional networks
are complete one to three magnitude units lower inside their footprint, which gives many more events per km² and a
much finer map. Four regional layers are built: **Italy, New Zealand, Southern California and Iceland**.

> **Regional layers are shown separately and are never merged with the global cells.** Each layer uses its network's
> own local magnitude (ML or MLv), and these are not moment magnitude. A regional b-value at ML 1.5 and a global
> b-value at Mw 5.5 measure different parts of the magnitude range on different scales.

Code: `scripts/regional/` (`regions.py` configuration, `fetch_regional.py` clients, `regionlib.py` estimator,
`build_regional.py` layers, `validate_regional.py` validation numbers). Tests: `tests/test_regional.py`.
Every number below was produced by `build_regional.py` and `validate_regional.py` (see "Reproduce").

## Results (built 2026-11-13)

| Region | Events used | Window | Mc, latest period: median (p10–p90) | Cells drawn | b shown (A / B), shallow | b shown, deeper | Detail files | Size |
|---|---|---|---|---|---|---|---|---|
| Italy | 265,071 | 2010–2025 | ML 1.5 (1.2–2.1) | 408 | 142 (87 / 55) | 6 (3 / 3) | 221 | 0.66 MB |
| New Zealand | 234,331 | 2013–2025 | M/MLv 2.2 (1.8–2.8) | 387 | 144 (106 / 38) | 54 (34 / 20) | 245 | 0.81 MB |
| Southern California | 197,092 | 2006–2025 | ML 1.4 (1.3–1.9) | 132 | 71 (53 / 18) | – | 107 | 0.31 MB |
| Iceland | 244,008 | 2020-01 to 2026-10 | SeisComP ML 0.8 (0.0–1.5) | 326 | 150 (109 / 41) | – | 230 | 0.61 MB |

For comparison, the global layer shows b in 136 shallow and 66 deeper cells for the whole world. Mc statistics use
cells whose circle holds ≥ 50 events in the latest period (Italy 139, New Zealand 164, Southern California 64,
Iceland 186 cells).

| Region | Median cell b (p10–p90) | b⁺ − b, median | b⁺ inside the 95 % interval | b(thr + 0.2) − b, median | Cutoff-unstable cells |
|---|---|---|---|---|---|
| Italy, shallow | 1.01 (0.84–1.20) | +0.105 | 45.8 % | +0.051 | 15.5 % |
| New Zealand, shallow | 1.03 (0.88–1.26) | +0.061 | 52.9 % | +0.024 | 16.7 % |
| New Zealand, deeper | 1.15 (1.02–1.40) | −0.009 | 72.9 % | +0.017 | 1.9 % |
| Southern California | 0.94 (0.81–1.05) | +0.037 | 64.5 % | +0.008 | 2.8 % |
| Iceland | 0.97 (0.72–1.28) | +0.167 | 22.1 % | +0.050 | 31.3 % |
| Global layer, shallow (reference) | – | +0.041 | 88.0 % | – | 0.7 % |

How to read this:

- The regional intervals are narrow (thousands of events per cell), so small systematic effects that the global layer
  hides inside wide intervals become visible here. b-positive falls inside the interval far less often than in the
  global layer.
- **b-positive is higher than b in every shallow layer,** and b rises when the threshold is raised by 0.2. Both point
  to remaining incompleteness just above MAXC + 0.2 (Mignan & Woessner 2012 note that MAXC + 0.2 can still
  underestimate Mc). The effect is small in Southern California (+0.04) and New Zealand (+0.06), moderate in Italy
  (+0.10) and large in Iceland (+0.17).
- **Iceland:** region-wide b at fixed thresholds is 0.62 [0.62, 0.62] at 0.5, 0.74 [0.74, 0.75] at 1.0 and
  0.80 [0.79, 0.81] at 1.5. The frequency-magnitude distribution of the SeisComP magnitudes is curved, so an Iceland
  b-value depends on the cutoff, and a third of the shown cells are flagged cutoff-unstable. Compare Iceland cells with
  each other and with b-positive, not with b from other networks.
- Declustered b is lower than b in every layer (median −0.10 to −0.27), as in the global layer: Gardner-Knopoff windows
  remove many small events after larger ones.

### Magnitude bookkeeping

| Region | Events with Mw/mB as preferred magnitude, replaced by the network's local magnitude | Excluded (other magnitude type) |
|---|---|---|
| Italy | 684 (ML 2.3–6.4; median Mw − ML = −0.10) | 10,173 Md |
| New Zealand | 369 (MLv 1.0–5.1; median preferred − MLv = +0.03) | 413 without an acceptable MLv (preferred ML 348, Mw(mB) 61, other 4), including 31 whose MLv differs from the preferred value by more than 1 |
| Southern California | 1,264 (ML 1.0–6.8; median preferred − ML = −0.13) | 2,229 `mh`: 1,879 below 2.0 (not looked up) and 350 at ≥ 2.0 without an acceptable ML (10 differ by more than 1); 3 other |
| Iceland | none needed (one magnitude system) | none |

Including the excluded events as if they were on the same scale changes the region-wide shallow b by at most 0.005
(Italy at ML ≥ 2.0: 1.013 → 1.017; New Zealand at 3.0: 0.876 → 0.872; Southern California at 1.8: 0.809 → 0.811).

### Region-wide b at fixed thresholds (stability of the magnitude scale over time)

| Region, threshold | Whole window | By period |
|---|---|---|
| Italy, ML ≥ 2.0 | 1.013 [1.004, 1.022], n = 42,475 | 2010–13 0.976, 2014–17 1.046, 2018–21 0.999, 2022–25 0.984 |
| New Zealand, ≥ 3.0 | 0.876 [0.864, 0.888], n = 18,315 | 2013–16 0.823, 2017–20 0.961, 2021–25 0.891 |
| Southern California, ML ≥ 3.0 | 0.921 [0.898, 0.944], n = 6,033 | 2006–09 0.953, 2010–13 0.960, 2014–17 1.028, 2018–21 0.851, 2022–25 0.905 |
| Iceland, ≥ 1.0 | 0.742 [0.736, 0.747], n = 59,018 | 2020–21 0.711, 2022–23 0.720, 2024–26 0.817 |

- New Zealand's switch of the preferred magnitude from `M` to `MLv` in 2022 shows no consistent step: at 2.5 the
  2013–16 and 2021–25 values agree (0.862 and 0.850); at 3.0 the later period is 0.07 higher (0.823 and 0.891). The
  higher 2017–20 value falls in the years after the Kaikōura earthquake.
- Region-wide values at one fixed threshold include areas that are not complete at that threshold (for example
  offshore New Zealand), so they are lower than the cell values. They are a stability check, not the regional b.


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
  INGV and GeoNet event services, SCEDC event service for SCSN) and used instead. A local value more than 1 unit
  from the preferred one is rejected and the event excluded. Counts are in the results section.
- **Small events with another local type** are excluded and counted: Italy `Md` (duration magnitude; 10,173 events, median 1.3,
  mostly central Italy), Southern California `mh` (analyst-assigned) below 2.0 (1,879 events) and New Zealand events
  whose QuakeML has no `MLv`. They are small,
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
- **Sequences.** Inside a period, a cell with many events is cut into consecutive windows of 200 events (a shorter
  remainder joins the previous window), and each window gets its own MAXC + 0.2. During an intense aftershock
  sequence a window lasts hours to days, so its Mc follows the short-term incompleteness after the mainshock; in
  quiet cells the window is the whole period. Without these windows b was strongly biased low in sequence cells
  (with b-positive as the reference, on the same events): 2019 Ridgecrest b 0.62 (b-positive 0.93), Reykjanes
  0.55 (0.92), Norcia 1.10 (1.32); with 200-event windows 0.88 (0.98), 0.80 (0.99) and 1.25 (1.34). Cells without a
  large sequence changed by less than 0.02 (Wellington, Gisborne, Los Angeles, Hengill). Numbers from a test run on
  the same circles, not stored in the outputs.
- Each event's threshold is the Mc of its window, and b is the binned maximum-likelihood estimate with per-event
  thresholds (`seislib.b_varmc`, as in the global layer; Aki-Utsu until 0.5.0).
- **Uncertainty:** 1000 bootstrap replicates since 0.5.0 (200 before), resampling events within each window (stratified). Every window Mc is
  re-estimated in every replicate, so the 95 % interval includes the Mc uncertainty.
- **Quality gate:** the global one (`atlaslib.quality`): since 0.5.0 on the relative width (hi − lo) / b, `A` ≤ 0.30,
  `B` ≤ 0.50, `C` wider (b withheld), `insufficient` fewer than 50 events above threshold. Until 0.4.0 the limits
  applied to the absolute width (`method.md` §4).
- **Reported Mc** (`*_mc`) is MAXC + 0.2 of the **latest calendar period**, with its bootstrap interval. It is
  published only when that period holds ≥ 50 events in the circle (otherwise it would be a fallback, not a
  measurement). The Mc of each period is in the detail file (`mc_periods`).
- b-positive (van der Elst 2021) uses the events above their own threshold in time order. Declustered b uses
  Gardner-Knopoff windows on the regional catalogue, as in the global layer.
- **Depth classes:** `sh` ≤ 70 km and `dp` > 70 km for Italy (southern Tyrrhenian slab) and New Zealand (Hikurangi
  and Fiordland slabs). Southern California and Iceland have only `sh`.

## Validation

Published values were checked against the papers' own abstracts or text where possible; "unverified" marks a value
read only from a search excerpt, because the full text could not be opened.

| Test | Ours | Published | Verdict |
|---|---|---|---|
| Italy, b | region-wide ML ≥ 2.0, 2010–2025: **1.013 [1.004, 1.022]**; periods 0.98–1.05; median cell 1.01 | b ≈ 1 for Italy; 0.97 at Mc 2.0, 2005–2022, INGV catalogue (GNGTS 2022 conference abstract, not peer reviewed) | **match** with b ≈ 1; 0.04 above the abstract's value (different window and method) |
| Italy, Mc | 2010–2013: all 127 measured cells ≤ 2.5 (median 1.6, p90 2.1) | network complete at M 2.9 for the whole territory except Sardinia, Pantelleria and Lampedusa; southern Apulia and western Sicily may miss M 2.5 (Schorlemmer et al. 2010, JGR 115, doi:10.1029/2008JB006097; PMC method, network from 2005) | **consistent** where events occur (MAXC + 0.2 is lower than the conservative PMC detection threshold); southern Apulia, western Sicily and Sardinia **not testable**: Trapani cell 17 events, no cell at Lecce or Cagliari |
| New Zealand, Mc, northern Hikurangi | Gisborne cell **1.9 [1.9, 2.1]** (periods 2.0 / 2.1 / 1.9); offshore cell 98 events in 13 years | GeoNet Mc 1.8 onshore, 2.2 offshore (Yarce et al. 2019, JGR, doi:10.1029/2018JB017211; unverified) | **match** onshore (within 0.1); offshore **not testable** (MAXC + 0.2 of all 98 events: 2.5) |
| New Zealand, Mc, central Alpine Fault | 56 events in the circle (≥ 1.5), fewer than 50 per period; MAXC + 0.2 of all: 2.3 | GeoNet Mc 2.6 (Michailos et al. 2019, G-cubed; unverified) | **not testable** (too few events) |
| New Zealand, b | median cell 1.03 (0.88–1.26), shallow; deeper 1.15 | mean b > 1.0 for GeoNet 2009–2023 (Wang et al. 2025, JGR, doi:10.1029/2025JB031441; unverified). The 2022 NZ NSHM b-values (Gerstenberger et al. 2024, BSSA 114(1)) could not be read | **reference only** (no verified number) |
| Southern California, b | ML ≥ 3.0: 2006–09 **0.953 [0.889, 1.022]**, 2010–13 **0.960 [0.922, 0.999]**, whole 2006–2025 **0.921 [0.898, 0.944]**; median cell 0.94 | "average b-value of ~1.0", SCSN 1932–2008 (Hutton, Woessner & Hauksson 2010, BSSA 100(2), 423–446, doi:10.1785/0120090130) | **match** for 2006–2009 (1.0 inside the interval); 2010–2013 just below (upper bound 0.999); **lower** over the full window, driven by 2018–2021 (0.851, the Ridgecrest sequence) |
| Southern California, Mc | 2006–2009 cells: median 1.55, p10 1.3, p90 2.25 | Mc "~1.8 at present [2008], or better in the most densely instrumented areas" (Hutton et al. 2010) | **match** (our lowest possible Mc is 1.2 because the download starts at 1.0) |
| Iceland, Mc along the rift | 2020–21: Reykjanes 0.1, Hengill 0.4, South Iceland Seismic Zone 0.5; 2024–26: −0.3, 0.1, 0.5 (SeisComP scale) | Mc 0.5–1.0 along the rift, 1991–2013, SIL scale (Panzera et al. 2017, J. Seismol. 21, doi:10.1007/s10950-016-9623-3; unverified); ≈ −0.1 to 0.4 after the −0.62 SIL → SeisComP shift | **consistent** within about 0.2 (indicative: different periods and a scale shift) |
| Iceland, b at Hengill | **0.825 [0.799, 0.851]** | ≈ 0.87, Hengill and western South Iceland Seismic Zone, SIL (IMO report 05015, 2005; unverified) | **close** (0.05 lower; different scale and period; indicative only) |
| Synthetic: Mc drops 2.5 → 1.5 between two periods (3,000 events) | b within 0.06 of the true 1.0; a single threshold at the late Mc is biased low beyond the interval | true b = 1 | **match** (`tests/test_regional.py`) |
| Synthetic: 60 cells, two periods, b 0.8 / 1.0 / 1.2 | 95 % interval covers the truth in 96.7 % of cells; median error −0.010 | true b | **match** |
| Synthetic: sequence onset complete only above 2.2 within a period complete above 1.0 | b 0.556 without windows, 0.974 with 200-event windows | true b = 1 | **match** with windows |

What these tests can and cannot show:

- None of the published regional values uses exactly our window, magnitude and method, so "match" means agreement
  within the stated uncertainty or within 0.1 in Mc, not a reproduction.
- MAXC + 0.2 measures completeness only where earthquakes occur. It cannot test the detection threshold of quiet
  areas, which is what Schorlemmer et al. (2010) mapped with PMC.
- No peer-reviewed Italy-wide b-value with an interval, no verified New Zealand b-value and no verified Iceland number
  could be read; those rows are marked.


## Data contract (`site/data/regional/`)

`index.json`:

```json
{"regions": [{"id": "italy", "name": "Italy", "bbox": [w, s, e, n], "catalogue": "...", "licence": "CC BY 4.0",
              "attribution": "...", "source_url": "...", "fetched_utc": "2026-11-13T10:22:20Z",
              "period": ["2010-01-01", "2025-12-31"],
              "mc_typical": 1.5, "magtype": "...", "mc_periods": [[2010, 2013], ...], "h3_res": 4,
              "radius_km": 30, "n_events": 0, "n_cells": 0, "quality_counts": {...}, "depth_classes": ["sh", "dp"],
              "cells": "regional/italy/cells.geojson", "cell_detail_dir": "regional/italy/cells/",
              "summary": "regional/italy/summary.json", "bytes": 0}]}
```

- `fetched_utc`: time of the latest download of the region's catalogue, read from
  `data/raw/regional/<id>/manifest.jsonl` (the IMO terms ask for the date of data downloading, so the Iceland
  attribution repeats the date).
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
| `d_q`, `d_ciw`, `d_ciwr`, `d_unstable` | quality code, absolute and relative interval width (also for `C`; `d_ciwr` since 0.5.0), cutoff-stability flag: same meaning as global |
| `d_bpos`, `d_bpos_lo`, `d_bpos_hi` | b-positive ± 1.96 σ; only when `d_q` is `A` or `B` |
| `d_bdecl`, `d_bdecl_lo`, `d_bdecl_hi` | b after Gardner-Knopoff declustering (per depth layer), bootstrap 95 %; only when `d_q` is `A` or `B` and the declustered sample's own `d_qdecl` is `A` or `B` (since 0.6.0) |
| `d_qdecl` | quality code of the declustered sample, same rule as `d_q`; only when `d_q` is `A` or `B`, so a code `A`/`B` always comes with its `d_bdecl` (since 0.6.0; the first 0.6.0 data also gave it for a masked main b: Iceland `85074543fffffff` had `sh_q` C, `sh_qdecl` B and no `sh_bdecl`) |

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
- `b_cutoff`: b (binned maximum likelihood, `seislib.b_aki`) for fixed cutoffs from the lowest period Mc − 0.3 to + 2.0, Shi-Bolt ± 1.96 σ, n ≥ 30.
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
| Southern California | no licence stated: the SCSN catalogue is a joint Caltech and USGS product, and neither the SCEDC citation page nor the DataCite records of the two DOIs give a licence (only a citation request) | Southern California Seismic Network (Caltech and USGS) via USGS ComCat, `catalog=ci`, and SCEDC magnitudes; California Institute of Technology (Caltech) (1926), Southern California Seismic Network, doi:10.7914/SN/CI; SCEDC (2013), Southern California Earthquake Data Center, Caltech, doi:10.7909/C3WD3xH1 |
| Iceland | CC BY 4.0 (stated in the Quakes API OpenAPI document); IMO terms of use ask for the date of data downloading | Icelandic Met Office (Veðurstofa Íslands), Quakes API, with the download date (`fetched_utc`; 2026-11-13 for the current files) |

Italy, New Zealand and Iceland allow redistribution of derived data with attribution, so those regional files are
published under the repository's data licence (CC BY-SA 4.0) with the attributions above. For Southern California the
regional files hold only our derived cell statistics, published under the same statement with the citations the
operators request; the operators state no licence for the catalogue itself, so it is not labelled public domain.

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

## Comparison with the HD b map of Italy (added 2026-11-14)

The Italy layer was compared cell by cell with the weighted-likelihood ("high-definition") b map of Taroni, Zhuang &
Marzocchi (2021, SRL 92(6), doi:10.1785/0220210017), recomputed from the authors' released catalogue (HORUS subset,
Mw proxy, 1960–2019) at our cell centres, and checked for the quarry-blast bias raised by Gulia, Gasperini & Wiemer
(2022, SRL, doi:10.1785/0220210159). Full method, tables and figure: [comparisons.md](comparisons.md) §1–2.

| Check | Result |
|---|---|
| Reproduction of their whole-catalogue B | 1.046 ± 0.004 from 56,309 events (published 1.04, same event count) |
| Ours vs HD b, 122 shown shallow cells inside their study area | Spearman 0.60, Pearson 0.63, median difference (HD − ours) −0.029, RMS 0.12 |
| Same comparison, 2010–2019 in both | Spearman 0.61, median +0.012 |
| HD estimator on our own events (method effect only), 142 cells | Spearman 0.58, median +0.071 |
| Their significant high-b cells (23) | ours above the median in 15, below in none |
| Their significant low-b cells (52) | ours below the median in 14, above in 1 |
| Largest differences | central Alps (46.1 N 10.4 E: ours 1.60, HD 1.04), Po Plain / northern Apennines (ours 1.0–1.2, HD 0.79–0.89) and Sicily |
| Day/night ratio of the events used, 142 cells | median 0.99 (p10–p90 0.82–1.26); 4 cells > 1.5; no correlation with b (r = 0.04) |
| b from night-time events only, 101 cells with A/B | median change −0.006; 12 outside the all-hours interval |
| Single-Mc estimator (pybvalue method, MAXC + 0.2) on the same circles | Spearman 0.86, median 0.000, 130 of 141 inside our interval |

Reading: the large-scale pattern agrees; individual cells differ by about 0.1, mostly because of the completeness
model (a local MAXC + 0.2 here, one Mc per period for all of Italy there), so cell-level differences of that size
should not be interpreted. With the INGV event-type filter (2,507 flagged quarry blasts excluded) no day-time excess
is visible in the shown cells.
