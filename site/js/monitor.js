// Ongoing sequences (Sequence Monitor). Descriptive only: every number covers the mainshock to the data cut-off, and
// the fitted curve is never drawn past the cut-off. Data: data/monitor/index.json and one file per sequence.

import * as f from './fmt.js';
import { h, xyChart, padDomain } from './charts.js';
import { getJSON } from './data.js';
import { t } from './i18n/index.js';

const QCLS = { A: 'ok', B: 'close', C: 'na', insufficient: '' };
const PROD_ARROW = { more: '↑', less: '↓', typical: '≈', insufficient: '' };

const errorBox = (root, e, retry) => root.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} `, h('button', { class: 'small-btn', type: 'button', onclick: retry, text: t('common.retry') })));

export function renderMonitor(root, ctx) {
  const run = () => {
    root.replaceChildren(h('div', { class: 'loading', role: 'status', text: t('common.loading', { what: t('mon.loadingWhat') }) }));
    getJSON('monitor/index.json')
      .then((idx) => Promise.all(idx.sequences.map((s) => getJSON(`monitor/${s.file}`))).then((full) => draw(root, idx, full, ctx)))
      .catch((e) => errorBox(root, e, run));
  };
  run();
}

/** Scroll to the sequence named in the URL (#...&s=<id>) and mark it. */
export function focusSequence(id) {
  document.querySelectorAll('.mon-seq.focus').forEach((el) => el.classList.remove('focus'));
  if (!id) return;
  const el = document.getElementById(`mon-${id}`);
  if (!el) return;
  el.classList.add('focus');
  el.scrollIntoView({ block: 'start' });
}

const utc = (s) => (s ? s.replace('T', ' ').replace(/:\d\dZ$/, ' UTC') : '–');

function draw(root, idx, full, ctx) {
  const sel = idx.selection;
  const out = [
    h('h1', { text: t('mon.h1') }),
    h('div', { class: 'notice mon-notice', role: 'note' },
      h('strong', { text: `${t('mon.noticeStrong')} ` }), t('mon.notice')),
    h('p', { class: 'lede', text: t('mon.lede', { m: f.mag(sel.min_mag), d: sel.window_days }) }),
  ];
  const facts = h('dl', { class: 'facts mon-facts' });
  const fact = (k, v) => facts.append(h('dt', { text: k }), h('dd', { text: v }));
  fact(t('mon.cutoff'), utc(idx.data_cutoff_utc));
  fact(t('mon.updated'), utc(idx.generated_utc));
  fact(t('mon.selection'), t('mon.selectionVal', { m: f.mag(sel.min_mag), d: sel.window_days, n: idx.sequences.length }) + (sel.fallback_used ? t('mon.fallback', { m0: f.mag(sel.default_min_mag) }) : ''));
  fact(t('mon.version'), idx.method_version);
  out.push(facts);
  out.push(h('details', { class: 'method card' }, h('summary', { text: t('mon.method') }), h('pre', { text: idx.method })));

  let sort = 'time';
  const listEl = h('ul', { class: 'seq-list mon-list', 'aria-label': t('mon.h1') });
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('seq.sortOrder'), style: 'grid-template-columns:repeat(2,auto)' },
    [['time', t('seq.byDate')], ['mag', t('seq.byMag')]].map(([v, lab]) => h('label', {}, h('input', { type: 'radio', name: 'monsort', value: v, checked: v === sort, onchange: () => { sort = v; drawList(); } }), lab)));
  out.push(h('div', { class: 'toolbar' }, h('div', {}, h('span', { class: 'lbl', text: t('seq.sortBy') }), seg)));
  out.push(h('p', { class: 'hint', text: idx.sequences.length ? t('mon.count', { n: idx.sequences.length }) : t('mon.none') }));
  out.push(listEl);
  root.replaceChildren(...out);

  function drawList() {
    const list = full.slice().sort(sort === 'mag' ? (a, b) => b.mag - a.mag || b.time.localeCompare(a.time) : (a, b) => b.time.localeCompare(a.time));
    listEl.replaceChildren(...list.map((s) => card(s, idx)));
  }
  drawList();
  if (ctx.state && ctx.state.s) requestAnimationFrame(() => focusSequence(ctx.state.s));
}

function card(s, idx) {
  const o = s.omori, b = s.b, bp = s.bpos, pr = s.productivity, c = s.counts;
  const badges = [h('span', { class: `pill ${QCLS[o.quality]}`, text: o.quality === 'insufficient' ? t('mon.omoriInsuf') : t('mon.omoriQ', { q: o.quality }) })];
  badges.push(h('span', { class: `pill ${QCLS[b.q]}`, text: b.q === 'insufficient' ? t('mon.bInsufPill') : t('mon.bQ', { q: b.q }) }));
  if (pr.class) badges.push(h('span', { class: `pill prod prod-${pr.class}`, title: t('mon.prodTitle') }, PROD_ARROW[pr.class] ? h('span', { 'aria-hidden': 'true', text: `${PROD_ARROW[pr.class]} ` }) : null, t(`mon.prod.${pr.class}`)));
  if (s.contaminated) badges.push(h('span', { class: 'pill na', text: t('mon.contaminated') }));

  const params = h('dl', { class: 'params mon-params' });
  const par = (k, v) => params.append(h('div', {}, h('dt', { text: k }), h('dd', { text: v })));
  par(t('mon.nAll'), t('mon.nAllVal', { n: f.int(c.n_all), m: f.mag(s.query.minmagnitude) }));
  par(t('mon.nMcat'), t('mon.nMcatVal', { n: f.int(c.n_mcat), m: f.mag(s.mcat) }));
  par(t('mon.last7'), f.int(c.n_last7));
  const la = s.largest_aftershock;
  par(t('mon.largest'), la ? t('mon.largestVal', { m: f.mag(la.mag), d: f.sig2(la.days), dm: f.fixed(la.dm, 1) }) : t('mon.noAfter'));
  if (o.p !== undefined && o.p !== null) {
    par('p', o.p_lo !== null && o.p_lo !== undefined ? f.interval(o.p, o.p_lo, o.p_hi) : t('seq.noSe', { p: f.fixed(o.p, 2) }));
    par('c', o.c_resolved ? `${f.sig2(o.c)} ${t('unit.d')} [${f.sig2(o.c_lo)}, ${f.sig2(o.c_hi)}]` : t('seq.notResolved'));
    par('K', t('seq.perDay', { v: f.sig2(o.K) }));
  }
  par('b', b.b !== null && b.b !== undefined ? f.interval(b.b, b.lo, b.hi)
    : b.q === 'insufficient' ? t('mon.bInsuf', { n: f.int(b.n) }) : t('mon.bWithheld', { w: f.b2(b.hi - b.lo), q: b.q }));
  par(t('mon.bpos'), bp.b !== null && bp.b !== undefined ? f.interval(bp.b, bp.lo, bp.hi) : t('mon.bInsuf', { n: f.int(bp.n) }));
  if (pr.ratio !== undefined && pr.ratio !== null && pr.class !== 'insufficient') {
    par(t('mon.prod'), t('mon.prodVal', { r: f.sig2(pr.ratio), lo: f.sig2(pr.ratio_lo), hi: f.sig2(pr.ratio_hi), pct: Math.round(pr.percentile) }));
  }

  const head = h('div', { class: 'seq-head' },
    h('h3', {}, h('a', { href: `#v=monitor&s=${s.id}`, text: s.place || s.id, title: t('mon.link') })),
    h('span', { class: 'seq-mag', text: `M ${f.mag(s.mag)}` }));
  const meta = h('p', { class: 'seq-meta' }, t('mon.meta', { date: utc(s.time), d: f.int(s.depth), loc: f.latlon(s.lat, s.lon) }), h('br'),
    t('mon.age', { n: f.fixed(s.age_days, 1) }), ' · ', t('mon.regime', { r: t(`regime.${s.regime}`) }));
  const li = h('li', { class: 'seq mon-seq', id: `mon-${s.id}` }, head, meta, h('div', { class: 'badges' }, badges), params);

  const notes = [];
  for (const a of s.absorbed || []) notes.push(t('mon.absorbed', { m: f.mag(a.mag), date: f.isoDate(a.time), place: a.place }));
  for (const v of s.overlaps || []) notes.push(t('mon.overlap', { m: f.mag(v.mag), date: f.isoDate(v.time), km: f.int(v.dist_km) }));
  const mt = (s.magtypes || []).map(([k, sh]) => `${k} ${Math.round(sh * 100)} %`).join(', ');
  if (mt) notes.push(t('mon.bNote', { t: mt }));
  li.append(h('ul', { class: 'mon-notes hint' }, notes.map((n) => h('li', { text: n }))));

  if (s.cum && s.cum.fit) li.append(cumChart(s, idx));
  else li.append(h('p', { class: 'hint', text: t('mon.noFit', { n: f.int(c.n_fit) }) }));
  li.append(h('p', { class: 'mon-links' }, h('a', { href: s.url, target: '_blank', rel: 'noopener', text: t('mon.usgs') })));
  return li;
}

