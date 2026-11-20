// Plural and ordinal forms for interface strings. A dictionary value may be a function of its variables (see t() in
// ./index.js); these helpers let such a function pick the grammatical form with Intl.PluralRules. No imports, so a
// locale file can use them without an import cycle.

const rules = new Map();
const rule = (lang, type) => {
  const k = `${lang}:${type}`;
  if (!rules.has(k)) rules.set(k, new Intl.PluralRules(lang, { type }));
  return rules.get(k);
};
// Numbers reach the dictionaries already formatted (fmt.js): drop grouping spaces and commas before reading them.
const num = (n) => Number(String(n).replace(/[\s,  ]/g, ''));

/** plural('ru', 5, { one: 'месяц', few: 'месяца', many: 'месяцев' }) -> 'месяцев'. Missing categories fall back to
 *  `other`, then `many`. */
export function plural(lang, n, forms) {
  const c = rule(lang, 'cardinal').select(num(n));
  return forms[c] ?? forms.other ?? forms.many;
}

/** English ordinal: 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 11 -> 11th, 21 -> 21st, 50 -> 50th. */
export function ordinalEn(n) {
  return `${n}${{ one: 'st', two: 'nd', few: 'rd' }[rule('en', 'ordinal').select(num(n))] || 'th'}`;
}
