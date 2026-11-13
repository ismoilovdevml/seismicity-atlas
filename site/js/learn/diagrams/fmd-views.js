// One real FMD drawn four ways: non-cumulative or cumulative counts, on a linear or a logarithmic count axis.

import { figure, frame, toggle, svgEl, label, cumulative, tpl } from '../kit.js';
import { t } from '../../i18n/index.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const fmd = ex.fmd;
  const cum = cumulative(fmd);
  const st = { kind: 'cum', scale: 'log' };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const draw = (W) => {
    const H = 260;
    const pts = (st.kind === 'cum' ? cum : fmd).filter(([, n]) => st.scale === 'lin' || n > 0);
    const ymax = Math.max(...pts.map(([, n]) => n));
    const log = st.scale === 'log';
    const F = frame({ W, H, x: { domain: [fmd[0][0] - 0.1, fmd[fmd.length - 1][0] + 0.1], label: t('learn.dg.magnitude') },
      y: { domain: log ? [0.7, ymax * 1.6] : [0, ymax * 1.08], log, label: st.kind === 'cum' ? dg.yCum : dg.yNon }, alt: dg.alt });
    const y0 = log ? F.ys(0.7) : F.ys(0);
    if (st.kind === 'non') {
      const bw = Math.max(1, F.xs(0.1) - F.xs(0) - 1.5);
      for (const [m, n] of pts) if (n > 0) svgEl('rect', { x: F.xs(m) - bw / 2, y: F.ys(n), width: bw, height: y0 - F.ys(n), class: 'bar', rx: 1.5 }, F.plot);
    } else {
      for (const [m, n] of pts) svgEl('circle', { cx: F.xs(m), cy: F.ys(Math.max(n, log ? 0.7 : 0)), r: 3.5, class: 'dot', style: '--c:var(--s1)' }, F.plot);
    }
    const xc = F.xs(ex.mc - 0.05);
    svgEl('line', { x1: xc, x2: xc, y1: F.m.t, y2: H - F.m.b, class: 'rule dashed' }, F.top);
    label(F.top, xc + 5, F.m.t + 12, `Mc ${f.mag(ex.mc)}`, 'lbl strong');
    return F.svg;
  };
  const say = () => fig.say(tpl(dg[`read_${st.kind}_${st.scale}`], {}));
  const a = toggle({ label: dg.kindLabel, name: 'kind', value: st.kind, options: [{ id: 'non', label: dg.non }, { id: 'cum', label: dg.cum }], onChange: (v) => { st.kind = v; say(); fig.redraw(); } });
  const b = toggle({ label: dg.scaleLabel, name: 'scale', value: st.scale, options: [{ id: 'lin', label: dg.lin }, { id: 'log', label: dg.log }], onChange: (v) => { st.scale = v; say(); fig.redraw(); } });
  fig.controls.append(a.el, b.el);
  fig.setDraw(draw);
  say();
  fig.table([t('learn.dg.magnitude'), dg.yNon, dg.yCum], fmd.map(([m, n], i) => [f.mag(m), f.int(n), f.int(cum[i][1])]));
  return () => fig.destroy();
}
