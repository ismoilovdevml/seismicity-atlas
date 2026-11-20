// App shell: state in the URL hash, routing between views, controls, theme, language, comparison and regional
// catalogues.

import { getJSON, mb } from './data.js';
import * as M from './map.js';
import { renderPanel, renderCellList } from './panel.js';
import { renderCompare } from './compare.js';
import { initDeficit, renderDeficitPanel, relabelDeficit } from './deficit.js';
import { SUBS, layerName, subLabel } from './layers.js';
import * as f from './fmt.js';
import { h } from './charts.js';
import { t, setLang, LANGS } from './i18n/index.js';
import { readExtras, writeExtras, setCommit } from './hashx.js';
import { placeRailInfo } from './info-rail.js';
import './view-keys.js'; // URL keys of the views below that load on demand
import { loadCss, reduceMotion } from './util.js';
import { initSimple, syncSimple, relabelSimple, startTour, openPlace, loadM5 as simpleLoadM5 } from './simple.js';

// Views that are not visible at start load their code (and style sheet) on first use.
const lazyMods = {};
const lazy = (name) => lazyMods[name] || (lazyMods[name] = {
  pages: () => import('./pages.js'),
  monitor: () => import('./monitor.js'),
  cases: () => import('./cases.js'),
  depth: () => import('./depth3d.js'),
  learn: () => import('./learn/view.js'),
  analyze: () => import('./analyze/view.js'),
}[name]().catch((e) => { delete lazyMods[name]; throw e; }));
const VIEW_CSS = { depth: 'css/terrain3d.css', learn: 'css/learn.css', analyze: 'css/analyze.css', cases: 'css/cases.css' };

const VIEWS = ['map', 'sequences', 'monitor', 'cases', 'methods', 'about', 'depth', 'learn', 'analyze'];
const LAYERS = ['b', 'q', 'mc', 'cc', 'rate', 'none'];
const MODES = ['simple', 'pro'];
// A link that sets any of these and does not name a mode is a Scientist-view link (all links made before v0.3).
const EXPERT_KEYS = ['l', 'm', 'd', 'c', 'k', 'r', 'ev', 'y', 'mm', 'tr', 'df'];
const DEFAULTS = { mode: 'simple', v: 'map', l: 'b', m: '', d: 'sh', c: null, k: null, r: null, ev: 0, y0: null, y1: null, mm: 6, pl: 1, g: 1, at: null, s: null, lang: 'en', t: null };
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

// ---------------------------------------------------------------- view mode preference (Simple or Scientist)

const MODE_KEY = 'gsa-mode';
function storedMode() {
  try { const v = localStorage.getItem(MODE_KEY); return MODES.includes(v) ? v : null; } catch (e) { return null; }
}
function saveMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* storage blocked */ }
}
/** Mode for a hash: the one it names; else Scientist for an expert link; else the fallback (current or stored). */
function modeOf(p, fallback) {
  if (MODES.includes(p.get('mode'))) return p.get('mode');
  if (EXPERT_KEYS.some((k) => p.has(k))) return 'pro';
  return fallback;
}

// ---------------------------------------------------------------- projection preference (globe or flat map)

// The globe is the default (v0.3). A link's g=1 or g=0 wins; a link without g (every link made before v0.3 that did
// not ask for the globe) opens in the visitor's last choice, else on the globe.
const PROJ_KEY = 'gsa-proj';
function storedProj() {
  try { const v = localStorage.getItem(PROJ_KEY); return v === 'globe' ? 1 : v === 'flat' ? 0 : null; } catch (e) { return null; }
}
function saveProj(g) {
  try { localStorage.setItem(PROJ_KEY, g ? 'globe' : 'flat'); } catch (e) { /* storage blocked */ }
}

// ---------------------------------------------------------------- hash state

