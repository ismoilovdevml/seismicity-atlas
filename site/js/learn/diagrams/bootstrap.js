// Bootstrap animation: resample the cell's events above Mc with replacement, re-estimate b each time, and let the
// replicates build a histogram. When all replicates are in, the 2.5-97.5 percentile band appears.

import { figure, frame, button, animator, svgEl, label, rng, akiList, quantile, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const pool = [];
  for (const [m, n] of ex.fmd) if (m >= ex.mc - 1e-9) for (let i = 0; i < n; i++) pool.push(m);
  const N = ex.nboot;
  let seed = 7;
  let reps = [];
  const resample = () => {
    const r = rng(seed);
    reps = [];
    for (let k = 0; k < N; k++) {
      const s = new Array(pool.length);
      for (let i = 0; i < pool.length; i++) s[i] = pool[Math.floor(r() * pool.length)];
      reps.push(akiList(s, ex.mc));
    }
  };
  resample();
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  let shown = 0;
  const lo = 0.5, hi = 1.6, bw = 0.02;
  const draw = (W) => {
    const H = 250;
    const bins = new Array(Math.round((hi - lo) / bw)).fill(0);
    for (const b of reps.slice(0, shown)) { const i = Math.floor((b - lo) / bw); if (i >= 0 && i < bins.length) bins[i]++; }
    const ymax = Math.max(8, ...bins);
    const F = frame({ W, H, m: { t: 34 }, x: { domain: [lo, hi], label: dg.xLabel }, y: { domain: [0, ymax * 1.1], label: dg.yLabel }, alt: dg.alt });
    bins.forEach((n, i) => { if (n) svgEl('rect', { x: F.xs(lo + i * bw) + 0.5, y: F.ys(n), width: Math.max(1, F.xs(bw) - F.xs(0) - 1), height: F.ys(0) - F.ys(n), class: 'bar', rx: 1 }, F.plot); });
    if (shown >= N) {
      const s = reps.slice().sort((a, b) => a - b);
      const q0 = quantile(s, 0.025), q1 = quantile(s, 0.975);
      svgEl('rect', { x: F.xs(q0), y: F.m.t, width: F.xs(q1) - F.xs(q0), height: H - F.m.t - F.m.b, class: 'band-rect' }, F.plot);
      label(F.top, (F.xs(q0) + F.xs(q1)) / 2, F.m.t + 12, dg.band, 'lbl strong', 'middle');
    }
    // the atlas interval (which also re-estimates Mc in every replicate) as a bar above the plot
    const y = 14;
    svgEl('line', { x1: F.xs(ex.lo), x2: F.xs(ex.hi), y1: y, y2: y, class: 'ci', style: '--c:var(--s2)' }, F.top);
    svgEl('circle', { cx: F.xs(ex.b), cy: y, r: 4.5, class: 'dot', style: '--c:var(--s2)' }, F.top);
    label(F.top, F.xs(ex.hi) + 6, y + 4, dg.atlasBar, 'lbl');
    return F.svg;
  };
  const say = () => {
    if (!shown) { fig.say(dg.start); return; }
    const s = reps.slice(0, shown).sort((a, b) => a - b);
    fig.say(tpl(shown >= N ? dg.done : dg.running, { k: f.int(shown), n: f.int(N), b: f.b2(reps[shown - 1]), lo: f.b2(quantile(s, 0.025)), hi: f.b2(quantile(s, 0.975)), alo: f.b2(ex.lo), ahi: f.b2(ex.hi) }));
  };
  const anim = animator({
    frames: N, interval: 30,
    step: (i) => { shown = i; say(); fig.redraw(); },
    onState: (s) => { fig.fig.dataset.anim = s; },
  });
  fig.controls.append(anim.btn,
    button(dg.again, () => { seed += 1; resample(); anim.jump(0); anim.play(); }, 'again'),
    button(dg.skip, () => anim.jump(N), 'skip'));
  fig.setDraw(draw);
  anim.start();
  return () => { anim.stop(); fig.destroy(); };
}
