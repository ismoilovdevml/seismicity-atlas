// Cell detail panel (side panel on desktop, bottom sheet on phones). Charts load lazily from cells/<id>.json.

import * as f from './fmt.js';
import { h, xyChart, forestChart, sparkColumns, padDomain } from './charts.js';
import { getJSON, ruleNumber } from './data.js';
import { CC_RULES } from './layers.js';
import { t } from './i18n/index.js';
import { infoButton } from './info.js';
import { cumulativeFmd, EXT, extLink, safeUrl } from './util.js';

const H3 = (key, concept) => h('h3', {}, t(key), infoButton(concept));

export function qPill(q) {
  const cls = q === 'A' ? 'ok' : q === 'B' ? 'close' : q === 'C' ? 'na' : '';
  return h('span', { class: `pill ${cls}`, text: q === 'insufficient' ? t('q.insufficient') : t('q.quality', { q }) });
}

let token = 0;

function scaleBar(v, lo, hi) {
  const D0 = 0.6, D1 = 1.6;
  const pct = (x) => `${Math.max(0, Math.min(100, ((x - D0) / (D1 - D0)) * 100))}%`;
  const w = (x0, x1) => `${Math.max(0.5, ((Math.min(D1, x1) - Math.max(D0, x0)) / (D1 - D0)) * 100)}%`;
  return h('div', { class: 'scale', role: 'img', 'aria-label': t('panel.scaleAria', { b: f.b2(v), lo: f.b2(lo), hi: f.b2(hi), d0: D0, d1: D1 }) },
    h('div', { class: 'track' }), h('div', { class: 'ci', style: `left:${pct(lo)};width:${w(lo, hi)}` }),
    h('div', { class: 'one', style: `left:${pct(1)}` }), h('div', { class: 'est', style: `left:${pct(v)}` }),
    h('span', { style: 'left:0', text: '0.6' }), h('span', { style: `left:${pct(1)};margin-left:4px`, text: '1.0' }), h('span', { style: 'right:0', text: '1.6' }));
}

const tile = (k, v, small, concept) => h('div', { class: 'tile' }, h('span', { class: 'k' }, k, concept ? infoButton(concept) : null), h('span', { class: 'v' }, v, small ? h('small', { text: ` ${small}` }) : null));

