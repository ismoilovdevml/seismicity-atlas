// The map: MapLibre style built from the atlas GeoJSON (no third-party tiles), cell layers, events overlay,
// hover tooltip, click handling and legend.

import { layerDef, isDark, cssVar, CC_RULES } from './layers.js';
import * as f from './fmt.js';
import { h } from './charts.js';
import { getJSON, ruleNumber } from './data.js';
import { t } from './i18n/index.js';
import * as B from './basemap.js';
import { infoButton } from './info.js';

// Concept explained by the legend title of each layer (docs/learn.md).
const LEGEND_CONCEPT = { b: 'gutenberg-richter-b-value', q: 'quality-codes', mc: 'magnitude-of-completeness', cc: 'catalogue-consistency', rate: 'rate-m6' };

let map = null;
let C = null; // context: {state, manifest, cells, byId, lookup(id), onSelect, onView, onEventsLoaded}
let region = null; // {meta, data, n, pass} while a regional catalogue is shown
let hoverId = null;
let popup = null;
let events = { e6: null, e5: null, loading5: null, added: false, years: [1904, 2026] };
const tip = () => document.getElementById('tooltip');

function hatchImage() {
  const s = 16;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.strokeStyle = cssVar('--hatch');
  g.lineWidth = 2;
  g.beginPath();
  for (let k = -s; k <= 2 * s; k += 8) { g.moveTo(k, 0); g.lineTo(k - s, s); }
  g.stroke();
  return g.getImageData(0, 0, s, s);
}

export function defaultView() {
  const w = document.getElementById('map').clientWidth || 1000;
  return { z: Math.max(0, +(Math.log2(w / 512) + 0.15).toFixed(2)), lat: 12, lon: 160 };
}

export function initMap(ctx, base) {
  C = ctx;
  const st = C.state;
  const v = st.at || defaultView();
  const bm = B.styleParts();
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        land: { type: 'geojson', data: base.land },
        coast: { type: 'geojson', data: base.coast },
        plates: { type: 'geojson', data: base.plates },
        cells: { type: 'geojson', data: C.cells, promoteId: 'id' },
        ...bm.sources,
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': cssVar('--ocean') } },
        { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': cssVar('--land') } },
        ...bm.layers,
        { id: 'cells-fill', type: 'fill', source: 'cells', paint: { 'fill-color': cssVar('--nodata'), 'fill-opacity': 0 } },
        { id: 'cells-hatch', type: 'fill', source: 'cells', layout: { visibility: 'none' }, paint: { 'fill-pattern': 'hatch' } },
        { id: 'coast', type: 'line', source: 'coast', paint: { 'line-color': cssVar('--coast'), 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 6, 1.1] } },
        { id: 'plates', type: 'line', source: 'plates', paint: { 'line-color': cssVar('--plate'), 'line-opacity': 0.85, 'line-dasharray': [3, 2], 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 6, 1.8] } },
        { id: 'cells-hover', type: 'line', source: 'cells', paint: { 'line-color': cssVar('--ink'), 'line-width': 1.4, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0] } },
        { id: 'cells-sel-case', type: 'line', source: 'cells', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': cssVar('--surface'), 'line-width': 5 } },
        { id: 'cells-sel', type: 'line', source: 'cells', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': cssVar('--ink'), 'line-width': 2.2 } },
      ],
    },
    center: [v.lon, v.lat],
    zoom: v.z,
    minZoom: 0,
    maxZoom: 8,
    renderWorldCopies: true,
    // Rotation and pitch stay off on the flat map; the 3D terrain switch enables them (basemap.js).
    dragRotate: false,
    pitchWithRotate: true,
    touchPitch: false,
    attributionControl: false,
  });
  map.touchZoomRotate.disableRotation();
  // Test hook: the browser tests define this function in an init script before the page loads. Normal visits
  // never define it, so the map object is not exposed on window.
  if (typeof window.__gsaTestHook === 'function') window.__gsaTestHook(map);
  map.on('styleimagemissing', (e) => { if (e.id === 'hatch' && !map.hasImage('hatch')) map.addImage('hatch', hatchImage(), { pixelRatio: 2 }); });

  const canvas = map.getCanvas();
  canvas.setAttribute('aria-label', t('map.canvas'));
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const c = map.project(map.getCenter());
    const hit = cellAt([c.x, c.y]);
    if (hit) C.onSelect(hit.properties.id);
  });

  return new Promise((resolve) => {
    map.on('load', () => {
      if (!map.hasImage('hatch')) map.addImage('hatch', hatchImage(), { pixelRatio: 2 });
      wire();
      B.attach(map, C.state);
      resolve(map);
    });
  });
}

