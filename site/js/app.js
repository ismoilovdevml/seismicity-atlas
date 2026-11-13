// App shell: state in the URL hash, routing between views, controls, theme, language, comparison and regional
// catalogues.

import { getJSON, mb } from './data.js';
import * as M from './map.js';
import { renderPanel, renderCellList } from './panel.js';
import { renderCompare } from './compare.js';
import { renderSequences, renderMethods, renderAbout } from './pages.js';
import { renderMonitor, focusSequence } from './monitor.js';
import { SUBS, layerName, subLabel } from './layers.js';
import * as f from './fmt.js';
import { h } from './charts.js';
import { t, setLang, LANGS } from './i18n/index.js';
import { readExtras, writeExtras, setCommit } from './hashx.js';
import { placeRailInfo } from './info-rail.js';
import * as D from './depth3d.js';

const VIEWS = ['map', 'sequences', 'monitor', 'methods', 'about', 'depth', 'learn'];
const LAYERS = ['b', 'q', 'mc', 'cc', 'rate', 'none'];
const DEFAULTS = { v: 'map', l: 'b', m: '', d: 'sh', c: null, k: null, r: null, ev: 0, y0: null, y1: null, mm: 6, pl: 1, g: 0, at: null, s: null, lang: 'en', t: null };
const CELL_ID = /^[0-9a-f]{15}$/;

const state = { ...DEFAULTS };
const ctx = { state, manifest: null, cells: null, byId: new Map(), rById: new Map() };
const rendered = new Set();
let mapReady = false;
let regions = []; // entries of regional/index.json
let regionLoading = null;

const lookup = (id) => ctx.byId.get(id) || ctx.rById.get(id) || null;

// ---------------------------------------------------------------- language preference

const LANG_KEY = 'gsa-lang';
function storedLang() {
  try { const v = localStorage.getItem(LANG_KEY); return LANGS[v] ? v : null; } catch (e) { return null; }
}
function saveLang(code) {
  try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* storage blocked */ }
}
/** Language when the URL does not name one: the visitor's last choice, else the browser language, else English. */
function preferredLang() {
  const saved = storedLang();
  if (saved) return saved;
  for (const l of navigator.languages || [navigator.language || '']) {
    const base = String(l).toLowerCase().split('-')[0];
    if (LANGS[base]) return base;
  }
  return 'en';
}

// ---------------------------------------------------------------- hash state

/** fallbackLang: the language to keep when the hash does not name one (the current one after start-up). */
function parseHash(fallbackLang = preferredLang()) {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const s = { ...DEFAULTS, lang: fallbackLang };
  if (VIEWS.includes(p.get('v'))) s.v = p.get('v');
  if (LAYERS.includes(p.get('l'))) s.l = p.get('l');
  const subOk = (SUBS[s.l] || []).some((x) => x.id === p.get('m'));
  s.m = subOk ? p.get('m') : '';
  if (['sh', 'dp'].includes(p.get('d'))) s.d = p.get('d');
  if (CELL_ID.test(p.get('c') || '') || p.get('c') === 'list') s.c = p.get('c');
  if (CELL_ID.test(p.get('k') || '')) s.k = p.get('k');
  if (/^[A-Za-z0-9_-]{1,64}$/.test(p.get('r') || '')) s.r = p.get('r');
  if (['5', '6'].includes(p.get('ev'))) s.ev = +p.get('ev');
  const y = (p.get('y') || '').match(/^(\d{4})-(\d{4})$/);
  if (y && +y[1] <= +y[2]) { s.y0 = +y[1]; s.y1 = +y[2]; }
  const mm = +p.get('mm');
  if (mm >= 5 && mm <= 9) s.mm = mm;
  if (p.get('pl') === '0') s.pl = 0;
  if (p.get('g') === '1') s.g = 1;
  const at = (p.get('at') || '').split('/').map(Number);
  if (at.length === 3 && at.every(Number.isFinite) && Math.abs(at[1]) <= 85) s.at = { z: at[0], lat: at[1], lon: at[2] };
  if (/^[a-z0-9]{4,24}$/.test(p.get('s') || '')) s.s = p.get('s');
  if (LANGS[p.get('lang')]) s.lang = p.get('lang');
  readExtras(p, s);
  if (s.v === 'learn' && /^[a-z0-9-]{1,48}$/.test(p.get('t') || '')) s.t = p.get('t');
  return s;
}

