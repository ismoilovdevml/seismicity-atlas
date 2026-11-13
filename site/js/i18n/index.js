// Interface strings. English is built in; other languages load on demand from ./<code>.js.
// Keys missing from a translation fall back to English. Data-file values are never translated.

import en from './en.js';

export const LANGS = { en: 'English', uz: 'Oʻzbekcha', ru: 'Русский', es: 'Español' };
const HTML_LANG = { en: 'en', uz: 'uz-Latn', ru: 'ru', es: 'es' };

let dict = en;
let cur = 'en';
const listeners = new Set();

export const lang = () => cur;
export const onLang = (fn) => listeners.add(fn);

export async function setLang(code) {
  if (!LANGS[code]) code = 'en';
  if (code === cur && dict) return;
  dict = code === 'en' ? en : (await import(`./${code}.js`)).default;
  cur = code;
  document.documentElement.lang = HTML_LANG[code];
  translateDom();
  for (const fn of listeners) fn(code);
}

/** t('key', {n: 3}) -> string with {n} replaced. A dictionary value may also be a function of the vars. */
export function t(key, vars) {
  let s = dict[key] ?? en[key];
  if (s === undefined) return key;
  if (typeof s === 'function') return s(vars || {});
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}

/** Static markup: data-i18n="key" sets the text; data-i18n-attr="aria-label:key;title:key" sets attributes. */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
}
