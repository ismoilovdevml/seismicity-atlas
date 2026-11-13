# Validation

All values are read from `results/validation.json`, `results/validation_table.json` and `results/sequences.json`
(run of 2026-11-13, fixed random seeds). Intervals are 95 %. A mismatch is reported as a mismatch.

## 1. Synthetic recovery (estimator)

60 synthetic cells per row. True b is drawn from 0.7–1.4 and true Mc from 5.0–6.0. Detection is a logistic
roll-off: 50 % at Mc − 0.2, about 88 % at Mc. In the two-period case, half the events come from a period that is
complete only above 5.7.

| Case | Events above Mc | Median bias of b | RMSE | 95 % CI coverage | Cells shown (A/B) | Max \|error\| when shown |
|---|---|---|---|---|---|---|
| one period | 30 | −0.052 | 0.249 | 1.000 | 0 % | – |
| one period | 50 | +0.035 | 0.182 | 1.000 | 2 % | 0.200 |
| one period | 100 | −0.018 | 0.140 | 0.983 | 40 % | 0.232 |
| one period | 200 | −0.021 | 0.105 | 0.933 | 72 % | 0.202 |
| one period | 500 | −0.020 | 0.059 | 0.983 | 95 % | 0.139 |
| one period | 1000 | −0.013 | 0.059 | 0.883 | 100 % | 0.186 |
| two periods | 100 | −0.002 | 0.150 | 0.950 | 47 % | 0.206 |
| two periods | 200 | −0.014 | 0.130 | 0.983 | 63 % | 0.284 |
| two periods | 500 | −0.011 | 0.082 | 0.933 | 92 % | 0.245 |
| two periods | 1000 | −0.008 | 0.051 | 0.950 | 100 % | 0.153 |

- **The estimator is nearly unbiased.** Median bias is within ±0.05 in every row, and within ±0.021 from 100
  events up.
- **Coverage is close to nominal**, 0.88–1.00. At n = 1000 (one period) it drops to 0.88: the residual roll-off
  just above Mc lowers b by about 0.01, which is now larger than the narrow interval.
- **The quality gate works as intended.** With ≤ 50 events almost nothing is shown, and the largest error among
  shown cells is 0.28.
- **Mc.** MAXC + 0.2 lands 0.1 above the true Mc in one-period cells and 0.2–0.3 above it in two-period cells.
  This is the conservative direction. Unit tests: `tests/` (11 pass).

![Synthetic recovery](img/val_synthetic.png)

## 2. Global b and Mc vs Michael (2014)

Michael (2014) analysed ISC-GEM v1 (2013, 1900–2009, magnitude selection thresholds 7.5 / 6.25 / 5.5). The ComCat
copy used here is a later release that adds about 12,000 pre-1960 events and extends to 2021 (Di Giacomo et al.
2018), so completeness is expected to differ.

| Test | Ours | Michael 2014 | Verdict |
|---|---|---|---|
| b, shallow < 60 km, 1918–2009, his Mc(t) | 1.078 [1.056, 1.102] (n = 8,768) | 1.05 | close; 0.006 outside our interval |
| b, ≥ 60 km, 1964–2009, Mc 5.7 | 0.997 [0.962, 1.033] (n = 2,811) | 0.99 | match |
| Mc, ≥ 60 km, 1964–2009 | MAXC 5.7, MBS 5.8 | 5.7 | match |
| Mc, < 60 km, 1964–1975 | MAXC 5.7, MBS 5.7 | 6.0 | lower by 0.3 |
| Mc, < 60 km, 1976–2003 | MAXC 5.4, MBS 5.7 | 5.8 | lower by 0.1–0.4 |
| Mc, < 60 km, 2004–2009 | MAXC 5.2, MBS 5.2 | 5.7 | lower by 0.5 |
| Mc, < 60 km, 1900–1963 (four periods) | 6.0–6.5 | 6.5–7.7 | lower by 0.5–1.2 |

- **Mc.** For the modern periods our Mc values are 0.1–0.5 lower than Michael's. They are consistent with Di
  Giacomo et al. (2015), who give completeness Mw 5.6 from 1964. Michael's values were chosen subjectively on a
  catalogue already cut at 5.5. The early periods differ most because the extension project added many smaller
  pre-1960 events. These are completeness estimates for today's catalogue, not errors in either study.
- **b.** For 1964–2003, b at Michael's own Mc values is 1.108 ± 0.030 (1964–1975) and 1.079 ± 0.015
  (1976–2003). Pooled over 1918–2009 we get 1.078, slightly above his 1.05; he reports 1.05 as fitting "within
  1 standard deviation". The difference is small but outside our interval. A likely cause is the catalogue
  version; we did not test it.
- **Atlas setting** (1976–2021, our floors): global b = 1.043 [1.025, 1.059] shallow (≤ 70 km) and
  0.969 [0.945, 0.996] deeper.

![Mc by period](img/val_mc_michael.png)
![Mc over time](img/val_mc_time.png)

## 3. Regional b vs published values

Shallow ISC-GEM events, 1976–2021, region boxes as in `scripts/validate.py`, same estimator and floors as the map.
Published numbers come from local catalogues at much smaller magnitudes. A match only means the teleseismic
b-value agrees with the long-run local one; it does not prove the method.