/** fallbackLang: the language to keep when the hash does not name one (the current one after start-up). */
function parseHash(fallbackLang = preferredLang(), fallbackMode = storedMode() || DEFAULTS.mode, fallbackProj = storedProj() ?? DEFAULTS.g) {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const s = { ...DEFAULTS, lang: fallbackLang, mode: modeOf(p, fallbackMode), g: fallbackProj };
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
  else if (p.get('g') === '0') s.g = 0;
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
  if (s.at) p.set('at', `${s.at.z}/${s.at.lat}/${s.at.lon}`);
  if (s.s) p.set('s', s.s);
  writeExtras(s, p);
  if (s.v === 'learn' && s.t) p.set('t', s.t);
  // Always name the projection, the mode and the language, so a shared link opens as it was copied.
  p.set('g', s.g ? '1' : '0');
  p.set('mode', s.mode);
  p.set('lang', s.lang);
  return `#${p.toString().replace(/%2F/g, '/')}`;
}

let writing = false;
let appliedHash = null; // the hash the state was last read from or written to
function commit(push = false) {
  const hs = hashOf(state);
  appliedHash = hs;
  if (hs === location.hash) return;
  writing = true;
  history[push ? 'pushState' : 'replaceState'](null, '', hs);
  writing = false;
}

// A link click fires both popstate and hashchange; Back between pushState entries may fire only popstate. Both call
// applyHash, which skips a hash it has already applied, so the map updates once.
window.addEventListener('hashchange', () => { if (!writing) applyHash(); });
window.addEventListener('popstate', () => applyHash());

// Keys of a plain navigation link (the header, the brand, "About the data", Learn links). Such a link changes the view
// only: the map state (position, layer, selected cell, filters, regional catalogue, place card) is kept, so going to
// a page and back returns to the same map.
const NAV_KEYS = new Set(['v', 'lang', 'mode', 't', 's', 'cs']);
const PAGE_KEYS = ['v', 'lang', 'mode', 't', 's', 'cs'];
// Views hidden from the Simple view's menu: a Simple visitor there is sent to the map.
const PRO_VIEWS = ['sequences', 'methods'];

async function applyHash() {
  if (location.hash === appliedHash) return;
  appliedHash = location.hash;
  // Navigation links such as "#v=about" carry no language: keep the one in use.
  const s = parseHash(state.lang, state.mode, state.g);
  const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  const navOnly = [...hp.keys()].every((k) => NAV_KEYS.has(k));
  if (navOnly) {
    for (const k of Object.keys(state)) if (!PAGE_KEYS.includes(k)) s[k] = state[k];
  }
  if (s.mode === 'simple' && PRO_VIEWS.includes(s.v)) s.v = 'map';
  const hashHadLang = hp.has('lang') && hp.has('mode');
  const modeChanged = s.mode !== state.mode;
  const viewChanged = s.v !== state.v;
  const atChanged = JSON.stringify(s.at) !== JSON.stringify(state.at);
  const langChanged = s.lang !== state.lang;
  const regionChanged = s.r !== state.r;
  const seqChanged = s.s !== state.s;
  const caseChanged = s.cs !== state.cs;
  // Learn: remember the place the visitor came from, for its "back to where I was" link.
  if (s.v === 'learn' && state.v !== 'learn') learnBack = hashOf(state);
  Object.assign(state, s);
  if (langChanged) await applyLang();
  if (modeChanged) applyMode();
  syncControls();
  showView(state.v);
  if (mapReady) {
    M.applyLayers();
    M.setProjection(!!state.g);
    if (atChanged && state.at) M.flyTo(state.at.lon, state.at.lat, state.at.z);
    if (state.ev) ensureEvents();
    if (regionChanged) selectRegion(state.r, false);
    if (state.mode === 'simple' && state.sm === 5) simpleLoadM5();
    syncPanel();
  }
  syncSimple();
  if (state.v === 'cases' && caseChanged) { rendered.delete('cases'); showView('cases'); }
  if (state.v === 'monitor' && seqChanged && rendered.has('monitor')) lazy('monitor').then((m) => m.focusSequence(state.s)).catch(() => {});
  else if (viewChanged) window.scrollTo(0, 0);
  // Put the language (and, after a navigation link, the kept map state) back into the URL so a reload keeps it.
  if (!hashHadLang || navOnly) commit();
}

// ---------------------------------------------------------------- views

