#!/usr/bin/env bash
# Reproduce every number, figure and site/data file from the cached downloads (data/raw/, gitignored).
# First run downloads ~75 MB; later runs reuse the cache. To pull newer data, see docs/release.md.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-.venv/bin/python}
# data cut-off and version come from scripts/release.json (bumped by scripts/bump_release.py)
CUTOFF=$($PY -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["data_cutoff_utc"])' scripts/release.json)
$PY -I scripts/fetch.py all --end "$CUTOFF"
$PY -I scripts/prepare.py
$PY -I scripts/atlas.py 200      # radius sensitivity runs (write data/work/cells_r*.pkl only)
$PY -I scripts/atlas.py 400
$PY -I scripts/atlas.py          # main run, 300 km
$PY -I scripts/validate.py
$PY -I scripts/val_chile.py      # Chile b sensitivity -> results/val_chile.json
$PY -I scripts/val_literature.py # published b / beta / Mc comparison -> results/val_literature.json
$PY -I scripts/val_bpos.py       # b-positive vs b diagnosis -> results/val_bpos.json, docs/img/bpos_*.png
$PY -I scripts/sequences.py
$PY -I scripts/val_bt.py         # retrospective b before/after each sequence -> sequences.json `bt`
$PY -I scripts/site_layers.py
$PY -I scripts/figures.py
[ "${SKIP_REGIONAL:-0}" = 1 ] || $PY -I scripts/regional/build_regional.py || echo "regional layers: build failed, previous output kept"
$PY -I -m pytest -q tests
