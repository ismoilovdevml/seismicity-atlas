"""Static SEO pages (scripts/seo_pages.mjs): every sitemap URL exists, every Learn concept has a page per language."""
import re
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"
BASE = "https://seismicityatlas.org"


def test_sitemap_urls_exist():
    xml = (SITE / "sitemap.xml").read_text()
    locs = re.findall(r"<loc>(.*?)</loc>", xml)
    assert len(locs) > 80
    for loc in locs:
        rel = loc.removeprefix(BASE).lstrip("/")
        assert (SITE / rel / "index.html").exists() or rel == "", loc


def test_every_concept_has_a_page_per_language():
    ids = re.findall(r"\{ id: '([a-z0-9-]+)', group:", (SITE / "js/learn/registry.js").read_text())
    assert len(ids) >= 21
    for lang in ("", "uz/", "ru/", "es/"):
        for cid in ids:
            html = (SITE / f"{lang}learn/{cid}/index.html").read_text()
            assert '<link rel="canonical"' in html and 'hreflang="x-default"' in html and "application/ld+json" in html


def test_robots_points_to_sitemap():
    assert f"Sitemap: {BASE}/sitemap.xml" in (SITE / "robots.txt").read_text()


def test_home_has_dataset_jsonld():
    html = (SITE / "index.html").read_text()
    assert '"@type": "Dataset"' in html and "10.5281/zenodo.24228387" in html


def _jsonld_objects(html):
    """Every JSON object in the page's JSON-LD blocks, nested ones included."""
    import json

    out = []

    def walk(x):
        if isinstance(x, dict):
            out.append(x)
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        walk(json.loads(block))
    return out


def test_every_dataset_node_is_complete():
    """Google's Dataset rich result rejects any node typed Dataset without name/description (and warns without
    license/creator). A nested {"@type": "Dataset"} reference triggered that on 2026-11-18; link by @id instead."""
    pages = [SITE / "index.html"] + sorted(SITE.glob("**/learn/**/index.html"))
    for page in pages:
        for o in _jsonld_objects(page.read_text()):
            if o.get("@type") == "Dataset":
                missing = [k for k in ("name", "description", "license", "creator") if not o.get(k)]
                assert not missing, (str(page.relative_to(SITE)), missing)


def test_static_pages_social_tags_and_language():
    """Learn indexes are og:type website, concept pages article; every page has the image size/alt and Twitter tags;
    the footer notice is in the page language (it was English on every page until 2026-11-20); Russian pages preload
    the Cyrillic font subset; the dark-mode button text is dark on the light accent (white was 2.1:1)."""
    notice = {"": "Not a forecast.", "uz/": "Prognoz emas.", "ru/": "Это не прогноз.", "es/": "No es un pronóstico."}
    for lang, text in notice.items():
        idx = (SITE / f"{lang}learn/index.html").read_text()
        page = (SITE / f"{lang}learn/b-positive/index.html").read_text()
        assert '<meta property="og:type" content="website">' in idx
        assert '<meta property="og:type" content="article">' in page
        for html in (idx, page):
            for tag in ('og:image:width" content="1200"', 'og:image:height" content="630"', 'og:image:alt"',
                        'twitter:title"', 'twitter:description"', 'twitter:image"', 'twitter:image:alt"'):
                assert tag in html, (lang, tag)
            footer = html.split("<footer>", 1)[1]
            assert text in footer, lang
            if lang:
                assert "Not a forecast" not in footer, lang
            assert ('inter-400-700-cyrillic.woff2" as="font"' in html) == (lang == "ru/"), lang
            assert "color:var(--on-accent)" in html and "--on-accent:#16191d" in html


