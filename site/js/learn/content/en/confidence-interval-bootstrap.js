export default {
  sentence: `The 95 % interval shown with every b-value is the range that would cover the true b in 95 of 100 repeats of the measurement, and the atlas estimates it by the bootstrap: re-drawing the catalogue many times and re-computing b.`,
  simple: [
    `A b-value from a few hundred earthquakes is uncertain: a slightly different set of earthquakes would have given a slightly different number.`,
    `We cannot rerun the Earth, but we can rerun the sample. The <strong>bootstrap</strong> draws a new catalogue of the same size from the real one, at random and with replacement (some events twice, some not at all), and computes b again. After many such draws, the middle 95 % of the b-values is the interval.`,
    `A narrow interval means the data pin b down well. A wide one means they do not, and the atlas then withholds b (see “Quality codes”).`,
  ],
  analogy: `To learn how much a poll result could wobble, you could ask a new random group of the same size, many times. The bootstrap does this with the people you already asked, drawing them again at random.`,
  example: {
    title: `The interval of a subduction cell near {loc}`,
    body: [
      `b = {b} with a 95 % interval of [{lo}, {hi}], {ciw} wide, from {nb} events above threshold and {nboot} bootstrap replicates. Quality {q}.`,
      `Values of b anywhere between {lo} and {hi} are consistent with these data. Another cell whose interval overlaps this one is not shown to have a different b.`,
    ],
  },
  diagram: {
    title: `Bootstrap replicates build the interval`,
    caption: `Each replicate resamples the cell's events above Mc with replacement and re-estimates b with one fixed threshold. The atlas also re-estimates Mc in every replicate, so its interval (bar above the chart) is usually a little wider.`,
    alt: `Histogram of bootstrap b-values that grows replicate by replicate; at the end a shaded band marks the central 95 %.`,
    xLabel: `b of a bootstrap replicate`, yLabel: `Replicates`,
    band: `central 95 %`, atlasBar: `atlas interval`,
    start: `Press Play to draw the replicates.`,
    running: `Replicate {k} of {n}: b = {b}. Central 95 % so far: [{lo}, {hi}].`,
    done: `{n} replicates: central 95 % [{lo}, {hi}]. The atlas interval, with Mc re-estimated each time, is [{alo}, {ahi}].`,
    again: `New draw`, skip: `Show the result`,
  },
  tech: [
    `Procedure per cell and depth class: draw n events with replacement from the n events in the sampling circle; re-estimate the cell Mc (MAXC + 0.2) and the per-event thresholds; compute b with the Aki-Utsu estimator; repeat {nboot} times. The interval is the 2.5th to 97.5th percentile of the replicates, so it includes the Mc uncertainty (Woessner & Wiemer 2005).`,
    `Why not only the formula: the classical standard error of b, σ ≈ b/√n (Aki) or the Shi–Bolt form, assumes a known, fixed Mc. Here the threshold itself is estimated and the sample is modest, so the percentile bootstrap is the more honest summary. The cutoff plots in the cell details use the Shi–Bolt ±1.96 σ for speed.`,
    `Limits: the bootstrap reproduces sampling noise, not systematic errors (a wrong magnitude scale, missing events above Mc, mixing two populations). Overlapping intervals do not prove equality; non-overlapping intervals are a conservative sign of a difference, not a formal test (Marzocchi et al. 2020).`,
    `On the site: the interval bar on the b scale in the cell panel, the bracket after every b value, the interval width that sets the quality code and the two-row interval chart of the comparison view.`,
  ],
};
