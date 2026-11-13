// Sequences, Methods and validation, About the data. Each page loads its data lazily on first visit.

import * as f from './fmt.js';
import { h, xyChart, forestChart, padDomain } from './charts.js';
import { getJSON, mb, ruleNumber } from './data.js';

const errorBox = (root, e, retry) => root.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} `, h('button', { class: 'small-btn', type: 'button', onclick: retry, text: 'Try again' })));
const loading = (root, what) => root.replaceChildren(h('div', { class: 'loading', role: 'status', text: `Loading ${what}…` }));

// ---------------------------------------------------------------- sequences

const Q_TEXT = { A: 'Quality A', B: 'Quality B', C: 'Quality C', insufficient: 'Insufficient' };

export function renderSequences(root, ctx) {
  const run = () => {
    loading(root, 'aftershock sequences');
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
    h('h1', { text: 'Aftershock sequences' }),
    h('p', { class: 'lede', text: `How quickly aftershock rates decayed after the ${seqs.length} largest independent mainshocks since ${Math.min(...years)} (M ${f.mag(Math.min(...mags))} to ${f.mag(Math.max(...mags))}), fitted with the Omori-Utsu law: rate = K / (t + c)^p.` }),
    h('p', { class: 'summary-line' }, `${counts.A} quality A, ${counts.B} B, ${counts.C} C, ${counts.insufficient} insufficient. In ${nUnres} of the ${nFit} fits the parameter c is not resolved: the teleseismic catalogue misses the first hours, so c is unconstrained there, while K and p remain usable.`),
  ];
  const seg = (name, opts, cur, on) => h('div', { class: 'seg', role: 'radiogroup', 'aria-label': name === 'seqf' ? 'Filter by quality' : 'Sort order', style: `grid-template-columns:repeat(${opts.length},auto)` },
    opts.map(([v, lab]) => h('label', {}, h('input', { type: 'radio', name, value: v, checked: v === cur, onchange: () => on(v) }), lab)));
  const listEl = h('ul', { class: 'seq-list', 'aria-label': 'Sequences' });
  const countEl = h('p', { class: 'hint', 'aria-live': 'polite' });
  const toolbar = h('div', { class: 'toolbar' },
    h('div', {}, h('span', { class: 'lbl', text: 'Show' }), seg('seqf', [['all', 'All'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['insufficient', 'Insufficient']], filter, (v) => { filter = v; draw(); })),
    h('div', {}, h('span', { class: 'lbl', text: 'Sort by' }), seg('seqs', [['mag', 'Magnitude'], ['time', 'Date']], sort, (v) => { sort = v; draw(); })));
  const method = h('details', { class: 'method card' }, h('summary', { text: 'How the sequences were selected and fitted' }), h('pre', { text: data.method }));
  root.replaceChildren(...intro, method, toolbar, countEl, listEl);

  function draw() {
    let list = seqs.filter((s) => filter === 'all' || s.quality === filter);
    list = list.slice().sort(sort === 'mag' ? (a, b) => b.mag - a.mag || a.time.localeCompare(b.time) : (a, b) => b.time.localeCompare(a.time));
    countEl.textContent = `${list.length} of ${seqs.length} sequences shown.`;
    listEl.replaceChildren(...list.map((s) => seqItem(s, ctx)));
  }
  draw();
}

function seqItem(s, ctx) {
  const qcls = { A: 'ok', B: 'close', C: 'na', insufficient: '' }[s.quality];
  const badges = [h('span', { class: `pill ${qcls}`, text: Q_TEXT[s.quality] })];
  if (s.c_resolved === false) badges.push(h('span', { class: 'pill bad', text: 'c not resolved' }));
  if (s.contaminated) badges.push(h('span', { class: 'pill na', text: 'Second large event in window' }));
  const params = h('dl', { class: 'params' });
  const par = (k, v) => params.append(h('div', {}, h('dt', { text: k }), h('dd', { text: v })));
  if (s.p !== undefined) {
    par('p', s.sp !== null && s.sp !== undefined ? `${f.fixed(s.p, 2)} ± ${f.fixed(s.sp, 2)}` : `${f.fixed(s.p, 2)} (no s.e.)`);
    par('c', s.c_resolved ? `${f.sig2(s.c)} d${s.sc ? ` ± ${f.sig2(s.sc)}` : ''}` : 'not resolved');
    par('K', `${f.sig2(s.K)} per day`);
  }
  par('Events fitted', f.int(s.n_fit));
  par('Mcat', f.mag(s.mcat));
  par('Radius', f.km(s.radius_km));
  const head = h('div', { class: 'seq-head' }, h('h3', { text: s.place }), h('span', { class: 'seq-mag', text: `M ${f.mag(s.mag)}` }));
  const meta = h('p', { class: 'seq-meta', text: `${f.isoDate(s.time)}, depth ${f.int(s.depth)} km, ${f.latlon(s.lat, s.lon)}` });
  const li = h('li', { class: 'seq' }, head, meta, h('div', { class: 'badges' }, badges), params);
  if (s.rate_counts && s.rate_bins_days) li.append(omoriChart(s));
  else li.append(h('p', { class: 'hint', text: `Only ${f.int(s.n_fit)} events above Mcat ${f.mag(s.mcat)} in the window: too few to fit a decay.` }));
  li.append(h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.showOnMap(s), text: 'Show on the map with the earthquakes of that year' }));
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
    title: 'Aftershock rate against time since the mainshock',
    sub: `Events per day above Mcat ${f.mag(s.mcat)}. Log-log axes.`,
    alt: `Omori decay for the ${s.place}`,
    height: 170,
    x: { type: 'log', domain: [tmin / 1.5, 365 * 1.2], label: 'Days after the mainshock' },
    y: { type: 'log', domain: padDomain(Math.min(...ys), Math.max(...ys), 0.15, 'log') },
    series: [
      { name: 'Observed', color: 'var(--s1)', type: 'dots', points: pos.map((o) => [o[0], o[1]]), r: 3.5, fmt: (v, x) => `${f.sig2(v)} per day (${obs.find((o) => o[0] === x)[2]} events)` },
      { name: 'Omori-Utsu fit', color: 'var(--s2)', type: 'line', points: model, fmt: (v) => `${f.sig2(v)} per day` },
    ],
    hoverTitle: (x) => `Day ${f.sig2(x)}`,
    table: { columns: ['Bin start, days', 'Bin end, days', 'Events', 'Rate per day'], rows: obs.map((o, i) => [String(e[i]), String(e[i + 1]), f.int(o[2]), o[1] === null ? '0' : f.sig2(o[1])]) },
    note: 'Early bins fall below the fit because the catalogue is incomplete in the first hours; the fit models this with a time-dependent Mc.',
  });
}

// ---------------------------------------------------------------- methods

const VERDICTS = [
  [/^match/i, 'ok', 'Match'],
  [/^close/i, 'close', 'Close'],
  [/^mismatch/i, 'bad', 'Mismatch'],
  [/^not testable/i, 'na', 'Not testable'],
  [/^lower by/i, '', 'Lower (newer catalogue)'],
  [/^reference only/i, '', 'Reference only'],
];

function verdictEl(text) {
  const v = VERDICTS.find(([re]) => re.test(text)) || [null, '', 'Other'];
  return { cls: v[1], el: h('span', { class: `pill ${v[1]}`, text: v[2] }), label: v[2] };
}

export function renderMethods(root, ctx) {
  const run = () => {
    loading(root, 'methods and validation data');
    Promise.all([getJSON('global.json'), getJSON('sequences.json')]).then(([g, sq]) => drawMethods(root, g, sq, ctx.manifest)).catch((e) => errorBox(root, e, run));
  };
  run();
}

function drawMethods(root, g, sq, man) {
  const m = man.method;
  const q = m.quality;
  const gs = man.global.b_shallow_1976_2021, gd = man.global.b_deep_1976_2021;
  const out = [];
  out.push(h('section', {}, h('h1', { text: 'Does the method reproduce published numbers?' }),
    h('p', { class: 'lede', text: 'Before any cell is shown, the same code is run on cases with known answers: synthetic catalogues, global values from Michael (2014), plate-boundary classes and well-studied regions. Every test is listed, including the ones that fail or cannot be tested.' })));
  const vt = g.validation_table;
  const tally = new Map();
  for (const r of vt) { const v = verdictEl(r.verdict); const k = v.label; if (!tally.has(k)) tally.set(k, { n: 0, cls: v.cls }); tally.get(k).n++; }
  out.push(h('section', { 'aria-label': 'Summary' }, h('div', { class: 'summary-cards' },
    h('div', {}, h('span', { class: 'n', text: String(vt.length) }), h('span', { class: 'pill', text: 'Tests in total' })),
    [...tally.entries()].map(([k, v]) => h('div', {}, h('span', { class: 'n', text: String(v.n) }), h('span', { class: `pill ${v.cls}`, text: k }))))));
  out.push(h('section', {}, h('div', { class: 'sec-head' }, h('h2', { text: 'b-value by plate-boundary class' }), h('span', { class: 'sub', text: 'Shallow, ISC-GEM Mw 1976–2021. Dot = b, bar = 95 % interval.' })), h('div', { class: 'card' }, plateChart(g, gs))));
  const tb = h('tbody');
  for (const r of vt) {
    const v = verdictEl(r.verdict);
    tb.append(h('tr', {}, h('td', { 'data-h': 'Test', text: r.test }), h('td', { class: 'num', 'data-h': 'This atlas', text: r.ours }), h('td', { 'data-h': 'Published', text: r.published }), h('td', { 'data-h': 'Verdict' }, v.el, h('div', { class: 'detail', text: r.verdict }))));
  }
  out.push(h('section', {}, h('h2', { text: 'All tests' }),
    h('div', { class: 'table-card' }, h('table', { class: 'vtable' }, h('caption', { class: 'sr-only', text: 'Validation tests' }), h('thead', {}, h('tr', {}, ['Test', 'This atlas', 'Published', 'Verdict'].map((c) => h('th', { scope: 'col', text: c })))), tb)),
    h('p', { class: 'hint', text: '"Lower" Mc rows compare our MAXC + 0.2 / MBS estimates on the current ISC-GEM release with Michael (2014), who used the first release. Mismatches are kept visible. Regional published values come from local catalogues at much smaller magnitudes: a match means agreement, not proof.' })));

  // method summary
  out.push(h('h2', { text: 'How a cell value is made' }));
  const steps = [
    ['Cells and circles', `The map uses ${m.cells} hexagons. The statistics of a cell use every event within ${m.sample_radius_km} km of its centre, so neighbouring cells share events and are not independent.`],
    ['Catalogue for b', `b uses only ${m.b_catalogue}: the only open global catalogue on one magnitude scale. ComCat's preferred magnitudes mix mb and Mw, so they are never used for b.`],
    ['Completeness, Mc', `Maximum curvature + 0.2 in the circle. Each event's threshold is the larger of the cell Mc and the global floor of its period, so a cell can raise the threshold but never lower it.`],
    ['b and its interval', `Aki-Utsu maximum likelihood with a per-event threshold. The 95 % interval comes from ${m.nboot} bootstrap resamples, re-estimating Mc in each.`],
    ['The quality gate', `A: ${q.A}. B: ${q.B}. C: ${q.C}. Insufficient: ${q.insufficient}. Only A and B cells get a b-value; the map never shows b without its interval and quality code.`],
    ['Robustness checks', 'b-positive (van der Elst 2021) and a Gardner-Knopoff declustered b are published per cell for comparison. Declustering is not used for the map because its windows remove far more than aftershocks in a global M ≥ 5 catalogue.'],
  ];
  out.push(h('dl', { class: 'steps' }, steps.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v })))));

  // global b
  out.push(h('h3', { text: 'Global b in the atlas setting' }));
  out.push(h('p', { class: 'prose', text: `Shallow: ${f.interval(gs.b, gs.ci95[0], gs.ci95[1], f.b3)} from ${f.int(gs.n_b)} events above Mc ${f.mag(gs.mc)}. Deeper: ${f.interval(gd.b, gd.ci95[0], gd.ci95[1], f.b3)} from ${f.int(gd.n_b)} events. Global and pooled b-values are given to 3 decimals, per-cell values to 2, because the intervals differ by about ten times.` }));

  // floors table
  const ft = h('tbody');
  for (const [d, per] of Object.entries(g.floors)) for (const [p, v] of Object.entries(per)) ft.append(h('tr', {}, h('td', { 'data-h': 'Depth', text: f.DEPTH_NAMES[d] }), h('td', { 'data-h': 'Period', text: p }), h('td', { class: 'num', 'data-h': 'Events', text: f.int(v.n) }), h('td', { class: 'num', 'data-h': 'MAXC + 0.2', text: f.mag(v.maxc02) }), h('td', { class: 'num', 'data-h': 'MBS', text: f.mag(v.mbs) }), h('td', { class: 'num', 'data-h': 'GFT', text: f.mag(v.gft) }), h('td', { class: 'num', 'data-h': 'Floor' }, h('strong', { text: f.mag(v.floor) }))));
  out.push(h('h3', { text: 'Global completeness floors' }));
  out.push(h('div', { class: 'table-card' }, h('table', { class: 'vtable' }, h('thead', {}, h('tr', {}, ['Depth', 'Period', 'Events', 'MAXC + 0.2', 'MBS', 'GFT', 'Floor'].map((c) => h('th', { scope: 'col', text: c })))), ft)));

  // charts
  out.push(h('h2', { text: 'More validation charts' }));
  const grid = h('div', { class: 'grid-2' });
  grid.append(h('div', { class: 'card' }, slabChart(g)));
  grid.append(h('div', { class: 'card' }, cutoffChart(g)));
  grid.append(h('div', { class: 'card' }, michaelChart(g)));
  out.push(grid);

  // Omori synthetic
  const sc = sq.synthetic_check;
  out.push(h('h3', { text: 'Omori-Utsu fitting, synthetic check' }));
  out.push(h('p', { class: 'prose', text: `On synthetic teleseismic-like sequences with true p = ${sc.p_true} and c = ${sc.c_true} days, the fit gives mean p = ${f.fixed(sc.p_mean, 3)} (spread between runs ${f.fixed(sc.p_sd_between, 3)}, mean standard error ${f.fixed(sc.sp_mean, 3)}) and median c = ${f.fixed(sc.c_median, 3)} days, from about ${f.int(sc.n_mean)} events per sequence.` }));

  // limitations
  out.push(h('h2', { text: 'Limitations' }));
  out.push(h('ul', { class: 'prose' }, [
    `The ISC-GEM copy used ends in ${String(man.coverage.iscgem[1]).slice(0, 4)}. Later years are only in ComCat, whose mixed magnitudes are not used for b.`,
    `b and Mc describe teleseismic magnitudes (Mw ≥ 5) averaged over ${m.sample_radius_km} km. They are not comparable with b-values from local networks at M 1–3, and cannot resolve fault-scale structure.`,
    'Most of the world shows "insufficient". That is the honest result for a global catalogue, not missing work.',
    'Overlapping circles make neighbouring cells look smoother than independent estimates would.',
    'Small samples bias b and tie it to the largest event in the sample (Marzocchi et al. 2020). Compare two places only through their intervals.',
    'Plate-boundary classes are approximate: each event takes the class of the nearest PB2002 step within 200 km.',
    'This is not an earthquake forecast and not a seismic hazard model.',
  ].map((t) => h('li', { text: t }))));
  out.push(h('p', { class: 'hint' }, 'Full method notes, sensitivity tests and code are in the project repository: ',
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/method.md', target: '_blank', rel: 'noopener', text: 'docs/method.md' }), ', ',
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/validation.md', target: '_blank', rel: 'noopener', text: 'docs/validation.md' }), '.'));
  root.replaceChildren(...out);
}

function plateChart(g, gs) {
  const names = { SUB: 'Subduction', CCB: 'Continental convergent', OCB: 'Oceanic convergent', CTF: 'Continental transform', OTF: 'Oceanic transform', CRB: 'Continental rift', OSR: 'Oceanic spreading ridge', none: 'Over 200 km from a boundary' };
  const rows = Object.entries(g.plate_boundary_types).map(([k, v]) => ({ k, label: names[k] || k, v: v.b, lo: v.ci95[0], hi: v.ci95[1], n: v.n_b, text: f.interval(v.b, v.ci95[0], v.ci95[1], f.b3) })).sort((a, b) => b.v - a.v);
  const vals = rows.flatMap((r) => [r.lo, r.hi]);
  return h('div', {}, forestChart({
    sub: `Grey band and line: global shallow b ${f.interval(gs.b, gs.ci95[0], gs.ci95[1], f.b3)}.`,
    alt: 'b-value by plate boundary class with intervals',
    rows: rows.map((r) => ({ ...r, color: 'var(--v-close-fg)', tipName: `n = ${f.int(r.n)}` })),
    domain: [Math.floor(Math.min(...vals) * 10) / 10, Math.ceil(Math.max(...vals) * 10) / 10],
    ref: { value: gs.b, lo: gs.ci95[0], hi: gs.ci95[1] }, labelWidth: 200, tickFmt: (v) => v.toFixed(1),
    table: { columns: ['Class', 'b', '95 % low', '95 % high', 'Events'], rows: rows.map((r) => [r.label, f.b3(r.v), f.b3(r.lo), f.b3(r.hi), f.int(r.n)]) },
    note: 'Oceanic ridges and transforms have the highest b; convergent margins the lowest, as in published global studies.',
  }));
}

function slabChart(g) {
  const s = g.slab_age_groups;
  const rows = ['young', 'old'].map((k) => ({ label: `${k === 'young' ? 'Young' : 'Old'} slabs`, v: s[k].b, lo: s[k].ci95[0], hi: s[k].ci95[1], color: 'var(--s1)', text: f.interval(s[k].b, s[k].ci95[0], s[k].ci95[1], f.b3), tipName: s[k].regions.join(', ') }));
  const vals = rows.flatMap((r) => [r.lo, r.hi]);
  return h('div', {}, forestChart({
    title: 'Subduction b, young against old slabs',
    sub: 'b is expected to increase with slab age (Nishikawa & Ide 2014).',
    alt: 'b for young and old subducting slabs',
    rows, domain: [Math.floor(Math.min(...vals) * 10) / 10, Math.ceil(Math.max(...vals) * 10) / 10], labelWidth: 110, tickFmt: (v) => v.toFixed(1),
    table: { columns: ['Group', 'Regions', 'b', '95 % low', '95 % high'], rows: ['young', 'old'].map((k) => [k, s[k].regions.join(', '), f.b3(s[k].b), f.b3(s[k].ci95[0]), f.b3(s[k].ci95[1])]) },
    note: `Young: ${s.young.regions.join(', ')}. Old: ${s.old.regions.join(', ')}.`,
  }));
}

function cutoffChart(g) {
  const rows = g.b_cutoff_2004_2021;
  const ser = [['iscgem', 'ISC-GEM Mw', 'var(--s1)'], ['comcat_native', 'ComCat as served', 'var(--s2)'], ['comcat_proxy', 'ComCat on Mw proxy', 'var(--s3)']];
  const all = rows.flatMap((r) => ser.map(([k]) => r[k][0]));
  return h('div', {}, xyChart({
    title: 'Global b against cutoff, shallow, 2004–2021',
    sub: 'Same years, three magnitude sources.',
    alt: 'Global b against magnitude cutoff for three magnitude sources',
    height: 200,
    x: { domain: [rows[0].cutoff - 0.05, rows[rows.length - 1].cutoff + 0.05], label: 'Cutoff magnitude' },
    y: { domain: padDomain(Math.min(...all), Math.max(...all), 0.06) },
    series: ser.map(([k, name, color]) => ({ name, color, type: 'linedots', r: 3, points: rows.map((r) => [r.cutoff, r[k][0]]), fmt: (v, x) => { const r = rows.find((y) => y.cutoff === x)[k]; return `${f.b3(r[0])} ± ${f.b3(1.96 * r[1])}, n = ${f.int(r[2])}`; } })),
    hoverTitle: (x) => `Cutoff ${f.mag(x)}`,
    table: { columns: ['Cutoff', ...ser.map((s) => s[1])], rows: rows.map((r) => [f.mag(r.cutoff), ...ser.map(([k]) => f.b3(r[k][0]))]) },
    note: 'Below about 5.5 the mb-to-Mw proxy inflates b; this is why the atlas never computes b from converted magnitudes.',
  }));
}

function michaelChart(g) {
  const rows = g.michael_periods;
  const lab = (r) => `${r.depth.replace('>=', '≥ ')}, ${r.period}`;
  const all = rows.flatMap((r) => [r.michael_mc, r.maxc02[0], r.mbs[0]]);
  return h('div', {}, forestChart({
    title: 'Completeness by period, ours against Michael (2014)',
    sub: 'Filled: ours, MAXC + 0.2 with bootstrap range. Ring: Michael (2014).',
    alt: 'Completeness magnitude by period compared with Michael 2014',
    legend: [{ name: 'Ours, MAXC + 0.2', color: 'var(--s1)', key: 'dot' }, { name: 'Michael (2014)', color: 'var(--s2)', key: 'ring' }],
    rows: rows.map((r) => ({ label: lab(r), v: r.maxc02[0], lo: r.maxc02[1], hi: r.maxc02[2], color: 'var(--s1)', marks: [{ v: r.michael_mc, color: 'var(--s2)', hollow: true }], text: `${f.mag(r.maxc02[0])} / ${f.mag(r.michael_mc)}`, tipName: `ours / Michael; MBS ${f.mag(r.mbs[0])}` })),
    domain: [Math.floor(Math.min(...all) * 2) / 2, Math.ceil(Math.max(...all) * 2) / 2], labelWidth: 150, tickFmt: (v) => v.toFixed(1),
    table: { columns: ['Depth, period', 'Events', 'Ours MAXC + 0.2', 'Ours MBS', 'Michael 2014'], rows: rows.map((r) => [lab(r), f.int(r.n), f.mag(r.maxc02[0]), f.mag(r.mbs[0]), f.mag(r.michael_mc)]) },
    note: 'Our values are lower, mostly in early periods: the catalogue gained many smaller pre-1960 events after his analysis.',
  }));
}

// ---------------------------------------------------------------- about

export function renderAbout(root, ctx) {
  const man = ctx.manifest;
  const out = [];
  out.push(h('h1', { text: 'About & data' }));
  out.push(h('p', { class: 'notice' }, h('strong', { text: 'Not a forecast. Not an official hazard map. ' }), man.disclaimer, ' For seismic hazard, use your national agency or the ', h('a', { href: 'https://maps.openquake.org/map/global-seismic-hazard-map/', target: '_blank', rel: 'noopener', text: 'GEM Global Seismic Hazard Map' }), ' (link only; it is not part of this atlas).'));
  out.push(h('p', { class: 'lede', text: 'The atlas describes two open earthquake catalogues: how complete they are, what their magnitude distributions look like, and where they agree. Its main message is where catalogue numbers can be trusted, and where they cannot.' }));

  out.push(h('h2', { text: 'Version and data cut-off' }));
  const dl = h('dl', { class: 'facts', style: 'font-size:15px' });
  const fact = (k, v) => dl.append(h('dt', { text: k }), h('dd', { text: v }));
  fact('Version', man.version);
  fact('Data cut-off', man.data_cutoff_utc);
  fact('Generated', man.generated_utc.replace('T', ' ').replace('Z', ' UTC'));
  fact('ISC-GEM coverage', `${f.isoDate(man.coverage.iscgem[0])} to ${f.isoDate(man.coverage.iscgem[1])}`);
  fact('ComCat coverage', `${f.isoDate(man.coverage.comcat[0])} to ${f.isoDate(man.coverage.comcat[1])}`);
  fact('Events on the map', `${f.int(man.events['events_m6.json'].n)} of M6 and above; ${f.int(man.events['events_m5.json'].n)} of M5 and above on request`);
  out.push(dl);

  out.push(h('h2', { text: 'Sources and licences' }));
  out.push(h('ul', { class: 'src-list prose' }, man.sources.map((s) => h('li', {},
    h('strong', { text: s.name }), h('br'),
    `Licence: ${s.licence}. `, s.citation ? `Cite: ${s.citation}. ` : '', s.access ? `Access: ${s.access}. ` : '', s.query ? `Query: ${s.query}. ` : '',
    h('a', { href: s.url, target: '_blank', rel: 'noopener', text: s.url })))));
  out.push(h('ul', { class: 'prose' },
    h('li', {}, h('strong', { text: 'Atlas data and figures: ' }), `${man.licence.data}. ShareAlike carries over from ISC-GEM.`),
    h('li', {}, h('strong', { text: 'Code: ' }), man.licence.code),
    h('li', {}, h('strong', { text: 'Map software: ' }), 'MapLibre GL JS 5.24.0, BSD 3-Clause (vendored, ', h('a', { href: 'vendor/maplibre-gl-5.24.0/LICENSE.txt', text: 'licence' }), ').'),
    h('li', {}, h('strong', { text: 'Typefaces: ' }), 'Inter and IBM Plex Mono, SIL Open Font License 1.1 (vendored; ', h('a', { href: 'vendor/fonts/OFL-Inter.txt', text: 'Inter licence' }), ', ', h('a', { href: 'vendor/fonts/OFL-IBMPlexMono.txt', text: 'Plex licence' }), ').'),
    h('li', {}, h('strong', { text: 'Not redistributed: ' }), 'the GEM Global Seismic Hazard Map (CC BY-NC-SA). It is linked, never copied.')));

  out.push(h('h2', { text: 'How to cite' }));
  out.push(h('p', { class: 'cite', text: `Global Seismicity Atlas, version ${man.version}, data cut-off ${man.data_cutoff_utc}. Data licensed CC BY-SA 4.0. Derived from the ISC-GEM Global Instrumental Earthquake Catalogue (${(man.sources[0] || {}).citation || ''}) and USGS ComCat.` }));
  out.push(h('p', { class: 'prose', text: 'Please also cite ISC-GEM and, if you use plate-boundary classes, Bird (2003).' }));

  out.push(h('h2', { text: 'Download the data' }));
  const files = Object.entries(man.files).sort((a, b) => a[0].localeCompare(b[0]));
  out.push(h('ul', { class: 'files prose' },
    h('li', {}, h('a', { href: 'data/manifest.json', text: 'manifest.json' }), ': version, sources, file list and checksums'),
    files.map(([name, v]) => h('li', {}, h('a', { href: `data/${name}`, text: name }), ` (${mb(v.bytes)})`)),
    h('li', {}, `cells/<H3 id>.json: ${f.int(man.cell_detail_files.count)} per-cell detail files, ${mb(man.cell_detail_files.bytes)} in total, loaded when you click a cell`)));
  out.push(h('p', { class: 'prose' }, 'Field definitions: ',
    h('a', { href: 'https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/data-schema.md', target: '_blank', rel: 'noopener', text: 'docs/data-schema.md' }),
    ' in the project repository.'));
  root.replaceChildren(...out);
}
