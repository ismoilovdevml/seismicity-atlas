// Formatting rules, used everywhere so that rounding is consistent.
//   per-cell b and its interval: 2 decimals (intervals are 0.1-0.5 wide)
//   global/pooled b: 3 decimals (intervals are about 0.03 wide), as in the published tables
//   magnitudes and Mc: 1 decimal (data are binned to 0.1)
//   distances: whole km; counts: thousands separators; rates: 2 significant digits

const MINUS = '−';
const nf = new Intl.NumberFormat('en-US');

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const neg = (s) => s.replace(/^-/, MINUS);

export const b2 = (v) => (isNum(v) ? v.toFixed(2) : '–');
export const b3 = (v) => (isNum(v) ? v.toFixed(3) : '–');
export const mag = (v) => (isNum(v) ? neg(v.toFixed(1)) : '–');
export const int = (v) => (isNum(v) ? nf.format(Math.round(v)) : '–');
export const km = (v) => (isNum(v) ? nf.format(Math.round(v)) + ' km' : '–');
export const signed = (v, d = 2) => (isNum(v) ? (v > 0 ? '+' : v < 0 ? MINUS : '±') + Math.abs(v).toFixed(d) : '–');
export const fixed = (v, d) => (isNum(v) ? neg(v.toFixed(d)) : '–');

export function sig2(v) {
  if (!isNum(v)) return '–';
  if (v === 0) return '0';
  const d = Math.max(0, 1 - Math.floor(Math.log10(Math.abs(v))));
  return neg(v.toFixed(d));
}

/** "0.98 [0.85, 1.12]" */
export const interval = (v, lo, hi, f = b2) => `${f(v)} [${f(lo)}, ${f(hi)}]`;

export function latlon(lat, lon) {
  let L = ((((lon + 180) % 360) + 360) % 360) - 180;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = L >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}° ${ns}, ${Math.abs(L).toFixed(1)}° ${ew}`;
}

/** Decimal year (3 decimals, about 9 h) to a UTC date string. */
export function decYearDate(y) {
  const yr = Math.floor(y);
  const start = Date.UTC(yr, 0, 1);
  const len = Date.UTC(yr + 1, 0, 1) - start;
  return new Date(start + (y - yr) * len).toISOString().slice(0, 10);
}

export const isoDate = (s) => (s ? String(s).slice(0, 10) : '–');

export const PB_NAMES = {
  SUB: 'Subduction',
  CCB: 'Continental convergent boundary',
  OCB: 'Oceanic convergent boundary',
  CTF: 'Continental transform fault',
  OTF: 'Oceanic transform fault',
  CRB: 'Continental rift',
  OSR: 'Oceanic spreading ridge',
  none: 'More than 200 km from a plate boundary',
};

export const DEPTH_NAMES = { sh: 'Shallow, depth ≤ 70 km', dp: 'Deeper, depth > 70 km' };
export const DEPTH_SHORT = { sh: 'shallow', dp: 'deeper' };
