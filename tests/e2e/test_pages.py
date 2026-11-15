"""Sequences, Validation and About pages."""
import pytest

from conftest import no_hscroll


@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "light"), ("desktop", "dark")])
def test_pages_render(site, viewport, scheme):
    pg = site.open(viewport=viewport, scheme=scheme, ready=False)
    for v, root in [("sequences", "#seq-root"), ("methods", "#methods-root"), ("about", "#about-root")]:
        pg.evaluate(f"location.hash = 'v={v}'")
        pg.wait_for_function(f"document.querySelector('{root}').innerText.length > 500", timeout=20000)
        txt = pg.inner_text(root)
        assert "could not be loaded" not in txt
        ok, r = no_hscroll(pg)
        assert ok, (v, r)
        if v == "sequences":
            assert pg.evaluate("document.querySelectorAll('.seq').length") == 40
        if v == "methods":
            assert pg.evaluate("document.querySelectorAll('.vtable tbody tr').length") >= 20
            assert "Mismatch" in txt and "Not testable" in txt
        if v == "about":
            assert "CC BY-SA 3.0" in txt and "CC BY-SA 4.0" in txt and "MIT" in txt
            assert pg.query_selector("a[href*='openquake']") is not None
            # licence details (ISC-GEM co-owner, exceptions, three.js and the colour maps)
            assert "International Seismological Centre and GEM Foundation" in txt
            assert "ODC-BY 1.0" in txt and "CC0 1.0" in txt and "three.js 0.170.0" in txt and "Scientific colour maps 8.0.1" in txt
            # "as is" data disclaimer, privacy note and accessibility contact
            assert pg.is_visible("#about-asis") and "provided as is, without warranty" in pg.inner_text("#about-asis")
            priv = pg.inner_text("#about-privacy")
            assert "no cookies" in priv and "local storage" in priv and "GitHub Pages" in priv
            assert pg.query_selector("#about-privacy a[href*='privacy-statement']") is not None
            assert pg.query_selector("#about-a11y a[href$='/seismicity-atlas/issues']") is not None


@pytest.mark.parametrize("lang,asis,privacy", [("uz", "kafolatsiz", "cookie"), ("ru", "«как есть»", "cookie"),
                                               ("es", "tal cual", "cookies")])
def test_about_notes_translated(site, lang, asis, privacy):
    pg = site.open(ready=False)
    pg.evaluate(f"location.hash = 'v=about&lang={lang}'")
    pg.wait_for_function("document.querySelector('#about-privacy') && document.querySelector('#about-asis')", timeout=20000)
    assert asis in pg.inner_text("#about-asis")
    p = pg.inner_text("#about-privacy")
    assert privacy in p and "local storage" not in p   # translated, not the English fallback
    assert pg.inner_text("#about-a11y-h") != "Accessibility"
