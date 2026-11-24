# Sequence Monitor ("Ongoing" view)

> **Descriptive only, not a forecast.** The monitor describes the aftershocks recorded between each recent large
> mainshock and the data cut-off. It gives no probability, no expected number of future earthquakes, and no curve
> beyond the cut-off. The USGS publishes operational aftershock forecasts (the ComCat `oaf` product) on its event
> pages; national agencies publish their own. Use those for decisions.

Code: `scripts/monitor/` (`monitorlib.py` maths, `build_monitor.py` pipeline, `validate_oaf.py` comparison with the
USGS, `check_monitor.py` data guard). Data: `site/data/monitor/` ([data-schema.md](data-schema.md)). Tests:
`tests/test_monitor.py`, `tests/e2e/test_monitor.py`. Update: `.github/workflows/update-monitor.yml`, daily.

Numbers below are from the build with data cut-off **2026-11-13 00:00 UTC**.

## 1. Selection

- **Mainshocks.** ComCat events M ≥ 7.0 in the 365 days before the cut-off. If fewer than 5 independent mainshocks
  were found, the threshold would drop to M 6.5 and the site would say so. At this cut-off M ≥ 7.0 gives
  **14 sequences**, so the fallback was not used.
- **Independence.** Largest first. An event joins a larger chosen mainshock's sequence instead of starting its own
  when it lies in that mainshock's window (0–365 days after, within R) or is a doublet (|Δt| ≤ 1 day, within 2R).
  Candidates are read from two years back, so an older large event can still absorb its own aftershocks.
  - Example: the 2026-06-24 Venezuela M 7.2 came 33 s before the M 7.5, about 150 km away. It is listed inside
    the M 7.5 sequence, not as a sequence of its own.
- **Window.** The atlas rule: radius R = max(100 km, 10^(−2.44 + 0.59 M)) (Wells & Coppersmith 1994, as in
  `scripts/sequences.py`), depth within 100 km of the mainshock depth (since 0.6.0: the circle alone let shallow
  background into the sequences of deep mainshocks), from the mainshock to the cut-off. One ComCat query per
  sequence, M ≥ 2.5, as served (mixed magnitude types); above ComCat's 20,000-event limit the query is repeated at
  M ≥ 3.5 and, if still too large, split in time.
- **Overlaps.** Another M ≥ 6.5 event after the mainshock whose own circle intersects this one is listed; its
  aftershocks may be counted here. A second event within 0.5 units of the mainshock (inside the window or
  overlapping it) sets `contaminated`, which bars Omori quality A.

## 2. What is computed for each sequence

| Quantity | Method |
|---|---|
| Counts | all events, events ≥ Mcat, events in the last 7 days; daily counts; cumulative counts on a grid (1 h, 6 h, 12 h, then every day to the cut-off) |
| Mcat | MAXC + 0.2 of the events after min(10 days, half the sequence age); 4.5 when fewer than 30 such events |
| Mc(t) | max(Mcat, Mm − 4.5 − 0.75 log₁₀ t), t in days (Helmstetter et al. 2006; the F, G, H of Page et al. 2016 and the USGS) |
| Omori-Utsu K, c, p | MLE on events above Mc(t), with the expected rate K (t + c)^−p 10^(−b (Mc(t) − Mcat)) (`seislib.omori_fit_mct`, the same fit as the Sequences page); b = sequence b-positive if ≥ 50 differences, else 1.0; 95 % intervals from the observed information (c on a log scale; K with its covariance with p and c since 0.6.0); c in [10⁻⁴ day, max(T, 1 day)], `c_at_bound` when the fit ends at either bound |
| Omori quality | as on the Sequences page: A = n ≥ 100, σp ≤ 0.10, 0.5 ≤ p ≤ 2, not contaminated; B = n ≥ 50, σp ≤ 0.20, 0.5 ≤ p ≤ 2.5; C otherwise; insufficient below 20 events above Mc(t) |
| b | maximum likelihood for binned magnitudes (Tinti & Mulargia 1987; Aki-Utsu until 0.5.0) with each event's own threshold Mc(t) (`seislib.b_varmc`); 1000 bootstrap resamples of the sequence with Mcat re-estimated in each (200 before 0.5.0); shown only for A (95 % interval width / b ≤ 0.30) or B (≤ 0.50) with ≥ 50 events, as on the map |
| b-positive | van der Elst (2021), differences ≥ 0.2 of the events ≥ Mcat (since 0.6.0; before, every event ≥ 2.5), ± 1.96 σ, shown with ≥ 50 differences |
| Largest aftershock | its magnitude and day, and ΔM = Mm − Mmax; Båth's law gives about 1.2 |
| Productivity | see §3 |
| Cumulative chart | observed count above Mc(t) and the fitted expected count, both from the mainshock to the cut-off only |

