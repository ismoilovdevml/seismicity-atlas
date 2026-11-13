// Omori-Utsu decay: the real aftershock rate of a sequence (sequences.json, counts >= Mcat in log-spaced bins) on
// log-log axes, with the model K (t + c)^-p. Sliders move p and c; "Fitted values" restores the published fit.
// Below, a linear one-year strip where aftershocks drawn from the current model appear in time order.

import { figure, frame, slider, button, animator, svgEl, label, path, rng, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const s = ex.s;
  const edges = s.rate_bins_days, counts = s.rate_counts;
  const obs = [];
  for (let i = 0; i < counts.length; i++) {
    const a = Math.max(edges[i], 1e-3), b = edges[i + 1];
    if (counts[i] > 0 && b > a) obs.push({ t: Math.sqrt(a * b), r: counts[i] / (b - a), n: counts[i], a: edges[i], b });
  }
  const c0 = Math.max(s.c || 0, 0.001);
  const st = { p: s.p, c: c0 };
  let ticks = [];
  const sample = () => {
    // inverse-transform sampling of times in [0, 365] d from (t + c)^-p; at most 400 ticks, for readability
    const r = rng(5);
    const F = (t) => (Math.abs(st.p - 1) < 1e-6 ? Math.log((t + st.c) / st.c) : ((t + st.c) ** (1 - st.p) - st.c ** (1 - st.p)) / (1 - st.p));
    const tot = F(365);
    const inv = (u) => (Math.abs(st.p - 1) < 1e-6 ? st.c * Math.exp(u) - st.c : (u * (1 - st.p) + st.c ** (1 - st.p)) ** (1 / (1 - st.p)) - st.c);
    ticks = Array.from({ length: 400 }, () => inv(r() * tot)).sort((a, b) => a - b);
  };
  sample();
  let shown = ticks.length;
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgData, color: 'var(--s1)', dot: true }, { label: dg.lgModel, color: 'var(--s2)', line: true }]), fig.plotEl);
  const draw = (W) => {
    const H = 260, strip = 56;
    const rmax = Math.max(...obs.map((o) => o.r)), rmin = Math.min(...obs.map((o) => o.r));
    const F = frame({ W, H, x: { domain: [0.003, 400], log: true, label: dg.xLabel }, y: { domain: [rmin / 3, rmax * 3], log: true, label: dg.yLabel }, alt: dg.alt });
    const pts = [];
    for (let e = -2.5; e <= 2.6; e += 0.05) { const t = 10 ** e; pts.push([F.xs(t), F.ys(s.K * (t + st.c) ** -st.p)]); }
    svgEl('path', { d: path(pts), class: 'line', style: '--c:var(--s2)' }, F.plot);
    for (const o of obs) svgEl('circle', { cx: F.xs(o.t), cy: F.ys(o.r), r: 4, class: 'dot', style: '--c:var(--s1)' }, F.plot);
    // the strip: one year on a linear axis
    const svg = F.svg;
    svg.setAttribute('height', H + strip);
    svg.setAttribute('viewBox', `0 0 ${W} ${H + strip}`);
    const y0 = H + 18, x0 = F.m.l, x1 = W - F.m.r;
    const g = svgEl('g', {}, svg);
    svgEl('line', { x1: x0, x2: x1, y1: y0 + 16, y2: y0 + 16, class: 'axis' }, g);
    for (const tk of ticks.slice(0, shown)) svgEl('line', { x1: x0 + (tk / 365) * (x1 - x0), x2: x0 + (tk / 365) * (x1 - x0), y1: y0, y2: y0 + 14, class: 'rule', style: 'stroke:var(--s2);stroke-opacity:0.55' }, g);
    label(g, x0, y0 + 30, dg.stripStart, 'tick');
    label(g, x1, y0 + 30, dg.stripEnd, 'tick', 'end');
    label(g, (x0 + x1) / 2, y0 + 30, dg.stripLabel, 'axis-label', 'middle');
    return svg;
  };
  const update = () => {
    const ratio = ((1 + st.c) / (10 + st.c)) ** -st.p;
    fig.say(tpl(dg.readout, { p: f.b2(st.p), c: f.sig2(st.c), K: f.sig2(s.K), ratio: f.sig2(ratio) }));
    fig.redraw();
  };
  const anim = animator({ frames: 60, interval: 70, step: (i) => { shown = Math.round((ticks.length * i) / 60); fig.redraw(); }, onState: (x) => { fig.fig.dataset.anim = x; } });
  const sp = slider({ label: dg.pSlider, min: 0.5, max: 1.6, step: 0.01, value: st.p, fmt: f.b2, name: 'p', onInput: (v) => { st.p = v; sample(); shown = ticks.length; update(); } });
  const cl = (v) => 10 ** v;
  const sc = slider({ label: dg.cSlider, min: -3, max: 0, step: 0.05, value: Math.log10(st.c), fmt: (v) => f.sig2(cl(v)), name: 'c', onInput: (v) => { st.c = cl(v); sample(); shown = ticks.length; update(); } });
  fig.controls.append(sp.el, sc.el, button(dg.reset, () => { st.p = s.p; st.c = c0; sp.set(st.p); sc.set(Math.log10(st.c)); sample(); update(); }, 'reset'), anim.btn);
  fig.setDraw(draw);
  update();
  anim.start();
  fig.table([dg.binLabel, dg.countLabel, dg.yLabel], obs.map((o) => [`${f.sig2(o.a)}–${f.sig2(o.b)}`, f.int(o.n), f.sig2(o.r)]));
  return () => { anim.stop(); fig.destroy(); };
}
