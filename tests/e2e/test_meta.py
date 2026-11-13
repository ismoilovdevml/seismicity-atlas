"""Sharing metadata, icons and the social-card image."""
import struct

from conftest import SITE

CANON = "https://ismoilovdevml.github.io/seismicity-atlas/"


def test_share_meta(site):
    pg = site.open(ready=False)
    meta = pg.evaluate("""() => Object.fromEntries([...document.querySelectorAll('meta[property], meta[name]')]
      .map((m) => [m.getAttribute('property') || m.getAttribute('name'), m.content]))""")
    assert pg.get_attribute("link[rel=canonical]", "href") == CANON
    assert meta["og:image"] == CANON + "og-image.png" and meta["twitter:image"] == CANON + "og-image.png"
    assert meta["twitter:card"] == "summary_large_image"
    assert len(meta["description"]) > 50 and "theme-color" in meta
    for href in ["favicon.svg", "apple-touch-icon.png", "og-image.png"]:
        r = pg.request.get(site.base + href)
        assert r.ok, href


def test_og_image_size():
    data = (SITE / "og-image.png").read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = struct.unpack(">II", data[16:24])
    assert (w, h) == (1200, 630)
    assert len(data) < 300_000