**Magnitudes.** ComCat serves mostly mb for these international sequences (for example 92 % mb at Panama, 95 % at
Ende) and ml for Hubbard Glacier (93 %). The b-values are in those units. They are not comparable with the Mw
b-values of the map (method §2), and the card says so.

## 3. Productivity compared with Page et al. (2016)

1. The tectonic regime of the epicentre (Garcia et al. 2012) is read from the 0.05° grid of the USGS forecast
   software (OpenSHA OAF `TectonicRegimeTable.dat`, pinned commit, downloaded at build time).
2. With the regional generic p, c = 0.018 day and b = 1.0 held fixed, the only free parameter is the
   Reasenberg-Jones a-value. Its MLE is a = log₁₀(n / E) − b (Mm − Mcat), with n the events above Mc(t) and E the
   expected count for K = 1. Its standard error is 1 / (ln 10 √n). This is the "sequence-specific a" of the USGS.
3. The regional values are a mean a and a spread σ(M) = √(σ₀² + σ₁² / 10^max(M, 6)) (values in
   [prior-work.md](prior-work.md)). The middle half of the region (25th to 75th percentile) is
   mean ± 0.674 σ.
4. The label:
   - **more productive than most in its region so far**: the whole 95 % interval of a is above the 75th percentile;
   - **less productive**: the whole interval is below the 25th percentile;
   - **typical**: otherwise;
   - **too few events**: fewer than 10 events above Mc(t), or no Omori fit.

   The card also shows the ratio 10^(a − mean a) with its interval and the percentile of a in the regional
   distribution. "So far" matters: the label describes the sequence up to the cut-off, not its future.

## 4. Sequences at the 2026-11-13 cut-off

This table comes from the monitor build before 0.6.0 (no depth window, b-positive and the Omori b over every
event ≥ 2.5, c unbounded); it has not been rebuilt with the 0.6.0 code at this cut-off.