/** Render the panel for cell properties p. ctx: {state, manifest, region, onPin(id), onUnpin()} */
export function renderPanel(p, ctx) {
  const my = ++token;
  const d = ctx.state.d;
  const panel = document.getElementById('panel');
  panel.classList.remove('full');
  const reg = ctx.region || null;
  document.getElementById('panel-eyebrow').textContent = reg ? t('reg.eyebrow') : t('panel.eyebrow');
  document.getElementById('panel-title').textContent = f.latlon(p.lat, p.lon, 2);
  document.getElementById('panel-meta').textContent = reg
    ? `${reg.name}. ${t('reg.panelMeta', { catalogue: reg.catalogue, licence: reg.licence, depth: f.depthShort(d) })} H3 ${p.id.slice(0, 7)}…`
    : t('panel.meta', { pb: f.pbName(p.pb), r: ctx.manifest.method.sample_radius_km, depth: f.depthShort(d), id: `${p.id.slice(0, 7)}…` });
  document.getElementById('panel-meta').append(' ', infoButton(reg ? 'regional-catalogues' : 'h3-cells-and-sample-radius'));
  const body = document.getElementById('panel-body');
  body.replaceChildren();
  panel.hidden = false;

  const q = p[`${d}_q`];
  const nMin = ruleNumber(ctx.manifest.method.quality.insufficient);
  const qB = ruleNumber(ctx.manifest.method.quality.B);
  const top = h('section', { 'aria-label': 'b-value' });
  if (q === 'A' || q === 'B') {
    top.append(h('div', { class: 'bhead' },
      h('div', {}, h('span', { class: 'lbl' }, t('panel.bvalue'), infoButton('gutenberg-richter-b-value')), h('span', { class: 'bbig', text: f.b2(p[`${d}_b`]) })),
      h('div', { class: 'bside' }, h('span', { class: 'ci-line' }, h('span', { class: 'mono', text: t('panel.ci', { lo: f.b2(p[`${d}_b_lo`]), hi: f.b2(p[`${d}_b_hi`]) }) }), infoButton('confidence-interval-bootstrap')),
        h('span', { class: 'pill-line' }, qPill(q), infoButton('quality-codes'), t('cmp.nAbove', { n: f.int(p[`${d}_nb`]) })))));
    top.append(scaleBar(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]));
    if (p[`${d}_unstable`]) top.append(h('p', { class: 'hint', text: t('panel.unstable') }));
  } else {
    const nb = p[`${d}_nb`] || 0;
    const mcTxt = p[`${d}_mc`] !== undefined ? ` ${f.mag(p[`${d}_mc`])}` : '';
    const why = q === 'C'
      ? t('panel.whyC', { n: f.int(nb), mc: mcTxt, w: f.b2(p[`${d}_ciw`]), r: f.b2(p[`${d}_ciwr`]), max: qB.toFixed(2) })
      : t('panel.whyFew', { n: f.int(nb), mc: mcTxt, depth: t(`panel.depthPhrase.${d}`), min: nMin }) + (p[`${d}_ciw`] !== undefined ? ` ${t('panel.wouldBe', { w: f.b2(p[`${d}_ciw`]) })}` : '') + ` ${t('panel.withheld')}`;
    top.append(h('div', { class: 'withheld' }, h('strong', {}, t(`panel.noB.${d}`), infoButton('quality-codes')), h('p', { text: why }), qPill(q)));
  }
  const tiles = h('div', { class: 'tiles' });
  const mcTile = tile(reg ? 'Mc' : t('panel.mcIg'), p[`${d}_mc`] !== undefined ? f.mag(p[`${d}_mc`]) : '–', p[`${d}_mc`] !== undefined && p[`${d}_mc_lo`] !== undefined ? `(${f.mag(p[`${d}_mc_lo`])}–${f.mag(p[`${d}_mc_hi`])})` : '', 'magnitude-of-completeness');
  tiles.append(mcTile);
  if (reg) tiles.append(tile(t('panel.nAboveMc'), f.int(p[`${d}_nb`])));
  else tiles.append(tile(t('panel.mcCc'), p[`${d}_mc_cc`] !== undefined ? f.mag(p[`${d}_mc_cc`]) : '–'));
  if (q === 'A' || q === 'B') {
    tiles.append(tile(t('panel.bpos'), p[`${d}_bpos`] !== undefined ? f.b2(p[`${d}_bpos`]) : t('panel.na'), p[`${d}_bpos`] !== undefined ? `[${f.b2(p[`${d}_bpos_lo`])}, ${f.b2(p[`${d}_bpos_hi`])}]` : '', 'b-positive'));
    tiles.append(tile(t('panel.bdecl'), p[`${d}_bdecl`] !== undefined ? f.b2(p[`${d}_bdecl`]) : t('panel.na'), p[`${d}_bdecl`] !== undefined ? `[${f.b2(p[`${d}_bdecl_lo`])}, ${f.b2(p[`${d}_bdecl_hi`])}]` : '', 'declustering'));
  }
  top.append(tiles);
  body.append(top);

  // peek row (phones): one-line agreement summary and the full-details button
  const flagTxt = p.c_flag ? t(`panel.flag.${p.c_flag}`) : '';
  const peek = h('div', { class: 'peek-only', style: 'flex-direction:column;gap:12px' },
    flagTxt ? h('div', { class: 'tile', style: 'flex-direction:row;justify-content:space-between;align-items:center;background:var(--surface-2);border:0' },
      h('span', { text: flagTxt }), h('span', { class: 'mono', style: 'font-size:12px', text: p.c_dmw !== undefined ? `ΔMw ${f.signed(p.c_dmw)}${p.c_dloc !== undefined ? `, ${f.km(p.c_dloc)}` : ''}` : '' })) : null,
    h('button', { class: 'btn solid', type: 'button', text: t('panel.full'), onclick: () => { panel.classList.add('full'); } }));
  body.append(peek);

  const full = h('div', { class: 'full-only' });
  body.append(full);
  const charts = h('div', { style: 'display:contents' });
  full.append(charts);
  if (!reg) full.append(agreementSection(p, ctx));
  else full.append(regionalSource(reg));
  const detailPath = reg ? (reg.cell_detail_dir ? `${reg.cell_detail_dir.replace(/\/?$/, '/')}${p.id}.json` : null) : `cells/${p.id}.json`;
  const hasDetail = !!(p.detail && detailPath);
  const pinned = ctx.state.k === p.id;
  full.append(h('section', { class: 'cmp-start' },
    pinned
      ? h('p', { class: 'cmp-pinned', role: 'status' }, t('cmp.pinned'), ' ', h('button', { class: 'link-btn', type: 'button', onclick: ctx.onUnpin, text: t('cmp.cancel') }))
      : h('button', { class: 'btn', type: 'button', id: 'cmp-btn', onclick: () => ctx.onPin(p.id), text: t('cmp.start') })));
  full.append(h('div', { class: 'panel-actions' },
    h('button', { class: 'btn primary', type: 'button', id: 'csv-btn', title: t('csv.title'), onclick: () => import('./csv.js').then((m) => m.downloadCellCsv(p, d, { manifest: ctx.manifest, region: reg, detailPath: hasDetail ? detailPath : null })), text: t('csv.download') }),
    hasDetail ? h('a', { class: 'btn', href: `data/${detailPath}`, ...EXT, text: t('panel.json') }) : null,
    h('a', { class: 'btn', href: '#v=methods', text: t('panel.how') })));

  if (!hasDetail) {
    charts.append(h('section', {}, h('p', { class: 'hint', text: t(reg ? 'panel.noDetailReg' : 'panel.noDetail') })));
    return;
  }
  const load = () => {
    charts.replaceChildren(h('section', {}, h('div', { class: 'loading', role: 'status', text: t('panel.loadingCharts') })));
    getJSON(detailPath).then((det) => {
      if (my !== token) return;
      if (reg && p[`${d}_mc`] === undefined && det[d] && det[d].stats && f.isNum(det[d].stats.mc)) {
        // regional cells carry Mc in the detail file only
        const st = det[d].stats;
        mcTile.querySelector('.v').replaceChildren(f.mag(st.mc), f.isNum(st.mc_lo) ? h('small', { text: ` (${f.mag(st.mc_lo)}–${f.mag(st.mc_hi)})` }) : '');
      }
      charts.replaceChildren(...(reg ? regionalCharts(p, det, d, reg) : detailCharts(p, det, d, ctx)));
    }).catch((e) => {
      if (my !== token) return;
      charts.replaceChildren(h('section', {}, h('p', { class: 'error', role: 'alert' }, `${e.message} ${t('panel.fromMap')} `, h('button', { class: 'small-btn', type: 'button', onclick: load, text: t('common.retry') }))));
    });
  };
  load();
}

