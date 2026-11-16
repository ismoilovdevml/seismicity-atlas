# Validation

All values are read from `results/validation.json`, `results/validation_table.json` and `results/sequences.json`
(release 0.5.0, run of 2026-11-16 on the data cut-off 2026-11-13, fixed random seeds, 1000 bootstrap replicates).
Intervals are 95 %. A difference is reported as a difference. What changed against 0.4.0 is in §12 and in
[`changes-0.5.md`](changes-0.5.md).

## How a comparison is judged (since 0.5.0)

- **z-score.** z = (ours − published) / √(σ_ours² + σ_pub²), with σ_ours = (95 % interval width) / 3.92 and σ_pub
  the uncertainty printed in the publication (b units; b = 1.5 β). |z| ≤ 1.96 is **match**, otherwise **differs**
  (`common.z_verdict`).
- **No published uncertainty.** Then no z is computed. If the published value (or range) lies inside our interval,
  the verdict is **consistent, uninformative (no published uncertainty)**: a wide interval accepts almost anything
  (California [0.746, 1.156] accepts every b from 0.75 to 1.15), so this is not a confirmation. Otherwise
  **differs**. Until 0.4.0 such rows were called "match", and the Kagan (2010) rows used σ_pub = 0.
- **Qualitative statements** (a ranking, a direction) count as "consistent, uninformative" when ours agrees.
- **Data source.** Every row says where the published number comes from, relative to ours:
  - *same data (GCMT-based)*: fits to GCMT moments (Kagan, Kagan & Jackson, Bird & Kagan, Petruccelli). ISC-GEM
    direct Mw after 1976 are mostly GCMT moments too (`method.md` §2.1), so agreement shows that the code
    reproduces the published estimator on the same events, not that the result is independently confirmed;
  - *same data (ISC-GEM itself)*: Michael (2014) studied the ISC-GEM catalogue (release 1);
  - *independent data*: other catalogues and magnitudes (SCSN, Italian and Iranian catalogues, the ANSS catalogue
    of Nishikawa & Ide 2014, ISC mb of Srivastava et al. 2021, a Chilean national catalogue), and synthetic data with
    a known answer. Whether ANSS magnitudes of large events are themselves GCMT moments was not checked
    (unverified);
  - *no published value*: internal sensitivity checks and reference rows.

**Counts over the 45 rows of the site table** (`site/data/global.json` → `validation_counts`):

| Data | match | consistent, uninformative | differs | not testable | reference only | other |
|---|---|---|---|---|---|---|
| same data (GCMT-based) | 13 | 6 | 1 | – | – | – |
| same data (ISC-GEM itself) | – | 2 | 9 | – | – | – |
| independent data | 1 | 3 | 2 | 3 | 1 | – |
| no published value | – | – | – | – | 2 | 2 (robust, description only) |

All 13 matches with a z-test are on GCMT-based values. The one independent match is the synthetic b recovery
(one period); the two independent "differs" are also synthetic (b recovery with two periods, Omori p). **No
published value from an independent catalogue is confirmed by a z-test**: those rows either give no uncertainty or
are not testable at teleseismic magnitudes.

Since v0.2 every atlas-method b uses the direct-Mw b sample (ISC-GEM Mw uncertainty 0.10; `method.md` §2.1). The
Michael (2014) rows in §2 keep every event, as he did. What changed against v0.1 is listed in §10.

## 1. Synthetic recovery (estimator)

60 synthetic cells per row. True b is drawn from 0.7–1.4 and true Mc from 5.0–6.0. Detection is a logistic
roll-off: 50 % at Mc − 0.2, about 88 % at Mc. In the two-period case, half the events come from a period that is
complete only above 5.7. "Events above Mc" counts events above the *true* Mc. 1000 replicates (0.5.0); the random
draws differ from 0.4.0 because the replicates use the same random stream as the cells.

| Case | Events above Mc | Median bias of b | RMSE | 95 % CI coverage | Cells shown (A/B) | Max \|error\| when shown |
|---|---|---|---|---|---|---|
| one period | 30 | +0.006 | 0.197 | 1.000 | 0 % | – |
| one period | 50 | −0.034 | 0.219 | 0.949 | 0 % | – |
| one period | 100 | −0.038 | 0.166 | 0.983 | 30 % | 0.170 |
| one period | 200 | −0.003 | 0.096 | 1.000 | 83 % | 0.242 |
| one period | 500 | −0.011 | 0.067 | 0.933 | 100 % | 0.243 |
| one period | 1000 | −0.019 | 0.056 | 0.917 | 100 % | 0.150 |
| two periods | 100 | −0.093 | 0.170 | 1.000 | 28 % | 0.219 |
| two periods | 200 | −0.017 | 0.107 | 0.933 | 78 % | 0.255 |
| two periods | 500 | −0.009 | 0.073 | 0.950 | 98 % | 0.190 |
| two periods | 1000 | +0.002 | 0.064 | 0.917 | 100 % | 0.191 |

**Pooled bias test** (cells with 100–1000 events, 240 per case; `synthetic_bias`): one period, mean error
−0.010 (se 0.007, z −1.48, **match**); two periods, −0.020 (se 0.007, z −2.78, **differs**). Coverage 0.958 and
0.950.

**The mask against true b** (the same cells; the old absolute rule is applied to the same intervals for comparison):

