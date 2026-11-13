// A west-east cross-section through the Tonga subduction zone: real M >= 6 hypocentres (events_m6.json, 16-24° S)
// by distance and depth. The dipping band of deep events is the sinking slab. Events appear year by year.

import { figure, frame, slider, animator, svgEl, label, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const pts = ex.pts;
  const y0 = Math.floor(pts[0].y), y1 = Math.floor(pts[pts.length - 1].y);
  const st = { upto: y1 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgShallow, color: 'var(--s1)' }, { label: dg.lgDeep, color: 'var(--s2)' }]), fig.plotEl);
  const draw = (W) => {
    const H = Math.max(260, Math.min(380, W * 0.5));
    const xs0 = Math.min(...pts.map((p) => p.x)) - 30, xs1 = Math.max(...pts.map((p) => p.x)) + 30;
    const F = frame({ W, H, x: { domain: [xs0, xs1], label: dg.xLabel, fmt: (v) => String(Math.round(v)) }, y: { domain: [720, -10], label: dg.yLabel }, alt: dg.alt });
    svgEl('line', { x1: F.m.l, x2: W - F.m.r, y1: F.ys(70), y2: F.ys(70), class: 'rule dashed' }, F.plot);
    label(F.top, W - F.m.r - 4, F.ys(70) - 5, dg.split, 'lbl', 'end');
    for (const p of pts) {
      if (Math.floor(p.y) > st.upto) break;
      svgEl('circle', { cx: F.xs(p.x), cy: F.ys(p.z), r: 1.5 + (p.m - 6) * 1.8, class: 'ev', style: `--c:${p.z > 70 ? 'var(--s2)' : 'var(--s1)'};fill-opacity:0.75` }, F.plot);
    }
    label(F.top, F.xs(xs1) - 4, F.ys(0) + 16, dg.east, 'lbl', 'end');
    label(F.top, F.xs(xs0) + 4, F.ys(0) + 16, dg.west, 'lbl');
    return F.svg;
  };
  const update = () => {
    const vis = pts.filter((p) => Math.floor(p.y) <= st.upto);
    fig.say(tpl(dg.readout, { y: String(st.upto), n: f.int(vis.length), deep: f.int(vis.filter((p) => p.z > 70).length) }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: y0, max: y1, step: 1, value: y1, fmt: String, name: 'year', onInput: (v) => { anim.stop(); st.upto = v; update(); } });
  const anim = animator({ frames: y1 - y0, interval: 80, step: (i) => { st.upto = y0 + i; s.set(st.upto); update(); }, onState: (x) => { fig.fig.dataset.anim = x; } });
  fig.controls.append(anim.btn, s.el);
  fig.setDraw(draw);
  anim.start();
  return () => { anim.stop(); fig.destroy(); };
}
