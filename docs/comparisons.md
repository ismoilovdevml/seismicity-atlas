# Comparisons with published maps, parameters and tools

This page compares the atlas with five external references: a published high-definition b-value map of Italy, a
b-value package, the GEM global hazard map, published subduction-zone ETAS parameters and the CSEP testing
framework. Each section gives the licence of the source, what was done, the numbers and a verdict.

Code: `scripts/sci2/` (`sci2lib.py` shared maths, `hd_italy.py`, `ntest_omori.py`, `gem_hazard.py`) and
`scripts/monitor/monitorlib.py` (`zw2020_productivity`). Tests: `tests/test_sci2.py`. Outputs: `results/sci2_*.json`
and `docs/img/sci2-*.png`. Every number below comes from those outputs (release 0.6.0, runs of 2026-11-20 on the 2026-11-13 data; the
monitor numbers of §4 are from the 2026-11-14 monitor build).

| # | Reference | Licence | Used as | Verdict |
|---|---|---|---|---|
| 1 | Taroni, Zhuang & Marzocchi (2021) HD b map of Italy; comment by Gulia, Gasperini & Wiemer (2022) | paper: author accepted manuscript, CC0 1.0 (INGV Earth-prints); input catalogue: subset of HORUS (CC BY 4.0) released in a GitHub repository without a licence | comparison only; files kept in the local cache, not redistributed | our Italy layer agrees in ranks (Spearman 0.60) with a small offset (median −0.029); differences are concentrated in the Po Plain / northern Apennines, one central-Alps cell and Sicily |
| 2 | pybvalue v0.0.1 | Zenodo metadata: CC BY 4.0; archive LICENSE file: MIT | method re-implemented (the archive holds no b-value code) | agrees with our layer when the same +0.2 completeness correction is used (Spearman 0.86, median 0.000) |
| 3 | GEM Global Seismic Hazard Map v2026.1 | CC BY-NC-SA 4.0 | not redistributed, link only; internal analysis with aggregate statistics only | 430 of 555 cells with mean PGA ≥ 0.2 g have no shallow b; the cause is few events, not a high Mc |
| 4 | Zhang, Werner & Goda (2020) ETAS parameters | journal article; parameters quoted as facts | optional data fields of the monitor | the shallow subduction sequences lie inside the range of the published sequences (ratios 2.3–6.0 vs 1.5–10.8) |
| 5 | Savran et al. (2020); pyCSEP | pyCSEP BSD-3-Clause | the Poisson N-test re-implemented (same definition) for a retrospective check | the Omori fit extrapolated past its data fails 10 of 12 tests (7 with parameter uncertainty); the monitor stays descriptive |

## 1. Italy: high-definition b map (Taroni et al. 2021) and the quarry-blast debate

### Sources and licences

- Taroni, M., Zhuang, J., Marzocchi, W. (2021), SRL 92(6), doi:10.1785/0220210017. Read from the accepted manuscript
  on INGV Earth-prints (handle 2122/14709, CC0 1.0).
- Gulia, L., Gasperini, P., Wiemer, S. (2022), comment, SRL, doi:10.1785/0220210159. Read from the authors' draft on
  Earth-prints (handle 2122/16217); it includes their response to the reply. The reply by Taroni et al.
  (Earth-prints handle 2122/16330) is behind a login and was **not read**.
- The paper publishes the b map only as a figure; there is no gridded data file or supplement with values. The
  authors released their MATLAB code, the input catalogue (56,309 events, a HORUS subset with a per-event
  completeness column) and a night-time version of it at github.com/MatteoTaroniINGV/BvalueMapping (commit
  `cb98a57`). The repository has **no licence**, so the files are downloaded to the local cache for comparison only
  and are not redistributed. HORUS itself (Lolli et al. 2020, horus.bo.ingv.it) is CC BY 4.0.

### Method

Their estimator (eqs. 4–5 of the paper and `BvalueMappingWLEstimationMCvariation.m`) is a weighted maximum
likelihood: every event gets a Gaussian weight w = exp(−r² / 2σ²), σ = 30 km, around each 0.1° grid point, and

