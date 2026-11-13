// The spread of Mw >= 6 rates over all cells with at least one event (cells.geojson, rate_m6), on a log axis, with
// the example cell marked. The slider counts how many cells reach a chosen rate.

import { figure, frame, slider, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const L = ex.rates.map((r) => Math.log10(r));
  const lo = Math.floor(Math.min(...L) * 4) / 4, hi = Math.ceil(Math.max(...L) * 4) / 4;
  const bw = 0.125;
  const bins = new Array(Math.round((hi - lo) / bw)).fill(0);
  for (const v of L) bins[Math.min(bins.length - 1, Math.floor((v - lo) / bw))]++;
  const st = { thr: Math.log10(ex.mine) };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const H = 250;
    const F = frame({ W, H, x: { domain: [lo, hi], label: dg.xLabel, ticks: Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i), fmt: (v) => f.sig2(10 ** v) },
      y: { domain: [0, Math.max(...bins) * 1.12], label: dg.yLabel }, alt: dg.alt });
    bins.forEach((n, i) => {
      if (!n) return;
      const x0 = lo + i * bw;
      svgEl('rect', { x: F.xs(x0) + 0.5, y: F.ys(n), width: Math.max(1, F.xs(bw) - F.xs(0) - 1), height: F.ys(0) - F.ys(n), class: x0 + bw <= st.thr ? 'bar off' : 'bar', rx: 1 }, F.plot);
    });
    const xm = F.xs(Math.log10(ex.mine));
    svgEl('line', { x1: xm, x2: xm, y1: F.m.t, y2: F.ys(0), class: 'rule dashed' }, F.top);
    label(F.top, xm + 5, F.m.t + 12, dg.mine, 'lbl strong');
    return F.svg;
  };
  const update = () => {
    const n = ex.rates.filter((r) => r >= 10 ** st.thr - 1e-12).length;
    fig.say(tpl(dg.readout, { r: f.sig2(10 ** st.thr), n: f.int(n), all: f.int(ex.rates.length) }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: lo, max: hi, step: 0.05, value: st.thr, fmt: (v) => f.sig2(10 ** v), name: 'thr', onInput: (v) => { st.thr = v; update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
