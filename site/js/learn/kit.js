// Small kit for the Learn diagrams: a measured SVG frame with axes, controls (sliders, segmented toggles, a play
// button), a live text readout, seeded random numbers and the estimators the diagrams recompute in the browser.
// Diagrams redraw the whole SVG from their state; they are small, so this stays cheap and keeps the code plain.

import { svgEl, h, niceTicks } from '../charts.js';
import { t } from '../i18n/index.js';

export { svgEl, h };

export const prefersReduced = () => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

/** Deterministic random numbers (mulberry32), so a "random" illustration is the same on every visit. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function scale([d0, d1], [r0, r1], log = false) {
  if (log) {
    const l0 = Math.log10(d0), l1 = Math.log10(d1);
    return (v) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
  }
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

const logTicks = (d0, d1) => {
  const out = [];
  for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) {
    const v = 10 ** e;
    if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v);
  }
  return out;
};
export const logFmt = (v) => (v >= 1000 ? `${v / 1000}K` : v >= 1 ? String(v) : String(+v.toPrecision(1)));

/**
 * An SVG plot frame sized to the container width.
 * spec: { W, H, m, x: {domain, log, label, ticks, fmt}, y: {...}, alt }
 * Returns { svg, xs, ys, plot (clipped group), top (unclipped group), m, W, H }.
 */
export function frame(spec) {
  const W = spec.W, H = spec.H;
  const m = { t: 12, r: 14, b: 38, l: 48, ...(spec.m || {}) };
  const xs = scale(spec.x.domain, [m.l, W - m.r], spec.x.log);
  const ys = scale(spec.y.domain, [H - m.b, m.t], spec.y.log);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': spec.alt || '', class: 'chart-svg lr-svg' });
  const cid = `lc${Math.random().toString(36).slice(2, 8)}`;
  const cp = svgEl('clipPath', { id: cid }, svgEl('defs', {}, svg));
  svgEl('rect', { x: m.l, y: m.t - 4, width: W - m.l - m.r, height: H - m.t - m.b + 4 }, cp);
  if (!spec.y.hide) {
    const yt = spec.y.ticks || (spec.y.log ? logTicks(...spec.y.domain) : niceTicks(...spec.y.domain, 4));
    const yf = spec.y.fmt || (spec.y.log ? logFmt : String);
    for (const v of yt) {
      const y = ys(v);
      if (y < m.t - 1 || y > H - m.b + 1) continue;
      svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }, svg);
      svgEl('text', { x: m.l - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }, svg).textContent = yf(v);
    }
    if (spec.y.label) {
      svgEl('text', { x: 12, y: (m.t + H - m.b) / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, svg).textContent = spec.y.label;
    }
  }
  const nx = Math.max(2, Math.floor((W - m.l - m.r) / 64));
  const xt = spec.x.ticks || (spec.x.log ? logTicks(...spec.x.domain) : niceTicks(...spec.x.domain, nx));
  const xf = spec.x.fmt || (spec.x.log ? logFmt : String);
  for (const v of xt) {
    const x = xs(v);
    if (x < m.l - 1 || x > W - m.r + 1) continue;
    svgEl('text', { x, y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = xf(v);
  }
  svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }, svg);
  if (spec.x.label) svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 4, class: 'axis-label', 'text-anchor': 'middle' }, svg).textContent = spec.x.label;
  const plot = svgEl('g', { 'clip-path': `url(#${cid})` }, svg);
  const top = svgEl('g', {}, svg);
  return { svg, xs, ys, plot, top, m, W, H };
}

export const path = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');

/**
 * The figure shell every diagram uses: title, the plot area (measured), a controls row, a live readout, an optional
 * text alternative and an optional data table. draw(W) must return an SVG element; it is called on every resize.
 */
