// Simple view helpers that do not touch the page: the place gazetteer and its search, statistics of the recorded
// events around a point, the cell under a point and the plain-language recording rating of that cell.
// The numbers shown in the place card come only from these functions (docs/ux-notes.md, "v0.3 two-mode redesign").

import { getJSON } from './data.js';
import { distKm } from './util.js';

// ---------------------------------------------------------------- gazetteer and search

let gaz = null;

/** Fold case, accents and a few letters without a decomposition, so "zurich" finds "Zürich" and "sao" "São". */
export function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ø/g, 'o').replace(/ł/g, 'l')
    .replace(/đ/g, 'd').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ı/g, 'i').replace(/ё/g, 'е')
    .replace(/[ʻʼ'’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Load data/places.json once (lazily: on the first focus of the search box or the first map click). */
export function loadPlaces() {
  if (!gaz) {
    gaz = getJSON('places.json').then((doc) => {
      const col = Object.fromEntries(doc.columns.map((c, i) => [c, i]));
      const rows = doc.rows.map((r, i) => {
        const place = {
          i, name: r[col.n], ascii: r[col.a] || r[col.n], country: doc.countries[r[col.c]] || '', region: r[col.r] || '',
          lat: r[col.y], lon: r[col.x], pop: r[col.p], ru: r[col.ru] || '', es: r[col.es] || '',
        };
        const keys = [place.name, place.ascii, place.ru, place.es, ...String(r[col.alt] || '').split('|')].map(norm).filter(Boolean);
        place.keys = [...new Set(keys)];
        return place;
      });
      return { doc, rows };
    }).catch((e) => { gaz = null; throw e; });
  }
  return gaz;
}

/** The name of a place in the interface language, when Natural Earth has one; otherwise its own name. */
export function placeName(p, lang) {
  if (lang === 'ru' && p.ru) return p.ru;
  if (lang === 'es' && p.es) return p.es;
  return p.name;
}

/**
 * Rank by match quality, then by population (Natural Earth POP_MAX, column p of places.json):
 *   class 0  a name of the place starts with the query (the whole name, or its beginning)
 *   class 1  a word inside a name starts with it ("york" in "New York")
 *   class 2  a name contains it (queries of three or more characters)
 * Within a class the larger population comes first, and an exact name counts as ten times its population, so a
 * town called exactly what was typed beats a slightly larger town that only starts with it, but "San" lists
 * Santiago, San Francisco and San Diego before San in Mali (41,000 people). An exact match that falls outside the
 * first `limit` results takes the last places, so every place named exactly as typed stays findable.
 * Names are the published, ASCII, Russian, Spanish and alternative names, folded by norm().
 */
export function searchPlaces(rows, query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const hits = [];
  for (const p of rows) {
    let cls = 9, exact = false;
    for (const k of p.keys) {
      if (k === q) { exact = true; cls = 0; break; }
      const c = k.startsWith(q) ? 0 : k.includes(` ${q}`) ? 1 : q.length >= 3 && k.includes(q) ? 2 : 9;
      if (c < cls) cls = c;
    }
    if (cls < 9) hits.push({ p, cls, exact, w: (p.pop || 0) * (exact ? 10 : 1) });
  }
  hits.sort((a, b) => a.cls - b.cls || b.w - a.w || a.p.i - b.p.i);
  const top = hits.slice(0, limit);
  const missing = hits.slice(limit).filter((x) => x.exact);
  if (missing.length) top.splice(Math.max(0, limit - missing.length), missing.length, ...missing.slice(0, limit));
  return top.map((x) => x.p);
}

/** The listed place nearest to a point, with its distance in km. */
export function nearestPlace(rows, lat, lon) {
  let best = null, bd = Infinity;
  for (const p of rows) {
    if (Math.abs(p.lat - lat) > 3) continue;
    const d = distKm(lat, lon, p.lat, p.lon);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? { place: best, km: bd } : null;
}

// ---------------------------------------------------------------- events around a point

// Great-circle distance (haversine, spherical Earth of radius 6371 km): util.js, re-exported for the places tests.
export { distKm };

export const DEPTH_CLASSES = [70, 300]; // km: shallow ≤ 70 < intermediate ≤ 300 < deep
export const depthClass = (d) => (d <= DEPTH_CLASSES[0] ? 'sh' : d <= DEPTH_CLASSES[1] ? 'mid' : 'deep');

function medianOf(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

/**
 * Statistics of the events (events_m6.json columns) within radiusKm of a point, recorded in the years y0..y1
 * inclusive (decimal year >= y0 and < y1 + 1), of magnitude minM or more (6 by default). With minM < 6, e5 (the
 * events_m5.json columns) adds its events below M6, so the card counts what the map shows.
 * Returns { n6, n7, n5, largest, recent, medianDepth, depthClass } where n5/n6/n7 count M >= 5/6/7 (n5 only with e5),
 * and largest and recent are { m, y, d, lat, lon, id } (largest: highest magnitude, ties to the more recent; recent:
 * latest time), both among the events counted.
 */
export function placeStats(e, lat, lon, radiusKm, y0, y1, { minM = 6, e5 = null } = {}) {
  let n5 = 0, n6 = 0, n7 = 0, largest = null, recent = null;
  const depths = [];
  const dLat = radiusKm / 111.0 + 0.1;
  const scan = (c, below6) => {
    for (let i = 0; i < c.n; i++) {
      if (Math.abs(c.lat[i] - lat) > dLat) continue;
      const y = c.year[i];
      if (y < y0 || y >= y1 + 1) continue;
      const m = c.mag[i];
      if (m < minM || (below6 && m >= 6)) continue;
      if (distKm(lat, lon, c.lat[i], c.lon[i]) > radiusKm) continue;
      n5++;
      if (m >= 6) n6++;
      if (m >= 7) n7++;
      depths.push(c.depth[i]);
      const ev = { m, y, d: c.depth[i], lat: c.lat[i], lon: c.lon[i], id: Array.isArray(c.id) ? c.id[i] : null };
      if (!largest || m > largest.m || (m === largest.m && y > largest.y)) largest = ev;
      if (!recent || y > recent.y) recent = ev;
    }
  };
  scan(e, false);
  if (minM < 6 && e5) scan(e5, true);
  const md = medianOf(depths);
  return { n5: minM < 6 && e5 ? n5 : null, n6, n7, largest, recent, medianDepth: md, depthClass: md === null ? null : depthClass(md) };
}

// ---------------------------------------------------------------- the cell under a point

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The cells.geojson feature whose hexagon contains the point. Cell rings crossing the antimeridian are stored with
 * longitudes above 180, so the point is also tried at lon ± 360. Falls back to the nearest cell centre.
 */
export function cellAtPoint(features, lat, lon) {
  for (const ft of features) {
    const ring = ft.geometry.coordinates[0];
    for (const L of [lon, lon + 360, lon - 360]) if (inRing(L, lat, ring)) return ft.properties;
  }
  let best = null, bd = Infinity;
  for (const ft of features) {
    const p = ft.properties;
    const d = distKm(lat, lon, p.lat, p.lon);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ---------------------------------------------------------------- the recording rating

export const RATINGS = ['vgood', 'good', 'limited', 'few'];

/**
 * The place card's rating of the global data ("Global data on large earthquakes here"; it counts ISC-GEM events, it does
 * not rate local networks), from the shallow (≤ 70 km) statistics of the cell:
 *   few      quality code "insufficient" (fewer events above Mc than the minimum)
 *   limited  quality code C, or the two catalogues disagree (catalogue flag "check")
 *   vgood    quality code A, catalogues agree (flag "ok") and Mc within 0.2 of the global shallow Mc
 *   good     every other A or B cell
 * globalMc: manifest.global.b_shallow_1976_2021.mc. The same table is in docs/learn.md and on the Learn page.
 */
export function recordingRating(p, globalMc) {
  if (!p) return 'few';
  const q = p.sh_q;
  if (q !== 'A' && q !== 'B' && q !== 'C') return 'few';
  if (q === 'C' || p.c_flag === 'check') return 'limited';
  if (q === 'A' && p.c_flag === 'ok' && typeof p.sh_mc === 'number' && p.sh_mc <= globalMc + 0.2 + 1e-9) return 'vgood';
  return 'good';
}

// ---------------------------------------------------------------- the rating lookup (data/rating.json)

let ratingDoc = null;

/**
 * Load data/rating.json once (on the first place card) and decode it into cells.geojson-like features that carry only
 * the properties the place card reads: id, lat, lon, area_km2, sh_q, sh_mc, c_flag and the precomputed rating.
 * The coordinates decode to exactly the doubles of cells.geojson, so cellAtPoint() finds the same cell
 * (scripts/build_rating.py documents the format).
 */
export function loadRating() {
  if (!ratingDoc) {
    ratingDoc = getJSON('rating.json').then((doc) => {
      const c = Object.fromEntries(doc.columns.map((k, i) => [k, i]));
      return doc.rows.map((r) => {
        const ring = [];
        const v = r[c.ring];
        let x = 0, y = 0;
        for (let i = 0; i < v.length; i += 2) {
          x = i ? x + v[i] : v[0];
          y = i ? y + v[i + 1] : v[1];
          ring.push([x / 100, y / 100]);
        }
        ring.push(ring[0]);
        return {
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {
            id: r[c.id] + doc.id_tail, lat: r[c.lat] / 1000, lon: r[c.lon] / 1000, area_km2: r[c.a] * 1000,
            sh_q: doc.qualities[r[c.q]], sh_mc: r[c.mc] === null ? undefined : r[c.mc] / 10, c_flag: doc.flags[r[c.f]],
            rating: doc.ratings[r[c.r]],
          },
        };
      });
    }).catch((e) => { ratingDoc = null; throw e; });
  }
  return ratingDoc;
}