| Mainshock (UTC date, M, place) | Region | Days | Events M ≥ 2.5 | ≥ Mcat | Omori p [95 %] | q | b [95 %] | q | Largest aftershock (ΔM) | Productivity, ratio to regional mean |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-22 M 7.0 Nagqu, China | ANSR-DEEPCON | 21 | 42 | 23 (4.5) | 1.02 [0.72, 1.32] | C | (23 events) | insufficient | 5.9 (1.1) | typical, 1.4 [0.9, 2.1] |
| 2026-10-09 M 7.7 Pitaloza Arriba, Panama | SZ-GENERIC | 34 | 157 | 113 (4.5) | 1.28 [1.11, 1.46] | A | 1.36 [1.12, 1.69] | C (withheld) | 6.6 (1.1) | more, 2.8 [2.3, 3.3] |
| 2026-08-14 M 7.8 Ende, Indonesia | SZ-ONSHORE | 90 | 413 | 239 (4.5) | 1.49 [1.08, 1.90] | C | 1.30 [1.16, 1.48] | B | 6.1 (1.7) | more, 2.7 [2.4, 3.1] |
| 2026-08-10 M 7.4 San José del Palmar, Colombia (116 km deep) | SZ-ONSHORE | 94 | 44 | 16 (4.6) | – | insufficient | (16 events) | insufficient | 5.0 (2.4) | too few events |
| 2026-07-17 M 7.3 Puerto Madero, Mexico | SZ-GENERIC | 118 | 266 | 116 (4.4) | 1.02 [0.92, 1.12] | A | 1.13 [0.94, 1.37] | B | 6.4 (0.9) | more, 4.5 [3.8, 5.4] |
| 2026-06-24 M 7.5 Catia La Mar, Venezuela (with the M 7.2 doublet) | ANSR-ABSLSHC | 141 | 11 | 5 (4.5) | – | insufficient | (5 events) | insufficient | 5.0 (2.5) | too few events |
| 2026-06-07 M 7.8 Kablalan, Philippines | SZ-GENERIC | 158 | 470 | 196 (4.6) | 0.92 [0.84, 1.01] | A | 1.14 [1.00, 1.30] | B | 6.5 (1.3) | more, 3.7 [3.2, 4.2] |
| 2026-04-20 M 7.4 Miyako, Japan | SZ-GENERIC | 207 | 192 | 108 (4.4) | 0.76 [0.69, 0.83] | B (contaminated) | 1.10 [0.87, 1.30] | B | 6.9 (0.5) | more, 3.0 [2.5, 3.7] |
| 2026-04-01 M 7.4 Bitung, Indonesia | SZ-OUTERTR | 225 | 367 | 124 (4.6) | 1.03 [0.92, 1.14] | A | 1.18 [1.03, 1.43] | B | 6.3 (1.1) | more, 5.1 [4.3, 6.1] |
| 2026-03-30 M 7.3 Luganville, Vanuatu (121 km deep) | SZ-GENERIC | 228 | 74 | 21 (4.7) | 0.14 (no s.e.) | C | (21 events) | insufficient | 6.3 (1.0) | typical, 1.4 [0.9, 2.2] |
| 2026-03-24 M 7.5 Neiafu, Tonga (234 km deep) | SZ-GENERIC | 234 | 57 | 35 (4.4) | 0.77 [0.64, 0.90] | C | (35 events) | insufficient | 5.5 (2.0) | typical, 0.8 [0.5, 1.1] |
| 2026-02-22 M 7.1 Kota Belud, Malaysia (629 km deep) | ANSR-DEEPCON | 263 | 0 | 0 | – | insufficient | – | insufficient | – | too few events |
| 2025-12-08 M 7.6 Aomori, Japan | SZ-ONSHORE | 339 | 212 | 116 (4.4) | 0.68 [0.59, 0.78] | B (overlaps the M 7.4 Miyako area) | 0.94 [0.79, 1.20] | B | 6.9 (0.7) | typical, 1.2 [1.0, 1.4] |
| 2025-12-06 M 7.0 Hubbard Glacier, Alaska/Yukon | ANSR-SHALCON | 341 | 1,150 | 719 (2.7) | 1.12 [1.08, 1.16] | A | 0.91 [0.84, 0.99] | A | 5.8 (1.2) | typical, 1.1 [1.0, 1.2] |

What this shows:

- 5 of the 14 sequences have quality A decay fits, 2 B, 4 C and 3 too few events. The four intermediate-depth and
  deep mainshocks (116–629 km) recorded few or no aftershocks (0 to 74 events at M ≥ 2.5), as is usual at depth.
- 6 of the 9 subduction-zone sequences with enough events are labelled "more productive" (ratios 2.7–5.1), 3
  "typical" and none "less". Part of this may be a systematic offset rather than six unusual sequences (see §7,
  item 3).

## 5. Validation: reproducing the USGS `oaf` parameters