| Case | Events above Mc | Shown, b < 1.05 / b ≥ 1.05: absolute rule (≤ 0.4.0) | relative rule (0.5.0) | Mean error of shown cells: absolute / relative | Median events above the threshold, b < 1.05 / ≥ 1.05 |
|---|---|---|---|---|---|
| one period | 100 | 61 % / 0 % | 47 % / 4 % | −0.040 / +0.008 | 70.5 / 41.5 |
| one period | 200 | 97 % / 42 % | 100 % / 68 % | −0.006 / +0.006 | 149 / 83 |
| one period | 500 | 100 % / 97 % | 100 % / 100 % | −0.019 / −0.018 | 404 / 267 |
| two periods | 100 | 77 % / 10 % | 45 % / 10 % | −0.101 / −0.086 | 75 / 41 |
| two periods | 200 | 100 % / 33 % | 100 % / 52 % | −0.037 / −0.023 | 128 / 81 |
| two periods | 500 | 100 % / 91 % | 100 % / 97 % | −0.006 / −0.007 | 339 / 202 |

- **The estimator is nearly unbiased from 200 events up** (median bias within ±0.02). At 100 events the median
  bias is −0.04 (one period) and −0.09 (two periods). Pooled over 100–1000 events, the two-period bias of −0.020 is
  statistically detectable (z −2.78) but small against the interval widths (RMSE 0.06–0.17).
- **Coverage** is 0.92–1.00.
- **The relative mask removes the bias of the mask itself, not the b-dependence of the threshold.** With a known
  threshold and a fixed number of events above it, the share shown is 73–77 % at every true b
  (`tests/test_atlaslib.py`, `method.md` §4). Here the threshold is estimated: MAXC + 0.2 lands above the true Mc
  and removes a larger share of a high-b sample, so at the same number of events above the true Mc a high-b cell
  has about 40 % fewer events above its threshold and passes less often under either rule. The relative rule
  narrows the gap (one period, 200 events: 42 % → 68 % shown for b ≥ 1.05) and moves the mean error of the shown
  cells towards zero at 100–200 events, but the two-period cells at 100 events stay biased low (−0.086).
- **Mc.** MAXC + 0.2 lands 0.1 above the true Mc in one-period cells and 0.2–0.3 above it in two-period cells.
  This is the conservative direction. Unit tests: `tests/` (108 pass, 2026-11-16).

![Synthetic recovery](img/val_synthetic.png)

## 2. Global b and Mc vs Michael (2014)

Michael (2014) analysed ISC-GEM v1 (2013, 1900–2009, magnitude selection thresholds 7.5 / 6.25 / 5.5). The ComCat
copy used here is a later release that adds about 12,000 pre-1960 events and extends to 2021 (Di Giacomo et al.
2018), so completeness is expected to differ.

Data: **same data (ISC-GEM itself)**. Michael gives no uncertainty for these values, so no row can be a z-test
match.

| Test | Ours | Michael 2014 | Verdict (0.5.0) |
|---|---|---|---|
| b, shallow < 60 km, 1918–2009, his Mc(t) | 1.078 [1.056, 1.101] (n = 8,768) | 1.05 | differs: 1.05 is outside our interval |
| b, ≥ 60 km, 1964–2009, Mc 5.7 | 0.997 [0.962, 1.033] (n = 2,811) | 0.99 | consistent, uninformative |
| Mc, ≥ 60 km, 1964–2009 | MAXC 5.7 [5.4, 5.7], MBS 5.8 | 5.7 | consistent, uninformative |
| Mc, < 60 km, 1964–1975 | MAXC 5.7 [5.7, 5.8], MBS 5.7 | 6.0 | differs: lower by 0.3 |
| Mc, < 60 km, 1976–2003 | MAXC 5.4 [5.4, 5.4], MBS 5.7 | 5.8 | differs: lower by 0.4 (MBS 0.1) |
| Mc, < 60 km, 2004–2009 | MAXC 5.2 [5.2, 5.2], MBS 5.1 | 5.7 | differs: lower by 0.5 |
| Mc, < 60 km, 1900–1963 (four periods) | 6.0–6.5 | 6.5–7.7 | differs: lower by 0.5–1.2 |
| Mc, ≥ 60 km, 1900–1963 | MAXC 6.4 [6.0, 6.5], MBS 6.3 | 7.1 | differs: lower by 0.7 |

The MAXC intervals are bootstrap percentiles (1000 replicates); a degenerate interval such as [5.4, 5.4] means the
mode bin did not move in any replicate.

- **What these Mc values measure.** ISC-GEM is a selected catalogue: events were included above
  period-dependent thresholds (7.5 / 6.25 / 5.5 in release 1), and later releases added smaller events. The MAXC
  Mc of ISC-GEM therefore reflects the catalogue's inclusion rule, not the sensitivity of the networks of the time
  (`method.md` §3). A lower Mc than Michael's says where the current release is complete, not that detection was
  better than he thought.
- **Mc.** For the modern periods our Mc values are 0.3–0.5 lower than Michael's (MAXC; MBS 0.1–0.6). They are consistent with Di
  Giacomo et al. (2015), who give completeness Mw 5.6 from 1964. Michael's values were chosen subjectively on a
  catalogue already cut at 5.5. The early periods differ most because the extension project added many smaller
  pre-1960 events. These are completeness estimates for today's catalogue, not errors in either study.
