// Simple view helpers that do not touch the page: the place gazetteer and its search, statistics of the recorded
// events around a point, the cell under a point and the plain-language recording rating of that cell.
// The numbers shown in the place card come only from these functions (docs/ux-notes.md, "v0.3 two-mode redesign").

import { getJSON } from './data.js';

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
 * Rank: exact name 0, name starts with the query 1, a word of the name starts with it 2, contains it 3 (queries of
 * three or more characters). Ties: larger population first (the rows are stored by population).
 */
export function searchPlaces(rows, query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const hits = [];
  for (const p of rows) {
    let best = 9;
    for (const k of p.keys) {
      let s = 9;
      if (k === q) s = 0;
      else if (k.startsWith(q)) s = 1;
      else if (k.includes(` ${q}`)) s = 2;
      else if (q.length >= 3 && k.includes(q)) s = 3;
      if (s < best) best = s;
      if (best === 0) break;
    }
    if (best < 9) hits.push([best, p.i, p]);
  }
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return hits.slice(0, limit).map((x) => x[2]);
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

const R_EARTH = 6371.0;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance (haversine, spherical Earth of radius 6371 km). */
export function distKm(lat1, lon1, lat2, lon2) {
  const dlat = rad(lat2 - lat1), dlon = rad(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const DEPTH_CLASSES = [70, 300]; // km: shallow ≤ 70 < intermediate ≤ 300 < deep
export const depthClass = (d) => (d <= DEPTH_CLASSES[0] ? 'sh' : d <= DEPTH_CLASSES[1] ? 'mid' : 'deep');

function medianOf(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}

/**
 * Statistics of the M6+ events (events_m6.json columns) within radiusKm of a point, recorded in the years
 * y0..y1 inclusive (decimal year >= y0 and < y1 + 1).
 * Returns { n6, n7, largest, recent, medianDepth, depthClass } where largest and recent are
 * { m, y, d, lat, lon, id } (largest: highest magnitude, ties to the more recent; recent: latest time).
 */
export function placeStats(e, lat, lon, radiusKm, y0, y1) {
  let n6 = 0, n7 = 0, largest = null, recent = null;
  const depths = [];
  const dLat = radiusKm / 111.0 + 0.1;
  for (let i = 0; i < e.n; i++) {
    if (Math.abs(e.lat[i] - lat) > dLat) continue;
    const y = e.year[i];
    if (y < y0 || y >= y1 + 1) continue;
    const m = e.mag[i];
    if (m < 6) continue;
    if (distKm(lat, lon, e.lat[i], e.lon[i]) > radiusKm) continue;
    n6++;
    if (m >= 7) n7++;
    depths.push(e.depth[i]);
    const ev = { m, y, d: e.depth[i], lat: e.lat[i], lon: e.lon[i], id: e.id ? e.id[i] : null };
    if (!largest || m > largest.m || (m === largest.m && y > largest.y)) largest = ev;
    if (!recent || y > recent.y) recent = ev;
  }
  const md = medianOf(depths);
  return { n6, n7, largest, recent, medianDepth: md, depthClass: md === null ? null : depthClass(md) };
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
 * "How well are earthquakes recorded here?" from the shallow (≤ 70 km) statistics of the cell:
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
