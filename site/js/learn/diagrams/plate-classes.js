// b with its 95 % interval per PB2002 boundary class (global.json, plate_boundary_types). A row is chosen with the
// slider or by clicking it; the readout explains that class.

import { figure, frame, slider, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const rows = [...ex.rows].sort((a, b) => b.b - a.b);
  const st = { i: 0 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  let s = null;
  const draw = (W) => {
    const rowH = 30, H = rows.length * rowH + 52;
    const lw = Math.min(64, W * 0.2);
    const lo = Math.min(0.85, ...rows.map((r) => r.lo)) - 0.03, hi = Math.max(...rows.map((r) => r.hi)) + 0.03;
    const F = frame({ W, H, m: { l: lw, t: 8, b: 38 }, x: { domain: [lo, hi], label: 'b' }, y: { domain: [0, rows.length], hide: true }, alt: dg.alt });
    svgEl('line', { x1: F.xs(1), x2: F.xs(1), y1: F.m.t, y2: H - F.m.b, class: 'rule' }, F.plot);
    rows.forEach((r, i) => {
      const y = F.m.t + i * rowH + rowH / 2;
      const on = i === st.i;
      const c = on ? 'var(--s2)' : 'var(--s1)';
      const hit = svgEl('rect', { x: 0, y: y - rowH / 2, width: W, height: rowH, class: 'hit', style: 'cursor:pointer' }, F.top);
      hit.addEventListener('click', () => { st.i = i; if (s) s.set(i); update(); });
      if (on) svgEl('rect', { x: 0, y: y - rowH / 2 + 2, width: W, height: rowH - 4, class: 'span' }, F.plot);
      label(F.top, 4, y + 4, r.k, on ? 'lbl strong mono' : 'lbl mono');
      svgEl('line', { x1: F.xs(r.lo), x2: F.xs(r.hi), y1: y, y2: y, class: 'ci', style: `--c:${c}` }, F.top);
      svgEl('circle', { cx: F.xs(r.b), cy: y, r: 5, class: 'dot', style: `--c:${c}` }, F.top);
    });
    return F.svg;
  };
  const update = () => {
    const r = rows[st.i];
    fig.say(tpl(dg.readout, { code: r.k, name: f.pbName(r.k), b: f.interval(r.b, r.lo, r.hi, f.b3), n: f.int(r.n), what: (dg.classes || {})[r.k] || '' }));
    fig.redraw();
  };
  s = slider({ label: dg.slider, min: 0, max: rows.length - 1, step: 1, value: 0, fmt: (i) => rows[i].k, name: 'class', onInput: (v) => { st.i = v; update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  fig.table([dg.colClass, 'b [95 %]', dg.colN], rows.map((r) => [`${r.k} (${f.pbName(r.k)})`, f.interval(r.b, r.lo, r.hi, f.b3), f.int(r.n)]));
  return () => fig.destroy();
}
