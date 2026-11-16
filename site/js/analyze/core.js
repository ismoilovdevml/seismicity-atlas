// Mc and b-value of a user's catalogue, in the browser. A port of src/seisatlas (analysis.py, atlaslib.cell_b,
// seislib.b_varmc / b_positive / mc_maxc_fast) so that a file never leaves the visitor's computer.
// Deterministic parts (Mc, b, b-positive, FMD) equal the Python package; the bootstrap uses a different random
// generator, so interval ends differ from Python by Monte-Carlo noise only (tests/test_analyze_js.py).

export const NMIN_B = 50;
export const NBOOT = 1000;
export const Q_A = 0.30;
export const Q_B = 0.50;
const LOG10E = Math.LOG10E;

/** numpy.rint: round half to even. */
export function rint(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
const r6 = (x) => rint(x * 1e6) / 1e6;
/** seislib.bin_mag: np.round(np.round(m / dm) * dm, 6). */
export const binMag = (x, dm = 0.1) => r6(rint(x / dm) * dm);

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
    if (mb[i] >= t - 1e-9) x.push(mb[i] - (t - dm / 2));
  }
  const n = x.length;
  if (n < 2) return [NaN, NaN, n];
  let s = 0;
  for (const v of x) s += v;
  const mean = s / n;
  let ss = 0;
  for (const v of x) ss += (v - mean) ** 2;
  const b = LOG10E / mean;
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
export function cellB(m, floor, { nboot = NBOOT, seed = 20261116, dm = 0.1, nminMc = 30 } = {}) {
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
  for (let r = 0; r < nboot; r++) {
    for (let i = 0; i < N; i++) { const j = Math.floor(R() * N); mm[i] = mb[j]; ff[i] = fl[j]; }
    const mcr = maxc(mm, dm);
    mcb[r] = mcr;
    let s = 0;
    let c = 0;
    for (let i = 0; i < N; i++) {
      th[i] = Math.max(mcr, ff[i]);
      if (mm[i] >= th[i] - 1e-9) { s += mm[i] - (th[i] - dm / 2); c++; }
    }
    if (c >= 2) bb.push(LOG10E / (s / c));
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
  const b = LOG10E / (mean - (dmc - dm / 2));
  return [b, 2.3 * b * b * Math.sqrt(ss / (n * (n - 1))), n];
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
  if (rows.length < 2) throw new Error('The file has no data rows.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [std, names] of Object.entries(ALIASES)) {
    const j = names.map((n) => header.indexOf(n)).find((x) => x >= 0);
    if (j !== undefined) col[std] = j;
  }
  if (col.mag === undefined) throw new Error(`No magnitude column found (expected one of: ${ALIASES.mag.join(', ')}).`);
  const dateJ = header.indexOf('date');
  const timeJ = header.indexOf('time');
  const combine = col.time === undefined && dateJ >= 0 && timeJ >= 0;
  const dropped = { bad_magnitude: 0, other_magnitude_types: 0 };
  const ev = [];
  const num = (r, k) => (col[k] === undefined ? NaN : parseFloat(r[col[k]]));
  for (const r of rows.slice(1)) {
    const mag = parseFloat(r[col.mag]);
    if (!Number.isFinite(mag) || mag < -3 || mag > 10) { dropped.bad_magnitude++; continue; }
    const mt = col.magtype === undefined ? null : String(r[col.magtype] || '').trim().toLowerCase();
    if (magType && mt !== magType.trim().toLowerCase()) { dropped.other_magnitude_types++; continue; }
    let ts = NaN;
    const raw = combine ? `${r[dateJ]}T${r[timeJ]}` : col.time !== undefined ? r[col.time] : null;
    if (raw) {
      const s = String(raw).trim();
      ts = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) || !/\d[ T]\d/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
    }
    ev.push({ mag, time: ts, latitude: num(r, 'latitude'), longitude: num(r, 'longitude'), depth: num(r, 'depth'), magtype: mt });
  }
  if (magType && col.magtype === undefined) throw new Error('A magnitude type was chosen, but the file has no magnitude-type column.');
  const hasTime = ev.some((e) => Number.isFinite(e.time));
  if (hasTime) ev.sort((a, b) => (Number.isFinite(a.time) ? a.time : Infinity) - (Number.isFinite(b.time) ? b.time : Infinity));
  return { events: ev, dropped, columns: Object.fromEntries(Object.entries(col).map(([k, j]) => [k, rows[0][j]])), hasTime };
}