let shownView = null;
function showView(v) {
  for (const id of VIEWS) document.getElementById(`view-${id}`).hidden = id !== v;
  document.querySelectorAll('.nav a').forEach((a) => (a.dataset.view === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  closeMenu();
  const site = t('title.site');
  document.title = v === 'map' ? `${site}: ${t('title.tagline')}` : `${t(`title.${v}`)} | ${site}`;
  // Leaving a view: stop what it runs in the background (the WebGL scene, Learn animations).
  if (shownView !== v) {
    if (shownView === 'depth' && lazyMods.depth) lazyMods.depth.then((D) => { if (state.v !== 'depth') D.hide(); }).catch(() => {});
    if (shownView === 'learn' && lazyMods.learn) lazyMods.learn.then((m) => { if (state.v !== 'learn' && m.leaveLearn) m.leaveLearn(); }).catch(() => {});
    shownView = v;
  }
  if (v === 'learn') { showLearn(); return; }
  if (v === 'analyze') { showAnalyze(); return; }
  if (!ctx.manifest) return;
  if (v === 'map') { M.resize(); return; }
  if (v === 'depth') {
    if (!ctx.cells) { ensureCells().then(() => { if (state.v === 'depth') showView('depth'); }).catch(() => {}); return; }
    withView('depth', (D) => D.show(document.getElementById('depth-root'), { state, manifest: ctx.manifest, cells: ctx.cells }));
    return;
  }
  if (rendered.has(v)) return;
  rendered.add(v);
  const pageCtx = { manifest: ctx.manifest, showOnMap, state };
  const root = (id) => document.getElementById(id);
  if (v === 'sequences') withView('pages', (m) => m.renderSequences(root('seq-root'), pageCtx), v);
  if (v === 'monitor') withView('monitor', (m) => m.renderMonitor(root('monitor-root'), pageCtx), v);
  if (v === 'cases') withView('cases', (m) => m.renderCases(root('cases-root'), pageCtx), v);
  if (v === 'methods') withView('pages', (m) => m.renderMethods(root('methods-root'), pageCtx), v);
  if (v === 'about') withView('pages', (m) => m.renderAbout(root('about-root'), pageCtx), v);
}

/**
 * Load a view's module and style sheet, then run fn(module) if that view is still the one shown. view: the view whose
 * style sheet to wait for (defaults to the module name). A failed load leaves the view to try again on the next visit.
 */
function withView(name, fn, view = name) {
  const css = VIEW_CSS[view] ? loadCss(VIEW_CSS[view]) : null;
  // left before it loaded: render on the next visit instead
  Promise.all([lazy(name), css]).then(([m]) => { if (state.v === view) fn(m); else rendered.delete(view); })
    .catch((e) => { rendered.delete(view); console.error(e); });
}

/** "Your catalogue" loads on demand; the file stays in the browser (js/analyze/view.js). */
function showAnalyze() {
  withView('analyze', (m) => m.renderAnalyze($('analyze-root')));
}

let learnBack = null;
/** The Learn pages load on demand, so the map's first load stays the same. */
function showLearn() {
  withView('learn', (m) => m.renderLearn($('learn-root'), { topic: state.t, back: learnBack }));
}

function showOnMap(s) {
  if (state.mode === 'simple') {
    // the simple map has no event filter: open the place card around the earthquake
    state.v = 'map';
    commit(true);
    applyHash();
    openPlace(+s.lat, +s.lon, { fly: true });
    return;
  }
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
  $('cmp-banner').hidden = !pinned || !!comparing || state.v !== 'map' || state.mode === 'simple';
  if (pinned) $('cmp-banner-text').textContent = t('cmp.banner', { name: f.latlon(pinned.lat, pinned.lon) });
}

function wireControls() {
  document.querySelectorAll('input[name=layer]').forEach((i) => i.addEventListener('change', () => {
    state.l = i.value; state.m = ''; update();
  }));
  $('sub-select').addEventListener('change', (e) => { state.m = e.target.value; update(); });
  document.querySelectorAll('input[name=depth]').forEach((i) => i.addEventListener('change', () => { state.d = i.value; update(); }));
  $('chk-plates').addEventListener('change', (e) => { state.pl = e.target.checked ? 1 : 0; update(); });
  $('globe-btn').addEventListener('click', () => { state.g = state.g ? 0 : 1; saveProj(state.g); M.setProjection(!!state.g); update(); });
  $('zoom-in').addEventListener('click', () => M.zoomBy(1));
  $('zoom-out').addEventListener('click', () => M.zoomBy(-1));
  $('chk-events').addEventListener('change', (e) => { state.ev = e.target.checked ? 6 : 0; update(); ensureEvents(); });
  $('chk-m5').addEventListener('change', (e) => { state.ev = e.target.checked ? 5 : (state.ev ? 6 : 0); state.mm = e.target.checked ? 5 : Math.max(6, state.mm); update(); ensureEvents(); });
  document.querySelectorAll('#chips [data-layer]').forEach((c) => c.addEventListener('click', () => { state.l = c.dataset.layer; state.m = ''; update(); }));
  $('chip-depth').addEventListener('click', () => { state.d = state.d === 'sh' ? 'dp' : 'sh'; update(); });
  $('chip-more').addEventListener('click', () => setRail(!$('controls').classList.contains('open')));
  $('rail-close').addEventListener('click', () => { setRail(false); $('chip-more').focus({ preventScroll: true }); });
  // Sliders fire an input event per step while dragged: the slider labels follow at once, the map, the counts and
  // the URL once per frame.
  const yr = (e) => {
    let y0 = +$('yr0').value, y1 = +$('yr1').value;
    if (y0 > y1) { if (e.target === $('yr0')) y1 = y0; else y0 = y1; }
    state.y0 = y0; state.y1 = y1;
    $('yr0-out').textContent = String(y0);
    $('yr1-out').textContent = String(y1);
    if (y0 === evYears[0] && y1 === evYears[1]) { state.y0 = null; state.y1 = null; }
    scheduleUpdate();
  };
  $('yr0').addEventListener('input', yr);
  $('yr1').addEventListener('input', yr);
  $('mmin').addEventListener('input', (e) => { state.mm = +e.target.value; $('mmin-out').textContent = state.mm.toFixed(1); scheduleUpdate(); });
  $('menu-btn').addEventListener('click', () => {
    const open = !$('nav').classList.contains('open');
    $('nav').classList.toggle('open', open);
    $('menu-btn').setAttribute('aria-expanded', String(open));
  });
  $('panel-close').addEventListener('click', closePanel);
  $('list-btn').addEventListener('click', () => { state.c = 'list'; update(); $('panel').focus({ preventScroll: true }); });
  $('cmp-banner-cancel').addEventListener('click', unpin);
  $('reg-select').addEventListener('change', (e) => selectRegion(e.target.value || null, true));
  document.querySelectorAll('#mode-seg [data-mode]').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const next = MODES[(MODES.indexOf(state.mode) + 1) % MODES.length];
      setMode(next);
      document.querySelector(`#mode-seg [data-mode=${next}]`).focus();
    });
  });
  $('nav-theme').addEventListener('click', () => $('theme-btn').click());
  $('lang-select').addEventListener('change', async (e) => { state.lang = e.target.value; saveLang(state.lang); await applyLang(); commit(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('nav').classList.contains('open')) { closeMenu(); $('menu-btn').focus({ preventScroll: true }); return; }
    if ($('controls').classList.contains('open') && state.v === 'map') { setRail(false); $('chip-more').focus({ preventScroll: true }); return; }
    if (!$('panel').hidden && state.v === 'map') closePanel();
  });
}

