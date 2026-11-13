// App shell: state in the URL hash, routing between views, controls, theme.

import { getJSON, mb } from './data.js';
import * as M from './map.js';
import { renderPanel, renderCellList } from './panel.js';
import { renderSequences, renderMethods, renderAbout } from './pages.js';
import { SUBS, LAYER_NAMES } from './layers.js';
import * as f from './fmt.js';
import { h } from './charts.js';

const VIEWS = ['map', 'sequences', 'methods', 'about'];
const LAYERS = ['b', 'q', 'mc', 'cc', 'rate', 'none'];
const DEFAULTS = { v: 'map', l: 'b', m: '', d: 'sh', c: null, ev: 0, y0: null, y1: null, mm: 6, pl: 1, g: 0, at: null };

const state = { ...DEFAULTS };
const ctx = { state, manifest: null, cells: null, byId: new Map() };
const rendered = new Set();
let mapReady = false;

// ---------------------------------------------------------------- hash state

function parseHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const s = { ...DEFAULTS };
  if (VIEWS.includes(p.get('v'))) s.v = p.get('v');
  if (LAYERS.includes(p.get('l'))) s.l = p.get('l');
  const subOk = (SUBS[s.l] || []).some((x) => x.id === p.get('m'));
  s.m = subOk ? p.get('m') : '';
  if (['sh', 'dp'].includes(p.get('d'))) s.d = p.get('d');
  if (/^([0-9a-f]{15}|list)$/.test(p.get('c') || '')) s.c = p.get('c');
  if (['5', '6'].includes(p.get('ev'))) s.ev = +p.get('ev');
  const y = (p.get('y') || '').match(/^(\d{4})-(\d{4})$/);
  if (y && +y[1] <= +y[2]) { s.y0 = +y[1]; s.y1 = +y[2]; }
  const mm = +p.get('mm');
  if (mm >= 5 && mm <= 9) s.mm = mm;
  if (p.get('pl') === '0') s.pl = 0;
  if (p.get('g') === '1') s.g = 1;
  const at = (p.get('at') || '').split('/').map(Number);
  if (at.length === 3 && at.every(Number.isFinite) && Math.abs(at[1]) <= 85) s.at = { z: at[0], lat: at[1], lon: at[2] };
  return s;
}

function hashOf(s) {
  const p = new URLSearchParams();
  p.set('v', s.v);
  p.set('l', s.l);
  if (s.m) p.set('m', s.m);
  p.set('d', s.d);
  if (s.c) p.set('c', s.c);
  if (s.ev) p.set('ev', String(s.ev));
  if (s.ev && s.y0 !== null) p.set('y', `${s.y0}-${s.y1}`);
  if (s.ev && s.mm !== DEFAULTS.mm) p.set('mm', String(s.mm));
  if (!s.pl) p.set('pl', '0');
  if (s.g) p.set('g', '1');
  if (s.at) p.set('at', `${s.at.z}/${s.at.lat}/${s.at.lon}`);
  return `#${p.toString().replace(/%2F/g, '/')}`;
}

let writing = false;
function commit(push = false) {
  const hs = hashOf(state);
  if (hs === location.hash) return;
  writing = true;
  history[push ? 'pushState' : 'replaceState'](null, '', hs);
  writing = false;
}

window.addEventListener('hashchange', () => { if (!writing) applyHash(); });
window.addEventListener('popstate', () => applyHash());

