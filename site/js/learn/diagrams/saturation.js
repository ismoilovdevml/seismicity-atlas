// Magnitude saturation, schematic: body-wave mb, surface-wave Ms and local ML stop growing with the true size
// (moment magnitude Mw) above a level that depends on the wave period they measure. Shapes only, not a calibration.

import { figure, frame, slider, svgEl, label, path, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

// A smooth "minimum" of m and a ceiling s: equals m well below s, approaches s well above it.
const sat = (m, s, k = 0.35) => s - k * Math.log1p(Math.exp((s - m) / k));
const SCALES = [
  { id: 'mb', ceil: 6.3, color: 'var(--s1)' },
  { id: 'ML', ceil: 6.8, color: 'var(--s3)' },
  { id: 'Ms', ceil: 8.3, color: 'var(--s2)' },
];

export default function mount(el, { dg }) {
  const st = { mw: 7.5 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.mw, color: 'var(--ink-3)', line: true }, ...SCALES.map((s) => ({ label: dg[s.id], color: s.color, line: true }))]), fig.plotEl);
  const draw = (W) => {
    const H = 280;
    const F = frame({ W, H, x: { domain: [4, 9.6], label: dg.xLabel }, y: { domain: [4, 9.6], label: dg.yLabel }, alt: dg.alt });
    svgEl('path', { d: path([[F.xs(4), F.ys(4)], [F.xs(9.6), F.ys(9.6)]]), class: 'dash' }, F.plot);
    for (const s of SCALES) {
      const pts = [];
      for (let m = 4; m <= 9.6; m += 0.05) pts.push([F.xs(m), F.ys(sat(m, s.ceil))]);
      svgEl('path', { d: path(pts), class: 'line', style: `--c:${s.color}` }, F.plot);
      label(F.top, F.xs(9.55), F.ys(sat(9.55, s.ceil)) - 6, s.id, 'lbl strong', 'end');
      svgEl('circle', { cx: F.xs(st.mw), cy: F.ys(sat(st.mw, s.ceil)), r: 4.5, class: 'dot', style: `--c:${s.color}` }, F.top);
    }
    const x = F.xs(st.mw);
    svgEl('line', { x1: x, x2: x, y1: F.m.t, y2: H - F.m.b, class: 'crosshair' }, F.plot);
    svgEl('circle', { cx: x, cy: F.ys(st.mw), r: 4.5, class: 'dot hollow', style: '--c:var(--ink-3)' }, F.top);
    return F.svg;
  };
  const update = () => {
    const v = Object.fromEntries(SCALES.map((s) => [s.id, f.mag(sat(st.mw, s.ceil))]));
    fig.say(tpl(dg.readout, { mw: f.mag(st.mw), ...v }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: 4, max: 9.5, step: 0.1, value: st.mw, fmt: f.mag, name: 'mw', onInput: (v) => { st.mw = v; update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
