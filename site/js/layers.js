// Cell layer definitions. Each definition drives three things from one place: the MapLibre paint
// expressions, the legend (with cell counts) and the classifier used for the counts.

import { sequential, diverging, oklch, HUE } from './color.js';
import { ruleNumber } from './data.js';
import { t } from './i18n/index.js';

// b palette: blue for low b, red-brown for high b, centred on b = 1. Light theme (v0.3.1): six steps of the Crameri
// Scientific colour map vik (doi:10.5281/zenodo.8409685, MIT licence) at positions 0, 0.16, 0.31 | 0.69, 0.84, 1,
// the same as scripts/crameri.py VIK_B_POS. Dark theme: the custom steps, because no Crameri diverging map passed the
// dataviz validator against the dark land colour (docs/ux-notes.md, "Crameri colour maps").
export const B_LIGHT = ['#001261', '#05528a', '#5d9cbb', '#cf8c66', '#a74310', '#590008'];
export const B_DARK = ['#4a7cc0', '#7ea3d3', '#b4c9e2', '#ebc08f', '#de9550', '#c06a30'];

// Consistency thresholds of c_flag, as defined in docs/data-schema.md.
export const CC_RULES = { minPairs: 10, dmw: 0.10, dlocKm: 30, unmatchedShare: 0.10 };

export const layerName = (l) => t(`layer.${l}.name`);

// Variants of a layer; labels come from the i18n key sub.<layer>.<id>.
export const SUBS = {
  mc: [{ id: 'ig' }, { id: 'cc' }, { id: 'cc0' }],
  cc: [{ id: 'flag' }, { id: 'dmw' }, { id: 'dloc' }],
};
export const subLabel = (l, id) => t(`sub.${l}.${id}`);

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
};

export const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const fmtBreak = (v, d) => v.toFixed(d);

/** Labels for stepped classes: below b1, b1–b2, ..., bn and above. */
function stepLabels(breaks, d, unit = '') {
  const u = unit ? ` ${unit}` : '';
  const out = [t('lg.below', { v: `${fmtBreak(breaks[0], d)}${u}` })];
  for (let i = 0; i < breaks.length - 1; i++) out.push(`${fmtBreak(breaks[i], d)}–${fmtBreak(breaks[i + 1], d)}${u}`);
  out.push(t('lg.above', { v: `${fmtBreak(breaks[breaks.length - 1], d)}${u}` }));
  return out;
}

const stepExpr = (prop, breaks, colors) => {
  const e = ['step', ['to-number', ['get', prop]], colors[0]];
  breaks.forEach((b, i) => e.push(b, colors[i + 1]));
  return e;
};

const stepIndex = (v, breaks) => {
  let i = 0;
  while (i < breaks.length && v >= breaks[i]) i++;
  return i;
};

/**
 * Build a layer definition.
 * Returns {title, unit, note, items:[{color|swatch, label}], fill, opacity, hatchFilter, depthAware, classify(p)}.
 */
