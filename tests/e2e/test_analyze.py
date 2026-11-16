"""Your catalogue: a CSV chosen in the page is analysed in the browser; no request carries the file."""
import math
import random

import pytest

from conftest import no_hscroll


def write_catalogue(path, n=2000, b=1.0, mc=3.0, seed=1):
    """Gutenberg-Richter magnitudes with a detection roll-off, pure Python (the e2e job has no numpy)."""
    rnd = random.Random(seed)
    rows = ["time,latitude,longitude,depth,mag,magType"]
    k = 0
    while k < n:
        m = (mc - 0.6) + rnd.expovariate(b * math.log(10))
        if rnd.random() < 1 / (1 + math.exp(-(m - (mc - 0.2)) / 0.08)):
            k += 1
            rows.append(f"2010-{1 + k % 12:02d}-{1 + k % 28:02d}T{k % 24:02d}:00:00Z,38.0,142.0,20,{m:.1f},ml")
    path.write_text("\n".join(rows) + "\n")


@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "dark")])
def test_analyze_own_catalogue(site, viewport, scheme, tmp_path):
    csv = tmp_path / "events.csv"
    write_catalogue(csv)
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
