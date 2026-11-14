// The Simple-view recording rating: three inputs (quality code, catalogue check, Mc) give one of four words.
// The rule is recordingRating() in site/js/places.js, the same function the place card uses. The bars count the
// real cells with each rating (shallow statistics, cells.geojson).

import { figure, frame, slider, toggle, svgEl, label, tpl } from '../kit.js';
import { recordingRating, RATINGS } from '../../places.js';
import { t } from '../../i18n/index.js';
import * as f from '../../fmt.js';

export default function mount(el, { dg, ex }) {
  const { counts, gMc } = ex;
  const st = { q: 'A', flag: 'ok', mc: gMc };
  const fig = figure(el, { title: dg.title, caption: dg.caption, alt: dg.alt });
  const word = (r) => t(`sx.rate.${r}`);
  const current = () => recordingRating({ sh_q: st.q, c_flag: st.flag, sh_mc: st.q === 'insufficient' ? undefined : st.mc }, gMc);

  const draw = (W) => {
    const rowH = 34;
    const H = RATINGS.length * rowH + 52;
    const max = Math.max(...RATINGS.map((r) => counts[r]), 1);
    const lw = Math.min(150, Math.round(W * 0.34));
    const F = frame({ W, H, m: { t: 10, b: 40, l: lw, r: 56 }, x: { domain: [0, max], label: dg.xLabel, fmt: (v) => f.int(v) }, y: { domain: [0, RATINGS.length], hide: true }, alt: dg.alt });
    const cur = current();
    RATINGS.forEach((r, i) => {
      const y = F.m.t + i * rowH + 6;
      const x0 = F.xs(0), x1 = F.xs(counts[r]);
      const on = r === cur;
      svgEl('rect', { x: x0, y, width: Math.max(2, x1 - x0), height: rowH - 14, rx: 3, class: on ? 'bar' : 'bar off', style: on ? 'fill:var(--accent)' : 'fill:var(--ink-3)', 'data-rating': r }, F.plot);
      label(F.top, F.m.l - 8, y + (rowH - 14) / 2 + 4, word(r), on ? 'lbl strong' : 'lbl', 'end');
      label(F.top, x1 + 6, y + (rowH - 14) / 2 + 4, f.int(counts[r]), 'lbl mono');
    });
    return F.svg;
  };

  const update = () => {
    const r = current();
    const flag = { ok: dg.flagOk, check: dg.flagCheck, few: dg.flagFew }[st.flag];
    fig.say(tpl(dg.readout, { q: st.q === 'insufficient' ? dg.insufficient : st.q, flag, mc: st.q === 'insufficient' ? '–' : f.mag(st.mc), rating: word(r) }));
    fig.fig.dataset.rating = r;
    mcSlider.input.disabled = st.q === 'insufficient';
    fig.redraw();
  };

  const qT = toggle({ label: dg.q, name: 'q', value: st.q, options: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }, { id: 'insufficient', label: dg.insufficient }], onChange: (v) => { st.q = v; update(); } });
  const fT = toggle({ label: dg.flag, name: 'flag', value: st.flag, options: [{ id: 'ok', label: dg.flagOk }, { id: 'check', label: dg.flagCheck }, { id: 'few', label: dg.flagFew }], onChange: (v) => { st.flag = v; update(); } });
  const mcSlider = slider({ label: dg.mc, min: 5.0, max: 6.3, step: 0.1, value: gMc, fmt: (v) => f.mag(v), name: 'mc', onInput: (v) => { st.mc = Math.round(v * 10) / 10; update(); } });
  fig.controls.append(qT.el, fT.el, mcSlider.el);
  fig.setDraw(draw);
  fig.table([dg.colRating, dg.colCells], RATINGS.map((r) => [word(r), f.int(counts[r])]));
  update();
  return () => fig.destroy();
}
