// Simple view (the default for new visitors): real earthquakes as dots over a density shading, a place search that
// runs in the browser, a place card in plain words, a few controls and a short first-visit tour.
// The Scientist view (cells, b-values, quality codes) is the rest of the app; "Scientist view of this place" opens it
// on the cell under the place. Design notes and the rating table: docs/ux-notes.md and docs/learn.md.

import * as M from './map.js';
import * as f from './fmt.js';
import { h } from './charts.js';
import { t, lang } from './i18n/index.js';
import { infoButton } from './info.js';
import { defineKeys, intIn } from './hashx.js';
import { mb, ruleNumber } from './data.js';
import { EXT } from './util.js';
import { loadPlaces, searchPlaces, placeName, nearestPlace, placeStats, cellAtPoint, loadRating } from './places.js';

defineKeys([
  { key: 'sr', def: 0, parse: (s) => (s === '10' || s === '50' ? +s : undefined) },
  { key: 'sm', def: 6, parse: intIn(5, 7) },
  { key: 'pr', def: 100, parse: (s) => (s === '300' ? 300 : s === '100' ? 100 : undefined) },
  {
    key: 'p', def: null,
    parse: (s) => {
      const m = String(s).match(/^(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)$/);
      if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return undefined;
      return { lat: +m[1], lon: +m[2] };
    },
    fmt: (v) => `${v.lat.toFixed(3)}/${v.lon.toFixed(3)}`,
  },
]);

export const RADII = [100, 300];
const TOUR_KEY = 'gsa-tour';
const USGS = 'https://earthquake.usgs.gov/earthquakes/eventpage/';
const $ = (id) => document.getElementById(id);

let S = null; // {state, ctx, update, openExpert, regionAt, openRegional}
let named = null; // the gazetteer place chosen in the search, while the card shows it
let places = null; // loaded gazetteer rows
let rating = null; // decoded data/rating.json (the cell under a place and its recording rating), loaded with the first card
let ratingError = null;
let cardKey = null;
let tourStep = -1;

// ---------------------------------------------------------------- set-up

export function initSimple(opts) {
  S = opts;
  wireSearch();
  wireControls();
  wireTour();
  $('sx-card-close').addEventListener('click', closePlace);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || S.state.mode !== 'simple') return;
    // the tour first (wherever the focus is), then the place card
    if (!$('sx-tour').hidden) { endTour(); return; }
    if (!$('sx-card').hidden && document.activeElement !== $('sx-q')) closePlace();
  });
  addEventListener('resize', () => { if (!$('sx-tour').hidden) placeTour(); });
}

/** Re-render everything the simple view shows from the state (cheap when nothing changed). */
export function syncSimple() {
  if (!S) return;
  const st = S.state;
  document.querySelectorAll('#sx-yr [data-sr]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.sr === st.sr)));
  document.querySelectorAll('#sx-mag [data-sm]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.sm === st.sm)));
  $('sx-plates').checked = !!st.pl;
  $('sx-relief').checked = !!st.rl;
  renderLegend();
  renderCard();
  syncTour();
}

/** Strings set from code (the static ones are translated by data-i18n): call after a language change. */
export function relabelSimple() {
  cardKey = null;
  if ($('sx-list') && !$('sx-list').hidden) runSearch();
  syncSimple();
}

// ---------------------------------------------------------------- search

let active = -1;
let results = [];

function wireSearch() {
  const q = $('sx-q');
  q.addEventListener('focus', () => { ensurePlaces().then(() => { if (q.value.trim()) runSearch(); }).catch(() => {}); });
  let timer = 0;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 60); });
  q.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      setActive((active + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length) choose(results[Math.max(0, active)]);
    } else if (e.key === 'Escape') {
      if (!$('sx-list').hidden) { e.preventDefault(); closeList(); }
    }
  });
  q.addEventListener('blur', () => setTimeout(closeList, 150));
}

function ensurePlaces() {
  if (places) return Promise.resolve(places);
  $('sx-status').textContent = t('sx.loadingPlaces');
  return loadPlaces().then((g) => {
    places = g.rows;
    $('sx-status').textContent = '';
    cardKey = null;
    renderCard();
    return places;
  }).catch((e) => { $('sx-status').textContent = t('sx.placesError', { msg: e.message }); throw e; });
}

