// node tests/js/analyze_cli.mjs <csv> [nboot] [floorPeriodsJSON] [floor] -> JSON of site/js/analyze/core.js analyze()
import { readFileSync } from 'node:fs';
import { readCatalog, analyze, fitSegment } from '../../site/js/analyze/core.js';

const [file, nboot = '1000', fp = 'null', floor = 'null'] = process.argv.slice(2);
const cat = readCatalog(readFileSync(file, 'utf8'));
const res = analyze(cat.events, { nboot: +nboot, floorPeriods: JSON.parse(fp), floor: JSON.parse(floor) });
const seg = fitSegment(res);
delete res.fmd.mag; // keep output small
process.stdout.write(JSON.stringify({ n: cat.events.length, mc: res.mc, b: res.b, bpos: res.b_positive || null,
  years: res.mc_by_year, warn: res.warnings.map((w) => w.k), fmd: res.fmd, seg, types: res.magnitude_types || null,
  columns: cat.columns, times: cat.events.map((e) => (Number.isFinite(e.time) ? e.time : null)) }));
