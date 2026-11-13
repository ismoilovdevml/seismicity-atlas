// Small hand-written SVG chart kit. Colours are CSS custom properties, so charts follow the theme without
// re-rendering. Every chart has a hover/keyboard readout and a data table.

import { t as tr } from './i18n/index.js';

const NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}

function scale(type, [d0, d1], [r0, r1]) {
  if (type === 'log') {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    const f = (v) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
    f.inv = (p) => 10 ** (l0 + ((p - r0) / (r1 - r0)) * (l1 - l0));
    return f;
  }
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}

export function niceTicks(d0, d1, count = 5) {
  const step0 = (d1 - d0) / count;
  const m = 10 ** Math.floor(Math.log10(step0));
  const e = step0 / m;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * m;
  const t = [];
  for (let v = Math.ceil(d0 / step - 1e-9) * step; v <= d1 + 1e-9; v += step) t.push(+v.toFixed(10));
  return t;
}

function logTicks(d0, d1) {
  const t = [];
  for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) {
    const v = 10 ** e;
    if (v >= d0 * 0.999 && v <= d1 * 1.001) t.push(v);
  }
  return t;
}

const logFmt = (v) => (v >= 1000 ? `${v / 1000}K`.replace('.0K', 'K') : v >= 1 ? String(v) : String(+v.toPrecision(1)));

/** Pad a numeric domain a little and keep it valid. */
export function padDomain(lo, hi, pad = 0.05, type = 'lin') {
  if (type === 'log') return [lo / 10 ** pad, hi * 10 ** pad];
  if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

function tableEl(table) {
  const t = h('table', { class: 'data' });
  t.append(h('thead', {}, h('tr', {}, table.columns.map((c) => h('th', { scope: 'col', text: c })))));
  const tb = h('tbody');
  for (const r of table.rows) tb.append(h('tr', {}, r.map((c) => h('td', { text: c ?? '–' }))));
  t.append(tb);
  return t;
}

function legendRow(series) {
  const shown = series.filter((s) => s.name && !s.noLegend);
  if (shown.length < 2) return null;
  return h('ul', { class: 'chart-legend', 'aria-label': tr('chart.legend') },
    shown.map((s) => h('li', {},
      h('span', { class: `key key-${s.key || (s.type === 'dots' ? 'dot' : 'line')}`, style: `--c:${s.color}` }),
      s.name)));
}

/**
 * Responsive figure with caption, legend, svg, tooltip and a <details> data table.
 * draw(wrap, width, tip) must append an svg and return a hover controller {xs:[...], show(i)} or null.
 */
function figure({ title, sub, alt, series = [], table, note, draw }) {
  const fig = h('figure', { class: 'chart' });
  if (title) fig.append(h('figcaption', {}, h('span', { class: 'chart-title', text: title }), sub ? h('span', { class: 'chart-sub', text: sub }) : null));
  const lg = legendRow(series);
  if (lg) fig.append(lg);
  const wrap = h('div', { class: 'chart-wrap', tabindex: '0', role: 'group', 'aria-label': tr('chart.aria', { alt }) });
  const tip = h('div', { class: 'chart-tip', 'aria-live': 'polite' });
  tip.hidden = true;
  fig.append(wrap);
  if (note) fig.append(h('p', { class: 'chart-note', text: note }));
  if (table && table.rows.length) {
    const det = h('details', { class: 'chart-table' }, h('summary', { text: tr('chart.table') }));
    det.addEventListener('toggle', () => { if (det.open && det.children.length === 1) det.append(tableEl(table)); }, { once: false });
    fig.append(det);
  }
  let lastW = 0, ctl = null, idx = -1;
  const render = () => {
    const w = Math.round(wrap.clientWidth);
    if (!w || Math.abs(w - lastW) < 4) return;
    lastW = w;
    wrap.replaceChildren();
    ctl = draw(wrap, w, tip);
    wrap.append(tip);
    idx = -1;
  };
  const ro = new ResizeObserver(render);
  ro.observe(wrap);
  requestAnimationFrame(render);
  wrap.addEventListener('keydown', (e) => {
    if (!ctl || !ctl.xs.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      idx = idx < 0 ? 0 : Math.max(0, Math.min(ctl.xs.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)));
      ctl.show(idx);
    } else if (e.key === 'Escape' && idx >= 0) { e.stopPropagation(); ctl.hide(); idx = -1; }
  });
  wrap.addEventListener('blur', () => ctl && ctl.hide());
  return fig;
}

