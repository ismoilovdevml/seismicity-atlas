export default {
  sentence: `The frequency-magnitude distribution (FMD) counts how many earthquakes of each size a catalogue holds, and it is the chart from which both Mc and the b-value are read.`,
  simple: [
    `Sort the earthquakes of a place into size classes, 0.1 magnitude units wide, and count each class. That table is the FMD.`,
    `It can be drawn two ways. <strong>Non-cumulative</strong>: the count in each class. <strong>Cumulative</strong>: the count of events at least that big, N(≥ M). The cumulative curve is smoother, because every point includes all larger events.`,
    `On a normal count axis the curve drops off a cliff and the large events vanish into the baseline. On a logarithmic count axis, where each grid line is ten times the one below, the part above Mc becomes a straight line. That straight line is the Gutenberg-Richter law.`,
  ],
  analogy: `It is like the count of coins in a jar by value: lots of small coins, fewer large ones. Plot how many coins are worth “at least this much”, on a scale that multiplies by ten each step, and a regular pattern shows up as a straight line.`,
  example: {
    title: `The FMD of a subduction cell near {loc}`,
    body: [
      `This cell's sample has {total} shallow ISC-GEM Mw events. The smallest class, {mFirst}, has {nFirst} events and the largest event is in the {mMax} class.`,
      `At Mc = {mc} there are {nMc} events of that size or larger. One magnitude unit higher, at {m1}, only {nM1} remain: roughly ten times fewer, which is what a b-value near 1 means.`,
    ],
  },
  diagram: {
    title: `One FMD, four views`,
    caption: `Real data from the example cell. Switch between counts per bin and cumulative counts, and between a linear and a logarithmic count axis. The dashed line is the atlas Mc.`,
    alt: `Chart of the cell's frequency-magnitude distribution that can be switched between bars and cumulative dots, linear and logarithmic.`,
    yCum: `Events with magnitude ≥ M`, yNon: `Events per 0.1 bin`,
    kindLabel: `Counts`, non: `Per bin`, cum: `Cumulative`,
    scaleLabel: `Axis`, lin: `Linear`, log: `Log`,
    read_non_lin: `Counts per bin on a linear axis: the peak near Mc dominates and the largest events are invisible.`,
    read_non_log: `Counts per bin on a log axis: above Mc the bars fall along a straight line; below Mc they drop because events are missed.`,
    read_cum_lin: `Cumulative counts on a linear axis: a steep curve, hard to read for large magnitudes.`,
    read_cum_log: `Cumulative counts on a log axis: the classic Gutenberg-Richter plot. Above Mc the points lie close to a straight line whose slope is −b.`,
  },
  tech: [
    `With magnitudes binned to ΔM = 0.1, the non-cumulative FMD is n(Mᵢ), the count with M in [Mᵢ − ΔM/2, Mᵢ + ΔM/2), and the cumulative FMD is N(≥ Mᵢ) = Σ_{j ≥ i} n(Mⱼ). Above Mc, both follow<code class="lr-formula">log₁₀ N(≥ M) = a − b · M</code>and the non-cumulative counts have the same slope with a lower intercept.`,
    `Fitting: the atlas never fits b by least squares on the plotted points (the points are not independent and the large-magnitude counts are tiny); it uses the maximum-likelihood estimator (see “Gutenberg-Richter b-value”).`,
    `Data: the cell detail files carry the non-cumulative FMD per depth class for ISC-GEM (the b sample, direct Mw since v0.2) and for ComCat as served. The cell panel draws the cumulative FMD on a log axis with the Mc line, and the CSV download lists counts and cumulative counts per bin.`,
    `Caution: with a few hundred events the upper tail is noisy, and single large events sit on a long flat step. Marzocchi et al. (2020) show that b from small samples is biased and correlates with the largest magnitude in the sample.`,
  ],
};
