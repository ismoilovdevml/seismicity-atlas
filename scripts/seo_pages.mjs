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
// Each page carries a canonical URL, hreflang alternates, Open Graph tags, JSON-LD (LearningResource + BreadcrumbList)
// and a link to the interactive version. Run: node scripts/seo_pages.mjs   (no network, no dependencies)

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const BASE = 'https://seismicityatlas.org';
const LANGS = ['en', 'uz', 'ru', 'es'];
const LANG_NAME = { en: 'English', uz: 'Oʻzbekcha', ru: 'Русский', es: 'Español' };
const AUTHOR = { '@type': 'Person', name: 'Otabek Ismoilov', sameAs: 'https://orcid.org/0009-0008-2785-3691' };
const ATLAS = 'Global Seismicity Atlas';

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

const CSS = `
:root{--bg:#fbfaf7;--fg:#1d2126;--muted:#5b6470;--line:#e3e0d8;--accent:#0e6b73;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#16191d;--fg:#e8eaed;--muted:#a3abb5;--line:#2c3138;--accent:#5cc3cb;--card:#1d2126}}
@font-face{font-family:Inter;src:url(/vendor/fonts/inter-400-700-latin.woff2) format("woff2");font-weight:400 700;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}header,main,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding-top:18px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;text-decoration:none;color:var(--fg)}.langs a{margin-left:10px;font-size:14px}
nav.crumbs{font-size:14px;color:var(--muted);margin:18px 0 4px}h1{font-size:30px;line-height:1.25;margin:6px 0 10px}
.lead{font-size:19px;color:var(--fg);margin:0 0 22px}h2{font-size:19px;margin:30px 0 8px}
.cta{display:inline-block;margin:6px 0 10px;padding:10px 16px;border-radius:8px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600}
blockquote{margin:0;padding:12px 16px;border-left:3px solid var(--accent);background:var(--card)}
code.lr-formula{display:block;margin:8px 0;padding:8px 10px;background:var(--card);border:1px solid var(--line);border-radius:6px;overflow-x:auto;white-space:pre-wrap}
ol.refs{padding-left:20px;font-size:14px}ul.idx{padding-left:20px}ul.idx li{margin:6px 0}.sum{color:var(--muted)}
.pager{display:flex;justify-content:space-between;gap:12px;margin:34px 0 10px;font-size:15px}
footer{margin-top:30px;padding-top:14px;padding-bottom:30px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}`;

function page({ l, path, title, desc, body, jsonld, alternates }) {
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
<meta property="og:type" content="article">
<meta property="og:site_name" content="${ATLAS}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}${path}">
<meta property="og:image" content="${BASE}/og-image.png">
<meta property="og:locale" content="${{ en: 'en_US', uz: 'uz_UZ', ru: 'ru_RU', es: 'es_ES' }[l]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header><a class="brand" href="/">${ATLAS}</a><span class="langs">${langLinks}</span></header>
<main>
${body}
</main>
<footer>${esc(t['learn.indexFoot'] || '')} · <a href="/">${ATLAS}</a> · Not a forecast and not a hazard map. · <a href="https://doi.org/10.5281/zenodo.24228387">doi:10.5281/zenodo.24228387</a></footer>
</body>
</html>
`;
}

const written = [];
function write(path, html) {
  const file = join(SITE, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  written.push(path);
}

// clean previous output
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
    l, path: learnPath(l), title: `${t['learn.h1']} — ${ATLAS}`, desc: clip(t['learn.intro']), body: idxBody,
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

// sitemap + robots
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', ...written];
const altBlock = (p) => {
  const m = p.match(/^(?:\/(uz|ru|es))?\/learn\/(?:([^/]+)\/)?$/);
  if (!m) return '';
  return altFor(m[2] || '').map(([al, ap]) => `    <xhtml:link rel="alternate" hreflang="${al}" href="${BASE}${ap}"/>`).join('\n') + '\n';
};
writeFileSync(join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((p) => `  <url>\n    <loc>${BASE}${p}</loc>\n    <lastmod>${today}</lastmod>\n${altBlock(p)}  </url>`).join('\n')}
</urlset>
`);
writeFileSync(join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /data/cells/\n\nSitemap: ${BASE}/sitemap.xml\n`);
console.log(`wrote ${written.length} pages, sitemap.xml (${urls.length} URLs), robots.txt`);
