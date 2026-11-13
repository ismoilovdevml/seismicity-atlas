export default {
  sentence: `Most earthquakes happen in the upper few tens of kilometres, but in subduction zones they also occur inside the sinking plate (the slab) down to about 700 km, and the atlas maps shallow (≤ 70 km) and deeper (> 70 km) events separately because the two populations behave differently.`,
  simple: [
    `An earthquake starts at a point inside the Earth, the <strong>hypocentre</strong>; the point on the surface above it is the epicentre. Depth matters: the same magnitude shakes the surface much less when it is 400 km down.`,
    `Where one plate dives under another, it keeps breaking as it sinks. Plotting earthquakes by depth along a line across such a zone shows a tilted band, the Wadati-Benioff zone, that traces the slab into the mantle.`,
    `Deep and shallow earthquakes have different b-values, so mixing them would blur both. The depth switch on the map chooses which population the b, Mc and quality layers show.`,
  ],
  analogy: `Like a sheet of paper pushed under a book at an angle: the creases follow the sheet down. Earthquakes are the creases, and their depths draw the sheet.`,
  example: {
    title: `A cross-section through the Tonga slab`,
    body: [
      `The M ≥ 6 event layer has {n} events between 16° and 24° S near the Tonga trench, {y0}–{y1}. {nDeep} of them are deeper than 70 km; the deepest is at {deepest} (M {deepestM}).`,
      `Worldwide (1976–2021, direct Mw), shallow events give b = {gB} and deeper events b = {dB} [{dLo}, {dHi}]: the deeper population has relatively more large events.`,
    ],
  },
  diagram: {
    title: `Hypocentres under Tonga, west to east`,
    caption: `Real data: M ≥ 6 events from the event layer, 16–24° S, projected onto a west-east line (distance from 174° W). Event depths in global catalogues are less precise than epicentres, and many shallow events sit at fixed default depths. Press Play to add the years in order.`,
    alt: `Cross-section with depth increasing downward: shallow events cluster near the trench and a band of deeper events dips westward to about 700 km.`,
    lgShallow: `Depth ≤ 70 km`, lgDeep: `Depth > 70 km`,
    xLabel: `Distance east of 174° W (km)`, yLabel: `Depth (km)`,
    split: `70 km: the atlas depth split`, east: `east (trench side)`, west: `west`,
    slider: `Events up to year`,
    readout: `Up to {y}: {n} events, {deep} of them deeper than 70 km.`,
  },
  tech: [
    `Depth classes: ≤ 70 km (<code>sh_*</code> fields) and > 70 km (<code>dp_*</code>), each with its own Mc, b, interval and quality. For the comparison with Michael (2014) the validation uses his 60 km split. Michael found b ≈ 0.99 for deep events and 1.05 for shallow ones over 1964–2009 / 1918–2009.`,
    `Slab age and b: Nishikawa & Ide (2014) found that b in subduction zones increases with the age of the subducting plate; the atlas reproduces the sign of that difference (Validation page, slab-age groups).`,
    `Slab geometry: Slab2 (Hayes et al. 2018) models the 3D surface of every major slab. The atlas does not use Slab2 yet; an upcoming 3D depth view will show hypocentres in three dimensions.`,
    `Caution: teleseismic depths can be off by tens of kilometres, and many shallow events are fixed at standard depths (for example 10, 15 or 33 km). The 70 km split is coarse on purpose.`,
  ],
};
