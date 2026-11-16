# Method

Code: `scripts/seislib.py` (estimators), `scripts/atlaslib.py` (per-cell bootstrap), `scripts/atlas.py`
(map), `scripts/sequences.py` (Omori), `scripts/validate.py`. Configuration constants are in `scripts/common.py`.
Every number here is read from `results/*.json` produced by `scripts/run_all.sh`.

## 1. Spatial unit: H3 cells with a fixed sampling circle

**Choice.** H3 resolution-2 hexagons are used for display, counting and joins (mean area 86,802 km², 2,598 cells
contain events). The statistics of a cell (Mc, b) use all events within **300 km of the cell centre**, so
neighbouring estimates overlap, as in the ZMAP constant-radius approach (Wiemer & Wyss 2002).

**Trade-off.**

| | Fixed radius on a near-equal-area grid (chosen) | Nearest-N events |
|---|---|---|
| Spatial support | the same everywhere (π·300² ≈ 283,000 km²) | shrinks where seismicity is dense, grows where it is sparse |
| Sample size | varies, so the uncertainty varies (and is reported) | fixed, so the uncertainty is roughly constant |
| Comparing two places | same footprint: differences are not caused by resolution | a value may describe 50 km in Japan and 800 km in the mid-Atlantic |
| Sparse areas | honestly empty (b withheld) | always gives a number, mixing distant tectonic regimes |
| Web use | stable cell ids (H3), easy joins, h3-js on the client | needs per-node radii; no natural tiling |

The atlas is about **where the numbers can be trusted**. A fixed footprint with an honest "insufficient" is more
useful for that than a value everywhere. H3 cells are not exactly equal-area: their area varies by about a factor
of 2 at one resolution. Rates are therefore divided by each cell's own area (`area_km2`), and the sampling circle
does not depend on cell shape.

**Radius sensitivity.** Same pipeline, three radii (`results/validation.json`, `radius_sensitivity`):

| Radius | Shallow cells with b shown | Common cells with the 300 km run | Median \|Δb\| vs 300 km |
|---|---|---|---|
| 200 km | 78 | 77 | 0.044 |
| 300 km | 172 | – | – |
| 400 km | 329 | 172 | 0.040 |

Release 0.5.0 (relative-width mask, 1000 replicates). Where b is shown, it changes by about 0.04 (median) between
radii. The radius mainly decides how many cells
reach the sample size.

## 2. Catalogue and magnitude for b: ISC-GEM Mw, 1976–2021

- **b is computed only on ISC-GEM Mw.** It is the only open global catalogue with one magnitude scale. After 1976
  it is mostly direct Mw from the Global CMT project (Di Giacomo et al. 2015). Pre-1976 Mw values are mostly proxies
  converted from Ms and mb, so they are excluded from b. Since v0.2 the proxies of 1976–2021 are excluded too
  (§2.1).
- **Why ComCat is not used for b.** ComCat's preferred magnitude is mb for 80 % of M ≥ 4.5 events and Mw for the
  larger ones. A b-value fitted on that mixture depends on where the type switches.
- **Our Mw proxy.** Mw = 0.92 + 0.85 mb. The slope 0.85 is the published global value (Scordilis 2006). The
  intercept is the median of ISC-GEM Mw − 0.85 mb over 3,063 matched pairs at mb 5.5–6.2, the range where ≥ 80 %
  of ComCat mb events have an ISC-GEM match. Residual standard deviation: 0.23.
  - Below mb 5.5, ISC-GEM's own magnitude cut-off truncates the pairs, so they cannot calibrate a conversion.
  - A free orthogonal regression on the usable pairs gives slope 2.21. It is not used: mb saturates and the range
    is narrow.
- **Ms proxy.** Ms uses Scordilis' bilinear slopes, 0.67 (Ms ≤ 6.1) and 0.99 (above), with intercepts from our
  pairs: 2.058 (1,084 pairs) and 0.073 (471 pairs).
