"""The installable package seisatlas: reader, selection, analyze(), reports and the command line."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import seisatlas as sa  # noqa: E402
from seisatlas.cli import main  # noqa: E402


def synth(n=3000, b=1.0, mc=3.0, seed=1, start="2000-01-01", years=10, magtype="ml"):
    """Gutenberg-Richter magnitudes above mc - 0.6 with a logistic detection roll-off centred at mc - 0.2."""
    rng = np.random.default_rng(seed)
    m = (mc - 0.6) + rng.exponential(1 / (b * np.log(10)), 4 * n)
    keep = rng.random(m.size) < 1 / (1 + np.exp(-(m - (mc - 0.2)) / 0.08))
    m = m[keep][:n]
    t = pd.Timestamp(start) + pd.to_timedelta(np.sort(rng.random(m.size)) * years * 365.25, unit="D")
    return pd.DataFrame({"time": t.astype(str), "latitude": 38 + rng.normal(0, 0.5, m.size),
                         "longitude": 142 + rng.normal(0, 0.5, m.size), "depth": rng.uniform(0, 60, m.size),
                         "mag": np.round(m, 1), "magType": magtype})


def test_version_matches_release():
    rel = json.loads((ROOT / "scripts" / "release.json").read_text())
    assert sa.__version__ == rel["version"]


def test_reader_maps_comcat_columns_and_filters_type():
    df = pd.concat([synth(500), synth(200, magtype="mb", seed=2)])
    cat = sa.read_catalog(df)
    assert {"mag", "time", "latitude", "longitude", "depth", "magtype"} <= set(cat.events.columns)
    assert len(cat) == 700 and cat.events["time"].is_monotonic_increasing
    assert len(sa.read_catalog(df, mag_type="ML")) == 500


def test_reader_drops_bad_magnitudes_and_needs_a_magnitude():
    df = pd.DataFrame({"Magnitude": [3.1, None, 12.0, 2.5]})
    cat = sa.read_catalog(df)
    assert len(cat) == 2 and cat.dropped["missing_or_out_of_range_magnitude"] == 2
    with pytest.raises(ValueError):
        sa.read_catalog(pd.DataFrame({"x": [1.0]}))


def test_select_radius_depth_time():
    cat = sa.read_catalog(synth(2000))
    near = sa.select(cat, lat=38, lon=142, radius_km=30)
    assert 0 < len(near) < len(cat)
    assert (sa.select(cat, depth_max=30).events["depth"] <= 30).all()
    assert len(sa.select(cat, start="2005-01-01")) < len(cat)


def test_analyze_recovers_b_with_quality():
    res = sa.analyze(sa.read_catalog(synth(3000, b=1.0)), nboot=300)
    b = res["b"]
    assert b["quality"] in ("A", "B") and b["shown"]
    assert b["b_lo"] <= 1.0 <= b["b_hi"]
    assert abs(res["mc"]["maxc02"] - 3.0) <= 0.3
    assert res["b_positive"]["n_differences"] > 0
    assert sum(res["fmd"]["count"]) == res["n_events"]
    json.dumps(res)  # serialisable


def test_analyze_small_sample_gives_no_b():
    res = sa.analyze(sa.read_catalog(synth(40)), nboot=200)
    assert res["b"]["quality"] == "insufficient" and res["b"]["b"] is None
    assert any("Fewer than" in w for w in res["warnings"])


def test_warnings_for_mixed_types_and_changing_completeness():
    early = synth(1500, mc=3.6, seed=3, start="1990-01-01", years=5)
    late = synth(1500, mc=2.8, seed=4, start="2000-01-01", years=5, magtype="mb")
    res = sa.analyze(sa.read_catalog(pd.concat([early, late])), nboot=200)
    text = " ".join(res["warnings"])
    assert "Mixed magnitude types" in text and "completeness changed" in text
    fixed = sa.analyze(sa.read_catalog(pd.concat([early, late])), nboot=200,
                       floor_periods=[(1990, 1994, 3.6), (1995, 2009, 2.8)])
    assert "completeness changed" not in " ".join(fixed["warnings"])


def test_reports_render():
    res = sa.analyze(sa.read_catalog(synth(1500)), nboot=200)
    md, page = sa.to_markdown(res), sa.to_html(res)
    assert "b-value [95 %]" in md and "Not an earthquake forecast" in md
    assert page.startswith("<!doctype html>") and "<svg" in page and "<table>" in page and "<ul>" in page
    assert "http" not in page.split("<body>")[0]  # no external resources in the head


def test_cli_writes_reports(tmp_path, capsys):
    csv = tmp_path / "events.csv"
    synth(1500).to_csv(csv, index=False)
    for ext in ("html", "json", "md"):
        out = tmp_path / f"r.{ext}"
        assert main(["report", str(csv), "--nboot", "200", "-o", str(out)]) == 0
        assert out.stat().st_size > 500
    assert json.loads((tmp_path / "r.json").read_text())["b"]["quality"] in ("A", "B")
    assert main(["report", str(csv), "--nboot", "200", "--lat", "38", "--lon", "142", "--radius-km", "50",
                 "--floor-period", "2000-2004:3.0"]) == 0
    bad = tmp_path / "bad.csv"
    bad.write_text("a,b\n1,2\n")
    assert main(["report", str(bad)]) == 2