function hashOf(s) {
  const p = new URLSearchParams();
  p.set('v', s.v);
  p.set('l', s.l);
  if (s.m) p.set('m', s.m);
  p.set('d', s.d);
  if (s.c) p.set('c', s.c);
  if (s.k) p.set('k', s.k);
  if (s.r) p.set('r', s.r);
  if (s.ev) p.set('ev', String(s.ev));
  if (s.ev && s.y0 !== null) p.set('y', `${s.y0}-${s.y1}`);
  if (s.ev && s.mm !== DEFAULTS.mm) p.set('mm', String(s.mm));
  if (!s.pl) p.set('pl', '0');
  if (s.g) p.set('g', '1');
  if (s.at) p.set('at', `${s.at.z}/${s.at.lat}/${s.at.lon}`);
  if (s.s) p.set('s', s.s);
  writeExtras(s, p);
  if (s.v === 'learn' && s.t) p.set('t', s.t);
  // Always name the language, so a shared link opens in the language it was copied in.
  p.set('lang', s.lang);
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

async function applyHash() {
  // Navigation links such as "#v=about" carry no language: keep the one in use.
  const s = parseHash(state.lang);
  const hashHadLang = new URLSearchParams(location.hash.replace(/^#/, '')).has('lang');
  const viewChanged = s.v !== state.v;
  const atChanged = JSON.stringify(s.at) !== JSON.stringify(state.at);
  const langChanged = s.lang !== state.lang;
  const regionChanged = s.r !== state.r;
  const seqChanged = s.s !== state.s;
  // Learn: remember the place the visitor came from, for its "back to where I was" link.
  if (s.v === 'learn' && state.v !== 'learn') learnBack = hashOf(state);
  Object.assign(state, s);
  if (langChanged) await applyLang();
  syncControls();
  showView(state.v);
  if (mapReady) {
    M.applyLayers();
    M.setProjection(!!state.g);
    if (atChanged && state.at) M.flyTo(state.at.lon, state.at.lat, state.at.z);
    if (state.ev) ensureEvents();
    if (regionChanged) selectRegion(state.r, false);
    syncPanel();
  }
  if (state.v === 'monitor' && seqChanged && rendered.has('monitor')) focusSequence(state.s);
  else if (viewChanged) window.scrollTo(0, 0);
  // Put the language back into the URL so a reload keeps it.
  if (!hashHadLang) commit();
}

// ---------------------------------------------------------------- views

function showView(v) {
  for (const id of VIEWS) document.getElementById(`view-${id}`).hidden = id !== v;
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.view === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.getElementById('nav').classList.remove('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
  const site = t('title.site');
  document.title = v === 'map' ? site : `${t(`title.${v}`)} | ${site}`;
  if (v === 'learn') { showLearn(); return; }
  if (!ctx.manifest) return;
  if (v === 'map') { M.resize(); return; }
  if (v === 'depth') { D.show(document.getElementById('depth-root'), { state, manifest: ctx.manifest, cells: ctx.cells }); return; }
  if (rendered.has(v)) return;
  rendered.add(v);
  const pageCtx = { manifest: ctx.manifest, showOnMap, state };
  if (v === 'sequences') renderSequences(document.getElementById('seq-root'), pageCtx);
  if (v === 'monitor') renderMonitor(document.getElementById('monitor-root'), pageCtx);
  if (v === 'methods') renderMethods(document.getElementById('methods-root'), pageCtx);
  if (v === 'about') renderAbout(document.getElementById('about-root'), pageCtx);
}

let learnBack = null;
/** The Learn pages load on demand, so the map's first load stays the same. */
function showLearn() {
  import('./learn/view.js')
    .then((m) => m.renderLearn($('learn-root'), { topic: state.t, back: learnBack }))
    .catch((e) => { console.error(e); });
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
    sel.replaceChildren(...subs.map((s) => h('option', { value: s.id, text: subLabel(state.l, s.id) })));
    sel.value = state.m || subs[0].id;
    sel.setAttribute('aria-label', t('rail.variantOf', { layer: layerName(state.l) }));
  } else sel.hidden = true;
  const depthAware = !['cc', 'rate', 'none'].includes(state.l);
  document.querySelectorAll('input[name=depth]').forEach((i) => { i.checked = i.value === state.d; i.disabled = !depthAware; });
  $('depth-hint').hidden = depthAware;
  $('depth-hint').textContent = t(state.l === 'none' ? 'rail.depthHintNone' : 'rail.depthHintAll');
  $('chk-plates').checked = !!state.pl;
  $('chk-events').checked = !!state.ev;
  $('chk-m5').checked = state.ev === 5;
  $('globe-btn').setAttribute('aria-pressed', String(!!state.g));
  $('events-opts').hidden = !state.ev;
  document.querySelectorAll('#chips [data-layer]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.layer === state.l)));
  $('chip-depth').textContent = t(`chip.depth.${state.d}`);
  $('chip-depth').setAttribute('aria-label', t(`chip.depthAria.${state.d}`));
  $('lang-select').value = state.lang;
  if (regions.length) $('reg-select').value = state.r && regions.some((r) => r.id === state.r) ? state.r : '';
  syncEventControls();
  syncBanner();
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
  $('ev-count').textContent = state.ev && mapReady ? M.eventCountText() : '';
  const m5 = ctx.manifest && ctx.manifest.files['events_m5.json'];
  if (m5) {
    $('lbl-m6').textContent = t('rail.m6', { n: f.int(ctx.manifest.events['events_m6.json'].n) });
    $('lbl-m5').textContent = t('rail.m5', { n: f.int(ctx.manifest.events['events_m5.json'].n), size: mb(m5.bytes) });
  } else {
    $('lbl-m6').textContent = t('rail.m6plain');
    $('lbl-m5').textContent = t('rail.m5plain');
  }
}

function syncBanner() {
  const pinned = state.k && lookup(state.k);
  const comparing = pinned && state.c && state.c !== state.k && lookup(state.c);
  $('cmp-banner').hidden = !pinned || !!comparing || state.v !== 'map';
  if (pinned) $('cmp-banner-text').textContent = t('cmp.banner', { name: f.latlon(pinned.lat, pinned.lon) });
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
  $('cmp-banner-cancel').addEventListener('click', unpin);
  $('reg-select').addEventListener('change', (e) => selectRegion(e.target.value || null, true));
  $('lang-select').addEventListener('change', async (e) => { state.lang = e.target.value; saveLang(state.lang); await applyLang(); commit(); });
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
    $('ev-count').textContent = t('ev.loadingM5');
    $('chk-m5').disabled = true;
    M.loadM5().then(() => { if (mapReady) M.applyLayers(); syncEventControls(); })
      .catch((e) => { $('ev-count').textContent = `${e.message} ${t('ev.fallbackM6')}`; state.ev = 6; commit(); if (mapReady) M.applyLayers(); })
      .finally(() => { $('chk-m5').disabled = false; syncControls(); });
  }
}

// ---------------------------------------------------------------- panel and comparison

let panelFor = null;
function syncPanel() {
  syncBanner();
  if (state.c === 'list' && ctx.cells) {
    const key = `list|${state.d}|${state.k}|${state.lang}`;
    if (key === panelFor) return;
    panelFor = key;
    renderCellList([...ctx.byId.values()], { state, onOpen: selectCell });
    M.resize();
    return;
  }
  const a = state.k ? lookup(state.k) : null;
  const b = state.c ? lookup(state.c) : null;
  if (a && b && state.c !== state.k) {
    const key = `cmp|${state.k}|${state.c}|${state.d}|${state.lang}`;
    if (key === panelFor) return;
    panelFor = key;
    renderCompare(a, b, {
      state, manifest: ctx.manifest,
      onOpen: (id) => { state.k = null; state.c = id; update(); },
      onEnd: () => { state.k = null; update(); },
      onSwap: () => { [state.k, state.c] = [state.c, state.k]; update(); },
    });
    M.resize();
    return;
  }
  if (!b) {
    if (!$('panel').hidden) { $('panel').hidden = true; M.resize(); }
    panelFor = null;
    return;
  }
  const key = `${state.c}|${state.d}|${state.k}|${state.lang}`;
  if (key === panelFor) return;
  panelFor = key;
  renderPanel(b, {
    state, manifest: ctx.manifest,
    region: b.regionId ? regions.find((r) => r.id === b.regionId) : null,
    onPin: (id) => { state.k = id; update(); },
    onUnpin: unpin,
  });
  M.resize();
}

function selectCell(id) {
  state.c = id;
  update();
  const p = lookup(id);
  if (p) M.revealCell(p.lon, p.lat);
  $('panel').focus({ preventScroll: true });
}

function unpin() {
  state.k = null;
  update();
}

function closePanel() {
  state.c = null;
  state.k = null;
  update();
  M.hideTip();
}

// ---------------------------------------------------------------- regional catalogues

const validRegion = (r) => r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(r.id) && typeof r.cells === 'string'
  && !r.cells.includes('..') && (r.cell_detail_dir === undefined || (typeof r.cell_detail_dir === 'string' && !r.cell_detail_dir.includes('..')))
  && Array.isArray(r.bbox) && r.bbox.length === 4 && r.bbox.every(Number.isFinite);

/** The regional index is optional: when it is absent or empty, the control group stays hidden. */
async function loadRegionIndex() {
  try {
    const idx = await getJSON('regional/index.json');
    regions = (idx.regions || []).filter(validRegion);
  } catch (e) {
    regions = [];
  }
  $('reg-group').hidden = !regions.length;
  if (!regions.length) {
    if (state.r) { state.r = null; commit(); }
    return;
  }
  renderRegionOptions();
  if (state.r) await selectRegion(state.r, !state.at);
}

function renderRegionOptions() {
  $('reg-select').replaceChildren(h('option', { value: '', text: t('reg.none') }), ...regions.map((r) => h('option', { value: r.id, text: r.name })));
  $('reg-select').value = state.r || '';
}

async function selectRegion(id, fly) {
  const meta = id ? regions.find((r) => r.id === id) : null;
  ctx.rById.clear();
  if (!meta) {
    state.r = null;
    if (mapReady) M.clearRegion();
    $('reg-status').textContent = t('reg.hint');
    update();
    return;
  }
  state.r = meta.id;
  commit();
  $('reg-status').textContent = t('reg.loading');
  const my = (regionLoading = meta.id);
  try {
    const data = await getJSON(meta.cells);
    if (regionLoading !== my) return;
    for (const ft of data.features || []) {
      ft.properties.regionId = meta.id;
      ft.properties.regionName = meta.name;
      ctx.rById.set(ft.properties.id, ft.properties);
    }
    M.setRegion(meta, data, (p) => ['A', 'B'].includes(p[`${state.d}_q`]));
    $('reg-status').textContent = t('reg.hint');
    if (fly) M.fitBbox(meta.bbox);
    panelFor = null;
    update();
  } catch (e) {
    $('reg-status').textContent = t('reg.error', { msg: e.message });
  }
}

// ---------------------------------------------------------------- language

async function applyLang() {
  await setLang(state.lang);
  setThemeLabel();
  if (ctx.manifest) $('brand-meta').textContent = t('meta.brand', { v: ctx.manifest.version, cutoff: ctx.manifest.data_cutoff_utc });
  if (regions.length) renderRegionOptions();
  if (!regionLoading || !state.r) $('reg-status').textContent = t('reg.hint');
  panelFor = null;
  rendered.clear();
  syncControls();
  if (mapReady) { M.relabel(); M.applyLayers(); syncPanel(); }
  showView(state.v);
}

// ---------------------------------------------------------------- theme

const THEMES = ['auto', 'light', 'dark'];
function currentTheme() { return document.documentElement.dataset.theme || 'auto'; }
function setThemeLabel() {
  const lab = t(`theme.${currentTheme()}`);
  $('theme-btn').setAttribute('aria-label', t('theme.aria', { t: lab }));
  $('theme-btn').title = t('theme.title', { t: lab });
  $('theme-label').textContent = lab;
}
function setTheme(th) {
  if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  try { if (th === 'auto') localStorage.removeItem('gsa-theme'); else localStorage.setItem('gsa-theme', th); } catch (e) { /* storage blocked */ }
  setThemeLabel();
  M.applyTheme();
}
$('theme-btn').addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % 3]));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (currentTheme() === 'auto') M.applyTheme(); });