b = Σw / (ln10 · Σw (M − Mc + ΔM/2)),  σ_b = b · √(Σw²) / Σw,

with each event's own completeness Mc (fixed per period for the whole of Italy: 4.0 in the 1960s down to 1.8 after
2005) and ΔM = 0.01. A cell is "significantly different" when the whole-catalogue B lies outside b ± 1.96 σ_b. We
re-implemented this in `sci2lib.b_wle` (no code copied; checked against the classical MLE and a two-region synthetic
in `tests/test_sci2.py`).

Our layer differs in five ways: INGV ML (theirs is a Mw proxy), 2010–2025 (theirs 1960–2019), depth ≤ 70 km (≤ 30),
a hard 30 km circle (a Gaussian kernel with σ = 30 km, so about two thirds of the weight lies within 45 km) and a local Mc per cell and
period with 200-event windows (one Mc per period for all of Italy, plus removal of events within 3 days and 30 km
after every M ≥ 5.5).

### Reproduction

| | Ours (re-implementation) | Published |
|---|---|---|
| events in the input catalogue | 56,309 | 56,309 |
| whole-catalogue B | **1.046 ± 0.004** | 1.04 |
| night-time catalogue | 30,802 events, B = 1.047 | – |

The published value is given to two decimals; ours is 0.006 higher (1.4 σ). Their map was not published as numbers,
so the grid itself (4,074 points; b from 0.50 to 1.51, median 0.97) can only be compared with their Figure 2 by
eye: the high-b areas in the central Apennines, northern Apulia and western Tuscany and the low-b areas in western
Sicily and the north-east are reproduced (panel c of the figure).

### Cell-by-cell comparison

At the centre of every Italian cell where our shallow b is shown (142 cells, quality A or B) we evaluated their
estimator directly (no interpolation). 122 centres lie inside their study polygon (within 8 km of one of their grid
points); all have an effective sample size (Σw)²/Σw² ≥ 50. "Difference" is theirs minus ours.

| Comparison (n cells) | Pearson r | Spearman ρ | Median difference | RMS difference |
|---|---|---|---|---|
| ours vs HD, their catalogue 1960–2019 (122) | 0.63 | **0.60** | **−0.029** | 0.12 |
| ours vs HD, their catalogue 2010–2019 only (122) | 0.61 | 0.60 | +0.008 | 0.12 |
| ours 2010–2019 vs HD 2010–2019 (same years) (122) | 0.58 | 0.61 | +0.012 | 0.15 |
| ours vs HD, their night-time catalogue (122) | 0.57 | 0.55 | −0.012 | 0.13 |
| ours vs HD, their catalogue with 30 days removed after M ≥ 5.5 (122) | 0.66 | 0.62 | −0.024 | 0.11 |
| ours vs HD on **our own events** (regional Mc(t), same removal rule) (142) | 0.56 | 0.58 | +0.071 | 0.13 |

Their significance map against our intervals (our median cell b 1.011 as the reference): of the 23 cells where their
b is significantly above their B, ours is also above the median in 15 and below it in none; of the 52 cells
significantly below, ours is below in 14 and above in 1.

Where we differ most (standardised difference, `results/sci2_italy_hd.json`):

| Area (cell centre) | Ours [95 %] | HD, theirs | HD, theirs, 30-day removal | HD, night-time |
|---|---|---|---|---|
| central Alps, 46.15 N 10.43 E | 1.60 [1.35, 1.94] | 1.04 | 1.04 | 0.95 |
| Po Plain / Emilia, 45.00 N 10.88 E | 1.13 [0.91, 1.25] | 0.79 | 0.83 | 0.86 |
| northern Apennines, 44.70 N 10.47 E | 1.22 [1.09, 1.34] | 0.89 | 0.91 | 0.94 |
| Po Plain, 44.78 N 9.90 E | 1.14 [0.99, 1.26] | 0.88 | 0.88 | 0.95 |
| Po Plain / Emilia, 44.91 N 11.45 E | 1.01 [0.86, 1.14] | 0.79 | 0.81 | 0.86 |
| Emilia / northern Apennines, 44.61 N 11.03 E | 1.12 [0.84, 1.33] | 0.88 | 0.96 | 0.93 |
| northern Marche coast, 43.94 N 12.85 E | 0.96 [0.81, 1.07] | 1.11 | 1.11 | 1.09 |
| central Sicily, 37.53 N 14.38 E | 1.11 [0.89, 1.26] | 0.89 | 0.89 | 0.91 |

