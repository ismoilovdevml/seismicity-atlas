"""Compatibility shim: the code lives in the installable package `seisatlas` (src/seisatlas/seislib.py).

The pipeline scripts and tests import `seislib` from this folder; this module makes that name refer to the package module
itself, so there is one copy of the code.
"""
import sys
from pathlib import Path

_SRC = str(Path(__file__).resolve().parents[1] / "src")
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

import seisatlas.seislib as _mod  # noqa: E402

sys.modules[__name__] = _mod
