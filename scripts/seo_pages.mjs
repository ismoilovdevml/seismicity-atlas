// Static, crawlable pages for search engines, generated from the same Learn texts the app shows.
//
// The app lives behind hash routes (#v=learn&t=<id>), which search engines treat as one page. This script writes one
// plain HTML page per Learn concept and language, a Learn index per language, sitemap.xml and robots.txt:
//
//   site/learn/<id>/index.html            English
//   site/<uz|ru|es>/learn/<id>/index.html  other languages
//   site/learn/index.html, site/<lang>/learn/index.html
//   site/sitemap.xml, site/robots.txt
//
// Each page carries a canonical URL, hreflang alternates, Open Graph and Twitter tags, JSON-LD (LearningResource +
// BreadcrumbList) and a link to the interactive version. Run: node scripts/seo_pages.mjs   (no network, no dependencies)
//
// It also keeps the release facts in step with scripts/release.json (the monthly workflow runs it after
// bump_release.py): the Dataset JSON-LD "version" and the end of "temporalCoverage" in site/index.html, and the sitemap
// lastmod of the home page (= the data cut-off). A Learn page keeps its previous lastmod unless its HTML changed.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const BASE = 'https://seismicityatlas.org';
const LANGS = ['en', 'uz', 'ru', 'es'];
const LANG_NAME = { en: 'English', uz: 'Oʻzbekcha', ru: 'Русский', es: 'Español' };
const AUTHOR = { '@type': 'Person', name: 'Otabek Ismoilov', sameAs: 'https://orcid.org/0009-0008-2785-3691' };
const ATLAS = 'Global Seismicity Atlas';
const RELEASE = JSON.parse(readFileSync(join(ROOT, 'scripts', 'release.json'), 'utf8'));
const OG_LOCALE = { en: 'en_US', uz: 'uz_UZ', ru: 'ru_RU', es: 'es_ES' };

const imp = (p) => import(pathToFileURL(join(SITE, 'js', p)).href).then((m) => m);
const { CONCEPTS } = await imp('learn/registry.js');
const { REFS } = await imp('learn/refs.js');
const I18N = {};
const INDEX = {};
const TEXT = {};
for (const l of LANGS) {
  I18N[l] = { ...(await imp('i18n/en.js')).default, ...(await imp(`i18n/${l}.js`)).default };
  INDEX[l] = (await imp(`learn/content/${l}/_index.js`)).default;
  TEXT[l] = {};
  for (const c of CONCEPTS) TEXT[l][c.id] = (await imp(`learn/content/${l}/${c.id}.js`)).default;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const clip = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
const prefix = (l) => (l === 'en' ? '' : `/${l}`);
const learnPath = (l, id) => `${prefix(l)}/learn/${id ? `${id}/` : ''}`;
const appLink = (l, id) => `/#v=learn${id ? `&t=${id}` : ''}&lang=${l}`;
const refText = (r) => (typeof r === 'string' ? r : r.text);
const refUrl = (r) => (typeof r === 'string' ? null : r.url || (r.doi ? `https://doi.org/${r.doi}` : null));

// Inter subsets with Google Fonts' unicode-range values (as in site/css/app.css): the browser fetches only the subsets a
// page shows. Latin also covers Uzbek ʻ ʼ and Spanish á ñ; Russian pages need Cyrillic, which is preloaded there.
const FONT_SUBSETS = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
};
const fontUrl = (sub) => `/vendor/fonts/inter-400-700-${sub}.woff2`;
const FONT_CSS = Object.entries(FONT_SUBSETS)
  .map(([sub, range]) => `@font-face{font-family:Inter;src:url(${fontUrl(sub)}) format("woff2");font-weight:400 700;font-display:swap;unicode-range:${range}}`)
  .join('\n');
const PRELOAD = { en: ['latin'], uz: ['latin'], es: ['latin'], ru: ['latin', 'cyrillic'] };