/** The map controls drawer on phones (the rail is always shown on wider screens). */
function setRail(open) {
  $('controls').classList.toggle('open', open);
  $('chip-more').setAttribute('aria-expanded', String(open));
  if (open) $('rail-close').focus({ preventScroll: true });
}

function closeMenu() {
  $('nav').classList.remove('open');
  $('menu-btn').setAttribute('aria-expanded', 'false');
}

let updateFrame = 0;
/** update() once in the next frame, however many slider steps arrive before it. */
function scheduleUpdate() {
  if (updateFrame) return;
  updateFrame = requestAnimationFrame(() => { updateFrame = 0; update(); });
}

function update(push = false) {
  if (updateFrame) { cancelAnimationFrame(updateFrame); updateFrame = 0; }
  syncControls();
  if (mapReady) M.applyLayers();
  syncPanel();
  syncSimple();
  commit(push);
}

// ---------------------------------------------------------------- mode

/** Show the Simple or the Scientist view: page attribute for the CSS, labels, map layers and panels. */
function applyMode() {
  const simple = state.mode === 'simple';
  document.documentElement.dataset.mode = state.mode;
  // a radio group: one tab stop, arrow keys move between the two modes
  document.querySelectorAll('#mode-seg [data-mode]').forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const navMon = $('nav-monitor');
  navMon.dataset.i18n = simple ? 'nav.recent' : 'nav.monitor';
  navMon.textContent = t(navMon.dataset.i18n);
  const tag = $('brand-tag');
  tag.dataset.i18n = simple ? 'brand.tagSimple' : 'brand.tag';
  tag.textContent = t(tag.dataset.i18n);
  if (simple) {
    $('panel').hidden = true; panelFor = null; M.hideTip();
    // the Simple view has no 3D terrain switch: leave it with a flat map it can control
    if (state.tr) state.tr = 0;
  } else ensureCells().catch(() => {});
  fitHeader();
  if (mapReady) { M.applyLayers(); M.resize(); }
}

