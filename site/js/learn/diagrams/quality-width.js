// How the number of events sets the width of the 95 % interval, and how the width sets the quality code.
// The slider uses the textbook approximation width ≈ 2 × 1.96 × b / √n (Aki 1965); the atlas itself uses the
// bootstrap, so the real cells (dots, from cells.geojson) are placed by their measured width.

import { figure, frame, slider, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const { wA, wB, nMin, b } = ex;
  const st = { n: 200 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const code = (n, w) => (n < nMin ? 'insufficient' : w <= wA ? 'A' : w <= wB ? 'B' : 'C');
  const width = (n) => (2 * 1.96 * b) / Math.sqrt(n);
  const draw = (W) => {
    const H = 210;
    const xmax = Math.max(1.0, wB * 2);
    const F = frame({ W, H, m: { t: 30, b: 40, l: 16, r: 16 }, x: { domain: [0, xmax], label: dg.xLabel }, y: { domain: [0, 4], hide: true }, alt: dg.alt });
    const zones = [[0, wA, 'A', 'var(--v-ok-bg)'], [wA, wB, 'B', 'var(--v-close-bg)'], [wB, xmax, 'C', 'var(--v-bad-bg)']];
    for (const [a, z, name, c] of zones) {
      svgEl('rect', { x: F.xs(a), y: F.m.t, width: F.xs(z) - F.xs(a), height: H - F.m.t - F.m.b, style: `fill:${c}` }, F.plot);
      label(F.top, (F.xs(a) + F.xs(z)) / 2, F.m.t - 8, tpl(dg.zone, { q: name }), 'lbl strong', 'middle');
    }
    for (const w of [wA, wB]) {
      svgEl('line', { x1: F.xs(w), x2: F.xs(w), y1: F.m.t, y2: H - F.m.b, class: 'rule' }, F.top);
    }
    // real example cells
    const exs = [['A', ex.examples.A], ['B', ex.examples.B], ['C', ex.examples.C], ['insufficient', ex.examples.I]].filter(([, p]) => p && p.sh_ciw != null);
    exs.forEach(([q, p], i) => {
      const y = F.ys(3.2 - i * 0.62);
      const x = F.xs(Math.min(p.sh_ciw, xmax));
      svgEl('circle', { cx: x, cy: y, r: 5, class: q === 'insufficient' ? 'dot hollow' : 'dot', style: '--c:var(--ink-2)' }, F.top);
      label(F.top, x + 9, y + 4, tpl(dg.cellLabel, { q: q === 'insufficient' ? dg.insufficient : q, nb: f.int(p.sh_nb) }), 'lbl');
    });
    const w = width(st.n);
    const xw = F.xs(Math.min(w, xmax));
    svgEl('line', { x1: xw, x2: xw, y1: F.m.t, y2: H - F.m.b, class: 'accent-line' }, F.top);
    svgEl('path', { d: `M${xw - 6},${H - F.m.b + 2}L${xw + 6},${H - F.m.b + 2}L${xw},${H - F.m.b - 8}Z`, style: 'fill:var(--accent)' }, F.top);
    return F.svg;
  };
  const update = () => {
    const w = width(st.n);
    const q = code(st.n, w);
    fig.say(tpl(dg.readout, { n: f.int(st.n), w: f.b2(w), lo: f.b2(b - w / 2), hi: f.b2(b + w / 2), b: f.b2(b), q: q === 'insufficient' ? dg.insufficient : q }));
    fig.fig.dataset.q = q;
    fig.redraw();
  };
  // a logarithmic slider: position 0..100 maps to n = 10..3000
  const toN = (p) => Math.round(10 * 300 ** (p / 100));
  const s = slider({ label: dg.slider, min: 0, max: 100, step: 1, value: Math.round((100 * Math.log(st.n / 10)) / Math.log(300)), fmt: (p) => f.int(toN(p)), name: 'n', onInput: (p) => { st.n = toN(p); update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
