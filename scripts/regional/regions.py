"""Regional catalogue configuration. One magnitude type per region; see docs/regional.md for the reasons."""
from __future__ import annotations

INGV = "https://webservices.ingv.it/fdsnws/event/1/query"
GEONET = "https://service.geonet.org.nz/fdsnws/event/1/query"
COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query"
IMO = "https://api.vedur.is/quakes"

REGIONS = {
    "italy": {
        "id": "italy", "name": "Italy", "client": "fdsn_text", "url": INGV, "row_limit": 10000,
        "bbox": [6.0, 35.5, 19.0, 47.5], "start": "2010-01-01", "end": "2026-01-01", "download_minmag": 1.0,
        "magtypes": ["ML"], "authors": ["BULLETIN-INGV", "SURVEY-INGV"],
        "magtype_label": "ML (INGV local magnitude, as served by the INGV event service)",
        "catalogue": "INGV earthquake catalogue (ISIDe), FDSN event service",
        "licence": "CC BY 4.0", "attribution": "ISIDe Working Group (2007), INGV, doi:10.13127/ISIDE",
        "source_url": "https://terremoti.ingv.it/en/iside",
        "periods": [[2010, 2013], [2014, 2017], [2018, 2021], [2022, 2025]],
        "depth_split": True, "h3_res": 4, "radius_km": 30.0,
    },
    "nz": {
        "id": "nz", "name": "New Zealand", "client": "fdsn_text", "url": GEONET, "row_limit": 10000,
        "bbox": [165.0, -48.0, 179.99, -34.0], "start": "2013-01-01", "end": "2026-01-01", "download_minmag": 1.5,
        "magtypes": ["M", "MLv"], "authors": None,
        "magtype_label": "GeoNet preferred magnitude M / MLv (SeisComP era; M equals MLv for small events)",
        "catalogue": "GeoNet Aotearoa New Zealand Earthquake Catalogue, FDSN event service",
        "licence": "CC BY 3.0 NZ",
        "attribution": ("GeoNet Aotearoa New Zealand Earthquake Catalogue, doi:10.21420/0S8P-TZ38. We acknowledge the "
                        "New Zealand GeoNet programme and its sponsors NHC, Earth Sciences NZ, LINZ, NEMA and MBIE for "
                        "providing data used in this study."),
        "source_url": "https://www.geonet.org.nz/data/access/FDSN",
        "periods": [[2013, 2016], [2017, 2020], [2021, 2025]],
        "depth_split": True, "h3_res": 4, "radius_km": 30.0,
    },
    "socal": {
        "id": "socal", "name": "Southern California", "client": "comcat", "url": COMCAT, "comcat_catalog": "ci",
        "bbox": [-121.0, 32.0, -114.5, 36.5], "start": "2000-01-01", "end": "2026-01-01", "download_minmag": 1.0,
        "magtypes": ["ml"], "authors": None,
        "magtype_label": "ML (Southern California Seismic Network local magnitude, ComCat catalog=ci)",
        "catalogue": "Southern California Seismic Network (SCSN) via USGS ComCat, catalog=ci",
        "licence": "Public domain (U.S. Government work)",
        "attribution": ("USGS ComCat; Southern California Seismic Network, Caltech (1926), doi:10.7914/SN/CI; "
                        "SCEDC (2013), doi:10.7909/C3WD3xH1"),
        "source_url": "https://earthquake.usgs.gov/fdsnws/event/1/",
        "periods": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2025]],
        "depth_split": False, "h3_res": 4, "radius_km": 30.0,
    },
    "iceland": {
        "id": "iceland", "name": "Iceland", "client": "imo", "url": IMO, "imo_system": "seiscomp",
        "imo_depth_max": 40, "row_limit": 20000,
        "bbox": [-25.0, 62.5, -12.0, 67.5], "start": "2020-01-01", "end": "2026-11-01", "download_minmag": None,
        "magtypes": ["ML_seiscomp"], "magtype_label_short": "ML_seiscomp", "authors": None,
        "magtype_label": ("IMO SeisComP local magnitude, reviewed (manual) events only; about 0.6 lower than the legacy "
                          "SIL magnitude, so the two are never mixed"),
        "catalogue": "Icelandic Met Office (IMO) Quakes API, SeisComP system, reviewed events",
        "licence": "CC BY 4.0", "attribution": "Icelandic Met Office (Vedurstofa Islands), Quakes API",
        "source_url": "https://api.vedur.is/quakes/",
        "periods": [[2020, 2021], [2022, 2023], [2024, 2026]],
        "depth_split": False, "h3_res": 5, "radius_km": 15.0,
    },
}
