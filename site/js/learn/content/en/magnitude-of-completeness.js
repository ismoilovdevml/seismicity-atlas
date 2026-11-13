export default {
  sentence: `The magnitude of completeness, Mc, is the smallest magnitude above which a catalogue records essentially every earthquake in a place and period.`,
  simple: [
    `Seismic networks miss small earthquakes: they are too weak to be picked up by enough stations, or they hide in the coda of a bigger one. Above some size, nothing is missed any more. That size is Mc.`,
    `Every statistic that counts earthquakes by size, including the b-value, must use only events at or above Mc. Below it, the counts fall because of the network, not because of the Earth.`,
    `Mc changes over time and place. Networks improved over the decades, so the same region has a lower Mc today than in 1980. Oceans far from stations have a higher Mc than well-instrumented land.`,
  ],
  analogy: `A fishing net with a fixed mesh catches every fish larger than the holes and only some of the smaller ones. Counting the small fish in the net tells you about the net, not about the sea. Mc is the mesh size.`,
  example: {
    title: `A well-sampled subduction cell near {loc}`,
    body: [
      `In this cell (shallow events, ISC-GEM Mw), the most frequent magnitude bin (the maximum-curvature estimate, MAXC) is {maxc}. The atlas adds 0.2 and takes Mc = {mc}, with a bootstrap range of {mcLo}–{mcHi}.`,
      `Each event must also clear the global floor of its period: {floor0} for {per0} and {floor1} for {per1}. So the effective threshold here is the larger of the cell Mc and the period floor.`,
      `For comparison, the USGS feed as served (mostly mb) is complete here from about {mcCc} since 2010 and from {mcCc0} in 1973–1989. A dense regional network sees much smaller events: the {region} catalogue ({regionMag}) is typically complete from about {regionMc}.`,
    ],
  },
  diagram: {
    title: `Choose Mc on a real frequency-magnitude distribution`,
    caption: `Real data: number of shallow ISC-GEM Mw events per 0.1 bin in the example cell. Grey bins are below the chosen Mc and are left out. The b shown uses one threshold for all years; the atlas uses per-event thresholds, so its value differs slightly.`,
    alt: `Bar chart of event counts per magnitude bin; the bars rise to a peak (MAXC) and then fall. Bars below the dashed Mc line are grey.`,
    maxc: `MAXC`,
    slider: `Mc`,
    useMaxc: `MAXC + 0.2 = {m}`,
    useAtlas: `Atlas Mc {m}`,
    readout: `Mc {mc}: {n} events at or above it; single-threshold b = {b} (atlas b for this cell: {atlas}).`,
  },
  tech: [
    `Estimator: maximum curvature plus 0.2 (MAXC + 0.2, Woessner & Wiemer 2005) on magnitudes binned to 0.1. MAXC is the bin with the most events; it tends to underestimate Mc, hence the +0.2. The goodness-of-fit (GFT, Wiemer & Wyss 2000) and b-stability (MBS) methods are computed for the global comparison; MAXC and GFT tend to be low and MBS high, so together they bracket Mc (Mignan & Woessner 2012).`,
    `Time-varying completeness: for 1976–2003 and 2004–2021 a global floor per depth class is taken as max(MAXC + 0.2, MBS) of all direct-Mw events of that period. Each event's threshold is <code>thrᵢ = max(Mc_cell, floor(period of event i))</code>. A cell can raise the threshold but never lower it below the floor.`,
    `b with per-event thresholds: because the excess magnitude over any threshold is exponential with the same β, <code class="lr-formula">β̂ = n / Σ (mᵢ − (thrᵢ − ΔM/2)),   b = β̂ / ln 10</code>(Aki-Utsu with a per-event Mc). A single low threshold over periods with different completeness biases b low.`,
    `On the site: the Mc layer (ISC-GEM, or ComCat for 2010–cut-off and 1973–1989 in its own mostly-mb magnitude), Mc and its range in the cell panel, the dashed Mc line on the cell's FMD and the Mc(t) chart in the cell details.`,
  ],
};
