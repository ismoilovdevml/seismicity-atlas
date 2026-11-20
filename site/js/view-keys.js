// URL-hash keys of the views whose code loads on demand (Case studies, Depth 3D). They are declared at start-up, so a
// shared link keeps them before the view's module has loaded (hashx.js drops keys nobody declared).

import { defineKeys, intIn, oneOf } from './hashx.js';

export const CASES = ['groningen'];
// The Depth 3D regions (depth3d.js PRESETS, same order) and 'view', the current map view.
export const D3_PRESET_IDS = ['japan', 'chile', 'tonga', 'hindukush', 'italy', 'iceland', 'turkey', 'view'];

defineKeys([
  { key: 'cs', def: 'groningen', parse: oneOf(CASES) },
  { key: 'p3', def: 'japan', parse: oneOf(D3_PRESET_IDS) },
  { key: 'x3', def: 0, parse: intIn(0, 20) }, // depth exaggeration; 0 = automatic
  { key: 'e3', def: 6, parse: (s) => (s === '5' || s === '6' ? +s : undefined) },
  { key: 'm3', def: '3d', parse: oneOf(['3d', 'xs']) },
  { key: 's3', def: 1, parse: intIn(0, 1) },
]);
