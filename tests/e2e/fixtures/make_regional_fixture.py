"""Write a small synthetic regional catalogue under fixtures/regional/ for the browser tests.

The values are made up; they only exercise the regional-layer contract (see docs/known-issues.md). Never copy
this into site/data. Needs the h3 package. Run: python tests/e2e/fixtures/make_regional_fixture.py
"""
import json
from pathlib import Path

import h3

OUT = Path(__file__).resolve().parent / "regional"
RID = "fixture-ca"


def main():
    cells = sorted(h3.grid_disk(h3.latlng_to_cell(36.5, -119.5, 3), 2))
    feats = []
    for i, c in enumerate(cells):
        lat, lon = h3.cell_to_latlng(c)
        ring = [[round(x, 4), round(y, 4)] for y, x in h3.cell_to_boundary(c)]
        ring.append(ring[0])
        q = ["A", "B", "C", "insufficient"][i % 4]
        p = {"id": c, "lat": round(lat, 3), "lon": round(lon, 3), "detail": i == 0,
             "sh_q": q, "sh_n": 400 - 10 * i, "sh_nb": 300 - 10 * i, "sh_mc": 2.5, "sh_mc_lo": 2.4, "sh_mc_hi": 2.7}
        if q in ("A", "B"):
            b = 0.8 + 0.03 * i
            w = 0.12 if q == "A" else 0.2
            p.update({"sh_b": round(b, 3), "sh_b_lo": round(b - w, 3), "sh_b_hi": round(b + w, 3), "sh_ciw": 2 * w})
        elif q == "C":
            p["sh_ciw"] = 0.7
        feats.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": p})
    (OUT / RID / "cells").mkdir(parents=True, exist_ok=True)
    (OUT / RID / "cells.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    first = feats[0]["properties"]
    det = {"h3": first["id"], "lat": first["lat"], "lon": first["lon"],
           "sh": {"fmd": [[round(2.5 + 0.1 * k, 1), max(1, int(200 * 10 ** (-0.9 * 0.1 * k)))] for k in range(30)],
                  "b_cutoff": [[2.5, 0.83, 0.71, 0.95, 280], [2.8, 0.85, 0.70, 1.00, 160], [3.1, 0.88, 0.69, 1.07, 90]]}}
    (OUT / RID / "cells" / f"{first['id']}.json").write_text(json.dumps(det))
    index = {"regions": [{"id": RID, "name": "Fixture region (synthetic)", "bbox": [-124.0, 33.0, -115.0, 40.0],
                          "catalogue": "Synthetic test catalogue", "licence": "CC0 (test fixture)",
                          "period": ["2000-01-01", "2020-12-31"], "mc_typical": 2.5,
                          "cells": f"regional/{RID}/cells.geojson", "cell_detail_dir": f"regional/{RID}/cells/"}]}
    (OUT / "index.json").write_text(json.dumps(index, indent=1))
    print(len(feats), "cells; detail for", first["id"])


if __name__ == "__main__":
    main()