`scripts/monitor/validate_oaf.py` reads the current `oaf` product of every M ≥ 6.5 event in the 365 days and
refits it on ComCat data selected the same way: the USGS circle, its Mcat (or Mc), b and F/G/H, from the mainshock
to the forecast's creation time. Output: `results/monitor_oaf_validation.json`.

**Reasenberg-Jones, sequence specific: the like-for-like test** (c = 0.018 and b = 1.0 fixed as in the USGS fit):

| Sequence | Data to | n (M ≥ 4.0, 60 km) | USGS a | Ours a | USGS p | Ours p | Verdict |
|---|---|---|---|---|---|---|---|
| 2025 M 7.0 Hubbard Glacier | day 336.0 | 71 | −2.11 ± 0.053 | −2.109 ± 0.052 | 1.18 ± 0.047 | 1.193 ± 0.046 | **match** (differences 0.001 in a and 0.013 in p, well inside one σ) |

With c also free, our fit gives c = 0.0051 ± 0.0049 day and p = 1.12 ± 0.06: c is not constrained by these data,
which is why the USGS keeps it generic.

**Other products** (ours with c fixed at the USGS value; "a" is our single-Omori RJ a):

| Sequence | USGS model | Data to | n | USGS a (ams) | Ours a | USGS p | Ours p | Verdict |
|---|---|---|---|---|---|---|---|---|
| 2026 M 7.7 Panama | ETAS, Bayesian combination | day 30.9 | 61 | −2.57 (ams −2.26) | −2.261 ± 0.056 | 1.15 | 1.159 ± 0.055 | p matches; our a equals their ams |
| 2026 M 7.8 Ende, Indonesia | ETAS, Bayesian combination | day 86.8 | 87 | −2.28 (ams −2.01) | −2.44 ± 0.047 | 0.96 | 0.886 ± 0.040 | p close (−0.07, 1.8 σ); a lower than ams by 0.43 |
| 2026 M 7.5 Venezuela | ETAS, Bayesian combination | day 137.8 | 18 | −2.65 (ams −2.87) | −2.904 ± 0.102 | 1.03 | 0.986 ± 0.102 | p within 1 σ; a close to ams; few events |
| 2026 M 7.4 Colombia (116 km deep) | ETAS, Bayesian combination | day 91.2 | 18 | −2.13 (ams −2.28) | −3.48 ± 0.10 | 0.98 | 0.05 ± 0.26 | **mismatch**: 18 events cannot constrain p; the USGS value comes mostly from its prior (and its c = 1.0 day is at the edge) |
| 2026 M 6.5 Alaska (98 km deep) | RJ, Bayesian combination | day 56.0 | 3 | −3.31 ± 0.21 | – | 0.88 | – | **not testable**: 3 events |

Reading the comparison honestly:

- The one like-for-like test (RJ, sequence specific) matches to within a few hundredths. This confirms the
  likelihood with the time-dependent completeness, the a-value convention and the data selection.
- The ETAS products are not the same model. ETAS separates the mainshock's direct productivity (ams) from
  secondary triggering, and the USGS combines the sequence fit with a prior. Our p is within 2 σ of theirs in the
  three sequences with ≥ 18 events and a shallow source. Our single-Omori a equals their `ams` at Panama and is
  below both their `a` and `ams` at Ende and Venezuela; we do not claim agreement for a.
- Sequences with fewer than about 20 events are not testable. The monitor marks them "too few events" instead of
  showing a fit.

## 6. Synthetic tests

`tests/test_monitor.py` (8 tests, all passing):

- **Omori recovery with Mc(t).** Sequences with K = 40 per day, c = 0.05 day, p = 1.1, Mm 7.5, Mcat 2.5 (so Mc(t) is
  above Mcat for the first 4.6 days) and the early events below Mc(t) removed. Over 20 sequences the mean p must be
  within 0.035 of 1.1, and at least 16 of the 20 95 % intervals must hold the true p. A 40-sequence run with the
  same generator gave mean p 1.105, between-run SD 0.055 and mean σp 0.059.
