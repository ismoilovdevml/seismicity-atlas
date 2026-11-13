// A magnitude ladder: the typical completeness of each regional catalogue (regional/index.json, mc_typical) against
// the global shallow floor of the most recent period (manifest.json). One step of 1 in magnitude is about 32 times
// in radiated energy, so the gap is shown both ways.

import { figure, frame, toggle, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const regs = ex.regions;
  const st = { id: (regs.find((r) => r.id === 'italy') || regs[0]).id };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const rowH = 34, H = (regs.length + 1) * rowH + 50;
    const F = frame({ W, H, m: { l: 16, t: 10 }, x: { domain: [0, Math.max(7, ex.floor + 0.8)], label: dg.xLabel }, y: { domain: [0, regs.length + 1], hide: true }, alt: dg.alt });
    const xf = F.xs(ex.floor);
    svgEl('line', { x1: xf, x2: xf, y1: F.m.t, y2: H - F.m.b, class: 'rule dashed' }, F.top);
    label(F.top, xf - 6, F.m.t + 12, tpl(dg.globalLabel, { m: f.mag(ex.floor) }), 'lbl strong', 'end');
    regs.forEach((r, i) => {
      const y = F.m.t + (i + 1) * rowH + rowH / 2 - 6;
      const on = r.id === st.id;
      const c = on ? 'var(--s2)' : 'var(--s1)';
      svgEl('line', { x1: F.xs(r.mc_typical), x2: xf, y1: y, y2: y, class: 'faint' }, F.plot);
      svgEl('circle', { cx: F.xs(r.mc_typical), cy: y, r: on ? 6.5 : 5, class: 'dot', style: `--c:${c}` }, F.top);
      label(F.top, F.xs(r.mc_typical) + 10, y + 4, `${r.name}, Mc ${f.mag(r.mc_typical)}`, on ? 'lbl strong' : 'lbl');
    });
    return F.svg;
  };
  const update = () => {
    const r = regs.find((x) => x.id === st.id);
    const dm = ex.floor - r.mc_typical;
    fig.say(tpl(dg.readout, { name: r.name, catalogue: r.catalogue, magtype: r.magtype, licence: r.licence, mc: f.mag(r.mc_typical), res: String(r.h3_res), radius: f.km(r.radius_km),
      period: `${r.period[0].slice(0, 4)}–${r.period[1].slice(0, 4)}`, dm: f.mag(dm), energy: f.int(+(10 ** (1.5 * dm)).toPrecision(2)), count: f.int(+(10 ** dm).toPrecision(2)) }));
    fig.redraw();
  };
  const tg = toggle({ label: dg.pick, name: 'region', value: st.id, options: regs.map((r) => ({ id: r.id, label: r.name })), onChange: (v) => { st.id = v; update(); } });
  fig.controls.append(tg.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
