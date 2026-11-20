"""Your catalogue: a CSV chosen in the page is analysed in the browser; no request carries the file."""
import math
import random

import pytest

from conftest import no_hscroll


def write_catalogue(path, n=2000, b=1.0, mc=3.0, seed=1, split_time=False):
    """Gutenberg-Richter magnitudes with a detection roll-off, pure Python (the e2e job has no numpy).
    split_time: separate date and time-of-day columns, as many national-network exports have."""
    rnd = random.Random(seed)
    rows = ["date,time,latitude,longitude,mag,magType" if split_time else "time,latitude,longitude,depth,mag,magType"]
    k = 0
    while k < n:
        m = (mc - 0.6) + rnd.expovariate(b * math.log(10))
        if rnd.random() < 1 / (1 + math.exp(-(m - (mc - 0.2)) / 0.08)):
            k += 1
            day, hour = f"2010-{1 + k % 12:02d}-{1 + k % 28:02d}", f"{k % 24:02d}:00:00"
            rows.append(f"{day},{hour},38.0,142.0,{m:.1f},ml" if split_time
                        else f"{day}T{hour}Z,38.0,142.0,20,{m:.1f},ml")
    path.write_text("\n".join(rows) + "\n")


def open_analyze(site, csv, lang=None, **kw):
    pg = site.open(viewport=kw.get("viewport", "desktop"), scheme=kw.get("scheme", "light"), ready=False)
    pg.workers_seen = []
    pg.on("worker", lambda w: pg.workers_seen.append(w.url))
    pg.posts = []
    pg.on("request", lambda r: pg.posts.append(r.url) if r.method != "GET" else None)
    pg.evaluate(f"location.hash = 'v=analyze{'&lang=' + lang if lang else ''}'")
    pg.wait_for_selector("#an-file", state="attached", timeout=20000)
    pg.set_input_files("#an-file", str(csv))
    pg.wait_for_function("document.querySelector('.an-status').innerText.includes('2000')", timeout=20000)
    return pg


@pytest.mark.parametrize("viewport,scheme", [("desktop", "light"), ("phone", "dark")])
def test_analyze_own_catalogue(site, viewport, scheme, tmp_path):
    csv = tmp_path / "events.csv"
    write_catalogue(csv)
    pg = open_analyze(site, csv, viewport=viewport, scheme=scheme)
    pg.click(".an-form button[type=submit]")
    pg.wait_for_selector(".an-result .an-table", timeout=60000)
    txt = pg.inner_text(".an-result")
    assert "quality A" in txt or "quality B" in txt
    assert pg.query_selector(".an-result svg.an-fmd circle") is not None
    assert pg.query_selector(".an-result svg.an-fmd line.an-fit") is not None
    assert not pg.is_disabled(".an-form button[type=submit]")
    assert any(u.endswith("/js/analyze/worker.js") for u in pg.workers_seen), pg.workers_seen  # off the main thread
    assert not pg.posts, pg.posts  # nothing is uploaded
    ok, r = no_hscroll(pg)
    assert ok, r


def test_analyze_page_stays_responsive_and_shows_progress(site, tmp_path):
    """20000 events x 5000 replicates run in the worker: the main thread keeps drawing frames (on the main thread the
    longest frame gap was 1.8 s), the status shows the progress and the button is disabled meanwhile."""
    csv = tmp_path / "events.csv"
    write_catalogue(csv, n=20000)
    pg = open_analyze(site, csv)
    pg.click(".an-opts summary")
    pg.fill("#an-nboot", "5000")
    pg.evaluate("""() => { window.__maxGap = 0; window.__progress = []; let last = performance.now();
      const st = document.querySelector('.an-status');
      new MutationObserver(() => window.__progress.push(st.innerText))
        .observe(st, {childList: true, characterData: true, subtree: true});
      const tick = () => { const now = performance.now(); window.__maxGap = Math.max(window.__maxGap, now - last);
        last = now; if (!document.querySelector('.an-result .an-table')) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); }""")
    pg.click(".an-form button[type=submit]")
    assert pg.is_disabled(".an-form button[type=submit]")
    pg.wait_for_selector(".an-result .an-table", timeout=120000)
    gap = pg.evaluate("window.__maxGap")
    assert gap < 1000, f"main thread blocked for {gap:.0f} ms"
    assert any("% of the bootstrap" in s for s in pg.evaluate("window.__progress"))
    assert not pg.is_disabled(".an-form button[type=submit]")


def test_analyze_falls_back_to_the_main_thread(site, tmp_path):
    """A worker that cannot load (old browser, blocked script) fires an error event: the job runs on the page."""
    csv = tmp_path / "events.csv"
    write_catalogue(csv)
    pg = site.open(ready=False)
    pg.evaluate("""() => { window.Worker = class extends EventTarget { constructor() { super();
      setTimeout(() => this.onerror && this.onerror(new Event('error')), 10); } postMessage() {} terminate() {} }; }""")
    pg.evaluate("location.hash = 'v=analyze'")
    pg.wait_for_selector("#an-file", state="attached", timeout=20000)
    pg.set_input_files("#an-file", str(csv))
    pg.wait_for_function("document.querySelector('.an-status').innerText.includes('2000')", timeout=20000)
    pg.click(".an-form button[type=submit]")
    pg.wait_for_selector(".an-result .an-table", timeout=60000)
    assert "quality A" in pg.inner_text(".an-result") or "quality B" in pg.inner_text(".an-result")


def test_analyze_date_and_time_columns_and_translated_errors(site, tmp_path):
    """Separate date and time columns give times; a depth limit on a file without depth is a translated error."""
    csv = tmp_path / "split.csv"
    write_catalogue(csv, split_time=True)
    pg = open_analyze(site, csv, lang="uz")
    pg.click(".an-opts summary")
    pg.fill("#an-dmax", "30")
    pg.click(".an-form button[type=submit]")
    pg.wait_for_function("document.querySelector('.an-status').innerText.includes('chuqurlik ustuni kerak')",
                         timeout=20000)
    pg.fill("#an-dmax", "")
    pg.click(".an-form button[type=submit]")
    pg.wait_for_selector(".an-result .an-table", timeout=60000)
    assert "2010-01-01 – 2010-12-28" in pg.inner_text(".an-result")  # the time range comes from date + time
