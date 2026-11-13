// An H3 cell and its sampling circle, drawn to scale from the example cell's area and the atlas radius; the
// regional resolutions use the measured median cell area of a regional catalogue. Neighbour circles show the overlap.

import { figure, slider, toggle, svgEl, label, tpl } from '../kit.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex, vars }) {
  const opts = [{ id: 'g', res: null, area: ex.area, radius: ex.radius }, ...ex.resList.map((x) => ({ id: `r${x.res}`, res: x.res, area: x.area, radius: x.radius }))];
  const st = { o: opts[0], r: ex.radius, nb: true };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const H = Math.min(360, Math.max(260, W * 0.55));
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': dg.alt, class: 'chart-svg lr-svg' });
    const a = st.o.area;
    const side = Math.sqrt((2 * a) / (3 * Math.sqrt(3))); // regular hexagon of the same area, km
    const span = Math.max(st.r * 2.3, side * 4.2);
    const k = (Math.min(W, H) - 30) / span; // px per km
    const cx = W / 2, cy = H / 2;
    const hex = (x0, y0) => Array.from({ length: 6 }, (_, i) => { const t = (Math.PI / 3) * i + Math.PI / 6; return `${(x0 + side * k * Math.cos(t)).toFixed(1)},${(y0 + side * k * Math.sin(t)).toFixed(1)}`; }).join(' ');
    const dx = Math.sqrt(3) * side * k;
    const nbs = [[dx, 0], [-dx, 0], [dx / 2, 1.5 * side * k], [-dx / 2, 1.5 * side * k], [dx / 2, -1.5 * side * k], [-dx / 2, -1.5 * side * k]];
    for (const [ox, oy] of nbs) svgEl('polygon', { points: hex(cx + ox, cy + oy), class: 'faint' }, svg);
    if (st.nb) for (const [ox, oy] of nbs.slice(0, 2)) svgEl('circle', { cx: cx + ox, cy: cy + oy, r: st.r * k, class: 'dash' }, svg);
    svgEl('polygon', { points: hex(cx, cy), class: 'shape' }, svg);
    svgEl('circle', { cx, cy, r: st.r * k, class: 'circle' }, svg);
    svgEl('circle', { cx, cy, r: 3, style: 'fill:var(--ink)' }, svg);
    svgEl('line', { x1: cx, x2: cx + st.r * k, y1: cy, y2: cy, class: 'rule' }, svg);
    label(svg, cx + (st.r * k) / 2, cy - 6, f.km(st.r), 'lbl strong mono', 'middle');
    // scale bar
    const bar = st.r >= 100 ? 100 : 10;
    svgEl('line', { x1: 12, x2: 12 + bar * k, y1: H - 12, y2: H - 12, style: 'stroke:var(--ink-2);stroke-width:2' }, svg);
    label(svg, 12, H - 18, f.km(bar), 'tick');
    return svg;
  };
  const update = () => {
    const circle = Math.PI * st.r * st.r;
    const d = Math.sqrt(3) * Math.sqrt((2 * st.o.area) / (3 * Math.sqrt(3))); // centre-to-centre distance of neighbours
    fig.say(tpl(dg.readout, { res: st.o.res === null ? vars.globalRes : String(st.o.res), area: f.int(st.o.area), r: f.km(st.r), circle: f.int(circle), ratio: f.fixed(circle / st.o.area, 1),
      overlap: st.r * 2 > d ? dg.overlapYes : dg.overlapNo }));
    fig.redraw();
  };
  const rs = slider({ label: dg.slider, min: 5, max: 500, step: 5, value: st.r, fmt: f.km, name: 'radius', onInput: (v) => { st.r = v; update(); } });
  const tg = toggle({ label: dg.resLabel, name: 'res', value: 'g', options: opts.map((o) => ({ id: o.id, label: o.res === null ? tpl(dg.globalOpt, { r: f.km(o.radius) }) : tpl(dg.regionalOpt, { res: o.res, r: f.km(o.radius) }) })),
    onChange: (id) => { st.o = opts.find((o) => o.id === id); st.r = st.o.radius; rs.set(st.r); update(); } });
  fig.controls.append(tg.el, rs.el);
  fig.setDraw(draw);
  update();
  return () => fig.destroy();
}