// ---------------------------------------------------------------- cells (Scientist view and Depth 3D only)

let cellsLoading = null;
/**
 * cells.geojson (1.4 MB) is read by the Scientist view, its panels and Depth 3D. The Simple view never loads it: its
 * place card uses the small rating.json (scripts/build_rating.py). Loaded once, on the first need.
 */
function ensureCells() {
  if (!cellsLoading) {
    const status = $('map-status');
    const showStatus = mapReady && state.v === 'map';
    if (showStatus) {
      const meta = ctx.manifest && ctx.manifest.files['cells.geojson'];
      status.classList.remove('error');
      status.textContent = t('map.loadingSize', { size: meta ? mb(meta.bytes) : '' });
      status.hidden = false;
    }
    cellsLoading = getJSON('cells.geojson').then((cells) => {
      ctx.cells = cells;
      for (const ft of cells.features) ctx.byId.set(ft.properties.id, ft.properties);
      setHexLine();
      // at start-up the panel opens after the map is made (start() calls syncPanel), so the first view is sized for
      // the full map width as before
      if (mapReady) { M.setCells(cells); M.applyLayers(); status.hidden = true; panelFor = null; syncPanel(); }
      return cells;
    }).catch((e) => {
      cellsLoading = null;
      if (mapReady) {
        status.hidden = false;
        status.classList.add('error');
        status.replaceChildren(h('strong', { text: `${t('map.startError')} ` }), e.message, ' ',
          h('button', { class: 'small-btn', type: 'button', onclick: () => ensureCells().catch(() => {}), text: t('common.retry') }));
      }
      throw e;
    });
  }
  return cellsLoading;
}

function setMode(m) {
  if (!MODES.includes(m)) return;
  saveMode(m); // an explicit choice, also when that mode is already shown (e.g. opened from a shared link)
  if (m === state.mode) return;
  state.mode = m;
  // Sequences and Validation are not in the Simple view's menu: show the map instead of a page it cannot reach
  if (m === 'simple' && PRO_VIEWS.includes(state.v)) { state.v = 'map'; showView('map'); }
  applyMode();
  update(true);
  if (m === 'pro' && state.c) syncPanel();
}

