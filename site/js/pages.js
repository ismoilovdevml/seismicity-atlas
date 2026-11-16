// Sequences, Methods and validation, About the data. Each page loads its data lazily on first visit.

import * as f from './fmt.js';
import { h, xyChart, forestChart, padDomain } from './charts.js';
import { getJSON, mb } from './data.js';
import { t } from './i18n/index.js';
import { infoButton, infoKey } from './info.js';

const errorBox = (root, e, retry) => root.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} `, h('button', { class: 'small-btn', type: 'button', onclick: retry, text: t('common.retry') })));
const loading = (root, what) => root.replaceChildren(h('div', { class: 'loading', role: 'status', text: t('common.loading', { what }) }));

// ---------------------------------------------------------------- sequences

const qText = (q) => (q === 'insufficient' ? t('q.insufficient') : t('q.quality', { q }));

export function renderSequences(root, ctx) {
  const run = () => {
    loading(root, t('seq.loadingWhat'));
    getJSON('sequences.json').then((data) => drawSequences(root, data, ctx)).catch((e) => errorBox(root, e, run));
  };
  run();
}

function drawSequences(root, data, ctx) {
  const seqs = data.sequences;
  const counts = { A: 0, B: 0, C: 0, insufficient: 0 };
  for (const s of seqs) counts[s.quality]++;
  const nUnres = seqs.filter((s) => s.c_resolved === false).length;
  const nFit = seqs.filter((s) => s.p !== undefined).length;
  const years = seqs.map((s) => +s.time.slice(0, 4));
  const mags = seqs.map((s) => s.mag);
  let filter = 'all', sort = 'mag';

  const intro = [
    h('h1', { text: t('seq.h1') }),
    h('p', { class: 'lede', text: t('seq.lede', { n: seqs.length, y: Math.min(...years), m0: f.mag(Math.min(...mags)), m1: f.mag(Math.max(...mags)) }) }),
    h('p', { class: 'summary-line' }, t('seq.summary', { a: counts.A, b: counts.B, c: counts.C, i: counts.insufficient, u: nUnres, n: nFit })),
    infoKey([['omori-utsu', 'p, c, K'], ['magnitude-of-completeness', 'Mcat'], ['aftershock-productivity-bath', t('seq.contaminated')]]),
  ];
  const seg = (name, opts, cur, on) => h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name === 'seqf' ? t('seq.filter') : t('seq.sortOrder'), style: `grid-template-columns:repeat(${opts.length},auto)` },
    opts.map(([v, lab]) => h('label', {}, h('input', { type: 'radio', name, value: v, checked: v === cur, onchange: () => on(v) }), lab)));
  const listEl = h('ul', { class: 'seq-list', 'aria-label': t('nav.sequences') });
  const countEl = h('p', { class: 'hint', 'aria-live': 'polite' });
  const toolbar = h('div', { class: 'toolbar' },
    h('div', {}, h('span', { class: 'lbl', text: t('seq.show') }), seg('seqf', [['all', t('seq.all')], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['insufficient', t('q.insufficient')]], filter, (v) => { filter = v; draw(); })),
    h('div', {}, h('span', { class: 'lbl', text: t('seq.sortBy') }), seg('seqs', [['mag', t('seq.byMag')], ['time', t('seq.byDate')]], sort, (v) => { sort = v; draw(); })));
  const method = h('details', { class: 'method card' }, h('summary', { text: t('seq.method') }), h('pre', { text: data.method }));
  root.replaceChildren(...intro, method, toolbar, countEl, listEl);

  function draw() {
    let list = seqs.filter((s) => filter === 'all' || s.quality === filter);
    list = list.slice().sort(sort === 'mag' ? (a, b) => b.mag - a.mag || a.time.localeCompare(b.time) : (a, b) => b.time.localeCompare(a.time));
    countEl.textContent = t('seq.count', { n: list.length, total: seqs.length });
    listEl.replaceChildren(...list.map((s) => seqItem(s, ctx)));
  }
  draw();
}

function seqItem(s, ctx) {
  const qcls = { A: 'ok', B: 'close', C: 'na', insufficient: '' }[s.quality];
  const badges = [h('span', { class: `pill ${qcls}`, text: qText(s.quality) })];
  if (s.c_resolved === false) badges.push(h('span', { class: 'pill bad', text: t('seq.cUnres') }));
  if (s.contaminated) badges.push(h('span', { class: 'pill na', text: t('seq.contaminated') }));
  const params = h('dl', { class: 'params' });
  const par = (k, v) => params.append(h('div', {}, h('dt', { text: k }), h('dd', { text: v })));
  if (s.p !== undefined) {
    par('p', s.sp !== null && s.sp !== undefined ? `${f.fixed(s.p, 2)} ± ${f.fixed(s.sp, 2)}` : t('seq.noSe', { p: f.fixed(s.p, 2) }));
    par('c', s.c_resolved ? `${f.sig2(s.c)} ${t('unit.d')}${s.sc ? ` ± ${f.sig2(s.sc)}` : ''}` : t('seq.notResolved'));
    par('K', t('seq.perDay', { v: f.sig2(s.K) }));
  }
  par(t('seq.nFit'), f.int(s.n_fit));
  par('Mcat', f.mag(s.mcat));
  par(t('seq.radius'), f.km(s.radius_km));
  const head = h('div', { class: 'seq-head' }, h('h3', { text: s.place }), h('span', { class: 'seq-mag', text: `M ${f.mag(s.mag)}` }));
  const meta = h('p', { class: 'seq-meta', text: t('seq.meta', { date: f.isoDate(s.time), d: f.int(s.depth), loc: f.latlon(s.lat, s.lon) }) });
  const li = h('li', { class: 'seq' }, head, meta, h('div', { class: 'badges' }, badges), params);
  if (s.rate_counts && s.rate_bins_days) li.append(omoriChart(s));
  else li.append(h('p', { class: 'hint', text: t('seq.tooFew', { n: f.int(s.n_fit), m: f.mag(s.mcat) }) }));
  li.append(h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.showOnMap(s), text: t('seq.showOnMap') }));
  return li;
}

function omoriChart(s) {
  const e = s.rate_bins_days;
  const obs = [];
  s.rate_counts.forEach((n, i) => {
    const t0 = e[i], t1 = e[i + 1];
    const mid = t0 > 0 ? Math.sqrt(t0 * t1) : t1 / 2;
    obs.push([+mid.toPrecision(4), n > 0 ? n / (t1 - t0) : null, n]);
  });
  const pos = obs.filter((o) => o[1] !== null);
  const model = s.p !== undefined ? obs.map((o) => [o[0], s.K / (o[0] + s.c) ** s.p]) : [];
  const ys = [...pos.map((o) => o[1]), ...model.map((m) => m[1])].filter((v) => v > 0);
  const tmin = Math.min(...obs.map((o) => o[0]));
  return xyChart({
    title: t('om.title'),
    sub: t('om.sub', { m: f.mag(s.mcat) }),
    alt: t('om.alt', { place: s.place }),
    height: 170,
    x: { type: 'log', domain: [tmin / 1.5, 365 * 1.2], label: t('om.axis') },
    y: { type: 'log', domain: padDomain(Math.min(...ys), Math.max(...ys), 0.15, 'log') },
    series: [
      { name: t('om.observed'), color: 'var(--s1)', type: 'dots', points: pos.map((o) => [o[0], o[1]]), r: 3.5, fmt: (v, x) => t('om.obsTip', { v: f.sig2(v), n: obs.find((o) => o[0] === x)[2] }) },
      { name: t('om.fit'), color: 'var(--s2)', type: 'line', points: model, fmt: (v) => t('seq.perDay', { v: f.sig2(v) }) },
    ],
    hoverTitle: (x) => t('om.day', { d: f.sig2(x) }),
    table: { columns: [t('om.colStart'), t('om.colEnd'), t('col.events'), t('om.colRate')], rows: obs.map((o, i) => [String(e[i]), String(e[i + 1]), f.int(o[2]), o[1] === null ? '0' : f.sig2(o[1])]) },
    note: t('om.note'),
  });
}

// ---------------------------------------------------------------- methods

// Verdict codes are read from the (English) data text; only the pill label is translated.
const VERDICTS = [
  [/^match/i, 'ok', 'match'],
  [/^close/i, 'close', 'close'],
  [/^mismatch/i, 'bad', 'mismatch'],
  [/^not testable/i, 'na', 'na'],
  [/^lower by/i, '', 'lower'],
  [/^reference only/i, '', 'ref'],
  [/^description only/i, '', 'desc'],
  [/^robust/i, 'ok', 'robust'],
];

function verdictEl(text) {
  const v = VERDICTS.find(([re]) => re.test(text)) || [null, '', 'other'];
  const label = t(`verdict.${v[2]}`);
  return { cls: v[1], el: h('span', { class: `pill ${v[1]}`, text: label }), label };
}

export function renderMethods(root, ctx) {
  const run = () => {
    loading(root, t('val.loadingWhat'));
    Promise.all([getJSON('global.json'), getJSON('sequences.json')]).then(([g, sq]) => drawMethods(root, g, sq, ctx.manifest)).catch((e) => errorBox(root, e, run));
  };
  run();
}

function drawMethods(root, g, sq, man) {
  const m = man.method;
  const q = m.quality;
  const gs = man.global.b_shallow_1976_2021, gd = man.global.b_deep_1976_2021;
  const out = [];
  out.push(h('section', {}, h('h1', { text: t('val.h1') }),
    h('p', { class: 'lede', text: t('val.lede') })));
  const vt = g.validation_table;
  const tally = new Map();
  for (const r of vt) { const v = verdictEl(r.verdict); const k = v.label; if (!tally.has(k)) tally.set(k, { n: 0, cls: v.cls }); tally.get(k).n++; }
  out.push(h('section', { 'aria-label': t('val.summary') }, h('div', { class: 'summary-cards' },
    h('div', {}, h('span', { class: 'n', text: String(vt.length) }), h('span', { class: 'pill', text: t('val.total') })),
    [...tally.entries()].map(([k, v]) => h('div', {}, h('span', { class: 'n', text: String(v.n) }), h('span', { class: `pill ${v.cls}`, text: k }))))));
  out.push(h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, t('val.plateH'), infoButton('plate-boundary-classes')), h('span', { class: 'sub', text: t('val.plateSub') })), h('div', { class: 'card' }, plateChart(g, gs))));
  const tb = h('tbody');
  for (const r of vt) {
    const v = verdictEl(r.verdict);
    tb.append(h('tr', {}, h('td', { 'data-h': t('val.colTest'), text: r.test }), h('td', { class: String(r.ours).length > 32 ? 'num long' : 'num', 'data-h': t('val.colOurs'), text: r.ours }), h('td', { 'data-h': t('val.colPub'), text: r.published }), h('td', { 'data-h': t('val.colVerdict') }, v.el, h('div', { class: 'detail', text: r.verdict }))));
  }
  out.push(h('section', {}, h('h2', { text: t('val.all') }),
    h('div', { class: 'table-card' }, h('table', { class: 'vtable' }, h('caption', { class: 'sr-only', text: t('val.caption') }), h('thead', {}, h('tr', {}, [t('val.colTest'), t('val.colOurs'), t('val.colPub'), t('val.colVerdict')].map((c) => h('th', { scope: 'col', text: c })))), tb)),
    h('p', { class: 'hint', text: t('val.lowerNote') })));

  // method summary
  out.push(h('h2', { text: t('val.howH') }));
  const stepConcept = ['h3-cells-and-sample-radius', 'direct-vs-proxy-mw', 'magnitude-of-completeness', 'confidence-interval-bootstrap', 'quality-codes', 'b-positive'];
  const steps = [
    [t('step.cells'), t('step.cellsTxt', { cells: m.cells, r: m.sample_radius_km })],
    [t('step.cat'), t('step.catTxt', { cat: m.b_catalogue })],
    [t('step.mc'), t('step.mcTxt')],
    [t('step.b'), t('step.bTxt', { n: m.nboot })],
    [t('step.gate'), t('step.gateTxt', { a: q.A, b: q.B, c: q.C, i: q.insufficient })],
    [t('step.robust'), t('step.robustTxt')],
  ];
  out.push(h('dl', { class: 'steps' }, steps.map(([k, v], i) => h('div', {}, h('dt', {}, k, infoButton(stepConcept[i])), h('dd', { text: v })))));

  // global b
  out.push(h('h3', {}, t('val.globalH'), infoButton('gutenberg-richter-b-value')));
  out.push(h('p', { class: 'prose', text: t('val.globalTxt', { sh: f.interval(gs.b, gs.ci95[0], gs.ci95[1], f.b3), nsh: f.int(gs.n_b), mc: f.mag(gs.mc), dp: f.interval(gd.b, gd.ci95[0], gd.ci95[1], f.b3), ndp: f.int(gd.n_b) }) }));

  // floors table
  const ft = h('tbody');
  for (const [d, per] of Object.entries(g.floors)) for (const [p, v] of Object.entries(per)) ft.append(h('tr', {}, h('td', { 'data-h': t('col.depth'), text: f.depthName(d) }), h('td', { 'data-h': t('col.period'), text: p }), h('td', { class: 'num', 'data-h': t('col.events'), text: f.int(v.n) }), h('td', { class: 'num', 'data-h': 'MAXC + 0.2', text: f.mag(v.maxc02) }), h('td', { class: 'num', 'data-h': 'MBS', text: f.mag(v.mbs) }), h('td', { class: 'num', 'data-h': 'GFT', text: f.mag(v.gft) }), h('td', { class: 'num', 'data-h': t('col.floor') }, h('strong', { text: f.mag(v.floor) }))));
  out.push(h('h3', { text: t('val.floorsH') }));
  out.push(h('div', { class: 'table-card' }, h('table', { class: 'vtable' }, h('thead', {}, h('tr', {}, [t('col.depth'), t('col.period'), t('col.events'), 'MAXC + 0.2', 'MBS', 'GFT', t('col.floor')].map((c) => h('th', { scope: 'col', text: c })))), ft)));

  // charts
  out.push(h('h2', { text: t('val.moreH') }));
  const grid = h('div', { class: 'grid-2' });
  grid.append(h('div', { class: 'card' }, slabChart(g)));
  grid.append(h('div', { class: 'card' }, cutoffChart(g)));
  grid.append(h('div', { class: 'card' }, michaelChart(g)));
  out.push(grid);

  // Omori synthetic
  const sc = sq.synthetic_check;
  out.push(h('h3', {}, t('val.omoriH'), infoButton('omori-utsu')));
  out.push(h('p', { class: 'prose', text: t('val.omoriTxt', { p: sc.p_true, c: sc.c_true, pm: f.fixed(sc.p_mean, 3), sd: f.fixed(sc.p_sd_between, 3), se: f.fixed(sc.sp_mean, 3), cm: f.fixed(sc.c_median, 3), n: f.int(sc.n_mean) }) }));

  // limitations
  out.push(h('h2', {}, t('val.limH'), infoButton('not-a-forecast')));
  out.push(h('ul', { class: 'prose' }, [
    t('lim.1', { y: String(man.coverage.iscgem[1]).slice(0, 4) }),
    t('lim.2', { r: m.sample_radius_km }),
    t('lim.3'), t('lim.4'), t('lim.5'), t('lim.6'), t('lim.7'),
  ].map((x) => h('li', { text: x }))));
  out.push(h('p', { class: 'hint' }, t('val.repo'),
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/method.md', target: '_blank', rel: 'noopener', text: 'docs/method.md' }), ', ',
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/validation.md', target: '_blank', rel: 'noopener', text: 'docs/validation.md' }), '.'));
  root.replaceChildren(...out);
}

function plateChart(g, gs) {
  const rows = Object.entries(g.plate_boundary_types).map(([k, v]) => ({ k, label: t(`pbShort.${k}`), v: v.b, lo: v.ci95[0], hi: v.ci95[1], n: v.n_b, text: f.interval(v.b, v.ci95[0], v.ci95[1], f.b3) })).sort((a, b) => b.v - a.v);
  const vals = rows.flatMap((r) => [r.lo, r.hi]);
  return h('div', {}, forestChart({
    sub: t('plate.sub', { b: f.interval(gs.b, gs.ci95[0], gs.ci95[1], f.b3) }),
    alt: t('plate.alt'),
    rows: rows.map((r) => ({ ...r, color: 'var(--v-close-fg)', tipName: `n = ${f.int(r.n)}` })),
    domain: [Math.floor(Math.min(...vals) * 10) / 10, Math.ceil(Math.max(...vals) * 10) / 10],
    ref: { value: gs.b, lo: gs.ci95[0], hi: gs.ci95[1] }, labelWidth: 200, tickFmt: (v) => v.toFixed(1),
    table: { columns: [t('col.class'), 'b', t('col.lo95'), t('col.hi95'), t('col.events')], rows: rows.map((r) => [r.label, f.b3(r.v), f.b3(r.lo), f.b3(r.hi), f.int(r.n)]) },
    note: t('plate.note'),
  }));
}

function slabChart(g) {
  const s = g.slab_age_groups;
  const rows = ['young', 'old'].map((k) => ({ label: t(`slab.${k}`), v: s[k].b, lo: s[k].ci95[0], hi: s[k].ci95[1], color: 'var(--s1)', text: f.interval(s[k].b, s[k].ci95[0], s[k].ci95[1], f.b3), tipName: s[k].regions.join(', ') }));
  const vals = rows.flatMap((r) => [r.lo, r.hi]);
  return h('div', {}, forestChart({
    title: t('slab.title'),
    sub: t('slab.sub'),
    alt: t('slab.alt'),
    rows, domain: [Math.floor(Math.min(...vals) * 10) / 10, Math.ceil(Math.max(...vals) * 10) / 10], labelWidth: 110, tickFmt: (v) => v.toFixed(1),
    table: { columns: [t('col.group'), t('col.regions'), 'b', t('col.lo95'), t('col.hi95')], rows: ['young', 'old'].map((k) => [t(`slab.${k}`), s[k].regions.join(', '), f.b3(s[k].b), f.b3(s[k].ci95[0]), f.b3(s[k].ci95[1])]) },
    note: t('slab.note', { young: s.young.regions.join(', '), old: s.old.regions.join(', ') }),
  }));
}

function cutoffChart(g) {
  const rows = g.b_cutoff_2004_2021;
  const ser = [['iscgem', 'ISC-GEM Mw', 'var(--s1)'], ['comcat_native', t('cat.comcat'), 'var(--s2)'], ['comcat_proxy', t('cut.proxy'), 'var(--s3)']];
  const all = rows.flatMap((r) => ser.map(([k]) => r[k][0]));
  return h('div', {}, xyChart({
    title: t('cut.title'),
    sub: t('cut.sub'),
    alt: t('cut.alt'),
    height: 200,
    x: { domain: [rows[0].cutoff - 0.05, rows[rows.length - 1].cutoff + 0.05], label: t('cut.axis') },
    y: { domain: padDomain(Math.min(...all), Math.max(...all), 0.06) },
    series: ser.map(([k, name, color]) => ({ name, color, type: 'linedots', r: 3, points: rows.map((r) => [r.cutoff, r[k][0]]), fmt: (v, x) => { const r = rows.find((y) => y.cutoff === x)[k]; return `${f.b3(r[0])} ± ${f.b3(1.96 * r[1])}, n = ${f.int(r[2])}`; } })),
    hoverTitle: (x) => t('bc.cutoff', { m: f.mag(x) }),
    table: { columns: [t('col.cutoff'), ...ser.map((s) => s[1])], rows: rows.map((r) => [f.mag(r.cutoff), ...ser.map(([k]) => f.b3(r[k][0]))]) },
    note: t('cut.note'),
  }));
}

function michaelChart(g) {
  const rows = g.michael_periods;
  const lab = (r) => `${r.depth.replace('>=', '≥ ')}, ${r.period}`;
  const all = rows.flatMap((r) => [r.michael_mc, r.maxc02[0], r.mbs[0]]);
  return h('div', {}, forestChart({
    title: t('mi.title'),
    sub: t('mi.sub'),
    alt: t('mi.alt'),
    legend: [{ name: t('mi.ours'), color: 'var(--s1)', key: 'dot' }, { name: 'Michael (2014)', color: 'var(--s2)', key: 'ring' }],
    rows: rows.map((r) => ({ label: lab(r), v: r.maxc02[0], lo: r.maxc02[1], hi: r.maxc02[2], color: 'var(--s1)', marks: [{ v: r.michael_mc, color: 'var(--s2)', hollow: true }], text: `${f.mag(r.maxc02[0])} / ${f.mag(r.michael_mc)}`, tipName: t('mi.tip', { mbs: f.mag(r.mbs[0]) }) })),
    domain: [Math.floor(Math.min(...all) * 2) / 2, Math.ceil(Math.max(...all) * 2) / 2], labelWidth: 150, tickFmt: (v) => v.toFixed(1),
    table: { columns: [t('mi.colDp'), t('col.events'), t('mi.colOurs'), t('mi.colMbs'), 'Michael 2014'], rows: rows.map((r) => [lab(r), f.int(r.n), f.mag(r.maxc02[0]), f.mag(r.mbs[0]), f.mag(r.michael_mc)]) },
    note: t('mi.note'),
  }));
}

// ---------------------------------------------------------------- about

export function renderAbout(root, ctx) {
  const man = ctx.manifest;
  const out = [];
  out.push(h('h1', { text: t('nav.about') }));
  out.push(h('p', { class: 'notice' }, h('strong', { text: `${t('about.notice')} ` }), man.disclaimer, ` ${t('about.hazard')} `, h('a', { href: 'https://maps.openquake.org/map/global-seismic-hazard-map/', target: '_blank', rel: 'noopener', text: 'GEM Global Seismic Hazard Map' }), ` ${t('about.linkOnly')}`, ' ', infoButton('not-a-forecast')));
  out.push(h('p', { class: 'prose as-is', id: 'about-asis', text: t('about.asIs') }));
  out.push(h('p', { class: 'lede', text: t('about.lede') }));

  out.push(h('h2', { text: t('about.versionH') }));
  const dl = h('dl', { class: 'facts', style: 'font-size:15px' });
  const fact = (k, v) => dl.append(h('dt', { text: k }), h('dd', { text: v }));
  fact(t('about.version'), man.version);
  fact(t('about.cutoff'), man.data_cutoff_utc);
  fact(t('about.generated'), man.generated_utc.replace('T', ' ').replace('Z', ' UTC'));
  fact(t('about.cov', { cat: 'ISC-GEM' }), t('about.range', { a: f.isoDate(man.coverage.iscgem[0]), b: f.isoDate(man.coverage.iscgem[1]) }));
  fact(t('about.cov', { cat: 'ComCat' }), t('about.range', { a: f.isoDate(man.coverage.comcat[0]), b: f.isoDate(man.coverage.comcat[1]) }));
  fact(t('about.events'), t('about.eventsVal', { m6: f.int(man.events['events_m6.json'].n), m5: f.int(man.events['events_m5.json'].n) }));
  out.push(dl);

  out.push(h('h2', {}, t('about.sourcesH'), infoButton('catalogue-consistency')));
  out.push(h('ul', { class: 'src-list prose' }, man.sources.map((s) => h('li', {},
    h('strong', { text: s.name }), h('br'),
    s.attribution ? `${s.attribution}. ` : '',
    `${t('about.licence')}: `, s.licence_url ? h('a', { href: s.licence_url, target: '_blank', rel: 'noopener', text: s.licence }) : s.licence, '. ',
    s.citation ? `${t('about.cite')}: ${s.citation}. ` : '', s.access ? `${t('about.access')}: ${s.access}. ` : '', s.query ? `${t('about.query')}: ${s.query}. ` : '',
    h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.url })))));
  out.push(h('ul', { class: 'prose' },
    h('li', {}, h('strong', { text: `${t('about.dataLic')}: ` }), `${man.licence.data}. ${t('about.shareAlike')}`,
      (man.licence.exceptions || []).length ? h('span', {}, ` ${t('about.exceptions')}: `, man.licence.exceptions.join('; '), '.') : null),
    h('li', {}, h('strong', { text: `${t('about.code')}: ` }), man.licence.code),
    h('li', {}, h('strong', { text: `${t('about.software')}: ` }),
      `MapLibre GL JS 5.24.0, BSD 3-Clause (${t('about.vendored')}, `, h('a', { href: 'vendor/maplibre-gl-5.24.0/LICENSE.txt', text: t('about.licenceLink') }), '); ',
      `three.js 0.170.0, MIT (${t('about.vendored')}, `, h('a', { href: 'vendor/three-0.170.0/LICENSE', text: t('about.licenceLink') }), ').'),
    h('li', {}, h('strong', { text: `${t('about.colours')}: ` }), 'Crameri, F. (2023), Scientific colour maps 8.0.1, MIT, ',
      h('a', { href: 'https://doi.org/10.5281/zenodo.8409685', target: '_blank', rel: 'noopener', text: 'doi:10.5281/zenodo.8409685' }), `. ${t('about.coloursUse')}`),
    h('li', {}, h('strong', { text: `${t('about.terrainH')}: ` }), t('about.terrainTxt'), ' ', h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/basemap.md', text: 'docs/basemap.md' })),
    h('li', {}, h('strong', { text: `${t('about.fonts')}: ` }), `Inter, IBM Plex Mono, SIL Open Font License 1.1 (${t('about.vendored')}; `, h('a', { href: 'vendor/fonts/OFL-Inter.txt', text: 'Inter' }), ', ', h('a', { href: 'vendor/fonts/OFL-IBMPlexMono.txt', text: 'IBM Plex Mono' }), ').'),
    h('li', {}, h('strong', { text: `${t('about.notRedist')}: ` }), t('about.notRedistTxt'))));

  out.push(h('h2', { text: t('about.citeH') }));
  out.push(h('p', { class: 'cite', text: `Global Seismicity Atlas, version ${man.version}, data cut-off ${man.data_cutoff_utc}. Data licensed CC BY-SA 4.0. Derived from the ISC-GEM Global Instrumental Earthquake Catalogue (${(man.sources[0] || {}).citation || ''}) and USGS ComCat.` }));
  out.push(h('p', { class: 'cite' }, 'Ismoilov, O. (2026). A reproducible global atlas of earthquake-catalogue completeness and b-value with uncertainty. EarthArXiv preprint (not peer reviewed). ',
    h('a', { href: 'https://doi.org/10.31223/X5X23M', target: '_blank', rel: 'noopener', text: 'doi:10.31223/X5X23M' })));
  out.push(h('p', { class: 'prose', text: t('about.citeAlso') }));

  out.push(h('h2', { text: t('about.downloadH') }));
  const files = Object.entries(man.files).sort((a, b) => a[0].localeCompare(b[0]));
  out.push(h('ul', { class: 'files prose' },
    h('li', {}, h('a', { href: 'data/manifest.json', text: 'manifest.json' }), `: ${t('about.manifest')}`),
    files.map(([name, v]) => h('li', {}, h('a', { href: `data/${name}`, text: name }), ` (${mb(v.bytes)})`)),
    h('li', {}, `cells/<H3 id>.json: ${t('about.cellFiles', { n: f.int(man.cell_detail_files.count), size: mb(man.cell_detail_files.bytes) })}`),
    h('li', {}, t('about.csv'))));
  out.push(h('p', { class: 'prose' }, `${t('about.fields')}: `,
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/data-schema.md', target: '_blank', rel: 'noopener', text: 'docs/data-schema.md' }),
    ` ${t('about.inRepo')}`));

  out.push(h('h2', { id: 'about-privacy-h', text: t('about.privacyH') }));
  out.push(h('p', { class: 'prose', id: 'about-privacy' }, `${t('about.privacy')} ${t('about.privacyHost')} `,
    h('a', { href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', target: '_blank', rel: 'noopener', text: t('about.privacyLink') }),
    `. ${t('about.privacyTerrain')}`));
  out.push(h('h2', { id: 'about-a11y-h', text: t('about.a11yH') }));
  out.push(h('p', { class: 'prose', id: 'about-a11y' }, `${t('about.a11y')} ${t('about.a11yReport')} `,
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/issues', target: '_blank', rel: 'noopener', text: 'github.com/ismoilovdevml/seismicity-atlas/issues' })));
  root.replaceChildren(...out);
}
