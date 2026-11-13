#!/usr/bin/env bash
# Reproduce every number, figure and site/data file from the cached downloads (data/raw/, gitignored).
# First run downloads ~75 MB; later runs reuse the cache. Use `fetch.py all --refresh` to pull newer data.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-.venv/bin/python}
$PY -I scripts/fetch.py all --end 2026-11-13
$PY -I scripts/prepare.py
$PY -I scripts/atlas.py 200      # radius sensitivity runs (write data/work/cells_r*.pkl only)
$PY -I scripts/atlas.py 400
$PY -I scripts/atlas.py          # main run, 300 km
$PY -I scripts/validate.py
$PY -I scripts/sequences.py
$PY -I scripts/site_layers.py
$PY -I scripts/figures.py
[ "${SKIP_REGIONAL:-0}" = 1 ] || $PY -I scripts/regional/build_regional.py || echo "regional layers: build failed, previous output kept"
$PY -I -m pytest -q tests
