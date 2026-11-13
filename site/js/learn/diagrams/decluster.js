// Gardner-Knopoff declustering on a synthetic space-time catalogue: the window of each event, largest first,
// marks the smaller events inside it as dependent. The animation opens the windows one by one; the b-value of what
// is left updates as it goes. A scale slider shows how much the answer depends on the window size.

import { figure, frame, slider, animator, button, svgEl, label, rng, grSample, akiList, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

// Gardner & Knopoff (1974) windows as in ZMAP/OpenQuake (scripts/seislib.py gk_windows): km and days.
const gkL = (m) => 10 ** (0.1238 * m + 0.983);
const gkT = (m) => (m >= 6.5 ? 10 ** (0.032 * m + 2.7389) : 10 ** (0.5409 * m - 0.547));
const SPAN_KM = 1200, SPAN_D = 7300, MMIN = 5.0;

function catalogue() {
  const r = rng(21);
  const ev = grSample(r, 260, 1.0, MMIN).map((m) => ({ x: r() * SPAN_KM, t: r() * SPAN_D, m }));
  for (const [x, t, mm, n] of [[300, 1500, 7.8, 90], [850, 4200, 7.1, 50], [560, 6100, 6.6, 25]]) {
    ev.push({ x, t, m: mm });
    for (const m of grSample(r, n, 1.0, MMIN)) {
      const dt = 0.5 * ((1 - r()) ** -1.1 - 1);
      const dx = (r() - 0.5) * 2 * gkL(mm) * 0.8;
      if (t + dt < SPAN_D) ev.push({ x: x + dx, t: t + dt, m: Math.min(m, mm - 0.4) });
    }
  }
  return ev;
}

export default function mount(el, { dg }) {
  const ev = catalogue();
  const order = ev.map((e, i) => i).sort((a, b) => ev[b].m - ev[a].m);
  const st = { k: 1.0, opened: 0 };
  let res = null;
  const run = () => {
    // full declustering with window scale k; record which windows remove something, in processing order
    const dep = new Array(ev.length).fill(-1);
    const wins = [];
    for (const i of order) {
      if (dep[i] !== -1) continue;
      const L = gkL(ev[i].m) * st.k, T = gkT(ev[i].m) * st.k;
      let removed = 0;
      for (let j = 0; j < ev.length; j++) {
        if (j === i || dep[j] !== -1 || ev[j].m > ev[i].m) continue;
        if (Math.abs(ev[j].x - ev[i].x) <= L && ev[j].t - ev[i].t >= 0 && ev[j].t - ev[i].t <= T) { dep[j] = wins.length; removed++; }
      }
      if (removed) wins.push({ i, L, T, removed });
    }
    res = { dep, wins };
  };
  run();
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend([{ label: dg.lgKept, color: 'var(--s1)', dot: true }, { label: dg.lgRemoved, color: 'var(--nodata)', dot: true }, { label: dg.lgWindow, color: 'var(--s2)' }]), fig.plotEl);
  const removedNow = (j) => res.dep[j] !== -1 && res.dep[j] < st.opened;
  const draw = (W) => {
    const H = 280;
    const F = frame({ W, H, x: { domain: [0, SPAN_D / 365.25], label: dg.xLabel }, y: { domain: [0, SPAN_KM], label: dg.yLabel }, alt: dg.alt });
    res.wins.slice(0, st.opened).forEach((w) => {
      const e = ev[w.i];
      const x0 = F.xs(e.t / 365.25), x1 = F.xs(Math.min(SPAN_D, e.t + w.T) / 365.25);
      svgEl('rect', { x: x0, y: F.ys(Math.min(SPAN_KM, e.x + w.L)), width: Math.max(2, x1 - x0), height: F.ys(Math.max(0, e.x - w.L)) - F.ys(Math.min(SPAN_KM, e.x + w.L)), class: 'win' }, F.plot);
    });
    ev.forEach((e, j) => {
      svgEl('circle', { cx: F.xs(e.t / 365.25), cy: F.ys(e.x), r: 1.6 + (e.m - MMIN) * 1.6, class: removedNow(j) ? 'ev gone' : 'ev', style: '--c:var(--s1)' }, F.plot);
    });
    return F.svg;
  };
  const say = () => {
    const all = ev.map((e) => e.m);
    const kept = ev.filter((e, j) => !removedNow(j)).map((e) => e.m);
    fig.say(tpl(dg.readout, { k: f.fixed(st.k, 2), w: f.int(Math.min(st.opened, res.wins.length)), nw: f.int(res.wins.length), kept: f.int(kept.length), n: f.int(all.length),
      bAll: f.b2(akiList(all, MMIN)), bKept: f.b2(akiList(kept, MMIN)) }));
    fig.fig.dataset.opened = String(st.opened);
  };
  const anim = animator({ frames: res.wins.length, interval: 450, step: (i) => { st.opened = i; say(); fig.redraw(); }, onState: (s) => { fig.fig.dataset.anim = s; } });
  const s = slider({ label: dg.slider, min: 0.5, max: 1.5, step: 0.05, value: 1, fmt: (v) => `× ${f.fixed(v, 2)}`, name: 'scale', onInput: (v) => {
    st.k = v; anim.stop(); run(); st.opened = res.wins.length; say(); fig.redraw();
  } });
  fig.controls.append(anim.btn, button(dg.all, () => anim.jump(res.wins.length), 'skip'), s.el);
  fig.setDraw(draw);
  anim.start();
  return () => { anim.stop(); fig.destroy(); };
}