- **Test of the proxy (2004–2021, shallow, global).** At cutoffs 5.0–5.2, b from ComCat on the Mw proxy is
  1.35–1.40, while ISC-GEM gives 1.05–1.09 for the same years (`docs/img/val_b_cutoff.png`). The two agree only
  from 5.6 up: 1.077 vs 1.059. Any proxy slope rescales b directly (b_proxy = b_mb / slope).
  - Conclusion: **no b-value is computed from mb-converted magnitudes.** The proxy is used only to put ComCat-only
    events on a common scale in the event layer (code `mt` = 2).

## 2.1 Direct-Mw b sample (since v0.2)

**Rule.** Every b-value (map cells, declustered b, b-positive, the validation rows and the b(t) windows) uses only
ISC-GEM events of 1976–2021 whose Mw uncertainty is 0.10, i.e. direct Mw. Proxy Mw (converted from Ms or mb) are
left out. Rates, cell counts, Mc(t), the event layers and the Michael (2014) comparison keep every event. The
period floors (§3) are estimated on the same direct-Mw sample, so the thresholds match the sample. Code:
`common.b_sample_mask`. Switch: environment variable `ATLAS_B_MAGERR_MAX` (default `0.10`; `all` restores the v0.1
behaviour, every event). The validation outputs carry the all-events numbers next to the new ones
(`*_all_events` in `results/validation.json`, `results/val_literature.json`, `results/val_chile.json`).

**What ISC-GEM says about magnitude origin.**

- Catalogue overview (isc.ac.uk/iscgem/overview.php, read 2026-11-13): "Where possible we used Mw based on a
  reliable value of seismic moment" (GCMT, and a literature search for earlier events), and "Proxy Mw were used in
  all other cases (the majority)". *These two quotes came through a web-page summariser; they need a human check
  against the page.*
- The official CSV flags the origin per event. The v3.0 read-me (OasisHUB distribution, 2016-01-28 release) lists
  the columns "Mw – Moment Magnitude", "Mw Uncertainty", "Mw Quality : A (Highest) / B (Medium) / C (Lowest)",
  "Source : P = proxy ; d = direct computation" and "Scalar Moment author (mo_auth)". The current release (13.0)
  is handed out only through a request form, so its header was not checked.
- Di Giacomo, Engdahl & Storchak (2018, ESSD 10, 1877): "we largely list direct Mw from GCMT", with quality flags
  "from A to D". *Also through a summariser; needs a human check.*

**What the ComCat copy that we use contains.** Only `mag`, `magType`, `magError` and `magSource` describe the
magnitude. `magType` is `mw` and `magSource` is `iscgem` for all 74,153 events, so neither separates direct from
proxy. The ComCat QuakeML of an ISC-GEM event (checked for `iscgem652155`) holds the value, the uncertainty and
the type `mw`: no method, moment, quality or source flag. **The direct/proxy field does not exist in our copy.**
The uncertainty (`magError`, 0.10 to 0.70) is the best available marker.

**Why uncertainty 0.10 marks direct Mw in 1976–2021.** No event has an uncertainty between 0.10 and 0.20.

| Period | 0.10 | 0.20 | > 0.20 | All |
|---|---|---|---|---|
| 1900–1963 | 17 | 4,106 | 5,502 | 9,625 |
| 1964–1975 | 158 | 3,696 | 4,089 | 7,943 |
| 1976–2009 | 29,670 | 2,428 | 3,499 | 35,597 |
| 2010–2021 | 19,866 | 471 | 651 | 20,988 |

| Mw, 1976–2021 | 0.10 | 0.20 | > 0.20 | Share > 0.10 |
|---|---|---|---|---|
| < 5.6 | 35,481 | 2,308 | 2,786 | 12.6 % |
| 5.6–5.99 | 8,437 | 502 | 1,149 | 16.4 % |
| 6.0–6.49 | 3,855 | 77 | 188 | 6.4 % |
| 6.5–6.99 | 1,209 | 10 | 24 | 2.7 % |
| ≥ 7.0 | 554 | 2 | 3 | 0.9 % |

- The 0.10 class starts with the GCMT era: 175 events before 1976 (from 1962), 49,536 after.
- Cross-check against ComCat (matched pairs, 1976–2021). Of the 25,540 matched events whose ComCat magnitude comes
  from GCMT (`magSource` `hrv` 18,254, `gcmt` 7,282, `us_gcmt` 4), **25,532 (99.97 %) have ISC-GEM uncertainty
  0.10**. Of the 6,979 matched events with a larger uncertainty, only 8 have a GCMT magnitude in ComCat.
