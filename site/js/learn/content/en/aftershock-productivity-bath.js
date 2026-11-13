export default {
  sentence: `Båth's law says the largest aftershock is typically about 1.2 magnitude units smaller than the mainshock, and the Reasenberg-Jones model combines the Omori-Utsu decay with the Gutenberg-Richter law to give how many aftershocks of each size to expect.`,
  simple: [
    `Big earthquakes have big aftershocks, but usually clearly smaller ones. Markus Båth noticed that the gap is surprisingly stable, about 1.2 on average, with a wide spread from one sequence to the next.`,
    `How many aftershocks a sequence produces is its <strong>productivity</strong>. Put together how fast aftershocks die out (Omori-Utsu) and how their sizes are spread (Gutenberg-Richter) and you can say, for a sequence that has been fitted, how many events above a given size the model implies in a time window. This is the Reasenberg-Jones model that agencies use for aftershock advice.`,
    `In this atlas these numbers describe past sequences only. They are not a forecast.`,
  ],
  analogy: `A big firework has a crackling tail: many small sparks, a few larger ones, and the largest spark is usually clearly smaller than the main burst.`,
  example: {
    title: `Largest aftershocks of the atlas sequences`,
    body: [
      `For {nWith} of the {nSeq} sequences the M ≥ 6 event layer holds a later event inside the sequence window. The median gap between mainshock and largest such aftershock is {med}.`,
      `The {place} (M {mag}): largest later event in the window M {aMag}, a gap of {dM}. Its fit gives K = {K} per day, p = {p}, sequence b-positive {bSeq} above Mcat {mcat}.`,
    ],
  },
  diagram: {
    title: `The mainshock-to-largest-aftershock gap`,
    caption: `Real data: each dot is one sequence (mainshock from sequences.json, largest later event from the M ≥ 6 event layer within the same radius and one year; magnitude types as served). The dashed line is Båth's 1.2. The readout below applies the Reasenberg-Jones form to the fitted sequence: a description of a past sequence, not a forecast.`,
    alt: `Scatter of the magnitude gap against mainshock magnitude for the atlas sequences, around a dashed line at 1.2.`,
    xLabel: `Mainshock magnitude`, yLabel: `Mainshock minus largest aftershock`,
    bathLine: `Båth's law, 1.2`,
    seqSlider: `Sequence`, mSlider: `Magnitude for the count ({place})`, daysLabel: `Window`, days: `{d} days`,
    pick: `{place}: M {m}, largest aftershock M {a}, gap {d}.`,
    rj: `For the {place}, the fitted model implies about {n} events of M ≥ {m} from day 1 to day 1 + {days} (a chance of {prob} % of at least one, if the model held).`,
    colPlace: `Sequence`, colMain: `Mainshock`, colAfter: `Largest aftershock (M ≥ 6 layer)`, colGap: `Gap`,
  },
  tech: [
    `Båth's law: <code class="lr-formula">ΔM = Mmain − Mlargest aftershock ≈ 1.2</code>as an average with a spread of several tenths. The atlas gap uses magnitudes from the event layer (ISC-GEM Mw or ComCat as served, converted where needed), so it is only indicative.`,
    `Reasenberg-Jones rate of aftershocks with magnitude ≥ M at time t (days):<code class="lr-formula">λ(t, M) = K · 10^(−b (M − Mcat)) · (t + c)^−p</code>with K, c, p from the Omori-Utsu fit above Mcat and b the sequence's b-positive. The expected number in a window is the integral over t, and the chance of at least one event is 1 − e^(−N) for a Poisson process (Reasenberg & Jones 1989).`,
    `Productivity scales with mainshock size; Page et al. (2016) give global, region-dependent parameters for operational aftershock forecasts. The atlas's fits are retrospective and teleseismic (M ≥ 4.5 completeness), so they say nothing about small aftershocks or about ongoing sequences.`,
    `The upcoming Sequence Monitor reuses these quantities for recent sequences; the same caveat applies there.`,
  ],
};
