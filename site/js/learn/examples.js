// Real examples for the concept pages. Everything here is read from site/data at run time, so the numbers follow
// the monthly data refresh. Examples are chosen by a rule (for example "the quality-A cell with the most events in
// the Tonga-Kermadec box"), never by a fixed number, and each rule has a fallback when the data change.
//
// Each loader returns { vars, map, data }:
//   vars: formatted strings for the {placeholders} in the content text (escaped by the renderer)
//   map:  a URL hash that shows the example on the map, or null
//   data: raw values for the diagram

import { getJSON } from '../data.js';
import * as f from '../fmt.js';
import { maxc, median, cumulative } from './kit.js';
import { recordingRating, RATINGS } from '../places.js';

const cellsP = () => getJSON('cells.geojson').then((g) => g.features.map((ft) => ft.properties));
const manifestP = () => getJSON('manifest.json');

/** A map URL hash without a language, so the language in use is kept. */
export function mapHash({ l = 'b', d = 'sh', c = null, r = null, ev = 0, y = null, pl = 1, at = null } = {}) {
  const p = new URLSearchParams();
  p.set('v', 'map');
  p.set('l', l);
  p.set('d', d);
  if (c) p.set('c', c);
  if (r) p.set('r', r);
  if (ev) p.set('ev', String(ev));
  if (ev && y) p.set('y', y);
  if (!pl) p.set('pl', '0');
  if (at) p.set('at', `${at[0]}/${(+at[1]).toFixed(2)}/${(+at[2]).toFixed(2)}`);
  return `#${p.toString().replace(/%2F/g, '/')}`;
}

const inTongaKermadec = (p) => p.lat >= -38 && p.lat <= -14 && (p.lon >= 172 || p.lon <= -170);
const byDesc = (k) => (a, b) => (b[k] ?? -1) - (a[k] ?? -1);

/** The illustrative well-sampled cell: quality A, most events above threshold, in the Tonga-Kermadec box if any. */
async function mainCell(d = 'sh') {
  const cells = await cellsP();
  const q = `${d}_q`, nb = `${d}_nb`;
  const local = cells.filter((p) => p[q] === 'A' && p.detail && inTongaKermadec(p)).sort(byDesc(nb));
  const any = cells.filter((p) => p[q] === 'A' && p.detail).sort(byDesc(nb));
  const p = local[0] || any[0];
  const detail = await getJSON(`cells/${p.id}.json`);
  return { p, detail, cells };
}

const cellVars = (p, d = 'sh') => ({
  loc: f.latlon(p.lat, p.lon),
  b: f.b2(p[`${d}_b`]), lo: f.b2(p[`${d}_b_lo`]), hi: f.b2(p[`${d}_b_hi`]),
  ciw: f.b2(p[`${d}_ciw`]), nb: f.int(p[`${d}_nb`]), n: f.int(p[`${d}_n`]), q: p[`${d}_q`],
  mc: f.mag(p[`${d}_mc`]), mcLo: f.mag(p[`${d}_mc_lo`]), mcHi: f.mag(p[`${d}_mc_hi`]),
  pb: f.pbName(p.pb), area: f.int(p.area_km2),
});
const cellMap = (p, l = 'b', d = 'sh') => mapHash({ l, d, c: p.id, at: [4, p.lat, p.lon] });

/** Shown cells (quality A/B) of a depth class. */
const shown = (cells, d = 'sh') => cells.filter((p) => ['A', 'B'].includes(p[`${d}_q`]));

function tohoku(seqs) {
  return seqs.find((s) => /tohoku/i.test(s.place)) || seqs.filter((s) => s.quality === 'A').sort((a, b) => b.mag - a.mag)[0] || seqs[0];
}
/** A sequence name without a leading year (the text adds the year itself). */
const seqName = (s) => s.place.replace(/^\d{4}\s+/, '');
const seqMap = (s) => mapHash({ l: 'none', ev: 6, y: `${s.time.slice(0, 4)}-${s.time.slice(0, 4)}`, at: [4, s.lat, s.lon] });
const decYear = (iso) => {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1);
  return y + (d.getTime() - a) / (b - a);
};
function distKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** The largest later event within the sequence window (radius, 365 days) in the M >= 6 event layer. */
function largestAftershock(s, ev) {
  const t0 = decYear(s.time);
  let main = -1, bestScore = Infinity;
  for (let i = 0; i < ev.n; i++) {
    if (Math.abs(ev.year[i] - t0) > 0.003) continue;
    const dk = distKm(s.lat, s.lon, ev.lat[i], ev.lon[i]);
    if (dk > 150) continue;
    const score = Math.abs(ev.mag[i] - s.mag) * 100 + dk / 10;
    if (score < bestScore) { bestScore = score; main = i; }
  }
  let best = null;
  for (let i = 0; i < ev.n; i++) {
    if (i === main) continue;
    const dt = ev.year[i] - t0;
    if (dt < -0.0015 || dt > 1) continue;
    if (distKm(s.lat, s.lon, ev.lat[i], ev.lon[i]) > s.radius_km) continue;
    if (!best || ev.mag[i] > best.mag) best = { mag: ev.mag[i], i };
  }
  return best;
}

