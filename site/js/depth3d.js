// "Depth 3D" view: earthquake hypocentres below the surface for one region, the USGS Slab2 slab surface, and the
// atlas statistics for the same region (events per depth bin, and the shallow / deeper cell b-values with their
// 95 % intervals as published in cells.geojson; nothing is re-estimated here). The 3D scene (three.js) loads only
// when this view opens; without WebGL 2 the view shows a 2D cross-section instead.

import { getJSON, mb } from './data.js';
import { h, svgEl } from './charts.js';
import { t } from './i18n/index.js';
import { infoButton } from './info.js';
import * as f from './fmt.js';
import { oklch } from './color.js';
import { isDark, cssVar } from './layers.js';
import { defineKeys, commit, intIn, oneOf } from './hashx.js';

// bbox: west, south, east, north (continuous longitudes). section: profile from a to b, half-width w (km).
// slab: data/slab2/<id>.json exists (built by scripts/basemap/build_slab2.py, same boxes).
export const PRESETS = {
  japan: { bbox: [128, 28, 150, 46], slab: true, section: { a: [128, 38], b: [150, 38], w: 150 } },
  chile: { bbox: [-78, -40, -62, -15], slab: true, section: { a: [-76, -22], b: [-62, -22], w: 150 } },
  tonga: { bbox: [172, -36, 192, -14], slab: true, section: { a: [173, -21], b: [189, -21], w: 150 } },
  hindukush: { bbox: [66, 33, 78, 41], slab: true, section: { a: [71, 34], b: [71, 40], w: 120 } },
  italy: { bbox: [6, 36, 20, 47], slab: true, section: { a: [18.5, 37.5], b: [11.5, 41.5], w: 120 } },
  iceland: { bbox: [-25, 62.5, -12, 67.5], slab: false, section: { a: [-24, 64], b: [-13, 64], w: 100 } },
  // Kahramanmaraş 2023 (Mw 7.8 and 7.6): the East Anatolian Fault zone; the section crosses it from north-west to
  // south-east through the Mw 7.8 epicentre. No Slab2 model covers it. note: a link shown under the view.
  turkey: { bbox: [34.5, 35.5, 41.5, 40], slab: false, section: { a: [35.6, 38.9], b: [38.6, 36.3], w: 120 }, note: 'turkey' },
};
const PRESET_IDS = [...Object.keys(PRESETS), 'view'];

defineKeys([
  { key: 'p3', def: 'japan', parse: oneOf(PRESET_IDS) },
  { key: 'x3', def: 0, parse: intIn(0, 20) }, // depth exaggeration; 0 = automatic
  { key: 'e3', def: 6, parse: (s) => (s === '5' || s === '6' ? +s : undefined) },
  { key: 'm3', def: '3d', parse: oneOf(['3d', 'xs']) },
  { key: 's3', def: 1, parse: intIn(0, 1) },
]);

// Depth classes (km). 70 km is the atlas split between shallow and deeper statistics.
export const DEPTH_BREAKS = [35, 70, 150, 300, 500];
const DEG = 111.195;

/** One-hue sequential ramp (OKLCH hue 305), light to dark in light mode and dark to light in dark mode. */
export function depthColors(dark = isDark()) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    out.push(dark ? oklch(0.52 + 0.42 * k, 0.12 - 0.02 * k, 305) : oklch(0.76 - 0.46 * k, 0.10 + 0.06 * k, 305));
  }
  return out;
}
export const depthClass = (d) => { let i = 0; while (i < DEPTH_BREAKS.length && d >= DEPTH_BREAKS[i]) i++; return i; };
const binLabel = (i) => (i === 0 ? `0–${DEPTH_BREAKS[0]}` : i === DEPTH_BREAKS.length ? `≥ ${DEPTH_BREAKS[i - 1]}` : `${DEPTH_BREAKS[i - 1]}–${DEPTH_BREAKS[i]}`);

