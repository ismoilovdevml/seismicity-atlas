# Changes in 0.6.0

## Method fixes

Each item: what was wrong, what changed, which outputs move after the rebuild.

- **Mc-Lilliefors bin edge.** With the magnitude resolution equal to the candidate step (both 0.1), the lower edge of
  the lowest kept bin was rounded half-to-even and fell one bin low for odd tenths, so the test rejected the true Mc
  (synthetic: true Mc 2.1 returned as 2.2). The edge is now taken with a ceiling. Outputs: none of the published runs
  (they use a resolution of 0.01, where the edge was already exact).
- **Omori-Utsu c.** The search for c was unconstrained; without early data c ran to about 10⁻¹⁵ day with a singular
  Hessian and no standard errors (2004 Sumatra in `sequences.json`, c = 0 in some monitor files). c is now searched
  in [10⁻⁴ day, max(T, 1 day)]; a fit that ends at the bound is flagged `c_at_bound`, its `sc` is null and the
  errors of K and p are those for c fixed there. Outputs: `sequences.json`, monitor files, `results/sci2_ntest.json`,
  `results/monitor_oaf_validation.json` (c, sc, sp, p of the affected sequences).
- **Omori-Utsu K error.** `sK` was K/√n, which ignores the covariance of K with p and c. It is now
  K √(1/n + gᵀ Cov(p, log c) g), g = ∂ log A / ∂(p, log c). Synthetic check: spread of K 5.4, old sK 2.8, new 5.1–5.3.
  Outputs: `sK`, `K_lo`, `K_hi` in `sequences.json` and the monitor files (about twice as wide).
- **NaN in JSON.** Some outputs were written with `NaN` (invalid JSON), e.g. `"sp": NaN` in
  `results/monitor_oaf_validation.json`. Every writer in the pipeline now goes through `common.jdump`, which writes
  null and refuses any non-finite value that slips through.
- **Synthetic Omori check.** The check removed early events with M < Mc(t), a stricter cut than the fit's own rule
  (binned M ≥ Mc(t) − 0.05), which biased the recovered p upwards (published: p 1.063 for a true 1.05, z = +2.3).
  It now uses the fit's rule and 100 sequences instead of 20. Outputs: `sequences.json` `synthetic_check`, the
  "Omori p recovery" row of the validation table.
- **Aftershock depth window.** The sequence circle had no depth limit, so shallow background entered the sequences
  of deep mainshocks (2018 Fiji M 8.2 at 600 km: 12 % of the events above Mcat were more than 100 km shallower).
  Events must now lie within 100 km of the mainshock depth (`monitorlib.depth_window`), in `sequences.py`, the
  monitor and the N-test. Outputs: `sequences.json` (mostly the deep sequences), monitor files.
- **Sequence b-positive above Mcat.** The monitor and `sequences.py` took b-positive over every queried event, also
  those between the query minimum and Mcat, where static incompleteness biases b-positive low. Only events ≥ Mcat
  enter now (the role of the period floor on the map). Outputs: monitor `bpos`, `omori_b` and, through it, the Omori
  fits; `sequences.json` `b_seq`.
- **Zhang & Werner reference ratios.** The expected count for our sequences was taken above Mc(t), the one for their
  reference sequences above 4.5 without the Mc(t) term, so our ratios were inflated relative to the reference by
  1.12 (M 8.0), 1.34 (M 8.5), 1.75 (M 9.0). Both now use the count above Mc(t). Outputs: monitor
  `productivity_zw2020` (reference median and range up, ratio classes may move from "above" to "within").
- **N-test.** The bootstrap resampled exactly n learning events, so the refits carried no count uncertainty; it now
  draws the size from Poisson(n). The background term counted every event of the year before the mainshock,
  including earlier sequences (2021 Chignik: 2,074 events, mostly the 2020 M 7.8 and M 7.6 sequences); it now counts
  the Gardner-Knopoff independent events of that year without the 30 days before the mainshock. Refits: 1000
  (was 200). Outputs: `results/sci2_ntest.json`.
- **Monitor query size.** A sequence with more than 20,000 events at M ≥ 3.5 stopped the monitor; the query is now
  split in time after the M ≥ 3.5 retry.
- **Monitor productivity wording.** The method text said "more"/"less" when the 95 % interval excludes the regional
  mean; the code (and docs/monitor.md) use the 25th–75th percentile band. The text now says what the code does.
