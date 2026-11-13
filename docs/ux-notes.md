# UX notes for the website

Reference products looked at on 2026-11-13 (USGS Latest Earthquakes, IRIS/EarthScope Interactive Earthquake
Browser, GEM OpenQuake map viewer; EMSC from earlier use). What we take, and what we avoid:

- **Map first, controls beside it (USGS, IEB).** The map is the page. Controls sit in one panel at the side, not
  scattered over the map. We keep one left panel that holds layer choice, depth, overlays and the legend.
- **The legend belongs to the layer (GEM).** GEM's legend names the quantity and its unit ("PGA (g)") with
  explicit class ranges. Ours does the same for every layer, and changes with it, including the meaning of grey
  and hatched cells.
- **Stepped classes, not a smooth rainbow (GEM, IEB).** Readers can match a colour to a range. We use 5–6
  stepped classes, one hue for magnitudes and two hues around b = 1 for the b-value, never a rainbow (IEB's
  depth rainbow is hard to read for colour-blind users).
- **List and map tell the same story (USGS).** The USGS list links to event pages by id. Our events link to the
  USGS event page by ComCat id, and the sequence list has a "Show on map" action.
- **Say what is missing (IEB "1000 of 4,275,908 visible").** We always show how many events are visible and why
  a cell has no b-value (quality C or too few events), instead of leaving it blank.
- **Avoid clutter.** No third-party basemap with place names, no ads, no social widgets, no watermark
  (GEM), no stacked accordions of boilerplate. Place names are not needed for catalogue statistics.
- **Disclaimer visible but quiet (GEM).** GEM hides its disclaimer in an accordion. Ours is a one-line strip on
  the map that is always visible, with the full text on the About page.
- **Details on demand.** Hover gives a short summary; a click opens a panel (a bottom sheet on phones) that
  loads the per-cell charts only then.
- **Shareable state.** IEB keeps its state in the URL. We keep layer, depth, overlays, selected cell, page and
  map position in the URL hash.

## Design decisions

- **Design reference.** The look and structure follow the design mock-ups made for this project (desktop map with a
  selected cell, 390 × 844 bottom sheet, validation page): header with a version and cut-off label, a persistent
  disclaimer strip, a left control rail, a legend card on the map, and a right cell panel with b in large mono
  type, an interval-on-scale bar, a 2 × 2 tile grid, a cumulative FMD with a dashed Mc line and a catalogue
  agreement list. On phones: a chip row for layers and a bottom sheet with a "Full details and charts" button.
- **Tokens.** Inter for the interface and IBM Plex Mono for every number (both vendored, SIL OFL). Warm neutral
  base (page `#F7F6F2`, ocean `#F4F3EF`, land `#E4E1D9`), one UI accent (`#0E6B73`) that never encodes data, and a
  dark theme derived from the same roles. b classes use the six-step blue to orange-brown palette centred on
  b = 1; quality B is the same colour at about 55 % opacity, C is hatched, insufficient is a light grey wash.
- **Charts** follow the `dataviz` method: 2 px lines, markers with a surface ring, hairline grid, a legend for two
  or more series, a crosshair or per-mark tooltip that also works with the arrow keys, and a data table under every
  chart. The categorical chart colours were run through the dataviz validator (all-pairs, both modes): pass; the
  aqua slot is below 3:1 on white, so the data tables are the required relief.

## ui-ux-pro-max

- `--design-system` for "scientific data atlas map research" returned **Minimalism & Swiss Style** (kept: clean,
  grid-based, functional). Its palette (red primary `#FF4D4D`) and fonts (Exo + Roboto Mono) were **not used**: a
  red primary reads as alarm on a map that must not look like a hazard map, and the project's design reference
  sets Inter + IBM Plex Mono.
- Chart guidance for geographic data: "pair fills with boundaries or patterns; location meaning cannot depend on
  colour alone; a11y fallback: a region table". Applied: hatch for C cells, values in the tooltip, and a
  **sortable table of every cell with a b-value** (link under the layer list) that opens each cell.
- Pre-delivery checklist outcome:
  - No emoji icons; all icons are inline SVG with one stroke weight. Pass.
  - Touch targets ≥ 44 px on phones (layer chips, map buttons, close and menu buttons, list rows). Pass.
  - Contrast (computed, WCAG 2): body and muted text ≥ 5.6:1, accent on white 6.2:1, disclaimer 8.8:1, verdict
    pills ≥ 7.1:1 in light and ≥ 8.0:1 in dark. Pass.
  - Visible focus ring on every control; keyboard reaches depth, layers, overlays and theme (tested). Pass.
  - `prefers-reduced-motion` disables animations. Not tested in a browser.
  - Responsive: tested at 1440 × 900 and 390 × 844, no horizontal scroll on any page (tested). Landscape and
    Dynamic Type were not tested.
