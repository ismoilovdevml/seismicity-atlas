// The Learn view: #v=learn shows the concept index, #v=learn&t=<concept> one concept page.
// Loaded on demand by app.js the first time the view opens, so the map's first load does not change.

import { h } from '../charts.js';
import { t, lang as curLang } from '../i18n/index.js';
import { getJSON } from '../data.js';
import { CONCEPTS, GROUPS, byId } from './registry.js';
import { EXAMPLES } from './examples.js';
import { REFS } from './refs.js';

const LANG_OK = ['en', 'uz', 'ru', 'es'];
let shownKey = null;
let token = 0;
let cleanups = [];
const MAP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Fill {name} placeholders with escaped values; the template itself is trusted, hand-written content. */
export function fill(tpl, vars = {}, missing = null) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    if (v === undefined || v === null) return missing === null ? m : missing;
    const s = String(v);
    // numbers (and short coded values) in the mono face; names and sentences in the text face
    return /\d/.test(s) && s.length <= 24 ? `<span class="mono lr-num">${esc(s)}</span>` : `<span class="lr-val">${esc(s)}</span>`;
  });
}

/** Trusted HTML from the content files (never data values: those go through fill). */
function html(tag, cls, s) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = s;
  return e;
}

/** Content text that may name example values ({radius}, {nboot} …): shown with "…" until the data arrive. */
let templated = [];
function tmpl(tag, cls, s) {
  const e = html(tag, cls, fill(s, {}, '…'));
  if (/\{\w+\}/.test(s)) templated.push([e, s]);
  return e;
}

async function titles(code) {
  const en = (await import('./content/en/_index.js')).default;
  if (code === 'en') return { tl: en, en };
  try {
    return { tl: (await import(`./content/${code}/_index.js`)).default, en };
  } catch (e) {
    return { tl: {}, en };
  }
}

/** Content of one concept in a language; English with a "translation pending" note when it is not translated. */
async function content(code, id, tl) {
  if (code !== 'en' && tl[id]) {
    try { return { c: (await import(`./content/${code}/${id}.js`)).default, pending: false }; } catch (e) { /* fall back */ }
  }
  return { c: (await import(`./content/en/${id}.js`)).default, pending: code !== 'en' };
}

function teardown() {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* ignore */ } }
  cleanups = [];
}

const backBtn = (back) => h('a', { class: 'lr-back', href: back || '#v=map', 'data-learn': 'back' },
  h('span', { 'aria-hidden': 'true', text: '←' }), ` ${t('learn.back')}`);

/**
 * root: the page container; opts: { topic, back } where back is the hash to return to.
 */
