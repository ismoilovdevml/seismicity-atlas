# Releases, data updates and citation

## Versions

`scripts/release.json` holds the version and the data cut-off. It is the only place they are set:
`scripts/site_layers.py` copies both into `site/data/manifest.json`, and `run_all.sh` downloads ComCat up to that
cut-off.

| Change | Version step | Example | Who |
|---|---|---|---|
| Data refresh, same schema and method | patch | 0.1.0 → 0.1.1 | the monthly workflow (`scripts/bump_release.py`) |
| New property or file in `site/data/`, method change that moves numbers | minor | 0.1.x → 0.2.0 | by hand: `bump_release.py --cutoff <date> --part minor` |
| Renamed or re-scaled property (breaks the data contract) | major | 0.x → 1.0.0 | by hand |

Every monthly commit is a complete, citable data state: its `manifest.json` gives the version, the cut-off, the
generation time and a sha256 for every file. Not every patch needs a GitHub release. Make a GitHub release (and so a
new Zenodo version, see below) when the data are meant to be cited, for example once per quarter or after a method
change. The tag is `v` + the version in `release.json` on that commit (for example `v0.1.3`). Keep `version` in
`CITATION.cff` equal to the tag.

### Interface-only changes

The version in `release.json` is the version of the **data contract** (`site/data/`): `bump_release.py` writes only
`release.json`, and the number reaches the site through `site_layers.py`, that is, through a pipeline run. An
interface change that does not touch `site/data/` schema or numbers (for example the v0.3 two-mode redesign of
2026-11-14: Simple and Scientist views, place search, place card) therefore does **not** bump the version; the site
keeps showing the data version (0.2.0). The new `site/data/places.json` is a static gazetteer for the interface
(Natural Earth, built by `scripts/basemap/build_places.py`), not a pipeline output, and is not listed in
`manifest.json`. The next data or method release takes the next minor version as usual.

## Monthly data update (`.github/workflows/update-data.yml`)

Runs at 04:17 UTC on the 2nd of every month, and on demand (Actions → Update data → Run workflow, with an optional
cut-off date). Steps:

1. Restores `data/raw/` (the download cache) from the Actions cache.
2. Sets the cut-off to today (UTC) and bumps the patch version in `scripts/release.json`. A cut-off that is not later
   than the current one leaves the version unchanged.
3. Re-downloads ComCat M ≥ 4.5 from 1973 to the cut-off (`fetch.py comcat --refresh`), because ComCat revises old
   events too. Requests go one year at a time, 1 s apart (about 55 requests, about 50 MB). A year that ComCat refuses
   (more than 20,000 events, HTTP 400) is split in half; a chunk that is still refused at 1 day stops the run. ISC-GEM
   and the map layers come from the cache; they are downloaded only when the cache is empty.
4. Saves the cache, then runs `scripts/run_all.sh`: the whole pipeline and the tests (`pytest`).
5. Drift guard (`scripts/check_drift.py`) against the `site/data/` of the previous commit. The run fails when:
   - global b, deeper than 70 km, leaves 0.89–0.99 (0.969 in 0.1.0, 0.936 in 0.2.0, after the direct-Mw b sample);
   - global b, shallow, leaves 0.98–1.10 (1.043 in 0.1.0, 1.035 in 0.2.0);
   - the number of cells with a shown b (quality A or B) changes by more than 25 % in either depth class;
   - the number of cells changes by more than 10 %;
   - `events_m5.json` or `events_m6.json` shrinks by more than 2 % (a truncated download);
   - the cut-off goes backwards.
6. Commits `site/data`, `docs/img`, `results` and `scripts/release.json` as `ismoilovdevml` (the account's noreply
   address) and pushes to `main`. If only `manifest.json` changed, nothing is committed.

If any step fails, nothing is committed and the live site keeps the previous data. Read the failed step's log; the
drift guard prints old → new for every number it checks.