function wire() {
  map.on('moveend', () => {
    const c = map.getCenter();
    C.onView({ z: +map.getZoom().toFixed(2), lat: +c.lat.toFixed(2), lon: +c.lng.toFixed(2) });
  });
  map.on('mousemove', (e) => {
    const evHit = queryEvents(e.point);
    const cell = cellAt(e.point);
    setHover(cell ? { source: cell.source, id: cell.id } : null);
    if (evHit) showTip(e.point, eventTipNode(evHit.properties));
    else if (cell && C.lookup(cell.properties.id)) showTip(e.point, cellTipNode(C.lookup(cell.properties.id)));
    else hideTip();
    map.getCanvas().style.cursor = evHit || cell ? 'pointer' : '';
  });
  map.getCanvas().addEventListener('mouseleave', () => { setHover(null); hideTip(); });
  map.on('click', (e) => {
    hideTip();
    const evHit = queryEvents(e.point);
    if (evHit) { openEventPopup(evHit); return; }
    const cell = cellAt(e.point);
    if (cell) C.onSelect(cell.properties.id);
  });
}

/** The cell under a point: a regional cell when a regional catalogue is shown there, else the global cell. */
function cellAt(pt) {
  if (region && map.getLayer('rcells-fill')) {
    const r = map.queryRenderedFeatures(pt, { layers: ['rcells-fill'] })[0];
    if (r) return r;
  }
  return map.queryRenderedFeatures(pt, { layers: ['cells-fill'] })[0];
}

function queryEvents(pt) {
  if (!map.getLayer('events') || map.getLayoutProperty('events', 'visibility') === 'none') return null;
  const r = 4;
  const hits = map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: ['events'] });
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.properties.m > a.properties.m ? b : a));
}

function setHover(hv) {
  if ((hv && hoverId && hv.id === hoverId.id && hv.source === hoverId.source) || (!hv && !hoverId)) return;
  if (hoverId && map.getSource(hoverId.source)) map.setFeatureState(hoverId, { hover: false });
  hoverId = hv;
  if (hv) map.setFeatureState(hv, { hover: true });
}

function showTip(pt, node) {
  const t = tip();
  t.replaceChildren(node);
  t.hidden = false;
  const view = document.getElementById('map-area');
  const off = 0;
  const W = view.clientWidth, H = view.clientHeight;
  const tw = t.offsetWidth, th = t.offsetHeight;
  let x = pt.x + off + 14, y = pt.y + 14;
  if (x + tw > W - 8) x = pt.x + off - tw - 14;
  if (y + th > H - 8) y = pt.y - th - 14;
  t.style.left = `${Math.max(off + 4, x)}px`;
  t.style.top = `${Math.max(4, y)}px`;
}

export function hideTip() { const t = tip(); if (t) t.hidden = true; }

// ---------- text for cells ----------