function detailCharts(p, det, d, ctx) {
  const dd = det[d];
  if (!dd) return [h('section', {}, h('p', { class: 'hint', text: t('panel.noDepth', { depth: f.depthShort(d) }) }))];
  const out = [];
  const q = p[`${d}_q`];

  // 1. FMD
  const fi = cumulativeFmd(dd.fmd_iscgem || []), fc = cumulativeFmd(dd.fmd_comcat || []);
  if (fi.length || fc.length) {
    const ms = [...fi, ...fc].map((x) => x[0]);
    const ns = [...fi, ...fc].map((x) => x[1]).filter((n) => n > 0);
    const mc = p[`${d}_mc`];
    out.push(h('section', {}, H3('fmd.h', 'frequency-magnitude-distribution'), xyChart({
      title: t('fmd.title'),
      sub: t('fmd.sub'),
      alt: t('fmd.alt'),
      x: { domain: [Math.floor(Math.min(...ms) * 10) / 10 - 0.1, Math.ceil(Math.max(...ms) * 10) / 10 + 0.1], label: t('axis.magnitude') },
      y: { type: 'log', domain: [0.8, Math.max(...ns) * 1.5] },
      series: [
        { key: 'line', name: t('cat.iscgem'), color: 'var(--s1)', type: 'line', points: fi, fmt: (v) => `N = ${f.int(v)}` },
        { key: 'line', name: t('cat.comcat'), color: 'var(--s2)', type: 'line', points: fc, fmt: (v) => `N = ${f.int(v)}` },
      ],
      xSpans: mc !== undefined ? [{ from: p[`${d}_mc_lo`] - 0.05, to: p[`${d}_mc_hi`] + 0.05 }] : [],
      xRules: mc !== undefined ? [{ value: mc - 0.05, label: `Mc ${f.mag(mc)}`, dashed: true }] : [],
      hoverTitle: (x) => `M ≥ ${f.mag(x)}`,
      table: { columns: ['M', `ISC-GEM N ≥ M`, `ComCat N ≥ M`], rows: [...new Set(ms)].sort((a, b) => a - b).map((m) => [f.mag(m), f.int((fi.find((x) => x[0] === m) || [])[1]), f.int((fc.find((x) => x[0] === m) || [])[1])]) },
      note: (mc !== undefined ? `${t('fmd.shaded', { lo: f.mag(p[`${d}_mc_lo`]), hi: f.mag(p[`${d}_mc_hi`]) })} ` : '') + t('fmd.scales'),
    })));
  }

  // 2. Mc(t)
  const mi = (dd.mc_t_iscgem || []).map(([y0, y1, n, mc]) => [y0, y1 + 1, mc, n]);
  const mcc = (dd.mc_t_comcat || []).map(([y0, y1, n, mc]) => [y0, y1 + 1, mc, n]);
  const allMc = [...mi, ...mcc].map((s) => s[2]).filter((v) => v !== null);
  if (allMc.length) {
    const segFmt = (segs) => (v, x) => { const s = segs.find((g) => x >= g[0] && x <= g[1]); return `Mc ${f.mag(v)} (${s[0]}–${s[1] - 1}, n = ${f.int(s[3])})`; };
    out.push(h('section', {}, H3('mct.h', 'magnitude-of-completeness'), xyChart({
      title: t('mct.title'),
      sub: t('mct.sub'),
      alt: t('mct.alt'),
      height: 170,
      x: { domain: [1900, Math.max(2027, ...mcc.map((s) => s[1]))], label: t('axis.year') },
      y: { domain: padDomain(Math.min(...allMc) - 0.1, Math.max(...allMc) + 0.1, 0.05) },
      series: [
        { name: t('cat.iscgem'), color: 'var(--s1)', type: 'segments', segs: mi.map((s) => [s[0], s[1], s[2]]), fmt: segFmt(mi) },
        { name: t('cat.comcat'), color: 'var(--s2)', type: 'segments', segs: mcc.map((s) => [s[0], s[1], s[2]]), fmt: segFmt(mcc) },
      ],
      hoverTitle: (x) => t('mct.around', { y: Math.round(x) }),
      table: { columns: [t('col.catalogue'), t('col.window'), t('col.events'), 'Mc'], rows: [...mi.map((s) => ['ISC-GEM', `${s[0]}–${s[1] - 1}`, f.int(s[3]), s[2] === null ? t('mct.few') : f.mag(s[2])]), ...mcc.map((s) => ['ComCat', `${s[0]}–${s[1] - 1}`, f.int(s[3]), s[2] === null ? t('mct.few') : f.mag(s[2])])] },
    })));
  }

  // 3. b vs cutoff, only where the cell passes the quality gate
  const sec3 = h('section', {}, H3('bc.h', 'gutenberg-richter-b-value'));
  if ((q === 'A' || q === 'B') && dd.b_cutoff && dd.b_cutoff.length) {
    const bc = dd.b_cutoff;
    const lo = Math.min(...bc.map((r) => r[2])), hi = Math.max(...bc.map((r) => r[3]));
    sec3.append(xyChart({
      title: t('bc.title'),
      sub: t('bc.sub'),
      alt: t('bc.alt'),
      height: 170,
      x: { domain: [bc[0][0] - 0.05, bc[bc.length - 1][0] + 0.05], label: t('bc.axis') },
      y: { domain: padDomain(Math.min(lo, 0.9), Math.max(hi, 1.1), 0.04) },
      series: [{ name: 'b', color: 'var(--s1)', type: 'linedots', points: bc.map((r) => [r[0], r[1]]), band: bc.map((r) => [r[0], r[2], r[3]]), r: 3, noLegend: true, fmt: (v, x) => { const r = bc.find((y) => y[0] === x); return `b ${f.interval(r[1], r[2], r[3])}, n = ${f.int(r[4])}`; } }],
      yRules: [{ value: 1, label: 'b = 1' }],
      xRules: p[`${d}_mc`] !== undefined ? [{ value: p[`${d}_mc`], label: t('bc.cellMc', { mc: f.mag(p[`${d}_mc`]) }) }] : [],
      hoverTitle: (x) => t('bc.cutoff', { m: f.mag(x) }),
      table: { columns: [t('col.cutoff'), 'b', t('col.lo95'), t('col.hi95'), 'n'], rows: bc.map((r) => [f.mag(r[0]), f.b2(r[1]), f.b2(r[2]), f.b2(r[3]), f.int(r[4])]) },
      note: t('bc.note', { q }),
    }));
  } else {
    sec3.append(h('p', { class: 'hint', text: t('bc.hidden') }));
  }
  out.push(sec3);

  // 4. yearly rates
  const [ry0] = dd.rate_years || [1973];
  const covI = ctx.manifest.coverage.iscgem.map((s) => +String(s).slice(0, 4));
  const sec4 = h('section', {}, H3('yr.h', 'rate-m6'));
  if (dd.rate_comcat_m45 && dd.rate_comcat_m45.length) {
    sec4.append(sparkColumns({
      title: t('yr.ccTitle'),
      sub: t('yr.ccSub', { r: det.radius_km, cutoff: ctx.manifest.data_cutoff_utc }),
      alt: t('yr.ccAlt'), x0: ry0, values: dd.rate_comcat_m45, color: 'var(--s2)', unit: t('yr.unit'),
      table: { columns: [t('col.year'), t('col.events')], rows: dd.rate_comcat_m45.map((v, i) => [String(ry0 + i), f.int(v)]) },
    }));
  }
  if (dd.rate_iscgem_above_thr && dd.rate_iscgem_above_thr.length) {
    // ISC-GEM counts exist only for the b period; other years are no data, not zero
    const bYears = (ctx.manifest.method.b_catalogue.match(/(\d{4})\D+(\d{4})/) || [0, 1976, covI[1]]).slice(1).map(Number);
    const vals = dd.rate_iscgem_above_thr.map((v, i) => (ry0 + i >= bYears[0] && ry0 + i <= bYears[1] ? v : null));
    sec4.append(sparkColumns({
      title: t('yr.igTitle'),
      sub: t('yr.igSub', { y0: bYears[0], y1: bYears[1] }),
      alt: t('yr.igAlt'), x0: ry0, values: vals, color: 'var(--s1)', unit: t('yr.unit'),
      table: { columns: [t('col.year'), t('col.events')], rows: vals.map((v, i) => [String(ry0 + i), v === null ? t('yr.nodata') : f.int(v)]) },
    }));
  }
  if (sec4.children.length > 1) out.push(sec4);
  return out;
}