| Region | Ours | Published | Verdict |
|---|---|---|---|
| California | 0.919 [0.757, 1.111], n = 84, B | ≈ 1.0 (Hutton, Woessner & Hauksson 2010, SCSN) | match (wide interval) |
| Chile | 0.914 [0.844, 0.984], n = 613, A | ≈ 1 (0.97 LSQ / 1.1 MLE; a 2018 national-catalogue study, weak source) | **mismatch**: ours is lower |
| Japan | 0.970 [0.918, 1.027], n = 1,007, A | no verified number at Mw ≥ 5 found | reference only |
| Italy | n = 35 above Mc | ≈ 1.0 in Italian hazard models | **not testable**: too few Mw ≥ 5.4 events |
| Zagros vs Makran | Zagros 1.316 [1.036, 1.664] (C, n = 65); Makran n = 25 | Zagros highest, Makran lowest of the Iranian units (Iranian Plateau catalogue, J. Seismol. 2020) | same direction, but neither passes the quality gate |

Chile's lower b fits the young-slab result in §4 (Nishikawa & Ide 2014). The published value we found is weak,
so we report the mismatch rather than explain it away. Better regional references (for example JMA- or
CSN-based b at M ≥ 5) were not found within this phase.

## 4. Plate-boundary type

Shallow ISC-GEM 1976–2021 events, nearest PB2002 step within 200 km:

| Class | b [95 %] | n |
|---|---|---|
| OSR oceanic spreading ridge | 1.447 [1.386, 1.509] | 1,907 |
| OTF oceanic transform | 1.169 [1.132, 1.203] | 3,624 |
| CTF continental transform | 1.056 [0.993, 1.123] | 922 |
| SUB subduction | 0.999 [0.977, 1.020] | 7,768 |
| CRB continental rift | 0.991 [0.928, 1.057] | 804 |
| none (> 200 km from a step) | 0.991 [0.940, 1.041] | 1,317 |
| OCB oceanic convergent | 0.967 [0.892, 1.031] | 710 |
| CCB continental convergent | 0.960 [0.900, 1.025] | 844 |

| Comparison | Published | Verdict |
|---|---|---|
| SUB | b = 1.5 × 0.654 = 0.98 (GCMT subduction zones 1977–2010, as quoted from Kagan & Jackson) | match |
| OSR | β 0.8–1.1 → b 1.2–1.65 for mid-ocean events (Kagan 2002, quoted in Kagan 2010) | match |
| non-ridge classes | universal β 0.63–0.67 → b 0.95–1.0 (Kagan 1999; Bird & Kagan 2004) | CRB, OCB, CCB, SUB match; CTF slightly higher |
| Ranking | spreading highest; thrust and convergent lowest (Schorlemmer et al. 2005; TRACE 2026, see below) | match |
| Subduction, young slabs (Mexico–Central America, Nankai–Ryukyu, south-central Chile, Cascadia) vs old (Japan Trench, Kuril–Kamchatka, Izu–Bonin–Mariana, Tonga–Kermadec) | b increases with slab age (Nishikawa & Ide 2014) | **match**: young 0.943 [0.872, 1.021], old 1.089 [1.051, 1.127]; the intervals do not overlap |

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
spreading-centre value is lower than our OSR 1.45.

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
| Radius 200 / 400 km vs 300 km | median \|Δb\| 0.035 / 0.039 on common cells |
| b-positive vs b (shown cells) | median +0.029; b⁺ inside the b interval in 87.8 % of cells |
| Gardner-Knopoff declustering | global shallow b 1.043 → 0.895; per-cell median −0.192 (not used for the map, see method §6) |
| Cutoff-stability flag | 4.9 % of shown shallow cells |

## 7. Omori-Utsu

- **Synthetic check.** 20 sequences with true p 1.05, c 0.05 days, Mm 8 and Mcat 4.5, with early events lost
  below Mc(t). Recovered: mean p 1.063, between-run SD 0.025, mean σp 0.028, median c 0.056.
- **Real sequences.** 40 sequences: 17 A, 10 B, 8 C, 5 insufficient. p of the A sequences ranges 0.80
  (2003 Tokachi-Oki) to 1.25 (1996 Biak). The 2011 Tohoku sequence gives p = 1.003 ± 0.011, but c is not
  resolved.
- **Not compared with published values.** No published p/c/K for these sequences was verified in this phase,
  because published fits use different catalogues, magnitude thresholds and windows. The estimator itself was
  validated against USGS operational aftershock forecasts in an earlier study by the same author on Ridgecrest
  (p 1.087 vs 1.10). That used a local catalogue and is not repeated here.

![Omori p](img/seq_omori_p.png)

## Not verified

- The ISC-GEM version of the ComCat copy (not stated by ComCat), and whether results change with v13.0.
- The USGS public-domain statement: usgs.gov pages returned bot-protection pages and timeouts on 2026-11-13.
- Exact coefficients of Scordilis (2006). Only the slopes were confirmed through a secondary source; the
  intercepts are our own.
- Bird & Kagan (2004) per-class β values. Their tables were not retrievable, so the class comparison uses Kagan's
  universal β and the ridge range instead.
- TRACE's global plate-boundary b numbers (see §4).
