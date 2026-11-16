# seisatlas

Magnitude of completeness (Mc) and Gutenberg-Richter b-value **with a 95 % interval and a quality code** for any
earthquake catalogue: the estimators of the [Global Seismicity Atlas](https://seismicityatlas.org/) as a Python
library and a command-line tool.

```bash
pip install seisatlas
seisatlas report events.csv -o report.html
seisatlas report events.csv --lat 38.3 --lon 142.4 --radius-km 300 --mag-type mw -o tohoku.html
```

```python
from seisatlas import read_catalog, select, analyze, to_html

cat = select(read_catalog("events.csv"), lat=38.3, lon=142.4, radius_km=300, depth_max=70)
res = analyze(cat)                      # dict: mc, b (b, b_lo, b_hi, quality), b_positive, fmd, warnings
print(res["b"])
open("report.html", "w").write(to_html(res))
```

The CSV needs a magnitude column (`mag`, `magnitude`, `mw`, `ml`); time, latitude, longitude, depth and magnitude
type are used when present. USGS ComCat, EMSC and ISC exports work as downloaded.

## Method

- Mc = MAXC + 0.2; MBS and GFT are reported for comparison; Mc per year shows completeness changing in time.
- b: Aki-Utsu maximum likelihood with the binning correction and a per-event threshold max(Mc, floor), so a
  catalogue whose completeness changed can be analysed with per-period floors (`--floor-period 1976-2003:5.8`).
- 95 % interval from 1000 bootstrap replicates that re-estimate Mc each time.
- Quality A if (upper − lower) / b ≤ 0.30, B if ≤ 0.50, C if wider (b withheld), insufficient below 50 events above
  the threshold. The width is relative because the standard error of b grows with b; an absolute limit would favour
  low b.
- b-positive (van der Elst 2021) as a robustness check, and b at threshold + 0.2 / + 0.4 for cutoff stability.
- Warnings for mixed magnitude types, completeness that changes with time, small samples and unstable cutoffs.

Full description and validation: [docs/method.md](https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/method.md),
[docs/validation.md](https://github.com/ismoilovdevml/seismicity-atlas/blob/main/docs/validation.md).

Descriptive statistics only: **not an earthquake forecast and not a seismic hazard assessment.**

## Cite

Ismoilov, O. (2026). A reproducible global atlas of earthquake-catalogue completeness and b-value with uncertainty.
EarthArXiv. https://doi.org/10.31223/X5X23M. Code: https://doi.org/10.5281/zenodo.24228387. MIT licence.
