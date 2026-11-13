// Data loading with a cache, readable errors and byte sizes from the manifest.

const cache = new Map();

export function getJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(`data/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`data/${path} could not be loaded (HTTP ${r.status}).`);
        return r.json();
      })
      .catch((e) => {
        cache.delete(path);
        if (e instanceof TypeError) throw new Error(`data/${path} could not be loaded (network error).`);
        throw e;
      });
    cache.set(path, p);
  }
  return cache.get(path);
}

export function mb(bytes) {
  return `${(bytes / 1e6).toFixed(bytes < 1e6 ? 2 : 1)} MB`;
}

/** The last number in a manifest rule, e.g. "95 % CI width <= 0.30" -> 0.3, "< 50 events above threshold" -> 50. */
export function ruleNumber(s) {
  const all = String(s || '').match(/\d+(?:\.\d+)?/g);
  return all ? Number(all[all.length - 1]) : null;
}