function agreementSection(p, ctx) {
  const flag = p.c_flag;
  const pill = h('span', { class: `pill ${flag === 'ok' ? 'ok' : flag === 'check' ? 'bad' : ''}`, text: t(`agree.pill.${flag === 'ok' || flag === 'check' ? flag : 'few'}`) });
  const sec = h('section', { 'aria-labelledby': 'h-cc' }, h('div', { class: 'agree-head' }, h('h3', {}, h('span', { id: 'h-cc', text: t('agree.h') }), infoButton('catalogue-consistency')), pill));
  const dl = h('dl', { class: 'agree' });
  const enough = p.c_n >= CC_RULES.minPairs;
  const row = (k, v, flagged) => dl.append(h('dt', { text: k }), h('dd', { class: flagged ? 'flagged' : '', text: v }));
  row(t('agree.dmw'), p.c_dmw !== undefined ? f.signed(p.c_dmw) : '–', enough && Math.abs(p.c_dmw) > CC_RULES.dmw);
  row(t('agree.dmb'), p.c_dmb !== undefined ? f.signed(p.c_dmb) : '–');
  row(t('agree.dloc'), p.c_dloc !== undefined ? f.km(p.c_dloc) : '–', enough && p.c_dloc > CC_RULES.dlocKm);
  row(t('agree.ddep'), p.c_ddep !== undefined ? `${f.signed(p.c_ddep, 1)} km` : '–');
  row(t('agree.only'), t('agree.onlyVal', { g: f.int(p.c_gonly), c: f.int(p.c_conly), n: f.int(p.c_n) }), enough && p.c_n > 0 && (p.c_gonly + p.c_conly) / p.c_n > CC_RULES.unmatchedShare);
  row(t('agree.rate'), t('agree.rateVal', { v: f.sig2(p.rate_m6) }));
  sec.append(dl);
  const plain = flag === 'few'
    ? t('agree.plainFew', { n: f.int(p.c_n) })
    : `${t('agree.plain', { n: f.int(p.c_n) })} ${t(flag === 'ok' ? 'agree.plainOk' : 'agree.plainCheck')} ${t('agree.plainMb')}`;
  sec.append(h('p', { class: 'plain', text: plain }));
  sec.append(h('p', { class: 'hint', text: t('agree.counts', { ig: f.int(p.n_iscgem), cc: f.int(p.n_comcat), cutoff: ctx.manifest.data_cutoff_utc }) }));
  return sec;
}

