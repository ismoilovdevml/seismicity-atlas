// Groningen: annual gas production against the annual number of ML >= 1.5 earthquakes (real data from
// induced/groningen/rates.json), with the earthquakes of the same year, one year later or two years later. The Spearman
// rank correlation is recomputed in the browser for the chosen lag. "Play" adds the years one by one; under reduced
// motion the diagram shows all years at once.

import { figure, frame, toggle, animator, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

export function spearman(x, y) {
  const rx = ranks(x), ry = ranks(y), n = x.length;
  const mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

/** Pairs (production in year y, events in year y + lag) over the years with a full production year and 12 months of events. */
export function pairs(ex, lag) {
  const out = [];
  ex.years.forEach((y, i) => {
    const j = ex.years.indexOf(y + lag);
    if (ex.prod[i] === null || j < 0 || ex.months[j] !== 12) return;
    out.push({ y, p: ex.prod[i], n: ex.n[j] });
  });
  return out;
}

export default function mount(el, { dg, ex }) {
  const st = { lag: 1, shown: Infinity };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const P = pairs(ex, st.lag);
    const H = 270;
    const F = frame({ W, H, m: { l: 50 }, x: { domain: [0, 60], label: dg.xLabel }, y: { domain: [0, 30], label: dg.yLabel }, alt: dg.alt });
    P.slice(0, st.shown).forEach((q) => {
      svgEl('circle', { cx: F.xs(q.p), cy: F.ys(q.n), r: 5, class: 'dot', style: '--c:var(--s1)' }, F.plot);
    });
    const last = P.slice(0, st.shown).pop();
    if (last) label(F.top, F.xs(last.p) + 8, F.ys(last.n) - 6, String(last.y), 'lbl strong');
    return F.svg;
  };
  const say = () => {
    const P = pairs(ex, st.lag).slice(0, st.shown);
    const rho = P.length >= 3 ? spearman(P.map((q) => q.p), P.map((q) => q.n)) : null;
    fig.say(tpl(dg.readout, { lag: st.lag, rho: rho === null ? '–' : f.fixed(rho, 2), n: P.length }));
    fig.fig.dataset.rho = rho === null ? '' : rho.toFixed(2);
  };
  const tg = toggle({ label: dg.lagLabel, name: 'lag', value: 1, options: [0, 1, 2].map((k) => ({ id: k, label: tpl(dg.lagOpt, { k }) })),
    onChange: (k) => { st.lag = k; st.shown = Infinity; anim.jump(pairs(ex, k).length); say(); fig.redraw(); } });
  const anim = animator({ frames: pairs(ex, 1).length, interval: 260, step: (i) => { st.shown = i; say(); fig.redraw(); }, onState: (x) => { fig.fig.dataset.anim = x; } });
  fig.controls.append(tg.el, anim.btn);
  fig.setDraw(draw);
  anim.start();
  say();
  fig.table([dg.colYear, dg.xLabel, dg.colEvents], pairs(ex, 0).map((q) => [String(q.y), f.fixed(q.p, 1), f.int(q.n)]));
  return () => { anim.stop(); fig.destroy(); };
}
