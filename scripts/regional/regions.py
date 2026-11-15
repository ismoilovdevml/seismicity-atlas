"""Regional catalogue configuration. One magnitude type per region; see docs/regional.md for the reasons."""
from __future__ import annotations

INGV = "https://webservices.ingv.it/fdsnws/event/1/query"
GEONET = "https://service.geonet.org.nz/fdsnws/event/1/query"
COMCAT = "https://earthquake.usgs.gov/fdsnws/event/1/query"
IMO = "https://api.vedur.is/quakes"

REGIONS = {
    "italy": {
        "id": "italy", "b_thresholds": [2.0, 2.5, 3.0], "name": "Italy", "client": "fdsn_text", "url": INGV, "row_limit": 10000,
        "bbox": [6.0, 35.5, 19.0, 47.5], "start": "2010-01-01", "end": "2026-01-01", "download_minmag": 1.0,
        "magtypes": ["ML"], "authors": ["BULLETIN-INGV", "BULLETIN-SISPICK", "SURVEY-INGV"],
        "magtype_label": "ML (INGV local magnitude, as served by the INGV event service)",
        "altmag_from": ["Mw", "Mwp", "M", "mb"], "altmag_type": "ML", "altmag_url": INGV,
        "altmag_params": {"includeallmagnitudes": "true"}, "altmag_authors": ["BULLETIN-INGV", "SURVEY-INGV"],
        "catalogue": "INGV earthquake catalogue (ISIDe), FDSN event service",
        "licence": "CC BY 4.0", "attribution": "ISIDe Working Group (2007), INGV, doi:10.13127/ISIDE",
        "source_url": "https://terremoti.ingv.it/en/iside",
        "periods": [[2010, 2013], [2014, 2017], [2018, 2021], [2022, 2025]],
        "depth_split": True, "h3_res": 4, "radius_km": 30.0,
    },
    "nz": {
        "id": "nz", "b_thresholds": [2.5, 3.0, 3.5], "name": "New Zealand", "client": "fdsn_text", "url": GEONET, "row_limit": 10000,
        "bbox": [165.0, -48.0, 179.99, -34.0], "start": "2013-01-01", "end": "2026-01-01", "download_minmag": 1.5,
        "magtypes": ["M", "MLv"], "authors": None,
        "magtype_label": "GeoNet preferred magnitude M / MLv (SeisComP era; M equals MLv for small events)",
        "altmag_from": ["ML", "Mw(mB)", "mB", "mb", "Ms(BB)", "Mw"], "altmag_type": "MLv", "altmag_url": GEONET,
        "catalogue": "GeoNet Aotearoa New Zealand Earthquake Catalogue, FDSN event service",
        "licence": "CC BY 3.0 NZ",
        "attribution": ("GeoNet Aotearoa New Zealand Earthquake Catalogue, doi:10.21420/0S8P-TZ38. We acknowledge the "
                        "New Zealand GeoNet programme and its sponsors NHC, Earth Sciences NZ, LINZ, NEMA and MBIE for "
                        "providing data used in this study."),
        "source_url": "https://www.geonet.org.nz/data/types/eq_catalogue",
        "periods": [[2013, 2016], [2017, 2020], [2021, 2025]],
        "depth_split": True, "h3_res": 4, "radius_km": 30.0,
    },
    "socal": {
        "id": "socal", "b_thresholds": [1.8, 2.5, 3.0], "name": "Southern California", "client": "comcat", "url": COMCAT, "comcat_catalog": "ci",
        "bbox": [-121.0, 32.0, -114.5, 36.5], "start": "2000-01-01", "end": "2026-01-01", "download_minmag": 1.0,
        "magtypes": ["ml"], "authors": None,
        "magtype_label": "ML (Southern California Seismic Network local magnitude, ComCat catalog=ci)",
        "altmag_from": ["mw", "mh", "mlr", "me", "mwr", "mww", "md"], "altmag_type": "ml",
        "altmag_url": "https://service.scedc.caltech.edu/fdsnws/event/1/query", "altmag_id_prefix": "ci", "altmag_minmag": 2.0,
        "altmag_params": {"includeallmagnitudes": "true"},
        "catalogue": "Southern California Seismic Network (SCSN) via USGS ComCat, catalog=ci",
        # a joint Caltech and USGS product; neither SCSN nor SCEDC publishes a licence, only a citation request
        "licence": "No licence stated (SCSN, operated by Caltech and the USGS; citation requested)",
        "attribution": ("Southern California Seismic Network (Caltech and USGS) via USGS ComCat, catalog=ci, and SCEDC "
                        "magnitudes. Cite California Institute of Technology (Caltech) (1926), Southern California "
                        "Seismic Network, doi:10.7914/SN/CI; SCEDC (2013), Southern California Earthquake Data Center, "
                        "Caltech, doi:10.7909/C3WD3xH1"),
        "source_url": "https://earthquake.usgs.gov/fdsnws/event/1/",
        "periods": [[2006, 2009], [2010, 2013], [2014, 2017], [2018, 2021], [2022, 2025]],
        "depth_split": False, "h3_res": 4, "radius_km": 30.0,
    },
    "iceland": {
        "id": "iceland", "b_thresholds": [0.5, 1.0, 1.5], "name": "Iceland", "client": "imo", "url": IMO, "imo_system": "seiscomp",
        "imo_depth_max": 40, "row_limit": 20000,
        "bbox": [-25.0, 62.5, -12.0, 67.5], "start": "2020-01-01", "end": "2026-11-01", "download_minmag": None,
        "magtypes": ["ML_seiscomp"], "magtype_label_short": "ML_seiscomp", "authors": None,
        "magtype_label": ("IMO SeisComP local magnitude, reviewed (manual) events only; about 0.6 lower than the legacy "
                          "SIL magnitude, so the two are never mixed"),
        "catalogue": "Icelandic Met Office (IMO) Quakes API, SeisComP system, reviewed events",
        "licence": "CC BY 4.0", "attribution": "Icelandic Met Office (Vedurstofa Islands), Quakes API",
        "attribution_with_date": True,   # IMO terms: "reference must be made to … the date of data downloading"
        "source_url": "https://api.vedur.is/quakes/",
        "periods": [[2020, 2021], [2022, 2023], [2024, 2026]],
        "depth_split": False, "h3_res": 5, "radius_km": 15.0,
    },
}

# shown with each region in index.json; the reasons and numbers are in docs/regional.md
CAVEATS = {
    "italy": ("About 10,000 small events (median 1.3, mostly central Italy) carry only a duration magnitude Md "
              "and are excluded, so counts below Mc are slightly low."),
    "nz": ("Offshore areas and the central Alpine Fault have too few events for a cell Mc. The region-wide b at "
           "fixed thresholds mixes in offshore areas that are not complete."),
    "socal": ("In the 2019 Ridgecrest cells b stays about 0.07 below b-positive even with the 200-event Mc windows "
              "(short-term aftershock incompleteness)."),
    "iceland": ("b depends strongly on the cutoff (region-wide 0.62 at 0.5 and 0.80 at 1.5) and b-positive is "
                "higher by about 0.17 in the median cell. Compare b only within this layer, together with "
                "b-positive."),
}
for _k, _v in CAVEATS.items():
    REGIONS[_k]["caveat"] = _v
