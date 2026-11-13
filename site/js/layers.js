// Cell layer definitions. Each definition drives three things from one place: the MapLibre paint
// expressions, the legend (with cell counts) and the classifier used for the counts.

import { sequential, diverging, oklch, HUE } from './color.js';
import { ruleNumber } from './data.js';

// Consistency thresholds of c_flag, as defined in docs/data-schema.md.
export const CC_RULES = { minPairs: 10, dmw: 0.10, dlocKm: 30, unmatchedShare: 0.10 };

export const LAYER_NAMES = {
  b: 'b-value', q: 'Data quality for b', mc: 'Completeness, Mc', cc: 'Catalogue agreement', rate: 'Rate of M6+ earthquakes', none: 'No cell layer',
};

export const SUBS = {
  mc: [
    { id: 'ig', label: 'ISC-GEM, Mw (1976–2021)' },
    { id: 'cc', label: 'ComCat as served, 2010 to cut-off' },
    { id: 'cc0', label: 'ComCat as served, 1973–1989' },
  ],
  cc: [
    { id: 'flag', label: 'Overall agreement' },
    { id: 'dmw', label: 'Mw difference, ComCat − ISC-GEM' },
    { id: 'dloc', label: 'Epicentre difference' },
  ],
};

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
  const out = [`below ${fmtBreak(breaks[0], d)}${u}`];
  for (let i = 0; i < breaks.length - 1; i++) out.push(`${fmtBreak(breaks[i], d)}–${fmtBreak(breaks[i + 1], d)}${u}`);
  out.push(`${fmtBreak(breaks[breaks.length - 1], d)}${u} and above`);
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
  const washItem = (label, short = 'No value') => ({ swatch: 'wash', label, short, key: 'wash' });
  const hatchItem = (label) => ({ swatch: 'hatch', label, short: 'C: withheld', key: 'hatch' });
  const base = { depthAware: true, hatch: false };

  if (st.l === 'b') {
    const breaks = [0.8, 0.9, 1.0, 1.1, 1.2];
    const colors = diverging(HUE.low, HUE.high, 3, dark);
    const valid = ['in', ['get', `${d}_q`], ['literal', ['A', 'B']]];
    return {
      ...base, hatch: true,
      title: 'b-value, Gutenberg-Richter',
      unit: `${manifest.method.b_catalogue}, events within ${radius} km of the cell centre. Classes are centred on b = 1.`,
      note: `Coloured only where quality is A or B (95 % interval up to ${qB.toFixed(2)} wide). Hover a cell for b with its interval.`,
      items: [
        ...stepLabels(breaks, 2).map((label, i) => ({ color: colors[i], label, key: i })),
        hatchItem(`Quality C: interval wider than ${qB.toFixed(2)}, b withheld`),
        washItem(`Insufficient: fewer than ${nMin} events above Mc`, 'Insufficient'),
      ],
      fill: ['case', valid, stepExpr(`${d}_b`, breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p[`${d}_q`] === 'A' || p[`${d}_q`] === 'B' ? stepIndex(p[`${d}_b`], breaks) : p[`${d}_q`] === 'C' ? 'hatch' : 'wash'),
    };
  }

  if (st.l === 'q') {
    const cA = dark ? oklch(0.74, 0.11, HUE.quality) : oklch(0.46, 0.10, HUE.quality);
    const cB = dark ? oklch(0.52, 0.08, HUE.quality) : oklch(0.72, 0.08, HUE.quality);
    const valid = ['in', ['get', `${d}_q`], ['literal', ['A', 'B']]];
    return {
      ...base, hatch: true,
      title: 'Data quality for b',
      unit: `Width of the bootstrap 95 % interval of b (${manifest.method.nboot} resamples, Mc re-estimated in each).`,
      note: 'Only A and B cells get a b-value on the map. C and insufficient are the honest result for a global M ≥ 5 catalogue, not missing work.',
      items: [
        { color: cA, label: `A: interval ≤ ${qA.toFixed(2)}`, key: 'A' },
        { color: cB, label: `B: interval ≤ ${qB.toFixed(2)}`, key: 'B' },
        hatchItem(`C: wider, b withheld`),
        washItem(`Insufficient: fewer than ${nMin} events above Mc`, 'Insufficient'),
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
    const labels = ig ? ['5.2 or less', '5.3', '5.4', '5.5', '5.6–5.7', '5.8 or more'] : ['4.7', '4.8', '4.9', '5.0–5.1', '5.2–5.4', '5.5 or more'];
    const colors = sequential(HUE.mc, 6, dark);
    const valid = ['has', prop];
    const floors = manifest.method.floors[d];
    const floorTxt = Object.entries(floors).map(([per, f]) => `${f.floor} for ${per}`).join(', ');
    return {
      ...base,
      title: ig ? 'Completeness Mc, ISC-GEM' : `Completeness Mc, ComCat ${sub === 'cc' ? '2010 to cut-off' : '1973–1989'}`,
      unit: ig
        ? `Mw, maximum curvature + 0.2, events within ${radius} km, 1976–2021. Darker means less complete.`
        : `Magnitude as served (mostly mb), maximum curvature + 0.2, events within ${radius} km. Darker means less complete.`,
      note: ig
        ? `For b, each event's threshold is never below the global floor of its period (${floorTxt}).`
        : 'The ComCat query starts at M 4.5, so this Mc cannot fall below 4.7. Not on the same scale as ISC-GEM Mw.',
      items: [
        ...labels.map((label, i) => ({ color: colors[i], label, key: i })),
        washItem('No Mc: too few events in the circle'),
      ],
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
        title: 'Catalogue agreement, ISC-GEM vs ComCat',
        unit: 'Events in both catalogues 1973–2021, matched within 30 s and 100 km, located in the cell. All depths.',
        note: `"Check" means the median Mw differs by more than ${CC_RULES.dmw.toFixed(2)}, epicentres differ by more than ${CC_RULES.dlocKm} km, or more than ${CC_RULES.unmatchedShare * 100} % of events are unmatched.`,
        items: [
          { color: cCheck, label: 'Check: the catalogues disagree', key: 'check' },
          { color: cOk, label: 'Agree', key: 'ok' },
          washItem(`Fewer than ${CC_RULES.minPairs} matched events`, 'Too few'),
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
      const lab = ['ComCat lower by more than 0.10', '0.05–0.10 lower', '0–0.05 lower', '0–0.05 higher', '0.05–0.10 higher', 'ComCat higher by more than 0.10'];
      return {
        ...base2,
        title: 'Mw difference, ComCat − ISC-GEM',
        unit: 'Median over matched events with a ComCat Mw-type magnitude, magnitude units. All depths.',
        note: `Differences beyond ±${CC_RULES.dmw.toFixed(2)} trigger "check".`,
        items: [...lab.map((label, i) => ({ color: colors[i], label, key: i })), washItem(`No Mw pairs, or fewer than ${CC_RULES.minPairs} matched events`)],
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
      title: 'Epicentre difference, ComCat vs ISC-GEM',
      unit: 'Median distance between the two locations of the same event, km. All depths.',
      note: `Medians above ${CC_RULES.dlocKm} km trigger "check".`,
      items: [...stepLabels(breaks, 0, 'km').map((label, i) => ({ color: colors[i], label, key: i })), washItem(`Fewer than ${CC_RULES.minPairs} matched events`, 'Too few')],
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
      title: 'Rate of M6+ earthquakes',
      unit: 'ISC-GEM Mw ≥ 6.0 events per year per 100,000 km² of the cell itself, 1964–2021, all depths.',
      note: 'A long-term average of past events. It is not a probability of future earthquakes.',
      items: [...stepLabels(breaks, 2).map((label, i) => ({ color: colors[i], label, key: i })), washItem('No M6+ event in 1964–2021', 'None')],
      fill: ['case', valid, stepExpr('rate_m6', breaks, colors), cssVar('--nodata')],
      valid,
      classify: (p) => (p.rate_m6 > 0 ? stepIndex(p.rate_m6, breaks) : 'wash'),
    };
  }

  return { ...base, depthAware: false, title: 'No cell layer', unit: '', note: '', items: [], fill: cssVar('--nodata'), valid: false, classify: () => null, none: true };
}