- **Deficit b sample.** The Tien Shan catalogue was cut at Mw ≥ 5.80 before `b_aki` binned it, so the lowest bin
  (5.75–5.84) lost its 5.75–5.79 events, the mean magnitude rose and b came out low: 0.954 (n = 38) instead of
  0.998 (n = 40) at the 2026-11-13 data. The b sample now keeps Mw ≥ 5.75; counts and moment bands keep Mw ≥ 5.8.
  Outputs: `deficit/index.json` `b_whole_belt`, β and every Monte Carlo summary of the deficit layer.
- **Deficit moment balance.** When even a corner at Mw 6.0 released more than the geodetic budget, the draw was
  marked unbalanced and simulated with a corner of 10.5 (the opposite end). It is now simulated with 6.0 and counted
  in the new `over`; `unbal` keeps only the draws that need a corner above 10.5. For β ≥ 1 (b ≥ 1.5) the tapered
  G-R mean moment was NaN (`gammaincc` needs a positive order); it is now computed with the recurrence of the upper
  incomplete gamma function. Outputs: `p_full`, `p_half`, `mc_bal`, `unbal`, new `over` in the deficit layer.
- **ComCat minimum magnitude.** ComCat served an M 3.38 event (nc21364840) in the M ≥ 4.5 download; `fetch.py` and
  `prepare.py` now drop rows below the query minimum. Outputs: three California cells (Mc(t) and FMD rows of their
  detail files), ComCat counts by one event.
- **ISC-GEM period from one setting.** The last ISC-GEM year (2021) was written into atlas.py, validate.py,
  val_bt.py, val_chile.py, prepare.py and the deficit layer (also as 58.0 years and 2022-01-01). It is now
  `iscgem_last_year` in `scripts/release.json`, and `prepare.py` stops when the catalogue holds later events
  instead of cutting them silently. Outputs: none for the current data.
- **Declustering per depth layer.** Gardner-Knopoff windows are epicentral and were applied to the whole catalogue
  before the ≤ 70 / > 70 km split, so a deep event could remove a shallow one above it (and the reverse): 9.1 % of
  the deeper and 1.4 % of the shallow ISC-GEM events changed between mainshock and aftershock. Each layer is now
  declustered on its own (`seislib.decluster_gk_layers`; prepare.py and the regional layers). Outputs: every
  `*_bdecl` value, the declustered global b in validation.json, the declustered literature row,
  `results/prepare.json` mainshock counts, the regional declustered b.
- **Declustered b gate.** `*_bdecl` was published whenever the full-sample b passed, also from a handful of
  declustered events (84 of 172 shown shallow cells and 39 of 71 deeper cells had fewer than 50; Panama 7 events,
  3.2 [0.78, 5.21]; NZ regional cell n = 2 without an interval). It now needs its own quality A/B (n ≥ 50, relative
  width), and the new `*_qdecl` gives that code. Outputs: `cells.geojson` (fewer `*_bdecl`), regional cells and
  detail `stats.b_decl`.
- **PB2002 step midpoints.** The midpoint of a boundary step was the arithmetic mean of its end longitudes, which
  put the 11 steps that cross 180° near 0° (e.g. a NA/PA subduction step at 50.50 N 0.24 E). It is now the
  great-circle midpoint. Outputs: the boundary class of 16 ISC-GEM events (`pb_class`, cell `pb`, boundary-type
  validation rows by a few events).
- **Regional polygons across 180°.** The regional layers drew 14 New Zealand cells with a 359.8° longitude jump;
  they now use the same continuous-longitude polygon as the global cells (`common.h3_polygon`). Outputs:
  `regional/nz/cells.geojson` geometry.
- **Regional magnitude type case.** The SoCal filter compared magnitude types case-sensitively and dropped 4 events
  served as `Ml`. The comparison is now case-insensitive. Outputs: SoCal counts by 4 events.
- **One bootstrap size.** 0.5.0 moved the published intervals to 1000 replicates, but the regional `summary.json`
  region-wide b, the b-positive diagnosis (`val_bpos.py`, per cell and in the iid null), the Groningen moving
  b-positive and the N-test still used 200. Every one now takes `atlaslib.NBOOT`. Outputs: interval ends of
  `regional/*/summary.json` `region_b`, `results/val_bpos.json`, `induced/groningen` moving b-positive,
  `results/sci2_ntest.json`.