![Italy: our cells against the HD b of Taroni et al.](img/sci2-italy-hd.png)

*(a) Our cell b against their estimator on their catalogue at the same centres (blue: all hours, red: night-time
catalogue). (b) Our b against the HD estimator on our own events. (c) The HD grid recomputed from their catalogue
(squares) and our A/B cells (circles), same colour scale; orange rings: day/night ratio > 1.5 in our data. HD values
computed by us from the catalogue of Taroni et al. (2021), a subset of HORUS (Lolli et al. 2020, CC BY 4.0).*

What this shows:

- **Small overall offset, moderate rank agreement.** Over 122 cells the median difference is −0.029 and the rank
  correlation 0.60. This holds for the full and the overlapping period (2010–2019: +0.008, 0.60), so the 50 extra years of their
  catalogue do not drive the agreement or the differences. Part of the scatter is expected because ML b and Mw b
  differ by the slope of the ML–Mw relation; the ranks are the like-for-like part.
- **The two estimators on the same events agree only as well as the two catalogues do** (ρ 0.58). The kernel
  estimate is smoother (spread of cell values 0.11 against 0.14 for ours) and higher by 0.07 in the median. The
  higher level comes from the completeness: with one Mc per period for all of Italy (2.1–2.3) instead of a local
  MAXC + 0.2, fewer small events are used and the curved part of the frequency-magnitude distribution near the
  threshold is excluded differently. The method, not the data, explains most of the cell-to-cell differences.
- **Where they differ.** One central-Alps cell (46.15 N 10.43 E: ours 1.60, HD 1.04), the Po Plain and northern
  Apennines (our b 1.0–1.2, HD 0.79–0.89) and central Sicily are the largest differences. Removing 30 days instead of 3 after M ≥ 5.5 raises the HD value in Emilia only from 0.79
  to 0.83, so the 2012 Emilia aftershocks are not the whole reason. These are areas where a national Mc(t) and a
  local Mc differ most (Schorlemmer et al. 2010 map uneven detection in Italy); Taroni et al. themselves attribute
  low b in poorly covered areas to a common Mc. Our values there carry wide intervals (0.84–1.34 in the Po Plain and Apennines).

### The methods debate, and what it implies for our layer

- **HD / weighted likelihood vs fixed radius.** Taroni et al. argue that a kernel avoids the hard edge of a fixed
  radius, gives a formal uncertainty for the weighted estimate (delta method), and that a spatially varying b beats a
  uniform B in a pseudo-prospective test (training 1960–2009, testing 2010–2019; Bayes factor curves for Mc 1.8,
  2.1 and 2.4, strongest gain during Amatrice–Norcia 2016). They list a better space-time Mc as the main open
  improvement.
- **Gulia, Gasperini & Wiemer (2022).** They argue that the high-b anomalies are dominated by quarry blasts that
  remain in the catalogue: in 20 km circles at three high-b areas (43.35 N 13.2 E, 43.35 N 13.1 E, 40.7 N 16.7 E)
  the day/night ratio is "ranging from 1.7 to 26"; a ratio of 1.5 "is already indicative of significant quarry blast
  contamination" (Wiemer & Baer 2000); the maximum magnitude of European blasts is about 2.5, above the 1.8 Mc used
  after 2005. High b in western Tuscany is attributed to an edge effect at the fringe of seismicity. In their
  response they find that in the night-time map the Apulia anomaly "disappears entirely" and one Marche anomaly is
  "substantially reduced". They also note that blast discrimination by INGV improved after 2012.