- Where ComCat has an Mwc/Mww value, it differs from ISC-GEM by a median 0.03 for uncertainty 0.10 (n = 25,068)
  and 0.17 for the rest (n = 35).
- Limits: 9,925 matched 0.10 events have an mb preferred magnitude in ComCat, so for them the GCMT link is not
  checked event by event. Before 1976 the classes do not map onto direct/proxy (literature Mw may carry 0.20), so
  the rule is used only for the 1976–2021 b period.

**Choice: leave proxies out (option a).** We compared three options: (a) direct Mw only, (b) weight by
uncertainty, (c) a Tinti–Mulargia correction for magnitude error.

- The published global references (Kagan 2002, 2010; Bird & Kagan 2004; Kagan & Jackson 2013) fit GCMT moment
  magnitudes only. The direct sample is the same population, and it is what ISC-GEM itself prefers.
- (c) does not fit the problem. Tinti & Mulargia (1985, BSSA 75(6)) show that Gaussian errors of constant size
  shift the a-value but leave b unbiased; the size-dependent correction moves a magnitude by only βσ²/2, about
  0.05–0.18 for σ = 0.2–0.4. The proxies alone give b = 1.736 [1.633, 1.850] (`results/val_literature.json`,
  1982–2008, m ≥ 5.6), far more than noise explains. The excess comes from *which* events got proxies (GCMT
  missed them; mostly near the threshold) and from regression conversion, which biases b (Castellaro, Mulargia &
  Kagan 2006, GJI 165, 913). We did not separate the two parts.
- (b) has no standard estimator to point to and would need its own validation; it was not adopted.

**Cost.** 7,049 of 56,585 events of 1976–2021 (12.5 %) leave the b sample. The direct sample is less complete at
small magnitudes in 1976–2003, so the shallow floors rise by 0.1 (§3). Shown shallow cells fell from 204 to 170 in
v0.2 (with the absolute-width mask of that release; 172 since the relative mask of 0.5.0, §4).

**b-positive after the change (resolved, `bpositive.md`).** In the 77 shallow cells with b and b-positive in
both versions, b fell by a median 0.022 while b-positive moved by +0.002. b-positive now lies inside the b
interval in 65 % of shown cells (88 % in v0.1). The floors are not the cause:
- raising them moves b by the same amount with or without the proxies;
- Mc-Lilliefors gives 5.8 for the direct sample of 1976–2003.

The left-out proxies are mostly early aftershocks (52 % of above-floor events in the first day after a larger
event, 4.4 % later). Leaving them out makes the direct sample transiently incomplete. On the same cells and
floors, Aki-Utsu b falls by 0.024 and shuffled (order-free) b-positive by 0.026. b-positive in time order falls
by only 0.011, because it is built to ignore transient incompleteness. No change to floors or estimator was
justified.

**Official file.** With the official CSV (`scripts/iscgem_official.py`), the per-event source column would be the
exact selector. The reader does not use it yet, because the current header could not be checked.

## 3. Completeness Mc, including its change over time

- **Estimator.** Maximum curvature + 0.2 (MAXC + 0.2; Woessner & Wiemer 2005). It is robust for samples of
  50–500 events. GFT (Wiemer & Wyss 2000) and MBS (Cao & Gao 2002) are computed for the global comparison.
  - MAXC tends to underestimate Mc and MBS to overestimate it (Mignan & Woessner 2012). The two together bracket
    the truth.
- **Global period floors**, per depth class, taken as max(MAXC + 0.2, MBS) of the global ISC-GEM direct-Mw
  events of the period (§2.1; v0.1 values on every event in brackets):

  | Depth | 1976–2003 | 2004–2021 |
  |---|---|---|
  | ≤ 70 km | **5.8** (MAXC 5.4, MBS 5.8, GFT 5.3; v0.1 5.7) | **5.3** (MAXC 5.2, MBS 5.3, GFT 5.0; v0.1 5.2) |
  | > 70 km | **5.4** (MAXC 5.4, MBS 5.3, GFT 5.2; v0.1 5.4) | **5.2** (MAXC 5.2, MBS 5.1, GFT 5.0; v0.1 5.4) |

