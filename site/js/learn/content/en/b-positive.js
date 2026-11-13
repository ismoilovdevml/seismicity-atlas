export default {
  sentence: `b-positive estimates the b-value from the positive jumps between consecutive earthquake magnitudes, which makes it robust when small events are temporarily missing, for example right after a large earthquake.`,
  simple: [
    `After a big earthquake, seismograms are flooded and many small aftershocks are never catalogued. A normal b-value then sees too few small events and comes out too low.`,
    `b-positive uses a trick (van der Elst 2021): go through the earthquakes in time order and look at how much bigger each one is than the one before. Keep only the clear increases. The sizes of those increases follow the same law as the magnitudes themselves, with the same b, and they hardly care whether the network was missing small events at that moment.`,
    `The atlas uses b-positive as a robustness check next to the main b, not as a replacement.`,
  ],
  analogy: `If you only hear a conversation in a noisy room now and then, you cannot count the quiet words. But you can still notice how much louder one word is than the word you heard just before it, and that tells you about the speaker's range.`,
  example: {
    title: `A subduction cell near {loc}`,
    body: [
      `Main b = {b} [{lo}, {hi}]; b-positive = {bpos} [{bposLo}, {bposHi}].`,
      `Across the {nShown} shown shallow cells with both values, b-positive lies inside the 95 % interval of b in {share} % of cells, and the median of b-positive minus b is {med}.`,
    ],
  },
  diagram: {
    title: `Missing small events: classic b vs b-positive`,
    caption: `Synthetic catalogue with true b = 1: a steady background plus an aftershock sequence. After the large event, the detection threshold starts high and falls back over the chosen part of the time axis; grey dots are missed.`,
    alt: `Scatter of magnitude against time; after a large event many small dots turn grey as the incompleteness slider grows.`,
    lgSeen: `Recorded`, lgMissed: `Missed`, xLabel: `Time`, yLabel: `Magnitude`, big: `large event`,
    slider: `Incomplete period after the large event`,
    readout: `{miss} of {n} events missed. Classic b = {b}, b-positive = {bp} (true value 1.00).`,
  },
  tech: [
    `Differences of magnitudes from one exponential distribution follow a Laplace distribution; its positive side is exponential with the same β. With consecutive magnitudes in time order and a minimum difference δ:<code class="lr-formula">b⁺ = log₁₀ e / ( mean(Δmᵢ | Δmᵢ ≥ δ) − (δ − ΔM/2) ),   Δmᵢ = mᵢ − mᵢ₋₁</code>The atlas uses δ = 0.2 and ΔM = 0.1 (scripts/seislib.py, b_positive).`,
    `Input: events above the period floor, in time order. Interval: ±1.96 σ from the variance of the differences; b-positive is published only for cells with quality A or B.`,
    `Why it is robust: a short gap in detection removes small events, but a positive jump is mostly measured from a smaller preceding event to a larger one that is still recorded, so the distribution of jumps is little affected (van der Elst 2021).`,
    `Open point (docs/method.md §2.1): with the direct-Mw sample, b fell slightly in some cells while b-positive hardly moved; part of that may be events that GCMT missed just above the threshold. On the site: b⁺ with its interval in the cell panel's robustness block.`,
  ],
};
