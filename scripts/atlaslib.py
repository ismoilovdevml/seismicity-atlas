"""Compatibility shim: the code lives in the installable package `seisatlas` (src/seisatlas/atlaslib.py).

The pipeline scripts and tests import `atlaslib` from this folder; this module makes that name refer to the package module
itself, so there is one copy of the code.
"""
import sys
from pathlib import Path

_SRC = str(Path(__file__).resolve().parents[1] / "src")
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

import seisatlas.atlaslib as _mod  # noqa: E402

sys.modules[__name__] = _mod
