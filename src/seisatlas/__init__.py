"""seisatlas: magnitude of completeness and Gutenberg-Richter b-value with uncertainty for any earthquake catalogue.

The estimators of the Global Seismicity Atlas (https://seismicityatlas.org/) as a library and a command-line tool.

    from seisatlas import read_catalog, select, analyze, to_html
    cat = select(read_catalog("events.csv"), lat=38.3, lon=142.4, radius_km=300)
    res = analyze(cat)
    open("report.html", "w").write(to_html(res))

Command line:  seisatlas report events.csv --lat 38.3 --lon 142.4 --radius-km 300 -o report.html

Descriptive statistics only: not an earthquake forecast and not a seismic hazard assessment.
Cite: Ismoilov, O. (2026), EarthArXiv, https://doi.org/10.31223/X5X23M
"""
__version__ = "0.6.0"

from .analysis import DISCLAIMER, analyze, fmd_frame, mc_by_year  # noqa: E402
from .catalog import Catalog, read_catalog, select  # noqa: E402
from .report import to_html, to_json, to_markdown  # noqa: E402

__all__ = ["Catalog", "read_catalog", "select", "analyze", "mc_by_year", "fmd_frame", "to_markdown", "to_json",
           "to_html", "DISCLAIMER", "__version__"]