async function runSearch() {
  const q = $('sx-q').value;
  if (!q.trim()) { closeList(); return; }
  const list = $('sx-list');
  const note = (cls, text) => {
    results = [];
    list.replaceChildren(h('li', { class: `sx-empty ${cls}`, role: 'option', 'aria-disabled': 'true', text }));
    list.hidden = false;
    $('sx-q').setAttribute('aria-expanded', 'true');
    setActive(-1);
  };
  // the gazetteer loads on the first focus; on a slow connection say so instead of showing nothing
  if (!places) note('sx-wait', t('sx.loadingPlaces'));
  try { await ensurePlaces(); } catch (e) { if ($('sx-q').value === q) note('sx-error', t('sx.placesError', { msg: e.message })); return; }
  if ($('sx-q').value !== q) return;
  results = searchPlaces(places, q);
  const L = lang();
  if (!results.length) {
    list.replaceChildren(h('li', { class: 'sx-empty', role: 'option', 'aria-disabled': 'true', text: t('sx.noResults', { q: q.trim() }) }));
  } else {
    list.replaceChildren(...results.map((p, i) => h('li', {
      role: 'option', id: `sx-opt-${i}`, 'aria-selected': 'false', 'data-place': String(p.i),
      onmousedown: (e) => e.preventDefault(),
      onclick: () => choose(p),
    }, h('span', { class: 'sx-opt-name', text: placeName(p, L) }), h('span', { class: 'sx-opt-where', text: [p.region, p.country].filter(Boolean).join(', ') }))));
  }
  list.hidden = false;
  $('sx-q').setAttribute('aria-expanded', 'true');
  $('sx-status').textContent = results.length ? t('sx.nResults', { n: results.length }) : t('sx.noResults', { q: q.trim() });
  setActive(results.length ? 0 : -1);
}

