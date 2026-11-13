// Båth's law with the atlas sequences: the gap between each mainshock and its largest aftershock (from the M >= 6
// event layer) against the mainshock magnitude, with the 1.2 reference. Below, what the published Omori-Utsu fit of
// one sequence implies for the number of later aftershocks above a chosen magnitude (Reasenberg-Jones form).

import { figure, frame, slider, toggle, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const rows = ex.rows.filter((r) => r.d !== null);
  const T = ex.T;
  const st = { m: Math.min(T.mag - 1, Math.max(T.mcat + 1, 7)), days: 30, sel: rows.findIndex((r) => r.s === T) };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const H = 260;
    const ms = rows.map((r) => r.s.mag), ds = rows.map((r) => r.d);
    const F = frame({ W, H, x: { domain: [Math.min(...ms) - 0.1, Math.max(...ms) + 0.1], label: dg.xLabel }, y: { domain: [Math.min(0, ...ds) - 0.1, Math.max(2.6, ...ds) + 0.1], label: dg.yLabel }, alt: dg.alt });
    svgEl('line', { x1: F.m.l, x2: W - F.m.r, y1: F.ys(1.2), y2: F.ys(1.2), class: 'rule dashed' }, F.plot);
    label(F.top, W - F.m.r - 2, F.ys(1.2) - 6, dg.bathLine, 'lbl strong', 'end');
    rows.forEach((r, i) => {
      svgEl('circle', { cx: F.xs(r.s.mag) + ((i % 3) - 1) * 3, cy: F.ys(r.d), r: i === st.sel ? 6.5 : 4.5, class: i === st.sel ? 'dot' : 'dot hollow', style: `--c:${i === st.sel ? 'var(--s2)' : 'var(--s1)'}` }, F.top);
    });
    return F.svg;
  };
  const sayPick = () => {
    const r = rows[st.sel];
    return tpl(dg.pick, { place: r.s.place, m: f.mag(r.s.mag), a: f.mag(r.a), d: f.fixed(r.d, 1) });
  };
  // expected number of events >= m between day 1 and day 1 + days, from K (t + c)^-p for events >= Mcat
  const expected = () => {
    const p = T.p, c = Math.max(T.c || 0, 1e-6), t1 = 1, t2 = 1 + st.days;
    const I = Math.abs(p - 1) < 1e-6 ? Math.log((t2 + c) / (t1 + c)) : ((t2 + c) ** (1 - p) - (t1 + c) ** (1 - p)) / (1 - p);
    return T.K * I * 10 ** (-T.b_seq * (st.m - T.mcat));
  };
  const update = () => {
    const n = expected();
    fig.say(`${sayPick()} ${tpl(dg.rj, { place: T.place, m: f.mag(st.m), days: f.int(st.days), n: f.sig2(n), prob: String(Math.round(100 * (1 - Math.exp(-n)))) })}`);
    fig.redraw();
  };
  const seqS = slider({ label: dg.seqSlider, min: 0, max: rows.length - 1, step: 1, value: st.sel, fmt: (i) => f.mag(rows[i].s.mag), name: 'seq', onInput: (v) => { st.sel = v; update(); } });
  const mS = slider({ label: tpl(dg.mSlider, { place: T.place }), min: Math.ceil(T.mcat * 10) / 10, max: Math.floor((T.mag - 0.5) * 10) / 10, step: 0.1, value: st.m, fmt: f.mag, name: 'm', onInput: (v) => { st.m = v; update(); } });
  const dT = toggle({ label: dg.daysLabel, name: 'days', value: 30, options: [7, 30, 365].map((d) => ({ id: d, label: tpl(dg.days, { d }) })), onChange: (v) => { st.days = v; update(); } });
  fig.controls.append(seqS.el, mS.el, dT.el);
  fig.setDraw(draw);
  update();
  fig.table([dg.colPlace, dg.colMain, dg.colAfter, dg.colGap], ex.rows.map((r) => [r.s.place, f.mag(r.s.mag), r.a === null ? '–' : f.mag(r.a), r.d === null ? '–' : f.fixed(r.d, 1)]));
  return () => fig.destroy();
}
