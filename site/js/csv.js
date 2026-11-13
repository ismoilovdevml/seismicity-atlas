// Per-cell CSV, built in the browser from the cell properties and cells/<id>.json. One tidy table:
//   section,depth,catalogue,name,magnitude,value
// "summary" rows hold the map values of the cell; "fmd" rows hold counts per 0.1 magnitude bin.
// Lines starting with # carry provenance; most CSV readers skip them (pandas: comment='#').

import { getJSON } from './data.js';

const CAT = { fmd_iscgem: 'ISC-GEM Mw', fmd_comcat: 'ComCat as served' };

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n#]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Pure: build the CSV text. props = cell properties, det = parsed detail file or null. */
export function cellCsv(props, det, meta) {
  const lines = [];
  lines.push(`# Global Seismicity Atlas, version ${meta.version}, data cut-off ${meta.cutoff}`);
  lines.push(`# Cell ${props.id}${meta.region ? `, regional catalogue ${meta.region.catalogue} (${meta.region.licence})` : ''}`);
  lines.push(`# Licence: ${meta.licence}. Cite the atlas and the source catalogues.`);
  lines.push('# Field definitions: https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/data-schema.md');
  if (!det) lines.push(`# No frequency-magnitude rows: ${meta.detailError ? 'the cell detail file could not be loaded' : 'this cell has no detail file'}.`);
  lines.push('section,depth,catalogue,name,magnitude,value');
  const keys = Object.keys(props).filter((k) => !['regionId', 'regionName'].includes(k)).sort();
  for (const k of keys) {
    const m = k.match(/^(sh|dp)_(.+)$/);
    const depth = m ? m[1] : 'all';
    const name = m ? m[2] : k;
    const cat = m ? (name.startsWith('mc_cc') ? 'ComCat' : meta.region ? meta.region.catalogue : 'ISC-GEM') : (k.startsWith('c_') ? 'ISC-GEM vs ComCat' : '');
    lines.push(['summary', depth, cat, name, '', props[k]].map(cell).join(','));
  }
  if (det) {
    for (const depth of ['sh', 'dp']) {
      const dd = det[depth];
      if (!dd) continue;
      for (const k of Object.keys(dd).filter((x) => x.startsWith('fmd') && Array.isArray(dd[x]))) {
        const catName = CAT[k] || (k === 'fmd' && meta.region ? meta.region.catalogue : k.replace(/^fmd_?/, ''));
        const pairs = dd[k].slice().sort((a, b) => a[0] - b[0]);
        let cum = pairs.reduce((s, x) => s + x[1], 0);
        for (const [mag, n] of pairs) {
          lines.push(['fmd', depth, catName, 'count', mag.toFixed(1), n].map(cell).join(','));
          lines.push(['fmd', depth, catName, 'cumulative_count', mag.toFixed(1), cum].map(cell).join(','));
          cum -= n;
        }
      }
    }
  }
  return lines.join('\n') + '\n';
}

/** Build the CSV (loading the detail file when there is one) and hand it to the browser as a download. */
export async function downloadCellCsv(props, d, { manifest, region, detailPath }) {
  let det = null, detailError = false;
  if (detailPath) {
    try { det = await getJSON(detailPath); } catch (e) { detailError = true; }
  }
  const text = cellCsv(props, det, { version: manifest.version, cutoff: manifest.data_cutoff_utc, licence: manifest.licence.data, region, detailError });
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `seismicity-atlas-cell-${props.id}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