- **Our layer under the same check.** We excluded the 2,507 events that INGV flags as quarry blasts (plus other
  explosion types). For the events above each cell's thresholds, the day/night ratio (07–19 vs 19–07 CET) has a
  median of 0.99 (p10–p90 0.82–1.26) over the 142 shown cells; 4 cells exceed 1.5 and 1 exceeds 2. It does not
  correlate with b (r = 0.04). In 20 km circles at the three comment areas our ratios are 0.95, 0.97 and 0.86
  (80, 77 and 13 events above the regional floor). Recomputing b with night-time events only (101 cells keep
  quality A/B) changes the median cell by −0.006, and 12 of the 101 night values fall outside the all-hours
  interval. **We find no quarry-blast signature in the shown cells.** This is consistent with the comment's own
  remark on better discrimination after 2012 and with our 2010–2025 window; it does not prove that no blast remains
  in cells with few events.
- **Implications.** (1) Our fixed-radius b with a local Mc and the published kernel b give the same large-scale
  pattern; cell-level differences of about 0.1 are within the method spread and should not be interpreted. (2) The
  completeness model matters more than the kernel. (3) The event-type filter is necessary: it stays, and the
  day/night ratio is now a documented check. (4) A cell value is not a seismotectonic finding by itself; the debate
  shows how easily non-physical effects (blasts, edge effects, completeness) create anomalies.

## 2. pybvalue cross-check

- **Package and licence.** pybvalue v0.0.1, N. Thapa (2024), doi:10.5281/zenodo.11508511. The licence is
  stated twice and differently: the Zenodo and DataCite metadata say **CC BY 4.0**, the LICENSE file in the archive
  says **MIT**. No code was copied (only the documented method was re-implemented), so either way the only duty is
  the citation. The linked GitHub repository returned 404 on 2026-11-14.
- **What it contains.** The archive holds a README, the licence, a project description (PDF), one notebook and two
  catalogue files. The notebook only downloads and reads catalogues; **there is no b-value or Mc function** to run.
- **Method as documented** (README and ProjectDescription.pdf): Mc by maximum curvature; the Aki (1965) maximum
  likelihood b with the bin correction; the Shi & Bolt (1982) uncertainty; spatial mapping after Schorlemmer et al.
  (2004).
- **Re-implementation.** `sci2lib.b_single_mc`: one MAXC Mc per circle over the whole window, Aki–Utsu, Shi–Bolt, on
  exactly the circles and events of our Italy layer (142 shallow A/B cells). Output: `results/sci2_pybvalue.json`.

| Single-Mc variant | n | Pearson r | Spearman ρ | Median difference (single − ours) | RMS | Inside our 95 % interval |
|---|---|---|---|---|---|---|
| MAXC (as documented) | 142 | 0.77 | 0.76 | −0.073 | 0.12 | 102 (72 %) |
| MAXC + 0.2 | 141 | 0.87 | 0.86 | 0.000 | 0.07 | 130 (92 %) |

**Verdict:** with the same +0.2 correction our time-varying estimator and a single-Mc estimator agree closely
(median 0.000). The documented MAXC without correction gives b lower by 0.07, the known downward bias of MAXC
(Woessner & Wiemer 2005; Mignan & Woessner 2012), which is why the atlas uses MAXC + 0.2. The single-window Mc is
0.2 lower than our latest-period Mc in the median cell. Global inputs were not run (the Italy cells already test
the estimator on 142 independent circles).

## 3. GEM Global Seismic Hazard Map v2026.1: high hazard and thin catalogue data

**Licence, read exactly.** Zenodo record 20735384 ("Global Seismic Hazard Map", version v2026.1, 2026-06-23):
licence `cc-by-nc-sa-4.0`. The archive's README says "License: Creative Commons BY-NC-SA 4.0 (CC BY-NC-SA 4.0)" and
ships the full legal code (`LICENSE-CC_BY-NC-SA.txt`). The README asks to cite Johnson K, Bayliss K, Villani M,
Brooks C, Styron R, Simionato M, Chen Y, Rood A, Pagani M (2026), doi:10.5281/zenodo.8409646 (the concept DOI).

