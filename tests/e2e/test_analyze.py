"""Your catalogue: a CSV chosen in the page is analysed in the browser; no request carries the file."""
import json
import sys
from pathlib import Path

import pytest

from conftest import no_hscroll

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_package import synth  # noqa: E402


@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "dark")])
def test_analyze_own_catalogue(site, viewport, scheme, tmp_path):
    csv = tmp_path / "events.csv"
    synth(2000, b=1.0).to_csv(csv, index=False)
    pg = site.open(viewport=viewport, scheme=scheme, ready=False)
    posts = []
    pg.on("request", lambda r: posts.append(r.url) if r.method != "GET" else None)
    pg.evaluate("location.hash = 'v=analyze'")
    pg.wait_for_selector("#an-file", state="attached", timeout=20000)
    pg.set_input_files("#an-file", str(csv))
    pg.wait_for_function("document.querySelector('.an-status').innerText.includes('2000')", timeout=20000)
    pg.click(".an-form button[type=submit]")
    pg.wait_for_selector(".an-result .an-table", timeout=60000)
    txt = pg.inner_text(".an-result")
    assert "quality A" in txt or "quality B" in txt
    assert pg.query_selector(".an-result svg.an-fmd circle") is not None
    assert not posts, posts  # nothing is uploaded
    ok, r = no_hscroll(pg)
    assert ok, r
