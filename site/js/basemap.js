// Base map extras: self-hosted relief and water (default on) and optional 3D terrain from AWS Terrain Tiles
// (default off, the only external tile source). Layers sit under the cells, so a cell's colour is never changed by
// the base map. Sources, licences and sizes: docs/basemap.md.

import { cssVar, isDark } from './layers.js';
import { getJSON } from './data.js';
import { h } from './charts.js';
import { t } from './i18n/index.js';
import { defineKeys, commit, intIn } from './hashx.js';

defineKeys([
  { key: 'rl', def: 1, parse: intIn(0, 1) },
  { key: 'tr', def: 0, parse: intIn(0, 1) },
]);

export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRAIN_EXAGGERATION = 3;
export const TERRAIN_PITCH = 55;
// Required attribution for Terrain Tiles (tilezen/joerd docs/attribution.md), quoted verbatim.
const TERRAIN_ATTRIBUTION = [
  'ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736;',
  'Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017;',
  'Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich;',
  'Canada terrain data contains information licensed under the Open Government Licence – Canada;',
  'Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers;',
  'Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration',
  'Mexico terrain data source: INEGI, Continental relief, 2016;',
  'New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved);',
  'Norway terrain data © Kartverket;',
  'United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved;',
  'United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey.',
];

const EMPTY_FC = { type: 'FeatureCollection', features: [] };
// 1 x 1 transparent PNG, returned for tiles that hold no relief (ocean, flat land), so nothing is requested for them
const EMPTY_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0)).buffer;

let map = null;
let state = null;
let reliefIndex = null; // Promise<Set<'z/x/y'>>
let waterLoaded = false;
let terrainAdded = false;
let terrainOn = false;

function loadIndex() {
  if (!reliefIndex) {
    reliefIndex = getJSON('basemap/relief/index.json').then((idx) => new Set(idx.tiles)).catch(() => new Set());
  }
  return reliefIndex;
}

let protocolAdded = false;
function addProtocol() {
  if (protocolAdded) return;
  protocolAdded = true;
  maplibregl.addProtocol('gsarelief', async (params, abort) => {
    const key = params.url.replace('gsarelief://', '');
    const have = await loadIndex();
    if (!have.has(key)) return { data: EMPTY_PNG };
    const r = await fetch(`data/basemap/relief/${key}.webp`, { signal: abort.signal });
    if (!r.ok) return { data: EMPTY_PNG };
    return { data: await r.arrayBuffer() };
  });
}

/** Sources and layers for the initial style. They go between the land fill and the cells. */
export function styleParts() {
  addProtocol();
  loadIndex();
  return {
    sources: {
      relief: { type: 'raster', tiles: ['gsarelief://{z}/{x}/{y}'], tileSize: 256, minzoom: 0, maxzoom: 4 },
      water: { type: 'geojson', data: EMPTY_FC },
    },
    layers: [
      { id: 'relief', type: 'raster', source: 'relief', paint: reliefPaint() },
      { id: 'lakes', type: 'fill', source: 'water', filter: ['==', ['get', 'k'], 'l'], paint: { 'fill-color': cssVar('--ocean'), 'fill-outline-color': waterLine() } },
      { id: 'rivers', type: 'line', source: 'water', filter: ['==', ['get', 'k'], 'r'], layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': waterLine(), 'line-opacity': 0.8, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.8, 8, 1.4] } },
    ],
  };
}

function reliefPaint() {
  return { 'raster-opacity': isDark() ? 0.7 : 0.6, 'raster-fade-duration': 0, 'raster-resampling': 'linear' };
}
function waterLine() { return cssVar('--water-line') || (isDark() ? '#3f4c57' : '#a7b5bf'); }

export function attach(m, st) {
  map = m;
  state = st;
  mountControls();
  mountAttribution();
  relabel();
}

function $(id) { return document.getElementById(id); }

function mountControls() {
  if ($('bm-group')) return;
  const rail = $('controls');
  const before = rail.querySelector('.stat-window');
  const group = h('fieldset', { class: 'group', id: 'bm-group' },
    h('legend', { class: 'group-title', id: 'bm-title' }),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'chk-relief' }), h('span', { id: 'lbl-relief' })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'chk-terrain' }), h('span', { id: 'lbl-terrain' })),
    h('p', { class: 'hint', id: 'bm-hint' }));
  rail.insertBefore(group, before);
  $('chk-relief').addEventListener('change', (e) => { state.rl = e.target.checked ? 1 : 0; apply(); commit(); });
  $('chk-terrain').addEventListener('change', (e) => { state.tr = e.target.checked ? 1 : 0; apply(); commit(); });
  relabel();
}

