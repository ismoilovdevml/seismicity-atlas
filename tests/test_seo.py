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