// --on-accent: text on the accent button. White on the dark-mode accent #5cc3cb was 2.1:1; the dark background on it
// is 8.5:1 (white on the light-mode #0e6b73 is 6.3:1).
const CSS = `
:root{--bg:#fbfaf7;--fg:#1d2126;--muted:#5b6470;--line:#e3e0d8;--accent:#0e6b73;--on-accent:#fff;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#16191d;--fg:#e8eaed;--muted:#a3abb5;--line:#2c3138;--accent:#5cc3cb;--on-accent:#16191d;--card:#1d2126}}
${FONT_CSS}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}header,main,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding-top:18px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;text-decoration:none;color:var(--fg)}.langs a{margin-left:10px;font-size:14px}
nav.crumbs{font-size:14px;color:var(--muted);margin:18px 0 4px}h1{font-size:30px;line-height:1.25;margin:6px 0 10px}
.lead{font-size:19px;color:var(--fg);margin:0 0 22px}h2{font-size:19px;margin:30px 0 8px}
.cta{display:inline-block;margin:6px 0 10px;padding:10px 16px;border-radius:8px;background:var(--accent);color:var(--on-accent);text-decoration:none;font-weight:600}
blockquote{margin:0;padding:12px 16px;border-left:3px solid var(--accent);background:var(--card)}
code.lr-formula{display:block;margin:8px 0;padding:8px 10px;background:var(--card);border:1px solid var(--line);border-radius:6px;overflow-x:auto;white-space:pre-wrap}
ol.refs{padding-left:20px;font-size:14px}ul.idx{padding-left:20px}ul.idx li{margin:6px 0}.sum{color:var(--muted)}
.pager{display:flex;justify-content:space-between;gap:12px;margin:34px 0 10px;font-size:15px}
footer{margin-top:30px;padding-top:14px;padding-bottom:30px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}`;

