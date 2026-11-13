"""Set a new data cut-off in scripts/release.json and bump the patch version (0.1.0 -> 0.1.1).

The version in release.json is written into site/data/manifest.json by scripts/site_layers.py.
Patch = data refresh with the same schema; minor = schema change (docs/data-schema.md); see docs/release.md.

Usage
  python -I scripts/bump_release.py --cutoff 2026-12-01            # data refresh: patch bump
  python -I scripts/bump_release.py --cutoff 2026-12-01 --part minor
  python -I scripts/bump_release.py --part minor                   # method change, same data cut-off
Prints the new version. With --cutoff, exits 0 without changes if the cut-off is not later than the current one.
Without --cutoff, --part minor or major is required and only the version changes.
"""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

RELEASE = Path(__file__).resolve().parent / "release.json"


def bump(version: str, part: str) -> str:
    major, minor, patch = (int(x) for x in version.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def main(argv=None, path: Path = RELEASE) -> str:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cutoff", type=date.fromisoformat, help="YYYY-MM-DD (UTC); omit for a method-only bump")
    ap.add_argument("--part", choices=["patch", "minor", "major"], default="patch")
    a = ap.parse_args(argv)
    rel = json.loads(path.read_text())
    if a.cutoff is None:
        if a.part == "patch":
            ap.error("a method-only bump (no --cutoff) needs --part minor or --part major")
        rel = {"version": bump(rel["version"], a.part), "data_cutoff_utc": rel["data_cutoff_utc"]}
        path.write_text(json.dumps(rel, indent=1) + "\n")
        print(rel["version"])
        return rel["version"]
    if a.cutoff <= date.fromisoformat(rel["data_cutoff_utc"]):
        print(rel["version"])
        return rel["version"]
    rel = {"version": bump(rel["version"], a.part), "data_cutoff_utc": a.cutoff.isoformat()}
    path.write_text(json.dumps(rel, indent=1) + "\n")
    print(rel["version"])
    return rel["version"]


if __name__ == "__main__":
    main()
