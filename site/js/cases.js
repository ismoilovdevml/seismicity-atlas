// "Case studies" view (#v=cases&cs=<id>). One case so far: induced seismicity in the Groningen gas field
// (site/data/induced/groningen/, contract in docs/induced.md). A plain-language summary comes first for every visitor;
// the charts, the b map and the validation table follow as the details for scientists.
//
// Licence obligations (docs/induced.md): show the "not a forecast" statement with any view of the data, every source
// attribution (KNMI with the network DOI), "Source: NLOG.NL" next to the production curve and the field outline, and
// offer no download of single KNMI events. No b-value is drawn without its 95 % interval.

import * as f from './fmt.js';
import { h, svgEl, xyChart, forestChart } from './charts.js';
import { getJSON } from './data.js';
import { t } from './i18n/index.js';
import { infoButton } from './info.js';
import { defineKeys, oneOf } from './hashx.js';

export const CASES = ['groningen'];
defineKeys([{ key: 'cs', def: 'groningen', parse: oneOf(CASES) }]);

const DIR = 'induced/groningen';
const B_BREAKS = [0.8, 0.9, 1.0, 1.1, 1.2]; // the b classes of the map (layers.js), colours in --b-0 … --b-5
const KNMI_DOI = '10.21944/e970fd34-23b9-3411-b366-e4f72877d2c5';
// Phase keys by start month (labels in the data are English; the site translates them).
const PHASE = { '1991-01': 'pre', '2003-01': 'rise', '2014-01': 'restr', '2019-01': 'out', '2023-10': 'after' };

const errorBox = (root, e, retry) => root.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} `,
  h('button', { class: 'small-btn', type: 'button', onclick: retry, text: t('common.retry') })));

const decYear = (ym) => +ym.slice(0, 4) + (+ym.slice(5, 7) - 0.5) / 12;
const phaseName = (p) => t(`cs.ph.${PHASE[p.start] || 'pre'}`);
const bClass = (v) => { let i = 0; while (i < B_BREAKS.length && v >= B_BREAKS[i]) i++; return i; };
const bInt = (o) => (o && f.isNum(o.b) ? f.interval(o.b, o.lo, o.hi) : '–');

export function renderCases(root, ctx) {
  const run = () => {
    root.replaceChildren(h('div', { class: 'loading', role: 'status', text: t('common.loading', { what: t('cs.loadingWhat') }) }));
    Promise.all(['index', 'rates', 'btime', 'bmap', 'validation'].map((n) => getJSON(`${DIR}/${n}.json`)))
      .then(([idx, rates, btime, bmap, val]) => draw(root, { idx, rates, btime, bmap, val }, ctx))
      .catch((e) => errorBox(root, e, run));
  };
  run();
}

function draw(root, D, ctx) {
  const { idx, rates } = D;
  const out = [];
  out.push(h('nav', { class: 'cs-tabs', 'aria-label': t('cs.listLabel') },
    CASES.map((id) => h('a', { href: `#v=cases&cs=${id}`, 'aria-current': id === ctx.state.cs ? 'page' : null, text: t(`cs.case.${id}`) }))));
  out.push(h('header', { class: 'cs-head' },
    h('p', { class: 'cs-kicker', text: t('cs.kicker') }),
    h('h1', {}, t('cs.gr.h1'), infoButton('induced-seismicity'))));
  out.push(h('div', { class: 'notice cs-notice', role: 'note' },
    h('strong', { text: `${t('cs.notForecastStrong')} ` }), t('cs.notForecast'), ' ', infoButton('not-a-forecast')));
  out.push(summary(D));
  out.push(sources(idx, 'short'));

  out.push(h('section', { class: 'cs-details', 'aria-labelledby': 'cs-details-h' },
    h('div', { class: 'sec-head' }, h('h2', { id: 'cs-details-h', text: t('cs.detailsH') }), h('span', { class: 'sub', text: t('cs.detailsSub') })),
    facts(idx, rates)));
  out.push(section('cs.rateH', 'cs.rateSub', null, h('div', { class: 'card cs-stack' }, productionChart(rates), rateChart(rates), milestones(rates))));
  out.push(section('cs.phaseH', 'cs.phaseSub', 'confidence-interval-bootstrap', h('div', { class: 'card' }, phaseChart(rates), correlation(rates))));
  out.push(section('cs.bPhaseH', 'cs.bPhaseSub', 'b-positive', bPhaseTable(D.btime)));
  out.push(section('cs.movH', 'cs.movSub', 'b-positive', h('div', { class: 'card' }, movingChart(D.btime))));
  out.push(section('cs.mapH', 'cs.mapSub', 'gutenberg-richter-b-value', h('div', { class: 'card' }, bMap(D.bmap))));
  out.push(section('cs.valH', 'cs.valSub', null, validationTable(D.val)));
  out.push(h('section', { 'aria-labelledby': 'cs-src-h' }, h('h2', { id: 'cs-src-h', text: t('cs.srcH') }), sources(idx, 'full')));
  root.replaceChildren(...out);
}

