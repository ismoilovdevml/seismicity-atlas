"""Learn pages: index, every concept in every language, diagram controls, reduced motion, map links, back link and
language persistence."""
import re

import pytest

from conftest import no_hscroll

CONCEPTS = [
    "magnitude-types", "direct-vs-proxy-mw", "magnitude-of-completeness", "frequency-magnitude-distribution",
    "gutenberg-richter-b-value", "confidence-interval-bootstrap", "quality-codes", "b-positive", "declustering",
    "omori-utsu", "aftershock-productivity-bath", "h3-cells-and-sample-radius", "plate-boundary-classes",
    "depth-and-slabs", "rate-m6", "catalogue-consistency", "regional-catalogues", "not-a-forecast",
    "recording-rating",  # v0.3: the Simple-view rating
    "induced-seismicity", "seismic-moment-budget",  # v0.3.1: case study and deficit layer
]
LANGS = {"en": "en", "uz": "uz-Latn", "ru": "ru", "es": "es"}


def open_concept(pg, cid):
    pg.evaluate(f"location.hash = 'v=learn&t={cid}'")
    pg.wait_for_selector(f".lr-page[data-concept='{cid}'] .lr-diagram[data-ready='1']", timeout=20000)
    pg.wait_for_selector(f".lr-page[data-concept='{cid}'] .lr-example-body:not([aria-busy])", timeout=20000)


def readout(pg):
    return pg.inner_text(".lr-readout")


def test_registry_matches_the_test_list(site):
    pg = site.open("#v=learn", ready=False)
    ids = pg.evaluate("import('./js/learn/view.js').then((m) => m.conceptIds())")
    assert ids == CONCEPTS


def test_index_renders(site):
    pg = site.open("#v=learn", ready=False)
    pg.wait_for_selector(".lr-card")
    assert pg.locator(".lr-card").count() == len(CONCEPTS)
    assert pg.locator(".lr-group").count() == 7
    assert pg.get_attribute(".nav a[data-view=learn]", "aria-current") == "page"
    assert pg.is_hidden("#view-map")
    assert pg.title().startswith("Learn")
    ok, r = no_hscroll(pg)
    assert ok, r


@pytest.mark.parametrize("lang", list(LANGS))
def test_every_concept_renders(site, lang):
    pg = site.open(f"#v=learn&lang={lang}", ready=False)
    pg.wait_for_selector(".lr-card")
    assert pg.evaluate("document.documentElement.lang") == LANGS[lang]
    for cid in CONCEPTS:
        open_concept(pg, cid)
        art = pg.locator(f".lr-page[data-concept='{cid}']")
        txt = art.inner_text()
        assert len(txt) > 1500, (cid, len(txt))
        assert pg.locator(".lr-page .error").count() == 0, cid
        # every placeholder is filled with data, no "{name}" is left over
        assert not re.search(r"\{\w+\}", txt), (cid, re.findall(r"\{\w+\}", txt)[:5])
        # completed translations never show the "translation pending" note
        assert pg.locator(".lr-pending").count() == 0, (cid, lang)
        assert pg.locator(".lr-refs li").count() >= 2, cid
        assert pg.locator(".lr-map-btn").count() == 1, cid
        assert pg.locator(".lr-diagram svg").count() >= 1, cid
        assert pg.locator(".lr-readout").first.inner_text().strip(), cid
        # the five page sections
        assert pg.locator(".lr-page section").count() >= 6, cid


def test_concept_page_layout_phone(site):
    pg = site.open("#v=learn&t=omori-utsu", viewport="phone", ready=False)
    pg.wait_for_selector(".lr-diagram[data-ready='1']")
    ok, r = no_hscroll(pg)
    assert ok, r
    assert pg.evaluate("document.querySelector('.lr-diagram svg').getBoundingClientRect().width <= innerWidth")


