// "Your catalogue": Mc and b-value of a CSV file the visitor chooses, computed in the browser with core.js.
// The file is read with FileReader and never sent anywhere. Loaded on demand (like the Learn pages).

import { h } from '../charts.js';
import { t } from '../i18n/index.js';
import { readCatalog, select, analyze, NBOOT } from './core.js';

let file = null;      // { name, text }
let last = null;      // { res, opts }
let root = null;

const num = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);
const fmt = (x, nd = 3) => (x == null ? '–' : (+x).toFixed(nd));

function periods(text) {
  const out = [];
  for (const part of String(text || '').split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d{4})-(\d{4}):(-?\d+(?:\.\d+)?)$/.exec(part);
    if (!m) throw new Error(t('an.err.periods', { p: part }));
    out.push([+m[1], +m[2], +m[3]]);
  }
  return out.length ? out : null;
}

function warnText(w) {
  if (w.k === 'mixed') return t('an.w.mixed', { types: w.types.map(([k, v]) => `${k} ${v}`).join(', ') });
  if (w.k === 'few') return t('an.w.few', { n: w.n });
  if (w.k === 'wide') return t('an.w.wide');
  if (w.k === 'unstable') return t('an.w.unstable');
  if (w.k === 'small') return t('an.w.small', { n: w.n });
  if (w.k === 'mc_time') return t('an.w.mcTime', { lo: w.lo.toFixed(1), hi: w.hi.toFixed(1) });
  return t('an.w.none');
}

function fmdSvg(res) {
  const f = res.fmd;
  if (!f || !f.mag.length) return null;
  const W = 560, H = 320, L = 50, R = 14, T = 12, B = 38;
  const x0 = f.mag[0] - 0.05, x1 = f.mag[f.mag.length - 1] + 0.05;
  const ymax = Math.log10(Math.max(...f.cumulative)) + 0.2;
  const X = (m) => L + ((m - x0) / (x1 - x0)) * (W - L - R);
  const Y = (n) => T + (1 - Math.log10(Math.max(n, 1)) / ymax) * (H - T - B);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': t('an.fmdAria'), class: 'an-fmd' });
  for (let k = 0; k <= Math.floor(ymax); k++) {
    svg.append(el('line', { x1: L, x2: W - R, y1: Y(10 ** k), y2: Y(10 ** k), class: 'an-grid' }));
    const tx = el('text', { x: L - 6, y: Y(10 ** k) + 4, 'text-anchor': 'end', class: 'an-tick' }); tx.textContent = String(10 ** k); svg.append(tx);
  }
  const bw = Math.max(((W - L - R) / f.mag.length) * 0.8, 1);
  f.mag.forEach((m, i) => { if (f.count[i] > 0) svg.append(el('rect', { x: X(m) - bw / 2, y: Y(f.count[i]), width: bw, height: Math.max(Y(1) - Y(f.count[i]), 0.5), class: 'an-bar' })); });
  f.mag.forEach((m, i) => svg.append(el('circle', { cx: X(m), cy: Y(f.cumulative[i]), r: 2.6, class: 'an-dot' })));
  const mc = res.mc && res.mc.maxc02;
  if (mc != null) {
    svg.append(el('line', { x1: X(mc), x2: X(mc), y1: T, y2: H - B, class: 'an-mc' }));
    const tx = el('text', { x: X(mc) + 4, y: T + 12, class: 'an-mc-t' }); tx.textContent = `Mc ${mc.toFixed(1)}`; svg.append(tx);
    if (res.b && res.b.b != null) {
      const n0 = res.b.n_above_threshold, xb = f.mag[f.mag.length - 1];
      svg.append(el('line', { x1: X(mc), y1: Y(n0), x2: X(xb), y2: Y(n0 * 10 ** (-res.b.b * (xb - mc))), class: 'an-fit' }));
    }
  }
  for (let m = Math.ceil(x0); m <= Math.floor(x1); m++) {
    const tx = el('text', { x: X(m), y: H - B + 16, 'text-anchor': 'middle', class: 'an-tick' }); tx.textContent = String(m); svg.append(tx);
  }
  const lab = el('text', { x: (L + W - R) / 2, y: H - 6, 'text-anchor': 'middle', class: 'an-tick' }); lab.textContent = t('an.mag'); svg.append(lab);
  return svg;
}