let root = null;
let C = null;
let built = null; // language the DOM was built in
let scene = null; // the three.js scene controller, once loaded
let sceneLoading = null;
let webgl = null; // true / false once probed
let syncToken = 0;
let current = null; // data shown now: {region, ev, slab, cells}

const $ = (id) => document.getElementById(id);

/** Called by app.js every time the depth view is shown or the URL hash changes while it is shown. */
export function show(el, ctx) {
  root = el;
  C = ctx;
  if (!C.cells) return;
  if (built !== document.documentElement.lang) build();
  sync();
}

// ------------------------------------------------------------------ region

/** The region box: a preset, or the current map view (from the map position in the URL). */
export function regionOf(st) {
  if (st.p3 !== 'view') {
    const p = PRESETS[st.p3] || PRESETS.japan;
    return { id: st.p3, bbox: p.bbox, section: p.section, slab: p.slab, note: p.note || null };
  }
  const at = st.at || { z: 1.5, lat: 12, lon: 160 };
  const lonSpan = Math.min(40, Math.max(4, (360 / 2 ** at.z) * 2.2));
  const latSpan = Math.min(30, lonSpan * 0.7);
  const lat0 = Math.max(-80 + latSpan / 2, Math.min(80 - latSpan / 2, at.lat));
  const bbox = [at.lon - lonSpan / 2, lat0 - latSpan / 2, at.lon + lonSpan / 2, lat0 + latSpan / 2].map((v) => +v.toFixed(2));
  const w = Math.min(200, (latSpan * DEG) / 4);
  return { id: 'view', bbox, slab: false, section: { a: [bbox[0], lat0], b: [bbox[2], lat0], w } };
}

const wrapTo = (lon, lon0) => ((((lon - lon0 + 180) % 360) + 360) % 360) - 180 + lon0;

function selectEvents(e, bbox) {
  const [w, s, ea, n] = bbox;
  const lon0 = (w + ea) / 2;
  const out = { lon: [], lat: [], depth: [], mag: [], year: [], mt: [], id: [], codes: e.codes };
  for (let i = 0; i < e.n; i++) {
    const la = e.lat[i];
    if (la < s || la > n) continue;
    const lo = wrapTo(e.lon[i], lon0);
    if (lo < w || lo > ea) continue;
    out.lon.push(lo); out.lat.push(la); out.depth.push(e.depth[i]); out.mag.push(e.mag[i]); out.year.push(e.year[i]);
    out.mt.push(e.mt[i]); out.id.push(Array.isArray(e.id) ? e.id[i] : null);
  }
  out.n = out.lon.length;
  return out;
}

function cellsIn(bbox) {
  const [w, s, ea, n] = bbox;
  const lon0 = (w + ea) / 2;
  return C.cells.features.map((ft) => ft.properties).filter((p) => p.lat >= s && p.lat <= n && wrapTo(p.lon, lon0) >= w && wrapTo(p.lon, lon0) <= ea);
}

function niceDepth(maxD) {
  const steps = [20, 40, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800];
  return steps.find((s) => s >= maxD) || Math.ceil(maxD / 100) * 100;
}

/** Automatic exaggeration: the depth box about a third as tall as it is wide. */
export function autoExaggeration(bbox, maxDepth) {
  const lat0 = (bbox[1] + bbox[3]) / 2;
  const wKm = (bbox[2] - bbox[0]) * DEG * Math.cos((lat0 * Math.PI) / 180);
  const hKm = (bbox[3] - bbox[1]) * DEG;
  return Math.max(1, Math.min(20, Math.round((0.35 * Math.max(wKm, hKm)) / maxDepth)));
}

// ------------------------------------------------------------------ DOM

