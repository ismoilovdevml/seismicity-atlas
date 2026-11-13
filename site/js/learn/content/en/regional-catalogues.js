export default {
  sentence: `Regional catalogues come from dense national networks that record far smaller earthquakes than the global catalogues, each on its own local magnitude scale, so the atlas draws them as separate layers and never merges them with the global cells.`,
  simple: [
    `A national network with stations every few tens of kilometres catches earthquakes too small to be felt. That gives thousands of events where the global catalogue has dozens, and b-values at a much finer scale.`,
    `But each network measures size its own way, usually a local magnitude ML or a duration magnitude Md, calibrated for its own region. An ML 3 in Italy and an ML 3 in New Zealand are not exactly the same thing, and neither is directly comparable to global Mw.`,
    `So regional layers sit on top of the global map with the same colours and quality rules, but on their own scale, with finer cells and smaller circles. Their licences differ too, and the legend names each one.`,
  ],
  analogy: `A city's own rain gauges give rainfall street by street; a satellite gives it for the whole country. Both are useful, but you would not average a gauge reading with a satellite pixel.`,
  example: {
    title: `{name}`,
    body: [
      `The atlas has {nReg} regional catalogues: {names}. The {name} layer uses the {catalogue} ({licence}), {period}, {nEv} events, magnitude type {magtype}. It is typically complete from {mc}, on H3 resolution {res} cells with a {radius} circle.`,
      `The global shallow floor for {floorPer} is {floor}. Earthquakes at the regional Mc are about {ratio} times smaller in radiated energy than at the global floor.`,
    ],
  },
  diagram: {
    title: `Completeness of the regional catalogues against the global floor`,
    caption: `Real data (regional/index.json, manifest.json). Each step of 1 in magnitude is about 32 times in energy and, with b ≈ 1, about 10 times in the number of events. Regional magnitudes are local scales, so the positions are indicative.`,
    alt: `A magnitude axis with one dot per regional catalogue between about 1 and 3, and a dashed line for the global floor above 5.`,
    xLabel: `Typical completeness magnitude`, globalLabel: `global floor {m}`, pick: `Region`,
    readout: `{name}: {catalogue}, {magtype}, {licence}, {period}. Typical Mc {mc}, H3 resolution {res}, circle {radius}. That is {dm} units below the global floor: about {energy} times less energy per event and roughly {count} times more events per unit of time.`,
  },
  tech: [
    `One magnitude type per region: each regional layer uses a single magnitude type as served by the network's FDSN event service; events with another type are excluded and the exclusion is stated in the region's caveat (docs/regional.md).`,
    `Cells and thresholds: finer H3 resolution and a smaller sampling circle, time-varying Mc per period, the same Aki-Utsu estimator with per-event thresholds, bootstrap intervals and A/B/C/insufficient rules as the global layer.`,
    `Never merged: regional b-values are not comparable one-to-one with global Mw b-values (local scales, different magnitude ranges), so they are drawn over the global cells and labelled, not averaged.`,
    `Licences and attribution: every network publishes under its own terms (the diagram above lists each one from the data). The legend block of each region names catalogue, licence, period and typical Mc, and the About page gives the full attribution.`,
  ],
};
