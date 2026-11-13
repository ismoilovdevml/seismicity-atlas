// infoButton(conceptId, label): the small (i) link placed next to a label or metric. It opens the Learn page of
// that concept (#v=learn&t=<id>); the page offers a "back to where I was" link to the previous state.
// Phase 2 places these in the panel, layer list, legend and pages; see docs/learn.md for the mapping.

import { h } from './charts.js';
import { t } from './i18n/index.js';

const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.4" r="1" fill="currentColor"/></svg>';

/**
 * conceptId: an id from site/js/learn/registry.js; label: the visible name of the thing being explained, used in
 * the accessible name ("What is b-value? Open the explanation").
 */
export function infoButton(conceptId, label) {
  const a = h('a', {
    class: 'info-btn',
    href: `#v=learn&t=${encodeURIComponent(conceptId)}`,
    'aria-label': t('learn.infoAria', { label }),
    title: t('learn.infoAria', { label }),
    'data-concept': conceptId,
  });
  a.insertAdjacentHTML('afterbegin', ICON);
  return a;
}
