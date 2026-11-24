// Mc and b-value of a user's catalogue, in the browser. A port of src/seisatlas (analysis.py, atlaslib.cell_b,
// seislib.b_varmc / b_positive / mc_maxc_fast) so that a file never leaves the visitor's computer.
// Deterministic parts (Mc, b, b-positive, FMD) equal the Python package; the bootstrap uses a different random
// generator, so interval ends differ from Python by Monte-Carlo noise only (tests/test_analyze_js.py).

export const NMIN_B = 50;
export const NBOOT = 1000;
export const Q_A = 0.30;
export const Q_B = 0.50;
const LOG10E = Math.LOG10E;

/** An input problem the page can explain: `code` names an `an.err.<code>` message, `params` fill it in. The English
 * `message` is what the Python package says in the same case. Codes and params survive postMessage via errorInfo. */
export class CatalogError extends Error {
  constructor(code, message, params = {}) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
    this.params = params;
  }
}

/** Plain object for an error (postMessage drops the own fields of an Error). */
export const errorInfo = (err) => ({ code: (err && err.code) || null, params: (err && err.params) || {},
  message: String((err && err.message) || err) });

/** Smallest and largest value without spreading into Math.min (which overflows the call stack for ~10^5 values). */
export function minMax(arr) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/** numpy.rint: round half to even. */
export function rint(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
const r6 = (x) => rint(x * 1e6) / 1e6;
/** seislib.bin_mag: np.round(np.floor(m / dm + 0.5 + 1e-6) * dm, 6), ties up (since 0.6.0). */
export const binMag = (x, dm = 0.1) => r6(Math.floor(x / dm + 0.5 + 1e-6) * dm);
/** seislib.b_from_excess: binned maximum-likelihood b from the mean excess over the lowest bin (Tinti & Mulargia 1987). */
export function bFromExcess(mean, dm = 0.1) {
  const beta = dm > 0 ? Math.log1p(dm / mean) / dm : 1 / mean;
  return mean > 0 && Number.isFinite(beta) ? beta * LOG10E : NaN;
}

/** Seeded generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** numpy.percentile, linear interpolation, on a sorted copy. */
export function percentile(arr, q) {
  const a = Float64Array.from(arr).sort();
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q / 100;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, a.length - 1);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

/** seislib.mc_maxc_fast on binned magnitudes: first bin with the highest count, + correction, rounded to 1e-6. */
export function maxc(mb, dm = 0.1, corr = 0.2) {
  let k0 = Infinity;
  let k1 = -Infinity;
  const k = new Int32Array(mb.length);
  for (let i = 0; i < mb.length; i++) { k[i] = rint(mb[i] / dm); if (k[i] < k0) k0 = k[i]; if (k[i] > k1) k1 = k[i]; }
  const cnt = new Int32Array(k1 - k0 + 1);
  for (let i = 0; i < k.length; i++) cnt[k[i] - k0]++;
  let best = 0;
  for (let j = 1; j < cnt.length; j++) if (cnt[j] > cnt[best]) best = j;
  return r6((best + k0) * dm + corr);
}

/** seislib.b_varmc: Aki-Utsu ML b with a per-event threshold. Returns [b, sigma, n]. */
export function bVarMc(mb, thr, dm = 0.1) {
  const x = [];
  for (let i = 0; i < mb.length; i++) {
    const t = binMag(thr[i], dm);
    if (mb[i] >= t - 1e-9) x.push(mb[i] - t);
  }
  const n = x.length;
  if (n < 2) return [NaN, NaN, n];
  let s = 0;
  for (const v of x) s += v;
  const mean = s / n;
  let ss = 0;
  for (const v of x) ss += (v - mean) ** 2;
  const b = bFromExcess(mean, dm);
  return [b, 2.3 * b * b * Math.sqrt(ss / (n * (n - 1))), n];
}

export function relWidth(b, lo, hi) {
  return Number.isFinite(b) && b > 0 && Number.isFinite(lo) && Number.isFinite(hi) ? (hi - lo) / b : NaN;
}

/** atlaslib.quality. */
export function quality(n, lo, hi, b) {
  if (n < NMIN_B || !Number.isFinite(lo) || !Number.isFinite(hi)) return 'insufficient';
  const w = relWidth(b, lo, hi);
  if (!Number.isFinite(w)) return 'insufficient';
  return w <= Q_A ? 'A' : w <= Q_B ? 'B' : 'C';
}

/** atlaslib.cell_b: b with threshold max(MAXC + 0.2, floor_i) and a bootstrap that re-estimates Mc. */
export function cellB(m, floor, { nboot = NBOOT, seed = 20261116, dm = 0.1, nminMc = 30, onProgress = null } = {}) {
  const N = m.length;
  const mb = Float64Array.from(m, (v) => binMag(v, dm));
  const fl = Float64Array.from(floor, (v) => binMag(v, dm));
  const out = { n_sample: N };
  if (N < nminMc) return { ...out, quality: 'insufficient', n_b: 0 };
  const mc = maxc(mb, dm);
  const thr = Float64Array.from(fl, (v) => Math.max(mc, v));
  const [b, sig, n] = bVarMc(mb, thr, dm);
  const R = rng(seed);
  const bb = [];
  const mcb = new Float64Array(nboot);
  const mm = new Float64Array(N);
  const ff = new Float64Array(N);
  const th = new Float64Array(N);
  const step = Math.max(1, Math.floor(nboot / 20));
  for (let r = 0; r < nboot; r++) {
    if (onProgress && r % step === 0) onProgress(r / nboot);
    for (let i = 0; i < N; i++) { const j = Math.floor(R() * N); mm[i] = mb[j]; ff[i] = fl[j]; }
    const mcr = maxc(mm, dm);
    mcb[r] = mcr;
    let s = 0;
    let c = 0;
    for (let i = 0; i < N; i++) {
      th[i] = Math.max(mcr, ff[i]);
      if (mm[i] >= th[i] - 1e-9) { s += mm[i] - th[i]; c++; }
    }
    // a replicate with every event in its lowest bin has no b (NaN): dropped, as atlaslib.cell_b does with isfinite
    const br = c >= 2 ? bFromExcess(s / c, dm) : NaN;
    if (Number.isFinite(br)) bb.push(br);
  }
  const [lo, hi] = bb.length > 0.8 * nboot ? [percentile(bb, 2.5), percentile(bb, 97.5)] : [NaN, NaN];
  const q = quality(n, lo, hi, b);
  const b2 = bVarMc(mb, Float64Array.from(thr, (v) => v + 0.2), dm)[0];
  const b4 = bVarMc(mb, Float64Array.from(thr, (v) => v + 0.4), dm)[0];
  const unstable = [b2, b4, lo].every(Number.isFinite) && ((b2 > hi && b4 > hi) || (b2 < lo && b4 < lo));
  return { ...out, mc, mc_lo: percentile(mcb, 2.5), mc_hi: percentile(mcb, 97.5), n_b: n, b, sigma: sig, lo, hi,
    relw: relWidth(b, lo, hi), b_plus02: b2, b_plus04: b4, unstable, quality: q, thr };
}

/** seislib.b_positive on time-ordered events at or above their thresholds. Returns [b, sigma, n]. */
export function bPositive(mOrdered, thr, dm = 0.1, dmc = 0.2) {
  const m = [];
  for (let i = 0; i < mOrdered.length; i++) {
    const v = binMag(mOrdered[i], dm);
    if (v >= binMag(thr[i], dm) - 1e-9) m.push(v);
  }
  const d = [];
  for (let i = 1; i < m.length; i++) {
    const x = binMag(m[i] - m[i - 1], dm);
    if (x >= dmc - dm / 2 + 1e-9) d.push(x);
  }
  const n = d.length;
  if (n < 2) return [NaN, NaN, n];
  const mean = d.reduce((a, v) => a + v, 0) / n;
  const ss = d.reduce((a, v) => a + (v - mean) ** 2, 0);
  const b = bFromExcess(mean - binMag(dmc, dm), dm);
  return [b, 2.3 * b * b * Math.sqrt(ss / (n * (n - 1))), n];
}

/** report.fit_segment: [m1, n1, m2, n2] of the Gutenberg-Richter line on the FMD plot, or null. It starts at the
 * threshold used for b (the highest per-event max(Mc, floor_i)) with the cumulative count there and ends at the largest
 * magnitude or where it reaches N = 1, whichever comes first (a log axis cannot show N < 1). */
export function fitSegment(res) {
  const f = res.fmd;
  const b = res.b || {};
  const bb = b.b;
  if (!f || !f.mag.length || bb == null || !(bb > 0)) return null;
  let t = b.threshold;
  if (t == null) t = res.mc ? res.mc.maxc02 : null;
  if (t == null) return null;
  let n0 = 0;
  for (let i = 0; i < f.mag.length; i++) if (f.mag[i] >= t - 1e-9) n0 += f.count[i];
  if (n0 < 1) return null;
  const m2 = Math.min(minMax(f.mag)[1], t + Math.log10(n0) / bb);
  return [t, n0, m2, n0 * 10 ** (-bb * (m2 - t))];
}

/** seislib.fmd: bins from min to max, counts and cumulative counts. */
export function fmd(m, dm = 0.1) {
  const mb = Array.from(m, (v) => binMag(v, dm));
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of mb) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const nb = rint((hi - lo) / dm) + 1;
  const count = new Array(nb).fill(0);
  for (const v of mb) count[rint((v - lo) / dm)]++;
  const mag = count.map((_, i) => binMag(lo + i * dm, dm));
  const cumulative = count.slice();
  for (let i = nb - 2; i >= 0; i--) cumulative[i] += cumulative[i + 1];
  return { mag, count, cumulative };
}

