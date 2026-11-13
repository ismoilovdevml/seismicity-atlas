export default {
  sentence: `Since version 0.2 every b-value in the atlas uses only ISC-GEM moment magnitudes that were measured directly from the seismic moment, and leaves out the “proxy” Mw values that were converted from other scales.`,
  simple: [
    `ISC-GEM lists every earthquake with an Mw. For most events since 1976 that Mw was measured from the waveforms (the Global CMT project). For the others it was <em>converted</em> from mb or Ms with a formula: a proxy.`,
    `A conversion is an educated guess with scatter. When many guessed magnitudes sit near the bottom of the sample, they change the shape of the size distribution, and the b-value moves with them.`,
    `So the atlas now keeps only the measured ones. The marker it uses is the uncertainty listed with each magnitude: measured Mw carry the smallest value; proxies carry larger ones.`,
  ],
  analogy: `Think of a survey of people's heights where most were measured with a tape and some were estimated from shoe size. The estimates may be fine on average, but they blur the tails, and a statistic about how fast tall people become rare will be off.`,
  example: {
    title: `What converted magnitudes do to b`,
    body: [
      `Global shallow events of 2004–2021 above magnitude {cut0}: with ComCat's mb converted to Mw, b = {bProxy} ({nProxy} events). ComCat as served gives {bNative}, and ISC-GEM Mw gives {bIsc}. The proxy estimate is far too high, and the three agree only from magnitude {agreeCut} upward.`,
      `The atlas therefore fits b on “{sample}” from {period}. With that sample, the global shallow b is {gB} [{gLo}, {gHi}] from {gN} events above the period thresholds.`,
    ],
  },
  diagram: {
    title: `Global shallow b by cutoff, 2004–2021`,
    caption: `Real data (global.json). Bars are ±1.96 standard errors. The converted-mb curve rises steeply at low cutoffs, where mb saturation and the conversion slope distort the distribution.`,
    alt: `Line chart of b against magnitude cutoff for three magnitude choices; the ComCat converted-mb line starts much higher and meets the others at higher cutoffs.`,
    comcat_proxy: `ComCat, mb converted to Mw`, comcat_native: `ComCat as served (mixed types)`, iscgem: `ISC-GEM Mw`,
    xLabel: `Magnitude cutoff`, slider: `Cutoff`,
    readout: `Cutoff {cut}: converted mb gives b = {proxy}, ComCat as served {native}, ISC-GEM Mw {isc}.`,
  },
  tech: [
    `Rule: an ISC-GEM event of 1976–2021 enters the b sample only if its listed Mw uncertainty is at most {magerr}, i.e. a direct moment magnitude. Rates, counts, Mc(t), the event layers and the comparison with Michael (2014) keep every event. The period floors of Mc are recomputed on the same direct sample, so thresholds and sample match.`,
    `Why the uncertainty marks direct Mw: in the USGS ComCat copy of ISC-GEM there is no direct/proxy flag, but in 1976–2021 no event has an uncertainty between 0.10 and 0.20, and almost all events matched to a Global CMT magnitude in ComCat carry 0.10 (docs/method.md §2.1).`,
    `Why not correct instead of exclude: Gaussian magnitude errors of constant size leave b unbiased (Tinti & Mulargia 1985). The excess b of the proxies is far larger than noise explains; it comes from which events received proxies and from regression conversion, which biases b (Castellaro et al. 2006).`,
    `Cost and open point: about one event in eight of 1976–2021 leaves the b sample, the shallow floor of 1976–2003 rises by 0.1 and fewer cells pass the quality gate. In cells shown in both versions, b fell slightly while b-positive hardly moved; part of that drop may be events missed by GCMT just above the threshold. This is not resolved.`,
  ],
};
