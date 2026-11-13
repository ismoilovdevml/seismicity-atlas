export default {
  sentence: `Earthquake “magnitude” is not one number but a family of measurements, each made on different seismic waves, and only the moment magnitude Mw keeps growing for the largest earthquakes.`,
  simple: [
    `A magnitude is read from the shaking that seismometers record. Different scales listen to different waves: <strong>mb</strong> uses short, about one-second body waves; <strong>Ms</strong> uses slower surface waves of about twenty seconds; <strong>ML</strong> (the original Richter idea) and <strong>Md</strong> (from how long the record lasts) are made by local networks for nearby, mostly small events.`,
    `<strong>Mw</strong>, the moment magnitude, is different: it comes from the seismic moment, the size of the fault area times how far it slipped times the stiffness of the rock. It does not run out of range.`,
    `The short-wave scales stop growing for big earthquakes. A great earthquake and a merely large one can get almost the same mb. This is called <em>saturation</em>.`,
  ],
  analogy: `Measuring a wave on the beach with a one-metre ruler works for small waves. For a tsunami you still read “one metre”. mb is the short ruler; Mw measures the whole volume of water.`,
  example: {
    title: `Which magnitude is behind the dots on the map`,
    body: [
      `The event layer of the map holds {n} earthquakes of magnitude 6 or more. Their magnitudes come from different sources: {iscgem} are ISC-GEM Mw, {mwtype} are ComCat moment-type magnitudes, {mbproxy} are ComCat mb converted to an Mw proxy, {msproxy} are Ms converted to an Mw proxy, and {other} keep another magnitude type unchanged.`,
      `The {year} {place} has magnitude {mag} in ComCat, of type “{magtype}”, a moment magnitude. Its mb would have saturated far below that.`,
      `The b-value layers use only one of these sources, ISC-GEM Mw (see “Direct vs proxy Mw”).`,
    ],
  },
  diagram: {
    title: `Saturation of short-period magnitudes (schematic)`,
    caption: `Schematic curves: they show the shape of saturation, not a calibration. The level where each scale flattens depends on the period of the waves it measures.`,
    alt: `Line chart: the dashed diagonal is Mw itself; mb flattens first, then ML, then Ms, as the true size grows.`,
    mw: `Mw (moment, no saturation)`, mb: `mb (≈ 1 s body waves)`, ML: `ML (local)`, Ms: `Ms (≈ 20 s surface waves)`,
    xLabel: `True size, Mw`, yLabel: `Reported magnitude`,
    slider: `True size Mw`,
    readout: `At Mw {mw} the schematic scales read mb {mb}, ML {ML} and Ms {Ms}.`,
  },
  tech: [
    `Seismic moment and moment magnitude (Hanks–Kanamori form, M₀ in N·m):<code class="lr-formula">M₀ = μ · A · D,   Mw = (2/3) · (log₁₀ M₀ − 9.1)</code>where μ is the shear modulus, A the rupture area and D the average slip. Because Mw follows the moment itself, it grows without limit.`,
    `mb is measured on P waves with periods near 1 s and Ms on Rayleigh waves near 20 s. Once the rupture is much longer than those wavelengths, the amplitude at that period hardly grows any more; mb flattens around the low 6s and Ms around 8 (exact levels depend on the agency and formula).`,
    `In this atlas: b is computed only on ISC-GEM Mw (1976–2021). ComCat's preferred magnitude is mostly mb for M 4.5–6 and Mw above, so a b-value fitted on ComCat as served depends on where the type switches. ComCat-only events are put on a common scale only for the event layer, with fixed conversions (Scordilis 2006 slopes): Mw = 0.92 + 0.85 mb, and a bilinear Ms relation. The event tooltip names the magnitude type of each dot.`,
    `Limitations: conversions between scales carry a scatter of about 0.2 magnitude units and bias b when used for statistics (Castellaro et al. 2006). Local ML and Md scales differ from network to network, which is why regional layers are kept apart.`,
  ],
};