// ---------------------------------------------------------------- start

async function start() {
  Object.assign(state, parseHash());
  setCommit(commit);
  await setLang(state.lang);
  wireControls();
  placeRailInfo();
  syncControls();
  showView(state.v);
  setThemeLabel();
  const status = $('map-status');
  try {
    ctx.manifest = await getJSON('manifest.json');
    $('brand-meta').textContent = t('meta.brand', { v: ctx.manifest.version, cutoff: ctx.manifest.data_cutoff_utc });
    $('stat-window').textContent = ctx.manifest.method.b_catalogue.replace('-', '–');
    const files = ['cells.geojson', 'land.geojson', 'coastline.geojson', 'plates.geojson'];
    const total = files.reduce((s, k) => s + ctx.manifest.files[k].bytes, 0);
    let done = 0;
    status.textContent = t('map.loadingSize', { size: mb(total) });
    const [cells, land, coast, plates] = await Promise.all(files.map((k) => getJSON(k).then((d) => { done++; status.textContent = t('map.loadingProgress', { size: mb(total), done, n: files.length }); return d; })));
    ctx.cells = cells;
    for (const ft of cells.features) ctx.byId.set(ft.properties.id, ft.properties);
    syncEventControls();
    showView(state.v); // pages can render now that the manifest is here
    await M.initMap({
      ...ctx,
      lookup,
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
    loadRegionIndex();
    commit();
  } catch (e) {
    status.hidden = false;
    status.classList.add('error');
    status.replaceChildren(h('strong', { text: `${t('map.startError')} ` }), e.message, ' ', h('button', { class: 'small-btn', type: 'button', onclick: () => location.reload(), text: t('common.reload') }));
    console.error(e);
  }
}

start();
