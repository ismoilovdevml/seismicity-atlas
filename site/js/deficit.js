// Seismic-deficit layer (Scientist view, pilot: Tien Shan). Data: site/data/deficit/ (contract in docs/deficit.md).
// Rules from that contract, enforced here:
//   - a ratio is never shown without its 95 % interval and p_full (every ratio string comes from ratioText());
//   - zones with q = few (n6 < 5) or nogeod are greyed and hatched;
//   - a zone is coloured as a deficit only when p_full < 0.05 (no zone reaches it at the 2026-11-13 cut-off), and the
//     colour is never red;
//   - the headline conclusion and the caveats are always shown with the layer.

import * as f from './fmt.js';
import { h, forestChart } from './charts.js';
import { getJSON } from './data.js';
import { t } from './i18n/index.js';
import { infoButton } from './info.js';
import { defineKeys, intIn, oneOf } from './hashx.js';
import * as M from './map.js';
import { cssVar } from './layers.js';

const REGION_IDS = ['tienshan', 'ts_west', 'ts_central', 'ts_east'];
const ZONE_RE = /^(tienshan|ts_west|ts_central|ts_east|[0-9a-f]{15})$/;
defineKeys([
  { key: 'df', def: 0, parse: intIn(0, 1) },
  { key: 'dz', def: null, parse: (s) => (ZONE_RE.test(s) ? s : undefined) },
  { key: 'dv', def: 'r', parse: oneOf(['r', 'c']) },
]);

export const P_DEFICIT = 0.05;
const LAYERS = ['df-fill', 'df-hatch', 'df-line', 'df-sel', 'df-belt'];
const BBOX = [69, 37, 92.5, 46.5];

let C = null; // {state, update, onZone}
let data = null; // {idx, regions, cells}
let loading = null;

