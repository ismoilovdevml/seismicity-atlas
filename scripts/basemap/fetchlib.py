"""Cached downloads for the basemap scripts.

Files land in data/raw/basemap/ and are recorded in data/raw/basemap/manifest.jsonl (URL, time, bytes, sha256).
Downloads are untrusted data: they are only parsed as images, zip members, GeoJSON or plain numbers.
"""
from __future__ import annotations

import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "basemap"
UA = "seismicity-atlas-basemap/1.0"


def fetch(url: str, name: str, sha256: str | None = None, timeout: int = 600) -> Path:
    """Download url once into RAW/name; verify sha256 when given (also for an already cached file)."""
    RAW.mkdir(parents=True, exist_ok=True)
    out = RAW / name
    if not out.exists():
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
        tmp = out.with_suffix(out.suffix + ".part")
        tmp.write_bytes(data)
        tmp.rename(out)
        rec = {"url": url, "file": str(out.relative_to(ROOT)), "bytes": len(data),
               "sha256": hashlib.sha256(data).hexdigest(),
               "fetched_utc": datetime.now(timezone.utc).isoformat()}
        with open(RAW / "manifest.jsonl", "a") as m:
            m.write(json.dumps(rec) + "\n")
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    if sha256 and digest != sha256:
        raise SystemExit(f"checksum mismatch for {name}: {digest} != {sha256}")
    return out