function placeTip(tip, wrap, px, py) {
  tip.hidden = false;
  const tw = tip.offsetWidth, W = wrap.clientWidth;
  let left = px + 12;
  if (left + tw > W) left = Math.max(0, px - tw - 12);
  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(0, py)}px`;
}

function fillTip(tip, title, rows) {
  tip.replaceChildren(h('div', { class: 'tip-title', text: title }),
    ...rows.map((r) => h('div', { class: 'tip-row' },
      r.color ? h('span', { class: 'key key-line', style: `--c:${r.color}` }) : null,
      h('strong', { text: r.value }), h('span', { text: r.name || '' }))));
}

/**
 * XY chart.
 * spec: {title, sub, alt, height, margin, x:{type,domain,ticks,fmt,label}, y:{...},
 *        series:[{key,name,color,type:'line'|'dots'|'segments'|'area', points:[[x,y]] | segs:[[x0,x1,y]] | band:[[x,lo,hi]], fmt}],
 *        xSpans:[{from,to,label}], xRules:[{value,label}], yRules:[{value,label}], hoverTitle:(x)=>str, table, note}
 */
export function xyChart(spec) {
  const series = spec.series.filter((s) => (s.points && s.points.length) || (s.segs && s.segs.length) || (s.band && s.band.length));
  return figure({
    ...spec, series,
    draw(wrap, W, tip) {
      const H = spec.height || 180;
      const m = { t: 10, r: 14, b: 36, l: 46, ...(spec.margin || {}) };
      const xs = scale(spec.x.type || 'lin', spec.x.domain, [m.l, W - m.r]);
      const ys = scale(spec.y.type || 'lin', spec.y.domain, [H - m.b, m.t]);
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.alt, class: 'chart-svg' });
      const cid = `c${Math.random().toString(36).slice(2, 8)}`;
      const defs = svgEl('defs', {}, svg);
      const cp = svgEl('clipPath', { id: cid }, defs);
      svgEl('rect', { x: m.l, y: m.t - 6, width: W - m.l - m.r, height: H - m.t - m.b + 6 }, cp);

      const yt = spec.y.ticks || (spec.y.type === 'log' ? logTicks(...spec.y.domain) : niceTicks(...spec.y.domain, 4));
      const yf = spec.y.fmt || (spec.y.type === 'log' ? logFmt : (v) => String(v));
      for (const v of yt) {
        const y = ys(v);
        if (y < m.t - 1 || y > H - m.b + 1) continue;
        svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }, svg);
        svgEl('text', { x: m.l - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = yf(v);
      }
      const nx = Math.max(2, Math.floor((W - m.l - m.r) / 64));
      const xt = spec.x.ticks || (spec.x.type === 'log' ? logTicks(...spec.x.domain) : niceTicks(...spec.x.domain, nx));
      const xf = spec.x.fmt || (spec.x.type === 'log' ? logFmt : (v) => String(v));
      for (const v of xt) {
        const x = xs(v);
        if (x < m.l - 1 || x > W - m.r + 1) continue;
        svgEl('text', { x, y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = xf(v);
      }
      svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }, svg);
      if (spec.x.label) svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 4, class: 'axis-label', 'text-anchor': 'middle' }, svg).textContent = spec.x.label;

      const plot = svgEl('g', { 'clip-path': `url(#${cid})` }, svg);
      for (const s of spec.xSpans || []) {
        const x0 = xs(s.from), x1 = xs(s.to);
        svgEl('rect', { x: Math.min(x0, x1), y: m.t, width: Math.max(2, Math.abs(x1 - x0)), height: H - m.t - m.b, class: 'span' }, plot);
      }
      for (const r of spec.yRules || []) {
        const y = ys(r.value);
        svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'rule' }, plot);
        if (r.label) svgEl('text', { x: W - m.r - 2, y: y - 4, class: 'rule-label', 'text-anchor': 'end' }, svg).textContent = r.label;
      }
      for (const r of spec.xRules || []) {
        const x = xs(r.value);
        svgEl('line', { x1: x, x2: x, y1: m.t, y2: H - m.b, class: r.dashed ? 'rule dashed' : 'rule' }, plot);
        if (r.label) {
          const right = x < (m.l + W - m.r) / 2;
          svgEl('text', { x: x + (right ? 4 : -4), y: m.t + 10, class: 'rule-label', 'text-anchor': right ? 'start' : 'end' }, svg).textContent = r.label;
        }
      }
      for (const s of series) {
        const st = `--c:${s.color}`;
        if (s.band) {
          const top = s.band.map(([x, , hi]) => `${xs(x)},${ys(hi)}`);
          const bot = s.band.slice().reverse().map(([x, lo]) => `${xs(x)},${ys(lo)}`);
          svgEl('path', { d: `M${top.join('L')}L${bot.join('L')}Z`, class: 'band', style: st }, plot);
        }
        if (s.type === 'line' || s.type === 'linedots') {
          // break the line where points are null
          let d = '', pen = false;
          for (const [x, y] of s.points) {
            if (y === null || !(spec.y.type !== 'log' || y > 0)) { pen = false; continue; }
            d += `${pen ? 'L' : 'M'}${xs(x).toFixed(1)},${ys(y).toFixed(1)}`;
            pen = true;
          }
          svgEl('path', { d, class: 'line', style: st }, plot);
        }
        if (s.type === 'segments') {
          for (const [x0, x1, y] of s.segs) {
            if (y === null) continue;
            svgEl('line', { x1: xs(x0) + 1.5, x2: xs(x1) - 1.5, y1: ys(y), y2: ys(y), class: 'seg', style: st }, plot);
          }
        }
        if (s.type === 'dots' || s.type === 'linedots') {
          for (const [x, y] of s.points) {
            if (y === null || (spec.y.type === 'log' && y <= 0)) continue;
            svgEl('circle', { cx: xs(x), cy: ys(y), r: s.r || 4, class: s.hollow ? 'dot hollow' : 'dot', style: st }, plot);
          }
        }
      }

      // hover layer: snap to the nearest x among all series
      const xsAll = [...new Set(series.flatMap((s) => (s.points || []).map((p) => p[0])
        .concat((s.segs || []).map((g) => (g[0] + g[1]) / 2))
        .concat((s.band || []).map((b) => b[0]))))].sort((a, b) => a - b);
      const cross = svgEl('line', { y1: m.t, y2: H - m.b, class: 'crosshair', visibility: 'hidden' }, svg);
      const hl = svgEl('g', {}, svg);
      const valueAt = (s, xv) => {
        if (s.segs) { const g = s.segs.find((q) => xv >= q[0] && xv <= q[1]); return g ? g[2] : undefined; }
        if (s.points) { const p = s.points.find((q) => q[0] === xv); if (p) return p[1]; }
        if (s.band) { const p = s.band.find((q) => q[0] === xv); if (p) return [p[1], p[2]]; }
        return undefined;
      };
      const show = (i) => {
        const xv = xsAll[i];
        const px = xs(xv);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
        hl.replaceChildren();
        const rows = [];
        let ty = H;
        for (const s of series) {
          const v = valueAt(s, xv);
          if (v === undefined) continue;
          rows.push({ name: s.name, color: s.color, value: s.fmt ? s.fmt(v, xv) : String(v) });
          if (typeof v === 'number' && (spec.y.type !== 'log' || v > 0)) {
            const py = ys(v);
            ty = Math.min(ty, py);
            svgEl('circle', { cx: px, cy: py, r: 5, class: 'dot focus', style: `--c:${s.color}` }, hl);
          }
        }
        fillTip(tip, spec.hoverTitle ? spec.hoverTitle(xv) : String(xv), rows.length ? rows : [{ value: 'no value', name: '' }]);
        placeTip(tip, wrap, px, Math.min(ty, H - 60) - 10);
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); hl.replaceChildren(); tip.hidden = true; };
      const hit = svgEl('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H - m.b, class: 'hit' }, svg);
      hit.addEventListener('pointermove', (e) => {
        if (!xsAll.length) return;
        const r = svg.getBoundingClientRect();
        const xv = xs.inv(e.clientX - r.left);
        let best = 0;
        for (let i = 1; i < xsAll.length; i++) if (Math.abs(xsAll[i] - xv) < Math.abs(xsAll[best] - xv)) best = i;
        show(best);
      });
      hit.addEventListener('pointerleave', hide);
      wrap.append(svg);
      return { xs: xsAll, show, hide };
    },
  });
}