- **Expected count.** The fitted expected count at the cut-off equals the observed count within 1 % (a property of
  the MLE of K), and the cumulative curve increases.
- **Productivity.** Sequences generated with a = regional mean, mean + 1 and mean − 1 (ANSR-SHALCON, p and c
  regional) return a within 4 standard errors and the labels typical, more and less.
- **b gate.** b = 1 is inside the bootstrap interval with quality A or B; 30 events give "insufficient".
- **Selection, regime grid, helpers.** The doublet and the in-window aftershock are absorbed and a distant event is
  kept; a synthetic grid in the OpenSHA format decodes correctly, including longitudes beyond 180°; Båth's ΔM,
  daily counts and the time grid.

## 7. Limitations

1. **Not a forecast.** Nothing here should be read as the chance of a large aftershock. The fitted curve stops at
   the cut-off on purpose.
2. **Teleseismic completeness.** Outside regions with dense local networks, ComCat is complete only above about
   M 4.4–4.7, so most sequences have tens to a few hundred usable events. The first hours are poorly recorded
   and c is often unresolved or traded off against p (Ende: c = 1.4 day, p = 1.49, quality C).
3. **Productivity offsets.** The comparison holds p at the regional value. When the sequence's own p differs, the
   fitted a depends on the time span (with our 100 km window and Mcat 2.7, Hubbard Glacier gives a = −2.39 at the
   regional p 0.98; the USGS gets −2.11 with p = 1.18 in its 60 km circle). The generic parameters also come from
   an older catalogue and a different window rule. The mostly "more productive" labels for subduction zones may
   partly reflect such offsets. The ratio and its interval are shown so that readers can judge the size.
4. **Mixed magnitudes.** b and the counts above Mcat use magnitudes as served (mostly mb). b from mb is not Mw b.
5. **Window rule.** A circle of radius R around the epicentre is a simple proxy for the aftershock zone. Large
   ruptures can extend beyond it, and neighbouring sequences can leak in (flagged as overlaps).
6. **Regime of deep events.** The Garcia regime is a property of the surface location; it is not specific to
   intermediate-depth or deep sources.
7. **Catalogue revisions.** ComCat revises locations and magnitudes for weeks; each daily build re-downloads the
   sequences, so numbers can change slightly from day to day.

## 8. Automation

`.github/workflows/update-monitor.yml` is scheduled every 3 hours (minute 41) and also runs on demand. GitHub delays
scheduled runs under load, sometimes by many hours, and may drop some; on 2026-11-14 the 05:41 run started at 12:28,
and on 2026-11-15 none had started by 08:00. So a **freshness gate** runs first: a scheduled run continues only when the
committed `site/data/monitor/index.json` is at least 20 hours old, and otherwise ends after a few seconds without
building or committing. A manual run always rebuilds. The result is about one refresh a day whose time drifts, not a
fixed hour. The Ongoing view shows a notice when the data is more than 36 hours old.

Steps when the gate lets a run through:

1. set up Python and the requirements;
2. fetch and build (`build_monitor.py`: one ComCat request per sequence, 1 s apart; the regime grid is cached);
3. `check_monitor.py`: required fields, no forecast-like keys, no curve past the cut-off, files listed in the
   index, total under 3 MB (about 0.09 MB now);
4. unit tests and the Chromium browser tests of the view;
5. commit `site/data/monitor` to `main` as `ismoilovdevml` (noreply address) if anything changed, then push.

A push made with `GITHUB_TOKEN` does not start other workflows, so `pages.yml` lists "Update monitor" under
`workflow_run` and redeploys the site after it.

## 9. Productivity compared with Zhang & Werner (2020)

An optional second productivity reference for **subduction-zone regimes** (Garcia `SZ-*`), stored next to the
Page et al. (2016) comparison as `productivity_zw2020` in each sequence file (and a short version in `index.json`).
Shown on the Ongoing cards since v0.3.1 ("Productivity, ETAS reference"), with a note that puts a "more productive" label from Page et al. (2016) in context when the sequence is within the Zhang & Werner range. Method version `monitor-1.1`.

