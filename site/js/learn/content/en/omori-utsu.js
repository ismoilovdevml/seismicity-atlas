export default {
  sentence: `The Omori-Utsu law describes how the rate of aftershocks falls with time after a mainshock, roughly as one over the elapsed time, with three numbers: K (productivity), c (an early delay) and p (how fast the decay is).`,
  simple: [
    `Right after a large earthquake, aftershocks come quickly; a day later, much less often; a month later, rarely. The rate falls fast at first and then slowly, for months or years.`,
    `Fusakichi Omori noticed in the 1890s that the rate falls roughly as 1/t. Tokuji Utsu added the exponent p: with p near 1, ten times later means about ten times fewer aftershocks per day.`,
    `<strong>K</strong> sets how many aftershocks there are overall, <strong>p</strong> how quickly they die out, and <strong>c</strong> a short time at the start where the rate is flatter. With a global catalogue, the first hours are often missing, so c may not be measurable.`,
  ],
  analogy: `It is like the ringing of a large bell: loud and busy at first, then fading, quickly at first and then more and more slowly, but never stopping all at once.`,
  example: {
    title: `The {year} {place}, M {mag}`,
    body: [
      `Aftershocks within {radius} for one year, complete above magnitude {mcat}: {nFit} events in the fit. Result: p = {p} (± {sp}), K = {K} per day; c = {c} day (resolved: {cRes}). Quality {q}.`,
      `Of the {nSeq} sequences on the Sequences page, {nA} have quality A and {nB} quality B. On synthetic sequences with true p = {pTrue}, the same fit recovers p = {pMean} on average, with a run-to-run spread of {pSd}.`,
    ],
  },
  diagram: {
    title: `Aftershock decay on log-log axes`,
    caption: `Dots: real aftershock rates of the sequence (events per day above Mcat). Line: K(t + c)^−p with the sliders' p and c and the fitted K. The first points fall below the line because small aftershocks are missed early on (the fit models this; the line does not). Below: one year on a linear time axis, with aftershocks drawn from the current model.`,
    alt: `Log-log chart of aftershock rate against days since the mainshock with a straight-ish decaying line; below, a strip of tick marks that are dense at the start and sparse later.`,
    lgData: `Observed rate (real)`, lgModel: `Omori-Utsu model`,
    xLabel: `Days since the mainshock`, yLabel: `Aftershocks per day`,
    stripStart: `day 0`, stripEnd: `day 365`, stripLabel: `Simulated aftershocks over one year`,
    pSlider: `p`, cSlider: `c (days)`, reset: `Fitted values`,
    binLabel: `Days`, countLabel: `Aftershocks`,
    readout: `p = {p}, c = {c} day, K = {K}: the rate on day 10 is about {ratio} times lower than on day 1.`,
  },
  tech: [
    `Omori-Utsu rate of events above the completeness magnitude:<code class="lr-formula">λ(t) = K / (t + c)^p</code>with t in days. The expected number in [t₁, t₂] is K ∫ (t + c)^−p dt.`,
    `Fit in this atlas (scripts/sequences.py): maximum likelihood on ComCat events within max(100 km, L) of the mainshock, L = 10^(−2.44 + 0.59 M) km (Wells & Coppersmith 1994), for 0–365 days. Mcat is MAXC + 0.2 of days 10–365, never below 4.5. The fit keeps the early sequence by modelling the time-dependent completeness <code>Mc(t) = max(Mcat, Mm − 4.5 − 0.75 log₁₀ t)</code> (Helmstetter et al. 2006; Page et al. 2016), with the sequence's b-positive in that model.`,
    `Quality: A needs n ≥ 100, σp ≤ 0.10, 0.5 ≤ p ≤ 2 and no second event within 0.5 units of the mainshock; B needs n ≥ 50 and σp ≤ 0.20. <code>c_resolved</code> is false when c is below 0.001 day or has no standard error: a teleseismic catalogue misses the first hours, so c is not constrained, while K and p remain usable.`,
    `On the site: the decay charts and quality badges on the Sequences page. The rate points use log-spaced bins of the counts above Mcat.`,
  ],
};