function setActive(i) {
  active = i;
  document.querySelectorAll('#sx-list [role=option]').forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
  if (i >= 0) {
    $('sx-q').setAttribute('aria-activedescendant', `sx-opt-${i}`);
    const el = $(`sx-opt-${i}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  } else $('sx-q').removeAttribute('aria-activedescendant');
}

function closeList() {
  $('sx-list').hidden = true;
  $('sx-q').setAttribute('aria-expanded', 'false');
  $('sx-q').removeAttribute('aria-activedescendant');
  active = -1;
}

function choose(p) {
  $('sx-q').value = placeName(p, lang());
  closeList();
  results = [];
  named = p;
  openPlace(p.lat, p.lon, { fly: true });
  $('sx-q').blur();
}

// ---------------------------------------------------------------- controls

function wireControls() {
  const st = () => S.state;
  document.querySelectorAll('#sx-yr [data-sr]').forEach((b) => b.addEventListener('click', () => { st().sr = +b.dataset.sr; cardKey = null; S.update(); }));
  document.querySelectorAll('#sx-mag [data-sm]').forEach((b) => b.addEventListener('click', () => {
    st().sm = +b.dataset.sm;
    S.update();
    if (st().sm === 5) loadM5();
  }));
  $('sx-plates').addEventListener('change', (e) => { st().pl = e.target.checked ? 1 : 0; S.update(); });
  $('sx-relief').addEventListener('change', (e) => { st().rl = e.target.checked ? 1 : 0; S.update(); });
  $('sx-opts-btn').addEventListener('click', () => {
    const open = !$('sx-top').classList.contains('opts-open');
    $('sx-top').classList.toggle('opts-open', open);
    $('sx-opts-btn').setAttribute('aria-expanded', String(open));
  });
}

/** M5 events are a 7.5 MB file: load it only when the visitor asks for M5+. */
export function loadM5() {
  const m5 = S.ctx.manifest && S.ctx.manifest.files['events_m5.json'];
  $('sx-yr-hint').textContent = t('sx.loadingM5', { size: m5 ? mb(m5.bytes) : '' });
  M.loadM5().then(() => { $('sx-yr-hint').textContent = ''; S.update(); })
    .catch((e) => { $('sx-yr-hint').textContent = `${e.message} ${t('sx.m5Fallback')}`; S.state.sm = 6; S.update(); });
}

// ---------------------------------------------------------------- legend

function renderLegend() {
  const el = $('sx-legend');
  const st = S.state;
  const ev = M.getEvents();
  if (!ev.e6) { el.replaceChildren(h('p', { class: 'sxl-note', text: t('sx.loadingEvents') })); return; }
  const { y0, y1, minM } = M.simpleFilterValues();
  const showM5 = minM < 6;
  const ramp = M.depthRamp();
  const heat = M.heatRamp();
  const z = M.getZoom();
  const sizes = [6, 7, 8, 9].filter((m) => m >= minM || m === 6).map((m) => {
    const r = Math.max(1.5, M.radiusFor(m, z, true));
    return h('span', {}, h('i', { style: `width:${2 * r}px;height:${2 * r}px` }), `M${m}`);
  });
  const fromYear = showM5 && !st.sr ? Math.max(y0, 1973) : y0;
  const countText = t('sx.lgCount', { n: f.int(M.simpleCount()) });
  // The legend itself is not a live region (it is redrawn on zoom); a short status line says what the filter shows.
  const live = `${t('sx.lgTitle', { m: minM, y0, y1 })}: ${countText}`;
  if ($('sx-live').dataset.text !== live) {
    if ($('sx-live').dataset.text !== undefined) $('sx-live').textContent = live;
    $('sx-live').dataset.text = live;
  }
  el.replaceChildren(
    h('div', { class: 'sxl-head' },
      h('span', { class: 'sxl-title' }, t('sx.lgTitle', { m: minM, y0, y1 }), infoButton('magnitude-types')),
      h('span', { class: 'sxl-count', id: 'sx-count', text: countText })),
    h('ul', { class: 'sxl-depth' }, ['sh', 'mid', 'deep'].map((k, i) => h('li', {},
      h('i', { class: 'sxl-dot', style: `background:${ramp[i]}`, 'aria-hidden': 'true' }), h('span', { text: t(`sx.depth.${k}`) })))),
    h('div', { class: 'sxl-sizes', 'aria-hidden': 'true' }, sizes),
    h('div', { class: 'sxl-heat' },
      h('span', { class: 'sxl-ramp', 'aria-hidden': 'true', style: `background:linear-gradient(90deg, ${heat[1]}, ${heat[2]}, ${heat[3]}, ${heat[4]})` }),
      h('span', {}, t(showM5 ? 'sx.lgHeatM5' : 'sx.lgHeat', { y0: fromYear }), infoButton('not-a-forecast'))),
    st.pl ? h('div', { class: 'sxl-plates' }, h('span', { class: 'sw sw-line', 'aria-hidden': 'true' }), h('span', {}, t('sx.lgPlates'), infoButton('plate-boundary-classes'))) : null,
  );
}

// ---------------------------------------------------------------- place card

/** Open the place card for a point (map click or search). */
export function openPlace(lat, lon, { fly = false } = {}) {
  const st = S.state;
  if (named && (Math.abs(named.lat - lat) > 1e-3 || Math.abs(named.lon - lon) > 1e-3)) named = null;
  st.p = { lat: +lat.toFixed(3), lon: +lon.toFixed(3) };
  cardKey = null;
  S.update(true);
  if (fly) M.showPlace(st.p.lat, st.p.lon, st.pr);
  else M.revealCell(st.p.lon, st.p.lat, 'sx-card');
  // name the point after the nearest listed place: load the gazetteer on the first click too
  if (!places) ensurePlaces().catch(() => {});
  $('sx-card').focus({ preventScroll: true });
}

export function closePlace() {
  S.state.p = null;
  named = null;
  S.update();
}

function placeTitle(lat, lon) {
  const L = lang();
  if (named) return { title: placeName(named, L), meta: [named.region, named.country].filter(Boolean).join(', ') };
  const near = places ? nearestPlace(places, lat, lon) : null;
  if (near && near.km < 1.5) return { title: placeName(near.place, L), meta: [near.place.region, near.place.country].filter(Boolean).join(', ') };
  if (near && near.km <= 60) return { title: f.latlon(lat, lon), meta: t('sx.nearPlace', { km: f.int(near.km), name: placeName(near.place, L), country: near.place.country }) };
  return { title: f.latlon(lat, lon), meta: '' };
}

const evDate = (ev) => f.decYearDate(ev.y);

function eventLine(kind, ev) {
  if (!ev) return null;
  const txt = t(`sx.${kind}Val`, { m: f.mag(ev.m), date: evDate(ev), d: f.int(ev.d) });
  return h('div', { class: 'sx-row', 'data-row': kind },
    h('dt', { text: t(`sx.${kind}`) }),
    h('dd', {}, h('span', { class: 'sx-row-val', text: txt }),
      ev.id ? h('a', { href: USGS + encodeURIComponent(ev.id), ...EXT, class: 'sx-usgs', text: t('sx.usgs') }) : null));
}

function renderCard() {
  const st = S.state;
  const card = $('sx-card');
  const show = st.mode === 'simple' && st.v === 'map' && !!st.p;
  document.getElementById('view-map').classList.toggle('sx-has-card', show);
  if (!show) {
    if (!card.hidden) { card.hidden = true; M.resize(); }
    M.setPlace(null);
    cardKey = null;
    return;
  }
  const ev = M.getEvents().e6;
  const { lat, lon } = st.p;
  const wasHidden = card.hidden;
  card.hidden = false;
  if (wasHidden) M.resize();
  M.setPlace({ lat, lon, r: st.pr });
  const { y0, y1, minM } = M.simpleFilterValues();
  // with the 5+ filter (and the M5 file loaded) the card counts M5+ like the map; otherwise M6+ and M7+
  const e5 = minM < 6 ? M.getEvents().e5 : null;
  // a regional catalogue whose box contains the place (with the typical Mc the pointer names)
  const region = [S.regionAt ? S.regionAt(lat, lon) : null].find((r) => r && Number.isFinite(r.mc_typical)) || null;
  const key = [lat, lon, st.pr, y0, y1, e5 ? 5 : 6, lang(), named ? named.i : '', places ? 1 : 0, ev ? 1 : 0, rating ? 1 : 0, ratingError ? 1 : 0, region ? region.id : ''].join('|');
  if (key === cardKey) return;
  cardKey = key;
  if (!places) ensurePlaces().catch(() => {}); // names the point; renders the card again when loaded
  const head = placeTitle(lat, lon);
  $('sx-card-title').textContent = head.title;
  $('sx-card-meta').textContent = head.meta;
  const body = $('sx-card-body');
  if (!rating && !ratingError) ensureRating();
  if (ratingError) {
    body.replaceChildren(h('p', { class: 'sx-error', role: 'alert' }, `${ratingError} `,
      h('button', { type: 'button', class: 'small-btn', text: t('common.retry'), onclick: () => { ratingError = null; cardKey = null; renderCard(); } })));
    return;
  }
  if (!ev || !rating) { body.replaceChildren(h('p', { class: 'muted sx-loading', text: t('sx.loadingEvents') })); return; }

  const s = placeStats(ev, lat, lon, st.pr, y0, y1, e5 ? { minM: 5, e5 } : {});
  const nAll = e5 ? s.n5 : s.n6;
  const cell = cellAtPoint(rating, lat, lon);
  const rate = cell ? cell.rating : 'few';
  const radiusSeg = h('div', { class: 'sx-seg sx-radius', role: 'group', 'aria-label': t('sx.radiusLabel') },
    RADII.map((r) => h('button', { type: 'button', 'data-pr': String(r), 'aria-pressed': String(r === st.pr), text: t('sx.within', { km: f.int(r) }), onclick: () => { st.pr = r; S.update(); M.showPlace(lat, lon, r); } })));

  const big = (n, label, attr) => h('div', { class: 'sx-big', 'data-stat': attr },
    h('span', { class: 'sx-big-n mono', text: f.int(n) }), h('span', { class: 'sx-big-l', text: label }));

  const counts = h('section', { class: 'sx-sec', 'aria-labelledby': 'sx-h-counts' },
    h('h3', { id: 'sx-h-counts', class: 'sr-only', text: t('sx.countsHead') }),
    radiusSeg,
    h('div', { class: 'sx-bigs' }, e5 ? [big(s.n5, t('sx.n5'), 'n5'), big(s.n6, t('sx.n6'), 'n6')] : [big(s.n6, t('sx.n6'), 'n6'), big(s.n7, t('sx.n7'), 'n7')]),
    h('p', { class: 'sx-years', 'data-stat': 'years', text: t('sx.yearsLine', { y0, y1, km: f.int(st.pr) }) }),
    nAll === 0 ? h('p', { class: 'sx-none', text: t(e5 ? 'sx.noneHere5' : 'sx.noneHere', { km: f.int(st.pr), y0, y1 }) }) : null,
    nAll ? h('dl', { class: 'sx-rows' },
      eventLine('largest', s.largest),
      eventLine('recent', s.recent),
      h('div', { class: 'sx-row', 'data-row': 'depth' }, h('dt', { text: t('sx.depthHead') }),
        h('dd', { text: t(`sx.depthVal.${s.depthClass}`, { d: f.int(s.medianDepth) }) }))) : null);

  const rateSec = h('section', { class: 'sx-sec sx-rating', 'data-rating': rate, 'aria-labelledby': 'sx-h-rate' },
    h('h3', { id: 'sx-h-rate' }, t('sx.rateHead'), infoButton('recording-rating')),
    h('div', { class: 'sx-meter-row' },
      h('span', { class: `sx-meter m-${rate}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('strong', { class: 'sx-rate-label', text: t(`sx.rate.${rate}`) })),
    h('p', { class: 'sx-rate-text', text: t(`sx.rateText.${rate}`, rateVars()) }),
    h('p', { class: 'sx-basis', text: basisLine(cell) }),
    region ? h('p', { class: 'sx-regional', 'data-region': region.id }, `${t('sx.regional', { name: region.name, mc: f.mag(region.mc_typical) })} `,
      h('button', { type: 'button', class: 'small-btn sx-regional-btn', onclick: () => S.openRegional(region.id, lat, lon), text: t('sx.regionalBtn') })) : null,
    cell ? h('button', { type: 'button', class: 'btn-primary sx-pro-btn', 'data-cell': cell.id, onclick: () => S.openExpert(cell.id, lat, lon), text: t('sx.proBtn') }) : null);

  const honest = h('p', { class: 'sx-honest', role: 'note', text: t('sx.honest') });
  body.replaceChildren(counts, rateSec, honest);
}