/** Table view of every cell with a b-value: the keyboard and screen-reader route into the map data. */
export function renderCellList(cells, ctx) {
  token++;
  document.getElementById('panel').classList.remove('full');
  const d = ctx.state.d;
  document.getElementById('panel').hidden = false;
  document.getElementById('panel-eyebrow').textContent = t('list.eyebrow');
  document.getElementById('panel-title').textContent = t('list.title');
  const rows = cells.filter((p) => p[`${d}_q`] === 'A' || p[`${d}_q`] === 'B');
  document.getElementById('panel-meta').textContent = t('list.meta', { n: f.int(rows.length), depth: f.depthName(d) });
  const body = document.getElementById('panel-body');
  let sort = 'b';
  const sorters = { b: (a, b) => a[`${d}_b`] - b[`${d}_b`], bd: (a, b) => b[`${d}_b`] - a[`${d}_b`], w: (a, b) => a[`${d}_ciw`] - b[`${d}_ciw`], n: (a, b) => b[`${d}_nb`] - a[`${d}_nb`] };
  const sel = h('select', { class: 'select', 'aria-label': t('list.sortBy'), onchange: (e) => { sort = e.target.value; draw(); } },
    ['b', 'bd', 'w', 'n'].map((k) => h('option', { value: k, text: t(`list.sort.${k}`) })));
  const tb = h('tbody');
  const table = h('table', { class: 'data' }, h('caption', { class: 'sr-only', text: t('list.title') }),
    h('thead', {}, h('tr', {}, [t('list.col.centre'), 'b [95 %]', t('col.quality'), t('col.events')].map((c) => h('th', { scope: 'col', text: c })))), tb);
  const draw = () => {
    tb.replaceChildren(...rows.slice().sort(sorters[sort]).map((p) => h('tr', {},
      h('td', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.onOpen(p.id), text: f.latlon(p.lat, p.lon) })),
      h('td', { text: f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]) }),
      h('td', { text: p[`${d}_q`] }),
      h('td', { text: f.int(p[`${d}_nb`]) }))));
  };
  draw();
  body.replaceChildren(h('p', { class: 'hint', text: t(ctx.state.k ? 'list.hintCompare' : 'list.hint') }), sel, table);
}