const toRad = (d) => d * Math.PI / 180;
export function haversineKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371.0 * Math.asin(Math.sqrt(Math.min(Math.max(a, 0), 1)));
}

/** Keep events inside a circle, a depth range and a time window (unset limits are ignored). */
export function select(events, { lat = null, lon = null, radiusKm = null, depthMin = null, depthMax = null, start = null, end = null } = {}) {
  const t0 = start ? Date.parse(`${start}T00:00:00Z`) : null;
  const t1 = end ? Date.parse(`${end}T00:00:00Z`) : null;
  return events.filter((e) => {
    if (radiusKm != null && lat != null && lon != null && !(haversineKm(lat, lon, e.latitude, e.longitude) <= radiusKm)) return false;
    if (depthMin != null && !(e.depth >= depthMin)) return false;
    if (depthMax != null && !(e.depth <= depthMax)) return false;
    if (t0 != null && !(e.time >= t0)) return false;
    if (t1 != null && !(e.time < t1)) return false;
    return true;
  });
}

// ---------------------------------------------------------------- analysis (as seisatlas.analyze)

const fx = (x, nd = 3) => (Number.isFinite(x) ? +x.toFixed(nd) : null);

/** floorPeriods: [[y0, y1, floor], ...] by calendar year (UTC). */
export function analyze(events, { dm = 0.1, nboot = NBOOT, seed = 20261116, floor = null, floorPeriods = null } = {}) {
  const res = { n_events: events.length, warnings: [], settings: { dm, nboot, seed, floor, floorPeriods } };
  const W = res.warnings;
  if (!events.length) { W.push({ k: 'none' }); return res; }
  const m = events.map((e) => e.mag);
  res.magnitude_range = [Math.min(...m), Math.max(...m)];
  const hasTime = events.some((e) => Number.isFinite(e.time));
  if (hasTime) {
    const ts = events.map((e) => e.time).filter(Number.isFinite);
    res.time_range = [new Date(Math.min(...ts)).toISOString().slice(0, 10), new Date(Math.max(...ts)).toISOString().slice(0, 10)];
  }
  const types = {};
  for (const e of events) if (e.magtype) types[e.magtype] = (types[e.magtype] || 0) + 1;
  if (Object.keys(types).length) {
    res.magnitude_types = types;
    const major = Object.entries(types).filter(([, v]) => v / events.length >= 0.05);
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
  const cb = cellB(m, fl, { nboot, seed, dm });
  res.mc = { maxc02: fx(cb.mc, 1), maxc02_lo: fx(cb.mc_lo, 1), maxc02_hi: fx(cb.mc_hi, 1) };
  const q = cb.quality;
  res.b = { quality: q, n_above_threshold: cb.n_b || 0, b: fx(cb.b), b_lo: fx(cb.lo), b_hi: fx(cb.hi),
    relative_width: fx(cb.relw), b_plus02: fx(cb.b_plus02), b_plus04: fx(cb.b_plus04), cutoff_unstable: !!cb.unstable,
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
    if (mcs.length >= 3 && Math.max(...mcs) - Math.min(...mcs) >= 0.3 - 1e-9 && !floorPeriods) W.push({ k: 'mc_time', lo: Math.min(...mcs), hi: Math.max(...mcs) });
  }
  res.fmd = fmd(m, dm);
  return res;
}