/**
 * Interval (forest) plot: one row per estimate, dot + 95 % interval.
 * spec: {title, sub, alt, rows:[{label, v, lo, hi, color, hollow, text}], domain, ref:{value,label,lo,hi}, table, note, labelWidth}
 */
export function forestChart(spec) {
  return figure({
    ...spec, series: spec.legend || [],
    draw(wrap, W, tip) {
      const rowH = 28, lw = Math.min(spec.labelWidth || 150, W * 0.42), vw = W < 380 ? 0 : 120;
      const m = { t: 8, r: vw + 8, b: 30, l: lw };
      const H = m.t + m.b + spec.rows.length * rowH;
      const xs = scale('lin', spec.domain, [m.l, W - m.r]);
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.alt, class: 'chart-svg' });
      const ft = niceTicks(...spec.domain, Math.max(2, Math.floor((W - m.l - m.r) / 80)));
      const dec = ft.length > 1 && ft[1] - ft[0] < 0.1 - 1e-9 ? 2 : 1;
      for (const v of ft) {
        const x = xs(v);
        svgEl('line', { x1: x, x2: x, y1: m.t, y2: H - m.b, class: 'grid' }, svg);
        svgEl('text', { x, y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = v.toFixed(dec);
      }
      if (spec.x && spec.x.label) svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 2, class: 'axis-label', 'text-anchor': 'middle' }, svg).textContent = spec.x.label;
      if (spec.ref) {
        if (spec.ref.lo !== undefined) svgEl('rect', { x: xs(spec.ref.lo), width: Math.max(1, xs(spec.ref.hi) - xs(spec.ref.lo)), y: m.t, height: H - m.t - m.b, class: 'span' }, svg);
        svgEl('line', { x1: xs(spec.ref.value), x2: xs(spec.ref.value), y1: m.t, y2: H - m.b, class: 'rule' }, svg);
        if (spec.ref.label) svgEl('text', { x: xs(spec.ref.value) + 4, y: H - m.b - 4, class: 'rule-label' }, svg).textContent = spec.ref.label;
      }
      const marks = [];
      spec.rows.forEach((r, i) => {
        const cy = m.t + i * rowH + rowH / 2;
        const lab = svgEl('text', { x: 0, y: cy + 4, class: r.emph ? 'row-label emph' : 'row-label' }, svg);
        lab.textContent = r.label;
        if (r.v === null || r.v === undefined) {
          svgEl('text', { x: m.l + 4, y: cy + 4, class: 'tick', 'text-anchor': 'start' }, svg).textContent = r.text || tr('chart.na');
          return;
        }
        const st = `--c:${r.color || 'var(--s1)'}`;
        if (r.lo !== undefined && r.lo !== null) svgEl('line', { x1: xs(r.lo), x2: xs(r.hi), y1: cy, y2: cy, class: 'ci', style: st }, svg);
        svgEl('circle', { cx: xs(r.v), cy, r: 5, class: r.hollow ? 'dot hollow' : 'dot', style: st }, svg);
        for (const extra of r.marks || []) svgEl('circle', { cx: xs(extra.v), cy, r: 5, class: extra.hollow ? 'dot hollow' : 'dot', style: `--c:${extra.color}` }, svg);
        if (vw) svgEl('text', { x: W - 4, y: cy + 4, class: 'row-value', 'text-anchor': 'end' }, svg).textContent = r.text || '';
        marks.push({ cy, r });
      });
      const show = (i) => {
        const { cy, r } = marks[i];
        fillTip(tip, r.label, [{ value: r.text || String(r.v), name: r.tipName || '' }]);
        placeTip(tip, wrap, xs(r.v), cy + 10);
      };
      const hide = () => { tip.hidden = true; };
      marks.forEach((mk, i) => {
        const hit = svgEl('rect', { x: 0, y: mk.cy - rowH / 2, width: W, height: rowH, class: 'hit' }, svg);
        hit.addEventListener('pointerenter', () => show(i));
        hit.addEventListener('pointerleave', hide);
      });
      wrap.append(svg);
      return { xs: marks, show, hide };
    },
  });
}