function build() {
  built = document.documentElement.lang;
  if (scene) { scene.dispose(); scene = null; sceneLoading = null; }
  const presetOpts = PRESET_IDS.map((id) => h('option', { value: id, text: t(`d3.p.${id}`) }));
  const m5 = C.manifest && C.manifest.files['events_m5.json'];
  root.replaceChildren(
    h('div', { class: 'd3-head' },
      h('h1', { text: t('d3.h1') }),
      h('p', { class: 'd3-lead', text: t('d3.lead') })),
    h('div', { class: 'd3-grid' },
      h('aside', { class: 'd3-controls', 'aria-label': t('d3.controls') },
        h('div', { class: 'group' },
          h('label', { class: 'group-title', for: 'd3-preset', text: t('d3.region') }),
          h('select', { class: 'select', id: 'd3-preset' }, presetOpts)),
        h('fieldset', { class: 'group' },
          h('legend', { class: 'group-title', text: t('d3.mode') }),
          h('div', { class: 'seg', id: 'd3-mode' },
            h('label', {}, h('input', { type: 'radio', name: 'd3mode', value: '3d' }), h('span', { text: t('d3.mode3d') })),
            h('label', {}, h('input', { type: 'radio', name: 'd3mode', value: 'xs' }), h('span', { text: t('d3.modeXs') })))),
        h('fieldset', { class: 'group' },
          h('legend', { class: 'group-title', text: t('d3.events') }),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'd3-m5' }),
            h('span', { text: m5 ? t('d3.m5', { size: mb(m5.bytes) }) : t('d3.m5plain') }))),
        h('div', { class: 'group' },
          h('label', { class: 'group-title', for: 'd3-ex', text: t('d3.ex') }),
          h('div', { class: 'range-row' }, h('input', { type: 'range', id: 'd3-ex', min: 1, max: 20, step: 1 }), h('output', { for: 'd3-ex', id: 'd3-ex-out', class: 'mono' })),
          h('button', { type: 'button', class: 'link-btn', id: 'd3-ex-auto', text: t('d3.exAuto') })),
        h('div', { class: 'group' },
          h('div', { class: 'check-row' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'd3-slab' }), h('span', { text: t('d3.slab') })), infoButton('depth-and-slabs')),
          h('p', { class: 'hint', id: 'd3-slab-hint' })),
        h('div', { class: 'group' },
          h('button', { type: 'button', class: 'small-btn', id: 'd3-reset', text: t('d3.reset') }),
          h('p', { class: 'hint', id: 'd3-help', text: t('d3.help') }))),
      h('div', { class: 'd3-stage-wrap' },
        h('div', { class: 'd3-stage', id: 'd3-stage', role: 'region', 'aria-label': t('d3.stage') },
          h('div', { class: 'd3-status', id: 'd3-status', role: 'status', 'aria-live': 'polite' })),
        h('div', { class: 'd3-legend', id: 'd3-legend' }),
        h('p', { class: 'hint d3-caption', id: 'd3-caption' }),
        h('p', { class: 'hint d3-note', id: 'd3-note', hidden: true })),
      h('section', { class: 'd3-stats', id: 'd3-stats', 'aria-label': t('d3.statsH') })));

  $('d3-preset').addEventListener('change', (e) => { C.state.p3 = e.target.value; C.state.x3 = 0; commit(); sync(); if (scene) scene.reset(); });
  document.querySelectorAll('input[name=d3mode]').forEach((i) => i.addEventListener('change', () => { C.state.m3 = i.value; commit(); sync(); }));
  $('d3-m5').addEventListener('change', (e) => { C.state.e3 = e.target.checked ? 5 : 6; commit(); sync(); });
  $('d3-ex').addEventListener('input', (e) => { C.state.x3 = +e.target.value; commit(); sync(); });
  $('d3-ex-auto').addEventListener('click', () => { C.state.x3 = 0; commit(); sync(); });
  $('d3-slab').addEventListener('change', (e) => { C.state.s3 = e.target.checked ? 1 : 0; commit(); sync(); });
  $('d3-reset').addEventListener('click', () => { if (scene && C.state.m3 === '3d') scene.reset(); });
}

let themeWatch = false;
function watchTheme() {
  if (themeWatch) return;
  themeWatch = true;
  const redraw = () => { if (root && !document.getElementById('view-depth').hidden && current) { draw(); renderLegend(); renderStats(); } };
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
}

// ------------------------------------------------------------------ sync and data

