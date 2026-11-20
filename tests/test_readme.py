"""The README cannot drift from the data and the screenshots (docs/release.md, "README").

- The "Key results" block equals what scripts/readme_numbers.py builds from the data files.
- Every interval quoted in the validation table appears in the validation table of site/data/global.json.
- Every image the README uses exists, every screenshot in docs/img/readme/ is used, and none is over 400 KB.
- No old-style site screenshot (docs/img/site-*.png) is left without a reference in README.md or docs/.
- The version is the same in scripts/release.json, site/data/manifest.json, CITATION.cff, pyproject.toml and
  src/seisatlas/__init__.py (the package may add a documentation-only .postN); scripts/bump_release.py writes all of
  them, so the PyPI version check in publish-pypi.yml cannot break after a monthly update.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text()


def test_key_results_match_the_data():
    r = subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "readme_numbers.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def test_validation_intervals_come_from_the_data():
    block = README.split("## Validation (ours vs published)", 1)[1].split("\n## ", 1)[0]
    found = re.findall(r"\d\.\d{3} \[\d\.\d{3}, \d\.\d{3}\]", block)
    assert len(found) >= 6, found
    table = " ".join(str(r["ours"]) for r in json.loads((ROOT / "site" / "data" / "global.json").read_text())["validation_table"])
    missing = [s for s in found if s not in table]
    assert not missing, f"README validation numbers not in global.json: {missing}"


def test_readme_images_exist_and_are_used():
    used = set(re.findall(r"\]\((docs/img/[^)\s]+)\)", README))
    assert used, "no images found in README"
    missing = [p for p in used if not (ROOT / p).is_file()]
    assert not missing, missing
    shots = {f"docs/img/readme/{p.name}" for p in (ROOT / "docs" / "img" / "readme").glob("*.png")}
    assert shots, "docs/img/readme/ is empty"
    unused = sorted(shots - used)
    assert not unused, f"screenshots not used by README.md: {unused}"
    big = [p for p in shots if (ROOT / p).stat().st_size > 400_000]
    assert not big, big


def test_no_orphan_site_screenshots():
    text = README + "".join(p.read_text() for p in (ROOT / "docs").glob("*.md"))
    orphans = [p.name for p in (ROOT / "docs" / "img").glob("site-*.png") if p.name not in text]
    assert not orphans, f"old screenshots no document uses: {orphans}"


def test_version_is_consistent():
    rel = json.loads((ROOT / "scripts" / "release.json").read_text())["version"]
    man = json.loads((ROOT / "site" / "data" / "manifest.json").read_text())["version"]
    assert rel == man, (rel, man)


def _versions():
    import tomllib

    py = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"]
    init = re.search(r'^__version__ = "([^"]+)"$', (ROOT / "src" / "seisatlas" / "__init__.py").read_text(), re.M).group(1)
    cff = re.search(r'^version: "([^"]+)"$', (ROOT / "CITATION.cff").read_text(), re.M).group(1)
    return py, init, cff


def test_package_and_citation_versions_follow_release():
    rel = json.loads((ROOT / "scripts" / "release.json").read_text())["version"]
    py, init, cff = _versions()
    assert re.fullmatch(r"\d+\.\d+\.\d+(\.post\d+)?", py), py
    assert py.split(".post")[0] == rel, ("pyproject.toml", py, rel)
    assert init == py, ("src/seisatlas/__init__.py", init, py)
    assert cff == rel, ("CITATION.cff", cff, rel)


def test_bump_release_updates_every_version_file(tmp_path):
    """The monthly bump writes release.json, pyproject.toml, __init__.py and CITATION.cff together (on copies)."""
    import shutil

    sys.path.insert(0, str(ROOT / "scripts"))
    import bump_release as br

    for rel in ("scripts/release.json", *br.VERSION_FILES):
        (tmp_path / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / rel, tmp_path / rel)
    old = json.loads((ROOT / "scripts" / "release.json").read_text())
    new = br.main(["--cutoff", "2999-01-01"], tmp_path / "scripts" / "release.json", root=tmp_path)
    assert new == br.bump(old["version"], "patch")
    cff = (tmp_path / "CITATION.cff").read_text()
    assert f'version: "{new}"' in cff and re.search(r'^date-released: "\d{4}-\d{2}-\d{2}"$', cff, re.M)
    assert f'version = "{new}"' in (tmp_path / "pyproject.toml").read_text()       # .postN dropped
    assert f'__version__ = "{new}"' in (tmp_path / "src/seisatlas/__init__.py").read_text()