function section(hKey, subKey, concept, body) {
  const id = `cs-${hKey.split('.')[1]}`;
  return h('section', { 'aria-labelledby': id },
    h('div', { class: 'sec-head' }, h('h3', { id }, t(hKey), concept ? infoButton(concept) : null), subKey ? h('span', { class: 'sub', text: t(subKey) }) : null),
    body);
}

// ------------------------------------------------------------------ plain-language summary

function summary({ rates }) {
  const ph = Object.fromEntries(rates.phases.map((p) => [PHASE[p.start], p]));
  const a = rates.annual;
  let peak = 0, peakYear = null;
  a.prod_bcm.forEach((v, i) => { if (v !== null && v > peak) { peak = v; peakYear = a.year[i]; } });
  const busy = (ph.rise.n_ge15 + ph.restr.n_ge15) / ((ph.rise.years + ph.restr.years) * 12);
  const after = ph.after.rate_per_yr;
  const ev = rates.events_ge3;
  const big = ev.ml.map((m, i) => ({ m, y: ev.time[i].slice(0, 10) })).filter((e) => e.m >= 3.4);
  const largest = big.reduce((x, y) => (y.m > x.m ? y : x), big[0]);
  const later = big.filter((e) => e.y > largest.y);
  const c = rates.correlation;
  const items = [
    t('cs.sum.busy', { n: f.fixed(busy, 1), mc: f.mag(rates.mc) }),
    t('cs.sum.peak', { v: f.fixed(peak, 1), y: String(peakYear) }),
    t('cs.sum.restr', { r0: f.fixed(ph.rise.rate_per_yr, 1), r1: f.fixed(ph.restr.rate_per_yr, 1), p0: f.fixed(ph.rise.prod_bcm_per_yr, 0), p1: f.fixed(ph.restr.prod_bcm_per_yr, 0) }),
    t('cs.sum.after', { r: f.fixed(after, 1), k: f.fixed(12 / after, 0) }),
    t('cs.sum.largest', { m: f.mag(largest.m), y: largest.y.slice(0, 4), later: later.map((e) => t('cs.sum.ml', { m: f.mag(e.m), d: e.y })).join(t('cs.sum.and')) }),
    t('cs.sum.corr', { rho: f.fixed(c.lag1_rho, 2) }),
  ];
  return h('section', { class: 'cs-summary', 'aria-labelledby': 'cs-sum-h' },
    h('h2', { id: 'cs-sum-h', text: t('cs.sumH') }),
    h('ul', { class: 'cs-points' }, items.map((x) => h('li', { text: x }))),
    h('p', { class: 'cs-plain-note', text: t('cs.sum.note') }));
}

function facts(idx, rates) {
  const dl = h('dl', { class: 'facts cs-facts' });
  const fact = (k, v) => dl.append(h('dt', { text: k }), h('dd', { text: v }));
  fact(t('cs.f.cutoff'), idx.catalogue_cutoff_utc.slice(0, 10));
  fact(t('cs.f.events'), t('cs.f.eventsVal', { n: f.int(idx.n_events_region) }));
  fact(t('cs.f.region'), t('cs.f.regionVal'));
  fact(t('cs.f.mag'), t('cs.f.magVal', { mc: f.mag(rates.mc) }));
  return dl;
}