/** Load the rating lookup once; the card renders again when it arrives (or shows the error with a retry). */
function ensureRating() {
  loadRating().then((r) => { rating = r; cardKey = null; renderCard(); })
    .catch((e) => { ratingError = e.message; cardKey = null; renderCard(); });
}

/** The rule numbers the rating texts name: the minimum event count and the sample radius (from manifest.json). */
function rateVars() {
  const m = S.ctx.manifest.method;
  return { n: f.int(ruleNumber(m.quality.insufficient)), km: f.int(m.sample_radius_km) };
}

function basisLine(p) {
  if (!p) return '';
  const flag = t(`sx.flag.${p.c_flag}`);
  const mc = typeof p.sh_mc === 'number' ? `Mc ${f.mag(p.sh_mc)}` : t('sx.noMc');
  const q = p.sh_q === 'insufficient' ? t('q.insufficient') : t('q.quality', { q: p.sh_q });
  return t('sx.basis', { area: f.int(Math.round(p.area_km2 / 1000) * 1000), r: f.int(S.ctx.manifest.method.sample_radius_km), q, mc, flag });
}

// ---------------------------------------------------------------- first-visit tour

const TOUR = ['dots', 'heat', 'search'];
function tourDone() { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch (e) { return false; } }
function setTourDone() { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* storage blocked */ } }