- **Groningen ML ≥ 3.0.** The list of ML ≥ 3.0 events used the 0.1 bin, which also holds ML 2.95 and 2.99: 16 events
  instead of 14. It now uses the reported ML. Outputs: `induced/groningen/rates.json` `events_ge3` (14 events), the
  stars of the map figure, the "16 events" in docs/induced.md (to be updated with the rebuild).
- **Manifest checksums.** `site_layers.py` hashed `rating.json` before `build_rating.py` rewrote it, so a changed
  rating left a stale checksum. `run_all.sh` now ends the site step with `site_layers.py --rehash`; a test checks
  every checksum against the file on disk.
- **Depth labels.** `release_diff.py` (and so docs/changes-0.5.md) labelled the depth classes "< 60 km" and
  "60-300 km"; the atlas split is ≤ 70 km and > 70 km (to the deepest event, 693 km). Text only.
- **Magnitude bins and the b estimator.** (1) `bin_mag` rounded ties (x.x5) to whichever side the float quotient
  fell (5.25, 5.35, 5.45 down; 5.15, 5.75 up). 9 % of ISC-GEM Mw end in 5, so the 0.1 bins had unequal widths and b
  changed with the parity of the threshold: global shallow direct-Mw b at thresholds 5.5…6.3 zigzagged by up to
  0.015 (e.g. 1.035 at 5.8, 1.017 at 5.9, 1.040 at 6.0). Ties now go up (bin x = [x − 0.05, x + 0.05)). (2) b,
  b with per-event thresholds, b-positive and every bootstrap replicate use the maximum-likelihood estimator for
  binned magnitudes, β = ln(1 + ΔM / x̄) / ΔM (Tinti & Mulargia 1987; the form of van der Elst 2021 and SeismoStats),
  instead of the Aki-Utsu ΔM/2 approximation, which is biased by −0.3 % at b = 1 and −1 % at b = 1.5. The Shi-Bolt
  σ is kept: on synthetic data it matches the spread of the estimates within the Monte Carlo error (ratio 0.96–1.02
  for b 0.8–1.5, n 300–3000), so the claimed 2–4 % underestimate was not confirmed. Outputs: every b, b-positive,
  interval, quality code and Mc (MAXC bins of tie magnitudes) on the map, in the regional and induced layers, the
  validation rows and the monitor; global shallow b of the Python/JS analysis of ISC-GEM 1976–2021 1.053 → 1.057.
  The browser analysis (`site/js/analyze/core.js`) must get the same change (the JS/Python parity test checks it).
- **b-positive threshold (checked, not changed for the map).** The map uses events above the period floor (method.md
  §5: the floor is the static completeness; the cell Mc is raised by aftershock gaps, which b-positive is meant to
  tolerate); `analysis.py` and the browser use max(Mc, floor) because a user catalogue has no separate floor. The
  sequence b-positive (monitor, `sequences.py`) used no threshold at all; it now uses Mcat (see above).

## Effect on the headline numbers (rebuild of 2026-11-20, cut-off 2026-11-13)

| Output | 0.5.0 | 0.6.0 |
|---|---|---|
| Global b, shallow ≤ 70 km, 1976–2021 | 1.035 [1.018, 1.052], n = 15,725, Mc 5.2 | 1.054 [1.036, 1.073], n = 12,985, Mc 5.3 |
| Global b, deeper > 70 km | 0.936 [0.911, 0.961], n = 4,976, Mc 5.4 | 0.924 [0.900, 0.955], n = 4,008, Mc 5.5 |
| Shallow floor 1976–2003 / 2004–2021 | 5.8 / 5.3 | 6.3 / 5.2 |
| Deeper floor 1976–2003 / 2004–2021 | 5.4 / 5.2 | 5.5 / 5.3 |
| Cells with a shown b, shallow / deeper | 172 / 71 | 136 / 66 |
| High-hazard cells (GEM PGA ≥ 0.35 g) without a b | 400 of 555 (72 %) | 429 of 555 (77 %) |
| Validation, independent data | 1 match, 2 differ | 2 match, 1 differs |

Why the shallow 1976–2003 floor rose: with the old tie rounding the bin counts were uneven (5.7: 947 events,
5.8: 976) and b jumped at 5.8 (1.022 against 0.984 at 5.7), which met the b-stability criterion early. With even bins
the counts fall smoothly and b rises steadily with the threshold up to 6.3 (0.966 at 5.5, 1.009 at 5.8, 1.061 at
6.3), so the criterion is first met at 6.3. MAXC + 0.2 is 5.5. The floor is the larger of the two, as before.