async function sync() {
  watchTheme();
  const st = C.state;
  const region = regionOf(st);
  $('d3-preset').value = st.p3;
  document.querySelectorAll('input[name=d3mode]').forEach((i) => { i.checked = i.value === st.m3; });
  $('d3-m5').checked = st.e3 === 5;
  $('d3-slab').checked = !!st.s3;
  $('d3-slab').disabled = !region.slab;
  $('d3-slab-hint').textContent = t(region.slab ? 'd3.slabHint' : region.id === 'view' ? 'd3.slabNoneView' : 'd3.slabNone');
  $('d3-reset').disabled = st.m3 !== '3d' || webgl === false;
  const note = $('d3-note');
  note.hidden = !region.note;
  if (region.note) {
    // a link only: the relocated catalogue is not redistributed here (docs/basemap.md)
    note.replaceChildren(t(`d3.note.${region.note}`), ' ',
      h('a', { href: 'https://doi.org/10.5281/zenodo.8089273', target: '_blank', rel: 'noopener', text: t('d3.note.turkeyLink') }));
  }
  const my = ++syncToken;
  setStatus(t('d3.loading'));
  let ev, slab = null;
  try {
    const [e, sl] = await Promise.all([
      getJSON(st.e3 === 5 ? 'events_m5.json' : 'events_m6.json'),
      region.slab ? getJSON(`slab2/${region.id}.json`).catch(() => null) : Promise.resolve(null),
    ]);
    ev = e; slab = sl;
  } catch (err) {
    if (my !== syncToken) return;
    if (st.e3 === 5) { st.e3 = 6; commit(); setStatus(`${err.message} ${t('ev.fallbackM6')}`); sync(); return; }
    setStatus(err.message, true);
    return;
  }
  if (my !== syncToken) return;
  const sel = selectEvents(ev, region.bbox);
  let maxD = 0;
  for (const d of sel.depth) if (d > maxD) maxD = d;
  if (slab && st.s3) for (const s of slab.slabs) for (const c of s.contours) if (c.d > maxD) maxD = c.d;
  const maxDepth = niceDepth(Math.max(maxD, 20));
  const autoEx = autoExaggeration(region.bbox, maxDepth);
  const ex = st.x3 || autoEx;
  $('d3-ex').value = ex;
  $('d3-ex-out').textContent = `×${ex}`;
  $('d3-ex-auto').hidden = !st.x3;
  current = { region, ev: sel, slab: slab && st.s3 ? slab : null, cells: cellsIn(region.bbox), maxDepth, ex, auto: !st.x3, m: st.e3 };
  setStatus('');
  await draw();
  renderLegend();
  renderStats();
}

function setStatus(msg, error = false) {
  const s = $('d3-status');
  if (!s) return;
  s.textContent = msg;
  s.hidden = !msg;
  s.classList.toggle('error', !!error);
}

function probeWebGL(canvas) {
  if (webgl !== null) return webgl;
  try { webgl = !!(window.WebGL2RenderingContext && canvas.getContext('webgl2')); } catch (e) { webgl = false; }
  return webgl;
}

async function draw() {
  const stage = $('d3-stage');
  const want3d = C.state.m3 === '3d';
  let canvas = stage.querySelector('canvas.d3-canvas');
  if (want3d && webgl !== false) {
    if (!canvas) {
      canvas = h('canvas', { class: 'd3-canvas', tabindex: '0', role: 'img', 'aria-label': t('d3.canvas') });
      stage.prepend(canvas);
    }
    if (probeWebGL(canvas)) {
      stage.querySelector('.d3-xs')?.remove();
      canvas.hidden = false;
      stage.classList.remove('is-xs');
      try {
        if (!scene) {
          if (!sceneLoading) sceneLoading = import('./depth3d-scene.js').then((m) => m.createScene(stage, canvas, { t }));
          scene = await sceneLoading;
        }
        scene.setData(sceneData());
        $('d3-caption').textContent = caption();
        return;
      } catch (e) {
        console.warn('3D view unavailable, showing the cross-section instead:', e);
        webgl = false;
        sceneLoading = null;
        scene = null;
      }
    }
  }
  // cross-section (chosen, or the fallback without WebGL 2)
  if (canvas) canvas.hidden = true;
  stage.classList.add('is-xs');
  const note = want3d && webgl === false ? h('p', { class: 'd3-nowebgl', text: t('d3.noWebgl') }) : null;
  const xs = renderSection(note);
  stage.querySelector('.d3-xs')?.remove();
  stage.append(xs);
  $('d3-reset').disabled = true;
  $('d3-caption').textContent = caption();
}