- **b.** For 1964–2003, b at Michael's own Mc values is 1.108 ± 0.030 (1964–1975) and 1.079 ± 0.015
  (1976–2003). Pooled over 1918–2009 we get 1.078, slightly above his 1.05; he reports 1.05 as fitting "within
  1 standard deviation" but gives no number for it. The difference is small but outside our interval. A likely
  cause is the catalogue version; we did not test it (unverified).
- **Atlas setting** (1976–2021, our floors, direct Mw): global b = 1.035 [1.018, 1.052] shallow (≤ 70 km) and
  0.936 [0.911, 0.961] deeper (v0.1, every event: 1.043 [1.025, 1.059] and 0.969 [0.945, 0.996]).

![Mc by period](img/val_mc_michael.png)
![Mc over time](img/val_mc_time.png)

## 3. Regional b vs published values

Shallow ISC-GEM events, 1976–2021, region boxes as in `scripts/validate.py`, same estimator and floors as the map.
Published numbers come from local catalogues at much smaller magnitudes. A match only means the teleseismic
b-value agrees with the long-run local one; it does not prove the method.

| Region | Ours | Published | Data | Verdict (0.5.0) |
|---|---|---|---|---|
| California | 0.921 [0.746, 1.156], n = 74, B | ≈ 1.0 (Hutton, Woessner & Hauksson 2010, SCSN; no uncertainty) | independent | consistent, uninformative (the interval spans 0.41) |
| Chile | 0.852 [0.783, 0.937], n = 472, A | earlier: ≈ 1 (a 2018 national-catalogue study, weak source); now: Andean S. America b 0.855 ± 0.06 (GCMT, Kagan & Jackson 2013) | – | reference row; the comparisons are in §3.1 (GCMT: match, z +0.18; national catalogue: consistent, uninformative) |
| Japan | 0.942 [0.881, 1.014], n = 747, A | no verified number at Mw ≥ 5 found | – | reference only |
| Italy | n = 29 above Mc | ≈ 1.0 in Italian hazard models | independent | **not testable**: too few Mw ≥ 5.4 events |
| Zagros vs Makran | Zagros 1.199 [0.961, 1.533] (B, n = 66; C in 0.4.0); Makran n = 25 | Zagros highest, Makran lowest of the Iranian units (Iranian Plateau catalogue, J. Seismol. 2020) | independent | reference only: Makran has too few events, so the contrast cannot be tested |

### 3.1 Chile: why b is about 0.85 and not 1.0

All numbers in this section come from `scripts/val_chile.py` and `results/val_chile.json`. Every variant uses
ISC-GEM Mw at ≤ 70 km depth and, since v0.2, the direct-Mw b sample, except the two magnitude rows.

| Test | b [95 %] | n |
|---|---|---|
| Atlas setting (box 45–18° S, 76–66° W, 1976–2021, direct Mw) | 0.852 [0.783, 0.937] | 472 |
| Same, every event (v0.1 sample, v0.2 floors) | 0.920 [0.852, 0.992] | 584 |
| Only events with larger uncertainty (24 % of the box; 14 % globally) | 1.394 [1.191, 1.687] | 112 |
| Fixed thresholds 5.2 … 6.4 (Aki, no floor) | 0.824–0.892 | 910 … 89 |
| Box Mc: MAXC+0.2 / MBS / GFT, 1976–2003 | 5.7 / 5.4 / 5.3 | 371 |
| Box Mc: MAXC+0.2 / MBS / GFT, 2004–2021 | 5.4 / 5.0 / 5.0 | 828 |
| Without the 2010 Maule window (30 d before to 365 d after, 565 km) | 0.871 [0.788, 0.957] | 405 |
| Without the 2014 Iquique window | 0.872 [0.800, 0.959] | 443 |
| Without all five Mw ≥ 7.9 windows (1985, 1995, 2010, 2014, 2015) | 0.960 [0.869, 1.078] | 312 |
| Gardner-Knopoff mainshocks only | 0.675 [0.589, 0.784] | 180 |
| b-positive (time-ordered, above the period floor) | 0.882 [0.755, 1.008] | 190 differences |
| Interface only (PB2002 SUB within 200 km) / coastal strip 76–69° W | 0.848 / 0.851 | 444 / 461 |
| North 18–27° S / central 27–33° S / south-central 33–45° S | 0.817 / 0.848 / 0.880 | 124 / 168 / 180 |
| Depth ≤ 40 km / 40–70 km | 0.853 / 0.848 | 387 / 85 |
| 1976–2009 / 2010–2021 | 0.890 / 0.819 | 192 / 335 |
| Kagan & Jackson settings (1977–2010, m ≥ 5.8), Chile box | 0.871 [0.761, 1.015] | 182 |

- **Mc choice is not the cause.** Fixed thresholds from 5.2 to 6.4 give 0.82–0.89.
- **The large sequences pull b down only a little.** Removing any one of them changes b by less than 0.03.
  Removing all five raises it to 0.96, which includes 1.0. That is 34 % fewer events, and the interval widens.
  b-positive, which is less sensitive to short-term aftershock incompleteness, gives 0.882 and includes 1.0.
  Gardner-Knopoff declustering lowers b, as it does globally (§6).
- **Box, depth and period are not the cause.** All 29 box, depth, period, sequence-removal and fixed-threshold
  variants fall in 0.82–0.96.
- **Magnitude origin matters, in the opposite direction.** The proxy-Mw events (larger ISC-GEM uncertainty) have a
  much higher b. v0.1 included them (0.914); v0.2 leaves them out (0.852).