// ------------------------------------------------------------------ production and rate

const MONTH_X = (rates) => rates.monthly.month.map(decYear);

function ruleList(rates, labelled) {
  return rates.milestones.map((m) => ({ value: decYear(m.date.slice(0, 7)), dashed: m.kind === 'policy', label: labelled && m.kind === 'policy' && m.short !== 'Closure act' ? t(`cs.msS.${m.date}`) : null }));
}

function productionChart(rates) {
  const xs = MONTH_X(rates);
  const pts = xs.map((x, i) => [x, rates.monthly.prod_bcm[i]]);
  const a = rates.annual;
  return xyChart({
    title: t('cs.prodTitle'), sub: t('cs.prodSub'), alt: t('cs.prodAlt'), height: 170, margin: { l: 44 },
    x: { domain: [1991, 2027], fmt: (v) => String(v) },
    y: { domain: [0, 7] },
    series: [{ name: t('cs.prodName'), color: 'var(--s1)', type: 'line', points: pts, fmt: (v) => (v === null ? t('cs.noProd') : t('cs.bcmMonth', { v: f.fixed(v, 2) })) }],
    xRules: ruleList(rates, true),
    hoverTitle: (x) => monthLabel(x),
    table: { columns: [t('cs.colYear'), t('cs.colProd')], rows: a.year.map((y, i) => [String(y), a.prod_bcm[i] === null ? '–' : f.fixed(a.prod_bcm[i], 2)]) },
    note: t('cs.nlog'),
  });
}

function monthLabel(x) {
  const y = Math.floor(x), m = Math.round((x - y) * 12 + 0.5);
  return `${y}-${String(m).padStart(2, '0')}`;
}

function rateChart(rates) {
  const xs = MONTH_X(rates);
  const n = rates.monthly.n_ge15;
  // events in the 12 months ending with each month: the monthly counts are 0-6, too noisy to read as a line
  const roll = n.map((_, i) => (i < 11 ? null : n.slice(i - 11, i + 1).reduce((s, v) => s + v, 0)));
  const a = rates.annual;
  return xyChart({
    title: t('cs.rateTitle', { mc: f.mag(rates.mc) }), sub: t('cs.rateSub2'), alt: t('cs.rateAlt'), height: 170, margin: { l: 44 },
    x: { domain: [1991, 2027], fmt: (v) => String(v) },
    y: { domain: [0, 30] },
    series: [{ name: t('cs.rateName'), color: 'var(--s2)', type: 'line', points: xs.map((x, i) => [x, roll[i]]), fmt: (v, x) => t('cs.rateTip', { v: f.int(v), m: f.int(n[xs.indexOf(x)]) }) }],
    xRules: ruleList(rates, false),
    hoverTitle: (x) => monthLabel(x),
    table: { columns: [t('cs.colYear'), t('cs.colEvents', { mc: f.mag(rates.mc) }), t('cs.colMonths')], rows: a.year.map((y, i) => [String(y), f.int(a.n_ge15[i]), String(a.months[i])]) },
    note: t('cs.rateNote'),
  });
}

function milestones(rates) {
  return h('div', { class: 'cs-ms' }, h('h4', { text: t('cs.msH') }),
    h('ul', {}, rates.milestones.map((m) => h('li', {}, h('span', { class: 'mono', text: m.date }), ' ', t(`cs.ms.${m.date}`), m.kind === 'policy' ? h('span', { class: 'cs-ms-kind', text: ` (${t('cs.msPolicy')})` }) : null))));
}

