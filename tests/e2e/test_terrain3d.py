"""Relief and water base map, optional 3D terrain (external tiles mocked), and the Depth 3D view."""
import re
import struct
import zlib

import pytest

from conftest import jump, no_hscroll

AWS = "https://s3.amazonaws.com/elevation-tiles-prod/**"


def _png(w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)  # noqa: E731
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def _terrarium_tile():
    """A 256 px Terrarium tile with one 3000 m bump (elevation = R*256 + G + B/256 - 32768)."""
    rows = []
    for y in range(256):
        row = []
        for x in range(256):
            d2 = ((x - 128) ** 2 + (y - 128) ** 2) / 60.0 ** 2
            v = int(32768 + 3000 * 2.718281828 ** (-d2))
            row += [v >> 8, v & 255, 0]
        rows.append(row)
    return _png(256, 256, rows)


TILE = _terrarium_tile()


class Terrain:
    """Serves the mocked elevation tiles and records them; aborts any other external request."""

    def __init__(self):
        self.aws, self.other = [], []

    def aws_route(self, route):
        self.aws.append(route.request.url)
        route.fulfill(status=200, body=TILE, content_type="image/png", headers={"Access-Control-Allow-Origin": "*"})

    def routes(self):
        return [(AWS, self.aws_route)]


def external(pg, base):
    """Record requests that leave the local test server."""
    seen = []
    pg.on("request", lambda r: seen.append(r.url) if not r.url.startswith(base) and r.url.startswith("http") else None)
    return seen


def layer_vis(pg, lid):
    return pg.evaluate("(l) => window.__map.getLayer(l) ? (window.__map.getLayoutProperty(l, 'visibility') || 'visible') : 'missing'", lid)


# ---------------------------------------------------------------- relief and water

def test_relief_default_and_toggle(site, base_url):
    pg = site.open()
    assert layer_vis(pg, "relief") == "visible" and layer_vis(pg, "rivers") == "visible"
    assert pg.is_checked("#chk-relief") and not pg.is_checked("#chk-terrain")
    pg.wait_for_function("window.__map.isSourceLoaded('relief') && window.__map.querySourceFeatures('water').length > 50")
    # relief and water sit under the cells, so cell colours are never changed by the base map
    order = pg.evaluate("() => window.__map.getStyle().layers.map((l) => l.id)")
    assert order.index("relief") < order.index("cells-fill") and order.index("rivers") < order.index("cells-fill")
    pg.uncheck("#chk-relief")
    pg.wait_for_timeout(150)
    assert layer_vis(pg, "relief") == "none" and layer_vis(pg, "lakes") == "none"
    assert "rl=0" in pg.evaluate("location.hash")
    pg2 = site.open(pg.evaluate("location.hash"))
    assert not pg2.is_checked("#chk-relief") and layer_vis(pg2, "relief") == "none"


def test_relief_globe_and_antimeridian(site, base_url):
    reqs = []

    def rec(route):
        reqs.append(route.request.url)
        route.continue_()
    # Chukotka (west of 180 degrees) and Alaska (east of it) in one view, on the globe
    pg = site.open("#v=map&g=1&at=3/65/180", routes=[("**/basemap/relief/**", rec)])
    pg.wait_for_function("window.__map.isSourceLoaded('relief')")
    zx = [(int(m.group(1)), int(m.group(2))) for u in reqs for m in [re.search(r"/relief/(\d+)/(\d+)/", u)] if m]
    # tiles on both sides of the antimeridian: the first and the last column of the same zoom
    assert any((z, 0) in zx and (z, 2 ** z - 1) in zx for z in range(1, 5)), zx
    pg.evaluate("() => window.__map.setProjection({type: 'mercator'})")
    jump(pg, -179.5, 65, 3)
    pg.wait_for_function("window.__map.isSourceLoaded('relief')")


# ---------------------------------------------------------------- 3D terrain (external tiles mocked)

