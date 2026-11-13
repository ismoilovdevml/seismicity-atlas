"""Print the numbers used in the regional validation table (docs/regional.md) from site/data/regional/.

Reads only the built outputs (summary.json, cells.geojson, cells/*.json); downloads nothing.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from regions import REGIONS  # noqa: E402

OUT = HERE.parents[1] / "site" / "data" / "regional"


def pct(x, q=(10, 50, 90)):
    return [round(float(v), 2) for v in np.percentile(x, q)] if len(x) else None


def region_report(rid):
    d = OUT / rid
    s = json.loads((d / "summary.json").read_text())
    feats = json.loads((d / "cells.geojson").read_text())["features"]
    rep = {"counts": s["counts"], "quality": s["quality_counts"], "mc_latest": s["mc_cells_latest_period"],
           "checkpoints": s["checkpoints"]}
    # cell Mc per period (only periods with >= 50 events in the circle, i.e. estimated, not fallback)
    per = {}
    for f in (d / "cells").glob("*.json"):
        det = json.loads(f.read_text())
        for a, b, n, mc in det.get("sh", {}).get("mc_periods", []):
            if n >= 50 and mc is not None:
                per.setdefault(f"{a}-{b}", []).append(mc)
    rep["mc_cells_by_period"] = {k: {"n": len(v), "p10_p50_p90": pct(v)} for k, v in sorted(per.items())}
    for dc in ("sh", "dp"):
        bs = [f["properties"][f"{dc}_b"] for f in feats if f"{dc}_b" in f["properties"]]
        bp = [f["properties"][f"{dc}_bpos"] for f in feats if f"{dc}_bpos" in f["properties"]]
        inside = [f["properties"][f"{dc}_b_lo"] <= f["properties"][f"{dc}_bpos"] <= f["properties"][f"{dc}_b_hi"]
                  for f in feats if f"{dc}_bpos" in f["properties"]]
        if bs:
            rep[f"{dc}_b_cells"] = {"n": len(bs), "p10_p50_p90": pct(bs),
                                    "bpos_minus_b_median": round(float(np.median(np.array(bp) - np.array(
                                        [f["properties"][f"{dc}_b"] for f in feats if f"{dc}_bpos" in f["properties"]]
                                    ))), 3) if bp else None,
                                    "bpos_inside_ci_frac": round(float(np.mean(inside)), 3) if inside else None}
    rep["region_b"] = {k: {kk: ([round(vv["b"], 3), round(vv["lo"], 3), round(vv["hi"], 3), vv["n"]]
                               if isinstance(vv, dict) and vv.get("b") is not None else vv) for kk, vv in v.items()}
                       for k, v in s["region_b"].items()}
    size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
    rep["bytes"] = size
    rep["n_detail"] = len(list((d / "cells").glob("*.json")))
    return rep


if __name__ == "__main__":
    ids = sys.argv[1:] or [r for r in REGIONS if (OUT / r / "summary.json").exists()]
    print(json.dumps({r: region_report(r) for r in ids}, indent=1))