function phaseChart(rates) {
  return forestChart({
    title: t('cs.phaseTitle', { mc: f.mag(rates.mc) }), sub: t('cs.phaseChartSub'), alt: t('cs.phaseAlt'),
    domain: [0, 22], labelWidth: 210, x: { label: t('cs.perYear') },
    rows: rates.phases.map((p) => ({ label: phaseName(p), v: p.rate_per_yr, lo: p.rate_lo, hi: p.rate_hi, color: 'var(--s2)',
      text: f.interval(p.rate_per_yr, p.rate_lo, p.rate_hi, (v) => f.fixed(v, 1)), tipName: t('cs.phaseTip', { n: f.int(p.n_ge15), y: f.fixed(p.years, 2) }) })),
    table: { columns: [t('cs.colPhase'), t('cs.colEvents', { mc: f.mag(rates.mc) }), t('cs.colRate'), t('cs.colProdYr')],
      rows: rates.phases.map((p) => [phaseName(p), f.int(p.n_ge15), f.interval(p.rate_per_yr, p.rate_lo, p.rate_hi, (v) => f.fixed(v, 1)), p.prod_bcm_per_yr === null ? t('cs.noProdShort') : f.fixed(p.prod_bcm_per_yr, 1)]) },
    note: t('cs.phaseNote'),
  });
}

function correlation(rates) {
  const c = rates.correlation;
  return h('p', { class: 'cs-corr', text: t('cs.corr', { rho: f.fixed(c.spearman_rho, 2), p: f.sig2(c.p), rho1: f.fixed(c.lag1_rho, 2), p1: c.lag1_p.toExponential(1).replace('e-', ' × 10^−'), years: c.years.replace('-', '–'), n: c.n_years }) });
}

// ------------------------------------------------------------------ b-values

