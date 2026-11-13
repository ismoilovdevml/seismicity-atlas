// Why an average rate is not a forecast: the real yearly counts of one cell (ComCat M >= 4.5 as served, from the
// cell detail file) next to a simulated history with the same average and purely random (Poisson) timing.
// "Simulate another history" draws a new one; the animation reveals the simulated years one by one.

import { figure, frame, button, animator, svgEl, rng, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

function poisson(r, lam) {
  // Knuth for small means, normal approximation above 60
  if (lam > 60) { const u = 1 - r(), v = r(); return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); }
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}

export default function mount(el, { dg, ex }) {
  const real = ex.counts, n = real.length;
  let seed = 3, sim = [];
  const simulate = () => { const r = rng(seed); sim = real.map(() => poisson(r, ex.mean)); };
  simulate();
  let shown = n;
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgReal, color: 'var(--s1)' }, { label: dg.lgSim, color: 'var(--s2)' }]), fig.plotEl);
  const draw = (W) => {
    const H = 260;
    const ymax = Math.max(...real, ...sim) * 1.1;
    const F = frame({ W, H, x: { domain: [ex.y0 - 0.6, ex.y0 + n - 0.4], label: dg.xLabel, fmt: (v) => String(Math.round(v)) }, y: { domain: [0, ymax], label: dg.yLabel }, alt: dg.alt });
    const bw = Math.max(1, (F.xs(1) - F.xs(0)) / 2 - 1);
    real.forEach((c, i) => { if (c) svgEl('rect', { x: F.xs(ex.y0 + i) - bw - 0.5, y: F.ys(c), width: bw, height: F.ys(0) - F.ys(c), class: 'bar', style: '--c:var(--s1)' }, F.plot); });
    sim.slice(0, shown).forEach((c, i) => { if (c) svgEl('rect', { x: F.xs(ex.y0 + i) + 0.5, y: F.ys(c), width: bw, height: F.ys(0) - F.ys(c), class: 'bar', style: '--c:var(--s2)' }, F.plot); });
    svgEl('line', { x1: F.m.l, x2: W - F.m.r, y1: F.ys(ex.mean), y2: F.ys(ex.mean), class: 'rule dashed' }, F.top);
    return F.svg;
  };
  const say = () => {
    const s = sim.slice(0, shown);
    fig.say(tpl(dg.readout, { mean: f.int(ex.mean), rmin: f.int(Math.min(...real)), rmax: f.int(Math.max(...real)), smin: s.length ? f.int(Math.min(...s)) : '–', smax: s.length ? f.int(Math.max(...s)) : '–' }));
  };
  const anim = animator({ frames: n, interval: 70, step: (i) => { shown = i; say(); fig.redraw(); }, onState: (x) => { fig.fig.dataset.anim = x; } });
  fig.controls.append(anim.btn, button(dg.again, () => { seed += 1; simulate(); anim.jump(0); anim.play(); }, 'again'));
  fig.setDraw(draw);
  anim.start();
  fig.table([dg.xLabel, dg.lgReal], real.map((c, i) => [String(ex.y0 + i), f.int(c)]));
  return () => { anim.stop(); fig.destroy(); };
}
