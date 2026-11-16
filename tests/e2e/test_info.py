"""Info (i) buttons: every button in every view opens the right Learn concept and "Back to where I was" returns to
the same state; the buttons are labelled, keyboard-reachable, at least 24 px, and do not overlap anything at 360 px."""
import pytest

from conftest import no_hscroll

A = "829eaffffffffff"        # shown (A/B) shallow cell (also used by test_features)
B_OVER = "829e87fffffffff"   # its comparison partner with an overlapping interval (as in test_features)

# The placement table of docs/learn.md, per view: the set of concepts with a visible button.
VIEWS = {
    "map": (f"#v=map&l=b&d=sh&c={A}&ev=6&pl=1&g=0", ".chart-svg", {
        "depth-and-slabs", "gutenberg-richter-b-value", "quality-codes", "magnitude-of-completeness",
        "catalogue-consistency", "rate-m6", "regional-catalogues", "plate-boundary-classes", "magnitude-types",
        "direct-vs-proxy-mw", "not-a-forecast", "h3-cells-and-sample-radius", "confidence-interval-bootstrap",
        "b-positive", "declustering", "frequency-magnitude-distribution", "seismic-moment-budget"}),
    "compare": (f"#v=map&l=b&d=sh&c={B_OVER}&k={A}&g=0", ".cmp-verdict", {
        "confidence-interval-bootstrap", "h3-cells-and-sample-radius", "depth-and-slabs", "gutenberg-richter-b-value",
        "quality-codes", "magnitude-of-completeness", "catalogue-consistency", "rate-m6", "regional-catalogues",
        "plate-boundary-classes", "magnitude-types", "direct-vs-proxy-mw", "not-a-forecast", "seismic-moment-budget"}),
    "sequences": ("#v=sequences", ".seq", {"omori-utsu", "magnitude-of-completeness", "aftershock-productivity-bath", "not-a-forecast"}),
    "monitor": ("#v=monitor", ".info-key", {"not-a-forecast", "omori-utsu", "gutenberg-richter-b-value", "quality-codes", "b-positive",
                                           "aftershock-productivity-bath", "magnitude-of-completeness"}),
    "depth": ("#v=depth", ".d3-card", {"depth-and-slabs", "gutenberg-richter-b-value", "quality-codes", "not-a-forecast"}),
    "methods": ("#v=methods", ".vtable", {"plate-boundary-classes", "h3-cells-and-sample-radius", "direct-vs-proxy-mw",
                                         "magnitude-of-completeness", "confidence-interval-bootstrap", "quality-codes", "b-positive",
                                         "gutenberg-richter-b-value", "omori-utsu", "not-a-forecast"}),
    "about": ("#v=about", ".src-list", {"not-a-forecast", "catalogue-consistency"}),
    "cases": ("#v=cases&cs=groningen", ".cs-bmap svg", {"induced-seismicity", "not-a-forecast", "confidence-interval-bootstrap",
                                                       "b-positive", "gutenberg-richter-b-value"}),
}

VISIBLE = """() => [...document.querySelectorAll('.info-btn')].filter((b) => {
  const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
  return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !b.closest('[hidden]'); })"""


def visible_buttons(pg):
    return pg.evaluate(f"({VISIBLE})().map((b) => b.dataset.concept)")


def params(hash_):
    return dict(p.split("=", 1) for p in hash_.lstrip("#").split("&") if "=" in p)


@pytest.mark.parametrize("view", list(VIEWS))
def test_every_info_button_opens_its_concept_and_back_returns(site, view):
    hash_, ready_sel, expected = VIEWS[view]
    pg = site.open(hash_, ready=view in ("map", "compare"))
    pg.wait_for_selector(ready_sel, timeout=30000)
    pg.wait_for_timeout(400)
    concepts = visible_buttons(pg)
    assert set(concepts) == expected, (view, sorted(set(concepts) ^ expected))
    # one button per concept per block: never the same concept twice inside one block
    dup = pg.evaluate(f"""() => {{ const seen = new Map(); let bad = [];
      for (const b of ({VISIBLE})()) {{ const blk = b.closest('section, fieldset, .legend, .info-key, .d3-card, .tiles, .bhead, .withheld, .disclaimer, .panel-head, .cmp-verdict, li, .notice, dl, .group');
        const k = (blk ? blk.tagName + (blk.id || blk.className) : '') + '|' + b.dataset.concept;
        if (seen.has(k) && seen.get(k) === blk) bad.push(k); seen.set(k, blk); }} return bad; }}""")
    assert not dup, dup
    # The app rewrites a short hash (e.g. "#v=sequences") into its full form (adds g, mode, lang). On a slow CI
    # runner that can happen after the page looks ready, so wait for it before recording where we started.
    try:
        pg.wait_for_function("location.hash.includes('lang=')", timeout=10000)
    except Exception:
        pass
    start = pg.evaluate("location.hash")
    n = len(concepts)
    for i in range(n):
        cid = pg.evaluate(f"({VISIBLE})()[{i}].dataset.concept")
        label = pg.evaluate(f"({VISIBLE})()[{i}].getAttribute('aria-label')")
        assert label.startswith("About "), label
        pg.evaluate(f"({VISIBLE})()[{i}].click()")
        pg.wait_for_selector(f".lr-page[data-concept='{cid}'] .lr-diagram[data-ready='1']", timeout=20000)
        assert f"t={cid}" in pg.evaluate("location.hash")
        assert pg.is_visible("#view-learn")
        pg.click(".lr-top [data-learn=back]")
        pg.wait_for_function(f"!location.hash.includes('v=learn')")
        back = pg.evaluate("location.hash")
        # every parameter of the starting state comes back (the app may add defaults it had not yet written)
        assert params(start).items() <= params(back).items(), (view, cid, start, back)
        pg.wait_for_selector(ready_sel, timeout=20000)
        pg.wait_for_function(f"({VISIBLE})().length === {n}", timeout=20000)
    if view in ("map", "compare"):
        assert pg.is_visible("#panel")