function bPhaseTable(bt) {
  const muted = (q) => q === 'C' || q === 'insufficient';
  const cell = (o, label, extra = '') => {
    if (!o || !f.isNum(o.b)) return h('td', { class: 'num muted', 'data-h': label, text: t('cs.bNone', { n: f.int(o && o.n) }) });
    const q = o.q ? ` · ${o.q === 'insufficient' ? t('q.insufficient') : t('cs.qShort', { q: o.q })}` : '';
    return h('td', { class: `num${muted(o.q) ? ' muted' : ''}`, 'data-h': label, title: muted(o.q) ? t('cs.bMutedTitle') : null },
      bInt(o), h('div', { class: 'detail', text: `n ${f.int(o.n)}${extra}${q}` }));
  };
  const cols = [t('cs.colPhase'), t('cs.colAtlas'), t('cs.colFixed'), t('cs.colBpos')];
  const tb = h('tbody', {}, bt.phases.map((p) => h('tr', {},
    h('td', { 'data-h': cols[0], text: phaseName(p) }),
    cell(p.atlas, cols[1], `, Mc ${f.mag(p.atlas.mc)}`), cell(p.mc15, cols[2]), cell(p.bpos, cols[3]))));
  return h('div', {},
    h('div', { class: 'table-card' }, h('table', { class: 'vtable cs-btable' }, h('caption', { class: 'sr-only', text: t('cs.bPhaseH') }),
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col', text: c })))), tb)),
    h('p', { class: 'hint', text: t('cs.bPhaseNote', { floor: f.mag(bt.bpos_floor) }) }));
}

function movingChart(bt) {
  const mk = (k, color, name) => {
    const m = bt.moving[k];
    return { name, color, type: 'line', points: m.t.map((x, i) => [x, m.b[i]]), band: m.t.map((x, i) => [x, m.lo[i], m.hi[i]]),
      fmt: (v, x) => { const i = m.t.indexOf(x); return i < 0 ? '–' : `${f.interval(m.b[i], m.lo[i], m.hi[i])}, ${t('cs.nDiff', { n: f.int(m.n_diff[i]) })}`; } };
  };
  const N = bt.moving.north, S = bt.moving.south;
  const rows = [...N.t.map((x, i) => [t('cs.north'), f.fixed(x, 2), f.interval(N.b[i], N.lo[i], N.hi[i]), f.int(N.n_diff[i])]),
    ...S.t.map((x, i) => [t('cs.south'), f.fixed(x, 2), f.interval(S.b[i], S.lo[i], S.hi[i]), f.int(S.n_diff[i])])];
  return xyChart({
    title: t('cs.movTitle', { w: bt.window }), sub: t('cs.movChartSub', { floor: f.mag(bt.bpos_floor), y: f.int(bt.ns_split_rd_y / 1000) }), alt: t('cs.movAlt'),
    height: 230, margin: { l: 44 },
    x: { domain: [2010, 2027], fmt: (v) => String(v) },
    y: { domain: [0.4, 1.8] },
    series: [mk('north', 'var(--s1)', t('cs.north')), mk('south', 'var(--s2)', t('cs.south'))],
    yRules: [{ value: 1, label: 'b = 1' }],
    hoverTitle: (x) => t('cs.windowEnd', { d: f.decYearDate(x) }),
    table: { columns: [t('cs.colSub'), t('cs.colEnd'), t('cs.colB'), t('cs.colNdiff')], rows },
    note: t('cs.movNote'),
  });
}

// The b map: one square per 1-km node, coloured by the b classes of the atlas map, over the NLOG field outline.
let mapState = { period: '1991-2013', est: 'bpos' };

function bMap(bm) {
  const periods = Object.keys(bm.periods);
  if (!periods.includes(mapState.period)) mapState.period = periods[0];
  const wrap = h('div', { class: 'cs-bmap' });
  const seg = (name, opts, cur, on) => h('div', { class: 'seg cs-seg', role: 'radiogroup', 'aria-label': t(`cs.map.${name}`), style: `grid-template-columns:repeat(${opts.length},auto)` },
    opts.map(([v, lab]) => h('label', {}, h('input', { type: 'radio', name: `cs-${name}`, value: v, checked: v === cur, 'data-ctl': `${name}-${v}`, onchange: () => on(v) }), lab)));
  const controls = h('div', { class: 'cs-map-ctl' },
    h('div', {}, h('span', { class: 'lbl', text: t('cs.map.period') }), seg('period', periods.map((p) => [p, p.replace('-', '–')]), mapState.period, (v) => { mapState.period = v; paint(); })),
    h('div', {}, h('span', { class: 'lbl', text: t('cs.map.est') }), seg('est', [['bpos', t('cs.map.bpos')], ['b', t('cs.map.atlas')]], mapState.est, (v) => { mapState.est = v; paint(); })));
  const plot = h('div', { class: 'cs-map-plot', role: 'group', tabindex: '0' });
  const tip = h('div', { class: 'chart-tip', 'aria-live': 'polite' });
  tip.hidden = true;
  const caption = h('p', { class: 'hint cs-map-cap' });
  const legend = bLegend();
  const det = h('details', { class: 'chart-table' }, h('summary', { text: t('chart.table') }));
  wrap.append(controls, h('div', { class: 'cs-map-row' }, plot, legend), caption, h('p', { class: 'chart-note', text: t('cs.nlogOutline') }), det);
  plot.append(tip);

  // geometry: equirectangular with cos(latitude), outline extent
  const ring0 = bm.outline.coordinates[0];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [lo, la] of ring0) { x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la); }
  const pad = 0.04;
  x0 -= pad; x1 += pad; y0 -= pad * 0.6; y1 += pad * 0.6;
  const k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const W = 600, H = Math.round((W * (y1 - y0)) / ((x1 - x0) * k));
  const X = (lo) => ((lo - x0) / (x1 - x0)) * W, Y = (la) => ((y1 - la) / (y1 - y0)) * H;
  const dLat = bm.spacing_m / 111195, side = (dLat / (y1 - y0)) * H;
  const ringPath = bm.outline.coordinates.map((r) => `M${r.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join('L')}Z`).join('');

  function paint() {
    const P = bm.periods[mapState.period];
    const est = mapState.est;
    const vals = est === 'bpos' ? { b: P.bpos, lo: P.bpos_lo, hi: P.bpos_hi, n: P.n_bpos } : { b: P.b, lo: P.b_lo, hi: P.b_hi, n: P.n };
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg cs-map-svg', role: 'img', 'aria-label': t('cs.map.alt', { p: mapState.period }) });
    svgEl('path', { d: ringPath, class: 'cs-outline-fill', 'fill-rule': 'evenodd' }, svg);
    const g = svgEl('g', {}, svg);
    let shown = 0, withheld = 0;
    const rows = [];
    for (let i = 0; i < P.lon.length; i++) {
      const v = vals.b[i];
      const x = X(P.lon[i]) - side / 2, y = Y(P.lat[i]) - side / 2;
      const ok = f.isNum(v) && f.isNum(vals.lo[i]) && (est === 'bpos' || P.q[i] === 'A' || P.q[i] === 'B');
      if (ok) {
        shown++;
        const r = svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: (side + 0.4).toFixed(1), height: (side + 0.4).toFixed(1), class: `cs-node bc${bClass(v)}${est === 'b' && P.q[i] === 'B' ? ' qb' : ''}`, 'data-i': i }, g);
        r.addEventListener('pointerenter', () => showTip(i, x + side, y));
        rows.push([f.fixed(P.lat[i], 3), f.fixed(P.lon[i], 3), f.interval(v, vals.lo[i], vals.hi[i]), f.int(vals.n[i]), est === 'b' ? P.q[i] : '–']);
      } else if (est === 'b' && f.isNum(v)) {
        withheld++;
        svgEl('rect', { x: x.toFixed(1), y: y.toFixed(1), width: side.toFixed(1), height: side.toFixed(1), class: 'cs-node withheld' }, g);
      }
    }
    svgEl('path', { d: ringPath, class: 'cs-outline', 'fill-rule': 'evenodd' }, svg);
    plot.querySelector('svg')?.remove();
    plot.prepend(svg);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
    caption.textContent = t(est === 'bpos' ? 'cs.map.capBpos' : 'cs.map.capAtlas', { n: f.int(shown), grid: f.int(P.n_nodes_grid), ev: f.int(P.n_events), floor: f.mag(P.floor_mc), w: f.int(withheld), r: f.int(bm.radius_m / 1000) });
    wrap.dataset.shown = String(shown);
    det.querySelector('table')?.remove();
    det.append(h('table', { class: 'data' }, h('thead', {}, h('tr', {}, [t('cs.colLat'), t('cs.colLon'), t('cs.colB'), 'n', t('col.quality')].map((c) => h('th', { scope: 'col', text: c })))),
      h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c })))))));

    function showTip(i, px, py) {
      const s = plot.clientWidth / W;
      tip.replaceChildren(h('div', { class: 'tip-title', text: f.latlon(P.lat[i], P.lon[i], 3) }),
        h('div', { class: 'tip-row' }, h('strong', { text: `b ${f.interval(vals.b[i], vals.lo[i], vals.hi[i])}` }), h('span', { text: est === 'b' ? ` ${t('cs.qShort', { q: P.q[i] })}` : ` ${t('cs.map.bpos')}` })),
        h('div', { class: 'tip-row' }, h('span', { text: est === 'bpos' ? t('cs.nDiff', { n: f.int(vals.n[i]) }) : t('cs.map.nEv', { n: f.int(P.n[i]), mc: f.mag(P.mc[i]) }) })));
      tip.hidden = false;
      tip.style.left = `${Math.min(plot.clientWidth - tip.offsetWidth, px * s + 8)}px`;
      tip.style.top = `${Math.max(0, py * s - 10)}px`;
    }
  }
  paint();
  return wrap;
}