function page({ l, path, title, desc, body, jsonld, alternates, type = 'article' }) {
  const t = I18N[l];
  const alt = alternates.map(([al, p]) => `<link rel="alternate" hreflang="${al}" href="${BASE}${p}">`).join('\n');
  const langLinks = alternates.filter(([al]) => al !== 'x-default' && al !== l)
    .map(([al, p]) => `<a href="${p}" hreflang="${al}" lang="${al}">${LANG_NAME[al]}</a>`).join('');
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${path}">
${alt}
${PRELOAD[l].map((sub) => `<link rel="preload" href="${fontUrl(sub)}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${ATLAS}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}${path}">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t['seo.ogAlt'])}">
<meta property="og:locale" content="${OG_LOCALE[l]}">
${LANGS.filter((x) => x !== l).map((x) => `<meta property="og:locale:alternate" content="${OG_LOCALE[x]}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${BASE}/og-image.png">
<meta name="twitter:image:alt" content="${esc(t['seo.ogAlt'])}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header><a class="brand" href="/">${ATLAS}</a><span class="langs">${langLinks}</span></header>
<main>
${body}
</main>
<footer>${esc(t['learn.indexFoot'] || '')} · <a href="/">${ATLAS}</a> · ${esc(t['about.notice'])} · <a href="https://doi.org/10.5281/zenodo.24228387">doi:10.5281/zenodo.24228387</a></footer>
</body>
</html>
`;
}

// Previous output, read before it is cleaned: a page whose HTML is unchanged keeps its sitemap lastmod.
const today = new Date().toISOString().slice(0, 10);
const sitemapFile = join(SITE, 'sitemap.xml');
const oldLastmod = new Map(existsSync(sitemapFile)
  ? [...readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]])
  : []);
const oldHtml = new Map();
const lastmod = new Map();

const written = [];
function write(path, html) {
  const file = join(SITE, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written.push(path);
  lastmod.set(path, oldHtml.get(path) === html && oldLastmod.get(`${BASE}${path}`) ? oldLastmod.get(`${BASE}${path}`) : today);
}

// remember, then clean previous output
const walkOld = (dir, rel) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkOld(join(dir, e.name), `${rel}${e.name}/`);
    else if (e.name === 'index.html') oldHtml.set(rel, readFileSync(join(dir, e.name), 'utf8'));
  }
};
for (const l of LANGS) walkOld(join(SITE, prefix(l).slice(1), 'learn'), `${prefix(l)}/learn/`);
for (const l of LANGS) {
  const d = join(SITE, prefix(l).slice(1), 'learn');
  if (existsSync(d)) rmSync(d, { recursive: true, force: true });
}

const altFor = (id) => [...LANGS.map((l) => [l, learnPath(l, id)]), ['x-default', learnPath('en', id)]];

for (const l of LANGS) {
  const t = I18N[l];
  // index
  const groups = [...new Set(CONCEPTS.map((c) => c.group))];
  const idxBody = `<nav class="crumbs"><a href="/">${ATLAS}</a> › ${esc(t['learn.h1'])}</nav>
<h1>${esc(t['learn.h1'])}</h1>
<p class="lead">${esc(t['learn.intro'])}</p>
<a class="cta" href="${appLink(l)}">${esc(t['learn.diagram'])} →</a>
${groups.map((g) => `<h2>${esc(t[`learn.group.${g}`] || g)}</h2>
<ul class="idx">${CONCEPTS.filter((c) => c.group === g).map((c) => `<li><a href="${learnPath(l, c.id)}">${esc(INDEX[l][c.id][0])}</a> <span class="sum">— ${esc(INDEX[l][c.id][1])}</span></li>`).join('')}</ul>`).join('\n')}`;
  write(learnPath(l), page({
    l, path: learnPath(l), title: `${t['learn.h1']} — ${ATLAS}`, desc: clip(t['learn.intro']), body: idxBody, type: 'website',
    alternates: altFor(''),
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${t['learn.h1']} — ${ATLAS}`, inLanguage: l,
      url: `${BASE}${learnPath(l)}`, isPartOf: { '@type': 'WebSite', name: ATLAS, url: `${BASE}/` },
      hasPart: CONCEPTS.map((c) => ({ '@type': 'LearningResource', name: INDEX[l][c.id][0], url: `${BASE}${learnPath(l, c.id)}` })) },
  }));

  // concepts
  CONCEPTS.forEach((c, i) => {
    const x = TEXT[l][c.id];
    const [name, summary] = INDEX[l][c.id];
    const prev = CONCEPTS[i - 1];
    const next = CONCEPTS[i + 1];
    const refs = REFS[c.id] || [];
    const body = `<nav class="crumbs" aria-label="${esc(t['learn.crumbs'])}"><a href="/">${ATLAS}</a> › <a href="${learnPath(l)}">${esc(t['learn.h1'])}</a> › ${esc(name)}</nav>
<h1>${esc(name)}</h1>
<p class="lead">${x.sentence}</p>
<a class="cta" href="${appLink(l, c.id)}">${esc(t['learn.diagram'])} · ${esc(t['learn.example'])} →</a>
<h2>${esc(t['learn.simple'])}</h2>
${(x.simple || []).map((p) => `<p>${p}</p>`).join('\n')}
${x.analogy ? `<h2>${esc(t['learn.analogy'])}</h2>\n<blockquote>${x.analogy}</blockquote>` : ''}
<h2>${esc(t['learn.tech'])}</h2>
${(x.tech || []).map((p) => `<p>${p}</p>`).join('\n')}
${refs.length ? `<h2>${esc(t['learn.refs'])}</h2>\n<ol class="refs">${refs.map((r) => `<li>${esc(refText(r))}${refUrl(r) && !refText(r).includes(refUrl(r)) ? ` <a href="${refUrl(r)}">${esc(refUrl(r).replace('https://', ''))}</a>` : ''}</li>`).join('')}</ol>` : ''}
<div class="pager">${prev ? `<a href="${learnPath(l, prev.id)}">← ${esc(INDEX[l][prev.id][0])}</a>` : '<span></span>'}${next ? `<a href="${learnPath(l, next.id)}">${esc(INDEX[l][next.id][0])} →</a>` : ''}</div>`;
    const desc = clip(plain(x.sentence) || summary);
    write(learnPath(l, c.id), page({
      l, path: learnPath(l, c.id), title: `${name} — ${t['learn.h1']} · ${ATLAS}`, desc, body, alternates: altFor(c.id),
      jsonld: [
        { '@context': 'https://schema.org', '@type': 'LearningResource', name, headline: name, description: plain(x.sentence),
          inLanguage: l, url: `${BASE}${learnPath(l, c.id)}`, learningResourceType: 'explanation', educationalLevel: 'beginner to expert',
          about: { '@type': 'DefinedTerm', name: INDEX.en[c.id][0], inDefinedTermSet: `${BASE}${learnPath('en')}` },
          author: AUTHOR, isPartOf: { '@type': 'WebSite', name: ATLAS, url: `${BASE}/` },
          citation: refs.map(refText) },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: ATLAS, item: `${BASE}/` },
          { '@type': 'ListItem', position: 2, name: t['learn.h1'], item: `${BASE}${learnPath(l)}` },
          { '@type': 'ListItem', position: 3, name, item: `${BASE}${learnPath(l, c.id)}` }] },
      ],
    }));
  });
}

