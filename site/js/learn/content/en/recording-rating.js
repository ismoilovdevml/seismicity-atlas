export default {
  sentence: `The Simple view answers “how well are earthquakes recorded here?” with one of four words, read directly from the quality code, the completeness Mc and the catalogue check of the cell under the place.`,
  simple: [
    `Every place on the map lies in one statistics cell (a hexagon of about {area} km² in the Scientist view). For that cell the atlas already knows three things: its <strong>quality code</strong> (how precise its b-value is), its <strong>completeness Mc</strong> (the smallest magnitude the catalogue records without gaps) and whether the two global catalogues, ISC-GEM and USGS ComCat, <strong>agree</strong> on the events they share.`,
    `The rating turns these three into plain words: <strong>Very good</strong>, <strong>Good</strong>, <strong>Limited</strong> or <strong>Too little data</strong>. Nothing new is computed and nothing is hidden: the place card prints the three inputs under the word, and “Scientist view of this place” opens the full cell.`,
    `“Too little data” is the most common answer, because most of the Earth has few strong earthquakes. It describes the record, not the danger: a quiet record is not proof that a strong earthquake cannot happen.`,
  ],
  analogy: `A school report that says “good” is only useful if you can see the marks behind it. The rating is the word; the quality code, Mc and catalogue check printed under it are the marks.`,
  example: {
    title: `How the {nAll} cells are rated`,
    body: [
      `From the shallow statistics (0–70 km) of every cell: {nV} are Very good, {nG} Good, {nL} Limited and {nF} have too little data.`,
      `A Very good example: the cell near {vLoc} has quality {vQ}, Mc {vMc} and the catalogues agree. A Limited example: the cell near {lLoc} has quality {lQ}, so its b-value is withheld.`,
      `“Very good” needs Mc no higher than {mcMax}, which is the global shallow Mc of this release ({gMc}) plus 0.2.`,
    ],
  },
  diagram: {
    title: `From the three inputs to the word`,
    caption: `Choose a quality code, a catalogue check and an Mc to see the rating. The bars count the real cells with each rating in this release.`,
    alt: `A horizontal bar chart of the number of cells rated Very good, Good, Limited and Too little data, with the rating chosen by the controls highlighted.`,
    q: `Quality code`, flag: `Catalogue check`, mc: `Mc`,
    flagOk: `agree`, flagCheck: `disagree`, flagFew: `too few shared`, insufficient: `insufficient`,
    xLabel: `Number of cells`,
    readout: `Quality {q}, catalogues {flag}, Mc {mc}: {rating}.`,
    colRating: `Rating`, colCells: `Cells`,
  },
  tech: [
    `The rule, applied to the shallow (≤ 70 km) statistics of the cell that contains the place (point in hexagon; the nearest cell centre if none):`,
    `<table class="data"><thead><tr><th scope="col">Rating</th><th scope="col">Condition</th></tr></thead><tbody><tr><td>Too little data</td><td>quality code <code>insufficient</code> (fewer than {nMin} events above Mc)</td></tr><tr><td>Limited</td><td>quality code <code>C</code>, or catalogue flag <code>check</code></td></tr><tr><td>Very good</td><td>quality code <code>A</code>, catalogue flag <code>ok</code> and Mc ≤ global shallow Mc + 0.2 (= {mcMax})</td></tr><tr><td>Good</td><td>every other <code>A</code> or <code>B</code> cell</td></tr></tbody></table>`,
    `The rules are checked in this order. The quality code comes from the width of the bootstrap 95 % interval of b; the catalogue flag from ISC-GEM and ComCat events matched within the cell (see Catalogue consistency); Mc from the per-cell completeness estimate. The cutoff-stability flag and the deeper statistics are not used: they are shown in the Scientist view.`,
    `Limitation: the rating describes a catalogue of moderate and large earthquakes (M ≥ 4.5 to 6) at a resolution of hundreds of kilometres. It says nothing about local networks, which often record much smaller events, and it is not a hazard or risk estimate (Woessner & Wiemer 2005; Wiemer & Wyss 2002).`,
  ],
};