export function loadDeficit() {
  if (!loading) {
    loading = Promise.all([getJSON('deficit/index.json'), getJSON('deficit/regions.geojson'), getJSON('deficit/cells.geojson')])
      .then(([idx, regions, cells]) => { data = { idx, regions, cells }; return data; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

const lookup = (id) => {
  if (!data) return null;
  for (const fc of [data.regions, data.cells]) for (const ft of fc.features) if (ft.properties.id === id) return ft.properties;
  return null;
};
const isGrey = (p) => p.q === 'few' || p.q === 'nogeod';
const hasRatio = (p) => p.q !== 'nogeod' && f.isNum(p.r_obs) && f.isNum(p.r_obs_lo) && f.isNum(p.r_obs_hi) && f.isNum(p.p_full);
const zoneName = (p) => (REGION_IDS.includes(p.id) ? t(`df.zone.${p.id}`) : t('df.cellName', { loc: f.latlon(p.lat, p.lon) }));
const r2 = (v) => (v === 0 ? '0' : v < 10 ? f.fixed(v, 2) : f.fixed(v, 1));
const pTxt = (v) => (v < 0.01 ? '< 0.01' : f.fixed(v, 2));

/** The only way a ratio reaches the screen: value, 95 % interval and p_full together. */
export function ratioText(p, which = 'obs') {
  const v = p[`r_${which}`], lo = p[`r_${which}_lo`], hi = p[`r_${which}_hi`];
  return t('df.ratioVal', { v: r2(v), lo: r2(lo), hi: r2(hi), p: pTxt(p.p_full) });
}

// ------------------------------------------------------------------ controls in the map rail

export function initDeficit(ctx) {
  C = ctx;
  const fs = document.getElementById('chk-plates').closest('fieldset');
  const box = h('input', { type: 'checkbox', id: 'chk-deficit' });
  const lbl = h('label', { class: 'check' }, box, ' ', h('span', { id: 'lbl-deficit', text: t('df.rail') }));
  const seg = h('div', { class: 'seg', id: 'df-view', role: 'radiogroup', 'aria-label': t('df.viewLabel') },
    ['r', 'c'].map((v) => h('label', {}, h('input', { type: 'radio', name: 'dfview', value: v }), h('span', { 'data-dfv': v, text: t(`df.view.${v}`) }))));
  const opts = h('div', { class: 'df-opts', id: 'df-opts', hidden: true }, seg, h('p', { class: 'hint', id: 'df-hint', text: t('df.railHint') }));
  const row = h('div', { class: 'check-row df-row' }, lbl, infoButton('seismic-moment-budget'));
  fs.querySelector('.events-opts').after(row, opts);
  box.addEventListener('change', () => {
    C.state.df = box.checked ? 1 : 0;
    if (!box.checked) C.state.dz = null;
    ensure().then(() => { if (box.checked && !C.state.dz) M.fitBbox(BBOX); C.update(); }).catch(() => {});
    C.update();
  });
  seg.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { C.state.dv = i.value; C.state.dz = null; C.update(); }));
  M.addOverlay({ layers: ['df-fill'], tip: (p) => tip(lookup(p.id) || p), click: (p) => C.onZone(p.id), legend, apply, theme });
}

/** Load the data and add the map layers once. */
function ensure() {
  return loadDeficit().then(() => {
    const map = M.getMap();
    if (!map || map.getSource('deficit')) return;
    map.addSource('deficit', { type: 'geojson', data: features(), promoteId: 'id' });
    map.addSource('deficit-belt', { type: 'geojson', data: features(data.regions.features.filter((ft) => ft.properties.id === 'tienshan')) });
    const before = 'coast';
    map.addLayer({ id: 'df-fill', type: 'fill', source: 'deficit', paint: { 'fill-color': fillExpr(), 'fill-opacity': ['case', ['in', ['get', 'q'], ['literal', ['few', 'nogeod']]], 0.32, 0.5] } }, before);
    map.addLayer({ id: 'df-hatch', type: 'fill', source: 'deficit', filter: ['in', ['get', 'q'], ['literal', ['few', 'nogeod']]], paint: { 'fill-pattern': 'hatch' } }, before);
    map.addLayer({ id: 'df-line', type: 'line', source: 'deficit', paint: { 'line-color': cssVar('--ink-3'), 'line-width': 1 } }, before);
    map.addLayer({ id: 'df-belt', type: 'line', source: 'deficit-belt', paint: { 'line-color': cssVar('--ink'), 'line-width': 1.4, 'line-dasharray': [4, 2] } });
    map.addLayer({ id: 'df-sel', type: 'line', source: 'deficit', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': cssVar('--ink'), 'line-width': 2.6 } });
  });
}

/** Zones of the current view (full properties, for the legend counts). */
function zones() {
  if (C.state.dv === 'c') return data.cells.features;
  return data.regions.features.filter((ft) => ft.properties.id !== 'tienshan');
}

/**
 * What the map source gets: geometry with id, q and p_full only. MapLibre encodes integer properties as varints in its
 * worker, and moment rates such as 3.03e19 N m/yr do not fit; the tooltip and panel read the full record by id.
 */
function features(list = zones()) {
  return { type: 'FeatureCollection', features: list.map((ft) => ({ type: 'Feature', geometry: ft.geometry, properties: { id: ft.properties.id, q: ft.properties.q, p_full: ft.properties.p_full ?? 1 } })) };
}

function fillExpr() {
  return ['case', ['in', ['get', 'q'], ['literal', ['few', 'nogeod']]], cssVar('--nodata'),
    ['<', ['get', 'p_full'], P_DEFICIT], cssVar('--df-def'), cssVar('--df-ok')];
}

let shownView = null;
function apply() {
  const st = C.state;
  const box = document.getElementById('chk-deficit');
  if (box) {
    box.checked = !!st.df;
    document.getElementById('df-opts').hidden = !st.df;
    document.querySelectorAll('input[name=dfview]').forEach((i) => { i.checked = i.value === st.dv; });
  }
  const map = M.getMap();
  const on = !!st.df && st.mode === 'pro';
  if (on && !map.getSource('deficit')) { ensure().then(() => M.applyLayers()).catch(() => {}); return; }
  if (!map.getSource('deficit')) return;
  if (shownView !== st.dv) { map.getSource('deficit').setData(features()); shownView = st.dv; }
  for (const id of LAYERS) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  map.setFilter('df-sel', ['==', ['get', 'id'], st.dz || '']);
}

function theme() {
  const map = M.getMap();
  if (!map || !map.getLayer('df-fill')) return;
  map.setPaintProperty('df-fill', 'fill-color', fillExpr());
  map.setPaintProperty('df-line', 'line-color', cssVar('--ink-3'));
  map.setPaintProperty('df-belt', 'line-color', cssVar('--ink'));
  map.setPaintProperty('df-sel', 'line-color', cssVar('--ink'));
}

function tip(p) {
  const node = h('div', { class: 'df-tip' });
  node.append(h('div', { class: 'tt-main' }, h('strong', { text: zoneName(p) })));
  if (hasRatio(p)) node.append(h('div', { class: 'tt-sub', 'data-ratio': '1', text: `${t('df.obsShort')} ${ratioText(p)}` }));
  else node.append(h('div', { class: 'tt-sub', text: t('df.noGeod') }));
  if (p.q === 'few') node.append(h('div', { class: 'tt-sub', text: t('df.fewShort', { n: f.int(p.n6) }) }));
  node.append(h('div', { class: 'tt-foot', text: t('df.tipClick') }));
  return node;
}

/** Legend block: the headline, the classes with counts, and the disclaimer. */
function legend() {
  const st = C.state;
  if (!st.df || !data) return null;
  const fc = zones().map((ft) => ft.properties);
  const n = { ok: 0, def: 0, grey: 0 };
  for (const p of fc) n[isGrey(p) ? 'grey' : p.p_full < P_DEFICIT ? 'def' : 'ok']++;
  return h('div', { class: 'lg-df' },
    h('strong', {}, t('df.legendHead'), infoButton('seismic-moment-budget')),
    h('span', { class: 'df-headline', text: headline().title }),
    h('ul', { class: 'lg-rows' },
      h('li', {}, h('span', { class: 'sw sw-dfok', 'aria-hidden': 'true' }), h('span', { text: t('df.lgOk') }), h('span', { class: 'cnt', text: f.int(n.ok) })),
      h('li', {}, h('span', { class: 'sw sw-dfdef', 'aria-hidden': 'true' }), h('span', { text: t('df.lgDef') }), h('span', { class: 'cnt', text: f.int(n.def) })),
      h('li', {}, h('span', { class: 'sw sw-hatch', 'aria-hidden': 'true' }), h('span', { text: t('df.lgFew') }), h('span', { class: 'cnt', text: f.int(n.grey) }))),
    h('span', { class: 'lg-count', text: t('df.lgNote') }));
}

/** The conclusion over the four regions, worded from the data. */
function headline() {
  const regs = data.regions.features.map((ft) => ft.properties).filter((p) => hasRatio(p) && p.q === 'ok');
  const sig = regs.filter((p) => p.p_full < P_DEFICIT);
  const ps = regs.map((p) => p.p_full);
  if (!sig.length) return { ok: true, title: t('df.headNone'), text: t('df.headNoneTxt', { lo: pTxt(Math.min(...ps)), hi: pTxt(Math.max(...ps)), n: regs.length }) };
  return { ok: false, title: t('df.headSome', { zones: sig.map(zoneName).join(', ') }), text: t('df.headSomeTxt') };
}

// ------------------------------------------------------------------ panel

export async function renderDeficitPanel(id) {
  const panel = document.getElementById('panel');
  const body = document.getElementById('panel-body');
  panel.classList.remove('full');
  panel.hidden = false;
  document.getElementById('panel-eyebrow').textContent = t('df.eyebrow');
  body.replaceChildren(h('div', { class: 'loading', role: 'status', text: t('common.loading', { what: t('df.loadingWhat') }) }));
  try { await loadDeficit(); } catch (e) { body.replaceChildren(h('p', { class: 'error', role: 'alert', text: e.message })); return; }
  const p = lookup(id);
  if (!p) { body.replaceChildren(h('p', { class: 'hint', text: t('df.unknown') })); return; }
  document.getElementById('panel-title').textContent = zoneName(p);
  const meta = document.getElementById('panel-meta');
  meta.textContent = t('df.meta', { area: f.int(p.area_km2), models: (p.models || []).length, n6: f.int(p.n6), nev: f.int(p.n_ev) });
  meta.append(' ', infoButton('seismic-moment-budget'));

  const hd = headline();
  const out = h('div', { class: 'df-panel' });
  out.append(h('div', { class: `df-head${hd.ok ? '' : ' some'}`, role: 'note' }, h('strong', { text: hd.title }), h('p', { text: hd.text })));
  out.append(zoneBlock(p));
  out.append(regionChart());
  out.append(h('section', {}, h('h3', { class: 'df-h', text: t('df.zonesH') }),
    h('div', { class: 'df-zone-links' }, REGION_IDS.map((rid) => h('button', { type: 'button', class: 'small-btn', 'aria-pressed': String(rid === id), text: t(`df.zone.${rid}`), onclick: () => C.onZone(rid) })))));
  out.append(h('section', {}, h('h3', { class: 'df-h', text: t('df.caveatsH') }),
    h('ul', { class: 'df-caveats' }, ['length', 'early', 'aseismic', 'geodetic', 'outline'].map((k) => h('li', { text: t(`df.cav.${k}`) })))));
  out.append(h('p', { class: 'notice df-disclaimer', text: t('df.disclaimer') }));
  out.append(h('p', { class: 'df-src' }, `${t('df.attribution')}: ${data.idx.attribution} `, t('df.notUsed')));
  body.replaceChildren(out);
}

function zoneBlock(p) {
  const blk = h('section', { class: `df-zone${isGrey(p) ? ' few' : ''}`, 'data-zone': p.id });
  blk.append(h('h3', { text: t('df.zoneH') }));
  if (!hasRatio(p)) {
    blk.append(h('p', { text: t('df.noGeod') }));
    return blk;
  }
  if (p.q === 'few') blk.append(h('p', { class: 'df-few', text: t('df.few', { n: f.int(p.n6) }) }));
  blk.append(h('p', { class: 'df-ratio', 'data-ratio': 'obs', text: ratioText(p, 'obs') }));
  blk.append(h('p', { text: t('df.obsExplain', { pct: Math.round(p.p_full * 100) }) }));
  if (p.r_obs === 0) blk.append(h('p', { text: t('df.zeroObs') }));
  blk.append(h('p', { 'data-ratio': 'tgr' }, h('strong', { text: `${t('df.tgrLabel')} ` }), ratioText(p, 'tgr')));
  if (f.isNum(p.r_obs_x1) && p.r_obs > 0 && p.r_obs_x1 > 0 && f.isNum(p.mw_max)) {
    blk.append(h('p', { text: t('df.x1', { m: f.fixed(p.mw_max, 2), y: String(p.mw_max_yr), k: f.fixed(p.r_obs / p.r_obs_x1, 1) }) }));
  }
  const dl = h('dl', { class: 'facts df-facts' });
  const fact = (k, v) => dl.append(h('dt', { text: k }), h('dd', { text: v }));
  fact(t('df.mg'), `${sci(p.mg)} [${sci(p.mg_lo)}, ${sci(p.mg_hi)}] ${t('unit.nmyr')}`);
  fact(t('df.msObs'), `${sci(p.ms_obs)} ${t('unit.nmyr')}`);
  fact(t('df.pHalf'), pTxt(p.p_half));
  fact(t('df.mcBal'), `Mw ${f.fixed(p.mc_bal, 2)}`);
  fact(t('df.models'), (p.models || []).join(', '));
  fact(t('df.cov'), `${Math.round((p.cov_min || 0) * 100)} %`);
  blk.append(dl);
  return blk;
}

function sci(v) {
  if (!f.isNum(v)) return '–';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  return `${(v / 10 ** e).toFixed(2)}×10^${e}`;
}

function regionChart() {
  const regs = REGION_IDS.map(lookup).filter(Boolean);
  const rows = [];
  for (const p of regs) {
    if (!hasRatio(p)) { rows.push({ label: zoneName(p), v: null, text: t('df.noGeodShort') }); continue; }
    const grey = p.q === 'few';
    rows.push({ label: `${zoneName(p)} · ${t('df.obsShort')}`, v: p.r_obs, lo: p.r_obs_lo, hi: p.r_obs_hi, color: grey ? 'var(--nodata)' : 'var(--s1)', hollow: grey, text: `${r2(p.r_obs)} [${r2(p.r_obs_lo)}, ${r2(p.r_obs_hi)}]`, tipName: ratioText(p, 'obs') });
    rows.push({ label: `${zoneName(p)} · ${t('df.tgrShort')}`, v: p.r_tgr, lo: p.r_tgr_lo, hi: p.r_tgr_hi, color: grey ? 'var(--nodata)' : 'var(--s2)', hollow: grey, text: `${r2(p.r_tgr)} [${r2(p.r_tgr_lo)}, ${r2(p.r_tgr_hi)}]`, tipName: ratioText(p, 'tgr') });
  }
  return forestChart({
    title: t('df.chartTitle'), sub: t('df.chartSub'), alt: t('df.chartAlt'), log: true, domain: [0.1, 30], ticks: [0.1, 0.3, 1, 3, 10, 30],
    labelWidth: 190, rows, ref: { value: 1, label: t('df.chartRef') }, x: { label: t('df.chartAxis') },
    legend: [{ name: t('df.obsShort'), color: 'var(--s1)', key: 'dot', type: 'dots' }, { name: t('df.tgrShort'), color: 'var(--s2)', key: 'dot', type: 'dots' }],
    table: { columns: [t('df.colZone'), t('df.colObs'), t('df.colTgr'), 'p_full', t('df.colQ')],
      rows: regs.map((p) => (hasRatio(p) ? [zoneName(p), `${r2(p.r_obs)} [${r2(p.r_obs_lo)}, ${r2(p.r_obs_hi)}]`, `${r2(p.r_tgr)} [${r2(p.r_tgr_lo)}, ${r2(p.r_tgr_hi)}]`, pTxt(p.p_full), p.q] : [zoneName(p), '–', '–', '–', p.q])) },
    note: t('df.chartNote'),
  });
}

/** Relabel the static rail control after a language change. */
export function relabelDeficit() {
  const l = document.getElementById('lbl-deficit');
  if (!l) return;
  l.textContent = t('df.rail');
  document.getElementById('df-hint').textContent = t('df.railHint');
  document.getElementById('df-view').setAttribute('aria-label', t('df.viewLabel'));
  document.querySelectorAll('[data-dfv]').forEach((s) => { s.textContent = t(`df.view.${s.dataset.dfv}`); });
}