- **Per-event threshold.** Each event's threshold is max(cell Mc, floor of its period). Cell Mc is the MAXC + 0.2
  of the sample in the circle. A cell can therefore raise the threshold where the network was worse than
  average, but never lower it below the global floor.
- **b with time-varying Mc.** Each event's excess over its own threshold is exponential with the same β
  (memoryless property), so β̂ = n / Σ(mᵢ − (thrᵢ − ΔM/2)). This is Aki-Utsu with a per-event Mc
  (`seislib.b_varmc`).
  - Synthetic test with two periods complete above 6.0 and above 5.2: the per-event version recovers b = 1. A
    single threshold at 5.2 is biased low by more than 3σ (`tests/test_atlaslib.py`).
- **Mc(t) shown per cell** (detail files):
  - ISC-GEM: MAXC + 0.2 in 10-year windows over 1904–2021.
  - ComCat as served: 5-year windows.
  - Each window needs ≥ 50 events.
- **Map layers.** `sh_mc_cc` (ComCat 2010–cut-off) and `sh_mc_cc0` (1973–1989) show how far the USGS M4.5+ feed
  is complete at each place, in its own (mostly mb) magnitude.
- **What an ISC-GEM Mc means.** ISC-GEM is a *selected* catalogue: events enter it above period-dependent
  inclusion thresholds (7.5 before 1918, 6.25 for 1918–1959 and 5.5 from 1960 in the first release; Di Giacomo,
  Engdahl & Storchak 2018, who warn that these thresholds are not completeness levels), and later releases added
  smaller events unevenly. A MAXC Mc of ISC-GEM therefore reflects the inclusion rule of the catalogue as much as,
  or more than, the sensitivity of the seismic networks. Read the ISC-GEM Mc of a cell, the period floors and the
  Mc comparison with Michael (2014) as "where this catalogue is complete", not as the detection capability of the
  networks at that place. The ComCat layers above are the closer measure of network completeness (in mb).

## 4. b-value, uncertainty and the mask

- **Estimator.** Aki-Utsu maximum likelihood with the ΔM/2 binning correction, on magnitudes binned to 0.1.
- **Uncertainty.** 1000 bootstrap resamples of the events in the circle (`atlaslib.NBOOT`; 200 until 0.4.0). Each
  replicate re-estimates the cell Mc, so the 95 % percentile interval includes the Mc uncertainty (Woessner &
  Wiemer 2005). Seeds are fixed (`atlas.py`: `RNG`). Why 1000: the bounds of a percentile interval are themselves
  random. In a test cell with 150 events (88 above threshold), the standard deviation of the lower and upper bound
  between 40 seeds was 0.012 and 0.024 at 200 replicates and 0.005 and 0.009 at 1000 (`tests/test_atlaslib.py`),
  small against the A/B/C limits. The declustered b, the validation intervals and the regional layers use 1000 too.
- **Mask (quality codes).** A b-value is published only when:
  - at least 50 events are above threshold, and
  - the **relative** width of the 95 % interval, (hi − lo) / b, is ≤ 0.30 (`A`) or ≤ 0.50 (`B`). The denominator
    is the point estimate b of the same sample (`atlaslib.quality`, `rel_width`; published as `*_ciwr`).

  A wider interval gives `C`: b is withheld and only the width is shown. Fewer than 50 events gives
  `insufficient`. This is the hard rule of the atlas: **no b-value without its interval and quality code.**