def test_info_buttons_keyboard_and_language(site):
    pg = site.open(f"#v=map&l=b&d=sh&c={A}&lang=ru")
    pg.wait_for_selector("#panel .info-btn")
    btn = pg.locator("#layer-list ~ * .info-btn, .ll-row .info-btn").first
    assert btn.get_attribute("aria-label").startswith("Подробнее: ")
    # keyboard: focus and Enter opens the concept
    btn.focus()
    pg.keyboard.press("Enter")
    pg.wait_for_selector(".lr-page[data-concept='gutenberg-richter-b-value']")
    assert pg.evaluate("document.documentElement.lang") == "ru"
    pg.click(".lr-top [data-learn=back]")
    pg.wait_for_function("location.hash.includes('v=map')")
    # static buttons are relabelled when the language changes
    pg.select_option("#lang-select", "es")
    pg.wait_for_function("document.querySelector('.ll-row .info-btn').getAttribute('aria-label').startsWith('Acerca de')")


@pytest.mark.parametrize("name,hash_,ready,scope", [
    ("legend", "#v=map&l=b&pl=1&ev=6", ".legend .info-btn", "#map-area, #disclaimer"),
    ("rail", "#v=map&l=b", ".ll-row .info-btn", "#controls"),
    ("panel", f"#v=map&l=b&d=sh&c={A}", "#panel .info-btn", "#panel"),
    ("sequences", "#v=sequences", ".info-key", "#view-sequences"),
    ("monitor", "#v=monitor", ".info-key", "#view-monitor"),
    ("methods", "#v=methods", ".steps .info-btn", "#view-methods"),
    ("about", "#v=about", ".notice .info-btn", "#view-about"),
    ("cases", "#v=cases&cs=groningen", ".cs-bmap svg", "#view-cases"),
])
def test_info_buttons_fit_at_360px(site, name, hash_, ready, scope):
    pg = site.open(hash_, viewport="phone", ready=False)
    pg.set_viewport_size({"width": 360, "height": 780})
    pg.wait_for_selector(ready, state="attached", timeout=30000)
    if name == "rail":
        pg.click("#chip-more")
    if name == "panel":
        pg.click("text=Full details and charts")
        pg.wait_for_selector("#panel .chart-svg")
    pg.wait_for_timeout(300)
    ok, r = no_hscroll(pg)
    assert ok, r
    bad = pg.evaluate(f"""() => {{ const SCOPE = '{scope}';
      const btns = ({VISIBLE})().filter((b) => b.closest(SCOPE)); const out = [];
      if (!btns.length) out.push('no buttons in ' + SCOPE);
      const others = [...document.querySelectorAll('a, button, input, select, label, .pill')].filter((e) => !e.classList.contains('info-btn'));
      for (const b of btns) {{
        b.scrollIntoView({{ block: 'center', inline: 'nearest' }});
        const r = b.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) out.push('small ' + b.dataset.concept);
        if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push('outside ' + b.dataset.concept);
        // the button is on top where it is drawn (not covered by a sheet or another control)
        const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        if (r.bottom > 0 && r.top < innerHeight && !(top && b.contains(top))) out.push('covered ' + b.dataset.concept + ' by ' + (top && (top.id || top.className)));
        // and does not overlap another control of the same container
        const box = (e) => e.closest('#panel, #controls, .legend, #disclaimer, .view');
        for (const o of others) {{
          if (o.contains(b) || b.contains(o) || o.closest('[hidden]') || box(o) !== box(b)) continue;
          const q = o.getBoundingClientRect(); if (!q.width || !q.height) continue;
          const ix = Math.min(r.right, q.right) - Math.max(r.left, q.left), iy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
          if (ix > 1 && iy > 1) out.push('overlap ' + b.dataset.concept + ' / ' + (o.id || o.className || o.tagName));
        }}
      }}
      return out; }}""")
    assert not bad, bad
