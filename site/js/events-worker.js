// Web worker for the M >= 5 events (events_m5.json, about 7.5 MB and 160,000 events): it downloads and parses the
// file off the page's main thread and returns the columns as transferable typed arrays, so the page receives them
// without a copy. (Parsing the file on the main thread was one of the long tasks when M5 was switched on.)
// Message in: {url}. Message out: {ok: true, cols} or {ok: false, error}.

const NUM = ['lon', 'lat', 'depth', 'mag', 'year', 'src', 'mt'];

self.onmessage = async (msg) => {
  const url = msg.data.url;
  try {
    let r;
    try { r = await fetch(url); } catch (e) { throw new Error(`${url} could not be loaded (network error).`); }
    if (!r.ok) throw new Error(`${url} could not be loaded (HTTP ${r.status}).`);
    const e = await r.json();
    const cols = { n: e.n, codes: e.codes, fields: e.fields };
    const transfer = [];
    for (const k of NUM) {
      if (!Array.isArray(e[k])) continue;
      cols[k] = Float64Array.from(e[k]);
      transfer.push(cols[k].buffer);
    }
    // 160,000 short strings are slow to copy between threads; one joined string is not (map.js splits it on first use)
    if (Array.isArray(e.id)) cols.idText = e.id.join('\n');
    self.postMessage({ ok: true, cols }, transfer);
  } catch (e) {
    self.postMessage({ ok: false, error: e.message || String(e) });
  }
};