- **Why relative (since 0.5.0).** Until 0.4.0 the limits applied to the absolute width hi − lo. That width grows
  with b itself (about 2 × 1.96 × b / √n), so at the same number of events a high-b cell was masked more often
  than a low-b one, and the shown b-values were biased low. Synthetic cells with 70 events above a known
  threshold (`tests/test_atlaslib.py`, 200 cells per b, 1000 replicates):

  | True b | Shown, absolute rule | Mean shown b, absolute rule | Shown, relative rule | Mean shown b, relative rule |
  |---|---|---|---|---|
  | 0.8 | 97.5 % | 0.810 | 77.0 % | 0.817 |
  | 1.0 | 64.5 % | 0.972 | 73.0 % | 1.013 |
  | 1.25 | 14.5 % | 1.109 | 73.5 % | 1.261 |
  | 1.5 | 2.0 % | 1.242 | 74.0 % | 1.493 |

  The relative width is about 3.92 / √n whatever b is, so at a fixed number of events above the threshold the
  share shown no longer depends on b, and the shown means are unbiased within the Aki-Utsu small-sample bias
  (about b / n). **Remaining dependence:** at a fixed number of events above the *true* completeness, a high-b
  cell still passes less often, because the MAXC + 0.2 threshold removes a larger share of its events. In the
  validation synthetic cells with 100 events above the true Mc, the median number above the threshold was 70.5
  for b < 1.05 and 41.5 for b ≥ 1.05 (one period; 75 and 41 with two periods), so 47 % and 4 % of them were shown
  (`results/validation.json`, `synthetic`; `validation.md` §1). This is a property of the Mc rule, not of the mask,
  and it is not corrected.
- **Effect on the map** (`docs/changes-0.5.md`): shallow A/B/C 58/112/54 → 55/117/52 (shown 170 → 172); deeper
  24/49/14 → 12/59/16 (shown 73 → 71). The 1000 replicates alone moved shallow A/B to 53/117 and left the deeper
  counts unchanged; the rest is the relative mask. Deeper cells have b below 1, so for them the relative rule is
  stricter than the old absolute one.
- **Cutoff stability flag.** `*_unstable` is true when b at threshold + 0.2 and at + 0.4 both fall outside the
  interval, on the same side. It is true for 2.9 % of shown shallow cells (4.7 % in 0.4.0).
- **Finite-sample bias.** Marzocchi et al. (2020) show that b from small samples is biased and correlates with
  the largest event in the sample, so apparent spatial b contrasts need significance checks. Adjacent cells
  overlap and are not independent. The site should compare two places only through their intervals.

## 5. b-positive as a robustness check

b-positive (van der Elst 2021) is computed on successive positive magnitude differences ≥ 0.2, using events
above the period floor in time order. It is insensitive to the short-term incompleteness after large events.

- Shown cells: the median of b⁺ − b is +0.046 (v0.1, all events: +0.029).
- b⁺ falls inside the bootstrap interval of b in 67.5 % of cells (0.4.0: 64.9 %; v0.1: 87.8 %; `results/validation.json`,
  `cells_summary`). For iid Gutenberg-Richter data with the same cell sizes and floors, the share would be about
  96 % and the median b⁺ − b +0.005 to +0.008. The excess has two parts, both in `bpositive.md`:
  - Time order (v0.2 only). The direct-Mw sample misses early aftershocks, and b⁺ partly corrects for that.
  - Order-free (already in v0.1). It is 4–6 times larger outside subduction zones, which fits a magnitude
    distribution that bends at large M.
- Read a b⁺ well above b as a sign of aftershock gaps or a bending distribution, not of a wrong Mc.

## 6. Shallow vs deeper events, and declustering

- **Depth classes.** ≤ 70 km and > 70 km are mapped separately (`sh_*`, `dp_*`). The two populations have
  different b: globally, 1976–2021, direct Mw, b = 1.035 [1.018, 1.052] shallow (n = 15,725) and
  0.936 [0.911, 0.961] deeper (n = 4,976). (v0.1, every event: 1.043 and 0.969.)
  - For the comparison with Michael (2014) we used his 60 km split.
- **Declustering is not applied to the main b.** Gardner-Knopoff windows (as in ZMAP and OpenQuake) mark 51 % of
  ISC-GEM events as dependent. At M ≥ 6.5 the windows last years, so for a global M ≥ 5 catalogue they remove
  much more than aftershocks.
  - Global shallow b falls from 1.035 to 0.887 [0.867, 0.907].
  - Across shown cells, the median declustered-minus-full difference is −0.205.

  A declustered b therefore mostly reflects the window choice. The declustered b is still published per cell
  (`*_bdecl`, with its interval) so the effect can be seen, but the map shows the full catalogue.

## 7. Catalogue consistency per cell

