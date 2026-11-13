// The Gutenberg-Richter line pivots around the count at Mc as b changes, over the real cumulative FMD of a cell.

import { figure, frame, slider, button, svgEl, label, cumulative, akiB, path, legend, tpl } from '../kit.js';
import { t } from '../../i18n/index.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const cum = cumulative(ex.fmd).filter(([, n]) => n > 0);
  const fit = akiB(ex.fmd, ex.mc).b;
  const nMc = (cum.find(([m]) => Math.abs(m - ex.mc) < 1e-6) || cum[0])[1];
  const st = { b: 1.0 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgData, color: 'var(--s1)' }, { label: dg.lgLine, color: 'var(--s2)', line: true }]), fig.plotEl);
  const draw = (W) => {
    const H = 270;
    const ymax = cum[0][1];
    const x0 = cum[0][0] - 0.1, x1 = cum[cum.length - 1][0] + 0.2;
    const F = frame({ W, H, x: { domain: [x0, x1], label: t('learn.dg.magnitude') }, y: { domain: [0.5, ymax * 2], log: true, label: dg.yLabel }, alt: dg.alt });
    for (const [m, n] of cum) svgEl('circle', { cx: F.xs(m), cy: F.ys(n), r: 3.5, class: m >= ex.mc - 1e-9 ? 'dot' : 'dot hollow', style: '--c:var(--s1)' }, F.plot);
    const line = [];
    for (let m = ex.mc; m <= x1; m += 0.05) line.push([F.xs(m), F.ys(nMc * 10 ** (-st.b * (m - ex.mc)))]);
    svgEl('path', { d: path(line), class: 'line', style: '--c:var(--s2)' }, F.plot);
    svgEl('circle', { cx: F.xs(ex.mc), cy: F.ys(nMc), r: 5, class: 'dot', style: '--c:var(--s2)' }, F.top);
    label(F.top, F.xs(ex.mc) + 8, F.ys(nMc) - 8, dg.pivot, 'lbl');
    const xc = F.xs(ex.mc - 0.05);
    svgEl('line', { x1: xc, x2: xc, y1: F.m.t, y2: H - F.m.b, class: 'rule dashed' }, F.top);
    label(F.top, xc - 5, H - F.m.b - 8, `Mc ${f.mag(ex.mc)}`, 'lbl strong', 'end');
    return F.svg;
  };
  const update = () => {
    fig.say(tpl(dg.readout, { b: f.b2(st.b), ratio: f.sig2(10 ** st.b), fit: f.b2(fit), atlas: f.b2(ex.b) }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: 0.5, max: 1.8, step: 0.01, value: st.b, fmt: f.b2, name: 'b', onInput: (v) => { st.b = v; update(); } });
  fig.controls.append(s.el, button(tpl(dg.fitBtn, { b: f.b2(fit) }), () => { st.b = Math.round(fit * 100) / 100; s.set(st.b); update(); }, 'fit'));
  fig.setDraw(draw);
  update();
  fig.table([t('learn.dg.magnitude'), dg.yLabel], cum.map(([m, n]) => [f.mag(m), f.int(n)]));
  return () => fig.destroy();
}