function wireTour() {
  $('sx-tour-skip').addEventListener('click', () => endTour());
  $('sx-tour-next').addEventListener('click', () => {
    if (tourStep >= TOUR.length - 1) { endTour(); $('sx-q').focus(); return; }
    tourStep++;
    renderTour();
  });
  $('sx-tour').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); endTour(); } });
}

function endTour() {
  const hadFocus = $('sx-tour').contains(document.activeElement);
  setTourDone();
  tourStep = -1;
  $('sx-tour').hidden = true;
  document.body.dataset.tour = '';
  if (hadFocus) $('sx-q').focus({ preventScroll: true });
}

/** The tour starts once the map is ready, in the simple map view, unless it was finished or skipped before. */
export function startTour() {
  if (tourDone() || tourStep >= 0) return;
  tourStep = 0;
  syncTour();
  // a dialog: move the focus into it, so keyboard and screen-reader users meet it (Escape closes it from anywhere)
  if (!$('sx-tour').hidden) $('sx-tour').focus({ preventScroll: true });
}

function syncTour() {
  const st = S.state;
  const show = tourStep >= 0 && st.mode === 'simple' && st.v === 'map';
  $('sx-tour').hidden = !show;
  if (show) renderTour();
}

function renderTour() {
  const k = TOUR[tourStep];
  document.body.dataset.tour = k;
  $('sx-tour-step').textContent = t('tour.step', { i: tourStep + 1, n: TOUR.length });
  $('sx-tour-title').textContent = t(`tour.${k}.title`);
  $('sx-tour-text').textContent = t(`tour.${k}.text`);
  $('sx-tour-next').textContent = t(tourStep === TOUR.length - 1 ? 'tour.done' : 'tour.next');
  $('sx-tour-skip').hidden = tourStep === TOUR.length - 1;
  placeTour();
}

/** Keep the tour box off the legend it explains: lift it above the legend when the two would overlap. */
function placeTour() {
  const box = $('sx-tour');
  box.style.bottom = '';
  const lg = $('sx-legend').getBoundingClientRect(), tb = box.getBoundingClientRect();
  if (!lg.height || !tb.height) return;
  const overlap = tb.left < lg.right && tb.right > lg.left && tb.top < lg.bottom && tb.bottom > lg.top;
  if (!overlap) return;
  const area = $('map-area').getBoundingClientRect();
  box.style.bottom = `${Math.round(area.bottom - lg.top + 10)}px`;
}
