// Info buttons in the static map controls of index.html (the rail and the disclaimer strip). Dynamic views add
// their own buttons where they render. See docs/learn.md for the full placement table.

import { h } from './charts.js';
import { infoButton } from './info.js';

/** Put the button after the label text; text set by data-i18n moves to an inner span so translations keep it. */
function afterText(el, id) {
  if (!el || el.querySelector('.info-btn')) return;
  if (el.dataset.i18n) {
    const sp = h('span', { 'data-i18n': el.dataset.i18n, text: el.textContent });
    el.removeAttribute('data-i18n');
    el.replaceChildren(sp);
  }
  el.append(infoButton(id));
}

/** A row that holds a control label and its info button side by side (the button must not sit in the label). */
function rowWith(label, id, cls) {
  if (!label || label.parentElement.classList.contains(cls)) return;
  const row = h('div', { class: cls });
  label.replaceWith(row);
  row.append(label, infoButton(id));
}

const LAYER_CONCEPT = { b: 'gutenberg-richter-b-value', q: 'quality-codes', mc: 'magnitude-of-completeness', cc: 'catalogue-consistency', rate: 'rate-m6' };

export function placeRailInfo() {
  const $ = (s) => document.querySelector(s);
  afterText($('#depth-seg').closest('fieldset').querySelector('legend'), 'depth-and-slabs');
  for (const [v, id] of Object.entries(LAYER_CONCEPT)) rowWith($(`#layer-list input[value=${v}]`).closest('label'), id, 'll-row');
  afterText($('#reg-group legend'), 'regional-catalogues');
  rowWith($('#chk-plates').closest('label'), 'plate-boundary-classes', 'check-row');
  rowWith($('#chk-events').closest('label'), 'magnitude-types', 'check-row');
  afterText($('.stat-window .group-title'), 'direct-vs-proxy-mw');
  const disc = $('#disclaimer > span');
  if (disc && !disc.querySelector('.info-btn')) disc.append(' ', infoButton('not-a-forecast'));
}