/** Column sparkline. spec: {title, sub, alt, x0 (first year), values (null = no data), color, fmtTip, table} */
export function sparkColumns(spec) {
  return figure({
    ...spec, series: [],
    draw(wrap, W, tip) {
      const H = spec.height || 64;
      const m = { t: 6, r: 4, b: 18, l: 4 };
      const n = spec.values.length;
      const max = Math.max(1, ...spec.values.filter((v) => v !== null));
      const bw = (W - m.l - m.r) / n;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.alt, class: 'chart-svg' });
      svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }, svg);
      const bars = [];
      spec.values.forEach((v, i) => {
        const x = m.l + i * bw;
        if (v === null) {
          svgEl('line', { x1: x + 1, x2: x + bw - 1, y1: H - m.b - 0.5, y2: H - m.b - 0.5, class: 'nodata' }, svg);
        } else if (v > 0) {
          const hh = ((H - m.t - m.b) * v) / max;
          const w = Math.max(1, Math.min(24, bw - (bw > 4 ? 2 : 1)));
          svgEl('path', { d: roundTopRect(x + (bw - w) / 2, H - m.b - hh, w, hh, Math.min(2, w / 2)), class: 'col', style: `--c:${spec.color}` }, svg);
        }
        bars.push({ x: x + bw / 2, v, i });
      });
      const first = spec.x0, last = spec.x0 + n - 1;
      svgEl('text', { x: m.l, y: H - 4, class: 'tick', 'text-anchor': 'start' }, svg).textContent = String(first);
      svgEl('text', { x: W - m.r, y: H - 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = String(last);
      const cross = svgEl('rect', { y: m.t, height: H - m.t - m.b, width: bw, class: 'colhover', visibility: 'hidden' }, svg);
      const show = (i) => {
        const b = bars[i];
        cross.setAttribute('x', b.x - bw / 2); cross.setAttribute('visibility', 'visible');
        fillTip(tip, String(spec.x0 + i), [{ value: b.v === null ? 'no data' : String(b.v), name: spec.unit || '' }]);
        placeTip(tip, wrap, b.x, 0);
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
      const hit = svgEl('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, class: 'hit' }, svg);
      hit.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        show(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - m.l) / bw))));
      });
      hit.addEventListener('pointerleave', hide);
      wrap.append(svg);
      return { xs: bars, show, hide };
    },
  });
}

function roundTopRect(x, y, w, hh, r) {
  r = Math.min(r, hh);
  return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
}
