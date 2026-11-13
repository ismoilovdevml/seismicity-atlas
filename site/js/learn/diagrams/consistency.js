// How ComCat and ISC-GEM magnitudes differ cell by cell (cells.geojson, cells with at least 10 matched pairs):
// the median ComCat Mw-type minus ISC-GEM Mw, or the median ComCat mb minus ISC-GEM Mw.

import { figure, frame, toggle, svgEl, label, median, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const st = { k: 'dmb' };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const lo = -1.0, hi = 0.6, bw = 0.05;
  const draw = (W) => {
    const H = 250;
    const vals = ex[st.k];
    const bins = new Array(Math.round((hi - lo) / bw)).fill(0);
    for (const v of vals) { const i = Math.floor((Math.max(lo, Math.min(hi - 1e-9, v)) - lo) / bw); bins[i]++; }
    const F = frame({ W, H, x: { domain: [lo, hi], label: dg.xLabel }, y: { domain: [0, Math.max(...bins) * 1.12], label: dg.yLabel }, alt: dg.alt });
    if (st.k === 'dmw') svgEl('rect', { x: F.xs(-0.1), y: F.m.t, width: F.xs(0.1) - F.xs(-0.1), height: F.ys(0) - F.m.t, class: 'band-rect' }, F.plot);
    bins.forEach((n, i) => { if (n) svgEl('rect', { x: F.xs(lo + i * bw) + 0.5, y: F.ys(n), width: Math.max(1, F.xs(bw) - F.xs(0) - 1), height: F.ys(0) - F.ys(n), class: 'bar', style: `--c:${st.k === 'dmb' ? 'var(--s2)' : 'var(--s1)'}`, rx: 1 }, F.plot); });
    svgEl('line', { x1: F.xs(0), x2: F.xs(0), y1: F.m.t, y2: F.ys(0), class: 'rule' }, F.top);
    const mine = ex.mine[st.k];
    if (mine != null) {
      svgEl('line', { x1: F.xs(mine), x2: F.xs(mine), y1: F.m.t, y2: F.ys(0), class: 'rule dashed' }, F.top);
      label(F.top, F.xs(mine) + 5, F.m.t + 12, dg.mine, 'lbl strong');
    }
    return F.svg;
  };
  const update = () => {
    const vals = ex[st.k];
    fig.say(tpl(dg[`read_${st.k}`], { med: f.signed(median(vals), 2), n: f.int(vals.length), out: f.int(vals.filter((v) => Math.abs(v) > 0.1).length) }));
    fig.redraw();
  };
  const tg = toggle({ label: dg.which, name: 'which', value: st.k, options: [{ id: 'dmb', label: dg.dmb }, { id: 'dmw', label: dg.dmw }], onChange: (v) => { st.k = v; update(); } });
  fig.controls.append(tg.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
