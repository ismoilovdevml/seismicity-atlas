// Side-by-side comparison of two cells' b-values. The verdict only ever reads the two 95 % intervals:
// overlapping intervals are never called "different".

import * as f from './fmt.js';
import { h, forestChart } from './charts.js';
import { qPill } from './panel.js';
import { t } from './i18n/index.js';

const hasB = (p, d) => p && (p[`${d}_q`] === 'A' || p[`${d}_q`] === 'B') && f.isNum(p[`${d}_b`]);

export function distanceKm(a, b) {
  const R = 6371.0088, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * {kind: 'missing'|'overlap'|'separate', ...}. Pure: depends only on the two cells' intervals.
 * 'separate' means the 95 % intervals do not overlap; it is a conservative check, not a test result.
 */
export function compareVerdict(a, b, d) {
  const missing = [['A', a], ['B', b]].filter(([, p]) => !hasB(p, d)).map(([k]) => k);
  if (missing.length) return { kind: 'missing', missing };
  const [alo, ahi, blo, bhi] = [a[`${d}_b_lo`], a[`${d}_b_hi`], b[`${d}_b_lo`], b[`${d}_b_hi`]];
  if (alo <= bhi && blo <= ahi) return { kind: 'overlap', lo: Math.max(alo, blo), hi: Math.min(ahi, bhi) };
  const gap = alo > bhi ? alo - bhi : blo - ahi;
  return { kind: 'separate', higher: a[`${d}_b`] > b[`${d}_b`] ? 'A' : 'B', gap };
}

function cellCard(key, p, d) {
  const name = p.regionName ? `${f.latlon(p.lat, p.lon)} · ${p.regionName}` : f.latlon(p.lat, p.lon);
  const q = p[`${d}_q`];
  const body = hasB(p, d)
    ? [h('span', { class: 'cmp-b mono', text: f.b2(p[`${d}_b`]) }),
      h('span', { class: 'mono cmp-ci', text: t('cmp.ci', { lo: f.b2(p[`${d}_b_lo`]), hi: f.b2(p[`${d}_b_hi`]) }) })]
    : [h('span', { class: 'cmp-b mono muted', text: '–' }), h('span', { class: 'cmp-ci', text: t('cmp.noB') })];
  return h('div', { class: 'cmp-card' },
    h('span', { class: 'cmp-key', 'aria-hidden': 'true', text: key }),
    h('div', { class: 'cmp-main' },
      h('span', { class: 'cmp-name', text: `${t('cmp.cell', { k: key })}: ${name}` }),
      h('div', { class: 'cmp-vals' }, body),
      h('span', { class: 'pill-line' }, qPill(q), t('cmp.nAbove', { n: f.int(p[`${d}_nb`] || 0) }))));
}

/** ctx: {state, manifest, onOpen(id), onEnd(), onSwap()} */
export function renderCompare(a, b, ctx) {
  const d = ctx.state.d;
  const panel = document.getElementById('panel');
  panel.classList.add('full');
  panel.hidden = false;
  document.getElementById('panel-eyebrow').textContent = t('cmp.eyebrow');
  document.getElementById('panel-title').textContent = t('cmp.title');
  document.getElementById('panel-meta').textContent = `${f.depthName(d)}. ${t('cmp.meta')}`;
  const body = document.getElementById('panel-body');
  const v = compareVerdict(a, b, d);
  const out = [];
  out.push(h('section', { class: 'cmp', 'aria-label': t('cmp.title') }, cellCard('A', a, d), cellCard('B', b, d)));

  if (v.kind !== 'missing') {
    const vals = [a[`${d}_b_lo`], a[`${d}_b_hi`], b[`${d}_b_lo`], b[`${d}_b_hi`], 1];
    const row = (k, p) => ({ label: t('cmp.cell', { k }), v: p[`${d}_b`], lo: p[`${d}_b_lo`], hi: p[`${d}_b_hi`], color: 'var(--s1)', text: f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]), tipName: t('cmp.quality', { q: p[`${d}_q`] }) });
    out.push(h('section', {}, forestChart({
      title: t('cmp.chartTitle'), sub: t('cmp.chartSub'), alt: t('cmp.chartAlt'),
      rows: [row('A', a), row('B', b)],
      domain: [Math.floor(Math.min(...vals) * 10) / 10 - 0.05, Math.ceil(Math.max(...vals) * 10) / 10 + 0.05],
      ref: { value: 1, label: 'b = 1' }, labelWidth: 80, tickFmt: (x) => x.toFixed(1),
      table: { columns: [t('cmp.colCell'), 'b', t('col.lo95'), t('col.hi95'), t('col.quality')], rows: [['A', a], ['B', b]].map(([k, p]) => [k, f.b2(p[`${d}_b`]), f.b2(p[`${d}_b_lo`]), f.b2(p[`${d}_b_hi`]), p[`${d}_q`]]) },
    })));
  }

  const verdict = h('section', { class: `cmp-verdict ${v.kind}`, role: 'status' });
  if (v.kind === 'missing') {
    verdict.append(h('strong', { text: t('cmp.missingHead') }), h('p', { text: t('cmp.missing', { cells: v.missing.join(` ${t('cmp.and')} `) }) }));
  } else if (v.kind === 'overlap') {
    verdict.append(h('strong', { text: t('cmp.overlapHead') }), h('p', { text: t('cmp.overlap', { lo: f.b2(v.lo), hi: f.b2(v.hi) }) }));
  } else {
    verdict.append(h('strong', { text: t('cmp.separateHead') }), h('p', { text: t('cmp.separate', { k: v.higher, gap: f.b2(v.gap) }) }));
  }
  const radius = ctx.manifest.method.sample_radius_km;
  const dist = distanceKm(a, b);
  const shared = !a.regionName && !b.regionName && dist < 2 * radius;
  verdict.append(h('p', { class: 'hint', text: t('cmp.distance', { km: f.int(dist) }) + (shared ? ` ${t('cmp.shared', { r: radius })}` : '') }));
  if (!!a.regionName !== !!b.regionName || (a.regionName && a.regionName !== b.regionName)) verdict.append(h('p', { class: 'hint', text: t('cmp.mixedCatalogues') }));
  verdict.append(h('p', { class: 'hint', text: t('cmp.caveat') }));
  out.push(verdict);

  out.push(h('div', { class: 'panel-actions' },
    h('button', { class: 'btn', type: 'button', onclick: () => ctx.onOpen(a.id), text: t('cmp.openA') }),
    h('button', { class: 'btn', type: 'button', onclick: () => ctx.onOpen(b.id), text: t('cmp.openB') }),
    h('button', { class: 'btn', type: 'button', onclick: ctx.onSwap, text: t('cmp.swap') }),
    h('button', { class: 'btn primary', type: 'button', onclick: ctx.onEnd, text: t('cmp.end') })));
  body.replaceChildren(...out);
}