function markdown(res, opts) {
  const b = res.b || {};
  const L = [`# ${t('an.h1')}: ${file ? file.name : ''}`, '', `Global Seismicity Atlas, https://seismicityatlas.org/ (${new Date().toISOString().slice(0, 10)})`, '',
    `| ${t('an.qty')} | ${t('an.val')} |`, '|---|---|',
    `| ${t('an.events')} | ${res.n_events} |`,
    `| Mc (MAXC + 0.2) [95 %] | ${fmt(res.mc?.maxc02, 1)} [${fmt(res.mc?.maxc02_lo, 1)}, ${fmt(res.mc?.maxc02_hi, 1)}] |`,
    `| b [95 %] | ${b.b == null ? b.quality : `${fmt(b.b)} [${fmt(b.b_lo)}, ${fmt(b.b_hi)}], ${t('an.quality')} ${b.quality}, n = ${b.n_above_threshold}`} |`];
  if (res.b_positive) L.push(`| b-positive | ${fmt(res.b_positive.b)} [${fmt(res.b_positive.b_lo)}, ${fmt(res.b_positive.b_hi)}] |`);
  L.push('', `## ${t('an.warnings')}`, '', ...(res.warnings.length ? res.warnings.map((w) => `- ${warnText(w)}`) : [`- ${t('an.w.none')}`]),
    '', `## ${t('an.settings')}`, '', '```', JSON.stringify(opts), '```', '', t('an.disclaimer'), '', t('an.cite'));
  return L.join('\n');
}

function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function resultView(res, opts) {
  const b = res.b || {};
  const rows = [
    [t('an.events'), String(res.n_events)],
    res.magnitude_range ? [t('an.magRange'), `${res.magnitude_range[0]} – ${res.magnitude_range[1]}`] : null,
    res.time_range ? [t('an.timeRange'), `${res.time_range[0]} – ${res.time_range[1]}`] : null,
    res.mc ? ['Mc (MAXC + 0.2) [95 %]', `${fmt(res.mc.maxc02, 1)} [${fmt(res.mc.maxc02_lo, 1)}, ${fmt(res.mc.maxc02_hi, 1)}]`] : null,
    [t('an.bRow'), b.b == null ? t(`an.q.${b.quality || 'insufficient'}`)
      : `${fmt(b.b)} [${fmt(b.b_lo)}, ${fmt(b.b_hi)}] · ${t('an.quality')} ${b.quality} · n = ${b.n_above_threshold}${b.shown ? '' : ` · ${t('an.withheld')}`}`],
    b.b != null ? [t('an.cutoff'), `${fmt(b.b_plus02)} / ${fmt(b.b_plus04)}`] : null,
    res.b_positive && res.b_positive.b != null ? ['b-positive [95 %]', `${fmt(res.b_positive.b)} [${fmt(res.b_positive.b_lo)}, ${fmt(res.b_positive.b_hi)}] · ${res.b_positive.n_differences}`] : null,
    res.magnitude_types ? [t('an.types'), Object.entries(res.magnitude_types).map(([k, v]) => `${k}: ${v}`).join(', ')] : null,
  ].filter(Boolean);
  const out = h('div', { class: 'an-result', 'aria-live': 'polite' },
    h('h2', { text: t('an.resultH') }),
    h('table', { class: 'an-table' }, h('tbody', {}, rows.map(([k, v]) => h('tr', {}, h('th', { scope: 'row', text: k }), h('td', { text: v }))))),
    h('figure', {}, fmdSvg(res), h('figcaption', { text: t('an.fmdCap') })),
    h('h3', { text: t('an.warnings') }),
    h('ul', {}, (res.warnings.length ? res.warnings : [{ k: 'none' }]).map((w) => h('li', { text: warnText(w) }))));
  if (res.mc_by_year && res.mc_by_year.length) {
    out.append(h('details', {}, h('summary', { text: t('an.byYear') }),
      h('table', { class: 'an-table' }, h('thead', {}, h('tr', {}, h('th', { text: t('an.year') }), h('th', { text: t('an.events') }), h('th', { text: 'Mc' }))),
        h('tbody', {}, res.mc_by_year.map((r) => h('tr', {}, h('td', { text: String(r.year) }), h('td', { text: String(r.n) }), h('td', { text: fmt(r.mc_maxc02, 1) })))))));
  }
  const base = (file ? file.name.replace(/\.[^.]+$/, '') : 'catalogue') + '-report';
  out.append(h('div', { class: 'an-actions' },
    h('button', { type: 'button', class: 'btn', text: t('an.dlMd'), onclick: () => download(`${base}.md`, markdown(res, opts), 'text/markdown') }),
    h('button', { type: 'button', class: 'btn', text: t('an.dlJson'), onclick: () => download(`${base}.json`, JSON.stringify({ ...res, settings: opts }, null, 1), 'application/json') })),
  h('p', { class: 'an-note', text: t('an.disclaimer') }),
  h('p', { class: 'an-note', text: t('an.cite') }));
  return out;
}

function field(id, label, attrs = {}) {
  return h('label', { class: 'an-field', for: id }, h('span', { text: label }), h('input', { id, ...attrs }));
}