/** One line that never shows a b-value without its interval and quality code. */
export function bSentence(p, d, manifest) {
  const q = p[`${d}_q`];
  const nMin = ruleNumber(manifest.method.quality.insufficient);
  if (q === 'A' || q === 'B') return { strong: `b ${f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`])}`, rest: t('tt.bRest', { q }) };
  if (q === 'C') return { strong: t('tt.withheld'), rest: t('tt.withheldC', { w: f.b2(p[`${d}_ciw`]) }) };
  return { strong: t('tt.withheld'), rest: t('tt.withheldFew', { n: f.int(p[`${d}_nb`] || 0), min: nMin }) };
}

function layerSentence(p, st) {
  const d = st.d;
  const sub = st.m;
  switch (st.l) {
    case 'q': {
      const q = p[`${d}_q`];
      return { strong: q === 'insufficient' ? t('q.insufficient') : t('q.quality', { q }), rest: q === 'insufficient' ? t('cmp.nAbove', { n: f.int(p[`${d}_nb`] || 0) }) : t('tt.ciw', { w: f.b2(p[`${d}_ciw`]) }) };
    }
    case 'mc': {
      if ((sub || 'ig') === 'ig') return p[`${d}_mc`] !== undefined ? { strong: `Mc ${f.mag(p[`${d}_mc`])} [${f.mag(p[`${d}_mc_lo`])}, ${f.mag(p[`${d}_mc_hi`])}]`, rest: t('tt.mcIg') } : { strong: t('tt.noMc'), rest: t('tt.noMcIg') };
      const prop = sub === 'cc' ? `${d}_mc_cc` : `${d}_mc_cc0`;
      return p[prop] !== undefined ? { strong: `Mc ${f.mag(p[prop])}`, rest: t(sub === 'cc' ? 'tt.mcCc' : 'tt.mcCc0') } : { strong: t('tt.noMc'), rest: t('tt.noMcCc') };
    }
    case 'cc': {
      if ((sub || 'flag') === 'flag') {
        return { strong: t(`tt.flag.${p.c_flag}`), rest: t('tt.matched', { n: f.int(p.c_n) }) };
      }
      if (sub === 'dmw') return p.c_dmw !== undefined ? { strong: `ΔMw ${f.signed(p.c_dmw)}`, rest: t('tt.dmw', { n: f.int(p.c_n) }) } : { strong: t('tt.noMw'), rest: '' };
      return p.c_dloc !== undefined ? { strong: f.km(p.c_dloc), rest: t('tt.dloc', { n: f.int(p.c_n) }) } : { strong: t('tt.noMatched'), rest: '' };
    }
    case 'rate':
      return { strong: t('tt.rate', { v: f.sig2(p.rate_m6) }), rest: t('tt.rateRest') };
    default:
      return null;
  }
}

function cellTipNode(p) {
  const st = C.state;
  const d = st.d;
  const node = h('div');
  const b = bSentence(p, d, C.manifest);
  const main = st.l === 'b' || st.l === 'none' || p.regionId ? null : layerSentence(p, st);
  const line = (s, cls) => h('div', { class: cls }, h('strong', { text: s.strong }), s.rest ? ` ${s.rest}` : '');
  if (main) node.append(line(main, 'tt-main'));
  node.append(line(b, main ? 'tt-sub' : 'tt-main'));
  if (main || st.l === 'b' || p.regionId) node.append(h('div', { class: 'tt-sub', text: f.depthName(d) }));
  node.append(h('div', { class: 'tt-sub', text: p.regionId ? `${f.latlon(p.lat, p.lon)}, ${p.regionName}` : `${f.latlon(p.lat, p.lon)}, ${f.pbName(p.pb)}` }));
  node.append(h('div', { class: 'tt-foot', text: t(C.state.k && C.state.k !== p.id ? 'tt.clickCompare' : 'tt.click') }));
  return node;
}

// ---------- layers ----------

let currentDef = null;
export function applyLayers() {
  const st = C.state;
  const def = layerDef(st, C.manifest);
  currentDef = def;
  const dark = isDark();
  map.setPaintProperty('cells-fill', 'fill-color', def.fill);
  map.setPaintProperty('cells-fill', 'fill-opacity', def.none ? 0 : ['case', def.valid, def.opacityB ? ['case', ['==', ['get', `${st.d}_q`], 'B'], 0.5, 0.92] : 0.9, 0.22]);
  map.setLayoutProperty('cells-hatch', 'visibility', def.hatch ? 'visible' : 'none');
  if (def.hatch) map.setFilter('cells-hatch', ['==', ['get', `${st.d}_q`], 'C']);
  map.setLayoutProperty('plates', 'visibility', st.pl ? 'visible' : 'none');
  const selIds = ['literal', [st.c, st.k].filter(Boolean)];
  map.setFilter('cells-sel', ['in', ['get', 'id'], selIds]);
  map.setFilter('cells-sel-case', ['in', ['get', 'id'], selIds]);
  applyRegion(st);
  applyEvents();
  B.apply();
  renderLegend(def);
}

export function applyTheme() {
  if (!map) return;
  map.setPaintProperty('bg', 'background-color', cssVar('--ocean'));
  map.setPaintProperty('land', 'fill-color', cssVar('--land'));
  map.setPaintProperty('coast', 'line-color', cssVar('--coast'));
  map.setPaintProperty('plates', 'line-color', cssVar('--plate'));
  map.setPaintProperty('cells-hover', 'line-color', cssVar('--ink'));
  map.setPaintProperty('cells-sel', 'line-color', cssVar('--ink'));
  map.setPaintProperty('cells-sel-case', 'line-color', cssVar('--surface'));
  if (map.hasImage('hatch')) map.updateImage('hatch', hatchImage());
  B.applyTheme();
  if (map.getLayer('rcells-line')) {
    map.setPaintProperty('rcells-line', 'line-color', cssVar('--ink-3'));
    map.setPaintProperty('rcells-hover', 'line-color', cssVar('--ink'));
    map.setPaintProperty('rcells-sel', 'line-color', cssVar('--ink'));
  }
  if (map.getLayer('events')) {
    map.setPaintProperty('events', 'circle-color', cssVar('--ink'));
    map.setPaintProperty('events', 'circle-stroke-color', cssVar('--surface'));
  }
  applyLayers();
}

export function setProjection(globe) {
  if (!map) return;
  map.setProjection({ type: globe ? 'globe' : 'mercator' });
  // Outside the globe the canvas is transparent; a darker backdrop than the ocean makes the globe edge visible.
  document.getElementById('map-area').classList.toggle('globe', !!globe);
}

/** Pan so a selected cell is not hidden behind the detail panel. */
export function revealCell(lon, lat) {
  if (!map) return;
  const c = map.getCenter().lng;
  while (lon - c > 180) lon -= 360;
  while (c - lon > 180) lon += 360;
  const box = map.getContainer();
  const pt = map.project([lon, lat]);
  const panel = document.getElementById('panel');
  if (innerWidth > 720) {
    if (pt.x > box.clientWidth - 20 || pt.x < 20 || pt.y < 20 || pt.y > box.clientHeight - 20) map.easeTo({ center: [lon, lat], duration: 400 });
  } else {
    const sh = panel.offsetHeight;
    if (pt.y > box.clientHeight - sh - 20 || pt.y < 0) map.easeTo({ center: [lon, lat], offset: [0, -sh / 2], duration: 400 });
  }
}

export function resize() { if (map) map.resize(); }

export function flyTo(lon, lat, z) { if (map) map.flyTo({ center: [lon, lat], zoom: z, essential: true }); }

// ---------- legend ----------

function renderLegend(def) {
  const el = document.getElementById('legend');
  const st = C.state;
  const counts = new Map();
  for (const ft of C.cells.features) {
    const k = def.classify(ft.properties);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const kids = [];
  const lgConcept = LEGEND_CONCEPT[st.l];
  kids.push(h('div', { class: 'lg-head' }, h('span', { class: 'lg-title' }, def.title, lgConcept && !def.none ? infoButton(lgConcept) : null), def.depthAware ? h('span', { class: 'lg-depth', text: t(`depth.${st.d}.label`) }) : h('span', { class: 'lg-depth', text: def.none ? '' : t('lg.allDepths') })));
  if (def.none) kids.push(h('p', { class: 'lg-unit', text: t('lg.none') }));
  else kids.push(h('p', { class: 'lg-unit', text: def.unit }));
  if (def.bar) {
    const n = def.bar.colors.length;
    kids.push(h('div', { class: 'lg-bar', style: `grid-template-columns:repeat(${n},minmax(0,1fr))`, 'aria-hidden': 'true' }, def.bar.colors.map((c) => h('div', { style: `background:${c}` }))));
    if (def.bar.labels) {
      kids.push(h('div', { class: 'lg-ticks', style: `grid-template-columns:repeat(${n},minmax(0,1fr))` }, def.bar.labels.map((l) => h('span', { text: l }))));
    } else {
      const t = h('div', { class: 'lg-ticks', style: 'position:relative;height:14px;display:block' });
      def.bar.breaks.forEach((b, i) => t.append(h('span', { style: `position:absolute;left:${((i + 1) / n) * 100}%;transform:translateX(-50%)`, text: f.fixed(b, def.bar.d) })));
      kids.push(t);
    }
    kids.push(h('p', { class: 'sr-only', text: t('lg.classes', { first: def.bar.breaks[0], mid: def.bar.breaks.slice(0, -1).map((b, i) => `${b}–${def.bar.breaks[i + 1]}`).join(', '), last: def.bar.breaks[def.bar.breaks.length - 1] }) }));
  }
  if (def.items.length) {
    kids.push(h('ul', { class: 'lg-rows' }, def.items.map((it) => h('li', {},
      it.swatch ? h('span', { class: `sw sw-${it.swatch}`, 'aria-hidden': 'true' }) : h('span', { class: 'sw', style: `background:${it.color};${it.op ? `opacity:${it.op}` : ''}`, 'aria-hidden': 'true' }),
      h('span', { text: it.label }),
      h('span', { class: 'cnt', text: f.int(counts.get(it.key) || 0) })))));
  }
  if (def.passKeys) {
    const pass = def.passKeys.reduce((s, k) => s + (counts.get(k) || 0), 0);
    kids.push(h('span', { class: 'lg-count', text: t('lg.pass', { pass: f.int(pass), n: f.int(C.cells.features.length) }) }));
  } else if (def.note) kids.push(h('span', { class: 'lg-count', text: def.note }));
  const extra = [];
  if (st.pl) extra.push(h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('span', { class: 'sw sw-line', 'aria-hidden': 'true' }), h('span', {}, t('lg.plates'), infoButton('plate-boundary-classes'))));
  if (st.ev) {
    const sizes = [6, 7, 8, 9].map((m) => {
      const r = radiusFor(m, map.getZoom());
      return h('span', {}, h('i', { style: `width:${2 * r}px;height:${2 * r}px` }), `M${m}`);
    });
    extra.push(h('span', {}, `${t('lg.quakes')} ${evCountText()}`, infoButton('magnitude-types')), h('div', { class: 'lg-sizes', 'aria-hidden': 'true' }, sizes));
  }
  if (region) {
    const r = region.meta;
    extra.push(h('div', { class: 'lg-region' },
      h('strong', {}, t('reg.legendHead', { name: r.name }), infoButton('regional-catalogues')),
      h('span', { text: t('reg.legend', { catalogue: r.catalogue, licence: r.licence, p0: (r.period || [])[0] ?? '–', p1: (r.period || [])[1] ?? '–', mc: r.mc_typical ?? '–' }) }),
      st.l !== 'b' ? h('span', { text: t('reg.alwaysB') }) : null,
      r.attribution ? h('span', { text: `${t('reg.attribution')}: ${r.attribution}` }) : null,
      r.caveat ? h('span', { text: `${t('reg.caveat')}: ${r.caveat}` }) : null,
      h('span', { class: 'lg-count', text: t('reg.cells', { n: f.int(region.n), pass: f.int(region.pass) }) })));
  }
  if (extra.length) kids.push(h('div', { class: 'lg-extra' }, extra));
  el.classList.toggle('has-bar', !!def.bar);
  el.replaceChildren(...kids);
}

export function zoomBy(dz) { if (map) map.easeTo({ zoom: map.getZoom() + dz, duration: 250 }); }

// ---------- events ----------

const RADIUS_STOPS = [[5, 1.3], [6, 2.2], [7, 4], [8, 7], [9, 12]];
function radiusFor(m, z) {
  let r = RADIUS_STOPS[0][1];
  for (let i = 1; i < RADIUS_STOPS.length; i++) {
    const [m0, r0] = RADIUS_STOPS[i - 1], [m1, r1] = RADIUS_STOPS[i];
    if (m >= m0 && m <= m1) r = r0 + ((m - m0) / (m1 - m0)) * (r1 - r0);
    if (m > m1) r = r1;
  }
  return r * (z > 3 ? 1.6 : 1);
}

function radiusExpr(k) {
  const e = ['interpolate', ['linear'], ['get', 'm']];
  for (const [m, r] of RADIUS_STOPS) e.push(m, r * k);
  return e;
}

function eventsGeoJSON() {
  const feats = [];
  const add = (e, k, keep) => {
    for (let i = 0; i < e.n; i++) {
      if (keep && !keep(i)) continue;
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon[i], e.lat[i]] }, properties: { m: e.mag[i], d: e.depth[i], y: e.year[i], s: e.src[i], t: e.mt[i], k, i } });
    }
  };
  add(events.e6, 6);
  if (events.e5) add(events.e5, 5, (i) => events.e5.mag[i] < 6);
  return { type: 'FeatureCollection', features: feats };
}

export function preloadM6() {
  return getJSON('events_m6.json').then((e6) => {
    events.e6 = e6;
    events.years = [Math.floor(Math.min(...e6.year)), Math.floor(Math.max(...e6.year))];
    C.onEventsLoaded(events);
    return e6;
  });
}

export function loadM5() {
  if (events.e5) return Promise.resolve(events.e5);
  if (!events.loading5) {
    events.loading5 = getJSON('events_m5.json').then((e5) => {
      events.e5 = e5;
      if (events.added) map.getSource('events').setData(eventsGeoJSON());
      return e5;
    }).catch((e) => { events.loading5 = null; throw e; });
  }
  return events.loading5;
}

function ensureEventsLayer() {
  if (events.added || !events.e6) return;
  map.addSource('events', { type: 'geojson', data: eventsGeoJSON() });
  map.addLayer({
    id: 'events', type: 'circle', source: 'events',
    layout: { 'circle-sort-key': ['get', 'm'] },
    paint: {
      'circle-color': cssVar('--ink'),
      'circle-opacity': ['case', ['==', ['get', 'k'], 5], 0.38, 0.6],
      'circle-stroke-color': cssVar('--surface'),
      'circle-stroke-width': 0.6,
      'circle-stroke-opacity': 0.9,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, radiusExpr(0.85), 3, radiusExpr(1), 6, radiusExpr(1.8)],
    },
  }, 'cells-hover');
  events.added = true;
  map.on('zoomend', () => { if (C.state.ev) renderLegend(currentDef); });
}

export function eventFilterValues() {
  const st = C.state;
  const minM = st.ev === 5 ? Math.max(5, st.mm) : Math.max(6, st.mm);
  return { y0: st.y0 ?? events.years[0], y1: st.y1 ?? events.years[1], minM };
}

function evCountText() {
  if (!events.e6) return '';
  const { y0, y1, minM } = eventFilterValues();
  let n = 0;
  const count = (e, keep) => { for (let i = 0; i < e.n; i++) if (e.year[i] >= y0 && e.year[i] < y1 + 1 && e.mag[i] >= minM && (!keep || keep(i))) n++; };
  count(events.e6);
  if (C.state.ev === 5 && events.e5) count(events.e5, (i) => events.e5.mag[i] < 6);
  return t('ev.count', { n: f.int(n), y0, y1, m: minM.toFixed(1) });
}

export function eventCountText() { return evCountText(); }

function applyEvents() {
  const st = C.state;
  if (!st.ev || !events.e6) {
    if (map.getLayer('events')) map.setLayoutProperty('events', 'visibility', 'none');
    return;
  }
  ensureEventsLayer();
  const { y0, y1, minM } = eventFilterValues();
  map.setLayoutProperty('events', 'visibility', 'visible');
  map.setFilter('events', ['all', ['>=', ['get', 'y'], y0], ['<', ['get', 'y'], y1 + 1], ['>=', ['get', 'm'], minM], st.ev === 5 ? true : ['==', ['get', 'k'], 6]]);
}

function eventTipNode(p) {
  const codes = (events.e6 || {}).codes || { src: {}, mt: {} };
  return h('div', {},
    h('div', { class: 'tt-main' }, h('strong', { text: `M ${f.mag(p.m)}` }), ` ${f.decYearDate(p.y)}`),
    h('div', { class: 'tt-sub', text: t('ev.depthLine', { d: f.int(p.d), mt: codes.mt[String(p.t)] || '' }) }),
    h('div', { class: 'tt-foot', text: t('ev.clickLink') }));
}

function openEventPopup(hit) {
  const p = hit.properties;
  const e = p.k === 6 ? events.e6 : events.e5;
  const codes = events.e6.codes;
  // events_m5.json may or may not carry the id column (same meaning as in events_m6.json); link when it does
  const id = Array.isArray(e.id) && e.id[p.i] ? String(e.id[p.i]) : null;
  const node = h('div', { class: 'ev-pop' },
    h('h3', { text: t('ev.title', { m: f.mag(p.m) }) }),
    h('dl', {},
      h('dt', { text: t('ev.date') }), h('dd', { text: t('ev.dateVal', { d: f.decYearDate(p.y) }) }),
      h('dt', { text: t('ev.depth') }), h('dd', { text: `${f.int(p.d)} km` }),
      h('dt', { text: t('ev.location') }), h('dd', { text: f.latlon(e.lat[p.i], e.lon[p.i]) }),
      h('dt', { text: t('ev.magnitude') }), h('dd', { text: codes.mt[String(p.t)] || '' }),
      h('dt', { text: t('ev.in') }), h('dd', { text: codes.src[String(p.s)] || '' })),
    id
      ? h('a', { href: `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(id)}`, target: '_blank', rel: 'noopener', text: t('ev.usgs', { id }) })
      : h('p', { class: 'muted', style: 'margin:0', text: t(p.k === 5 ? 'ev.noIdM5' : 'ev.noId') }));
  if (popup) popup.remove();
  popup = new maplibregl.Popup({ closeButton: true, maxWidth: '290px', focusAfterOpen: true })
    .setLngLat(hit.geometry.coordinates).setDOMContent(node).addTo(map);
}

// ---------- regional catalogues ----------

const R_LAYERS = ['rcells-fill', 'rcells-hatch', 'rcells-line', 'rcells-hover', 'rcells-sel'];

/** Show a regional catalogue's cells (same property names as cells.geojson). meta: one entry of regional/index.json. */
export function setRegion(meta, data, classify) {
  const feats = data.features || [];
  region = { meta, data, n: feats.length, pass: feats.filter((ft) => classify(ft.properties)).length };
  if (map.getSource('rcells')) map.getSource('rcells').setData(data);
  else {
    map.addSource('rcells', { type: 'geojson', data, promoteId: 'id' });
    const before = 'coast';
    map.addLayer({ id: 'rcells-fill', type: 'fill', source: 'rcells', paint: { 'fill-color': cssVar('--nodata'), 'fill-opacity': 0.9 } }, before);
    map.addLayer({ id: 'rcells-hatch', type: 'fill', source: 'rcells', paint: { 'fill-pattern': 'hatch' } }, before);
    map.addLayer({ id: 'rcells-line', type: 'line', source: 'rcells', paint: { 'line-color': cssVar('--ink-3'), 'line-width': 0.6, 'line-opacity': 0.55 } }, before);
    map.addLayer({ id: 'rcells-hover', type: 'line', source: 'rcells', paint: { 'line-color': cssVar('--ink'), 'line-width': 1.4, 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0] } });
    map.addLayer({ id: 'rcells-sel', type: 'line', source: 'rcells', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': cssVar('--ink'), 'line-width': 2.2 } });
  }
  for (const id of R_LAYERS) map.setLayoutProperty(id, 'visibility', 'visible');
  applyLayers();
}

export function clearRegion() {
  region = null;
  if (map && map.getSource('rcells')) for (const id of R_LAYERS) map.setLayoutProperty(id, 'visibility', 'none');
  if (map) applyLayers();
}

export function fitBbox([w, s, e, n]) {
  if (!map) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // keep the region clear of the legend card (bottom left on desktop, top left on phones)
  const wide = innerWidth > 720;
  const legend = document.getElementById('legend');
  const lw = legend ? legend.offsetWidth + 32 : 40;
  map.fitBounds([[w, s], [e, n]], { padding: { top: wide ? 40 : 60, bottom: 40, left: wide ? Math.min(lw, map.getContainer().clientWidth / 2) : 40, right: wide ? 80 : 40 }, maxZoom: 7, duration: reduce ? 0 : 900 });
}

/** Regional cells always use the b-value classes and the same quality rules as the global b layer. */
function applyRegion(st) {
  if (!region || !map.getLayer('rcells-fill')) return;
  const def = layerDef({ ...st, l: 'b', m: '' }, C.manifest);
  map.setPaintProperty('rcells-fill', 'fill-color', def.fill);
  map.setPaintProperty('rcells-fill', 'fill-opacity', ['case', def.valid, ['case', ['==', ['get', `${st.d}_q`], 'B'], 0.5, 0.92], 0.22]);
  map.setFilter('rcells-hatch', ['==', ['get', `${st.d}_q`], 'C']);
  map.setFilter('rcells-sel', ['in', ['get', 'id'], ['literal', [st.c, st.k].filter(Boolean)]]);
}

/** Re-apply the strings that live on the map canvas after a language change. */
export function relabel() {
  if (map) map.getCanvas().setAttribute('aria-label', t('map.canvas'));
  B.relabel();
}
