export default {
  sentence: `Catalogue consistency compares, cell by cell, the same earthquakes in the two global catalogues the atlas uses, USGS ComCat and ISC-GEM: how much their magnitudes and locations differ, and which events appear in only one of them.`,
  simple: [
    `Two agencies can describe the same earthquake differently. ComCat (USGS) often reports body-wave mb for moderate events; ISC-GEM re-computed everything as moment magnitude. Locations differ too, by a few to tens of kilometres, and depths more.`,
    `The atlas matches events between the two catalogues (close in time and space) and summarises, per cell, the median magnitude and location differences and the events found in only one catalogue.`,
    `Where they agree, you can trust that catalogue numbers mean what they say. Where they disagree, be careful with any statistic from either.`,
  ],
  analogy: `Like two maps of the same town made by different surveyors: most streets line up, some are shifted a little, and a few appear on only one map. The comparison tells you where to double-check.`,
  example: {
    title: `A cell with many matched events near {loc}`,
    body: [
      `{cn} events matched. Median ComCat Mw-type minus ISC-GEM Mw: {dmw}. Median ComCat mb minus ISC-GEM Mw: {dmb}. Median epicentre difference {dloc}, median depth difference {ddep} km. ISC-GEM-only events: {gonly}; ComCat-only Mw ≥ 6 events: {conly}.`,
      `Over all cells: {ok} are flagged “ok”, {check} “check” and {few} have too few matches to say. Over the {nValid} cells with at least 10 matches, the median of ComCat mb minus ISC-GEM Mw is {medDmb}, and of ComCat Mw-type minus ISC-GEM Mw {medDmw}.`,
    ],
  },
  diagram: {
    title: `Magnitude differences between the catalogues, per cell`,
    caption: `Real data: one value per cell with at least 10 matched events. mb sits systematically below Mw for these sizes, partly because of saturation; moment-type magnitudes agree closely (shaded: within ±0.10).`,
    alt: `Histogram of per-cell median magnitude differences; the mb difference is centred well below zero, the Mw-type difference near zero.`,
    which: `Compare`, dmb: `ComCat mb − ISC-GEM Mw`, dmw: `ComCat Mw-type − ISC-GEM Mw`,
    xLabel: `Median magnitude difference in the cell`, yLabel: `Cells`, mine: `example cell`,
    read_dmb: `ComCat mb minus ISC-GEM Mw: median {med} over {n} cells; {out} cells differ by more than 0.10.`,
    read_dmw: `ComCat Mw-type minus ISC-GEM Mw: median {med} over {n} cells; {out} cells differ by more than 0.10.`,
  },
  tech: [
    `Matching: an ISC-GEM and a ComCat event form a pair when they are within 30 s and 100 km; pairs are assigned to the cell of the ISC-GEM epicentre (docs/method.md §7).`,
    `<ul><li><code>c_dmw</code>: median ComCat Mw-type minus ISC-GEM Mw.</li><li><code>c_dmb</code>: median ComCat mb minus ISC-GEM Mw.</li><li><code>c_dloc</code>, <code>c_ddep</code>: median epicentre (km) and depth differences.</li><li><code>c_gonly</code>: ISC-GEM events without a ComCat match; <code>c_conly</code>: ComCat Mw-proxy ≥ 6.0 events without an ISC-GEM match.</li></ul>`,
    `Flag: <code>few</code> if fewer than 10 pairs; <code>check</code> if |c_dmw| > 0.10, c_dloc > 30 km, or (c_gonly + c_conly) / c_n > 0.10; otherwise <code>ok</code> (docs/data-schema.md).`,
    `On the site: the “Agreement” layer with its three variants (flag, ΔMw, epicentre distance) and the catalogue-agreement list in the cell panel.`,
  ],
};