function caption() {
  const c = current;
  const shown = t('d3.caption', { n: f.int(c.ev.n), m: c.m === 5 ? '5' : '6', ex: c.ex, auto: c.auto ? t('d3.auto') : '' });
  const slab = c.slab ? ` ${t('d3.captionSlab')}` : '';
  return `${shown}${slab}`;
}

function sceneData() {
  const c = current;
  const cols = depthColors();
  return {
    bbox: c.region.bbox, maxDepth: c.maxDepth, ex: c.ex, events: c.ev, slab: c.slab,
    colors: cols, depthClass, ticks: depthTicks(c.maxDepth),
    theme: { surface: cssVar('--surface'), ink: cssVar('--ink'), ink3: cssVar('--ink-3'), rule: cssVar('--rule-strong'), ocean: cssVar('--ocean'), coast: cssVar('--coast'), plate: cssVar('--plate'), bg: cssVar('--bg') },
    getBase: () => Promise.all([getJSON('coastline.geojson'), getJSON('plates.geojson')]),
    labels: { north: t('d3.north'), split: t('d3.split'), km: t('unit.km') },
    fmtTip: tipText,
  };
}

function tipText(ev, i) {
  const mt = (ev.codes && ev.codes.mt && ev.codes.mt[String(ev.mt[i])]) || '';
  return { main: `M ${f.mag(ev.mag[i])} · ${f.decYearDate(ev.year[i])}`, sub: t('ev.depthLine', { d: f.int(ev.depth[i]), mt }) };
}

function depthTicks(maxDepth) {
  const step = maxDepth <= 50 ? 10 : maxDepth <= 150 ? 25 : maxDepth <= 400 ? 100 : 100;
  const out = [];
  for (let d = 0; d <= maxDepth + 1e-9; d += step) out.push(d);
  return out;
}

// ------------------------------------------------------------------ legend

function renderLegend() {
  const el = $('d3-legend');
  const cols = depthColors();
  const sizes = [5, 6, 7, 8, 9].filter((m) => current.m === 5 || m >= 6);
  el.replaceChildren(
    h('div', { class: 'd3-lg-block' },
      h('span', { class: 'd3-lg-title', text: t('d3.lgDepth') }),
      h('div', { class: 'd3-lg-ramp' }, cols.map((c, i) => h('span', { class: 'd3-lg-step' }, h('i', { style: `background:${c}`, 'aria-hidden': 'true' }), h('span', { class: 'mono', text: binLabel(i) }))))),
    h('div', { class: 'd3-lg-block' },
      h('span', { class: 'd3-lg-title', text: t('d3.lgSize') }),
      h('div', { class: 'd3-lg-sizes', 'aria-hidden': 'true' }, sizes.map((m) => { const r = pointSize(m); return h('span', {}, h('i', { style: `width:${r}px;height:${r}px` }), `M${m}`); }))));
}

/** Marker diameter in CSS pixels for a magnitude (same rule in 3D and in the cross-section). */
export function pointSize(m) { return Math.max(2.5, 2.5 + (m - 5) * 2.6); }

// ------------------------------------------------------------------ cross-section (SVG)

function localXY(lon, lat, lon0, lat0) {
  return [(lon - lon0) * DEG * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * DEG];
}