Matched pairs (≤ 30 s, ≤ 100 km; 58,666 pairs) are assigned to the cell of the ISC-GEM epicentre. Per cell:

- `c_dmw`: median ComCat Mw-type minus ISC-GEM Mw.
- `c_dmb`: median ComCat mb minus ISC-GEM Mw.
- `c_dloc`: median epicentre difference.
- `c_ddep`: median depth difference.
- `c_gonly`: ISC-GEM events with no ComCat match.
- `c_conly`: ComCat Mw-proxy ≥ 6.0 events with no ISC-GEM match.

`c_flag` summarises them (see `data-schema.md`).

## 8. Rates

`rate_m6`: ISC-GEM Mw ≥ 6.0 events, 1964–2021, per year per 100,000 km² of the cell itself (no circle). M 6.0 is
at or above Michael's (2014) completeness for 1964–1975 (6.0) and later periods. The cell detail files add yearly
counts.

## 9. Omori-Utsu sequences

Mainshocks are ComCat M ≥ 7.5 since 1990, largest first. An event inside the space-time window of a larger chosen
mainshock is skipped; for example, the 2005 Nias M 8.6 falls inside the 2004 Sumatra window. 40 sequences are
kept.

- **Space-time window.** Radius max(100 km, L), with L = 10^(−2.44 + 0.59 M) km (Wells & Coppersmith 1994), and
  0–365 days after the mainshock.
- **Catalogue completeness Mcat.** MAXC + 0.2 of days 10–365, never below 4.5.
- **Fit.** Omori-Utsu MLE that keeps the early part of the sequence by modelling the time-dependent completeness
  Mc(t) = max(Mcat, Mm − 4.5 − 0.75 log₁₀ t) (Helmstetter et al. 2006; Page et al. 2016). The b used in that
  model is the sequence's b-positive.
- **Quality codes.**
  - `A`: n ≥ 100, σp ≤ 0.10, 0.5 ≤ p ≤ 2, and no second event within 0.5 units of the mainshock.
  - `B`: n ≥ 50, σp ≤ 0.20.
  - `C`: otherwise.
  - Result: 17 A, 10 B, 8 C, 5 insufficient (mostly deep mainshocks with few aftershocks).
- **`c_resolved`.** False for 7 of the 35 fits, where c < 0.001 day. A teleseismic catalogue misses the first hours, so c
  is not constrained there; p and K remain usable.
- **Synthetic check.** 20 teleseismic-like sequences (Mm 8, Mcat 4.5, true p 1.05, with Mc(t) losses) give mean
  p 1.063, between-run SD 0.025 and mean σp 0.028.

## 10. Limitations

1. **Catalogue cut-off.** The ComCat mirror of ISC-GEM ends in 2021. The b-map ignores 2022–2026 because only
   ComCat covers those years and its magnitudes are mixed (§2).
2. **Large footprint.** b and Mc are teleseismic-scale quantities (Mw ≥ 5.2–5.7) averaged over 300 km. They are
   not comparable to b-values from local networks at M 1–3, and they cannot resolve asperity-scale structure.
3. **Few trusted cells.** Only 172 shallow and 71 deeper cells pass the quality gate (0.5.0). Most of the world shows
   "insufficient". This is the honest result for a global M ≥ 5 catalogue, not missing work.
4. **Overlapping circles.** Neighbouring cells share events, so a smooth-looking pattern is partly
   autocorrelation.
5. **Boundary classes are approximate.** Each event gets the class of the nearest PB2002 step within 200 km.
   Bird & Kagan (2004) used a more careful assignment, and subduction-zone intraslab events can be mislabelled.
6. **ISC-GEM proxies.** The ComCat copy has no direct/proxy flag. Since v0.2 the b sample uses the magnitude
   uncertainty (0.10) as the marker (§2.1). It is checked against GCMT magnitudes in ComCat, not against ISC-GEM's
   own source column.
7. **Lower Mc than Michael (2014).** Our global Mc values are lower than his. This is expected because the
   catalogue has changed since his v1 analysis (§ validation), but it means our floors are less conservative
   than his.
8. **No forecast, no hazard.** The atlas describes catalogue statistics. It is not an earthquake forecast and
   not a seismic hazard model.