- **Stronger reference.** Kagan & Jackson (2013, Table 1) give β = 0.57 ± 0.04 (b = 0.855 ± 0.06) for the
  GCMT Flinn-Engdahl region "Andean S. America", 1977–2010, m ≥ 5.8. At the same settings, our Chile box gives
  0.871 [0.761, 1.015] (z +0.18, **match**), and an approximate Andean envelope gives a TGR value of
  0.903 [0.801, 1.010] (z +0.60, match). Data: **same data (GCMT-based)**, so this shows that the atlas reproduces
  the GCMT value on the same events; it is not an independent confirmation. Without the five sequence windows the
  box gives 0.960 [0.869, 1.078], which contains the national-catalogue ≈ 1 (independent data, no uncertainty:
  consistent, uninformative).

**Conclusion: weak reference.** At Mw ≥ 5.4, Chile's teleseismic b on direct Mw is about 0.85–0.90, and the
published GCMT value (0.855) agrees. The earlier "≈ 1" came from a national catalogue at much smaller magnitudes.
No single choice moves the atlas value to 1.0. This fits the young-slab result in §4 (Nishikawa & Ide 2014).
Segment values from Crisosto & Tassara (2024), who use ISC b on 157 trench transects, could not be retrieved.

## 4. Plate-boundary type

Shallow ISC-GEM 1976–2021 events, nearest PB2002 step within 200 km:

| Class | b [95 %] | n |
|---|---|---|
| OSR oceanic spreading ridge | 1.480 [1.409, 1.562] | 1,358 |
| OTF oceanic transform | 1.174 [1.136, 1.217] | 2,698 |
| CTF continental transform | 1.035 [0.967, 1.113] | 761 |
| none (> 200 km from a step) | 0.977 [0.918, 1.022] | 1,287 |
| OCB oceanic convergent | 0.976 [0.882, 1.056] | 535 |
| SUB subduction | 0.971 [0.949, 0.994] | 6,287 |
| CRB continental rift | 0.965 [0.901, 1.041] | 687 |
| CCB continental convergent | 0.930 [0.872, 0.994] | 703 |

0.5.0: the point values are unchanged; the intervals moved by at most 0.014 with 1000 replicates (500 before).

Direct-Mw sample (v0.2). On every event (same floors) the values are 0.996–1.491; the largest shifts are SUB
1.001 → 0.971, CRB 1.011 → 0.965 and CCB 0.971 → 0.930 (`plate_boundary_types_all_events`).

| Comparison | Published | Data | Verdict (0.5.0) |
|---|---|---|---|
| SUB | b = 1.5 × 0.654 = 0.98 (GCMT subduction zones 1977–2010, as quoted from Kagan & Jackson; no uncertainty quoted with it) | same (GCMT) | consistent, uninformative |
| OSR | β 0.8–1.1 → b 1.2–1.65 for mid-ocean events (Kagan 2002, quoted in Kagan 2010) | same (GCMT) | consistent, uninformative (a range, no uncertainty) |
| non-ridge classes | universal β 0.63–0.67 → b 0.95–1.0 (Kagan 1999, as cited; not re-checked); Bird & Kagan (2004) give a common β 0.61–0.66 → b 0.915–0.99 (abstract; p. 2397) | same (GCMT) | SUB, CRB, OCB, CTF, CCB intervals overlap the range: consistent, uninformative; the per-class z-test against their Table 5 is in §8 (match) |
| Ranking | spreading highest; thrust and convergent lowest (Schorlemmer et al. 2005; TRACE 2026, see below) | same (GCMT; the catalogues of Schorlemmer et al. not checked) | consistent, uninformative (qualitative) |
| Subduction, young slabs (Mexico–Central America, Nankai–Ryukyu, south-central Chile, Cascadia) vs old (Japan Trench, Kuril–Kamchatka, Izu–Bonin–Mariana, Tonga–Kermadec) | b increases with slab age (Nishikawa & Ide 2014, ANSS catalogue) | independent | consistent, uninformative (direction only): young 0.899 [0.832, 0.970], old 1.067 [1.019, 1.118]; our two intervals do not overlap, so the contrast itself is significant in our data, but the publication gives no number to test against |

The slab-age groups use approximate literature ages assigned by region. The PB2002 `SEAFLOORAG` field holds codes
(220, 260), not ages, for subduction steps, so it could not be used.

Kagan (2010) warns that high oceanic b/β values partly reflect mixing populations with different corner
magnitudes. The OSR value is a real property of the catalogue, but it is not necessarily a different physical
power-law exponent.

**TRACE (arXiv 2603.21152).** The brief for this project quoted TRACE as reporting Mc ≈ 5.3–5.4 and b 0.6–1.8 by
plate-boundary type (GCMT Mw ≥ 5). We read the full HTML text of v4 (30 Sep 2026) and found only local b-values
(Ridgecrest, Sanriku). A search-engine summary of the PDF mentions a GCMT 1980–2023 Mw ≥ 5 analysis with median
b of about 1.12 for spreading centres and 0.93 for extension, with subduction, collision and transforms lower. We
could not confirm this in the text. It is treated as an unverified comparison: it agrees with our ranking, and its
spreading-centre value is lower than our OSR 1.48.

![b by boundary class](img/val_plate_b.png)

## 5. ComCat vs ISC-GEM b (catalogue consistency)

Global shallow events, 2004–2021, same years in both catalogues:

