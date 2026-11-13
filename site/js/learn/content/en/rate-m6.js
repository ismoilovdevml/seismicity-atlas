export default {
  sentence: `The Mw ≥ 6 rate is the number of ISC-GEM earthquakes of moment magnitude 6 or more per year in a cell, divided by the cell's area and scaled to 100,000 km², so cells of different size can be compared.`,
  simple: [
    `How often big earthquakes happened in a place is the simplest seismicity number. To compare places fairly, it is expressed per year and per area.`,
    `Magnitude 6 is used because the ISC-GEM catalogue is complete at that size for the whole period counted, so the count is not limited by old networks.`,
    `It describes the past. A high rate says the place has been active; it does not say when the next large earthquake will happen.`,
  ],
  analogy: `Like the number of thunderstorms per year per 100 km² in a weather atlas: a fair way to say where storms are common, not a forecast for next Tuesday.`,
  example: {
    title: `The rate in a subduction cell near {loc}`,
    body: [
      `{rate} events of Mw ≥ 6 per year per 100,000 km². The cell covers {area} km², so that is about {perYear} such events per year in the cell.`,
      `{nPos} of the {nAll} cells had at least one Mw ≥ 6 event; their median rate is {med}. The highest rate, {topRate}, is in the cell near {topLoc}.`,
    ],
  },
  diagram: {
    title: `How the Mw ≥ 6 rate is spread over the cells`,
    caption: `Real data: one count per cell with at least one event (cells.geojson). The axis is logarithmic: each labelled step is ten times the previous. Move the slider to count the cells at or above a rate.`,
    alt: `Histogram of cell rates on a logarithmic axis, with the example cell marked by a dashed line.`,
    xLabel: `Mw ≥ 6 events per year per 100,000 km²`, yLabel: `Cells`,
    mine: `example cell`,
    slider: `Rate at least`,
    readout: `{n} of {all} cells have a rate of at least {r}.`,
  },
  tech: [
    `Definition (docs/method.md §8): <code class="lr-formula">rate_m6 = N(Mw ≥ 6.0, 1964–2021, all depths, epicentre in the cell) / 58 years / area_km2 × 100,000</code>Counted inside the hexagon itself, not the sampling circle, and with every ISC-GEM event (rates are not limited to the b sample).`,
    `Why 1964 and M 6.0: M 6.0 is at or above Michael's (2014) completeness for 1964–1975 and all later periods, so the counts are not limited by detection.`,
    `Caveats: aftershock sequences are included, so a single great sequence can dominate a cell's rate; 58 years is short compared with recurrence times of the largest earthquakes. Bird & Kagan (2004) model long-term rates by boundary class with corner magnitudes, which this simple count does not attempt.`,
    `On the site: the “M6+ rate” layer and the rate in the cell panel; the cell detail files add yearly counts.`,
  ],
};