export const EXAMPLES = {
  async 'magnitude-types'() {
    const [ev, seq] = await Promise.all([getJSON('events_m6.json'), getJSON('sequences.json')]);
    const cnt = [0, 0, 0, 0, 0];
    for (const m of ev.mt) cnt[m] = (cnt[m] || 0) + 1;
    const s = tohoku(seq.sequences);
    return {
      vars: { n: f.int(ev.n), iscgem: f.int(cnt[0]), mwtype: f.int(cnt[1]), mbproxy: f.int(cnt[2]), msproxy: f.int(cnt[3]), other: f.int(cnt[4]),
        place: seqName(s), mag: f.mag(s.mag), magtype: s.magtype, year: s.time.slice(0, 4) },
      map: mapHash({ l: 'none', ev: 6 }),
      data: { cnt },
    };
  },

  async 'direct-vs-proxy-mw'() {
    const [g, man] = await Promise.all([getJSON('global.json'), manifestP()]);
    const rows = g.b_cutoff_2004_2021;
    const r0 = rows[0];
    const agree = rows.find((r) => Math.abs(r.comcat_proxy[0] - r.iscgem[0]) < 0.03) || rows[rows.length - 1];
    const gs = man.global.b_shallow_1976_2021;
    return {
      vars: { cut0: f.mag(r0.cutoff), bProxy: f.b3(r0.comcat_proxy[0]), bNative: f.b3(r0.comcat_native[0]), bIsc: f.b3(r0.iscgem[0]),
        nProxy: f.int(r0.comcat_proxy[2]), agreeCut: f.mag(agree.cutoff), sample: man.method.b_sample, period: man.method.b_catalogue,
        gB: f.b3(gs.b), gLo: f.b3(gs.ci95[0]), gHi: f.b3(gs.ci95[1]), gN: f.int(gs.n_b), magerr: f.fixed(man.method.b_magerr_max, 2) },
      map: mapHash({ l: 'b' }),
      data: { rows },
    };
  },

  async 'magnitude-of-completeness'() {
    const [{ p, detail }, man, reg] = await Promise.all([mainCell(), manifestP(), getJSON('regional/index.json').catch(() => ({ regions: [] }))]);
    const fl = man.method.floors.sh;
    const keys = Object.keys(fl).sort();
    const it = (reg.regions || []).find((r) => r.id === 'italy') || (reg.regions || [])[0];
    const fmd = detail.sh.fmd_iscgem;
    return {
      vars: { ...cellVars(p), maxc: f.mag(maxc(fmd)), mcCc: f.mag(p.sh_mc_cc), mcCc0: f.mag(p.sh_mc_cc0),
        per0: keys[0].replace('-', '–'), floor0: f.mag(fl[keys[0]].floor), per1: keys[keys.length - 1].replace('-', '–'), floor1: f.mag(fl[keys[keys.length - 1]].floor),
        region: it ? it.name : '–', regionMc: it ? f.mag(it.mc_typical) : '–', regionMag: it ? ((it.magtype.match(/\b(ML\w*|Md|Mw|M)\b/) || [it.magtype])[0]) : '–' },
      map: cellMap(p, 'mc'),
      data: { fmd, mc: p.sh_mc, b: p.sh_b },
    };
  },

  async 'frequency-magnitude-distribution'() {
    const { p, detail } = await mainCell();
    const fmd = detail.sh.fmd_iscgem;
    const cum = cumulative(fmd);
    const at = (m) => (cum.find(([x]) => Math.abs(x - m) < 1e-6) || [m, 0])[1];
    const top = [...fmd].reverse().find(([, n]) => n > 0);
    const m1 = Math.round((p.sh_mc + 1) * 10) / 10;
    return {
      vars: { ...cellVars(p), total: f.int(detail.sh.stats.n_sample), mMax: f.mag(top[0]), nMc: f.int(at(p.sh_mc)), m1: f.mag(m1), nM1: f.int(at(m1)),
        mFirst: f.mag(fmd[0][0]), nFirst: f.int(fmd[0][1]) },
      map: cellMap(p, 'b'),
      data: { fmd, mc: p.sh_mc, b: p.sh_b },
    };
  },

  async 'gutenberg-richter-b-value'() {
    const [{ p, detail }, man] = await Promise.all([mainCell(), manifestP()]);
    const gs = man.global.b_shallow_1976_2021, gd = man.global.b_deep_1976_2021;
    return {
      vars: { ...cellVars(p), ratio: f.sig2(10 ** p.sh_b), gB: f.b3(gs.b), gLo: f.b3(gs.ci95[0]), gHi: f.b3(gs.ci95[1]),
        dB: f.b3(gd.b), dLo: f.b3(gd.ci95[0]), dHi: f.b3(gd.ci95[1]) },
      map: cellMap(p, 'b'),
      data: { fmd: detail.sh.fmd_iscgem, mc: p.sh_mc, b: p.sh_b },
    };
  },

  async 'confidence-interval-bootstrap'() {
    const [{ p, detail }, man] = await Promise.all([mainCell(), manifestP()]);
    return {
      vars: { ...cellVars(p), nboot: f.int(man.method.nboot) },
      map: cellMap(p, 'b'),
      data: { fmd: detail.sh.fmd_iscgem, mc: p.sh_mc, b: p.sh_b, lo: p.sh_b_lo, hi: p.sh_b_hi, nboot: man.method.nboot },
    };
  },

  async 'recording-rating'() {
    const [cells, man] = await Promise.all([cellsP(), manifestP()]);
    const gMc = man.global.b_shallow_1976_2021.mc;
    const cnt = Object.fromEntries(RATINGS.map((r) => [r, 0]));
    const byRating = Object.fromEntries(RATINGS.map((r) => [r, []]));
    for (const p of cells) { const r = recordingRating(p, gMc); cnt[r]++; byRating[r].push(p); }
    const v = byRating.vgood.sort(byDesc('sh_nb'))[0];
    const l = byRating.limited.sort(byDesc('sh_n'))[0];
    const num = (s) => { const m = String(s).match(/\d+(?:\.\d+)?/g); return m ? +m[m.length - 1] : null; };
    const area = cells.reduce((a, p) => a + p.area_km2, 0) / cells.length;
    const place = v || l || cells[0];
    return {
      vars: { nAll: f.int(cells.length), nV: f.int(cnt.vgood), nG: f.int(cnt.good), nL: f.int(cnt.limited), nF: f.int(cnt.few),
        vLoc: v ? f.latlon(v.lat, v.lon) : '–', vQ: v ? v.sh_q : '–', vMc: v ? f.mag(v.sh_mc) : '–',
        lLoc: l ? f.latlon(l.lat, l.lon) : '–', lQ: l ? l.sh_q : '–',
        gMc: f.mag(gMc), mcMax: f.mag(gMc + 0.2), nMin: f.int(num(man.method.quality.insufficient)), area: f.int(Math.round(area / 1000) * 1000) },
      // the example opens in the Simple view, with the place card on the Very good cell
      map: `#v=map&mode=simple&p=${place.lat.toFixed(3)}/${place.lon.toFixed(3)}`,
      data: { counts: cnt, gMc },
    };
  },
  async 'quality-codes'() {
    const [cells, man] = await Promise.all([cellsP(), manifestP()]);
    const cnt = { A: 0, B: 0, C: 0, insufficient: 0 };
    for (const p of cells) cnt[p.sh_q] = (cnt[p.sh_q] || 0) + 1;
    const top = (q, k = 'sh_nb') => cells.filter((p) => p.sh_q === q).sort(byDesc(k))[0];
    const A = top('A'), B = top('B'), C = top('C', 'sh_n'), I = top('insufficient', 'sh_n');
    const qr = man.method.quality;
    const num = (s) => { const m = String(s).match(/\d+(?:\.\d+)?/g); return m ? +m[m.length - 1] : null; };
    const wA = num(qr.A), wB = num(qr.B), nMin = num(qr.insufficient);
    const ex = (p) => (p ? { loc: f.latlon(p.lat, p.lon), ciw: f.b2(p.sh_ciw), nb: f.int(p.sh_nb), b: f.b2(p.sh_b) } : {});
    return {
      vars: { nA: f.int(cnt.A), nB: f.int(cnt.B), nC: f.int(cnt.C), nI: f.int(cnt.insufficient), nAll: f.int(cells.length),
        wA: f.b2(wA), wB: f.b2(wB), nMin: f.int(nMin),
        aLoc: ex(A).loc, aCiw: ex(A).ciw, aNb: ex(A).nb, aB: ex(A).b,
        bLoc: ex(B).loc, bCiw: ex(B).ciw, bNb: ex(B).nb, bB: ex(B).b,
        cLoc: ex(C).loc, cCiw: ex(C).ciw, cNb: ex(C).nb,
        iLoc: ex(I).loc, iNb: ex(I).nb },
      map: C ? cellMap(C, 'q') : mapHash({ l: 'q' }),
      data: { wA, wB, nMin, b: A ? A.sh_b : 1, examples: { A, B, C, I } },
    };
  },

  async 'b-positive'() {
    const { p, cells } = await mainCell();
    const s = shown(cells).filter((c) => c.sh_bpos != null);
    const inside = s.filter((c) => c.sh_bpos >= c.sh_b_lo && c.sh_bpos <= c.sh_b_hi).length;
    return {
      vars: { ...cellVars(p), bpos: f.b2(p.sh_bpos), bposLo: f.b2(p.sh_bpos_lo), bposHi: f.b2(p.sh_bpos_hi),
        nShown: f.int(s.length), share: String(Math.round((100 * inside) / Math.max(1, s.length))), med: f.signed(median(s.map((c) => c.sh_bpos - c.sh_b)), 3) },
      map: cellMap(p, 'b'),
      data: {},
    };
  },

  async 'declustering'() {
    const { p, cells } = await mainCell();
    const s = shown(cells).filter((c) => c.sh_bdecl != null);
    return {
      vars: { ...cellVars(p), bdecl: f.b2(p.sh_bdecl), bdeclLo: f.b2(p.sh_bdecl_lo), bdeclHi: f.b2(p.sh_bdecl_hi),
        nShown: f.int(s.length), med: f.signed(median(s.map((c) => c.sh_bdecl - c.sh_b)), 3),
        lower: f.int(s.filter((c) => c.sh_bdecl < c.sh_b).length) },
      map: cellMap(p, 'b'),
      data: {},
    };
  },

  async 'omori-utsu'() {
    const seq = await getJSON('sequences.json');
    const s = tohoku(seq.sequences);
    const sc = seq.synthetic_check;
    const nq = (q) => seq.sequences.filter((x) => x.quality === q).length;
    return {
      vars: { place: seqName(s), mag: f.mag(s.mag), year: s.time.slice(0, 4), K: f.sig2(s.K), c: s.c_resolved ? f.sig2(s.c) : '–', p: f.b2(s.p),
        sp: s.sp != null ? f.b2(s.sp) : '–', nFit: f.int(s.n_fit), mcat: f.mag(s.mcat), radius: f.km(s.radius_km), q: s.quality,
        nSeq: f.int(seq.sequences.length), nA: f.int(nq('A')), nB: f.int(nq('B')), pTrue: f.b2(sc.p_true), pMean: f.b3(sc.p_mean), pSd: f.b3(sc.p_sd_between),
        cRes: String(!!s.c_resolved) },
      map: seqMap(s),
      data: { s },
    };
  },

  async 'aftershock-productivity-bath'() {
    const [seq, ev] = await Promise.all([getJSON('sequences.json'), getJSON('events_m6.json')]);
    const rows = [];
    for (const s of seq.sequences) {
      const a = largestAftershock(s, ev);
      rows.push({ s, a: a ? a.mag : null, d: a ? +(s.mag - a.mag).toFixed(2) : null });
    }
    const withA = rows.filter((r) => r.d !== null);
    const T = tohoku(seq.sequences);
    const tr = rows.find((r) => r.s === T);
    return {
      vars: { nSeq: f.int(rows.length), nWith: f.int(withA.length), med: f.fixed(median(withA.map((r) => r.d)), 2),
        place: seqName(T), mag: f.mag(T.mag), aMag: tr && tr.a !== null ? f.mag(tr.a) : '–', dM: tr && tr.d !== null ? f.fixed(tr.d, 1) : '–',
        K: f.sig2(T.K), p: f.b2(T.p), bSeq: f.b2(T.b_seq), mcat: f.mag(T.mcat) },
      map: seqMap(T),
      data: { rows, T },
    };
  },

  async 'h3-cells-and-sample-radius'() {
    const [{ p, cells }, man, reg] = await Promise.all([mainCell(), manifestP(), getJSON('regional/index.json').catch(() => ({ regions: [] }))]);
    const r = man.method.sample_radius_km;
    const circle = Math.PI * r * r;
    // One regional catalogue per (resolution, radius) pair, the smallest file, for a measured median cell area.
    const groups = new Map();
    for (const x of reg.regions || []) {
      const k = `${x.h3_res}:${x.radius_km}`;
      if (!groups.has(k) || x.bytes < groups.get(k).bytes) groups.set(k, x);
    }
    const resList = await Promise.all([...groups.values()].sort((a, b) => a.h3_res - b.h3_res).map(async (x) => {
      const g = await getJSON(x.cells);
      return { res: x.h3_res, radius: x.radius_km, area: median(g.features.map((ft) => ft.properties.area_km2).filter((v) => v > 0)), name: x.name };
    }));
    return {
      vars: { loc: f.latlon(p.lat, p.lon), area: f.int(p.area_km2), radius: f.int(r), circle: f.int(circle), ratio: f.fixed(circle / p.area_km2, 1),
        nCells: f.int(cells.length), res: man.method.cells,
        regList: resList.map((x) => `${x.res} / ${f.km(x.radius)}`).join(', ') || '–', globalRes: man.method.cells.replace(/\D+/g, '') },
      map: cellMap(p, 'b'),
      data: { area: p.area_km2, radius: r, resList },
    };
  },

  async 'plate-boundary-classes'() {
    const g = await getJSON('global.json');
    const pb = g.plate_boundary_types;
    const rows = Object.entries(pb).map(([k, v]) => ({ k, b: v.b, lo: v.ci95[0], hi: v.ci95[1], n: v.n_b }));
    const hi = [...rows].sort((a, b) => b.b - a.b)[0];
    const lo = [...rows].sort((a, b) => a.b - b.b)[0];
    const fm = (r) => f.interval(r.b, r.lo, r.hi, f.b3);
    return {
      vars: { hiName: f.pbName(hi.k), hiCode: hi.k, hiB: fm(hi), loName: f.pbName(lo.k), loCode: lo.k, loB: fm(lo),
        subB: pb.SUB ? fm({ b: pb.SUB.b, lo: pb.SUB.ci95[0], hi: pb.SUB.ci95[1] }) : '–', nClasses: f.int(rows.length) },
      map: mapHash({ l: 'b', pl: 1, at: [2, -15, -175] }),
      data: { rows },
    };
  },

  async 'depth-and-slabs'() {
    const [ev, man] = await Promise.all([getJSON('events_m6.json'), manifestP()]);
    // A west-east profile across the Tonga trench, events between 16 and 24 degrees south.
    const lat0 = -20, pts = [];
    for (let i = 0; i < ev.n; i++) {
      const la = ev.lat[i];
      let lo = ev.lon[i];
      if (la < -24 || la > -16) continue;
      if (lo < 0) lo += 360;
      if (lo < 172 || lo > 190) continue;
      const x = (lo - 186) * 111.32 * Math.cos((lat0 * Math.PI) / 180); // km east of 174 W
      pts.push({ x, z: ev.depth[i], m: ev.mag[i], y: ev.year[i] });
    }
    pts.sort((a, b) => a.y - b.y);
    const deep = pts.filter((q) => q.z > 70);
    const deepest = pts.reduce((a, q) => (q.z > a.z ? q : a), pts[0] || { z: 0 });
    const gs = man.global.b_shallow_1976_2021, gd = man.global.b_deep_1976_2021;
    return {
      vars: { n: f.int(pts.length), nDeep: f.int(deep.length), deepest: f.km(deepest.z), deepestM: f.mag(deepest.m),
        gB: f.b3(gs.b), dB: f.b3(gd.b), dLo: f.b3(gd.ci95[0]), dHi: f.b3(gd.ci95[1]), y0: String(Math.floor(pts[0] ? pts[0].y : 0)), y1: String(Math.floor(pts.length ? pts[pts.length - 1].y : 0)) },
      map: mapHash({ l: 'b', d: 'dp', ev: 6, at: [4, -20, -177] }),
      data: { pts },
    };
  },

  async 'rate-m6'() {
    const { p, cells } = await mainCell();
    const pos = cells.filter((c) => c.rate_m6 > 0);
    const top = [...cells].sort(byDesc('rate_m6'))[0];
    return {
      vars: { loc: f.latlon(p.lat, p.lon), rate: f.sig2(p.rate_m6), area: f.int(p.area_km2), perYear: f.sig2((p.rate_m6 * p.area_km2) / 1e5),
        nPos: f.int(pos.length), nAll: f.int(cells.length), med: f.sig2(median(pos.map((c) => c.rate_m6))),
        topLoc: f.latlon(top.lat, top.lon), topRate: f.sig2(top.rate_m6) },
      map: cellMap(p, 'rate'),
      data: { rates: pos.map((c) => c.rate_m6), mine: p.rate_m6 },
    };
  },

  async 'catalogue-consistency'() {
    const cells = await cellsP();
    const cnt = { ok: 0, check: 0, few: 0 };
    for (const c of cells) cnt[c.c_flag] = (cnt[c.c_flag] || 0) + 1;
    const p = cells.filter((c) => c.c_flag === 'ok').sort(byDesc('c_n'))[0];
    const valid = cells.filter((c) => c.c_n >= 10);
    return {
      vars: { loc: f.latlon(p.lat, p.lon), cn: f.int(p.c_n), dmw: f.signed(p.c_dmw, 2), dmb: f.signed(p.c_dmb, 2), dloc: f.km(p.c_dloc), ddep: f.signed(p.c_ddep, 1),
        gonly: f.int(p.c_gonly), conly: f.int(p.c_conly), ok: f.int(cnt.ok), check: f.int(cnt.check), few: f.int(cnt.few),
        medDmb: f.signed(median(valid.map((c) => c.c_dmb).filter((v) => v != null)), 2), medDmw: f.signed(median(valid.map((c) => c.c_dmw).filter((v) => v != null)), 2), nValid: f.int(valid.length) },
      map: cellMap(p, 'cc'),
      data: { dmw: valid.map((c) => c.c_dmw).filter((v) => v != null), dmb: valid.map((c) => c.c_dmb).filter((v) => v != null), mine: { dmw: p.c_dmw, dmb: p.c_dmb } },
    };
  },

  async 'regional-catalogues'() {
    const [reg, man] = await Promise.all([getJSON('regional/index.json'), manifestP()]);
    const regions = reg.regions || [];
    const it = regions.find((r) => r.id === 'italy') || regions[0];
    const fl = man.method.floors.sh;
    const last = Object.keys(fl).sort().pop();
    return {
      vars: { nReg: f.int(regions.length), names: regions.map((r) => r.name).join(', '), name: it.name, catalogue: it.catalogue, licence: it.licence,
        magtype: it.magtype, mc: f.mag(it.mc_typical), res: String(it.h3_res), radius: f.km(it.radius_km), nEv: f.int(it.n_events),
        period: `${it.period[0].slice(0, 4)}–${it.period[1].slice(0, 4)}`, floor: f.mag(fl[last].floor), floorPer: last.replace('-', '–'),
        ratio: f.int(+(10 ** (1.5 * (fl[last].floor - it.mc_typical))).toPrecision(2)) },
      map: mapHash({ l: 'b', r: it.id, at: [5, (it.bbox[1] + it.bbox[3]) / 2, (it.bbox[0] + it.bbox[2]) / 2] }),
      data: { regions, floor: fl[last].floor },
    };
  },

  async 'not-a-forecast'() {
    const { p, detail } = await mainCell();
    const counts = detail.sh.rate_comcat_m45;
    const [y0] = detail.sh.rate_years;
    const full = counts.slice(0, -1); // the last year is partial
    const mean = full.reduce((a, b) => a + b, 0) / full.length;
    const mx = Math.max(...full), mn = Math.min(...full);
    return {
      vars: { loc: f.latlon(p.lat, p.lon), mean: f.int(mean), min: f.int(mn), max: f.int(mx), yMax: String(y0 + full.indexOf(mx)), yMin: String(y0 + full.indexOf(mn)),
        y0: String(y0), y1: String(y0 + full.length - 1), perYear: f.sig2((p.rate_m6 * p.area_km2) / 1e5) },
      map: cellMap(p, 'rate'),
      data: { counts: full, y0, mean },
    };
  },
};
