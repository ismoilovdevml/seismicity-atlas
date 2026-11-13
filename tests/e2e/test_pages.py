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
