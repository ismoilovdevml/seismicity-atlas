export default {
  sentence: `Every cell gets a quality code, A, B, C or insufficient, from the number of events and the width of its 95 % interval relative to b, and the b-value is shown only for A and B.`,
  simple: [
    `The atlas has one hard rule: <strong>no b-value without its interval and quality code</strong>.`,
    `If too few earthquakes are above the completeness threshold, the cell is <strong>insufficient</strong>. If there are enough but the interval is still very wide compared with b itself, the cell is <strong>C</strong> and b is hidden: a number that could be anything in a wide range would mislead. Narrow intervals give <strong>A</strong>, moderately narrow ones <strong>B</strong>.`,
    `So the grey and hatched areas on the map are not missing work. They are the honest answer for a global catalogue of moderate and large earthquakes.`,
  ],
  analogy: `A weather station that reported only two days last year cannot give you a reliable yearly average. The atlas would rather leave the box empty and say why than print a guess.`,
  example: {
    title: `Four cells, four codes`,
    body: [
      `Across the {nAll} shallow cells with events: {nA} are A, {nB} are B, {nC} are C and {nI} are insufficient.`,
      `A: the cell near {aLoc} has {aNb} events above threshold and an interval {aCiw} wide, {aCiwr} × b (b = {aB}). B: the cell near {bLoc}, {bNb} events, width {bCiw}, {bCiwr} × b (b = {bB}). C: the cell near {cLoc} has {cNb} events but an interval {cCiwr} × b wide, so b is withheld. Insufficient: the cell near {iLoc} has only {iNb} events above threshold.`,
      `The thresholds come from the data release: A up to {wA} × b wide, B up to {wB} × b, and at least {nMin} events.`,
    ],
  },
  diagram: {
    title: `Sample size, relative interval width and the code`,
    caption: `The slider uses the textbook approximation width / b ≈ 2 × 1.96 / √n, which does not depend on b; the real cells (dots) are placed by their bootstrap width divided by their b. Fewer than the minimum number of events gives “insufficient” whatever the width.`,
    alt: `A horizontal axis of interval width divided by b with green A, blue B and red C zones; a marker moves as the number of events changes; four real cells are shown as dots.`,
    xLabel: `Width of the 95 % interval divided by b`,
    zone: `{q}`, cellLabel: `real {q} cell, {nb} events`, insufficient: `insufficient`,
    slider: `Events above threshold`,
    readout: `{n} events: interval about [{lo}, {hi}] around b = {b}, width {w} = {wr} × b, code {q}.`,
  },
  tech: [
    `Rule (manifest.json, method.quality): at least {nMin} events above the per-event thresholds, otherwise <code>insufficient</code>; then A if the bootstrap 95 % interval is at most {wA} × b wide (b = the point estimate of the cell), B if at most {wB} × b, else C (b masked, only the width is published).`,
    `Why relative to b (since release 0.5.0; before, the limits were absolute widths): the interval grows with b itself, about 3.92 × b/√n, so an absolute limit kept low-b cells and hid high-b cells with the same number of events. On synthetic cells with 70 events above a known threshold, the old rule showed 98 % of the cells with b = 0.8 and 2 % of those with b = 1.5, and the shown b of the b = 1.5 cells averaged 1.24; the relative rule shows 73 to 77 % at every b, and the shown cells average the true b within 0.02 (tests/test_atlaslib.py). At a fixed total number of events, cells with a high b still pass less often, because fewer of their events lie above MAXC + 0.2.`,
    `Why width and not only n: the same n can give different widths when Mc is poorly defined or the sample mixes periods; the bootstrap width includes the Mc uncertainty. A cutoff-stability flag (<code>unstable</code>) is added when b at threshold + 0.2 and + 0.4 both fall outside the interval on the same side.`,
    `Map conventions: A full colour, B the same colour at reduced opacity, C hatched, insufficient a light grey wash. The legend counts how many cells pass the gate.`,
    `Limitation: the gate controls precision, not accuracy. A cell can be A and still biased (for example by a wrong threshold), and neighbouring A cells share events (Wiemer & Wyss 2002; Marzocchi et al. 2020).`,
  ],
};
