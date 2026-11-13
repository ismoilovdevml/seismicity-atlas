// Cell detail panel (side panel on desktop, bottom sheet on phones). Charts load lazily from cells/<id>.json.

import * as f from './fmt.js';
import { h, xyChart, forestChart, sparkColumns, padDomain } from './charts.js';
import { getJSON, ruleNumber } from './data.js';
import { CC_RULES } from './layers.js';

export function qPill(q) {
  const cls = q === 'A' ? 'ok' : q === 'B' ? 'close' : q === 'C' ? 'na' : '';
  return h('span', { class: `pill ${cls}`, text: q === 'insufficient' ? 'Insufficient' : `Quality ${q}` });
}

let token = 0;

function scaleBar(v, lo, hi) {
  const D0 = 0.6, D1 = 1.6;
  const pct = (x) => `${Math.max(0, Math.min(100, ((x - D0) / (D1 - D0)) * 100))}%`;
  const w = (x0, x1) => `${Math.max(0.5, ((Math.min(D1, x1) - Math.max(D0, x0)) / (D1 - D0)) * 100)}%`;
  return h('div', { class: 'scale', role: 'img', 'aria-label': `b ${f.b2(v)} with 95 % interval ${f.b2(lo)} to ${f.b2(hi)}, on a scale from ${D0} to ${D1}` },
    h('div', { class: 'track' }), h('div', { class: 'ci', style: `left:${pct(lo)};width:${w(lo, hi)}` }),
    h('div', { class: 'one', style: `left:${pct(1)}` }), h('div', { class: 'est', style: `left:${pct(v)}` }),
    h('span', { style: 'left:0', text: '0.6' }), h('span', { style: `left:${pct(1)};margin-left:4px`, text: '1.0' }), h('span', { style: 'right:0', text: '1.6' }));
}

const tile = (k, v, small) => h('div', { class: 'tile' }, h('span', { class: 'k', text: k }), h('span', { class: 'v' }, v, small ? h('small', { text: ` ${small}` }) : null));