**Source.** Zhang, L., Werner, M. J., Goda, K. (2020), "Variability of ETAS parameters in global subduction zones and
applications to mainshock–aftershock hazard assessment", BSSA 110(1), 191–212, doi:10.1785/0120190121; read from
the annotated manuscript on Zenodo (record 4270128). They fit space-time ETAS models to NEIC data around 36 M ≥ 7.5
megathrust earthquakes (1999–2017, depth < 100 km, Mcut = 4.5). Their only table of ETAS values is Table 6,
"Suggested ETAS parameters for future M9.0 events" (median ± standard error):

| K0 (labelled event/day) | α (magnitude⁻¹) | c (day) | p | d (km²) | γ (magnitude⁻¹) | q |
|---|---|---|---|---|---|---|
| 0.04 ± 0.02 | 2.3 ± 0 (fixed) | 0.03 ± 0.01 | 1.21 ± 0.08 | 23.48 ± 18.17 | 1.61 ± 0.29 | 1.68 ± 0.55 |

Per-sequence and per-region values (Cases 1–3) are given only in figures; the paper states that for M 7.5–7.9
individual sequences "K0 from 0.2 to 0.7 and α from 1.0 to 2.0" (free α). Table 2 lists, for each of the 36
sequences, the number of M ≥ 4.5 events and Mc in their individual-sequence windows (Case 3: 1, 2 or 4 years after
the mainshock, twice the rupture length and width). Both tables are transcribed in `monitorlib.ZW2020` and
`monitorlib.ZW2020_TABLE2_CASE3`.

**Maths** (`monitorlib.zw2020_productivity`). Their Omori function v(t) = (p − 1) c^(p−1) (t + c)^(−p) is normalised,
so K0 e^(α(M − 4.5)) is the expected number of **direct** aftershocks above 4.5 (despite the "event/day" label).
For our sequence:

1. D = K0 e^(α(Mm − 4.5)) ∫₀ᵀ v(t) 10^(−(Mc(t) − 4.5)) dt, the direct aftershocks above our Mc(t) between the mainshock
   and the cut-off (b = 1, which α = 2.3 corresponds to);
2. ratio = n / D, with n our count above Mc(t) (as for Page et al.); 95 % interval from the Poisson error of n and
   the standard error of K0 (0.02 on 0.04, delta method on log₁₀), so the interval is wide (about ×2.7 each side);
3. our n contains secondary aftershocks and background events, so the ratio is normally above 1. The reference is
   the same ratio for their own Case 3 sequences: their Table 2 count divided by D over their window (with Mc(t) and
   Mcat = 4.5, since 0.6.0: their NEIC counts miss the same early small aftershocks; before, D had no Mc(t) term
   there, which made the reference ratios 1.12 / 1.34 / 1.75 times too low at M 8.0 / 8.5 / 9.0), for the 14
   sequences with Mc ≤ 4.5, ≥ 100 events and a window defined in their Table 1 (the two M 8.0 events fall between
   their magnitude classes). Reference ratios: median **3.42**, range **1.50–10.75**;
4. `class` = "within" / "above" / "below" the reference range (point estimate), `ref_percentile` its position;
   `in_calibration_range` is false outside M 7.5–9.0 or for depth ≥ 100 km.

**Results at the 2026-11-14 12:00 UTC cut-off** (same data as §4; Colombia has too few events). n, D and the ratios
are from that build (before the 0.6.0 depth window); the percentiles are against the 0.6.0 reference ratios:

