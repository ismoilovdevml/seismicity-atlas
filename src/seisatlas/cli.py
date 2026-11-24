"""Command line: seisatlas report CATALOG.csv [options] [-o report.html|.md|.json]"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .analysis import analyze
from .catalog import read_catalog, select
from .report import to_html, to_json, to_markdown


def _period(s: str):
    try:
        years, fl = s.split(":")
        y0, y1 = years.split("-")
        return int(y0), int(y1), float(fl)
    except ValueError:
        raise argparse.ArgumentTypeError(f"expected START-END:FLOOR, e.g. 1976-2003:6.3, got {s!r}")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="seisatlas", description="Mc and b-value with uncertainty for an earthquake "
                                "catalogue (method of the Global Seismicity Atlas). Not a forecast.")
    p.add_argument("--version", action="version", version=f"seisatlas {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report", help="analyse a CSV catalogue and write a report")
    r.add_argument("catalog", help="CSV file with at least a magnitude column (see seisatlas.catalog)")
    r.add_argument("-o", "--output", help="report file: .html, .md or .json (default: Markdown to stdout)")
    r.add_argument("--lat", type=float)
    r.add_argument("--lon", type=float)
    r.add_argument("--radius-km", type=float, help="keep events within this distance of --lat/--lon")
    r.add_argument("--depth-min", type=float)
    r.add_argument("--depth-max", type=float)
    r.add_argument("--start", help="first date, e.g. 2000-01-01")
    r.add_argument("--end", help="end date (exclusive)")
    r.add_argument("--mag-type", help="keep one magnitude type, e.g. mw or ml")
    r.add_argument("--floor", type=float, help="completeness floor for every event (b uses max(Mc, floor))")
    r.add_argument("--floor-period", type=_period, action="append",
                   help="per-period floor START-END:FLOOR, e.g. 1976-2003:6.3 (repeatable)")
    r.add_argument("--dm", type=float, default=0.1, help="magnitude bin (default 0.1)")
    r.add_argument("--nboot", type=int, default=1000, help="bootstrap replicates (default 1000)")
    r.add_argument("--seed", type=int, default=20261116)
    a = p.parse_args(argv)
    try:
        cat = read_catalog(a.catalog, mag_type=a.mag_type)
        cat = select(cat, lat=a.lat, lon=a.lon, radius_km=a.radius_km, depth_min=a.depth_min, depth_max=a.depth_max,
                     start=a.start, end=a.end)
        res = analyze(cat, dm=a.dm, nboot=a.nboot, seed=a.seed, floor=a.floor, floor_periods=a.floor_period)
    except (ValueError, OSError) as e:
        print(f"seisatlas: {e}", file=sys.stderr)
        return 2
    res["selection"] = {k: getattr(a, k) for k in ("lat", "lon", "radius_km", "depth_min", "depth_max", "start",
                                                   "end", "mag_type")}
    out = Path(a.output) if a.output else None
    text = (to_html(res) if out and out.suffix.lower() in (".html", ".htm")
            else to_json(res) if out and out.suffix.lower() == ".json" else to_markdown(res))
    if out:
        out.write_text(text, encoding="utf-8")
        b = res.get("b", {})
        print(f"wrote {out}: {res['n_events']} events, Mc {res.get('mc', {}).get('maxc02')}, "
              f"b {b.get('b')} [{b.get('b_lo')}, {b.get('b_hi')}] quality {b.get('quality')}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