| Cutoff | ISC-GEM | ComCat as served | ComCat Mw proxy |
|---|---|---|---|
| 5.0 | 1.046 | 1.134 | 1.404 |
| 5.2 | 1.085 | 1.081 | 1.347 |
| 5.4 | 1.038 | 1.049 | 1.111 |
| 5.6 | 1.059 | 1.055 | 1.077 |
| 6.0 | 1.077 | 1.054 | 1.055 |

- The mb → Mw proxy inflates b by 0.25–0.36 below Mw 5.4. This is why the atlas never computes b on converted
  magnitudes.
- From 5.6 up, all three agree within about 0.03.

![b vs cutoff](img/val_b_cutoff.png)

## 6. Robustness

| Check | Result |
|---|---|
| Radius 200 / 400 km vs 300 km | median \|Δb\| 0.044 / 0.040 on 77 / 172 common cells (0.4.0: 0.042 / 0.039; v0.1: 0.035 / 0.039) |
| b-positive vs b (shown cells) | median +0.046; b⁺ inside the b interval in 67.5 % of cells (0.4.0: 64.9 %; v0.1: +0.029, 87.8 %; iid null about 96 %); explained in `bpositive.md` |
| Gardner-Knopoff declustering | global shallow b 1.035 → 0.887; per-cell median −0.205 (0.4.0: −0.202; not used for the map, see method §6) |
| Cutoff-stability flag | 2.9 % of shown shallow cells (0.4.0: 4.7 %) |

## 7. Omori-Utsu

- **Synthetic check.** 20 sequences with true p 1.05, c 0.05 days, Mm 8 and Mcat 4.5, with early events lost
  below Mc(t). Recovered: mean p 1.063, between-run SD 0.025, mean σp 0.028, median c 0.056. As a z-test of the
  mean against the known true p (se of the mean 0.025 / √20 = 0.006): z = +2.31, **differs** (independent:
  synthetic). The bias is +0.013, half the σp of a single fit, so it does not change any sequence's p by more than
  its own uncertainty; until 0.4.0 the test was "within two between-run SD" and said match.
- **Real sequences.** 40 sequences: 17 A, 10 B, 8 C, 5 insufficient. p of the A sequences ranges 0.80
  (2003 Tokachi-Oki) to 1.25 (1996 Biak). The 2011 Tohoku sequence gives p = 1.003 ± 0.011, but c is not
  resolved.
- **Not compared with published values.** No published p/c/K for these sequences was verified in this phase,
  because published fits use different catalogues, magnitude thresholds and windows. The estimator itself was
  validated against USGS operational aftershock forecasts in an earlier study by the same author on Ridgecrest
  (p 1.087 vs 1.10). That used a local catalogue and is not repeated here.

![Omori p](img/seq_omori_p.png)

## 8. Published b, β and Mc at teleseismic magnitudes

The full table with exact quotes and table numbers is in [`literature-values.md`](literature-values.md). The data
is in `scripts/val_literature.json`, and the code is `scripts/val_literature.py`. All 16 entries are flagged
`needs_human_check`, because they were extracted with LLM assistance. An independent re-read of the source PDFs on
2026-11-15 found all 16 values correct (field `checked_by_agent`); the Kagan & Jackson (2013) values were checked
against the arXiv v2 preprint, not the BSSA version of record. The flags stay until the author's review.

- **Ten regional values match** (in v0.1 and v0.2), nine of them on approximate boxes. They come from Kagan & Jackson 2013,
  Table 1: GCMT 1977–2010, m ≥ 5.8, tapered G-R β. Only the Tohoku box (35–40° N, 140–146° E) is defined
  exactly. Ours there is 1.023 [0.786, 1.264] (n = 93; 0.5.0 interval; v0.1 1.082, n = 105), against 0.96 ± 0.11 (published
  n = 109).
- **0.5.0 re-classification.** Data for every entry here: **same data (GCMT-based)**. The z-test needs the
  published uncertainty; Kagan & Jackson (2013) print β ± σ, Bird & Kagan (2004) print 95 % ranges, Kagan (2010)
  Table 2 and Petruccelli (2018) print none. So: 11 Kagan & Jackson entries **match** (|z| ≤ 1.12), the Bird &
  Kagan per-class test **matches**, the Kagan (2010) global and trench values are **consistent, uninformative**
  (until 0.4.0 they were z-tested with σ_pub = 0, z +1.53 and +1.20), the Kagan (2010) declustered value
  **differs** (0.972 outside [0.872, 0.929]) and the Petruccelli Mc range 5.4–5.5 is consistent, uninformative
  (our MAXC 5.4 [5.4, 5.4]).
- **Global and subduction aggregates (v0.2 numbers, intervals of 0.5.0).** On the direct-Mw sample: global
  1982–2008, m ≥ 5.6, TGR 1.035 [1.010, 1.058] against Kagan (2010) 1.016; trenches 0.992 [0.958, 1.028] against
  0.969; all 18 subduction zones 0.977 [0.938, 1.020] against 0.975 ± 0.015 (z +0.08). In v0.1 (every event) all three mismatched, higher
  by 0.06–0.08 (global 1.087 [1.063, 1.110], z = 5.93).
  - The proxy-Mw events are 14.6 % of Mw 5.6–6.0 and about 1 % from Mw 7.0 up. Alone, they give
    b = 1.736 [1.633, 1.850].
  - The marker (uncertainty 0.10 = direct Mw) is checked against GCMT magnitudes in ComCat (99.97 % agreement,
    `method.md` §2.1), not against ISC-GEM's own source column, which the ComCat copy does not carry.