function mountAttribution() {
  if ($('attrib-terrain')) return;
  const box = h('div', { class: 'attrib-terrain', id: 'attrib-terrain', hidden: true },
    h('span', { id: 'attrib-terrain-short' }), ' ',
    h('button', { type: 'button', class: 'link-btn', id: 'attrib-terrain-more', 'aria-expanded': 'false', 'aria-controls': 'attrib-terrain-list' }),
    h('ul', { id: 'attrib-terrain-list', hidden: true }, TERRAIN_ATTRIBUTION.map((s) => h('li', { text: s }))));
  $('map-area').append(box);
  $('attrib-terrain-more').addEventListener('click', () => {
    const list = $('attrib-terrain-list');
    list.hidden = !list.hidden;
    $('attrib-terrain-more').setAttribute('aria-expanded', String(!list.hidden));
  });
}

export function relabel() {
  if (!$('bm-group')) return;
  $('bm-title').textContent = t('bm.group');
  $('lbl-relief').textContent = t('bm.relief');
  $('lbl-terrain').textContent = t('bm.terrain');
  $('bm-hint').textContent = t(state && state.tr ? 'bm.terrainOnHint' : 'bm.hint');
  if ($('attrib-terrain-short')) {
    $('attrib-terrain-short').textContent = t('bm.terrainAttrib');
    $('attrib-terrain-more').textContent = t('bm.terrainAttribMore');
  }
}

function ensureWater() {
  if (waterLoaded) return;
  waterLoaded = true;
  getJSON('basemap/water.geojson').then((fc) => { if (map.getSource('water')) map.getSource('water').setData(fc); })
    .catch(() => { waterLoaded = false; });
}

function ensureTerrainSource() {
  if (terrainAdded) return;
  terrainAdded = true;
  map.addSource('dem', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, minzoom: 0, maxzoom: 10 });
  map.addLayer({ id: 'terrain-shade', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: hillshadePaint() }, 'lakes');
}

function hillshadePaint() {
  const dark = isDark();
  return {
    'hillshade-exaggeration': dark ? 0.35 : 0.4,
    'hillshade-shadow-color': dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,36,30,0.45)',
    'hillshade-highlight-color': dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)',
    'hillshade-accent-color': dark ? 'rgba(0,0,0,0.2)' : 'rgba(40,36,30,0.15)',
  };
}

/** Apply relief, water and terrain from the state (rl, tr). Called from applyLayers on every change. */
export function apply() {
  if (!map || !state) return;
  const rl = !!state.rl, tr = !!state.tr;
  $('chk-relief').checked = rl;
  $('chk-terrain').checked = tr;
  if (rl) ensureWater();
  if (tr) ensureTerrainSource();
  const vis = (on) => (on ? 'visible' : 'none');
  // With 3D terrain on, the hillshade comes from the same elevation tiles (sharper when zoomed in) instead of
  // the Natural Earth relief, so the relief is never drawn twice.
  map.setLayoutProperty('relief', 'visibility', vis(rl && !tr));
  if (map.getLayer('terrain-shade')) map.setLayoutProperty('terrain-shade', 'visibility', vis(rl && tr));
  map.setLayoutProperty('lakes', 'visibility', vis(rl));
  map.setLayoutProperty('rivers', 'visibility', vis(rl));
  if (tr !== terrainOn) setTerrain(tr);
  $('attrib-terrain').hidden = !tr;
  $('bm-hint').textContent = t(tr ? 'bm.terrainOnHint' : 'bm.hint');
}

function setTerrain(on) {
  terrainOn = on;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (on) {
    map.setTerrain({ source: 'dem', exaggeration: TERRAIN_EXAGGERATION });
    map.dragRotate.enable();
    map.touchPitch.enable();
    map.touchZoomRotate.enableRotation();
    map.easeTo({ pitch: TERRAIN_PITCH, duration: reduce ? 0 : 600 });
  } else {
    map.setTerrain(null);
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.touchZoomRotate.disableRotation();
    map.easeTo({ pitch: 0, bearing: 0, duration: reduce ? 0 : 400 });
  }
}

export function applyTheme() {
  if (!map) return;
  for (const [k, v] of Object.entries(reliefPaint())) map.setPaintProperty('relief', k, v);
  map.setPaintProperty('lakes', 'fill-color', cssVar('--ocean'));
  map.setPaintProperty('lakes', 'fill-outline-color', waterLine());
  map.setPaintProperty('rivers', 'line-color', waterLine());
  if (map.getLayer('terrain-shade')) for (const [k, v] of Object.entries(hillshadePaint())) map.setPaintProperty('terrain-shade', k, v);
}