/** "Scientist view of this place": the Scientist view with the cell under the place selected. */
function openExpert(cellId, lat, lon) {
  state.mode = 'pro';
  saveMode('pro');
  state.v = 'map';
  state.k = null;
  if (!['b', 'q', 'mc', 'cc', 'rate'].includes(state.l)) state.l = 'b';
  applyMode();
  showView('map');
  commit(true);
  ensureCells().then(() => {
    const p = lookup(cellId);
  // the cells are about 300 km across: zoom out from the place view so the cell and its neighbours are in sight
    if (p) { state.at = { z: 3.5, lat: +p.lat.toFixed(2), lon: +p.lon.toFixed(2) }; M.flyTo(p.lon, p.lat, 3.5); }
    selectCell(cellId);
  }).catch(() => {});
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
  if (state.mode === 'simple') {
    if (!$('panel').hidden) { $('panel').hidden = true; M.resize(); }
    panelFor = null;
    return;
  }
  if (state.df && state.dz) {
    const key = `df|${state.dz}|${state.lang}`;
    if (key === panelFor) return;
    panelFor = key;
    renderDeficitPanel(state.dz);
    M.resize();
    return;
  }
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
  state.dz = null;
  update();
  if (state.mode !== 'pro') return;
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
  state.dz = null;
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
    regionLoading = null; // a catalogue still loading must not appear after "None"
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

// Language files load one after another, so a slow file chosen first can never replace the one chosen last.
let langQueue = Promise.resolve();
const loadLang = (code) => (langQueue = langQueue.then(() => setLang(code)).catch((e) => console.error(e)));

async function applyLang() {
  const want = state.lang;
  await loadLang(want);
  if (want !== state.lang) return; // a newer choice is on its way and relabels everything itself
  setThemeLabel();
  if (ctx.manifest) $('brand-meta').textContent = t('meta.brand', { v: ctx.manifest.version, cutoff: ctx.manifest.data_cutoff_utc });
  if (regions.length) renderRegionOptions();
  if (!regionLoading || !state.r) $('reg-status').textContent = t('reg.hint');
  panelFor = null;
  rendered.clear();
  syncControls();
  if (mapReady) { M.relabel(); M.applyLayers(); syncPanel(); }
  applyMode();
  relabelSimple();
  relabelDeficit();
  setHexLine();
  showView(state.v);
}

/** The Scientist-view line "What is a hexagon?", with the mean cell area and the sample radius from the data. */
function setHexLine() {
  if (!ctx.cells || !ctx.manifest) return;
  const a = ctx.cells.features.reduce((s, ft) => s + ft.properties.area_km2, 0) / ctx.cells.features.length;
  $('pro-hex').textContent = t('pro.hex', { area: f.int(Math.round(a / 1000) * 1000), r: f.int(ctx.manifest.method.sample_radius_km) });
}

// ---------------------------------------------------------------- header fit

/**
 * The header links collapse into the menu button whenever they do not fit in one row next to the brand and the
 * controls: the width that needs depends on the language (RU and UZ labels are long) and on the mode (Scientist has
 * two more links), so it is measured rather than set by a breakpoint. Phones (<= 720 px) always use the menu.
 */
function fitHeader() {
  const top = document.querySelector('.top');
  if (!top) return;
  if (innerWidth <= 720) { top.classList.remove('compact'); return; }
  const was = top.classList.contains('compact');
  top.classList.remove('compact');
  const name = top.querySelector('.brand-name');
  const over = top.scrollWidth > top.clientWidth + 1 || (name && name.scrollWidth > name.clientWidth + 1);
  top.classList.toggle('compact', over);
  if (was && !over) closeMenu();
}

let headerFrame = 0;
function watchHeader() {
  const later = () => { if (!headerFrame) headerFrame = requestAnimationFrame(() => { headerFrame = 0; fitHeader(); }); };
  addEventListener('resize', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  fitHeader();
}

// ---------------------------------------------------------------- theme

const THEMES = ['auto', 'light', 'dark'];
function currentTheme() { return document.documentElement.dataset.theme || 'auto'; }
function setThemeLabel() {
  const lab = t(`theme.${currentTheme()}`);
  $('theme-btn').setAttribute('aria-label', t('theme.aria', { t: lab }));
  $('theme-btn').title = t('theme.title', { t: lab });
  $('theme-label').textContent = lab;
  $('nav-theme').textContent = t('theme.menu', { t: lab });
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

// MapLibre (1 MB) is a classic script; index.html preloads it, and it runs while the data below download.
const MAPLIBRE_JS = 'vendor/maplibre-gl-5.24.0/maplibre-gl.js';
function loadMaplibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = MAPLIBRE_JS;
    sc.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error(`${MAPLIBRE_JS} did not load.`)));
    sc.onerror = () => reject(new Error(`${MAPLIBRE_JS} could not be loaded (network error).`));
    document.head.append(sc);
  });
}