- **Declustered global b differs**, and more so since v0.2 (0.903 [0.872, 0.929] against 0.972; v0.1 0.934).
  Gardner-Knopoff is not Kagan's declustering.
- **Mc matches.** The global MAXC+0.2 for 1980–2016 at 0–50 km is 5.4, against GCMT Mc 5.4–5.5 (Petruccelli 2018).
- **β by plate-boundary class matches (approximate).** Bird & Kagan (2004) Table 5 gives β per class with 95 % ranges.
  With the same z rule as the other entries, every class has |z| ≤ 1.96: our OSR 0.98 [0.84, 1.12] against OSR
  normal faulting 0.92 [0.60, 0.99] (z +0.70). Until 2026-11-15 this row compared only point values with the
  abstract range 0.53–0.92 and was a mismatch at the top end. They split OSR by mechanism and OTF by spreading rate;
  our OTF matches only their fast-spreading OTF (z +0.94; medium +2.18, slow +2.90).

## 9. Retrospective b before and after the 40 sequences

`scripts/val_bt.py` adds a `bt` field to `site/data/sequences.json` (schema in `data-schema.md`). It gives b in
four windows:
- 5 years before the mainshock;
- 1 year before;
- 0–30 days after;
- 30–365 days after.

The data is ISC-GEM Mw inside the sequence circle. The threshold is the atlas floor, raised to the window MAXC+0.2
and, after the mainshock, to Mc(t) = Mm − 4.5 − 0.75 log₁₀ t. **This describes the catalogue in hindsight. It is
not a forecast.**

- **Most windows are too small.** Of 40 sequences, 4 are outside ISC-GEM's coverage (1976–2021). The number of
  sequences with b shown (quality A/B) is:
  - 2 for 5 years before (v0.1: 3);
  - 0 for 1 year before;
  - 1 for 0–30 days after (v0.1: 2);
  - 2 for 30–365 days after (0.4.0: 1; v0.1: 2).

  At Mw ≥ 5.2–5.7, only the largest sequences have enough events. Teleseismic Mw catalogues cannot resolve b(t)
  for most M 8 sequences.
- **Shown values:**

| Sequence | 5 yr before | 0–30 d after | 30–365 d after |
|---|---|---|---|
| 2004 Sumatra–Andaman | insufficient | insufficient (n = 49) | 1.269 [0.892, 1.488] B (C in 0.4.0) |
| 2011 Tohoku | 0.873 [0.723, 1.066] B | 0.948 [0.796, 1.136] B | 0.888 [0.762, 1.049] B (A in 0.4.0) |
| 2021 Kermadec | 0.904 [0.750, 1.142] B | insufficient | not covered |
| 2013 Santa Cruz Is. | C | insufficient | insufficient |

  Direct-Mw sample (v0.2). In v0.1 Sumatra (0–30 d, 30–365 d), Maule (0–30 d) and Santa Cruz (5 yr before) were
  also shown; with the proxies removed they fall below 50 events or get wider intervals.

- **Tohoku is the only sequence with b shown both before and after.** The change is +0.015, and the intervals
  overlap: no detectable change at this magnitude range.
- **Published comparison.** No published before/after b at Mw ≥ 5 for a single great earthquake was found.
  - The closest is Srivastava et al. (2021, arXiv:2108.06557, preprint; ISC mb, 92–100° E). For Sumatra they
    report b 1.04 in the five years before 2004 and 1.14 after.
  - Our replication in the same band (13° S–11° N) has only 12 events above threshold in 2000–2004, against 280
    in 2005–2009 (b 1.026 [0.873, 1.162], A). It is **not testable**, so we cannot confirm or contradict the
    direction (independent data: ISC mb).
  - Nanjo et al. (2012) and Nuannin et al. (2005) describe a pre-2004 decrease, but their catalogues and
    magnitudes could not be verified from the text we read.
  - A 2026 preprint (arXiv:2603.22745) reports no rolling-b change before M ≥ 6 in Chile and Japan in ComCat.
- **Assumption.** The Mc(t) coefficients (4.5, 0.75) were derived for California. They are applied here unchanged.

## 10. v0.2: direct-Mw b sample, before and after

(History. The numbers and verdict words of this section are those of v0.2: absolute-width mask, 200 replicates,
"match / mismatch". The 0.5.0 changes are in §12.)

v0.1 used every ISC-GEM event of 1976–2021; v0.2 uses only direct Mw (uncertainty 0.10; `method.md` §2.1). Both runs
use the same data cut-off and seeds. The v0.1 numbers were recomputed with `ATLAS_B_MAGERR_MAX=all` and reproduce
the committed v0.1 outputs exactly (every number in `results/*.json` and every cell file unchanged).

