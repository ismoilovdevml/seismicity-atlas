// Cell detail panel (side panel on desktop, bottom sheet on phones). Charts load lazily from cells/<id>.json.

import * as f from './fmt.js';
import { h, xyChart, forestChart, sparkColumns, padDomain } from './charts.js';
import { getJSON, ruleNumber } from './data.js';
import { bSentence } from './map.js';
import { CC_RULES } from './layers.js';

const QCOLOR = { A: 'var(--s1)', B: 'var(--s1)' };

export function qBadge(q) {
  const lab = q === 'insufficient' ? 'Insufficient' : `Quality ${q}`;
  return h('span', { class: `qbadge${q === 'C' ? ' hatch' : ''}`, style: q === 'A' || q === 'B' ? `--c:${QCOLOR[q]}` : '' }, h('i', { 'aria-hidden': 'true' }), lab);
}

let token = 0;

/** Render the panel for cell properties p. ctx: {state, manifest, onDepth(d), onClose()} */
export function renderPanel(p, ctx) {
  const my = ++token;
  const st = ctx.state;
  const d = st.d;
  const panel = document.getElementById('panel');
  document.getElementById('panel-title').textContent = `Cell at ${f.latlon(p.lat, p.lon)}`;
  document.getElementById('panel-meta').textContent = `${f.PB_NAMES[p.pb] || p.pb}. H3 cell ${p.id}, ${f.int(p.area_km2)} km².`;
  const body = document.getElementById('panel-body');
  body.replaceChildren();
  panel.hidden = false;

  // depth switch inside the panel mirrors the map control
  const seg = h('fieldset', { class: 'seg panel-depth', 'aria-label': 'Depth class for this panel' },
    ['sh', 'dp'].map((k) => h('label', {}, h('input', { type: 'radio', name: 'pdepth', value: k, checked: k === d, onchange: () => ctx.onDepth(k) }), k === 'sh' ? 'Shallow ≤ 70 km' : 'Deeper > 70 km')));
  body.append(seg);

  // b-value summary
  const q = p[`${d}_q`];
  const bs = bSentence(p, d, ctx.manifest);
  const sec1 = h('section', { 'aria-labelledby': 'h-b' }, h('h3', { id: 'h-b', text: 'b-value' }));
  const qB = ruleNumber(ctx.manifest.method.quality.B);
  if (q === 'A' || q === 'B') {
    sec1.append(h('p', { class: 'lead-b' }, h('strong', { text: f.b2(p[`${d}_b`]) }), ` [${f.b2(p[`${d}_b_lo`])}, ${f.b2(p[`${d}_b_hi`])}] 95 % interval `, qBadge(q)));
    const g = ctx.manifest.global[d === 'sh' ? 'b_shallow_1976_2021' : 'b_deep_1976_2021'];
    const rows = [
      { label: 'b (map value)', v: p[`${d}_b`], lo: p[`${d}_b_lo`], hi: p[`${d}_b_hi`], emph: true, color: 'var(--s1)', text: f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]) },
      p[`${d}_bpos`] !== undefined
        ? { label: 'b-positive', v: p[`${d}_bpos`], lo: p[`${d}_bpos_lo`], hi: p[`${d}_bpos_hi`], color: 'var(--ink-3)', text: f.interval(p[`${d}_bpos`], p[`${d}_bpos_lo`], p[`${d}_bpos_hi`]) }
        : { label: 'b-positive', v: null, text: 'not available' },
      p[`${d}_bdecl`] !== undefined
        ? { label: 'b, declustered', v: p[`${d}_bdecl`], lo: p[`${d}_bdecl_lo`], hi: p[`${d}_bdecl_hi`], color: 'var(--ink-3)', text: f.interval(p[`${d}_bdecl`], p[`${d}_bdecl_lo`], p[`${d}_bdecl_hi`]) }
        : { label: 'b, declustered', v: null, text: 'not available' },
    ];
    const vals = rows.filter((r) => r.v !== null).flatMap((r) => [r.lo, r.hi]).concat([g.ci95[0], g.ci95[1]]);
    const dom = [Math.floor((Math.min(...vals) - 0.05) * 10) / 10, Math.ceil((Math.max(...vals) + 0.05) * 10) / 10];
    sec1.append(forestChart({
      title: 'Three estimates with 95 % intervals',
      sub: `Grey band and line: global ${f.DEPTH_SHORT[d]} b, ${f.interval(g.b, g.ci95[0], g.ci95[1], f.b3)}`,
      alt: `b-value ${rows[0].text} compared with b-positive and declustered b`,
      rows, domain: dom, ref: { value: g.b, lo: g.ci95[0], hi: g.ci95[1], label: 'global' }, labelWidth: 120,
      table: { columns: ['Estimate', 'b', '95 % low', '95 % high'], rows: rows.map((r) => [r.label, f.b2(r.v), f.b2(r.lo), f.b2(r.hi)]) },
      note: 'Declustering (Gardner-Knopoff) removes many events in a global M ≥ 5 catalogue, so its b mostly reflects the window choice. The map shows the full catalogue.',
    }));
    if (p[`${d}_unstable`]) sec1.append(h('p', { class: 'hint', text: 'Cutoff-unstable: b at threshold +0.2 and +0.4 both fall outside the interval on the same side. Treat this value with extra care.' }));
  } else {
    sec1.append(h('p', { class: 'lead-b' }, h('strong', { text: bs.strong }), ' ', qBadge(q)));
    sec1.append(h('p', { class: 'hint', text: q === 'C'
      ? `The 95 % interval is ${f.b2(p[`${d}_ciw`])} wide. A b-value is shown only when the interval is at most ${qB.toFixed(2)} wide.`
      : `Only ${f.int(p[`${d}_nb`] || 0)} events lie above the completeness threshold. At least ${ruleNumber(ctx.manifest.method.quality.insufficient)} are needed.` }));
  }
  const facts = h('dl', { class: 'facts' });
  const fact = (k, v) => facts.append(h('dt', { text: k }), h('dd', { text: v }));
  if (p[`${d}_mc`] !== undefined) fact('Mc, ISC-GEM', `${f.mag(p[`${d}_mc`])} Mw [${f.mag(p[`${d}_mc_lo`])}, ${f.mag(p[`${d}_mc_hi`])}]`);
  fact('Events in circle', `${f.int(p[`${d}_n`])} (ISC-GEM 1976–2021, within ${ctx.manifest.method.sample_radius_km} km)`);
  fact('Above threshold', f.int(p[`${d}_nb`]));
  if (p[`${d}_mc_cc`] !== undefined) fact('Mc, ComCat 2010+', `${f.mag(p[`${d}_mc_cc`])} as served`);
  if (p[`${d}_mc_cc0`] !== undefined) fact('Mc, ComCat 1973–1989', `${f.mag(p[`${d}_mc_cc0`])} as served`);
  sec1.append(facts);
  body.append(sec1);

  // lazy charts
  const charts = h('div');
  body.append(charts);
  body.append(consistencySection(p));
  body.append(countsSection(p, ctx));

  if (!p.detail) {
    charts.append(h('section', {}, h('h3', { text: 'Charts' }), h('p', { class: 'hint', text: 'No detail file for this cell: the circle holds fewer than 20 ISC-GEM and fewer than 50 ComCat events.' })));
    return;
  }
  const load = () => {
    charts.replaceChildren(h('div', { class: 'loading', role: 'status', text: 'Loading charts for this cell…' }));
    getJSON(`cells/${p.id}.json`).then((det) => {
      if (my !== token) return;
      charts.replaceChildren(...detailCharts(p, det, d, ctx));
    }).catch((e) => {
      if (my !== token) return;
      charts.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} The summary above comes from the map data. `, h('button', { class: 'small-btn', type: 'button', onclick: load, text: 'Try again' })));
    });
  };
  load();
}

function detailCharts(p, det, d, ctx) {
  const dd = det[d];
  if (!dd) return [h('section', {}, h('p', { class: 'hint', text: `No ${f.DEPTH_SHORT[d]} events in this circle to chart. Switch the depth class above.` }))];
  const out = [];
  const q = p[`${d}_q`];

  // 1. FMD
  const cum = (pairs) => {
    const out2 = []; let s = 0;
    for (let i = pairs.length - 1; i >= 0; i--) { s += pairs[i][1]; out2.unshift([pairs[i][0], s]); }
    return out2;
  };
  const fi = cum(dd.fmd_iscgem || []), fc = cum(dd.fmd_comcat || []);
  if (fi.length || fc.length) {
    const ms = [...fi, ...fc].map((x) => x[0]);
    const ns = [...fi, ...fc].map((x) => x[1]).filter((n) => n > 0);
    const mc = p[`${d}_mc`];
    out.push(h('section', {}, h('h3', { text: 'Frequency-magnitude distribution' }), xyChart({
      title: 'Cumulative number of events, N ≥ M',
      sub: 'ISC-GEM Mw 1976–2021 and ComCat as served (mostly mb) 1973 to cut-off. Log scale.',
      alt: 'Cumulative frequency-magnitude distribution for both catalogues',
      x: { domain: [Math.floor(Math.min(...ms) * 10) / 10 - 0.1, Math.ceil(Math.max(...ms) * 10) / 10 + 0.1], label: 'Magnitude' },
      y: { type: 'log', domain: [0.8, Math.max(...ns) * 1.5] },
      series: [
        { key: 'line', name: 'ISC-GEM, Mw', color: 'var(--s1)', type: 'line', points: fi, fmt: (v) => `N = ${f.int(v)}` },
        { key: 'line', name: 'ComCat, as served', color: 'var(--s2)', type: 'line', points: fc, fmt: (v) => `N = ${f.int(v)}` },
      ],
      xSpans: mc !== undefined ? [{ from: p[`${d}_mc_lo`] - 0.05, to: p[`${d}_mc_hi`] + 0.05 }] : [],
      xRules: mc !== undefined ? [{ value: mc - 0.05, label: `Mc ${f.mag(mc)}` }] : [],
      hoverTitle: (x) => `M ≥ ${f.mag(x)}`,
      table: { columns: ['M', 'ISC-GEM N ≥ M', 'ComCat N ≥ M'], rows: [...new Set(ms)].sort((a, b) => a - b).map((m) => [f.mag(m), f.int((fi.find((x) => x[0] === m) || [])[1]), f.int((fc.find((x) => x[0] === m) || [])[1])]) },
      note: mc !== undefined ? `Shaded: the bootstrap 95 % range of Mc, ${f.mag(p[`${d}_mc_lo`])}–${f.mag(p[`${d}_mc_hi`])}. The two catalogues use different magnitude scales.` : 'The two catalogues use different magnitude scales.',
    })));
  }

  // 2. Mc(t)
  const mi = (dd.mc_t_iscgem || []).map(([y0, y1, n, mc]) => [y0, y1 + 1, mc, n]);
  const mcc = (dd.mc_t_comcat || []).map(([y0, y1, n, mc]) => [y0, y1 + 1, mc, n]);
  const allMc = [...mi, ...mcc].map((s) => s[2]).filter((v) => v !== null);
  if (allMc.length) {
    const segFmt = (segs) => (v, x) => { const s = segs.find((g) => x >= g[0] && x <= g[1]); return `Mc ${f.mag(v)} (${s[0]}–${s[1] - 1}, n = ${f.int(s[3])})`; };
    out.push(h('section', {}, h('h3', { text: 'Completeness over time' }), xyChart({
      title: 'Mc by time window',
      sub: 'ISC-GEM: 10-year windows, Mw. ComCat: 5-year windows, as served. Windows with fewer than 50 events have no Mc.',
      alt: 'Magnitude of completeness over time for both catalogues',
      height: 170,
      x: { domain: [1900, Math.max(2027, ...mcc.map((s) => s[1]))], label: 'Year' },
      y: { domain: padDomain(Math.min(...allMc) - 0.1, Math.max(...allMc) + 0.1, 0.05) },
      series: [
        { name: 'ISC-GEM, Mw', color: 'var(--s1)', type: 'segments', segs: mi.map((s) => [s[0], s[1], s[2]]), fmt: segFmt(mi) },
        { name: 'ComCat, as served', color: 'var(--s2)', type: 'segments', segs: mcc.map((s) => [s[0], s[1], s[2]]), fmt: segFmt(mcc) },
      ],
      hoverTitle: (x) => `Around ${Math.round(x)}`,
      table: { columns: ['Catalogue', 'Window', 'Events', 'Mc'], rows: [...mi.map((s) => ['ISC-GEM', `${s[0]}–${s[1] - 1}`, f.int(s[3]), s[2] === null ? 'too few' : f.mag(s[2])]), ...mcc.map((s) => ['ComCat', `${s[0]}–${s[1] - 1}`, f.int(s[3]), s[2] === null ? 'too few' : f.mag(s[2])])] },
    })));
  }

  // 3. b vs cutoff, only where the cell passes the quality gate
  const sec3 = h('section', {}, h('h3', { text: 'b against magnitude cutoff' }));
  if ((q === 'A' || q === 'B') && dd.b_cutoff && dd.b_cutoff.length) {
    const bc = dd.b_cutoff;
    const lo = Math.min(...bc.map((r) => r[2])), hi = Math.max(...bc.map((r) => r[3]));
    sec3.append(xyChart({
      title: 'b at fixed cutoffs, with 95 % interval band',
      sub: 'Threshold = max(cutoff, period floor). Shi-Bolt interval. A flat curve means b does not depend on the cutoff.',
      alt: 'b-value as a function of magnitude cutoff with interval band',
      height: 170,
      x: { domain: [bc[0][0] - 0.05, bc[bc.length - 1][0] + 0.05], label: 'Cutoff magnitude, Mw' },
      y: { domain: padDomain(Math.min(lo, 0.9), Math.max(hi, 1.1), 0.04) },
      series: [{ name: 'b', color: 'var(--s1)', type: 'linedots', points: bc.map((r) => [r[0], r[1]]), band: bc.map((r) => [r[0], r[2], r[3]]), r: 3, noLegend: true, fmt: (v, x) => { const r = bc.find((y) => y[0] === x); return `b ${f.interval(r[1], r[2], r[3])}, n = ${f.int(r[4])}`; } }],
      yRules: [{ value: 1, label: 'b = 1' }],
      xRules: p[`${d}_mc`] !== undefined ? [{ value: p[`${d}_mc`], label: `cell Mc ${f.mag(p[`${d}_mc`])}` }] : [],
      hoverTitle: (x) => `Cutoff ${f.mag(x)}`,
      table: { columns: ['Cutoff', 'b', '95 % low', '95 % high', 'n'], rows: bc.map((r) => [f.mag(r[0]), f.b2(r[1]), f.b2(r[2]), f.b2(r[3]), f.int(r[4])]) },
      note: `Shown only because this cell is quality ${q}. Points need at least 30 events.`,
    }));
  } else {
    sec3.append(h('p', { class: 'hint', text: 'Hidden: this cell does not pass the quality gate, so no b-value is shown for it at any cutoff.' }));
  }
  out.push(sec3);

  // 4. yearly rates
  const [ry0] = dd.rate_years || [1973];
  const covI = ctx.manifest.coverage.iscgem.map((s) => +String(s).slice(0, 4));
  const sec4 = h('section', {}, h('h3', { text: 'Events per year' }));
  if (dd.rate_comcat_m45 && dd.rate_comcat_m45.length) {
    sec4.append(sparkColumns({
      title: 'ComCat, M ≥ 4.5 as served',
      sub: `Within ${det.radius_km} km of the cell centre. The last year runs to the data cut-off, ${ctx.manifest.data_cutoff_utc}.`,
      alt: 'Yearly counts of ComCat M4.5+ events', x0: ry0, values: dd.rate_comcat_m45, color: 'var(--s2)', unit: 'events',
      table: { columns: ['Year', 'Events'], rows: dd.rate_comcat_m45.map((v, i) => [String(ry0 + i), f.int(v)]) },
    }));
  }
  if (dd.rate_iscgem_above_thr && dd.rate_iscgem_above_thr.length) {
    // ISC-GEM counts exist only for the b period; other years are no data, not zero
    const bYears = (ctx.manifest.method.b_catalogue.match(/(\d{4})\D+(\d{4})/) || [0, 1976, covI[1]]).slice(1).map(Number);
    const vals = dd.rate_iscgem_above_thr.map((v, i) => (ry0 + i >= bYears[0] && ry0 + i <= bYears[1] ? v : null));
    sec4.append(sparkColumns({
      title: 'ISC-GEM, events above their completeness threshold',
      sub: `${bYears[0]}–${bYears[1]} only; the events used for b.`,
      alt: 'Yearly counts of ISC-GEM events above threshold', x0: ry0, values: vals, color: 'var(--s1)', unit: 'events',
      table: { columns: ['Year', 'Events'], rows: vals.map((v, i) => [String(ry0 + i), v === null ? 'no data' : f.int(v)]) },
    }));
  }
  if (sec4.children.length > 1) out.push(sec4);
  return out;
}

function consistencySection(p) {
  const sec = h('section', { 'aria-labelledby': 'h-cc' }, h('h3', { id: 'h-cc', text: 'Do the two catalogues agree here?' }));
  const flag = p.c_flag;
  const label = { ok: 'They agree', check: 'Check: they disagree on at least one test', few: 'Too few shared events to compare' }[flag];
  sec.append(h('p', { class: `status ${flag}` }, h('span', { 'aria-hidden': 'true', text: flag === 'ok' ? '✓' : flag === 'check' ? '!' : '–' }), label));
  const li = [];
  const add = (txt, flagged) => li.push(h('li', { class: flagged ? 'flagged' : '', text: txt }));
  add(`${f.int(p.c_n)} events in this cell are in both ISC-GEM and ComCat (1973–2021, matched within 30 s and 100 km).`);
  if (p.c_dmw !== undefined) {
    const v = p.c_dmw;
    add(v === 0 ? 'ComCat moment magnitudes equal ISC-GEM Mw (median).' : `ComCat moment magnitudes are ${f.fixed(Math.abs(v), 2)} ${v > 0 ? 'higher' : 'lower'} than ISC-GEM Mw (median).`, Math.abs(v) > CC_RULES.dmw && p.c_n >= CC_RULES.minPairs);
  }
  if (p.c_dmb !== undefined) add(`ComCat mb is ${f.fixed(Math.abs(p.c_dmb), 2)} ${p.c_dmb >= 0 ? 'higher' : 'lower'} than ISC-GEM Mw (median). mb is a different scale, so this offset is expected, not an error.`);
  if (p.c_dloc !== undefined) add(`Epicentres of the same event differ by ${f.km(p.c_dloc)} (median).`, p.c_dloc > CC_RULES.dlocKm && p.c_n >= CC_RULES.minPairs);
  if (p.c_ddep !== undefined) add(p.c_ddep === 0 ? 'Depths agree (median difference 0 km).' : `ComCat depths are ${f.km(Math.abs(p.c_ddep))} ${p.c_ddep > 0 ? 'deeper' : 'shallower'} than ISC-GEM (median).`);
  const un = p.c_gonly + p.c_conly;
  add(`${f.int(p.c_gonly)} ISC-GEM events have no ComCat match, and ${f.int(p.c_conly)} ComCat events of Mw-proxy 6.0 or more have no ISC-GEM match.`, p.c_n >= CC_RULES.minPairs && p.c_n > 0 && un / p.c_n > CC_RULES.unmatchedShare);
  sec.append(h('ul', { class: 'plain' }, li));
  if (li.some((x) => x.classList.contains('flagged'))) sec.append(h('p', { class: 'hint', text: 'Lines marked "!" are the tests that set the "check" flag.' }));
  return sec;
}

function countsSection(p, ctx) {
  const facts = h('dl', { class: 'facts' });
  const fact = (k, v) => facts.append(h('dt', { text: k }), h('dd', { text: v }));
  fact('ISC-GEM events in the cell', `${f.int(p.n_iscgem)} (all years, all depths)`);
  fact('ComCat M ≥ 4.5 in the cell', `${f.int(p.n_comcat)} (1973 to ${ctx.manifest.data_cutoff_utc})`);
  fact('M6+ rate', `${f.sig2(p.rate_m6)} per year per 100,000 km² (1964–2021)`);
  return h('section', {}, h('h3', { text: 'Counts in the cell itself' }), facts);
}

/** Table view of every cell with a b-value: the keyboard and screen-reader route into the map data. */
export function renderCellList(cells, ctx) {
  token++;
  const d = ctx.state.d;
  document.getElementById('panel').hidden = false;
  document.getElementById('panel-title').textContent = 'Cells with a b-value';
  const rows = cells.filter((p) => p[`${d}_q`] === 'A' || p[`${d}_q`] === 'B');
  document.getElementById('panel-meta').textContent = `${f.int(rows.length)} cells, ${f.DEPTH_NAMES[d].toLowerCase()}, quality A or B.`;
  const body = document.getElementById('panel-body');
  let sort = 'b';
  const sorters = { b: (a, b) => a[`${d}_b`] - b[`${d}_b`], bd: (a, b) => b[`${d}_b`] - a[`${d}_b`], w: (a, b) => a[`${d}_ciw`] - b[`${d}_ciw`], n: (a, b) => b[`${d}_nb`] - a[`${d}_nb`] };
  const sel = h('select', { class: 'sub-select', 'aria-label': 'Sort cells by', onchange: (e) => { sort = e.target.value; draw(); } },
    h('option', { value: 'b', text: 'Sort by b, lowest first' }), h('option', { value: 'bd', text: 'Sort by b, highest first' }),
    h('option', { value: 'w', text: 'Sort by interval width, narrowest first' }), h('option', { value: 'n', text: 'Sort by events above Mc, most first' }));
  const tb = h('tbody');
  const table = h('table', { class: 'data' }, h('caption', { class: 'sr-only', text: 'Cells with a b-value' }),
    h('thead', {}, h('tr', {}, ['Cell centre', 'b [95 %]', 'Quality', 'Events'].map((c) => h('th', { scope: 'col', text: c })))), tb);
  const draw = () => {
    tb.replaceChildren(...rows.slice().sort(sorters[sort]).map((p) => h('tr', {},
      h('td', {}, h('button', { class: 'linkish', type: 'button', onclick: () => ctx.onOpen(p.id), text: f.latlon(p.lat, p.lon) })),
      h('td', { text: f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]) }),
      h('td', { text: p[`${d}_q`] }),
      h('td', { text: f.int(p[`${d}_nb`]) }))));
  };
  draw();
  body.replaceChildren(h('p', { class: 'hint', text: 'Each row opens that cell. Switch the depth class in the layer panel to list deeper cells.' }), sel, table);
}