// ---------------------------------------------------------------- reading a CSV

const ALIASES = {
  mag: ['mag', 'magnitude', 'mw', 'ml', 'm'],
  time: ['time', 'datetime', 'origin_time', 'origintime', 'date_time'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lon', 'long', 'lng'],
  depth: ['depth', 'depth_km', 'dep'],
  magtype: ['magtype', 'mag_type', 'magnitude_type', 'type'],
};
const DATE_ALIASES = ['date', 'origin_date', 'event_date'];
// catalog.TIME_OF_DAY: a time of day without a date; it is joined with a date column, or not used as time
const TIME_OF_DAY = /^\d{1,2}:\d{2}(?::\d{2}(?:\.\d*)?)?\s*(?:[zZ]|[+-]\d{2}:?\d{2})?$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Strict number as pandas.to_numeric(errors="coerce"): "5.2abc", "3,1" and "" are NaN (parseFloat would read 5.2, 3). */
export function toNumber(v) {
  const s = String(v == null ? '' : v).trim();
  return NUMBER.test(s) ? Number(s) : NaN;
}

/** Date-time text -> ms since 1970 (UTC unless a zone is given), NaN if unparsed. */
function parseTime(raw) {
  const s = String(raw).trim();
  if (!s) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/\d[ T]\d/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
}

/** Split CSV text into rows of fields (quotes, doubled quotes, CRLF); delimiter , ; or tab, guessed from the header. */
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, '');
  const head = lines.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) || '';
  const delim = [',', ';', '\t'].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let f = '';
  let q = false;
  let lineStart = true;
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i];
    if (lineStart && !q && c === '#') { while (i < lines.length && lines[i] !== '\n') i++; continue; }
    lineStart = false;
    if (q) {
      if (c === '"') { if (lines[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && lines[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = []; lineStart = true;
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  return rows;
}

/** Rows -> events sorted by time: {mag, time (ms or NaN), latitude, longitude, depth, magtype}. */
export function readCatalog(text, { magType = null } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new CatalogError('noRows', 'the file has no data rows');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [std, names] of Object.entries(ALIASES)) {
    const j = names.map((n) => header.indexOf(n)).find((x) => x >= 0);
    if (j !== undefined) col[std] = j;
  }
  if (col.mag === undefined) {
    throw new CatalogError('noMag', `no magnitude column found; expected one of ${ALIASES.mag.join(', ')}`,
      { cols: ALIASES.mag.join(', ') });
  }
  if (magType && col.magtype === undefined) {
    throw new CatalogError('noTypeCol', 'mag_type given but the catalogue has no magnitude-type column');
  }
  const names = Object.fromEntries(Object.entries(col).map(([k, j]) => [k, rows[0][j]]));
  // a time-of-day column (12:00:00) is joined with a date column; without one it is not a time (as catalog.py)
  let dateJ = -1;
  if (col.time !== undefined) {
    const vals = rows.slice(1).map((r) => String(r[col.time] ?? '').trim()).filter((v) => v !== '');
    if (vals.length && vals.every((v) => TIME_OF_DAY.test(v))) {
      dateJ = DATE_ALIASES.map((n) => header.indexOf(n)).find((x) => x >= 0) ?? -1;
      if (dateJ < 0) { delete col.time; delete names.time; } else names.time = `${rows[0][dateJ]} + ${rows[0][col.time]}`;
    }
  }
  const dropped = { bad_magnitude: 0, other_magnitude_types: 0 };
  const ev = [];
  const num = (r, k) => (col[k] === undefined ? NaN : toNumber(r[col[k]]));
  const want = magType ? magType.trim().toLowerCase() : null;
  for (const r of rows.slice(1)) {
    const mag = toNumber(r[col.mag]);
    if (!Number.isFinite(mag) || mag < -3 || mag > 10) { dropped.bad_magnitude++; continue; }
    const mt = col.magtype === undefined ? null : String(r[col.magtype] ?? '').trim().toLowerCase() || null;
    if (want && mt !== want) { dropped.other_magnitude_types++; continue; }
    let ts = NaN;
    if (col.time !== undefined && dateJ >= 0) {
      const d = String(r[dateJ] ?? '').trim();
      const tm = String(r[col.time] ?? '').trim().replace(/^(\d):/, '0$1:');
      if (d && tm) ts = parseTime(`${d} ${tm}`);
    } else if (col.time !== undefined) ts = parseTime(r[col.time] ?? '');
    ev.push({ mag, time: ts, latitude: num(r, 'latitude'), longitude: num(r, 'longitude'), depth: num(r, 'depth'), magtype: mt });
  }
  const hasTime = ev.some((e) => Number.isFinite(e.time));
  if (hasTime) ev.sort((x, y) => (Number.isFinite(x.time) ? x.time : Infinity) - (Number.isFinite(y.time) ? y.time : Infinity));
  return { events: ev, dropped, columns: names, hasTime,
    hasLocation: col.latitude !== undefined && col.longitude !== undefined, hasDepth: col.depth !== undefined };
}

const toRad = (d) => d * Math.PI / 180;
export function haversineKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371.0 * Math.asin(Math.sqrt(Math.min(Math.max(a, 0), 1)));
}

/** catalog.select: keep events inside a circle, a depth range and a time window (unset limits are ignored). A limit
 * on a column the file does not have is an error, as in Python, not a silently empty selection. Returns a catalogue. */
export function select(cat, { lat = null, lon = null, radiusKm = null, depthMin = null, depthMax = null, start = null, end = null } = {}) {
  if (radiusKm != null && (lat == null || lon == null)) {
    throw new CatalogError('circle', 'radius_km needs lat, lon and a catalogue with latitude and longitude');
  }
  if (radiusKm != null && !cat.hasLocation) {
    throw new CatalogError('noLocation', 'radius_km needs lat, lon and a catalogue with latitude and longitude');
  }
  if ((depthMin != null || depthMax != null) && !cat.hasDepth) throw new CatalogError('noDepth', 'a depth limit needs a depth column');
  if ((start || end) && !cat.hasTime) throw new CatalogError('noTime', 'a time window needs a time column');
  const t0 = start ? Date.parse(`${start}T00:00:00Z`) : null;
  const t1 = end ? Date.parse(`${end}T00:00:00Z`) : null;
  const events = cat.events.filter((e) => {
    if (radiusKm != null && !(haversineKm(lat, lon, e.latitude, e.longitude) <= radiusKm)) return false;
    if (depthMin != null && !(e.depth >= depthMin)) return false;
    if (depthMax != null && !(e.depth <= depthMax)) return false;
    if (t0 != null && !(e.time >= t0)) return false;
    if (t1 != null && !(e.time < t1)) return false;
    return true;
  });
  return { ...cat, events, hasTime: events.some((e) => Number.isFinite(e.time)) };
}

// ---------------------------------------------------------------- analysis (as seisatlas.analyze)

const fx = (x, nd = 3) => (Number.isFinite(x) ? +x.toFixed(nd) : null);

/** floorPeriods: [[y0, y1, floor], ...] by calendar year (UTC). */
export function analyze(events, { dm = 0.1, nboot = NBOOT, seed = 20261116, floor = null, floorPeriods = null, onProgress = null } = {}) {
  const res = { n_events: events.length, warnings: [], settings: { dm, nboot, seed, floor, floorPeriods } };
  const W = res.warnings;
  if (!events.length) { W.push({ k: 'none' }); return res; }
  const m = events.map((e) => e.mag);
  res.magnitude_range = minMax(m);
  const hasTime = events.some((e) => Number.isFinite(e.time));
  if (hasTime) {
    const [ta, tb] = minMax(events.map((e) => e.time).filter(Number.isFinite));
    res.time_range = [new Date(ta).toISOString().slice(0, 10), new Date(tb).toISOString().slice(0, 10)];
  }
  if (floorPeriods && floorPeriods.length && !hasTime) throw new CatalogError('floorTime', 'floor_periods needs a time column');
  // as analysis.py: a missing type is not a type; shares are of the events that have one, largest first
  const counts = {};
  let typed = 0;
  for (const e of events) if (e.magtype) { counts[e.magtype] = (counts[e.magtype] || 0) + 1; typed++; }
  const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
  if (sorted.length) {
    res.magnitude_types = Object.fromEntries(sorted);
    const major = sorted.filter(([, v]) => v / typed >= 0.05);
    if (major.length > 1) W.push({ k: 'mixed', types: major });
  }
  const fl = events.map((e) => {
    let f = floor == null ? -9 : floor;
    if (floorPeriods && Number.isFinite(e.time)) {
      const y = new Date(e.time).getUTCFullYear();
      for (const [y0, y1, v] of floorPeriods) if (y >= y0 && y <= y1) f = Math.max(f, v);
    }
    return f;
  });
  const cb = cellB(m, fl, { nboot, seed, dm, onProgress });
  res.mc = { maxc02: fx(cb.mc, 1), maxc02_lo: fx(cb.mc_lo, 1), maxc02_hi: fx(cb.mc_hi, 1) };
  const q = cb.quality;
  // the same keys as analysis.py
  res.b = { quality: q, n_above_threshold: cb.n_b || 0, threshold: cb.thr ? fx(minMax(cb.thr)[1], 6) : null,
    b: fx(cb.b), b_lo: fx(cb.lo), b_hi: fx(cb.hi), relative_width: fx(cb.relw), b_sigma_shi_bolt: fx(cb.sigma),
    'b_threshold_plus_0.2': fx(cb.b_plus02), 'b_threshold_plus_0.4': fx(cb.b_plus04), cutoff_unstable: !!cb.unstable,
    shown: q === 'A' || q === 'B' };
  if (q === 'insufficient') { W.push({ k: 'few', n: NMIN_B }); Object.assign(res.b, { b: null, b_lo: null, b_hi: null }); }
  else if (q === 'C') W.push({ k: 'wide' });
  if (res.b.cutoff_unstable) W.push({ k: 'unstable' });
  if (res.b.n_above_threshold > 0 && res.b.n_above_threshold < 200 && q !== 'insufficient') W.push({ k: 'small', n: res.b.n_above_threshold });
  if (hasTime && q !== 'insufficient') {
    const [bp, sp, nd] = bPositive(m, cb.thr, dm);
    res.b_positive = Number.isFinite(bp) && nd >= NMIN_B
      ? { b: fx(bp), b_lo: fx(bp - 1.96 * sp), b_hi: fx(bp + 1.96 * sp), n_differences: nd }
      : { b: null, b_lo: null, b_hi: null, n_differences: nd };
  }
  res.mc_by_year = [];
  if (hasTime) {
    const by = new Map();
    for (const e of events) if (Number.isFinite(e.time)) { const y = new Date(e.time).getUTCFullYear(); if (!by.has(y)) by.set(y, []); by.get(y).push(e.mag); }
    for (const [y, ms] of [...by.entries()].sort((a, b) => a[0] - b[0])) {
      if (ms.length >= 50) {
        const f = fmd(ms, dm);
        let best = 0;
        for (let j = 1; j < f.count.length; j++) if (f.count[j] > f.count[best]) best = j;
        res.mc_by_year.push({ year: y, n: ms.length, mc_maxc02: fx(binMag(f.mag[best] + 0.2, dm), 1) });
      }
    }
    const mcs = res.mc_by_year.map((r) => r.mc_maxc02).filter((v) => v != null);
    const [lo, hi] = minMax(mcs);
    if (mcs.length >= 3 && hi - lo >= 0.3 - 1e-9 && !floorPeriods) W.push({ k: 'mc_time', lo, hi });
  }
  res.fmd = fmd(m, dm);
  return res;
}

/** One page job, the same in the worker (worker.js) and on the main thread when no worker can start.
 * kind 'read': {n, columns, types}; kind 'analyze': {res, n}, after the selection in `opts`. */
export function runJob(kind, text, opts = {}, onProgress = null) {
  if (kind === 'read') {
    const cat = readCatalog(text);
    const types = {};
    for (const e of cat.events) if (e.magtype) types[e.magtype] = (types[e.magtype] || 0) + 1;
    return { n: cat.events.length, columns: cat.columns, types };
  }
  const cat = select(readCatalog(text, { magType: opts.magType || null }), opts);
  const res = analyze(cat.events, { nboot: opts.nboot, floor: opts.floor, floorPeriods: opts.floorPeriods, onProgress });
  return { res, n: cat.events.length };
}