Permissions: `contents: write` only. No secrets are used. The job runs only in `ismoilovdevml/seismicity-atlas`, not
in forks.

### Deploying the update to GitHub Pages

A push made with the workflow's `GITHUB_TOKEN` does **not** start other workflows (GitHub rule: events triggered by
`GITHUB_TOKEN` do not create new workflow runs, except `workflow_dispatch` and `repository_dispatch`). The
`site/**` path filter in `pages.yml` matches `site/data/...`, but the push event from this workflow never reaches it.
To deploy automatically, add a `workflow_run` trigger to `.github/workflows/pages.yml`:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "site/**"
      - ".github/workflows/pages.yml"
  workflow_run:
    workflows: ["Update data"]
    types: [completed]
  workflow_dispatch:
```

and guard its job so that a failed update does not redeploy:

```yaml
jobs:
  deploy:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
```

`workflow_run` runs on the latest commit of the default branch, which then includes the data commit. Until this is
added, run "Deploy site to GitHub Pages" by hand (Actions → Run workflow) after an update.

### README: numbers and screenshots (since v0.3.1)

The README cannot quote numbers older than the data, and its screenshots cannot go stale unnoticed. The simplest
robust split:

- **Key results are generated.** The table between `<!-- key-results:start -->` and `<!-- key-results:end -->` in
  `README.md` is written by `scripts/readme_numbers.py --write` from `site/data/manifest.json`, `site/data/cells.geojson`,
  `results/prepare.json`, `results/atlas_globals.json` and `results/sequences.json`. `scripts/run_all.sh` runs it
  before the tests, so the monthly workflow rewrites the table and commits `README.md` with the data (it is in the
  workflow's `git add`). Do not edit the block by hand.
- **The validation table is curated, its numbers are checked.** Its wording (verdicts, published references) is
  written by hand, but `tests/test_readme.py` fails if any interval it quotes ("0.997 [0.962, 1.033]") is not in the
  validation table of `site/data/global.json`. These rows come from ISC-GEM, which the monthly update does not change;
  after a new ISC-GEM release, update the rows and the test tells you which ones are stale.
- **Screenshots come from one script.** `python tests/e2e/tools/readme_shots.py` renders every image the README uses
  into `docs/img/readme/` (fixed viewport, device scale 1, time zone Asia/Tokyo, colour scheme, reduced motion, the
  committed data; PNGs over 400 KB are reduced to 256 colours). It needs Playwright and Pillow and is not run in CI:
  refresh the screenshots on each release (minor or patch with interface changes) and look at each one.
  `tests/test_readme.py` fails if the README uses a missing image, if `docs/img/readme/` holds an image the README
  does not use, if one is over 400 KB, or if an old-style `docs/img/site-*.png` is left that no document uses.
- `CITATION.cff` (`version`, `date-released`) is set by hand on each release; the test checks that
  `scripts/release.json` and `site/data/manifest.json` agree.

### Not updated automatically

- The numbers quoted in `docs/data.md`, `docs/method.md` and `docs/validation.md` describe release 0.1.0/0.2.0
  (cut-off 2026-11-13). The live numbers are in `site/data/manifest.json` and `results/*.json`. Update the text when
  making a GitHub release.
- README screenshots (see above).
- ISC-GEM: the ComCat mirror ends in 2021 and changes rarely. Switching to the official release is a manual step
  (below).

### Running an update locally

```bash
.venv/bin/python -I scripts/bump_release.py --cutoff "$(date -u +%F)"
.venv/bin/python -I scripts/fetch.py comcat --refresh --end "$(date -u +%F)"
./scripts/run_all.sh
```

`--refresh` overwrites the cached ComCat responses in `data/raw/comcat/`.

## Zenodo DOI

`.zenodo.json` sets the title, description, creator, licence, keywords and the links to the ISC-GEM DOI
(10.31905/D808B825) and ComCat. Zenodo reads it when it archives a GitHub release.

1. Sign in at https://zenodo.org with the GitHub account that owns the repository (Log in → GitHub).
2. Open https://zenodo.org/account/settings/github/, click "Sync now", and switch **ismoilovdevml/seismicity-atlas**
   to On. This adds a webhook on the repository. Do it before step 3: releases made earlier are not archived.
3. Create the release on GitHub: Releases → Draft a new release → tag `v0.1.0` on `main` (target the commit whose
   `scripts/release.json` says 0.1.0) → title `v0.1.0` → Publish. From the command line:
   `gh release create v0.1.0 --target main --title v0.1.0 --notes "First public release, data cut-off 2026-11-13."`
4. Wait a few minutes, then open https://zenodo.org/account/settings/github/ again. The repository now shows a DOI
   badge. There are two DOIs: the **concept DOI** (all versions; resolves to the latest) and the **version DOI**
   (this release only). Check that the record shows the title, licence and related identifiers from `.zenodo.json`;
   if Zenodo rejected the file, the record falls back to the repository name and the release notes.
5. Add the badge to `README.md` under the title, using the concept DOI:
   `[![DOI](https://zenodo.org/badge/DOI/<concept DOI>.svg)](https://doi.org/<concept DOI>)`
   and add `doi: <concept DOI>` to `CITATION.cff` (top level) and to the "How to cite" text on the site if wanted.
6. For later releases: bump `CITATION.cff` `version` and `date-released`, then create the release `vX.Y.Z`. Zenodo
   makes a new version DOI under the same concept DOI automatically.

## Official ISC-GEM release (optional input)

The pipeline uses the ISC-GEM copy that ComCat serves (catalog=iscgem; ends 2021-12-31, release not stated). The
official current release (Version 13.0, 21 October 2026, doi:10.31905/D808B825) is handed out only after a request
form with name, e-mail and a captcha, so only the publisher can fetch it. The pipeline never submits that form.

1. Open https://www.isc.ac.uk/iscgem/download.php → Download, fill in the form and download the catalogue.
2. Take the **main** catalogue CSV (not the supplementary catalogue and not the KMZ). Unzip it if needed and save it
   as `data/raw/iscgem_official/isc-gem-cat.csv` (the `data/` folder is gitignored; the file is CC BY-SA 3.0 and is
   not committed).
3. Run `./scripts/run_all.sh`. `fetch.py` now prints `iscgem: official file ...` and writes
   `data/processed/iscgem_source.json`; `manifest.json` → `sources[0].access` records the file's sha256. To go back to
   the mirror, move the file away or run `fetch.py iscgem --iscgem-source comcat`.
4. Review the change before publishing: `results/prepare.json` (event count, span, match rate) and the validation
   numbers in `results/validation.json`. Then bump the minor version (`bump_release.py --part minor`) and update the
   text in `docs/data.md` (the ISC-GEM version note) and `README.md`.

Reader: `scripts/iscgem_official.py`. It expects comment lines starting with `#`, the last of which holds the
comma-separated column names, followed by comma-separated data rows. Columns are found by name: `date`, `lat`,
`lon`, `depth`, `mw`, `eventid` are required; `smajax` and the `unc` columns after `depth` and after `mw` are used
when present. Ids become `iscgem<eventid>`, the form ComCat uses, so USGS event links keep working for events that
ComCat mirrors. If the header differs, the reader stops with an error that names the missing column. It has been
tested only on a synthetic sample (`tests/data/iscgem_official_sample.csv`), not on the real 13.0 file.

Known limits with a newer release:

- The b-value period is fixed to 1976–2021 (`scripts/atlas.py`: `Y0`, `Y1`, `PERIODS`). Events after 2021 in a newer
  release are counted on the map and matched with ComCat but are not used for b or Mc until those constants and the
  period floors are revised (a minor version).
- Events after 2021 that ComCat does not mirror may not resolve on the USGS event page.
