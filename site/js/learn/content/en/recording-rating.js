export default {
  sentence: `The Simple view rates how much data the global catalogue holds on large earthquakes near a place. The word (one of four) is read directly from the quality code, the completeness Mc and the catalogue check of the cell under the place. It does not rate the local seismic network.`,
  simple: [
    `Every place on the map lies in one statistics cell (a hexagon of about {area} km² in the Scientist view). For that cell the atlas already knows three things: its <strong>quality code</strong> (how precise its b-value is), its <strong>completeness Mc</strong> (the smallest magnitude the catalogue records without gaps) and whether the two global catalogues, ISC-GEM and USGS ComCat, <strong>agree</strong> on the events they share.`,
    `The rating turns these three into plain words: <strong>Very good</strong>, <strong>Good</strong>, <strong>Limited</strong> or <strong>Too little data</strong>. Nothing new is computed and nothing is hidden: the place card prints the three inputs under the word, and “Scientist view of this place” opens the full cell.`,
    `“Too little data” is the most common answer. It means that the global ISC-GEM catalogue holds fewer than {nMin} large earthquakes (about magnitude {gMc} or more; {fOld} or more before {yNew}) within {radius} km for 1976–2021, which is true for most of the Earth. It describes that catalogue, not the local network: quiet regions with dense national networks, such as Switzerland or Germany, are also rated “Too little data”. Where a regional layer from local networks covers the place, the card links to it (see Regional catalogues). Nor does the rating describe the danger: a quiet record is not proof that a strong earthquake cannot happen.`,
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
    `<table class="data"><thead><tr><th scope="col">Rating</th><th scope="col">Condition</th></tr></thead><tbody><tr><td>Too little data</td><td>quality code <code>insufficient</code> (fewer than {nMin} events above the threshold)</td></tr><tr><td>Limited</td><td>quality code <code>C</code>, or catalogue flag <code>check</code></td></tr><tr><td>Very good</td><td>quality code <code>A</code>, catalogue flag <code>ok</code> and Mc ≤ global shallow Mc + 0.2 (= {mcMax})</td></tr><tr><td>Good</td><td>every other <code>A</code> or <code>B</code> cell</td></tr></tbody></table>`,
    `The rules are checked in this order. The quality code comes from the width of the bootstrap 95 % interval of b; the catalogue flag from ISC-GEM and ComCat events matched within the cell (see Catalogue consistency); Mc from the per-cell completeness estimate. The cutoff-stability flag and the deeper statistics are not used: they are shown in the Scientist view.`,
    `What is counted, and the limitation: shallow (≤ 70 km) ISC-GEM events of 1976–2021 with a directly measured Mw (uncertainty ≤ 0.10), within {radius} km of the cell centre, each above the threshold max(cell Mc, global floor of its period); the floor is {fOld} before {yNew} and {fNew} from {yNew}. The rating therefore measures how many large earthquakes the global catalogue holds, at a resolution of hundreds of kilometres, not how well a place is monitored. It says nothing about local networks, which often record much smaller events, and it is not a hazard or risk estimate (Woessner & Wiemer 2005; Wiemer & Wyss 2002).`,
  ],
};