- NonCommercial: use for non-commercial purposes only. ShareAlike: adapted material may be shared only under the
  same or a compatible licence. The atlas data are CC BY-SA 4.0, which is not compatible with NC, so **nothing
  derived from the map cell by cell is published**: no site layer, no figure, no per-cell table.
- Non-commercial internal analysis is permitted by the licence. It was run with **output limited to aggregate
  counts and medians** (`results/sci2_gem_hazard.json`). The map is linked, not redistributed; the GeoPackage
  (1.8 GB, 14,117,882 points with PGA) is read from a local download and is not cached in the repository's data.

**Method** (`scripts/sci2/gem_hazard.py`). Hazard = mean PGA (g, 10 % in 50 years, rock) of the GEM points inside
each H3 resolution-2 cell of the global layer (5,882 cells cover the Earth; 2,598 are atlas cells). Classes at
breaks of the GEM colour table. "Thin" = no atlas cell, or shallow b quality `insufficient` or `C`.

| PGA class | Cells | No atlas cell | Insufficient | C | A or B | Thin share | Median Mc (cells with Mc) | Median ISC-GEM events |
|---|---|---|---|---|---|---|---|---|
| < 0.08 g | 4,697 | 3,276 | 1,420 | 1 | 0 | 100 % | 5.3 (85) | 0 |
| 0.08–0.2 g | 630 | 7 | 605 | 7 | 11 | 98 % | 5.3 (293) | 8 |
| 0.2–0.35 g | 343 | 1 | 296 | 27 | 19 | 94 % | 5.3 (295) | 42 |
| ≥ 0.35 g | 212 | 0 | 79 | 27 | 106 | 50 % | 5.3 (210) | 151 |

High hazard (mean PGA ≥ 0.2 g), 555 cells:

- **430 (77 %) have no shallow b** (375 insufficient, 54 C, 1 without an atlas cell); 125 have A or B.
- Median ISC-GEM events: 51 in the thin cells against 218 in the A/B cells. The thin cells are thin because few
  events above Mc occurred there in 1976–2021, not because Mc is high: the median measured Mc is 5.3 in every
  hazard class, only 42 of the thin high-hazard cells have Mc ≥ 5.6, and the rank correlation of PGA with Mc is
  0.03 (with the ISC-GEM event count 0.75).
- Plate-boundary class of the thin high-hazard cells: 102 subduction, 84 oceanic transform, 78 more than 200 km
  from a boundary step, 60 oceanic ridge, 40 continental convergent, 32 continental transform, 18 continental rift,
  15 oceanic convergent. Many of them are offshore, where the GEM README notes that hazard values "are affected by
  significant uncertainty".
- With the 90th percentile of PGA in a cell instead of the mean, 980 cells reach 0.2 g.

The numbers above use the 0.6.0 quality codes (release 0.5.0: 400 of 555 thin, 155 A/B).

**Correction (2026-11-16, release 0.5.0).** The numbers were then recomputed with the 0.5.0 quality codes, read from
`data/work/cells.pkl` after checking that it equals the published `site/data/cells.geojson` cell by cell. The first
version of this section (2026-11-14: 369 of 555 thin, 185 A/B) cannot have come from the published map, which had
only 170 shallow A/B cells in total; the working file had most likely been overwritten by a sensitivity run with
every ISC-GEM event. `gem_hazard.py` now refuses to run when the working file and the published layer disagree.

**Verdict.** Where GEM models the highest hazard (≥ 0.35 g), 106 of 212 cells (50 %) have a b-value; at
0.2–0.35 g only 19 of 343 (6 %) do. The gap is a sample-size gap of a global M ≥ 5 catalogue over 46 years, not a completeness
gap, so regional catalogues (as in the regional layers) are the way to fill it, not a lower global Mc. Not done:
any map or per-cell output (licence), and deeper cells (only the shallow quality was compared).

## 4. Subduction-zone ETAS productivity (Zhang, Werner & Goda 2020)

Licence: a journal article (BSSA 110(1), 191–212, doi:10.1785/0120190121), read from the annotated manuscript on
Zenodo (record 4270128, marked "other-pd"). Only parameter values are used, quoted as facts with the citation.