| | v0.1, every event | v0.2, direct Mw |
|---|---|---|
| Events in the b sample, 1976–2021 | 56,585 | 49,536 (7,049 proxy Mw left out) |
| Global b, shallow ≤ 70 km | 1.043 [1.025, 1.059], n = 15,827 | 1.035 [1.018, 1.052], n = 15,725 |
| Global b, deeper | 0.969 [0.945, 0.996], n = 5,419 | 0.936 [0.911, 0.961], n = 4,976 |
| Floors, shallow, 1976–2003 / 2004–2021 | 5.7 / 5.2 | 5.8 / 5.3 |
| Floors, deeper, 1976–2003 / 2004–2021 | 5.4 / 5.4 | 5.4 / 5.2 |
| Shallow cells A / B (shown) | 80 / 124 (204) | 58 / 112 (170) |
| Deeper cells A / B (shown) | 22 / 48 (70) | 24 / 49 (73) |
| Per-cell change, shallow (167 cells shown in both) | – | median −0.019 (IQR −0.047 to +0.015); 63 % lower |
| Per-cell change, deeper (66 cells shown in both) | – | median −0.036 (IQR −0.054 to −0.015); 86 % lower |
| b-positive inside the b interval (shown shallow cells) | 87.8 % | 64.9 % |

- Shallow cells shown only in v0.1: 37; only in v0.2: 3. Deeper: 4 and 7.
- With every event but the v0.2 floors, global shallow b is 1.053; so the floor change alone moves it by +0.010
  and leaving the proxies out by −0.018.
- **b-positive did not follow.** In the 77 shallow cells with b and b-positive in both runs, b fell by a median
  0.022 and b-positive rose by 0.002. §11 and `bpositive.md` explain why.

**Verdicts that changed** (site validation table, `results/validation_table.json`):

- Literature: Kagan & Jackson (2013) all 18 subduction zones, Kagan (2010) global and Kagan (2010) trenches go
  from **mismatch to match**.
- Chile spread: the variant range moves from 0.86–0.98 to 0.82–0.96 (verdict text only; still "robust").
- No verdict went from match to mismatch. The declustered Kagan (2010) value stays a mismatch and moves further
  (z −2.50 → −5.13). The boundary-class ranking changes order below OTF/CTF (SUB now below "none" and OCB) but
  keeps its verdict. The Sumatra b(t) row stays "not testable". Michael (2014) rows are unchanged by design.

**The 16 literature comparisons** (primary estimator: TGR for every β entry):

| # | Entry | Published b | v0.1 (all events) | v0.2 (direct Mw) | Verdict v0.1 → v0.2 |
|---|---|---|---|---|---|
| 1 | `kj2013_fe01_alaska_aleutian` | 0.975 | TGR 0.990 [0.865, 1.133] (z +0.16) | TGR 0.915 [0.808, 1.044] (z -0.70) | match (approximate region) |
| 2 | `kj2013_fe05_mexico_guatemala` | 0.900 | TGR 0.819 [0.660, 1.021] (z -0.63) | TGR 0.795 [0.639, 0.946] (z -0.88) | match (approximate region) |
| 3 | `kj2013_fe06_central_america` | 1.020 | TGR 1.038 [0.880, 1.283] (z +0.13) | TGR 1.025 [0.868, 1.244] (z +0.04) | match (approximate region) |
| 4 | `kj2013_fe08_andean_south_america` | 0.855 | TGR 0.970 [0.866, 1.073] (z +1.43) | TGR 0.903 [0.804, 1.014] (z +0.60) | match (approximate region) |
| 5 | `kj2013_fe12_kermadec_tonga_samoa` | 1.200 | TGR 1.259 [1.156, 1.389] (z +0.70) | TGR 1.212 [1.108, 1.314] (z +0.15) | match (approximate region) |
| 6 | `kj2013_fe18_guam_japan` | 1.290 | TGR 1.285 [0.993, 1.651] (z -0.02) | TGR 1.259 [0.998, 1.631] (z -0.14) | match (approximate region) |
| 7 | `kj2013_fe19_japan_kamchatka` | 0.930 | TGR 1.072 [0.969, 1.201] (z +1.69) | TGR 0.993 [0.898, 1.116] (z +0.77) | match (approximate region) |
| 8 | `kj2013_tohoku_box` | 0.960 | TGR 1.082 [0.860, 1.333] (z +0.76) | TGR 1.023 [0.799, 1.260] (z +0.40) | match |
| 9 | `kj2013_fe24_sunda_arc` | 0.975 | TGR 1.077 [0.901, 1.253] (z +0.95) | TGR 1.018 [0.862, 1.211] (z +0.40) | match (approximate region) |
| 10 | `kj2013_fe46_andaman_sumatra` | 1.065 | TGR 1.010 [0.868, 1.151] (z -0.43) | TGR 0.921 [0.798, 1.080] (z -1.13) | match (approximate region) |
| 11 | `kj2013_all_18_subduction_zones` | 0.975 | TGR 1.034 [0.996, 1.073] (z +2.37) | TGR 0.977 [0.938, 1.013] (z +0.08) | **mismatch → match** (approximate region) |
| 12 | `kagan2010_global_mt56` | 1.016 | TGR 1.087 [1.063, 1.110] (z +5.93) | TGR 1.035 [1.012, 1.062] (z +1.53) | **mismatch → match** |
| 13 | `kagan2010_trenches_mt56` | 0.969 | TGR 1.053 [1.013, 1.094] (z +4.07) | TGR 0.992 [0.955, 1.029] (z +1.20) | **mismatch → match** (approximate region) |
| 14 | `kagan2010_global_declustered_mt56` | 0.972 | TGR 0.934 [0.902, 0.962] (z -2.50) | TGR 0.903 [0.874, 0.926] (z -5.13) | mismatch (approximate region) |
| 15 | `birdkagan2004_pb2002_class_range` | β per class, 0.53–0.92 (Table 5) | β 0.65–1.02 | β 0.63–0.98; per class \|z\| ≤ 1.24 | mismatch (approximate); **match** per class since 2026-11-15 (Table 5 read, same z rule) |
| 16 | `petruccelli2018_gcmt_mc_map` | Mc 5.4–5.5 | MAXC+0.2 5.4, MBS 5.6 | MAXC+0.2 5.4, MBS 5.8 | match |