function applyHash() {
  const s = parseHash();
  const viewChanged = s.v !== state.v;
  const atChanged = JSON.stringify(s.at) !== JSON.stringify(state.at);
  Object.assign(state, s);
  syncControls();
  showView(state.v);
  if (mapReady) {
    M.applyLayers();
    M.setProjection(!!state.g);
    if (atChanged && state.at) M.flyTo(state.at.lon, state.at.lat, state.at.z);
    if (state.ev) ensureEvents();
    syncPanel();
  }
  if (viewChanged) window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- views

function showView(v) {
  for (const id of VIEWS) document.getElementById(`view-${id}`).hidden = id !== v;
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.view === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.getElementById('nav').classList.remove('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
  const titles = { map: 'Global Seismicity Atlas', sequences: 'Aftershock sequences', methods: 'Validation', about: 'About and data' };
  document.title = v === 'map' ? titles.map : `${titles[v]} | Global Seismicity Atlas`;
  if (!ctx.manifest) return;
  if (v === 'map') { M.resize(); return; }
  if (rendered.has(v)) return;
  rendered.add(v);
  const pageCtx = { manifest: ctx.manifest, showOnMap };
  if (v === 'sequences') renderSequences(document.getElementById('seq-root'), pageCtx);
  if (v === 'methods') renderMethods(document.getElementById('methods-root'), pageCtx);
  if (v === 'about') renderAbout(document.getElementById('about-root'), pageCtx);
}

function showOnMap(s) {
  const yr = +s.time.slice(0, 4);
  Object.assign(state, { v: 'map', ev: state.ev || 6, y0: yr, y1: yr, at: { z: 4, lat: +s.lat.toFixed(2), lon: +s.lon.toFixed(2) } });
  commit(true);
  applyHash();
  M.flyTo(s.lon, s.lat, 4);
}

// ---------------------------------------------------------------- controls

const $ = (id) => document.getElementById(id);

function syncControls() {
  document.querySelectorAll('input[name=layer]').forEach((i) => { i.checked = i.value === state.l; });
  const subs = SUBS[state.l];
  const sel = $('sub-select');
  if (subs) {
    sel.hidden = false;
    sel.replaceChildren(...subs.map((s) => h('option', { value: s.id, text: s.label })));
    sel.value = state.m || subs[0].id;
    sel.setAttribute('aria-label', `${LAYER_NAMES[state.l]}: variant`);
  } else sel.hidden = true;
  const depthAware = !['cc', 'rate', 'none'].includes(state.l);
  document.querySelectorAll('input[name=depth]').forEach((i) => { i.checked = i.value === state.d; i.disabled = !depthAware; });
  $('depth-hint').hidden = depthAware;
  $('depth-hint').textContent = state.l === 'none' ? 'Depth applies to the cell layers and the cell details.' : 'This layer uses all depths. The depth still applies to the cell details.';
  $('chk-plates').checked = !!state.pl;
  $('chk-events').checked = !!state.ev;
  $('chk-m5').checked = state.ev === 5;
  $('globe-btn').setAttribute('aria-pressed', String(!!state.g));
  $('events-opts').hidden = !state.ev;
  document.querySelectorAll('#chips [data-layer]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.layer === state.l)));
  $('chip-depth').textContent = state.d === 'sh' ? 'Shallow' : 'Deeper';
  $('chip-depth').setAttribute('aria-label', `Depth: ${state.d === 'sh' ? 'shallow, 70 km or less' : 'deeper than 70 km'}. Activate to switch.`);
  syncEventControls();
}

let evYears = [1904, 2026];
function syncEventControls() {
  const [a, b] = evYears;
  const y0 = state.y0 ?? a, y1 = state.y1 ?? b;
  for (const [id, v] of [['yr0', y0], ['yr1', y1]]) {
    const el = $(id);
    el.min = a; el.max = b; el.step = 1; el.value = v;
    $(`${id}-out`).textContent = String(v);
  }
  const minM = state.ev === 5 ? 5 : 6;
  $('mmin').min = minM;
  const mm = Math.max(minM, state.mm);
  $('mmin').value = mm;
  $('mmin-out').textContent = mm.toFixed(1);
  $('ev-count').textContent = state.ev ? M.eventCountText() : '';
  const m5 = ctx.manifest && ctx.manifest.files['events_m5.json'];
  if (m5) {
    $('lbl-m6').textContent = `Events M ≥ 6 (${f.int(ctx.manifest.events['events_m6.json'].n)})`;
    $('lbl-m5').textContent = `Events M ≥ 5 (${f.int(ctx.manifest.events['events_m5.json'].n)}, ${mb(m5.bytes)}, loads on demand)`;
  }
}

function wireControls() {
  document.querySelectorAll('input[name=layer]').forEach((i) => i.addEventListener('change', () => {
    state.l = i.value; state.m = ''; update();
  }));
  $('sub-select').addEventListener('change', (e) => { state.m = e.target.value; update(); });
  document.querySelectorAll('input[name=depth]').forEach((i) => i.addEventListener('change', () => { state.d = i.value; update(); }));
  $('chk-plates').addEventListener('change', (e) => { state.pl = e.target.checked ? 1 : 0; update(); });
  $('globe-btn').addEventListener('click', () => { state.g = state.g ? 0 : 1; M.setProjection(!!state.g); update(); });
  $('zoom-in').addEventListener('click', () => M.zoomBy(1));
  $('zoom-out').addEventListener('click', () => M.zoomBy(-1));
  $('chk-events').addEventListener('change', (e) => { state.ev = e.target.checked ? 6 : 0; update(); ensureEvents(); });
  $('chk-m5').addEventListener('change', (e) => { state.ev = e.target.checked ? 5 : (state.ev ? 6 : 0); state.mm = e.target.checked ? 5 : Math.max(6, state.mm); update(); ensureEvents(); });
  document.querySelectorAll('#chips [data-layer]').forEach((c) => c.addEventListener('click', () => { state.l = c.dataset.layer; state.m = ''; update(); }));
  $('chip-depth').addEventListener('click', () => { state.d = state.d === 'sh' ? 'dp' : 'sh'; update(); });
  $('chip-more').addEventListener('click', () => {
    const open = !$('controls').classList.contains('open');
    $('controls').classList.toggle('open', open);
    $('chip-more').setAttribute('aria-expanded', String(open));
  });
  const yr = () => {
    let y0 = +$('yr0').value, y1 = +$('yr1').value;
    if (y0 > y1) { if (document.activeElement === $('yr0')) y1 = y0; else y0 = y1; }
    state.y0 = y0; state.y1 = y1;
    if (y0 === evYears[0] && y1 === evYears[1]) { state.y0 = null; state.y1 = null; }
    update();
  };
  $('yr0').addEventListener('input', yr);
  $('yr1').addEventListener('input', yr);
  $('mmin').addEventListener('input', (e) => { state.mm = +e.target.value; update(); });
  $('menu-btn').addEventListener('click', () => {
    const open = !$('nav').classList.contains('open');
    $('nav').classList.toggle('open', open);
    $('menu-btn').setAttribute('aria-expanded', String(open));
  });
  $('panel-close').addEventListener('click', closePanel);
  $('list-btn').addEventListener('click', () => { state.c = 'list'; update(); $('panel').focus({ preventScroll: true }); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('panel').hidden && state.v === 'map') closePanel(); });
}

function update() {
  syncControls();
  if (mapReady) M.applyLayers();
  syncPanel();
  commit();
}

function ensureEvents() {
  if (state.ev === 5) {
    $('ev-count').textContent = 'Loading M5 events…';
    $('chk-m5').disabled = true;
    M.loadM5().then(() => { if (mapReady) M.applyLayers(); syncEventControls(); })
      .catch((e) => { $('ev-count').textContent = `${e.message} Showing M6 and above.`; state.ev = 6; commit(); if (mapReady) M.applyLayers(); })
      .finally(() => { $('chk-m5').disabled = false; syncControls(); });
  }
}

// ---------------------------------------------------------------- panel

let panelFor = null;
function syncPanel() {
  if (state.c === 'list' && ctx.cells) {
    const key = `list|${state.d}`;
    if (key === panelFor) return;
    panelFor = key;
    renderCellList([...ctx.byId.values()], { state, onOpen: selectCell });
    M.resize();
    return;
  }
  if (!state.c || !ctx.byId.has(state.c)) {
    if (!$('panel').hidden) { $('panel').hidden = true; M.resize(); }
    panelFor = null;
    return;
  }
  const key = `${state.c}|${state.d}`;
  if (key === panelFor) return;
  panelFor = key;
  renderPanel(ctx.byId.get(state.c), { state, manifest: ctx.manifest });
  M.resize();
}

function selectCell(id) {
  state.c = id;
  update();
  const p = ctx.byId.get(id);
  if (p) M.revealCell(p.lon, p.lat);
  $('panel').focus({ preventScroll: true });
}

function closePanel() {
  state.c = null;
  update();
  M.hideTip();
}

// ---------------------------------------------------------------- theme

const THEMES = ['auto', 'light', 'dark'];
function currentTheme() { return document.documentElement.dataset.theme || 'auto'; }
function setTheme(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { if (t === 'auto') localStorage.removeItem('gsa-theme'); else localStorage.setItem('gsa-theme', t); } catch (e) { /* storage blocked */ }
  const lab = { auto: 'automatic', light: 'light', dark: 'dark' }[t];
  $('theme-btn').setAttribute('aria-label', `Colour theme: ${lab}. Activate to change.`);
  $('theme-btn').title = `Theme: ${lab}`;
  $('theme-label').textContent = lab;
  M.applyTheme();
}
$('theme-btn').addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % 3]));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (currentTheme() === 'auto') M.applyTheme(); });

