"""Guard for site/data/monitor before it is committed: structure, the "no forecast" rules, and size.

Fails (exit 1) when:
- index.json or a sequence file is missing, unparsable or lacks a required field;
- a cumulative curve goes past the data cut-off or has a fitted value without an observed one;
- a sequence file holds a key that looks like a forecast (probability, expected future counts);
- the directory is larger than 3 MB.

Usage
  python -I scripts/monitor/check_monitor.py [site/data/monitor]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 3_000_000
REQ_INDEX = ("method_version", "generated_utc", "data_cutoff_utc", "disclaimer", "selection", "sequences")
REQ_SEQ = ("id", "time", "mag", "place", "url", "regime", "radius_km", "age_days", "counts", "mcat", "omori", "b",
           "bpos", "productivity", "daily", "cum")
FORBIDDEN = ("probab", "forecast", "expected_next", "future")


def keys(o, prefix=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield prefix + k
            yield from keys(v, prefix + k + ".")
    elif isinstance(o, list):
        for v in o:
            yield from keys(v, prefix)


def main():
    d = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "site" / "data" / "monitor"
    errs = []
    idx = json.loads((d / "index.json").read_text())
    errs += [f"index.json: missing {k}" for k in REQ_INDEX if k not in idx]
    for s in idx.get("sequences", []):
        f = d / s["file"]
        if not f.is_file():
            errs.append(f"missing {f.name}")
            continue
        r = json.loads(f.read_text())
        errs += [f"{f.name}: missing {k}" for k in REQ_SEQ if k not in r]
        bad = [k for k in keys(r) if any(w in k.lower() for w in FORBIDDEN)]
        if bad:
            errs.append(f"{f.name}: forecast-like keys {bad}")
        c = r.get("cum", {})
        if c.get("t") and c["t"][-1] > r["age_days"] + 0.01:
            errs.append(f"{f.name}: curve beyond the cut-off ({c['t'][-1]} > {r['age_days']} days)")
        if "fit" in c and len(c["fit"]) != len(c["t"]):
            errs.append(f"{f.name}: fit and time grid differ in length")
    total = sum(p.stat().st_size for p in d.glob("*.json"))
    if total > MAX_BYTES:
        errs.append(f"{total} bytes > {MAX_BYTES}")
    stray = {p.name for p in d.glob("*.json")} - {"index.json"} - {s["file"] for s in idx.get("sequences", [])}
    if stray:
        errs.append(f"files not listed in index.json: {sorted(stray)}")
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print(f"monitor data ok: {len(idx['sequences'])} sequences, {total / 1e6:.2f} MB, cut-off {idx['data_cutoff_utc']}")


if __name__ == "__main__":
    main()
