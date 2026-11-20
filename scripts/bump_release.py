"""Set a new data cut-off in scripts/release.json and bump the patch version (0.1.0 -> 0.1.1).

The version in release.json is written into site/data/manifest.json by scripts/site_layers.py. When the version
changes, the same version is also written to pyproject.toml and src/seisatlas/__init__.py (a documentation-only
.postN suffix there is dropped), and to CITATION.cff (version, date-released = today, UTC), so that the PyPI version
check (publish-pypi.yml) and tests/test_readme.py keep agreeing after the monthly update. scripts/seo_pages.mjs then
copies version and cut-off into the JSON-LD of site/index.html.
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
import re
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "scripts" / "release.json"
# file -> (pattern of the version line, replacement); each pattern must match exactly once
VERSION_FILES = {
    "pyproject.toml": (r'^version = "[^"]*"$', 'version = "{v}"'),
    "src/seisatlas/__init__.py": (r'^__version__ = "[^"]*"$', '__version__ = "{v}"'),
    "CITATION.cff": (r'^version: "[^"]*"$', 'version: "{v}"'),
}


def bump(version: str, part: str) -> str:
    major, minor, patch = (int(x) for x in version.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def sync_versions(root: Path, version: str, released: date) -> None:
    """Write `version` into pyproject.toml, src/seisatlas/__init__.py and CITATION.cff (plus its date-released)."""
    for rel, (pattern, repl) in VERSION_FILES.items():
        f = root / rel
        text, n = re.subn(pattern, repl.format(v=version), f.read_text(), count=1, flags=re.M)
        if rel == "CITATION.cff":
            text, m = re.subn(r'^date-released: "[^"]*"$', f'date-released: "{released.isoformat()}"', text, count=1, flags=re.M)
            n = min(n, m)
        if n != 1:
            raise SystemExit(f"{rel}: version line not found")
        f.write_text(text)


def _write(path: Path, rel: dict, root: Path | None) -> str:
    path.write_text(json.dumps(rel, indent=1) + "\n")
    if root is not None:
        sync_versions(root, rel["version"], datetime.now(timezone.utc).date())
    print(rel["version"])
    return rel["version"]


def main(argv=None, path: Path = RELEASE, root: Path | None = None) -> str:
    """`root` is the repository whose version files follow release.json; by default the real repository when `path`
    is the real release.json, none otherwise (tests pass a temporary release.json)."""
    if root is None and path == RELEASE:
        root = ROOT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cutoff", type=date.fromisoformat, help="YYYY-MM-DD (UTC); omit for a method-only bump")
    ap.add_argument("--part", choices=["patch", "minor", "major"], default="patch")
    a = ap.parse_args(argv)
    rel = json.loads(path.read_text())
    if a.cutoff is None:
        if a.part == "patch":
            ap.error("a method-only bump (no --cutoff) needs --part minor or --part major")
        rel = {**rel, "version": bump(rel["version"], a.part)}
        return _write(path, rel, root)
    if a.cutoff <= date.fromisoformat(rel["data_cutoff_utc"]):
        print(rel["version"])
        return rel["version"]
    rel = {**rel, "version": bump(rel["version"], a.part), "data_cutoff_utc": a.cutoff.isoformat()}
    return _write(path, rel, root)


if __name__ == "__main__":
    main()