// ---------------------------------------------------------------- start

async function start() {
  Object.assign(state, parseHash());
  wireControls();
  syncControls();
  showView(state.v);
  setThemeLabelOnly();
  const status = $('map-status');
  try {
    ctx.manifest = await getJSON('manifest.json');
    $('brand-meta').textContent = `v${ctx.manifest.version} · data to ${ctx.manifest.data_cutoff_utc}`;
    $('stat-window').textContent = ctx.manifest.method.b_catalogue.replace('-', '–');
    const files = ['cells.geojson', 'land.geojson', 'coastline.geojson', 'plates.geojson'];
    const total = files.reduce((s, k) => s + ctx.manifest.files[k].bytes, 0);
    let done = 0;
    status.textContent = `Loading map data (${mb(total)})…`;
    const [cells, land, coast, plates] = await Promise.all(files.map((k) => getJSON(k).then((d) => { done++; status.textContent = `Loading map data (${mb(total)}): ${done} of ${files.length} files…`; return d; })));
    ctx.cells = cells;
    for (const ft of cells.features) ctx.byId.set(ft.properties.id, ft.properties);
    showView(state.v); // pages can render now that the manifest is here
    await M.initMap({
      ...ctx,
      onSelect: selectCell,
      onView: (v) => { state.at = v; commit(); },
      onEventsLoaded: (ev) => { evYears = ev.years; syncEventControls(); if (mapReady) M.applyLayers(); },
    }, { land, coast, plates });
    mapReady = true;
    status.hidden = true;
    M.setProjection(!!state.g);
    M.applyLayers();
    syncPanel();
    if (state.c && !parseHash().at && ctx.byId.has(state.c)) { const p = ctx.byId.get(state.c); M.revealCell(p.lon, p.lat); }
    // M6 events are a start-up file, fetched right after the first paint
    M.preloadM6().then(() => { if (state.ev) ensureEvents(); }).catch((e) => { $('ev-count').textContent = e.message; });
    commit();
  } catch (e) {
    status.hidden = false;
    status.classList.add('error');
    status.replaceChildren(h('strong', { text: 'The map could not start. ' }), e.message, ' ', h('button', { class: 'small-btn', type: 'button', onclick: () => location.reload(), text: 'Reload' }));
    console.error(e);
  }
}

function setThemeLabelOnly() {
  const t = currentTheme();
  const lab = { auto: 'automatic', light: 'light', dark: 'dark' }[t];
  $('theme-btn').setAttribute('aria-label', `Colour theme: ${lab}. Activate to change.`);
  $('theme-btn').title = `Theme: ${lab}`;
  $('theme-label').textContent = lab;
}

start();
