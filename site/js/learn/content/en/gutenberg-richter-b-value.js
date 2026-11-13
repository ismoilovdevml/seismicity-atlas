export default {
  sentence: `The b-value is the slope of the Gutenberg-Richter law: it says how many times fewer earthquakes there are for each step of one magnitude unit, and on Earth it is close to 1.`,
  simple: [
    `Small earthquakes are common and large ones are rare, and the ratio is surprisingly regular. With b = 1, each step up of one magnitude unit has about ten times fewer events: ten M5 for every M6, ten M6 for every M7.`,
    `A <strong>higher b</strong> (say 1.3) means relatively more small events and fewer large ones. A <strong>lower b</strong> (say 0.8) means relatively more large events.`,
    `Laboratory and field studies link b to the stress in the rock: lower b where stress is higher, as in thrust faulting; higher b at ridges and in normal faulting. In a global M ≥ 5 catalogue such differences are subtle and must be read through their intervals.`,
  ],
  analogy: `Picture a staircase going down: each step is one magnitude unit, and each step down holds about ten times more earthquakes. The b-value is how steep the staircase is.`,
  example: {
    title: `b in a subduction cell near {loc}`,
    body: [
      `Shallow events, ISC-GEM direct Mw, above the per-event thresholds: b = {b} [{lo}, {hi}] from {nb} events, quality {q}. One magnitude unit up, about {ratio} times fewer events.`,
      `For comparison, the whole world (1976–2021, direct Mw) gives b = {gB} [{gLo}, {gHi}] for shallow events and {dB} [{dLo}, {dHi}] for deeper ones.`,
    ],
  },
  diagram: {
    title: `Turn the Gutenberg-Richter line`,
    caption: `Real cumulative counts of the example cell (filled dots: at or above Mc). The line pivots around the count at Mc; its slope is −b. “Best fit” uses the single-threshold maximum-likelihood estimate.`,
    alt: `Log-scale cumulative FMD with a straight line through the point at Mc whose steepness follows the b slider.`,
    lgData: `Events with magnitude ≥ M (real)`, lgLine: `Gutenberg-Richter line`,
    yLabel: `Events with magnitude ≥ M`, pivot: `pivot at Mc`,
    slider: `b`, fitBtn: `Best fit, b = {b}`,
    readout: `b = {b}: each magnitude unit up has about {ratio} times fewer events. Best single-threshold fit {fit}; the atlas value for this cell is {atlas}.`,
  },
  tech: [
    `Gutenberg-Richter law: <code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>Equivalently, magnitudes above the threshold are exponentially distributed with β = b · ln 10.`,
    `Estimator (Aki-Utsu maximum likelihood with the binning correction): <code class="lr-formula">b̂ = log₁₀ e / ( M̄ − (Mc − ΔM/2) ),   ΔM = 0.1</code>where M̄ is the mean magnitude of the events at or above Mc. The atlas uses the per-event-threshold form of the same estimator (see “Magnitude of completeness”).`,
    `Moment magnitude and the power law: since Mw grows with (2/3) log₁₀ M₀, b = 1.5 β_M where β_M is the exponent of the seismic-moment distribution. Kagan and Bird & Kagan found β_M ≈ 0.63–0.67 (b ≈ 0.95–1.0) for most plate-boundary classes and higher values at mid-ocean ridges.`,
    `In this atlas: b is shown only with its 95 % interval and quality code; it is withheld when the interval is too wide or the sample too small. Neighbouring cells share events, and small samples bias b (Marzocchi et al. 2020), so two places are compared only through their intervals. On the site: the b layer, the large b value in the cell panel and the comparison view.`,
  ],
};
