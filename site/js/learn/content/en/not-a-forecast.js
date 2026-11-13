export default {
  sentence: `The atlas describes what earthquake catalogues recorded in the past; it does not predict when, where or how large the next earthquake will be, and it is not an official seismic hazard map.`,
  simple: [
    `A b-value, a completeness level or a rate summarises many past earthquakes. It is like a long-term average. Earthquakes do not keep to averages: they cluster in time, and long quiet periods are normal.`,
    `No method today can predict the time, place and size of a particular earthquake. Probabilistic forecasts and hazard maps exist, but they are built by official agencies from many more ingredients: fault models, ground-motion models, site effects, and careful testing.`,
    `For safety decisions, building codes or insurance, use your national seismological agency and the official hazard models, not this atlas.`,
  ],
  analogy: `A climate table tells you that July is usually dry; it cannot tell you whether it will rain next Tuesday. For that you need a forecast, made by the people whose job it is.`,
  example: {
    title: `Yearly counts of one active cell near {loc}`,
    body: [
      `ComCat recorded on average {mean} earthquakes of magnitude 4.5 or more per year in this cell's sampling circle over {y0}–{y1}, but the yearly count ranged from {min} ({yMin}) to {max} ({yMax}).`,
      `The long-term Mw ≥ 6 rate in the cell itself corresponds to about {perYear} such events per year. That average says nothing about which year will have one.`,
    ],
  },
  diagram: {
    title: `Real years vs random years with the same average`,
    caption: `Blue: real yearly counts (ComCat M ≥ 4.5 as served, the cell detail file; the current partial year is left out). Orange: a simulated history with the same average and purely random timing. Real counts are burstier because earthquakes cluster; neither row tells you next year's count.`,
    alt: `Paired bars per year: real counts vary strongly with occasional spikes; simulated random counts vary less around the dashed average line.`,
    lgReal: `Real yearly count`, lgSim: `Random, same average`,
    xLabel: `Year`, yLabel: `Events per year`,
    again: `Simulate another history`,
    readout: `Average {mean} per year. Real years ranged {rmin}–{rmax}; this simulated history ranges {smin}–{smax}.`,
  },
  tech: [
    `What the atlas is: descriptive catalogue statistics with uncertainty (Mc, b with intervals, rates, consistency, retrospective Omori fits). It is not a forecast model and has not been tested as one.`,
    `Why statistics are not prediction: a Poisson or clustered (ETAS-type) process with a known rate still leaves the timing of individual events random. Spatial b-value contrasts from small samples can be artefacts (Marzocchi et al. 2020), and the largest events can surprise even long catalogues (Kagan & Jackson 2013, on Tohoku).`,
    `Where to find official information: your national seismological or geological survey; for a global reference, the GEM Global Seismic Hazard Map (linked below; CC BY-NC-SA, we only link to it); the USGS publishes aftershock forecasts for significant US and some global events on its event pages.`,
    `The disclaimer on every page and in the data files says the same: catalogue statistics for research and education; not an earthquake forecast and not an official seismic hazard map.`,
  ],
};