/** Events within the swath, projected on the profile: [{x: along-km, d: depth, i}]; slab crossings per slab. */
export function sectionData(c) {
  const { a, b, w } = c.region.section;
  const lon0 = (c.region.bbox[0] + c.region.bbox[2]) / 2, lat0 = (c.region.bbox[1] + c.region.bbox[3]) / 2;
  const A = localXY(a[0], a[1], lon0, lat0), B = localXY(b[0], b[1], lon0, lat0);
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  const pts = [];
  for (let i = 0; i < c.ev.n; i++) {
    const p = localXY(c.ev.lon[i], c.ev.lat[i], lon0, lat0);
    const dx = p[0] - A[0], dy = p[1] - A[1];
    const along = dx * u[0] + dy * u[1];
    const perp = -dx * u[1] + dy * u[0];
    if (Math.abs(perp) <= w && along >= 0 && along <= L) pts.push({ x: along, d: c.ev.depth[i], i });
  }
  const slabs = [];
  if (c.slab) {
    for (const s of c.slab.slabs) {
      const line = [];
      for (const ct of s.contours) {
        // where this depth contour crosses the profile; with several crossings keep the one nearest the previous
        const hits = [];
        for (const ln of ct.lines) {
          for (let k = 0; k + 3 < ln.length; k += 2) {
            const p = localXY(wrapTo(ln[k], lon0), ln[k + 1], lon0, lat0), q = localXY(wrapTo(ln[k + 2], lon0), ln[k + 3], lon0, lat0);
            const hit = segHit(A, B, p, q);
            if (hit !== null) hits.push(hit * L);
          }
        }
        if (!hits.length) continue;
        const prev = line.length ? line[line.length - 1].x : null;
        const x = prev === null ? hits[0] : hits.reduce((s, v) => (Math.abs(v - prev) < Math.abs(s - prev) ? v : s));
        line.push({ x, d: ct.d });
      }
      if (line.length > 1) slabs.push({ id: s.id, name: s.name, line });
    }
  }
  return { L, pts, slabs };
}

