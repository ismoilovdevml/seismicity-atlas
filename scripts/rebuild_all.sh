#!/usr/bin/env bash
# Full release rebuild: run_all.sh plus the layers that are not part of it (deficit, Groningen, OAF validation,
# N-test, Italy HD comparison, GEM hazard overlap). Long CPU job: run it on a build server, not a laptop.
# Not here: scripts/monitor/build_monitor.py. The ongoing-sequence monitor runs to a live cut-off every 3 hours
# (.github/workflows/update-monitor.yml); running it at the release cut-off would replace the live output with an
# older snapshot until the next scheduled run.
# GEM_GPKG=/path/to/gem_gshm_v2026.1.gpkg enables the GEM step (download: see scripts/sci2/gem_hazard.py).
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-.venv/bin/python}
CUTOFF=$($PY -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["data_cutoff_utc"])' scripts/release.json)
step() { echo "== $(date -u +%H:%M:%S) $*"; "$@"; }
SKIP_TESTS=1 step bash scripts/run_all.sh
step $PY -I scripts/deficit/fetch_deficit.py
step $PY -I scripts/deficit/build_deficit.py
step $PY -I scripts/deficit/figures_deficit.py
step $PY -I scripts/induced/fetch_groningen.py
step $PY -I scripts/induced/build_groningen.py
step $PY -I scripts/monitor/validate_oaf.py --end "${CUTOFF}T00:00:00"
step $PY -I scripts/sci2/ntest_omori.py
step $PY -I scripts/sci2/hd_italy.py
if [ -n "${GEM_GPKG:-}" ]; then step $PY -I scripts/sci2/gem_hazard.py "$GEM_GPKG"; else echo "GEM_GPKG not set: results/sci2_gem_hazard.json kept"; fi
step $PY -I scripts/site_layers.py --rehash
step $PY -I scripts/readme_numbers.py --write
step $PY -I -m pytest -q -p no:cacheprovider tests --ignore=tests/e2e
