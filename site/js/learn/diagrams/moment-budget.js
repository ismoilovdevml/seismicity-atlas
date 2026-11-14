// A moment budget in a short catalogue. The geodetic rate of the whole Tien Shan belt (deficit/index.json, full
// coupling) accumulates as a straight line; a simulated, fully coupled catalogue releases it in steps: Poisson
// earthquakes of Mw >= 6 at the observed rate, sizes from a tapered Gutenberg-Richter law (b of the belt, corner
// magnitude that balances the budget). The ratio released / accumulated after a chosen catalogue length shows how far
// short catalogues stray from 1 even when nothing is "missing". Synthetic and seeded; the animation reveals the years
// and draws the final frame under reduced motion.

import { figure, frame, slider, button, animator, svgEl, rng, legend, label, tpl, path } from '../kit.js';
import * as f from '../../fmt.js';

const m0 = (mw) => 10 ** (1.5 * mw + 9.1);

/** One simulated history of `years` years: [{t, m0}] (Kagan 2002 tapered G-R sampled as the minimum of two draws). */
export function simulate(seed, years, { rate6, b, corner }) {
  const r = rng(seed);
  const beta = (2 * b) / 3, mt = m0(6), mc = m0(corner);
  const out = [];
  let t = 0;
  for (;;) {
    t += -Math.log(1 - r()) / rate6;
    if (t > years) break;
    const x1 = mt * (1 - r()) ** (-1 / beta), x2 = mt - mc * Math.log(1 - r());
    out.push({ t, m0: Math.min(x1, x2) });
  }
  return out;
}

export default function mount(el, { dg, ex }) {
  const st = { years: 120, seed: 7, shown: 120 };
  let ev = simulate(st.seed, 500, ex);
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgGeod, color: 'var(--s2)' }, { label: dg.lgSeis, color: 'var(--s1)' }]), fig.plotEl);
  const released = (T) => ev.filter((e) => e.t <= T).reduce((s, e) => s + e.m0, 0);
  const draw = (W) => {
    const H = 270, T = st.years;
    const ymax = Math.max(ex.mg * T, released(T)) * 1.1 / 1e21;
    const F = frame({ W, H, m: { l: 52 }, x: { domain: [0, T], label: dg.xLabel, fmt: (v) => String(Math.round(v)) }, y: { domain: [0, ymax], label: dg.yLabel, fmt: (v) => f.sig2(v) }, alt: dg.alt });
    svgEl('path', { d: path([[F.xs(0), F.ys(0)], [F.xs(T), F.ys((ex.mg * T) / 1e21)]]), class: 'line', style: '--c:var(--s2)' }, F.plot);
    const pts = [[F.xs(0), F.ys(0)]];
    let cum = 0;
    for (const e of ev) {
      if (e.t > Math.min(T, st.shown)) break;
      pts.push([F.xs(e.t), F.ys(cum / 1e21)]);
      cum += e.m0;
      pts.push([F.xs(e.t), F.ys(cum / 1e21)]);
    }
    pts.push([F.xs(Math.min(T, st.shown)), F.ys(cum / 1e21)]);
    svgEl('path', { d: path(pts), class: 'line', style: '--c:var(--s1)' }, F.plot);
    const big = ev.filter((e) => e.t <= Math.min(T, st.shown)).reduce((a, e) => (e.m0 > (a ? a.m0 : 0) ? e : a), null);
    if (big) label(F.top, F.xs(big.t) + 4, F.m.t + 12, tpl(dg.bigLabel, { m: f.fixed((Math.log10(big.m0) - 9.1) / 1.5, 1) }), 'lbl');
    return F.svg;
  };
  const say = () => {
    const T = Math.min(st.years, st.shown);
    const ratio = T > 0 ? released(T) / (ex.mg * T) : 0;
    fig.say(tpl(dg.readout, { y: Math.round(T), ratio: f.fixed(ratio, 2), n: ev.filter((e) => e.t <= T).length }));
    fig.fig.dataset.ratio = ratio.toFixed(3);
  };
  const anim = animator({ frames: 60, interval: 50, step: (i) => { st.shown = (st.years * i) / 60; say(); fig.redraw(); }, onState: (x) => { fig.fig.dataset.anim = x; } });
  const s = slider({ label: dg.slider, min: 50, max: 500, step: 10, value: st.years, fmt: (v) => tpl(dg.yearsFmt, { y: v }), name: 'years',
    onInput: (v) => { st.years = v; st.shown = v; anim.stop(); say(); fig.redraw(); } });
  fig.controls.append(s.el, anim.btn, button(dg.again, () => { st.seed += 1; ev = simulate(st.seed, 500, ex); anim.jump(0); anim.play(); }, 'again'));
  fig.setDraw(draw);
  anim.start();
  say();
  // the distribution behind the readout: 200 simulated histories of the chosen length (seeded), as a table
  const qs = () => {
    const rs = [];
    for (let k = 0; k < 200; k++) { const e = simulate(1000 + k, st.years, ex); rs.push(e.reduce((sum, x) => sum + x.m0, 0) / (ex.mg * st.years)); }
    rs.sort((a, b) => a - b);
    return [0.025, 0.25, 0.5, 0.75, 0.975].map((q) => [f.fixed(q * 100, 1), f.fixed(rs[Math.floor(q * (rs.length - 1))], 2)]);
  };
  fig.table([dg.colQ, dg.colRatio], qs());
  return () => { anim.stop(); fig.destroy(); };
}