function segHit(A, B, p, q) {
  const r = [B[0] - A[0], B[1] - A[1]], s = [q[0] - p[0], q[1] - p[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const tt = ((p[0] - A[0]) * s[1] - (p[1] - A[1]) * s[0]) / den;
  const uu = ((p[0] - A[0]) * r[1] - (p[1] - A[1]) * r[0]) / den;
  return tt >= 0 && tt <= 1 && uu >= 0 && uu <= 1 ? tt : null;
}

function renderSection(note) {
  const c = current;
  const sd = sectionData(c);
  const wrap = h('div', { class: 'd3-xs' });
  if (note) wrap.append(note);
  const stage = $('d3-stage');
  const W = Math.max(280, stage.clientWidth - 2);
  const m = { l: 46, r: 14, t: 26, b: 34 };
  const pw = W - m.l - m.r;
  const ph = Math.round(Math.max(170, Math.min(520, (pw * c.maxDepth * c.ex) / sd.L)));
  const exEff = (ph / c.maxDepth) / (pw / sd.L);
  const H = ph + m.t + m.b;
  const X = (x) => m.l + (x / sd.L) * pw, Y = (d) => m.t + (d / c.maxDepth) * ph;
  const { a, b } = c.region.section;
  const svg = svgEl('svg', { class: 'd3-xs-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': t('d3.xsAria', { n: f.int(sd.pts.length), a: f.latlon(a[1], a[0]), b: f.latlon(b[1], b[0]), w: c.region.section.w }) });
  // depth grid and labels
  for (const d of depthTicks(c.maxDepth)) {
    svgEl('line', { x1: m.l, x2: m.l + pw, y1: Y(d), y2: Y(d), class: d === 0 ? 'xs-surface' : 'xs-grid' }, svg);
    svgEl('text', { x: m.l - 6, y: Y(d) + 4, class: 'xs-tick', 'text-anchor': 'end' }, svg).textContent = String(d);
  }
  if (c.maxDepth > 70) {
    svgEl('line', { x1: m.l, x2: m.l + pw, y1: Y(70), y2: Y(70), class: 'xs-split' }, svg);
    svgEl('text', { x: m.l + pw - 4, y: Y(70) - 5, class: 'xs-note', 'text-anchor': 'end' }, svg).textContent = t('d3.split');
  }
  const stepKm = sd.L > 1500 ? 500 : sd.L > 600 ? 200 : 100;
  for (let x = 0; x <= sd.L; x += stepKm) {
    svgEl('text', { x: X(x), y: m.t + ph + 16, class: 'xs-tick', 'text-anchor': 'middle' }, svg).textContent = String(x);
  }
  svgEl('text', { x: m.l + pw, y: H - 4, class: 'xs-tick', 'text-anchor': 'end' }, svg).textContent = t('d3.xsDist');
  svgEl('text', { x: 4, y: H - 4, class: 'xs-tick' }, svg).textContent = `↓ ${t('d3.xsDepth')}`;
  svgEl('text', { x: m.l, y: m.t - 8, class: 'xs-end' }, svg).textContent = `A ${f.latlon(a[1], a[0])}`;
  svgEl('text', { x: m.l + pw, y: m.t - 8, class: 'xs-end', 'text-anchor': 'end' }, svg).textContent = `B ${f.latlon(b[1], b[0])}`;
  // slab
  for (const s of sd.slabs) {
    svgEl('polyline', { points: s.line.map((p) => `${X(p.x).toFixed(1)},${Y(p.d).toFixed(1)}`).join(' '), class: 'xs-slab' }, svg);
    const last = s.line[s.line.length - 1];
    svgEl('text', { x: X(last.x) + 4, y: Y(last.d), class: 'xs-note' }, svg).textContent = `Slab2 ${s.name}`;
  }
  // events, small ones first
  const cols = depthColors();
  const order = sd.pts.slice().sort((p, q) => c.ev.mag[p.i] - c.ev.mag[q.i]);
  const g = svgEl('g', { class: 'xs-events' }, svg);
  for (const p of order) {
    svgEl('circle', { cx: X(p.x).toFixed(1), cy: Y(p.d).toFixed(1), r: (pointSize(c.ev.mag[p.i]) / 2 + 0.5).toFixed(1), fill: cols[depthClass(p.d)] }, g);
  }
  wrap.append(svg);
  wrap.append(h('p', { class: 'hint', text: t('d3.xsNote', { w: c.region.section.w, n: f.int(sd.pts.length), ex: exEff.toFixed(1) }) }));
  // hover readout: nearest event within 10 px
  const tip = h('div', { class: 'tooltip d3-tip', hidden: true });
  wrap.append(tip);
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W, sy = ((e.clientY - r.top) / r.height) * H;
    let best = null, bd = 100;
    for (const p of sd.pts) { const d2 = (X(p.x) - sx) ** 2 + (Y(p.d) - sy) ** 2; if (d2 < bd) { bd = d2; best = p; } }
    if (!best) { tip.hidden = true; return; }
    const tx = tipText(c.ev, best.i);
    tip.replaceChildren(h('div', { class: 'tt-main' }, h('strong', { text: tx.main })), h('div', { class: 'tt-sub', text: tx.sub }));
    tip.hidden = false;
    tip.style.left = `${Math.min(e.clientX - wrap.getBoundingClientRect().left + 12, wrap.clientWidth - 200)}px`;
    tip.style.top = `${e.clientY - wrap.getBoundingClientRect().top + 12}px`;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  return wrap;
}

// ------------------------------------------------------------------ statistics

function renderStats() {
  const c = current;
  const el = $('d3-stats');
  const counts = new Array(DEPTH_BREAKS.length + 1).fill(0);
  for (const d of c.ev.depth) counts[depthClass(d)]++;
  const max = Math.max(1, ...counts);
  const cols = depthColors();
  const sh = counts[0] + counts[1], dp = c.ev.n - sh;
  const bars = h('div', { class: 'd3-card' },
    h('h2', {}, t('d3.binsH'), infoButton('depth-and-slabs')),
    h('p', { class: 'hint', text: t('d3.binsSub', { m: c.m, n: f.int(c.ev.n) }) }),
    h('table', { class: 'd3-bins' },
      h('caption', { class: 'sr-only', text: t('d3.binsH') }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('d3.binCol') }), h('th', { scope: 'col', text: t('d3.countCol') }), h('th', { scope: 'col', class: 'sr-only', text: '' }))),
      h('tbody', {}, counts.map((n, i) => h('tr', { class: i === 2 ? 'split-before' : null },
        h('th', { scope: 'row', class: 'mono', text: `${binLabel(i)} ${t('unit.km')}` }),
        h('td', { class: 'mono num', text: f.int(n) }),
        h('td', { class: 'bar' }, h('span', { style: `width:${(n / max) * 100}%;background:${cols[i]}` })))))),
    h('p', { class: 'd3-split-line' }, h('strong', { text: t('depth.sh.label') }), ` ${f.int(sh)} · `, h('strong', { text: t('depth.dp.label') }), ` ${f.int(dp)}`));
  el.replaceChildren(bars, bCard('sh'), bCard('dp'), h('p', { class: 'hint d3-stats-note', text: t('d3.statsNote', { cat: C.manifest.method.b_catalogue, r: C.manifest.method.sample_radius_km }) }));
}