The paper's only numeric ETAS table is Table 6, suggested parameters for future M 9.0 events: K0 = 0.04 ± 0.02,
α = 2.3 (fixed), c = 0.03 ± 0.01 day, p = 1.21 ± 0.08, d = 23.48 ± 18.17 km², γ = 1.61 ± 0.29, q = 1.68 ± 0.55
(Mcut 4.5, NEIC). Per-region and per-sequence estimates appear only in figures. Table 2 gives the counts of
M ≥ 4.5 events of the 36 individual sequences, which we use as the reference. The monitor now stores the comparison
as data fields; the method, table and results are in [monitor.md](monitor.md) §9.

**Verdict:** the seven shallow subduction sequences of the current monitor have count-to-direct-ETAS ratios of
2.3–6.0, inside the range of the published sequences (1.5–10.8, median 3.4; percentiles 21–71). Six of them are
"more productive" against the generic Page et al. (2016) parameters, so that label at least partly reflects the
reference, not unusual sequences.

## 5. CSEP-style testing of the monitor (Savran et al. 2020; pyCSEP)

**Sources and licence.** Savran, W., Werner, M. J., Marzocchi, W., Rhoades, D., Jackson, D., Milner, K., Field, E.,
Michael, A. (2020), "Pseudoprospective evaluation of UCERF3-ETAS forecasts during the 2019 Ridgecrest sequence",
BSSA, doi:10.1785/0120200026 (abstract read; full text not read). pyCSEP (github.com/cseptesting/pycsep) is
BSD-3-Clause. Savran et al. evaluate forecasts made of simulated catalogues, which relaxes the Poisson assumption of
the older CSEP tests; they found that both UCERF3 variants "mildly overpredict the seismicity rate, on average".

**Is a CSEP test meaningful for a descriptive Omori fit?**

- **In-sample: no.** At the cut-off the fitted expected count equals the observed count by construction (the MLE of
  K; checked in `tests/test_monitor.py`). An N-test on the fitted data would always pass and says nothing.
- **Spatial (S) and magnitude (M) tests: no.** The monitor has no spatial model (one circle) and assumes one b.
- **Out-of-sample number test: yes, as a retrospective check of the model form.** The fit is an inhomogeneous
  Poisson rate. Integrating it beyond the learning span and comparing with what was recorded later asks whether
  Omori-Utsu with Mc(t) describes how a sequence continues. This is a property of the description, so it is worth
  knowing; it is run on completed sequences only and **is not shown on the site**.

**Test.** `scripts/sci2/ntest_omori.py`, output `results/sci2_ntest.json`. For four completed sequences, with the
monitor's own data rules and fit, learning spans of 3, 10 and 30 days and a testing span from there to day 365:
the Poisson N-test as defined in pyCSEP (δ1 = P(N ≥ n_obs), δ2 = P(N ≤ n_obs); rejected when either is below
0.025), and the same test against a Poisson mixture over 1000 bootstrap refits of the learning data (parameter
uncertainty; each refit draws its sample size from Poisson(n), since 0.6.0).

| Sequence (circle, Mcat) | Learning days | n learning | p | Observed, testing | Expected | Obs / exp | Poisson δ1, δ2 | Mixture δ1, δ2 |
|---|---|---|---|---|---|---|---|---|
| 2019 M 7.1 Ridgecrest (100 km, 2.8–2.9) | 3 | 516 | 1.37 | 615 | 220.7 | 2.79 | 0, 1 | 0, 1 |
| | 10 | 720 | 1.18 | 411 | 315.8 | 1.30 | 0, 1 | 0.019, 0.98 |
| | 30 | 742 | 1.16 | 215 | 172.5 | 1.25 | 0.001, 0.999 | 0.03, 0.97 |
| 2024 M 7.5 Noto (100 km, 4.5 default) | 3 | 43 | 1.23 | 28 | 15.0 | 1.87 | 0.002, 0.999 | 0.21, 0.80 |
| | 10 | 54 | 1.07 | 17 | 21.6 | 0.79 | 0.87, 0.19 | 0.66, 0.38 |
| | 30 | 58 | 1.15 | 13 | 9.8 | 1.33 | 0.19, 0.88 | 0.29, 0.76 |
| 2021 M 8.2 Chignik (250 km, 2.7–2.8) | 3 | 50 | 1.13 | 803 | 260.0 | 3.09 | 0, 1 | 0.0005, 1 |
| | 10 | 84 | 1.25 | 769 | 141.0 | 5.45 | 0, 1 | 0, 1 |
| | 30 | 178 | 1.09 | 572 | 161.4 | 3.54 | 0, 1 | 0, 1 |
| 2025 M 8.8 Kamchatka (565 km, 4.5–4.6) | 3 | 411 | 0.90 | 873 | 960.2 | 0.91 | 0.998, 0.002 | 0.68, 0.32 |
| | 10 | 700 | 0.96 | 974 | 744.3 | 1.31 | 0, 1 | 0.009, 0.99 |
| | 30 | 878 | 1.00 | 796 | 432.1 | 1.84 | 0, 1 | 0, 1 |

