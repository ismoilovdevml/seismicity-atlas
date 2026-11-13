export default {
  sentence: `The map is drawn on H3 hexagons, but each cell's statistics use every earthquake within a fixed circle around the cell centre, so every place is measured over the same area.`,
  simple: [
    `H3 is a global grid of hexagons made by Uber and used widely for maps. Hexagons tile the sphere with nearly equal areas, and every cell has a stable id, which keeps links and data joins simple.`,
    `A hexagon of the global grid is small for statistics: it rarely holds enough large earthquakes. So the atlas takes a <strong>circle</strong> around each cell centre, bigger than the hexagon, and computes Mc and b from all events inside it.`,
    `Neighbouring circles overlap, so neighbouring cells share earthquakes. A smooth-looking pattern on the map is therefore partly the circles, not the Earth.`,
  ],
  analogy: `Think of measuring air quality at street corners on a city grid, but each sensor averages the air within a fixed walking distance. Nearby corners give similar readings partly because they breathe the same air.`,
  example: {
    title: `The cell near {loc}`,
    body: [
      `This hexagon covers {area} km² ({res}). The sampling circle of radius {radius} km covers {circle} km², about {ratio} times the hexagon. There are {nCells} hexagons with at least one event in the global layer.`,
      `Regional catalogues use finer grids with smaller circles, matched to their much smaller earthquakes: H3 resolution and radius {regList}.`,
    ],
  },
  diagram: {
    title: `A cell and its sampling circle, to scale`,
    caption: `Hexagon area from the data (the example cell, or the median cell of a regional catalogue), drawn as a regular hexagon of the same area. Dashed circles belong to two neighbours and show the overlap.`,
    alt: `A hexagon surrounded by six neighbours, with a large circle around the central hexagon and two dashed neighbour circles overlapping it.`,
    resLabel: `Grid`, globalOpt: `Global, {r}`, regionalOpt: `Regional res {res}, {r}`,
    slider: `Circle radius`,
    overlapYes: `Neighbouring circles overlap, so neighbours share events.`,
    overlapNo: `Neighbouring circles do not overlap.`,
    readout: `Resolution {res}: hexagon {area} km², circle radius {r} = {circle} km², {ratio} times the hexagon. {overlap}`,
  },
  tech: [
    `Grid: H3 resolution {globalRes} for the global layer. Statistics per cell: all events with an epicentre within {radius} km (great-circle distance) of the cell centre, as in the ZMAP constant-radius approach (Wiemer & Wyss 2002). Rates use the cell's own area, not the circle.`,
    `Why a fixed radius rather than the nearest N events: the spatial support is the same everywhere, so two places are compared over the same footprint, and sparse places are honestly empty (b withheld) instead of borrowing events from far away. The cost is that the sample size, and so the uncertainty, varies; it is reported.`,
    `H3 cells are not exactly equal-area (about a factor of two across one resolution), which is why rates divide by each cell's own <code>area_km2</code>.`,
    `Radius sensitivity (docs/method.md §1): with 200 or 400 km instead of 300 km, b changes by less than 0.04 (median) where it is shown; the radius mainly decides how many cells reach the sample size.`,
  ],
};