/** Where a regional cell's numbers come from: catalogue, magnitude type, licence, attribution and caveat. */
function regionalSource(reg) {
  const dl = h('dl', { class: 'agree' });
  const row = (k, v) => { if (v !== undefined && v !== null && v !== '') dl.append(h('dt', { text: k }), h('dd', { class: 'reg-dd', text: String(v) })); };
  row(t('reg.catalogue'), reg.catalogue);
  row(t('reg.magtype'), reg.magtype);
  row(t('about.licence'), reg.licence);
  row(t('reg.period'), Array.isArray(reg.period) ? t('about.range', { a: reg.period[0], b: reg.period[1] }) : null);
  row(t('reg.radius'), f.isNum(reg.radius_km) ? f.km(reg.radius_km) : null);
  const sec = h('section', {}, H3('reg.sourceH', 'regional-catalogues'), dl);
  if (reg.attribution) sec.append(h('p', { class: 'hint' }, `${t('reg.attribution')}: ${reg.attribution}`));
  if (reg.caveat) sec.append(h('p', { class: 'plain', text: `${t('reg.caveat')}: ${reg.caveat}` }));
  if (safeUrl(reg.source_url)) sec.append(extLink(reg.source_url, t('reg.source')));
  return sec;
}

/**
 * Regional cells (one catalogue per region). Detail keys: fmd, mc_t, mc_periods, b_cutoff, rate_years,
 * rate_above_thr, rate_all, stats. Older fmd_* keys are also accepted.
 */
