// Small helpers shared by several views: great-circle distance, cumulative frequency-magnitude counts, safe external
// links, page loading / error boxes with a generation token, lazy style sheets and the reduced-motion preference.
// (site/js/analyze/core.js keeps its own copies on purpose: it also runs under Node for the CLI and tests.)

import { h } from './charts.js';
import { t } from './i18n/index.js';

const RAD = Math.PI / 180;
/** Mean Earth radius (km) used for every distance on the site. */
export const R_EARTH = 6371.0;

/** Great-circle distance in km (haversine, spherical Earth of radius R_EARTH). */
export function distKm(lat1, lon1, lat2, lon2) {
  const dlat = (lat2 - lat1) * RAD, dlon = (lon2 - lon1) * RAD;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dlon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Cumulative counts N(>= m) from non-cumulative [[m, n]] pairs sorted by m: [[m, N >= m], ...]. */
export function cumulativeFmd(pairs) {
  const out = new Array(pairs.length);
  let acc = 0;
  for (let i = pairs.length - 1; i >= 0; i--) { acc += pairs[i][1]; out[i] = [pairs[i][0], acc]; }
  return out;
}

/** The URL when it is an absolute https:// link, else null (data files are never trusted to carry javascript: etc.). */
export function safeUrl(u) {
  return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : null;
}

/** Attributes of a link that opens another site in a new tab without handing it this page or the referrer. */
export const EXT = { target: '_blank', rel: 'noopener noreferrer' };

/** An external link, or plain text when the URL is not a safe https:// URL. */
export function extLink(url, text, attrs = {}) {
  const u = safeUrl(url);
  return u ? h('a', { ...attrs, href: u, ...EXT, text: text ?? u }) : document.createTextNode(text ?? '');
}

/** "Loading …" status in a page root. */
export const loadingBox = (root, what) => root.replaceChildren(h('div', { class: 'loading', role: 'status', text: t('common.loading', { what }) }));

/** An error with a Retry button in a page root. */
export const errorBox = (root, e, retry) => root.replaceChildren(h('p', { class: 'error', role: 'alert' }, `${e.message} `,
  h('button', { class: 'small-btn', type: 'button', onclick: retry, text: t('common.retry') })));

const pageTokens = new WeakMap();
/**
 * Load data for a page and draw it, unless a newer load of the same root started meanwhile (a language change or a
 * retry): a slow, stale response never overwrites a newer page. load() returns a promise; draw(data) fills the root.
 */
export function loadPage(root, what, load, draw) {
  const run = () => {
    const my = (pageTokens.get(root) || 0) + 1;
    pageTokens.set(root, my);
    loadingBox(root, what);
    load().then((d) => { if (pageTokens.get(root) === my) draw(d); })
      .catch((e) => { if (pageTokens.get(root) === my) errorBox(root, e, run); });
  };
  run();
}

const sheets = new Map();
/** Add a style sheet once (relative URL, so the GitHub Pages mirror path keeps working); resolves when it applies. */
export function loadCss(href) {
  if (!sheets.has(href)) {
    sheets.set(href, new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      // a missing sheet must not stop the page: it renders unstyled rather than not at all
      link.onload = () => resolve(true);
      link.onerror = () => { sheets.delete(href); resolve(false); };
      document.head.append(link);
    }));
  }
  return sheets.get(href);
}

/** True when the visitor asked the system for less motion. */
export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