export function renderAnalyze(el) {
  root = el;
  el.replaceChildren();
  const status = h('p', { class: 'an-status', role: 'status' });
  const result = h('div', {});
  const typeSel = h('select', { id: 'an-type' }, h('option', { value: '', text: t('an.allTypes') }));
  const fileInput = h('input', { type: 'file', id: 'an-file', accept: '.csv,.txt,.tsv,text/csv' });
  const drop = h('label', { class: 'an-drop', for: 'an-file' }, h('strong', { text: t('an.choose') }), h('span', { text: t('an.dropHint') }));

  const fillTypes = () => {
    typeSel.replaceChildren(h('option', { value: '', text: t('an.allTypes') }));
    if (!file) return;
    try {
      const cat = readCatalog(file.text);
      const types = {};
      for (const e of cat.events) if (e.magtype) types[e.magtype] = (types[e.magtype] || 0) + 1;
      for (const [k, v] of Object.entries(types).sort((a, b) => b[1] - a[1])) typeSel.append(h('option', { value: k, text: `${k} (${v})` }));
      status.textContent = t('an.loaded', { name: file.name, n: cat.events.length, cols: Object.keys(cat.columns).join(', ') });
    } catch (e) { status.textContent = e.message; }
  };
  const load = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { file = { name: f.name, text: String(r.result) }; fillTypes(); };
    r.onerror = () => { status.textContent = t('an.err.read'); };
    r.readAsText(f);
  };
  fileInput.addEventListener('change', () => load(fileInput.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); });

  const form = h('form', { class: 'an-form', novalidate: true },
    h('div', { class: 'an-filebox' }, fileInput, drop),
    h('details', { class: 'an-opts' }, h('summary', { text: t('an.options') }),
      h('div', { class: 'an-grid' },
        h('label', { class: 'an-field', for: 'an-type' }, h('span', { text: t('an.magType') }), typeSel),
        field('an-lat', t('an.lat'), { type: 'number', step: 'any', min: -90, max: 90 }),
        field('an-lon', t('an.lon'), { type: 'number', step: 'any', min: -180, max: 360 }),
        field('an-r', t('an.radius'), { type: 'number', step: 'any', min: 0 }),
        field('an-dmin', t('an.depthMin'), { type: 'number', step: 'any' }),
        field('an-dmax', t('an.depthMax'), { type: 'number', step: 'any' }),
        field('an-start', t('an.start'), { type: 'date' }),
        field('an-end', t('an.end'), { type: 'date' }),
        field('an-floor', t('an.floor'), { type: 'number', step: '0.1' }),
        field('an-periods', t('an.periods'), { type: 'text', placeholder: '1976-2003:5.8, 2004-2021:5.3', autocomplete: 'off' }),
        field('an-nboot', t('an.nboot'), { type: 'number', min: 100, max: 5000, step: 100, value: NBOOT }))),
    h('button', { type: 'submit', class: 'btn primary', text: t('an.run') }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!file) { status.textContent = t('an.err.noFile'); return; }
    const v = (id) => form.querySelector(`#${id}`).value;
    let opts;
    try {
      opts = { magType: v('an-type') || null, lat: num(v('an-lat')), lon: num(v('an-lon')), radiusKm: num(v('an-r')),
        depthMin: num(v('an-dmin')), depthMax: num(v('an-dmax')), start: v('an-start') || null, end: v('an-end') || null,
        floor: num(v('an-floor')), floorPeriods: periods(v('an-periods')), nboot: Math.min(Math.max(num(v('an-nboot')) || NBOOT, 100), 5000) };
      if (opts.radiusKm != null && (opts.lat == null || opts.lon == null)) throw new Error(t('an.err.circle'));
    } catch (err) { status.textContent = err.message; return; }
    status.textContent = t('an.computing');
    result.replaceChildren();
    setTimeout(() => {
      try {
        const cat = readCatalog(file.text, { magType: opts.magType });
        const ev = select(cat.events, opts);
        const res = analyze(ev, { nboot: opts.nboot, floor: opts.floor, floorPeriods: opts.floorPeriods });
        last = { res, opts };
        result.replaceChildren(resultView(res, opts));
        status.textContent = t('an.done', { n: ev.length });
      } catch (err) { status.textContent = err.message; }
    }, 30);
  });

  el.append(
    h('h1', { text: t('an.h1') }),
    h('p', { class: 'lede', text: t('an.lede') }),
    h('p', { class: 'an-privacy', text: t('an.privacy') }),
    form, status, result,
    h('details', { class: 'an-help' }, h('summary', { text: t('an.helpH') }),
      h('p', { text: t('an.helpCols') }), h('p', { text: t('an.helpMethod') }),
      h('p', {}, t('an.helpPip'), ' ', h('code', { text: 'pip install "seisatlas @ git+https://github.com/ismoilovdevml/seismicity-atlas"' }))));
  if (file) fillTypes();
  if (last) result.replaceChildren(resultView(last.res, last.opts));
}
