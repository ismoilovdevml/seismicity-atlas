"""Guard rail for automated data updates: compare a freshly built site/data with the previous release.

Fails (exit 1) when a headline number moves outside its tolerance, so a broken download or a silent method change is
not published. Reads only manifest.json and cells.geojson from each directory.

Usage
  python -I scripts/check_drift.py --baseline <dir with the previous manifest.json, cells.geojson> --new site/data
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

B_DEEP_RANGE = (0.95, 1.05)       # global b, depth > 70 km, ISC-GEM 1976-2021 (0.969 in v0.1.0)
B_SHALLOW_RANGE = (0.98, 1.10)    # global b, depth <= 70 km (1.043 in v0.1.0)
MAX_REL_CHANGE_CELLS_WITH_B = 0.25  # cells with a shown b (quality A or B), per depth class
MAX_REL_CHANGE_CELLS = 0.10       # cells that hold events
MAX_EVENT_DROP = 0.02             # events_m5 / events_m6 may not shrink by more than 2 % (truncated download)


def summary(d: Path) -> dict:
    man = json.loads((d / "manifest.json").read_text())
    cells = json.loads((d / "cells.geojson").read_text())["features"]
    s = {"cutoff": man["data_cutoff_utc"], "version": man["version"],
         "b_sh": man["global"]["b_shallow_1976_2021"]["b"], "b_dp": man["global"]["b_deep_1976_2021"]["b"],
         "cells": len(cells)}
    for dc in ("sh", "dp"):
        s[f"cells_b_{dc}"] = sum(1 for f in cells if f["properties"].get(f"{dc}_q") in ("A", "B"))
    for k in ("events_m5.json", "events_m6.json"):
        s[k] = man["events"][k]["n"]
    return s


def check(old: dict, new: dict) -> list[str]:
    bad = []
    for key, (lo, hi) in (("b_dp", B_DEEP_RANGE), ("b_sh", B_SHALLOW_RANGE)):
        if not lo <= new[key] <= hi:
            bad.append(f"{key} = {new[key]:.3f} outside [{lo}, {hi}]")
    for key, tol in (("cells_b_sh", MAX_REL_CHANGE_CELLS_WITH_B), ("cells_b_dp", MAX_REL_CHANGE_CELLS_WITH_B),
                     ("cells", MAX_REL_CHANGE_CELLS)):
        rel = abs(new[key] - old[key]) / max(old[key], 1)
        if rel > tol:
            bad.append(f"{key}: {old[key]} -> {new[key]} ({rel:.0%} > {tol:.0%})")
    for key in ("events_m5.json", "events_m6.json"):
        if new[key] < old[key] * (1 - MAX_EVENT_DROP):
            bad.append(f"{key}: {old[key]} -> {new[key]} events (drop > {MAX_EVENT_DROP:.0%})")
    if new["cutoff"] < old["cutoff"]:
        bad.append(f"cut-off went back: {old['cutoff']} -> {new['cutoff']}")
    return bad


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--baseline", required=True, type=Path)
    ap.add_argument("--new", required=True, type=Path)
    a = ap.parse_args(argv)
    old, new = summary(a.baseline), summary(a.new)
    for k in old:
        print(f"{k:16s} {old[k]!s:>14} -> {new[k]!s}")
    bad = check(old, new)
    for b in bad:
        print("DRIFT:", b)
    print("drift check:", "FAILED" if bad else "ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
