// Mc slider on a real non-cumulative FMD: bins below the chosen Mc turn grey, and the single-threshold Aki-Utsu b
// is recomputed for the events that remain.

import { figure, frame, slider, button, svgEl, label, akiB, maxc, tpl } from '../kit.js';
import { t } from '../../i18n/index.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const fmd = ex.fmd.filter(([, n]) => n >= 0);
  const mx = maxc(fmd);
  const ms = fmd.map(([m]) => m);
  const st = { mc: ex.mc };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const H = 260;
    const ymax = Math.max(...fmd.map(([, n]) => n));
    const F = frame({ W, H, x: { domain: [ms[0] - 0.1, ms[ms.length - 1] + 0.1], label: t('learn.dg.magnitude') }, y: { domain: [0, ymax * 1.1], label: t('learn.dg.count') }, alt: dg.alt });
    const bw = Math.max(1, F.xs(0.1) - F.xs(0) - 1.5);
    for (const [m, n] of fmd) {
      if (!n) continue;
      const on = m >= st.mc - 1e-9;
      svgEl('rect', { x: F.xs(m) - bw / 2, y: F.ys(n), width: bw, height: F.ys(0) - F.ys(n), class: on ? 'bar' : 'bar off', rx: 1.5 }, F.plot);
    }
    const xm = F.xs(mx);
    label(F.top, xm, F.ys(fmd.find(([m]) => m === mx)[1]) - 6, dg.maxc, 'lbl strong', 'middle');
    const xc = F.xs(st.mc - 0.05);
    svgEl('line', { x1: xc, x2: xc, y1: F.m.t, y2: H - F.m.b, class: 'rule dashed' }, F.top);
    label(F.top, xc + 5, F.m.t + 12, `Mc ${f.mag(st.mc)}`, 'lbl strong');
    return F.svg;
  };
  const update = () => {
    const r = akiB(fmd, st.mc);
    fig.say(tpl(dg.readout, { mc: f.mag(st.mc), n: f.int(r.n), b: f.b2(r.b), atlas: f.b2(ex.b) }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: ms[0], max: ms[Math.max(0, ms.length - 8)], step: 0.1, value: st.mc, fmt: f.mag, name: 'mc', onInput: (v) => { st.mc = Math.round(v * 10) / 10; update(); } });
  fig.controls.append(s.el,
    button(tpl(dg.useMaxc, { m: f.mag(mx + 0.2) }), () => { st.mc = Math.round((mx + 0.2) * 10) / 10; s.set(st.mc); update(); }, 'maxc'),
    button(tpl(dg.useAtlas, { m: f.mag(ex.mc) }), () => { st.mc = ex.mc; s.set(st.mc); update(); }, 'atlas'));
  fig.setDraw(draw);
  update();
  fig.table([t('learn.dg.magnitude'), t('learn.dg.count')], fmd.map(([m, n]) => [f.mag(m), f.int(n)]));
  return () => fig.destroy();
}