Summary of the 12 tests: the Poisson N-test rejects 10; with parameter uncertainty 7 are rejected. Observed counts
are above the extrapolated fit in 10 of 12 (median ratio 1.59). The Poisson test passes only Noto after 10 and 30
days; the mixture also passes Ridgecrest after 30 days, Noto after 3 days and Kamchatka after 3 days.

Why the fit under-predicts:

- **No secondary sequences.** Large aftershocks start their own sequences; a single Omori law fitted to the first
  days cannot contain them. This is what ETAS adds (Savran et al. use simulated ETAS catalogues for this reason).
- **No background.** In the Chignik circle (250 km) ComCat lists many M ≥ 2.7 events unrelated to the mainshock.
  A diagnostic variant adds a constant background: since 0.6.0 the rate of the Gardner-Knopoff independent events
  above Mcat in the year before the mainshock, without the days just before it (Chignik: 103 independent events
  of 2,066). Before, every event of that year counted, and each of these years contains another sequence (the
  2020 M 7.6 Sand Point earthquake for Chignik, the M 6.4 foreshock for Ridgecrest, the 2025 M 7.4 foreshock for
  Kamchatka). With the background the Poisson test still rejects 10 of 12; the variant is not used for a verdict
  (stored as `background_test` in the output).
- **Early fits are steep.** After 3 days, p is resolved poorly or traded against c (Ridgecrest p = 1.37 at day 3,
  1.18 at day 10). Kamchatka after 3 days has p = 0.90 and over-predicts.
- **Poisson is too narrow** for clustered seismicity, which is why the parameter-uncertainty mixture rejects fewer
  cases; a full catalogue-based test would need ETAS simulations.

**Decision.** The monitor remains descriptive. The N-test confirms that the fitted curve must not be extended past
the cut-off: in 10 of 12 cases the extrapolation is statistically inconsistent with what followed. This supports the
existing rules (no curve beyond the cut-off, no expected future counts, `check_monitor.py` guards). Nothing from the
test is written to `site/data`.

## Not verified

- The reply of Taroni et al. (2022) to the comment (behind a login) and the full text of Savran et al. (2020) (only
  the abstract) were not read. The Gulia et al. text was read from the authors' draft, not the published version.
- The published HD map exists only as a figure; the reproduction was checked against the published B (1.04) and
  event count, and against the figure by eye, not number by number.
- The day/night ratio uses CET without daylight saving, so one hour of summer daytime falls into the night bin;
  the ratio was not recomputed with local civil time.
- pybvalue could not be run (no estimator in the archive, repository gone); only its documented method was
  re-implemented.
- Zhang et al. per-sequence ETAS parameters were not digitised from their figures; the reference uses Table 2
  counts and Table 6 parameters only. The p and c uncertainties of Table 6 are not propagated.
- The N-test uses four sequences and Poisson or bootstrap-mixture distributions; no ETAS simulation
  (catalogue-based test) was run, and pyCSEP itself was not installed (its N-test definition was re-implemented and
  checked in `tests/test_sci2.py`).
- GEM: only the shallow b quality was compared; deeper cells and the 2023.1 map were not.