def test_terrain_toggle_mocked(site, base_url):
    tr = Terrain()
    pg = site.open(routes=tr.routes())
    out = external(pg, base_url)
    pg.wait_for_timeout(500)
    assert not tr.aws and not out, "terrain must be opt-in: no external request by default"
    assert pg.is_hidden("#attrib-terrain")
    pg.check("#chk-terrain")
    pg.wait_for_function("window.__map.getTerrain() && window.__map.getPitch() > 40 && !window.__map.isMoving()")
    assert "tr=1" in pg.evaluate("location.hash")
    assert tr.aws and all("/terrarium/" in u for u in tr.aws)
    assert set(out) <= set(tr.aws), set(out) - set(tr.aws)
    assert pg.is_visible("#attrib-terrain")
    text = pg.inner_text("#attrib-terrain")
    assert "Terrain Tiles" in text and "ETOPO1" in text
    pg.click("#attrib-terrain-more")
    full = pg.inner_text("#attrib-terrain-list")
    assert "courtesy of the U.S. Geological Survey" in full and "© Kartverket" in full
    assert layer_vis(pg, "terrain-shade") == "visible" and layer_vis(pg, "relief") == "none"
    pg.uncheck("#chk-terrain")
    pg.wait_for_function("!window.__map.getTerrain() && window.__map.getPitch() < 1 && !window.__map.isMoving()")
    assert pg.is_hidden("#attrib-terrain") and layer_vis(pg, "relief") == "visible"
    assert "tr=1" not in pg.evaluate("location.hash")


def test_terrain_in_globe_mocked(site):
    tr = Terrain()
    pg = site.open("#v=map&g=1&tr=1&at=3/36/138", routes=tr.routes())
    pg.wait_for_function("window.__map.getTerrain() !== null")
    assert pg.evaluate("window.__map.getProjection().type") == "globe"
    assert pg.is_checked("#chk-terrain") and tr.aws


# ---------------------------------------------------------------- Depth 3D view

PRESETS = ["japan", "chile", "tonga", "hindukush", "italy", "iceland", "view"]


def open_depth(site, hash_="#v=depth", **kw):
    pg = site.open(hash_, **kw)
    pg.wait_for_selector("#d3-caption:not(:empty)", timeout=30000)
    return pg


def is3d(pg):
    return pg.evaluate("() => { const c = document.querySelector('canvas.d3-canvas'); return !!c && !c.hidden && !!c.dataset.view; }")


def test_depth_presets(site):
    pg = open_depth(site)
    assert pg.evaluate("document.title").startswith("Earthquakes in depth")
    assert pg.get_attribute("#nav a[data-view=depth]", "aria-current") == "page"
    for p in PRESETS:
        pg.select_option("#d3-preset", p)
        pg.wait_for_function("(p) => location.hash.includes('p3=' + p) || (p === 'japan' && !location.hash.includes('p3='))", arg=p)
        pg.wait_for_function("() => /\\d events M/.test(document.getElementById('d3-caption').textContent)")
        n = int(re.search(r"([\d,]+) events M", pg.inner_text("#d3-caption")).group(1).replace(",", ""))
        assert n > 0 or p == "view", (p, n)
        assert pg.is_disabled("#d3-slab") == (p in ("iceland", "view")), p
        rows = pg.locator("#d3-stats .d3-bins tbody tr").count()
        assert rows == 6, (p, rows)
    pg.select_option("#d3-preset", "japan")
    pg.wait_for_function("() => document.querySelectorAll('#d3-stats .d3-forest li').length > 3")
    vals = pg.locator("#d3-stats .d3-forest .d3-val").all_inner_texts()
    assert vals and all(re.fullmatch(r"\d\.\d\d \[\d\.\d\d, \d\.\d\d\] [AB]", v) for v in vals), vals[:3]
    # a cell row opens that cell on the map
    href = pg.get_attribute("#d3-stats .d3-forest a >> nth=0", "href")
    assert re.match(r"#v=map&c=[0-9a-f]{15}&d=(sh|dp)&lang=en$", href), href