def test_diagram_controls(site):
    pg = site.open("#v=learn&t=magnitude-of-completeness", ready=False)
    pg.wait_for_selector(".lr-diagram[data-ready='1']")
    before = readout(pg)
    # keyboard: the Mc slider moves with the arrow keys, greys out more bins and updates b
    off0 = pg.locator(".lr-svg .bar.off").count()
    pg.focus("input[data-ctl=mc]")
    for _ in range(3):
        pg.keyboard.press("ArrowRight")
    assert pg.locator(".lr-svg .bar.off").count() > off0
    assert readout(pg) != before
    # the "atlas Mc" button restores the starting state
    pg.click("[data-ctl=atlas]")
    assert readout(pg) == before
    pg.click("[data-ctl=maxc]")
    assert pg.input_value("input[data-ctl=mc]") != ""

    open_concept(pg, "frequency-magnitude-distribution")
    pg.click("[data-ctl=kind-non]")
    assert pg.get_attribute("[data-ctl=kind-non]", "aria-pressed") == "true"
    assert pg.locator(".lr-svg rect.bar").count() > 5

    open_concept(pg, "gutenberg-richter-b-value")
    pg.fill("input[data-ctl=b]", "1.5")
    pg.dispatch_event("input[data-ctl=b]", "input")
    assert "b = 1.50" in readout(pg)

    open_concept(pg, "b-positive")
    def bvals():
        return pg.evaluate("[+document.querySelector('.lr-fig').dataset.b, +document.querySelector('.lr-fig').dataset.bp]")
    pg.fill("input[data-ctl=gap]", "0")
    pg.dispatch_event("input[data-ctl=gap]", "input")
    b0, bp0 = bvals()
    pg.fill("input[data-ctl=gap]", "0.4")
    pg.dispatch_event("input[data-ctl=gap]", "input")
    b1, bp1 = bvals()
    # missing small events pull the classic b down; b-positive stays close to the true value
    assert b1 < b0 - 0.2 and abs(bp1 - bp0) < 0.1, (b0, b1, bp0, bp1)

    open_concept(pg, "quality-codes")
    pg.fill("input[data-ctl=n]", "0")
    pg.dispatch_event("input[data-ctl=n]", "input")
    assert pg.get_attribute(".lr-fig", "data-q") == "insufficient"
    pg.fill("input[data-ctl=n]", "100")
    pg.dispatch_event("input[data-ctl=n]", "input")
    assert pg.get_attribute(".lr-fig", "data-q") == "A"

    open_concept(pg, "confidence-interval-bootstrap")
    pg.click("[data-ctl=skip]")
    pg.wait_for_selector(".lr-svg .band-rect")
    assert "200" in readout(pg)

    open_concept(pg, "omori-utsu")
    pg.click("[data-ctl=reset]")
    pg.fill("input[data-ctl=p]", "1.5")
    pg.dispatch_event("input[data-ctl=p]", "input")
    assert "p = 1.50" in readout(pg)

    open_concept(pg, "h3-cells-and-sample-radius")
    n_btn = pg.locator(".lr-seg-btn").count()
    assert n_btn >= 2
    pg.locator(".lr-seg-btn").nth(1).click()
    assert "km" in readout(pg)

    open_concept(pg, "regional-catalogues")
    pg.locator(".lr-seg-btn").last.click()
    assert pg.get_attribute(".lr-seg-btn >> nth=-1", "aria-pressed") == "true"


def test_reduced_motion_shows_static_frames(site):
    pg = site.open("#v=map", ready=False)
    pg.emulate_media(reduced_motion="reduce")
    for cid in ["confidence-interval-bootstrap", "declustering", "omori-utsu", "depth-and-slabs", "not-a-forecast"]:
        open_concept(pg, cid)
        # nothing animates on its own: the final frame is drawn and the play button waits
        assert pg.get_attribute(".lr-fig", "data-anim") in (None, "stopped"), cid
        assert pg.get_attribute("[data-ctl=play]", "aria-pressed") == "false", cid
    open_concept(pg, "confidence-interval-bootstrap")
    assert pg.locator(".lr-svg .band-rect").count() == 1  # the finished histogram with its interval band
    pg.click("[data-ctl=play]")
    assert pg.get_attribute(".lr-fig", "data-anim") == "playing"
    pg.click("[data-ctl=play]")
    assert pg.get_attribute(".lr-fig", "data-anim") == "stopped"