export async function renderLearn(root, { topic, back }) {
  const code = LANG_OK.includes(curLang()) ? curLang() : 'en';
  const key = `${topic || ''}|${code}`;
  // Same page and language: only refresh the return link.
  if (key === shownKey) {
    root.querySelectorAll('[data-learn=back]').forEach((a) => a.setAttribute('href', back || '#v=map'));
    return;
  }
  const first = shownKey === null;
  shownKey = key;
  const my = ++token;
  teardown();
  templated = [];
  const { tl, en } = await titles(code);
  if (my !== token) return;
  const name = (id) => (tl[id] || en[id] || [id])[0];
  const view = root.closest('.view');
  if (view && !first) view.scrollTop = 0;

  if (!topic || !byId.has(topic)) {
    renderIndex(root, { name, tl, en, back, missing: topic && !byId.has(topic) ? topic : null });
    document.title = `${t('title.learn')} | ${t('title.site')}`;
    return;
  }

  const meta = byId.get(topic);
  const { c, pending } = await content(code, topic, tl);
  if (my !== token) return;
  const idx = CONCEPTS.indexOf(meta);
  const prev = CONCEPTS[idx - 1], next = CONCEPTS[idx + 1];
  document.title = `${name(topic)} | ${t('title.learn')} | ${t('title.site')}`;

  const h1 = h('h1', { tabindex: '-1', id: 'lr-title', text: name(topic) });
  const exBox = h('div', { class: 'lr-example-body', 'aria-busy': 'true' }, h('p', { class: 'muted', text: t('learn.loading') }));
  const dgBox = h('div', { class: 'lr-diagram', 'data-diagram': meta.diagram });
  const refs = REFS[topic] || [];

  const art = h('article', { class: 'lr-page', 'data-concept': topic, lang: pending ? 'en' : null },
    h('div', { class: 'lr-top' },
      h('nav', { class: 'lr-crumbs', 'aria-label': t('learn.crumbs') },
        h('a', { href: '#v=learn', 'data-learn': 'index', text: t('learn.h1') }), h('span', { 'aria-hidden': 'true', text: ' / ' }),
        h('span', { text: t(`learn.group.${meta.group}`) })),
      backBtn(back)),
    h1,
    pending ? h('p', { class: 'lr-pending', role: 'note', text: t('learn.pending') }) : null,
    h('section', { class: 'lr-sec lr-sentence', 'aria-labelledby': 'lr-h-one' },
      h('h2', { id: 'lr-h-one', class: 'lr-kicker', text: t('learn.sentence') }),
      tmpl('p', 'lr-lead', c.sentence)),
    h('section', { class: 'lr-sec', 'aria-labelledby': 'lr-h-simple' },
      h('h2', { id: 'lr-h-simple', text: t('learn.simple') }),
      ...c.simple.map((s) => tmpl('p', '', s)),
      c.analogy ? h('aside', { class: 'lr-analogy' }, h('h3', { text: t('learn.analogy') }), tmpl('p', '', c.analogy)) : null),
    h('section', { class: 'lr-sec lr-example', 'aria-labelledby': 'lr-h-ex' },
      h('h2', { id: 'lr-h-ex', text: t('learn.example') }), exBox),
    h('section', { class: 'lr-sec lr-wide', 'aria-labelledby': 'lr-h-dg' },
      h('h2', { id: 'lr-h-dg', text: t('learn.diagram') }), dgBox),
    h('section', { class: 'lr-sec lr-tech', 'aria-labelledby': 'lr-h-tech' },
      h('h2', { id: 'lr-h-tech', text: t('learn.tech') }),
      ...c.tech.map((s) => tmpl(/^\s*<(ul|ol|div|pre|table)/.test(s) ? 'div' : 'p', /^\s*<(ul|ol|div|pre|table)/.test(s) ? 'lr-block' : '', s))),
    refs.length ? h('section', { class: 'lr-sec lr-refs', 'aria-labelledby': 'lr-h-refs' },
      h('h2', { id: 'lr-h-refs', text: t('learn.refs') }),
      h('ol', {}, refs.map((r) => h('li', {}, `${r.text} `, r.doi ? h('a', { href: `https://doi.org/${r.doi}`, target: '_blank', rel: 'noopener', text: `doi:${r.doi}` })
        : r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener', text: r.urlLabel || r.url }) : null)))) : null,
    h('nav', { class: 'lr-pager', 'aria-label': t('learn.pager') },
      prev ? h('a', { class: 'lr-prev', rel: 'prev', href: `#v=learn&t=${prev.id}`, 'data-learn': 'prev' }, h('span', { class: 'lr-pager-k', text: t('learn.prev') }), h('span', { text: name(prev.id) })) : h('span'),
      h('a', { class: 'lr-all', href: '#v=learn', 'data-learn': 'index', text: t('learn.index') }),
      next ? h('a', { class: 'lr-next', rel: 'next', href: `#v=learn&t=${next.id}`, 'data-learn': 'next' }, h('span', { class: 'lr-pager-k', text: t('learn.next') }), h('span', { text: name(next.id) })) : h('span')));
  root.replaceChildren(art);
  if (!first) h1.focus({ preventScroll: true });

  // Real example, then the diagram that uses its data.
  let ex = null;
  try {
    ex = await EXAMPLES[topic]();
    if (my !== token) return;
    const man = await getJSON('manifest.json');
    if (my !== token) return;
    exBox.replaceChildren(
      c.example.title ? html('h3', '', fill(c.example.title, ex.vars)) : null,
      ...c.example.body.map((s) => html('p', '', fill(s, ex.vars))),
      h('p', { class: 'lr-source', text: t('learn.liveData', { v: man.version, cutoff: man.data_cutoff_utc }) }),
      ex.map ? h('a', { class: 'lr-map-btn', href: ex.map, 'data-learn': 'map', text: t('learn.showMap') }) : null);
    for (const [e, tplStr] of templated) e.innerHTML = fill(tplStr, ex.vars, '–');
    const btn = exBox.querySelector('.lr-map-btn');
    if (btn) btn.insertAdjacentHTML('afterbegin', MAP_ICON);
  } catch (e) {
    if (my !== token) return;
    exBox.replaceChildren(h('p', { class: 'error', text: t('learn.exampleError', { msg: e.message }) }));
  }
  exBox.removeAttribute('aria-busy');

  try {
    const mod = await import(`./diagrams/${meta.diagram}.js`);
    if (my !== token) return;
    const fn = mod.default(dgBox, { dg: c.diagram || {}, ex: ex ? ex.data : null, vars: ex ? ex.vars : {} });
    if (typeof fn === 'function') cleanups.push(fn);
    dgBox.dataset.ready = '1';
  } catch (e) {
    if (my !== token) return;
    dgBox.replaceChildren(h('p', { class: 'error', text: t('learn.diagramError', { msg: e.message }) }));
    throw e;
  }
}

function renderIndex(root, { name, tl, en, back, missing }) {
  const blurb = (id) => (tl[id] || en[id] || ['', ''])[1];
  root.replaceChildren(h('article', { class: 'lr-index' },
    h('div', { class: 'lr-top' }, h('span'), backBtn(back)),
    h('h1', { tabindex: '-1', text: t('learn.h1') }),
    h('p', { class: 'lr-lead', text: t('learn.intro') }),
    missing ? h('p', { class: 'notice', role: 'note', text: t('learn.notFound', { id: missing }) }) : null,
    ...GROUPS.map((g) => h('section', { class: 'lr-group', 'aria-labelledby': `lr-g-${g}` },
      h('h2', { id: `lr-g-${g}`, text: t(`learn.group.${g}`) }),
      h('ul', { class: 'lr-cards' }, CONCEPTS.filter((c) => c.group === g).map((c) => h('li', {},
        h('a', { class: 'lr-card', href: `#v=learn&t=${c.id}`, 'data-concept': c.id },
          h('span', { class: 'lr-card-title', text: name(c.id) }),
          h('span', { class: 'lr-card-text', text: blurb(c.id) }))))))),
    h('p', { class: 'lr-foot muted', text: t('learn.indexFoot') })));
}

/** For tests and phase-2 wiring: the registry ids in reading order. */
export const conceptIds = () => CONCEPTS.map((c) => c.id);