def test_depth_orbit_keyboard_and_reset(site):
    pg = open_depth(site, "#v=depth&p3=japan")
    if not is3d(pg):
        pytest.skip("no WebGL 2 in this browser build; the fallback is tested separately")
    v0 = pg.get_attribute("canvas.d3-canvas", "data-view")
    pg.focus("canvas.d3-canvas")
    pg.keyboard.press("ArrowRight")
    pg.keyboard.press("ArrowUp")
    pg.keyboard.press("+")
    pg.wait_for_timeout(100)
    v1 = pg.get_attribute("canvas.d3-canvas", "data-view")
    assert v1 != v0
    # mouse drag rotates too
    box = pg.locator("canvas.d3-canvas").bounding_box()
    pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] / 2 + 80, box["y"] + box["height"] / 2 + 20, steps=4)
    pg.mouse.up()
    pg.wait_for_timeout(100)
    assert pg.get_attribute("canvas.d3-canvas", "data-view") != v1
    pg.click("#d3-reset")
    pg.wait_for_timeout(100)
    assert pg.get_attribute("canvas.d3-canvas", "data-view") == v0
    # depth axis labels in km on screen
    ticks = [t for t in pg.locator(".d3-label.tick:visible").all_inner_texts()]
    assert "0" in ticks and "100" in ticks, ticks
    # exaggeration control: hash and caption follow
    pg.fill("#d3-ex", "4")
    pg.dispatch_event("#d3-ex", "input")
    pg.wait_for_function("() => location.hash.includes('x3=4')")
    assert "×4" in pg.inner_text("#d3-caption")


def test_depth_cross_section_and_m5(site):
    pg = open_depth(site, "#v=depth&p3=chile&m3=xs")
    pg.wait_for_selector(".d3-xs svg .xs-events circle")
    n6 = pg.locator(".d3-xs svg .xs-events circle").count()
    assert n6 > 20 and pg.locator(".d3-xs svg .xs-slab").count() >= 1
    pg.check("#d3-m5")
    pg.wait_for_function("(n) => document.querySelectorAll('.d3-xs svg .xs-events circle').length > n", arg=n6, timeout=60000)
    assert "e3=5" in pg.evaluate("location.hash")


NO_WEBGL = """(() => { const g = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (/webgl/.test(type) && this.closest && this.closest('#view-depth')) return null;
    return g.call(this, type, opts); }; })();"""


def test_depth_fallback_without_webgl(browser, base_url):
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    ctx.add_init_script(NO_WEBGL)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(base_url + "#v=depth&p3=tonga")
    pg.wait_for_selector(".d3-xs svg .xs-events circle", timeout=30000)
    assert pg.is_visible(".d3-nowebgl")
    assert pg.is_disabled("#d3-reset")
    assert pg.locator("#d3-stats .d3-bins tbody tr").count() == 6
    ctx.close()
    assert not [e for e in errs if "WebGL" not in e and "Failed to load resource" not in e], errs


@pytest.mark.parametrize("mode", ["3d", "xs"])
def test_depth_phone(site, mode):
    pg = open_depth(site, f"#v=depth&p3=hindukush&m3={mode}", viewport="phone")
    ok, r = no_hscroll(pg)
    assert ok, r
    if mode == "xs":
        assert pg.locator(".d3-xs svg .xs-events circle").count() > 5
    else:
        assert is3d(pg) or pg.is_visible(".d3-nowebgl")


def test_depth_language_and_state(site):
    pg = open_depth(site, "#v=depth&p3=italy&x3=3&s3=0")
    assert not pg.is_checked("#d3-slab") and pg.input_value("#d3-ex") == "3"
    pg.select_option("#lang-select", "es")
    pg.wait_for_function("() => document.querySelector('.d3-head h1').textContent === 'Sismos en profundidad'")
    h = pg.evaluate("location.hash")
    assert all(k in h for k in ("v=depth", "p3=italy", "x3=3", "s3=0", "lang=es")), h
    pg.click("#nav a[data-view=map]")
    pg.wait_for_selector("#view-map:not([hidden])")
    assert "lang=es" in pg.evaluate("location.hash")