export function figure(el, { title, caption, alt }) {
  const plotEl = h('div', { class: 'lr-plot' });
  const controls = h('div', { class: 'lr-controls' });
  const readout = h('p', { class: 'lr-readout', 'aria-live': 'polite' });
  const fig = h('figure', { class: 'lr-fig' },
    title ? h('figcaption', { class: 'lr-fig-title', text: title }) : null,
    plotEl, controls, readout,
    caption ? h('p', { class: 'lr-fig-caption', text: caption }) : null,
    alt ? h('p', { class: 'sr-only', text: alt }) : null);
  el.append(fig);
  let drawFn = null;
  let lastW = 0;
  const redraw = () => {
    if (!drawFn) return;
    const W = Math.max(280, Math.round(plotEl.clientWidth || 600));
    lastW = W;
    const svg = drawFn(W);
    if (svg) plotEl.replaceChildren(svg);
  };
  let ro = null, seen = false;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      // removed from the page (re-rendered or left): stop observing so the figure can be collected
      if (plotEl.isConnected) seen = true;
      else if (seen) { ro.disconnect(); return; }
      const W = Math.round(plotEl.clientWidth || 0);
      if (W && Math.abs(W - lastW) > 4) requestAnimationFrame(redraw);
    });
    ro.observe(plotEl);
  }
  return {
    fig, plotEl, controls, readout,
    setDraw(fn) { drawFn = fn; redraw(); },
    redraw,
    say(text) { readout.textContent = text; },
    table(columns, rows, label) {
      const old = fig.querySelector('details.lr-table');
      if (old) old.remove();
      const tb = h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', { text: c ?? '–' }))))));
      fig.append(h('details', { class: 'chart-table lr-table' }, h('summary', { text: label || t('chart.table') }), tb));
    },
    destroy() { if (ro) ro.disconnect(); },
  };
}

let sid = 0;
/** A labelled range input with its value shown next to it. */
export function slider({ label, min, max, step, value, fmt = String, onInput, name }) {
  const id = `lr-s${++sid}`;
  const input = h('input', { type: 'range', id, min, max, step, value, 'data-ctl': name || '' });
  const out = h('output', { for: id, class: 'mono', text: fmt(+value) });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); input.setAttribute('aria-valuetext', fmt(+input.value)); onInput(+input.value); });
  input.setAttribute('aria-valuetext', fmt(+value));
  const el = h('div', { class: 'lr-slider' }, h('label', { for: id, text: label }), input, out);
  return { el, input, set(v) { input.value = v; out.textContent = fmt(+v); input.setAttribute('aria-valuetext', fmt(+v)); } };
}

/** Segmented buttons (aria-pressed); options: [{id, label}]. */
export function toggle({ label, options, value, onChange, name }) {
  const btns = options.map((o) => h('button', { type: 'button', class: 'lr-seg-btn', 'aria-pressed': String(o.id === value), 'data-ctl': `${name || 'seg'}-${o.id}`, text: o.label }));
  const el = h('div', { class: 'lr-seg', role: 'group', 'aria-label': label }, h('span', { class: 'lr-seg-label', 'aria-hidden': 'true', text: label }), ...btns);
  btns.forEach((b, i) => b.addEventListener('click', () => {
    btns.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
    onChange(options[i].id);
  }));
  return { el, set(id) { btns.forEach((x, j) => x.setAttribute('aria-pressed', String(options[j].id === id))); } };
}

export function button(label, onClick, name) {
  return h('button', { type: 'button', class: 'small-btn lr-btn', 'data-ctl': name || '', onclick: onClick, text: label });
}

/**
 * An animation driver with play/pause and reset. Under prefers-reduced-motion nothing starts on its own: the
 * diagram shows its final frame and the play button is there for whoever wants the motion.
 * step(i) draws frame i (0..frames); returns false to stop early.
 */