function bCard(d) {
  const c = current;
  const rows = c.cells.filter((p) => p[`${d}_q`] === 'A' || p[`${d}_q`] === 'B').sort((p, q) => p[`${d}_b`] - q[`${d}_b`]);
  const nC = c.cells.filter((p) => p[`${d}_q`] === 'C').length;
  const nI = c.cells.length - rows.length - nC;
  const card = h('div', { class: 'd3-card' },
    h('h2', {}, t(`d3.bH.${d}`), d === 'sh' ? infoButton('gutenberg-richter-b-value') : null),
    h('p', { class: 'hint' }, t('d3.bSub', { n: f.int(c.cells.length), ab: f.int(rows.length), c: f.int(nC), i: f.int(nI) }), d === 'sh' ? infoButton('quality-codes') : null));
  if (!rows.length) { card.append(h('p', { class: 'muted', text: t('d3.bNone') })); return card; }
  const MAXR = 24;
  const shown = rows.length > MAXR ? rows.filter((_, i) => i % Math.ceil(rows.length / MAXR) === 0) : rows;
  let lo = 0.6, hi = 1.6;
  for (const p of shown) { lo = Math.min(lo, p[`${d}_b_lo`]); hi = Math.max(hi, p[`${d}_b_hi`]); }
  lo = Math.floor(lo * 10) / 10; hi = Math.ceil(hi * 10) / 10;
  const list = h('ol', { class: 'd3-forest', 'aria-label': t(`d3.bH.${d}`) });
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  for (const p of shown) {
    const href = `#v=map&c=${p.id}&d=${d}&lang=${C.state.lang}`;
    list.append(h('li', {},
      h('a', { href, class: 'mono d3-cell', text: f.latlon(p.lat, p.lon), title: t('d3.openCell') }),
      h('span', { class: 'd3-ci', 'aria-hidden': 'true' },
        h('i', { class: 'ref', style: `left:${pos(1)}` }),
        h('i', { class: 'iv', style: `left:${pos(p[`${d}_b_lo`])};right:calc(100% - ${pos(p[`${d}_b_hi`])})` }),
        h('i', { class: `pt q${p[`${d}_q`]}`, style: `left:${pos(p[`${d}_b`])}` })),
      h('span', { class: 'mono d3-val', text: `${f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`])} ${p[`${d}_q`]}` })));
  }
  card.append(h('div', { class: 'd3-axis mono', 'aria-hidden': 'true' }, h('span', { text: lo.toFixed(1) }), h('span', { text: 'b = 1', style: `left:${pos(1)}` }), h('span', { text: hi.toFixed(1) })), list);
  if (shown.length < rows.length) card.append(h('p', { class: 'hint', text: t('d3.bSample', { k: shown.length, n: rows.length }) }));
  return card;
}