export function layerDef(st, manifest) {
  const dark = isDark();
  const d = st.d;
  const q = manifest.method.quality;
  const qA = ruleNumber(q.A), qB = ruleNumber(q.B), nMin = ruleNumber(q.insufficient);
  const radius = manifest.method.sample_radius_km;
  const washItem = (label) => ({ swatch: 'wash', label, key: 'wash' });
  const hatchItem = (label) => ({ swatch: 'hatch', label, key: 'hatch' });
  const base = { depthAware: true, hatch: false };

  if (st.l === 'b') {
    const breaks = [0.8, 0.9, 1.0, 1.1, 1.2];
    const colors = dark ? B_DARK : B_LIGHT;
    const valid = ['in', ['get', `${d}_q`], ['literal', ['A', 'B']]];
    return {
      bar: { colors, breaks, d: 1 }, opacityB: true,
      passKeys: ['qA', 'qB'],
      ...base, hatch: true,
      title: t('layer.b.title'),
      unit: t('layer.b.unit', { cat: manifest.method.b_catalogue, r: radius }),
      note: t('layer.b.note', { w: qB.toFixed(2) }),
      items: [
        { color: colors[1], label: t('layer.b.qA', { w: qA.toFixed(2) }), key: 'qA' },
        { color: colors[1], op: 0.55, label: t('layer.b.qB', { w: qB.toFixed(2) }), key: 'qB' },
        hatchItem(t('layer.b.qC', { w: qB.toFixed(2) })),
        washItem(t('layer.insufficient', { n: nMin })),
      ],
      fill: ['case', valid, stepExpr(`${d}_b`, breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p[`${d}_q`] === 'A' ? 'qA' : p[`${d}_q`] === 'B' ? 'qB' : p[`${d}_q`] === 'C' ? 'hatch' : 'wash'),
    };
  }

  if (st.l === 'q') {
    const cA = dark ? oklch(0.74, 0.11, HUE.quality) : oklch(0.46, 0.10, HUE.quality);
    const cB = dark ? oklch(0.52, 0.08, HUE.quality) : oklch(0.72, 0.08, HUE.quality);
    const valid = ['in', ['get', `${d}_q`], ['literal', ['A', 'B']]];
    return {
      ...base, hatch: true,
      title: t('layer.q.title'),
      unit: t('layer.q.unit', { n: manifest.method.nboot }),
      note: t('layer.q.note'),
      items: [
        { color: cA, label: t('layer.q.A', { w: qA.toFixed(2) }), key: 'A' },
        { color: cB, label: t('layer.q.B', { w: qB.toFixed(2) }), key: 'B' },
        hatchItem(t('layer.q.C')),
        washItem(t('layer.insufficient', { n: nMin })),
      ],
      fill: ['match', ['get', `${d}_q`], 'A', cA, 'B', cB, cssVar('--nodata')],
      valid,
      classify: (p) => (p[`${d}_q`] === 'A' ? 'A' : p[`${d}_q`] === 'B' ? 'B' : p[`${d}_q`] === 'C' ? 'hatch' : 'wash'),
    };
  }

  if (st.l === 'mc') {
    const sub = st.m || 'ig';
    const prop = { ig: `${d}_mc`, cc: `${d}_mc_cc`, cc0: `${d}_mc_cc0` }[sub];
    const ig = sub === 'ig';
    const breaks = ig ? [5.25, 5.35, 5.45, 5.55, 5.75] : [4.75, 4.85, 4.95, 5.15, 5.45];
    const labels = ig ? [t('lg.orLess', { v: '5.2' }), '5.3', '5.4', '5.5', '5.6–5.7', t('lg.orMore', { v: '5.8' })] : ['4.7', '4.8', '4.9', '5.0–5.1', '5.2–5.4', t('lg.orMore', { v: '5.5' })];
    const colors = sequential(HUE.mc, 6, dark);
    const valid = ['has', prop];
    const floors = manifest.method.floors[d];
    const floorTxt = Object.entries(floors).map(([per, f]) => t('layer.mc.floorFor', { v: f.floor, per })).join(', ');
    return {
      ...base,
      title: t(`layer.mc.title.${sub}`),
      unit: t(ig ? 'layer.mc.unitIg' : 'layer.mc.unitCc', { r: radius }),
      note: ig ? t('layer.mc.noteIg', { floors: floorTxt }) : t('layer.mc.noteCc'),
      bar: { colors, breaks, d: 1, labels },
      items: [washItem(t('layer.mc.none'))],
      fill: ['case', valid, stepExpr(prop, breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p[prop] === undefined || p[prop] === null ? 'wash' : stepIndex(p[prop], breaks)),
    };
  }

  if (st.l === 'cc') {
    const sub = st.m || 'flag';
    const enough = ['>=', ['get', 'c_n'], CC_RULES.minPairs];
    const base2 = { ...base, depthAware: false };
    if (sub === 'flag') {
      const cOk = dark ? oklch(0.50, 0.05, HUE.quality) : oklch(0.80, 0.05, HUE.quality);
      const cCheck = dark ? oklch(0.70, 0.16, HUE.check) : oklch(0.60, 0.17, HUE.check);
      return {
        ...base2,
        title: t('layer.cc.title'),
        unit: t('layer.cc.unit'),
        note: t('layer.cc.note', { dmw: CC_RULES.dmw.toFixed(2), km: CC_RULES.dlocKm, pct: CC_RULES.unmatchedShare * 100 }),
        items: [
          { color: cCheck, label: t('layer.cc.check'), key: 'check' },
          { color: cOk, label: t('layer.cc.ok'), key: 'ok' },
          washItem(t('layer.cc.few', { n: CC_RULES.minPairs })),
        ],
        fill: ['match', ['get', 'c_flag'], 'check', cCheck, 'ok', cOk, cssVar('--nodata')],
        valid: ['in', ['get', 'c_flag'], ['literal', ['check', 'ok']]],
        classify: (p) => (p.c_flag === 'check' || p.c_flag === 'ok' ? p.c_flag : 'wash'),
      };
    }
    if (sub === 'dmw') {
      const breaks = [-0.1, -0.05, 0, 0.05, 0.1];
      const colors = diverging(HUE.low, HUE.high, 3, dark);
      const valid = ['all', ['has', 'c_dmw'], enough];
      return {
        ...base2,
        title: t('layer.dmw.title'),
        unit: t('layer.dmw.unit'),
        note: t('layer.dmw.note', { v: CC_RULES.dmw.toFixed(2) }),
        bar: { colors, breaks, d: 2 },
        items: [washItem(t('layer.dmw.none', { n: CC_RULES.minPairs }))],
        fill: ['case', valid, stepExpr('c_dmw', breaks, colors), cssVar('--nodata')],
        valid,
        classify: (p) => (p.c_dmw !== undefined && p.c_n >= CC_RULES.minPairs ? stepIndex(p.c_dmw, breaks) : 'wash'),
      };
    }
    const breaks = [10, 20, 30, 50];
    const colors = sequential(HUE.mc, 5, dark);
    const valid = ['all', ['has', 'c_dloc'], enough];
    return {
      ...base2,
      title: t('layer.dloc.title'),
      unit: t('layer.dloc.unit'),
      note: t('layer.dloc.note', { km: CC_RULES.dlocKm }),
      bar: { colors, breaks, d: 0 },
      items: [washItem(t('layer.cc.few', { n: CC_RULES.minPairs }))],
      fill: ['case', valid, stepExpr('c_dloc', breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p.c_dloc !== undefined && p.c_n >= CC_RULES.minPairs ? stepIndex(p.c_dloc, breaks) : 'wash'),
    };
  }

  if (st.l === 'rate') {
    const breaks = [0.02, 0.05, 0.1, 0.2, 0.5];
    const colors = sequential(HUE.rate, 6, dark);
    const valid = ['>', ['get', 'rate_m6'], 0];
    return {
      ...base, depthAware: false,
      title: t('layer.rate.title'),
      unit: t('layer.rate.unit'),
      note: t('layer.rate.note'),
      bar: { colors, breaks, d: 2 },
      items: [washItem(t('layer.rate.none'))],
      fill: ['case', valid, stepExpr('rate_m6', breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p.rate_m6 > 0 ? stepIndex(p.rate_m6, breaks) : 'wash'),
    };
  }

  return { ...base, depthAware: false, title: t('layer.none.name'), unit: '', note: '', items: [], fill: cssVar('--nodata'), valid: false, classify: () => null, none: true };
}