| Mainshock | M, depth | In range | n | D | Ratio [95 %] | Percentile of the reference | Page et al. label, ratio |
|---|---|---|---|---|---|---|---|
| Panama | 7.7, 10 km | yes | 111 | 45.8 | 2.42 [0.89, 6.57] | 21 | more, 2.8 |
| Ende, Indonesia | 7.8, 10 km | yes | 239 | 59.8 | 3.99 [1.49, 10.73] | 57 | more, 2.7 |
| Puerto Madero, Mexico | 7.3, 22 km | no (M) | 116 | 25.4 | 4.57 [1.69, 12.38] | 57 | more, 4.5 |
| Kablalan, Philippines | 7.8, 57 km | yes | 196 | 49.6 | 3.95 [1.47, 10.63] | 57 | more, 3.7 |
| Miyako, Japan | 7.4, 25 km | no (M) | 108 | 32.4 | 3.33 [1.23, 9.03] | 43 | more, 3.0 |
| Bitung, Indonesia | 7.4, 35 km | no (M) | 124 | 20.8 | 5.95 [2.20, 16.11] | 71 | more, 5.1 |
| Luganville, Vanuatu | 7.3, 121 km | no | 21 | 13.3 | 1.58 [0.54, 4.61] | 7 | typical, 1.4 |
| Neiafu, Tonga | 7.5, 234 km | no (depth) | 35 | 40.6 | 0.86 [0.31, 2.42] | 0 (below) | typical, 0.8 |
| Aomori, Japan | 7.6, 41 km | yes | 116 | 51.2 | 2.27 [0.84, 6.14] | 21 | typical, 1.2 |

Reading:

- All seven shallow subduction sequences lie **inside the range** of the Zhang & Werner sequences (percentiles
  21–71); only the 234 km deep Tonga event falls below, and it is outside their calibration (depth < 100 km).
- Against Page et al. (2016) six of the same sequences are "more productive". Against the ETAS-based reference
  they are ordinary. This supports §7, item 3: the "more productive" labels at least partly reflect the reference
  (generic RJ parameters, window rule, magnitude types), not unusual sequences.
- Limits: the reference has 14 sequences; their windows (twice the rupture dimensions, 1–4 years, NEIC) differ from
  ours (circle R, up to 1 year, ComCat as served); our mainshocks M 7.3–7.8 are at or below their lowest magnitude;
  only the K0 uncertainty is propagated (p, c held at Table 6). The comparison is descriptive and uses only data up
  to the cut-off.

Tests: `tests/test_sci2.py` (synthetic direct-only sequences with the Table 6 parameters return a mean log₁₀ ratio
within 0.03 of 0 over 12 runs; a 30-fold productivity gives the ratio within 0.1 in log₁₀ and "above"; the
reference ratios reproduce the Table 2 arithmetic; non-subduction regimes are not compared).

## 10. CSEP-style consistency check (retrospective, not on the site)

Whether a CSEP number test makes sense for a descriptive Omori fit, and the result of a retrospective N-test on
four completed sequences, are in [comparisons.md](comparisons.md) §5. Nothing from it is shown on the site.

## References

- Båth, M. (1965), Tectonophysics 2, 483–514.
- Garcia, D., Wald, D. J., Hearne, M. G. (2012), BSSA 102(1), 185–203.
- Helmstetter, A., Kagan, Y. Y., Jackson, D. D. (2006), BSSA 96(1), 90–106.
- Page, M. T., van der Elst, N., Hardebeck, J., Felzer, K., Michael, A. J. (2016), BSSA 106(5), 2290–2301.
- Reasenberg, P. A., Jones, L. M. (1989), Science 243, 1173–1176; (1994), Science 265, 1251–1252.
- van der Elst, N. J. (2021), JGR 126, e2020JB021027 (b-positive).
- Wells, D. L., Coppersmith, K. J. (1994), BSSA 84(4), 974–1002.
- Zhang, L., Werner, M. J., Goda, K. (2020), BSSA 110(1), 191–212, doi:10.1785/0120190121.
- USGS OpenSHA OAF software, github.com/opensha/opensha-oaf (generic parameters and regime grid).
