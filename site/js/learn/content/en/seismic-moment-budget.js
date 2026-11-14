export default {
  sentence: `A seismic moment budget compares the moment that crustal strain accumulates, measured by GNSS and InSAR, with the moment that earthquakes have released; their ratio is sometimes called seismic coupling.`,
  simple: [
    `Plates and crustal blocks move a few millimetres per year. Where the crust is locked, that motion is stored as strain, like a spring being wound. Earthquakes release it. The seismic moment (rigidity × fault area × slip) measures the size of an earthquake in the same units as the stored strain.`,
    `Adding up all earthquakes since 1904 and dividing by the geodetic rate gives a ratio. Below 1 looks like a “deficit”, above 1 like a “surplus”. But the largest earthquakes in a region such as the Tien Shan return every few centuries, so one event in 120 years decides the ratio.`,
    `That is why the atlas never shows the ratio alone: always with its 95 % interval and p_full, the share of simulated, fully coupled catalogues of the same length that release less than observed. Part of the strain may also go into creep and folding, without any earthquake.`,
  ],
  analogy: `Judging a household budget from one month that contained the yearly insurance payment: the month looks overspent, the next eleven look thrifty, and neither tells you whether the year balances.`,
  example: {
    title: `Tien Shan, whole belt`,
    body: [
      `Geodetic moment rate at full coupling: {mg} [{mgLo}, {mgHi}] × 10¹⁹ N m per year. Observed seismic release since 1904 over that rate: {r} [{lo}, {hi}] (95 %), p_full {p}. A deficit beyond catalogue noise would need p_full below 0.05; this is no detectable deficit beyond catalogue noise.`,
      `In the central Tien Shan the ratio is {cr} [{clo}, {chi}], p_full {cp}; removing its largest earthquake (Mw {cm}, {cy}) changes the central value by a factor of {ck}. The corner magnitude that would balance the whole-belt budget at the observed rate of {n6} events Mw ≥ 6 since 1964 is Mw {bal}.`,
    ],
  },
  diagram: {
    title: `How a fully coupled zone looks in a short catalogue`,
    caption: `Synthetic, seeded. Orange: the geodetic budget of the whole Tien Shan belt accumulating at full coupling. Blue: earthquakes of a simulated catalogue that releases exactly that budget on average (observed Mw ≥ 6 rate, b of the belt, balancing corner magnitude). Move the catalogue length; the steps are single large earthquakes.`,
    alt: `A straight line of accumulated geodetic moment and a staircase of released seismic moment that falls behind for decades and jumps ahead with each great earthquake.`,
    lgGeod: `Geodetic budget (full coupling)`,
    lgSeis: `Released by simulated earthquakes`,
    xLabel: `Years of catalogue`,
    yLabel: `Moment, 10²¹ N m`,
    bigLabel: `largest Mw {m}`,
    readout: `After {y} years: released / accumulated = {ratio} from {n} simulated earthquakes Mw ≥ 6. The table gives the spread over 200 histories of 120 years.`,
    slider: `Catalogue length`,
    yearsFmt: `{y} yr`,
    again: `Simulate another history`,
    colQ: `Percentile, 200 histories of 120 years`,
    colRatio: `Released / accumulated`,
  },
  tech: [
    `Geodetic moment rate: Ṁg = 2 μ H Σ A ε̇, with ε̇ = max(|ε̇1|, |ε̇2|, |ε̇1 + ε̇2|) (Savage & Simpson 1997) on the 0.05° strain-rate grids of Ou et al. (2026) and Chang et al. (2025), μ 28–33 GPa and H 15–25 km drawn uniformly. This is the minimum moment at full coupling.`,
    `Seismic moment rate: ISC-GEM and ComCat Mw ≥ 5.8, depth ≤ 70 km, each magnitude band summed over its own complete period (Michael 2014), with the Mw uncertainty in the interval; and a long-term rate from a tapered Gutenberg-Richter law (Kagan 2002).`,
    `p_full: 4,000 simulated catalogues from 1904 to the cut-off under full coupling, each with the corner magnitude that balances the budget (Bird & Kagan 2004), analysed with the same band-wise estimator. p_full is the share that releases less than observed.`,
    `Validation: the Kostrov arithmetic reproduces Molnar & Ghose (2000), 6.86 vs 7 ± 2 mm/yr; the strain share west of 82° E matches Chang et al. (2025) within the stated precision. With the Molnar & Ghose moments the whole-belt ratio halves, which is why early magnitudes are listed as a caveat.`,
  ],
};