// sitemap + robots; the home page changes with the data, so its lastmod is the data cut-off
lastmod.set('/', RELEASE.data_cutoff_utc);
const urls = ['/', ...written];
const altBlock = (p) => {
  const m = p.match(/^(?:\/(uz|ru|es))?\/learn\/(?:([^/]+)\/)?$/);
  if (!m) return '';
  return altFor(m[2] || '').map(([al, ap]) => `    <xhtml:link rel="alternate" hreflang="${al}" href="${BASE}${ap}"/>`).join('\n') + '\n';
};
writeFileSync(join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((p) => `  <url>\n    <loc>${BASE}${p}</loc>\n    <lastmod>${lastmod.get(p)}</lastmod>\n${altBlock(p)}  </url>`).join('\n')}
</urlset>
`);
writeFileSync(join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /data/cells/\n\nSitemap: ${BASE}/sitemap.xml\n`);
// Dataset JSON-LD in site/index.html: only the two release values are rewritten, in place, so the rest of the page and
// the formatting of the block stay as they are.
const indexFile = join(SITE, 'index.html');
const indexHtml = readFileSync(indexFile, 'utf8');
const ldRe = /(<script type="application\/ld\+json">)(.*?)(<\/script>)/s;
const ld = indexHtml.match(ldRe);
if (!ld) throw new Error('site/index.html: no JSON-LD block');
let block = ld[2];
const setOnce = (re, value, what) => {
  const n = (block.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) throw new Error(`site/index.html JSON-LD: expected one ${what}, found ${n}`);
  block = block.replace(re, value);
};
setOnce(/"version": "[^"]*"/, `"version": "${RELEASE.version}"`, '"version"');
setOnce(/"temporalCoverage": "([0-9-]+)\/[0-9-]+"/, `"temporalCoverage": "$1/${RELEASE.data_cutoff_utc}"`, '"temporalCoverage"');
JSON.parse(block); // still valid JSON
if (block !== ld[2]) writeFileSync(indexFile, indexHtml.replace(ldRe, (m, a, b, c) => `${a}${block}${c}`));
console.log(`wrote ${written.length} pages, sitemap.xml (${urls.length} URLs), robots.txt; index.html JSON-LD ` +
  `version ${RELEASE.version}, temporalCoverage to ${RELEASE.data_cutoff_utc}${block === ld[2] ? ' (unchanged)' : ''}`);