function bLegend() {
  const labels = [t('lg.below', { v: '0.8' }), '0.8–0.9', '0.9–1.0', '1.0–1.1', '1.1–1.2', t('lg.above', { v: '1.2' })];
  return h('div', { class: 'cs-map-legend', 'aria-label': t('cs.map.legend') },
    h('strong', { text: t('cs.map.legendTitle') }),
    h('ul', {}, labels.map((l, i) => h('li', {}, h('span', { class: `sw bc${i}`, 'aria-hidden': 'true' }), l)),
      h('li', {}, h('span', { class: 'sw qb bc1', 'aria-hidden': 'true' }), t('cs.map.lgB')),
      h('li', {}, h('span', { class: 'sw withheld', 'aria-hidden': 'true' }), t('cs.map.lgWithheld')),
      h('li', {}, h('span', { class: 'sw outline', 'aria-hidden': 'true' }), t('cs.map.lgOutline'))));
}

// ------------------------------------------------------------------ validation and sources

const VERDICT = { consistent: 'ok', matches: 'ok', differs: 'bad', 'not testable': 'na' };

function validationTable(val) {
  const cols = [t('cs.colSource'), t('cs.colQty'), t('cs.colPub'), t('cs.colOurs'), t('cs.colVerdict')];
  const pub = (r) => (Array.isArray(r.published) ? `${r.published[0]}–${r.published[1]}` : r.published_sigma ? `${r.published} ± ${r.published_sigma}` : String(r.published));
  const ours = (r) => {
    if (!f.isNum(r.ours)) return t('cs.vNone', { n: f.int(r.n) });
    const v = f.isNum(r.ours_lo) ? f.interval(r.ours, r.ours_lo, r.ours_hi, f.b3) : Number.isInteger(r.ours) ? f.int(r.ours) : f.b3(r.ours);
    return f.isNum(r.n) && f.isNum(r.ours_lo) ? `${v}; n ${f.int(r.n)}` : v;
  };
  const tally = {};
  for (const r of val.rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  const tb = h('tbody', {}, val.rows.map((r) => h('tr', { 'data-verdict': r.verdict },
    h('td', { 'data-h': cols[0], text: r.source }),
    h('td', { 'data-h': cols[1] }, r.quantity, r.note ? h('div', { class: 'detail', text: r.note }) : null),
    h('td', { class: 'num', 'data-h': cols[2], text: pub(r) }),
    h('td', { class: 'num', 'data-h': cols[3], text: ours(r) }),
    h('td', { 'data-h': cols[4] }, h('span', { class: `pill ${VERDICT[r.verdict] || ''}`, text: t(`cs.v.${r.verdict.replace(' ', '')}`) })))));
  return h('div', {},
    h('p', { class: 'pill-line cs-tally' }, Object.entries(tally).map(([k, n]) => h('span', { class: `pill ${VERDICT[k] || ''}`, text: `${n} ${t(`cs.v.${k.replace(' ', '')}`)}` }))),
    h('div', { class: 'table-card' }, h('table', { class: 'vtable cs-vtable' }, h('caption', { class: 'sr-only', text: t('cs.valH') }),
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col', text: c })))), tb)),
    h('p', { class: 'hint', text: t('cs.valNote') }));
}

/** Every source attribution from index.json; the KNMI network DOI as a link. */
function sources(idx, kind) {
  const doiLink = (txt) => {
    const i = txt.indexOf(`doi:${KNMI_DOI}`);
    if (i < 0) return [txt];
    return [txt.slice(0, i), h('a', { href: `https://doi.org/${KNMI_DOI}`, target: '_blank', rel: 'noopener', text: `doi:${KNMI_DOI}` }), txt.slice(i + KNMI_DOI.length + 4)];
  };
  if (kind === 'short') {
    return h('p', { class: 'cs-attrib' }, h('span', { class: 'lbl', text: `${t('cs.dataFrom')} ` }),
      ...idx.sources.slice(0, 2).flatMap((s, i) => [i ? ' · ' : '', ...doiLink(s.attribution)]));
  }
  return h('div', {},
    h('ul', { class: 'src-list cs-src' }, idx.sources.map((s) => h('li', {},
      h('strong', { text: s.name }), h('br'), ...doiLink(s.attribution), h('br'),
      h('span', { class: 'hint', text: `${t('cs.licence')}: ${s.licence}. ${t('cs.redistributed')}: ${s.redistributed}.` })))),
    h('p', { class: 'hint', text: t('cs.noEvents') }),
    h('p', { class: 'hint', text: t('cs.statement', { s: idx.statement }) }));
}