def test_release_facts_follow_release_json():
    """scripts/seo_pages.mjs writes version and cut-off from scripts/release.json into the Dataset JSON-LD of
    index.html and into the sitemap lastmod of the home page."""
    import json

    rel = json.loads((SITE.parent / "scripts" / "release.json").read_text())
    ds = [o for o in _jsonld_objects((SITE / "index.html").read_text()) if o.get("@type") == "Dataset"]
    assert len(ds) == 1
    assert ds[0]["version"] == rel["version"]
    assert ds[0]["temporalCoverage"].endswith("/" + rel["data_cutoff_utc"])
    xml = (SITE / "sitemap.xml").read_text()
    home = re.search(rf"<loc>{re.escape(BASE)}/</loc>\s*<lastmod>([^<]+)</lastmod>", xml)
    assert home and home.group(1) == rel["data_cutoff_utc"]


def test_no_unfilled_placeholders():
    """The Learn texts name example values ({nboot}, {radius} …) that the app fills from site/data; seo_pages.mjs runs
    the same loaders (site/js/learn/examples.js). Until 2026-11-24 the static pages printed 44 of them raw."""
    pages = sorted(SITE.glob("**/learn/**/index.html"))
    assert len(pages) > 80
    bad = {}
    for page in pages:
        found = re.findall(r"\{[A-Za-z_][A-Za-z0-9_]*\}", page.read_text())
        if found:
            bad[str(page.relative_to(SITE))] = sorted(set(found))
    assert not bad, bad


def test_placeholders_filled_with_manifest_values():
    """Spot check against site/data/manifest.json: the bootstrap count, the global H3 resolution (the old parser
    stripped every non-digit of "H3 resolution 2" and gave 32) and the sampling radius."""
    import json

    m = json.loads((SITE / "data" / "manifest.json").read_text())["method"]
    res = re.findall(r"\d+", m["cells"])[-1]
    boot = (SITE / "learn/confidence-interval-bootstrap/index.html").read_text()
    assert f"repeat {m['nboot']:,} times" in boot
    h3 = (SITE / "learn/h3-cells-and-sample-radius/index.html").read_text()
    assert f"Grid: H3 resolution {res} for the global layer" in h3
    assert f"within {round(m['sample_radius_km'])} km" in h3


def test_rating_page_says_it_is_not_about_local_networks():
    """The Simple-view rating counts large ISC-GEM earthquakes near a place (>= 50 above the threshold within 300 km,
    1976-2021); it says nothing about the local network. Until 2026-11-25 its title read "How well earthquakes are
    recorded", although quiet, densely instrumented places such as Zürich (1 event in its circle) get "Too little
    data". Every language says so, with the minimum count, the radius and the period floors filled in."""
    import json

    m = json.loads((SITE / "data" / "manifest.json").read_text())["method"]
    n_min = re.findall(r"\d+", m["quality"]["insufficient"])[-1]
    radius = str(round(m["sample_radius_km"]))
    floors = [f"{m['floors']['sh'][k]['floor']:.1f}" for k in sorted(m["floors"]["sh"])]
    want = {
        "": ("Global data on large earthquakes", "It does not rate the local seismic network", "Switzerland or Germany"),
        "uz/": ("Kuchli zilzilalar boʻyicha global maʼlumot", "Mahalliy seysmik tarmoq haqida u hech narsa demaydi",
                "Shveytsariya yoki Germaniya"),
        "ru/": ("Глобальные данные о сильных землетрясениях", "О местной сейсмической сети она ничего не говорит",
                "Швейцария или Германия"),
        "es/": ("Datos globales de terremotos fuertes", "No valora la red sísmica local", "Suiza o Alemania"),
    }
    old = ("How well", "qanchalik yaxshi qayd", "Насколько хорошо", "Qué tan bien")
    for lang, phrases in want.items():
        html = (SITE / f"{lang}learn/recording-rating/index.html").read_text()
        assert f"<h1>{phrases[0]}</h1>" in html, lang
        for ph in phrases[1:]:
            assert ph in html, (lang, ph)
        assert not any(o in html for o in old), lang
        for v in (n_min, radius, *floors):
            assert v in html, (lang, v)