def test_animation_plays_without_reduced_motion(site):
    pg = site.open("#v=learn&t=declustering", ready=False)
    pg.wait_for_selector(".lr-diagram[data-ready='1']")
    pg.wait_for_function("+document.querySelector('.lr-fig').dataset.opened > 0", timeout=10000)


def test_info_button_back_and_show_on_map(site):
    pg = site.open("#v=map&l=mc&d=dp")
    # an info button as phase 2 will place it: it opens the concept and remembers where we were
    pg.evaluate("""import('./js/info.js').then((m) => {
      const a = m.infoButton('quality-codes', 'Quality'); a.id = 'test-info'; document.querySelector('.legend').append(a); })""")
    pg.wait_for_selector("#test-info")
    assert pg.get_attribute("#test-info", "aria-label") == "About Quality codes A, B, C and insufficient"
    pg.click("#test-info")
    pg.wait_for_selector(".lr-page[data-concept='quality-codes'] .lr-diagram[data-ready='1']")
    assert "t=quality-codes" in pg.evaluate("location.hash")
    # next concept, then back: we return to the map state from before, not to the previous concept
    pg.click(".lr-next")
    pg.wait_for_selector(".lr-page[data-concept='b-positive']")
    pg.click(".lr-top [data-learn=back]")
    pg.wait_for_function("location.hash.includes('v=map')")
    h = pg.evaluate("location.hash")
    assert "l=mc" in h and "d=dp" in h, h
    assert pg.is_visible("#view-map")

    # "Show this on the map" opens the example cell in the right layer
    pg.evaluate("location.hash = 'v=learn&t=magnitude-of-completeness'")
    pg.wait_for_selector(".lr-page[data-concept='magnitude-of-completeness'] .lr-map-btn")
    href = pg.get_attribute(".lr-map-btn", "href")
    cell = re.search(r"c=([0-9a-f]{15})", href).group(1)
    pg.click(".lr-map-btn")
    pg.wait_for_selector("#panel:not([hidden])")
    h = pg.evaluate("location.hash")
    assert "v=map" in h and "l=mc" in h and f"c={cell}" in h, h
    assert pg.is_visible("#view-map")


def test_language_persists(site):
    pg = site.open("#v=learn&t=b-positive", ready=False)
    pg.wait_for_selector(".lr-page[data-concept='b-positive']")
    pg.select_option("#lang-select", "ru")
    pg.wait_for_function("document.documentElement.lang === 'ru' && location.hash.includes('lang=ru')")
    pg.wait_for_selector(".lr-page[data-concept='b-positive'] .lr-diagram[data-ready='1']")
    h1_ru = pg.inner_text("#lr-title")
    # links inside Learn carry no language: the choice is kept
    pg.click(".lr-next")
    pg.wait_for_selector(".lr-page[data-concept='declustering']")
    assert "lang=ru" in pg.evaluate("location.hash")
    assert pg.evaluate("document.documentElement.lang") == "ru"
    # a reload without lang in the URL uses the stored choice
    pg.evaluate("history.replaceState(null, '', '#v=learn&t=b-positive')")
    pg.reload()
    pg.wait_for_selector(".lr-page[data-concept='b-positive'] .lr-diagram[data-ready='1']")
    assert pg.inner_text("#lr-title") == h1_ru
    assert pg.evaluate("document.documentElement.lang") == "ru"


def test_unknown_concept_shows_index(site):
    pg = site.open("#v=learn&t=no-such-thing", ready=False)
    pg.wait_for_selector(".lr-index")
    assert pg.locator(".lr-card").count() == len(CONCEPTS)
    assert pg.locator(".lr-index .notice").count() == 1


def test_first_map_load_does_not_fetch_learn_code(site):
    pg = site.open()
    loaded = pg.evaluate("performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/js/learn/'))")
    assert loaded == [], loaded