function regionalCharts(p, det, d, reg) {
  const dd = det[d];
  if (!dd) return [h('section', {}, h('p', { class: 'hint', text: t('panel.noDepth', { depth: f.depthShort(d) }) }))];
  const out = [];
  const mt = det.magtype || reg.magtype || '';
  const keys = Object.keys(dd).filter((k) => /^fmd(_|$)/.test(k) && Array.isArray(dd[k]) && dd[k].length);
  const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
  const series = keys.slice(0, 3).map((k, i) => ({ key: 'line', name: k === 'fmd' ? reg.catalogue : k.replace(/^fmd_/, ''), color: colors[i], type: 'line', points: cumulativeFmd(dd[k]), fmt: (v) => `N = ${f.int(v)}` }));
  const mc = f.isNum(p[`${d}_mc`]) ? p[`${d}_mc`] : (dd.stats && f.isNum(dd.stats.mc) ? dd.stats.mc : undefined);
  if (series.length) {
    const pts = series.flatMap((s) => s.points);
    const ms = pts.map((x) => x[0]), ns = pts.map((x) => x[1]).filter((n) => n > 0);
    out.push(h('section', {}, H3('fmd.h', 'frequency-magnitude-distribution'), xyChart({
      title: t('fmd.title'), sub: [reg.catalogue, mt].filter(Boolean).join('. '), alt: t('fmd.alt'),
      x: { domain: [Math.floor(Math.min(...ms) * 10) / 10 - 0.1, Math.ceil(Math.max(...ms) * 10) / 10 + 0.1], label: t('axis.magnitude') },
      y: { type: 'log', domain: [0.8, Math.max(...ns) * 1.5] },
      series,
      xRules: mc !== undefined ? [{ value: mc - 0.05, label: `Mc ${f.mag(mc)}`, dashed: true }] : [],
      hoverTitle: (x) => `M ≥ ${f.mag(x)}`,
      table: { columns: ['M', ...series.map((s) => `${s.name} N ≥ M`)], rows: [...new Set(ms)].sort((a, b) => a - b).map((m) => [f.mag(m), ...series.map((s) => f.int((s.points.find((x) => x[0] === m) || [])[1]))]) },
    })));
  }
  const mcSegs = (Array.isArray(dd.mc_periods) && dd.mc_periods.length ? dd.mc_periods : Array.isArray(dd.mc_t) ? dd.mc_t : [])
    .map(([y0, y1, n, m]) => [y0, y1 + 1, m, n]);
  const mcVals = mcSegs.map((s) => s[2]).filter(f.isNum);
  if (mcVals.length) {
    out.push(h('section', {}, H3('mct.h', 'magnitude-of-completeness'), xyChart({
      title: t('mct.title'), sub: t('reg.mctSub'), alt: t('mct.alt'), height: 150,
      x: { domain: [Math.min(...mcSegs.map((s) => s[0])) - 1, Math.max(...mcSegs.map((s) => s[1])) + 1], label: t('axis.year') },
      y: { domain: padDomain(Math.min(...mcVals) - 0.1, Math.max(...mcVals) + 0.1, 0.05) },
      series: [{ name: 'Mc', color: 'var(--s1)', type: 'segments', segs: mcSegs.map((s) => [s[0], s[1], s[2]]), fmt: (v, x) => { const g = mcSegs.find((s) => x >= s[0] && x <= s[1]); return `Mc ${f.mag(v)} (${g[0]}–${g[1] - 1}, n = ${f.int(g[3])})`; } }],
      hoverTitle: (x) => t('mct.around', { y: Math.round(x) }),
      table: { columns: [t('col.window'), t('col.events'), 'Mc'], rows: mcSegs.map((s) => [`${s[0]}–${s[1] - 1}`, f.int(s[3]), f.isNum(s[2]) ? f.mag(s[2]) : t('mct.few')]) },
    })));
  }
  const q = p[`${d}_q`];
  if ((q === 'A' || q === 'B') && Array.isArray(dd.b_cutoff) && dd.b_cutoff.length) {
    const bc = dd.b_cutoff;
    const lo = Math.min(...bc.map((r) => r[2])), hi = Math.max(...bc.map((r) => r[3]));
    out.push(h('section', {}, H3('bc.h', 'gutenberg-richter-b-value'), xyChart({
      title: t('bc.title'), alt: t('bc.alt'), height: 170,
      x: { domain: [bc[0][0] - 0.05, bc[bc.length - 1][0] + 0.05], label: t('axis.magnitude') },
      y: { domain: padDomain(Math.min(lo, 0.9), Math.max(hi, 1.1), 0.04) },
      series: [{ name: 'b', color: 'var(--s1)', type: 'linedots', points: bc.map((r) => [r[0], r[1]]), band: bc.map((r) => [r[0], r[2], r[3]]), r: 3, noLegend: true, fmt: (v, x) => { const r = bc.find((y) => y[0] === x); return `b ${f.interval(r[1], r[2], r[3])}${r[4] !== undefined ? `, n = ${f.int(r[4])}` : ''}`; } }],
      yRules: [{ value: 1, label: 'b = 1' }],
      hoverTitle: (x) => t('bc.cutoff', { m: f.mag(x) }),
      table: { columns: [t('col.cutoff'), 'b', t('col.lo95'), t('col.hi95'), 'n'], rows: bc.map((r) => [f.mag(r[0]), f.b2(r[1]), f.b2(r[2]), f.b2(r[3]), f.int(r[4])]) },
      note: t('bc.noteReg', { q }),
    })));
  }
  const [ry0] = dd.rate_years || [];
  if (f.isNum(ry0)) {
    const sec = h('section', {}, h('h3', { text: t('yr.h') }));
    for (const [k, title, color] of [['rate_all', t('reg.rateAll'), 'var(--s2)'], ['rate_above_thr', t('reg.rateAbove'), 'var(--s1)']]) {
      if (!Array.isArray(dd[k]) || !dd[k].length) continue;
      sec.append(sparkColumns({
        title, alt: title, x0: ry0, values: dd[k], color, unit: t('yr.unit'),
        table: { columns: [t('col.year'), t('col.events')], rows: dd[k].map((v, i) => [String(ry0 + i), v === null ? t('yr.nodata') : f.int(v)]) },
      }));
    }
    if (sec.children.length > 1) out.push(sec);
  }
  if (!out.length) out.push(h('section', {}, h('p', { class: 'hint', text: t('panel.noDetailReg') })));
  return out;
}