export function animator({ frames, interval = 60, step, onState }) {
  let i = 0, timer = null;
  const playLabel = t('learn.dg.play'), pauseLabel = t('learn.dg.pause');
  const btn = h('button', { type: 'button', class: 'small-btn lr-btn lr-play', 'data-ctl': 'play', 'aria-pressed': 'false', text: playLabel });
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    btn.textContent = playLabel;
    btn.setAttribute('aria-pressed', 'false');
    if (onState) onState('stopped');
  };
  const play = () => {
    if (timer) return;
    if (i >= frames) i = 0;
    btn.textContent = pauseLabel;
    btn.setAttribute('aria-pressed', 'true');
    if (onState) onState('playing');
    timer = setInterval(() => {
      i++;
      if (step(i) === false || i >= frames) { i = frames; stop(); }
    }, interval);
  };
  btn.addEventListener('click', () => (timer ? stop() : play()));
  return {
    btn, play, stop,
    get playing() { return !!timer; },
    get frame() { return i; },
    jump(k) { stop(); i = Math.max(0, Math.min(frames, k)); step(i); },
    /** Autoplay unless reduced motion is preferred; then jump to the final frame. */
    start() { if (prefersReduced()) { i = frames; step(i); } else { i = 0; step(0); play(); } },
  };
}

// ---------------------------------------------------------------- estimators (same formulas as scripts/seislib.py)

/** Aki-Utsu maximum-likelihood b for binned magnitudes: pairs [[m, n], ...], threshold mc, bin width dm. */
export function akiB(pairs, mc, dm = 0.1) {
  let n = 0, s = 0;
  for (const [m, c] of pairs) if (m >= mc - 1e-9) { n += c; s += c * m; }
  if (n < 2) return { b: null, n };
  const mean = s / n;
  const b = Math.log10(Math.E) / (mean - (mc - dm / 2));
  return { b, n };
}

/** Aki-Utsu b on a plain list of magnitudes (binned to dm) above mc. */
export function akiList(mags, mc, dm = 0.1) {
  let n = 0, s = 0;
  for (const m of mags) if (m >= mc - 1e-9) { n++; s += m; }
  if (n < 2) return null;
  return Math.log10(Math.E) / (s / n - (mc - dm / 2));
}

/** b-positive (van der Elst 2021): positive successive differences of at least dmin, in time order. */
export function bPositive(mags, dmin = 0.2) {
  let n = 0, s = 0;
  for (let i = 1; i < mags.length; i++) {
    const d = mags[i] - mags[i - 1];
    if (d >= dmin - 1e-9) { n++; s += d; }
  }
  if (n < 2) return null;
  return Math.log10(Math.E) / (s / n - (dmin - 0.05));
}

/** Gutenberg-Richter magnitudes above m0 with a given b, binned to 0.1. */
export function grSample(rand, n, b, m0) {
  const beta = b * Math.LN10;
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.round((m0 - 0.05 - Math.log(1 - rand()) / beta) * 10) / 10);
  return out;
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (arr) => quantile([...arr].sort((a, b) => a - b), 0.5);

/** Cumulative counts N(>= m) from non-cumulative [[m, n]] pairs (sorted by m): the site-wide helper in util.js. */
export { cumulativeFmd as cumulative } from '../util.js';

/** MAXC: the bin with the most events (the first one on ties). */
export function maxc(pairs) {
  let best = null;
  for (const [m, n] of pairs) if (!best || n > best[1]) best = [m, n];
  return best ? best[0] : null;
}

/** Plain-text template: tpl('b = {b}', {b: '1.00'}). Used with textContent only. */
export const tpl = (s, v = {}) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? v[k] : m));

/** A legend list; items: [{label, color, line, dot}] */
export function legend(items) {
  return h('ul', { class: 'lr-legend' }, items.map((it) => h('li', {}, h('span', { class: it.line ? 'sw line' : it.dot ? 'sw dot' : 'sw', style: `--c:${it.color}` }), it.label)));
}

/** Text label in an SVG. */
export function label(parent, x, y, text, cls = 'lbl', anchor = 'start') {
  const e = svgEl('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
  e.textContent = text;
  return e;
}