## 11. b-positive vs b on the direct-Mw sample

**Numbers below are from 0.4.0** (76 cells). The 0.5.0 run uses 77 cells (the shown set changed with the relative
mask) and is in `results/val_bpos.json`; its headline values are: b⁺ inside the b interval 67.5 % of shown cells
(0.4.0 64.9 %), time-order part +0.010 [+0.002, +0.027] (0.4.0 +0.013 [−0.000, +0.028]), iid null inside share
96.5 % / 95.9 % at 0.1 / 0.01 magnitude resolution. The table and `bpositive.md` were **not re-checked number by
number** for 0.5.0 (unverified); the verdicts of the table were not re-assessed either.

`scripts/val_bpos.py` → `results/val_bpos.json`; full write-up in `bpositive.md`. The cells are the shown shallow
cells with b-positive; the medians carry 95 % bootstrap intervals over cells.

| Test | Result | Verdict |
|---|---|---|
| (a) Floor too low for the direct sample | Raising each cell's threshold by +0.2/+0.4 lifts b by +0.022/+0.054 (direct) and +0.032/+0.062 (every event); the direct − every gap stays −0.024 to −0.028 up to +0.3. Mc-Lilliefors: 5.8 for 1976–2003 (= floor); 6.1 for 2004–2021, the same for every event (pooled-shape rejection). 61/76 cells pass at the atlas threshold. | rejected |
| (b) Time-correlated thinning | Proxies are 51.8 % of above-floor events in the first day after a larger event, 4.4 % later. Paired, same floors: b −0.024, shuffled b⁺ −0.026, b⁺ −0.011; time-order part +0.013 [−0.000, +0.028]. Synthetic STAI lowers b and shuffled b⁺, not b⁺. Blind windows (0.25–2 d) do not close the gap. | cause of the v0.2 change |
| (c) b⁺ bias (small n, 0.01 vs 0.1 magnitudes) | iid G-R null with the cells' sizes and floors: b⁺ − b +0.005 / +0.008, inside 96.8 % / 96.4 % | rejected |
| (d) Boundary class | The time-order part appears in SUB and other cells alike. The order-free part is +0.012 (SUB) vs +0.073 (other) in v0.1; a tapered G-R with corner 7.0 / 7.5 gives +0.061 / +0.020 | order-free part depends on class |

No change to floors or estimators; the global b, A/B cells and validation verdicts are unchanged.

## 12. Release 0.5.0: what changed

- Mask on the relative width and 1000 replicates (`method.md` §4): shown shallow cells 170 → 172 (A/B 58/112 →
  55/117), deeper 73 → 71 (24/49 → 12/59). Global b, boundary-class b and slab-age b keep their point values; their
  intervals move by at most 0.014.
- Verdicts re-classified with the z rule and a data tag (top of this file). Rows whose verdict word changed:
  every Michael (2014) row (match / close / lower → consistent-uninformative or differs), California and the Chile
  sequence-removal row (match → consistent, uninformative), SUB, OSR, ranking and slab age (match → consistent,
  uninformative), Kagan (2010) global and trenches (match → consistent, uninformative), Kagan (2010) declustered
  (mismatch → differs), Petruccelli Mc (match → consistent, uninformative), Omori p (match → differs). New rows:
  the pooled synthetic b bias test, one match and one differs.
- Full old → new list: [`changes-0.5.md`](changes-0.5.md).

## Not verified

- The ISC-GEM version of the ComCat copy (not stated by ComCat), and whether results change with v13.0.
- The USGS public-domain statement: usgs.gov pages returned bot-protection pages and timeouts on 2026-11-13.
- Exact coefficients of Scordilis (2006). Only the slopes were confirmed through a secondary source; the
  intercepts are our own.
- Kagan (1999), the source cited for the universal β 0.63–0.67: no open copy was found, so that range is cited as
  given, not re-checked.
- TRACE's global plate-boundary b numbers (see §4).
- Every literature entry in §8 (`needs_human_check: true`; values re-read from the sources on 2026-11-15, author review pending); Flinn-Engdahl regions approximated by boxes.
- That ISC-GEM magnitude uncertainty 0.10 marks direct Mw. It is checked against GCMT magnitudes in ComCat
  (99.97 % of GCMT-sourced matches carry 0.10), not against ISC-GEM's own direct/proxy column, which the ComCat
  copy lacks (`method.md` §2.1).
- The tapered-distribution reading of the order-free part of b-positive − b (§11): no corner magnitude was fitted
  per cell. The full text of van der Elst (2021) was not accessible.
- The ISC-GEM overview and Di Giacomo et al. (2018) quotes in `method.md` §2.1 (read through a summariser).
- Mc(t) coefficients at teleseismic scale (§9).
- That the ANSS catalogue of Nishikawa & Ide (2014) is independent of GCMT for large events (its Mw may come from
  GCMT or USGS W-phase); the row is tagged "independent data" on the catalogue name.
- §11 and `bpositive.md` numbers after the 0.5.0 mask change (see the note in §11).
