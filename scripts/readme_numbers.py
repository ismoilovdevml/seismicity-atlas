"""Write (or check) the "Key results" table of README.md from the data files, so the README never quotes stale numbers.

    .venv/bin/python -I scripts/readme_numbers.py --write    # rewrite the block between the markers
    .venv/bin/python -I scripts/readme_numbers.py --check    # exit 1 if the README block differs from the data

The block sits between <!-- key-results:start --> and <!-- key-results:end --> in README.md. Every number in it comes
from site/data/manifest.json, site/data/cells.geojson, results/prepare.json, results/atlas_globals.json and
results/sequences.json. scripts/run_all.sh runs --write before the tests, and tests/test_readme.py runs the check, so
the monthly data update (.github/workflows/update-data.yml) refreshes the table or fails. See docs/release.md.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
START, END = "<!-- key-results:start -->", "<!-- key-results:end -->"


def load(rel):
    return json.loads((ROOT / rel).read_text())


def n(v):
    return f"{v:,}"


def table() -> str:
    man = load("site/data/manifest.json")
    prep = load("results/prepare.json")
    glob = load("results/atlas_globals.json")
    seq = load("results/sequences.json")
    cells = [ft["properties"] for ft in load("site/data/cells.geojson")["features"]]
    m = prep["matching"]
    y0, y1 = prep["iscgem_span"][0][:4], prep["iscgem_span"][1][:4]
    c0, c1 = prep["comcat_span"][0][:4], prep["comcat_span"][1][:10]
    gs, gd = man["global"]["b_shallow_1976_2021"], man["global"]["b_deep_1976_2021"]
    years = f"{glob['years'][0]}–{glob['years'][1]}"
    trusted = {d: sum(1 for p in cells if p.get(f"{d}_q") in ("A", "B")) for d in ("sh", "dp")}
    fl = man["method"]["floors"]["sh"]
    (p1, f1), (p2, f2) = list(fl.items())
    mc_cc = [p["sh_mc_cc"] for p in cells if p.get("sh_mc_cc") is not None]
    q = seq["quality_counts"]
    b = lambda g: f"**{g['b']:.3f} [{g['ci95'][0]:.3f}, {g['ci95'][1]:.3f}]**"  # noqa: E731
    rows = [
        ("Events analysed", f"ISC-GEM {n(prep['iscgem_n'])} ({y0}–{y1}); ComCat M ≥ 4.5: {n(prep['comcat_n'])} ({c0}–{c1})"),
        ("Duplicates", f"{n(m['matched'])} of {n(m['iscgem_in_overlap'])} ISC-GEM events in {c0}–{y1} matched in ComCat "
                       f"({100 * m['matched'] / m['iscgem_in_overlap']:.1f} %); median offset {m['dt_s_median']:.1f} s, {m['dist_km_median']:.1f} km"),
        (f"Global b, ISC-GEM direct Mw {years}", f"shallow ≤ 70 km: {b(gs)}; deeper: {b(gd)}"),
        ("Cells with a trusted b (95 % interval ≤ 0.5 × b)", f"{n(trusted['sh'])} shallow and {n(trusted['dp'])} deeper, out of {n(glob['n_cells'])} cells that hold events"),
        ("Global completeness (ISC-GEM direct Mw, shallow)", f"Mw {f1['floor']:.1f} for {p1.replace('-', '–')}, {f2['floor']:.1f} for {p2.replace('-', '–')}"),
        ("USGS M4.5+ feed, as served", f"median Mc {statistics.median(mc_cc):.1f} (mostly mb) over {n(len(mc_cc))} shallow cells, 2010 to the cut-off"),
        ("Omori fits", f"{seq['n']} sequences since 1990: {q['A']} quality A, {q['B']} B, {q['C']} C, {q['insufficient']} insufficient"),
    ]
    out = [START, f"## Key results (data cut-off {man['data_cutoff_utc']})", "",
           "Generated from the data files by `scripts/readme_numbers.py`; do not edit by hand.", "",
           "| | Value |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in rows]
    out.append(END)
    return "\n".join(out)


def splice(text: str, block: str) -> str:
    i, j = text.index(START), text.index(END) + len(END)
    return text[:i] + block + text[j:]


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--write", action="store_true")
    g.add_argument("--check", action="store_true")
    a = ap.parse_args()
    text = README.read_text()
    new = splice(text, table())
    if a.check:
        if new != text:
            print("README.md key results differ from the data; run scripts/readme_numbers.py --write", file=sys.stderr)
            sys.exit(1)
        print("README key results match the data")
        return
    if new != text:
        README.write_text(new)
        print("README.md key results updated")
    else:
        print("README.md key results already current")


if __name__ == "__main__":
    main()