async function start() {
  Object.assign(state, parseHash());
  if (state.mode === 'simple' && PRO_VIEWS.includes(state.v)) state.v = 'map';
  setCommit(commit);
  // Everything independent starts at once: the language file, the manifest, the base map, the map library and the
  // M6 events; nothing waits for a download it does not need.
  const langP = loadLang(state.lang);
  const manifestP = getJSON('manifest.json');
  const needCells = state.mode === 'pro' || state.v === 'depth';
  if (needCells) ensureCells().catch(() => {});
  for (const k of ['land.geojson', 'coastline.geojson', 'plates.geojson']) getJSON(k).catch(() => {});
  const libP = loadMaplibre();
  manifestP.catch(() => {});
  libP.catch(() => {}); // both reported below, once awaited
  await langP;
  wireControls();
  initSimple({ state, ctx, update, openExpert });
  applyMode();
  placeRailInfo();
  syncControls();
  showView(state.v);
  setThemeLabel();
  watchHeader();
  const status = $('map-status');
  try {
    ctx.manifest = await manifestP;
    $('brand-meta').textContent = t('meta.brand', { v: ctx.manifest.version, cutoff: ctx.manifest.data_cutoff_utc });
    fitHeader();
    $('stat-window').textContent = ctx.manifest.method.b_catalogue.replace('-', '–');
    // The Scientist view and Depth 3D wait for the cells; the Simple view starts without them.
    const files = [...(needCells ? ['cells.geojson'] : []), 'land.geojson', 'coastline.geojson', 'plates.geojson'];
    const total = files.reduce((s, k) => s + ctx.manifest.files[k].bytes, 0);
    let done = 0;
    status.textContent = t('map.loadingSize', { size: mb(total) });
    const got = await Promise.all(files.map((k) => (k === 'cells.geojson' ? ensureCells() : getJSON(k)).then((d) => { done++; status.textContent = t('map.loadingProgress', { size: mb(total), done, n: files.length }); return d; })));
    const [land, coast, plates] = got.slice(-3);
    setHexLine();
    syncEventControls();
    showView(state.v); // pages can render now that the manifest is here
    // the M6 events (the Simple view's dots) download while the map library starts
    getJSON('events_m6.json').catch(() => {});
    await libP;
    await M.initMap({
      ...ctx,
      lookup,
      onSelect: selectCell,
      onPlace: (lat, lon) => openPlace(lat, lon),
      onSimpleZoom: () => syncSimple(),
      onView: (v) => { state.at = v; commit(); },
      onEventsLoaded: (ev) => { evYears = ev.years; syncEventControls(); if (mapReady) M.applyLayers(); syncSimple(); },
      onTerrainError: () => { state.tr = 0; commit(); },
    }, { land, coast, plates });
    mapReady = true;
    status.hidden = true;
    initDeficit({ state, update, onZone: (id) => { state.dz = id; state.c = null; state.k = null; update(); $('panel').focus({ preventScroll: true }); } });
    M.setProjection(!!state.g);
    M.applyLayers();
    syncPanel();
    if (state.c && !parseHash().at && ctx.byId.has(state.c)) { const p = ctx.byId.get(state.c); M.revealCell(p.lon, p.lat); }
    // M6 events are a start-up file, fetched right after the first paint
    M.preloadM6().then(() => {
      if (state.ev) ensureEvents();
      if (state.mode === 'simple' && state.sm === 5) simpleLoadM5();
      if (state.p && state.mode === 'simple') M.showPlace(state.p.lat, state.p.lon, state.pr);
      startTour();
    }).catch((e) => { $('ev-count').textContent = e.message; });
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