/** Render the panel for cell properties p. ctx: {state, manifest, onClose()} */
export function renderPanel(p, ctx) {
  const my = ++token;
  const d = ctx.state.d;
  const panel = document.getElementById('panel');
  panel.classList.remove('full');
  document.getElementById('panel-eyebrow').textContent = 'Selected cell';
  document.getElementById('panel-title').textContent = f.latlon(p.lat, p.lon, 2);
  document.getElementById('panel-meta').textContent = `${f.PB_NAMES[p.pb] || p.pb}, ${ctx.manifest.method.sample_radius_km} km sample radius, ${f.DEPTH_SHORT[d]}. H3 ${p.id.slice(0, 7)}…`;
  const body = document.getElementById('panel-body');
  body.replaceChildren();
  panel.hidden = false;

  const q = p[`${d}_q`];
  const nMin = ruleNumber(ctx.manifest.method.quality.insufficient);
  const qB = ruleNumber(ctx.manifest.method.quality.B);
  const top = h('section', { 'aria-label': 'b-value' });
  if (q === 'A' || q === 'B') {
    top.append(h('div', { class: 'bhead' },
      h('div', {}, h('span', { class: 'lbl', text: 'b-value' }), h('span', { class: 'bbig', text: f.b2(p[`${d}_b`]) })),
      h('div', { class: 'bside' }, h('span', { class: 'mono', text: `95 % CI ${f.b2(p[`${d}_b_lo`])} – ${f.b2(p[`${d}_b_hi`])}` }),
        h('span', { class: 'pill-line' }, qPill(q), `${f.int(p[`${d}_nb`])} events above Mc`))));
    top.append(scaleBar(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]));
    if (p[`${d}_unstable`]) top.append(h('p', { class: 'hint', text: 'Cutoff-unstable: b at threshold +0.2 and +0.4 both fall outside the interval on the same side. Treat with extra care.' }));
  } else {
    const nb = p[`${d}_nb`] || 0;
    const why = q === 'C'
      ? `${f.int(nb)} events lie above Mc${p[`${d}_mc`] !== undefined ? ` ${f.mag(p[`${d}_mc`])}` : ''} here, but the 95 % interval would be ${f.b2(p[`${d}_ciw`])} wide; the atlas shows b only when it is at most ${qB.toFixed(2)} wide. The estimate is withheld rather than guessed.`
      : `Only ${f.int(nb)} events lie above Mc${p[`${d}_mc`] !== undefined ? ` ${f.mag(p[`${d}_mc`])}` : ''} at ${d === 'sh' ? 'depths of 70 km or less' : 'depths over 70 km'} here; the atlas needs at least ${nMin}.${p[`${d}_ciw`] !== undefined ? ` The 95 % interval would be ${f.b2(p[`${d}_ciw`])} wide.` : ''} The estimate is withheld rather than guessed.`;
    top.append(h('div', { class: 'withheld' }, h('strong', { text: `${d === 'sh' ? 'Shallow' : 'Deeper'} events: no b-value shown` }), h('p', { text: why }), qPill(q)));
  }
  const tiles = h('div', { class: 'tiles' });
  tiles.append(tile('Mc, ISC-GEM', p[`${d}_mc`] !== undefined ? f.mag(p[`${d}_mc`]) : '–', p[`${d}_mc`] !== undefined ? `(${f.mag(p[`${d}_mc_lo`])}–${f.mag(p[`${d}_mc_hi`])})` : ''));
  tiles.append(tile('Mc, ComCat 2010+', p[`${d}_mc_cc`] !== undefined ? f.mag(p[`${d}_mc_cc`]) : '–'));
  if (q === 'A' || q === 'B') {
    tiles.append(tile('b-positive', p[`${d}_bpos`] !== undefined ? f.b2(p[`${d}_bpos`]) : 'n/a', p[`${d}_bpos`] !== undefined ? `[${f.b2(p[`${d}_bpos_lo`])}, ${f.b2(p[`${d}_bpos_hi`])}]` : ''));
    tiles.append(tile('Declustered (GK)', p[`${d}_bdecl`] !== undefined ? f.b2(p[`${d}_bdecl`]) : 'n/a', p[`${d}_bdecl`] !== undefined ? `[${f.b2(p[`${d}_bdecl_lo`])}, ${f.b2(p[`${d}_bdecl_hi`])}]` : ''));
  }
  top.append(tiles);
  body.append(top);

  // peek row (phones): one-line agreement summary and the full-details button
  const flagTxt = { ok: 'Catalogues agree', check: 'Catalogues disagree: check', few: 'Too few shared events' }[p.c_flag];
  const peek = h('div', { class: 'peek-only', style: 'flex-direction:column;gap:12px' },
    h('div', { class: 'tile', style: 'flex-direction:row;justify-content:space-between;align-items:center;background:var(--surface-2);border:0' },
      h('span', { text: flagTxt }), h('span', { class: 'mono', style: 'font-size:12px', text: p.c_dmw !== undefined ? `ΔMw ${f.signed(p.c_dmw)}${p.c_dloc !== undefined ? `, ${f.km(p.c_dloc)}` : ''}` : '' })),
    h('button', { class: 'btn solid', type: 'button', text: 'Full details and charts', onclick: () => { panel.classList.add('full'); } }));
  body.append(peek);

  const full = h('div', { class: 'full-only' });
  body.append(full);
  const charts = h('div', { style: 'display:contents' });
  full.append(charts);
  full.append(agreementSection(p, ctx));
  full.append(h('div', { class: 'panel-actions' },
    p.detail ? h('a', { class: 'btn primary', href: `data/cells/${p.id}.json`, target: '_blank', rel: 'noopener', text: 'Cell data (JSON)' }) : null,
    h('a', { class: 'btn', href: '#v=methods', text: 'How this is computed' })));

  if (!p.detail) {
    charts.append(h('section', {}, h('p', { class: 'hint', text: 'No detail file for this cell: the circle holds fewer than 20 ISC-GEM and fewer than 50 ComCat events.' })));
    return;
  }
  const load = () => {
    charts.replaceChildren(h('section', {}, h('div', { class: 'loading', role: 'status', text: 'Loading charts for this cell…' })));
    getJSON(`cells/${p.id}.json`).then((det) => {
      if (my !== token) return;
      charts.replaceChildren(...detailCharts(p, det, d, ctx));
    }).catch((e) => {
      if (my !== token) return;
      charts.replaceChildren(h('section', {}, h('p', { class: 'error', role: 'alert' }, `${e.message} The numbers above come from the map data. `, h('button', { class: 'small-btn', type: 'button', onclick: load, text: 'Try again' }))));
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
      xRules: mc !== undefined ? [{ value: mc - 0.05, label: `Mc ${f.mag(mc)}`, dashed: true }] : [],
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

function agreementSection(p, ctx) {
  const flag = p.c_flag;
  const pill = h('span', { class: `pill ${flag === 'ok' ? 'ok' : flag === 'check' ? 'bad' : ''}`, text: flag === 'ok' ? 'Consistent' : flag === 'check' ? 'Check' : 'Too few events' });
  const sec = h('section', { 'aria-labelledby': 'h-cc' }, h('div', { class: 'agree-head' }, h('h3', { id: 'h-cc', text: 'Catalogue agreement' }), pill));
  const dl = h('dl', { class: 'agree' });
  const enough = p.c_n >= CC_RULES.minPairs;
  const row = (k, v, flagged) => dl.append(h('dt', { text: k }), h('dd', { class: flagged ? 'flagged' : '', text: v }));
  row('Magnitude, ComCat Mw − ISC-GEM Mw', p.c_dmw !== undefined ? f.signed(p.c_dmw) : '–', enough && Math.abs(p.c_dmw) > CC_RULES.dmw);
  row('ComCat mb − ISC-GEM Mw (scale offset)', p.c_dmb !== undefined ? f.signed(p.c_dmb) : '–');
  row('Epicentre difference (median)', p.c_dloc !== undefined ? f.km(p.c_dloc) : '–', enough && p.c_dloc > CC_RULES.dlocKm);
  row('Depth, ComCat − ISC-GEM', p.c_ddep !== undefined ? `${f.signed(p.c_ddep, 1)} km` : '–');
  row('Events in only one catalogue', `${f.int(p.c_gonly)} + ${f.int(p.c_conly)} of ${f.int(p.c_n)}`, enough && p.c_n > 0 && (p.c_gonly + p.c_conly) / p.c_n > CC_RULES.unmatchedShare);
  row('Mw ≥ 6 rate per 100,000 km²', `${f.sig2(p.rate_m6)} / yr`);
  sec.append(dl);
  const plain = flag === 'few'
    ? `Only ${f.int(p.c_n)} events here are in both catalogues (matched within 30 s and 100 km, 1973–2021), too few to compare.`
    : `${f.int(p.c_n)} events here are in both catalogues (matched within 30 s and 100 km, 1973–2021). ${flag === 'ok' ? 'Their magnitudes and locations agree within the atlas tolerances.' : 'At least one value in red is outside the atlas tolerances.'} The mb offset is expected: mb is a different magnitude scale.`;
  sec.append(h('p', { class: 'plain', text: plain }));
  sec.append(h('p', { class: 'hint', text: `Cell counts: ${f.int(p.n_iscgem)} ISC-GEM events (all years and depths) and ${f.int(p.n_comcat)} ComCat M ≥ 4.5 events to ${ctx.manifest.data_cutoff_utc}. The rate uses ISC-GEM Mw ≥ 6, 1964–2021.` }));
  return sec;
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
  const sel = h('select', { class: 'select', 'aria-label': 'Sort cells by', onchange: (e) => { sort = e.target.value; draw(); } },
    h('option', { value: 'b', text: 'Sort by b, lowest first' }), h('option', { value: 'bd', text: 'Sort by b, highest first' }),
    h('option', { value: 'w', text: 'Sort by interval width, narrowest first' }), h('option', { value: 'n', text: 'Sort by events above Mc, most first' }));
  const tb = h('tbody');
  const table = h('table', { class: 'data' }, h('caption', { class: 'sr-only', text: 'Cells with a b-value' }),
    h('thead', {}, h('tr', {}, ['Cell centre', 'b [95 %]', 'Quality', 'Events'].map((c) => h('th', { scope: 'col', text: c })))), tb);
  const draw = () => {
    tb.replaceChildren(...rows.slice().sort(sorters[sort]).map((p) => h('tr', {},
      h('td', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.onOpen(p.id), text: f.latlon(p.lat, p.lon) })),
      h('td', { text: f.interval(p[`${d}_b`], p[`${d}_b_lo`], p[`${d}_b_hi`]) }),
      h('td', { text: p[`${d}_q`] }),
      h('td', { text: f.int(p[`${d}_nb`]) }))));
  };
  draw();
  body.replaceChildren(h('p', { class: 'hint', text: 'Each row opens that cell. Switch the depth class in the layer panel to list deeper cells.' }), sel, table);
}
