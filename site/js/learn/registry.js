// The concept registry: stable ids (used in URLs and by infoButton), their group and order. The order here is the
// reading order of the index and of the previous/next links. Text lives in content/<lang>/<id>.js; the real-data
// example in examples.js; the interactive diagram in diagrams/<diagram>.js.

export const GROUPS = ['magnitudes', 'completeness', 'uncertainty', 'sequences', 'space', 'caveats', 'applied'];

export const CONCEPTS = [
  { id: 'magnitude-types', group: 'magnitudes', diagram: 'saturation' },
  { id: 'direct-vs-proxy-mw', group: 'magnitudes', diagram: 'proxy-b' },
  { id: 'magnitude-of-completeness', group: 'completeness', diagram: 'mc-slider' },
  { id: 'frequency-magnitude-distribution', group: 'completeness', diagram: 'fmd-views' },
  { id: 'gutenberg-richter-b-value', group: 'completeness', diagram: 'b-pivot' },
  { id: 'confidence-interval-bootstrap', group: 'uncertainty', diagram: 'bootstrap' },
  { id: 'quality-codes', group: 'uncertainty', diagram: 'quality-width' },
  { id: 'b-positive', group: 'uncertainty', diagram: 'b-positive' },
  { id: 'declustering', group: 'sequences', diagram: 'decluster' },
  { id: 'omori-utsu', group: 'sequences', diagram: 'omori' },
  { id: 'aftershock-productivity-bath', group: 'sequences', diagram: 'bath' },
  { id: 'h3-cells-and-sample-radius', group: 'space', diagram: 'h3-circle' },
  { id: 'plate-boundary-classes', group: 'space', diagram: 'plate-classes' },
  { id: 'depth-and-slabs', group: 'space', diagram: 'slab-section' },
  { id: 'rate-m6', group: 'space', diagram: 'rate' },
  { id: 'catalogue-consistency', group: 'caveats', diagram: 'consistency' },
  { id: 'regional-catalogues', group: 'caveats', diagram: 'regional-ladder' },
  { id: 'not-a-forecast', group: 'caveats', diagram: 'poisson' },
  { id: 'recording-rating', group: 'caveats', diagram: 'rating-ladder' },
  // v0.3.1: the concepts behind the Case studies view and the seismic-deficit layer
  { id: 'induced-seismicity', group: 'applied', diagram: 'induced-lag' },
  { id: 'seismic-moment-budget', group: 'applied', diagram: 'moment-budget' },
];

export const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
export const isConcept = (id) => byId.has(id);