function cumChart(s) {
  const tt = s.cum.t, obs = s.cum.obs, fit = s.cum.fit;
  const ys = [...obs, ...fit];
  const last = tt[tt.length - 1];
  return xyChart({
    title: t('mon.chartTitle'),
    sub: t('mon.chartSub', { m: f.mag(s.mcat) }),
    alt: t('mon.chartAlt', { place: s.place }),
    height: 180,
    margin: { l: 50 },
    x: { domain: [0, last], label: t('mon.axis') },
    y: { domain: [0, padDomain(0, Math.max(1, ...ys), 0.16)[1]] },
    series: [
      { name: t('mon.observed'), color: 'var(--s1)', type: 'line', points: tt.map((x, i) => [x, obs[i]]), fmt: (v) => t('mon.tipCount', { v: f.int(v) }) },
      { name: t('mon.fit'), color: 'var(--s2)', type: 'line', points: tt.map((x, i) => [x, fit[i]]), fmt: (v) => t('mon.tipCount', { v: f.int(v) }) },
    ],
    xRules: [{ value: last, label: t('mon.cutoffShort'), dashed: true }],
    hoverTitle: (x) => t('mon.day', { d: f.sig2(x) }),
    table: { columns: [t('mon.colDay'), t('mon.observed'), t('mon.fit')], rows: tt.map((x, i) => [String(x), f.int(obs[i]), f.int(fit[i])]) },
    note: t('mon.chartNote'),
  });
}
