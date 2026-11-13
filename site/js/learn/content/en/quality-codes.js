export default {
  sentence: `Every cell gets a quality code, A, B, C or insufficient, from the number of events and the width of its 95 % interval, and the b-value is shown only for A and B.`,
  simple: [
    `The atlas has one hard rule: <strong>no b-value without its interval and quality code</strong>.`,
    `If too few earthquakes are above the completeness threshold, the cell is <strong>insufficient</strong>. If there are enough but the interval is still very wide, the cell is <strong>C</strong> and b is hidden: a number that could be anything in a wide range would mislead. Narrow intervals give <strong>A</strong>, moderately narrow ones <strong>B</strong>.`,
    `So the grey and hatched areas on the map are not missing work. They are the honest answer for a global catalogue of moderate and large earthquakes.`,
  ],
  analogy: `A weather station that reported only two days last year cannot give you a reliable yearly average. The atlas would rather leave the box empty and say why than print a guess.`,
  example: {
    title: `Four cells, four codes`,
    body: [
      `Across the {nAll} shallow cells with events: {nA} are A, {nB} are B, {nC} are C and {nI} are insufficient.`,
      `A: the cell near {aLoc} has {aNb} events above threshold and an interval {aCiw} wide (b = {aB}). B: the cell near {bLoc}, {bNb} events, width {bCiw} (b = {bB}). C: the cell near {cLoc} has {cNb} events but an interval {cCiw} wide, so b is withheld. Insufficient: the cell near {iLoc} has only {iNb} events above threshold.`,
      `The thresholds come from the data release: A up to {wA} wide, B up to {wB}, and at least {nMin} events.`,
    ],
  },
  diagram: {
    title: `Sample size, interval width and the code`,
    caption: `The slider uses the textbook approximation width ≈ 2 × 1.96 × b/√n; the real cells (dots) are placed by their bootstrap width. Fewer than the minimum number of events gives “insufficient” whatever the width.`,
    alt: `A horizontal axis of interval width with green A, blue B and red C zones; a marker moves as the number of events changes; four real cells are shown as dots.`,
    xLabel: `Width of the 95 % interval`,
    zone: `{q}`, cellLabel: `real {q} cell, {nb} events`, insufficient: `insufficient`,
    slider: `Events above threshold`,
    readout: `{n} events: interval about [{lo}, {hi}] around b = {b}, width {w}, code {q}.`,
  },
  tech: [
    `Rule (manifest.json, method.quality): at least {nMin} events above the per-event thresholds, otherwise <code>insufficient</code>; then A if the bootstrap 95 % interval is at most {wA} wide, B if at most {wB}, else C (b masked, only the width is published).`,
    `Why width and not only n: the same n can give different widths when Mc is poorly defined or the sample mixes periods; the bootstrap width includes the Mc uncertainty. A cutoff-stability flag (<code>unstable</code>) is added when b at threshold + 0.2 and + 0.4 both fall outside the interval on the same side.`,
    `Map conventions: A full colour, B the same colour at reduced opacity, C hatched, insufficient a light grey wash. The legend counts how many cells pass the gate.`,
    `Limitation: the gate controls precision, not accuracy. A cell can be A and still biased (for example by a wrong threshold), and neighbouring A cells share events (Wiemer & Wyss 2002; Marzocchi et al. 2020).`,
  ],
};
