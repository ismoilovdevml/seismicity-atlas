// Info (i) buttons: a small button placed right after a label or heading. It opens the Learn page of one concept
// (#v=learn&t=<id>); that page offers "Back to where I was", which returns to the exact previous URL state.
// Placement rule (docs/learn.md): one button per concept per block (panel section, legend, card, control group),
// always right after the label it explains, never on every number. List pages use one key strip (infoKey).

import { h } from './charts.js';
import { t, onLang } from './i18n/index.js';

const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.4" r="1" fill="currentColor"/></svg>';

const aria = (id) => t('learn.about', { c: t(`learn.c.${id}`) });

/** Open the Learn page of a concept. A plain hash change, so the app records where the visitor came from. */
export function openConcept(id) {
  location.hash = `#v=learn&t=${encodeURIComponent(id)}`;
}

/**
 * conceptId: an id from site/js/learn/registry.js. The accessible name is "About <concept title>" in the current
 * language. The second argument is accepted for compatibility and not used.
 */
export function infoButton(conceptId) {
  const b = h('button', { type: 'button', class: 'info-btn', 'data-concept': conceptId, 'aria-label': aria(conceptId), title: aria(conceptId) });
  b.insertAdjacentHTML('afterbegin', ICON);
  b.addEventListener('click', (e) => {
    // the button may sit inside a clickable row, a label or the map legend: only open the concept
    e.preventDefault();
    e.stopPropagation();
    openConcept(conceptId);
  });
  return b;
}

/** Append an info button to an element (a heading, legend or label text) and return the element. */
export function withInfo(el, conceptId) {
  if (el) el.append(infoButton(conceptId));
  return el;
}

/** A compact key for list pages: [[conceptId, label], ...] shown once above the cards. */
export function infoKey(items) {
  return h('div', { class: 'info-key', role: 'group', 'aria-label': t('learn.keyLabel') },
    h('span', { class: 'info-key-lbl', text: t('learn.keyLabel') }),
    h('ul', {}, items.map(([id, label]) => h('li', {}, h('span', { text: label }), infoButton(id)))));
}

// Buttons in static markup (the map controls) are not re-rendered on a language change: relabel them.
onLang(() => {
  document.querySelectorAll('.info-btn[data-concept]').forEach((b) => {
    b.setAttribute('aria-label', aria(b.dataset.concept));
    b.title = aria(b.dataset.concept);
  });
});
