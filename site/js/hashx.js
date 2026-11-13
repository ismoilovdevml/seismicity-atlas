// Extra URL-hash keys owned by feature modules (relief, terrain, 3D depth view). Modules declare their keys here;
// app.js reads and writes them together with the core state, so shared links keep them without the core parser
// having to know each feature.

const specs = [];
let commitFn = () => {};

/** list: [{key, def, parse(str) -> value or undefined when invalid, fmt(value) -> str (optional)}] */
export function defineKeys(list) {
  for (const k of list) if (!specs.some((s) => s.key === k.key)) specs.push(k);
}

/** Copy the declared keys from URLSearchParams into the state object s (defaults for absent or invalid values). */
export function readExtras(params, s) {
  for (const k of specs) {
    const raw = params.get(k.key);
    const v = raw === null ? undefined : k.parse(raw);
    s[k.key] = v === undefined ? k.def : v;
  }
}

/** Write the declared keys that differ from their default into URLSearchParams. */
export function writeExtras(s, params) {
  for (const k of specs) {
    const v = s[k.key];
    if (v === undefined || v === null || v === k.def) continue;
    params.set(k.key, k.fmt ? k.fmt(v) : String(v));
  }
}

export function setCommit(fn) { commitFn = fn; }
/** Write the current state to the URL (replaceState). */
export function commit() { commitFn(); }

export const intIn = (lo, hi) => (s) => (/^-?\d+$/.test(s) && +s >= lo && +s <= hi ? +s : undefined);
export const oneOf = (list) => (s) => (list.includes(s) ? s : undefined);
