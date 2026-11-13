// Global shallow b at fixed cutoffs, 2004-2021, for three magnitude choices (global.json, b_cutoff_2004_2021):
// ComCat with mb converted to Mw, ComCat as served (native mixed types) and ISC-GEM Mw.

import { figure, frame, slider, svgEl, label, path, legend, tpl } from '../kit.js';
import * as f from '../../fmt.js';

const SER = [
  { k: 'comcat_proxy', color: 'var(--s2)' },
  { k: 'comcat_native', color: 'var(--s3)' },
  { k: 'iscgem', color: 'var(--s1)' },
];

export default function mount(el, { dg, ex }) {
  const rows = ex.rows;
  const st = { i: 0 };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  fig.fig.insertBefore(legend(SER.map((s) => ({ label: dg[s.k], color: s.color, line: true }))), fig.plotEl);
  const draw = (W) => {
    const H = 270;
    const all = rows.flatMap((r) => SER.map((s) => [r[s.k][0] - 1.96 * r[s.k][1], r[s.k][0] + 1.96 * r[s.k][1]])).flat();
    const F = frame({ W, H, x: { domain: [rows[0].cutoff - 0.1, rows[rows.length - 1].cutoff + 0.1], label: dg.xLabel }, y: { domain: [Math.min(0.9, ...all) - 0.03, Math.max(...all) + 0.03], label: 'b' }, alt: dg.alt });
    svgEl('line', { x1: F.m.l, x2: W - F.m.r, y1: F.ys(1), y2: F.ys(1), class: 'rule' }, F.plot);
    label(F.top, W - F.m.r - 2, F.ys(1) - 5, 'b = 1', 'lbl', 'end');
    const x = F.xs(rows[st.i].cutoff);
    svgEl('line', { x1: x, x2: x, y1: F.m.t, y2: H - F.m.b, class: 'crosshair' }, F.plot);
    for (const s of SER) {
      svgEl('path', { d: path(rows.map((r) => [F.xs(r.cutoff), F.ys(r[s.k][0])])), class: 'line', style: `--c:${s.color}` }, F.plot);
      for (const r of rows) {
        const [b, sg] = r[s.k];
        svgEl('line', { x1: F.xs(r.cutoff), x2: F.xs(r.cutoff), y1: F.ys(b - 1.96 * sg), y2: F.ys(b + 1.96 * sg), class: 'ci', style: `--c:${s.color}` }, F.plot);
        svgEl('circle', { cx: F.xs(r.cutoff), cy: F.ys(b), r: r === rows[st.i] ? 5 : 3.5, class: 'dot', style: `--c:${s.color}` }, F.top);
      }
    }
    return F.svg;
  };
  const update = () => {
    const r = rows[st.i];
    fig.say(tpl(dg.readout, { cut: f.mag(r.cutoff), proxy: f.b3(r.comcat_proxy[0]), native: f.b3(r.comcat_native[0]), isc: f.b3(r.iscgem[0]) }));
    fig.redraw();
  };
  const s = slider({ label: dg.slider, min: 0, max: rows.length - 1, step: 1, value: 0, fmt: (i) => f.mag(rows[i].cutoff), name: 'cut', onInput: (v) => { st.i = v; update(); } });
  fig.controls.append(s.el);
  fig.setDraw(draw);
  update();
  fig.table([dg.xLabel, dg.comcat_proxy, dg.comcat_native, dg.iscgem], rows.map((r) => [f.mag(r.cutoff), ...SER.map((x) => `${f.b3(r[x.k][0])} ± ${f.b3(1.96 * r[x.k][1])} (n ${f.int(r[x.k][2])})`)]));
  return () => fig.destroy();
}
