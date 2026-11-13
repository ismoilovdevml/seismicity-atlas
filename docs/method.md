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
| 200 km | 83 | 83 | 0.035 |
| 300 km | 204 | – | – |
| 400 km | 345 | 202 | 0.039 |

Where b is shown, it changes by less than 0.04 (median) between radii. The radius mainly decides how many cells
reach the sample size.

## 2. Catalogue and magnitude for b: ISC-GEM Mw, 1976–2021

- **b is computed only on ISC-GEM Mw.** It is the only open global catalogue with one magnitude scale. After 1976
  it is mostly direct Mw from the Global CMT project (Di Giacomo et al. 2015). Pre-1976 Mw values are proxies
  converted from Ms and mb, so they are excluded from b.
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

## 3. Completeness Mc, including its change over time

- **Estimator.** Maximum curvature + 0.2 (MAXC + 0.2; Woessner & Wiemer 2005). It is robust for samples of
  50–500 events. GFT (Wiemer & Wyss 2000) and MBS (Cao & Gao 2002) are computed for the global comparison.
  - MAXC tends to underestimate Mc and MBS to overestimate it (Mignan & Woessner 2012). The two together bracket
    the truth.
- **Global period floors**, per depth class, taken as max(MAXC + 0.2, MBS) of the global ISC-GEM events of the
  period:

  | Depth | 1976–2003 | 2004–2021 |
  |---|---|---|
  | ≤ 70 km | **5.7** (MAXC 5.4, MBS 5.7, GFT 5.3) | **5.2** (MAXC 5.2, MBS 5.0, GFT 5.0) |
  | > 70 km | **5.4** (MAXC 5.4, MBS 5.4, GFT 5.3) | **5.4** (MAXC 5.2, MBS 5.4, GFT 5.0) |

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

## 4. b-value, uncertainty and the mask

- **Estimator.** Aki-Utsu maximum likelihood with the ΔM/2 binning correction, on magnitudes binned to 0.1.
- **Uncertainty.** 200 bootstrap resamples of the events in the circle. Each replicate re-estimates the cell Mc,
  so the 95 % percentile interval includes the Mc uncertainty (Woessner & Wiemer 2005).
- **Mask (quality codes).** A b-value is published only when:
  - at least 50 events are above threshold, and
  - the 95 % interval is ≤ 0.30 wide (`A`) or ≤ 0.50 wide (`B`).

  A wider interval gives `C`: b is withheld and only the width is shown. Fewer than 50 events gives
  `insufficient`. This is the hard rule of the atlas: **no b-value without its interval and quality code.**
- **Cutoff stability flag.** `*_unstable` is true when b at threshold + 0.2 and at + 0.4 both fall outside the
  interval, on the same side. It is true for 4.9 % of shown shallow cells.
- **Finite-sample bias.** Marzocchi et al. (2020) show that b from small samples is biased and correlates with
  the largest event in the sample, so apparent spatial b contrasts need significance checks. Adjacent cells
  overlap and are not independent. The site should compare two places only through their intervals.

## 5. b-positive as a robustness check

b-positive (van der Elst 2021) is computed on successive positive magnitude differences ≥ 0.2, using events
above the period floor in time order. It is insensitive to the short-term incompleteness after large events.

- Shown cells: the median of b⁺ − b is +0.029.
- b⁺ falls inside the bootstrap interval of b in 87.8 % of cells (`results/validation.json`, `cells_summary`).

## 6. Shallow vs deeper events, and declustering

- **Depth classes.** ≤ 70 km and > 70 km are mapped separately (`sh_*`, `dp_*`). The two populations have
  different b: globally, 1976–2021, b = 1.043 [1.025, 1.059] shallow (n = 15,827) and 0.969 [0.945, 0.996]
  deeper (n = 5,419).
  - For the comparison with Michael (2014) we used his 60 km split.
- **Declustering is not applied to the main b.** Gardner-Knopoff windows (as in ZMAP and OpenQuake) mark 51 % of
  ISC-GEM events as dependent. At M ≥ 6.5 the windows last years, so for a global M ≥ 5 catalogue they remove
  much more than aftershocks.
  - Global shallow b falls from 1.043 to 0.895 [0.877, 0.914].
  - Across shown cells, the median declustered-minus-full difference is −0.192.

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
3. **Few trusted cells.** Only 204 shallow and 70 deeper cells pass the quality gate. Most of the world shows
   "insufficient". This is the honest result for a global M ≥ 5 catalogue, not missing work.
4. **Overlapping circles.** Neighbouring cells share events, so a smooth-looking pattern is partly
   autocorrelation.
5. **Boundary classes are approximate.** Each event gets the class of the nearest PB2002 step within 200 km.
   Bird & Kagan (2004) used a more careful assignment, and subduction-zone intraslab events can be mislabelled.
6. **ISC-GEM proxies.** ISC-GEM's own Mw proxies (pre-1976 and some later events) cannot be separated from direct
   Mw in the ComCat copy.
7. **Lower Mc than Michael (2014).** Our global Mc values are lower than his. This is expected because the
   catalogue has changed since his v1 analysis (§ validation), but it means our floors are less conservative
   than his.
8. **No forecast, no hazard.** The atlas describes catalogue statistics. It is not an earthquake forecast and
   not a seismic hazard model.
