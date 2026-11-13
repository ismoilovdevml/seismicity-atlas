// b-positive vs the classic b on a synthetic catalogue (true b = 1) where small events go missing for a while after a
// large one, as they do in real catalogues. The classic estimate drifts; b-positive barely moves.

import { figure, frame, slider, svgEl, label, rng, grSample, akiList, bPositive, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

const M0 = 2.0, TMAIN = 0.45, MMAIN = 6.0;

function catalogue() {
  const r = rng(11);
  const ev = [];
  const bg = grSample(r, 250, 1.0, M0);
  for (const m of bg) ev.push({ t: r(), m });
  const as = grSample(r, 1800, 1.0, M0);
  for (const m of as) {
    // Omori-like delays (p near 1, c small) on the unit time axis
    const dt = 0.02 * ((1 - r()) ** -1.1 - 1);
    if (TMAIN + dt < 1) ev.push({ t: TMAIN + dt, m: Math.min(m, MMAIN - 0.3) });
  }
  ev.push({ t: TMAIN, m: MMAIN, main: true });
  return ev.sort((a, b) => a.t - b.t);
}

export default function mount(el, { dg }) {
  const ev = catalogue();
  const st = { gap: 0.15 };
  // detection threshold after the mainshock: high at first, back to M0 after `gap` of the time axis
  const seen = (e) => {
    if (e.main || e.t <= TMAIN || st.gap === 0) return true;
    const u = (e.t - TMAIN) / st.gap;
    if (u >= 1) return true;
    return e.m >= M0 + 1.5 * (1 - u);
  };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgSeen, color: 'var(--s1)' }, { label: dg.lgMissed, color: 'var(--nodata)' }]), fig.plotEl);
  const draw = (W) => {
    const H = 250;
    const F = frame({ W, H, x: { domain: [0, 1], label: dg.xLabel, fmt: () => '' }, y: { domain: [M0 - 0.2, MMAIN + 0.3], label: dg.yLabel }, alt: dg.alt });
    for (const e of ev) {
      const ok = seen(e);
      svgEl('circle', { cx: F.xs(e.t), cy: F.ys(e.m), r: e.main ? 6 : 2.2, class: ok ? 'ev' : 'ev gone', style: '--c:var(--s1)' }, F.plot);
    }
    label(F.top, F.xs(TMAIN) + 8, F.ys(MMAIN) + 4, dg.big, 'lbl strong');
    return F.svg;
  };
  const update = () => {
    const obs = ev.filter(seen).filter((e) => !e.main).map((e) => e.m);
    const b = akiList(obs, M0), bp = bPositive(obs);
    const miss = ev.length - ev.filter(seen).length;
    fig.say(tpl(dg.readout, { b: f.b2(b), bp: f.b2(bp), miss: f.int(miss), n: f.int(ev.length) }));
    fig.fig.dataset.b = b.toFixed(3);
    fig.fig.dataset.bp = bp.toFixed(3);
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: 0, max: 0.4, step: 0.01, value: st.gap, fmt: (v) => `${Math.round(v * 100)} %`, name: 'gap', onInput: (v) => { st.gap = v; update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
