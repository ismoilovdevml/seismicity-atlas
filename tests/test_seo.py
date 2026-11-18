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
