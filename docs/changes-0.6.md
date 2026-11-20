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
