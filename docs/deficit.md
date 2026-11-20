# Seismic deficit layer (pilot: Tien Shan)

This layer compares two moment rates. The first is the **geodetic moment rate**, the moment that crustal strain
measured by GNSS and InSAR would release if all of it went into earthquakes. The second is the **seismic moment
rate** actually released by earthquakes since 1904. Their ratio is sometimes called seismic efficiency or seismic
coupling. A ratio below 1 is a "deficit" and a ratio above 1 is a "surplus".

**This is not a forecast and not a hazard map.** The catalogue covers about 120 years. The largest Tien Shan
earthquakes recur on time scales of centuries or more, so one or two events decide the ratio. Part of the strain may
be released aseismically, and full coupling is an assumption. A low ratio is not evidence that an earthquake is due,
and a high ratio does not mean that a region is safe. Every value comes with a 95 % interval and a quality code. The
site must not draw a ratio without both.

Code: `scripts/deficit/` (`fetch_deficit.py`, `build_deficit.py`, `figures_deficit.py`, `momentlib.py`). Tests:
`tests/test_deficit.py` (synthetic checks of the maths) and `tests/test_deficit_contract.py` (this contract).

```
.venv/bin/python -I scripts/deficit/fetch_deficit.py     # downloads ~2 MB from Zenodo (md5-checked), grids the models
.venv/bin/python -I scripts/deficit/build_deficit.py     # ~5 s; writes site/data/deficit/ and data/work/deficit/results.json
.venv/bin/python -I scripts/deficit/figures_deficit.py   # docs/img/deficit-*.png
```

`fetch_deficit.py` needs `gdal_translate` (GDAL) on the host. It converts the NetCDF-4 grids of Ou et al. to classic
NetCDF, which scipy can read. These scripts are not in `scripts/run_all.sh` (the layer needs GDAL and is rebuilt by hand); the site reads the committed output.

## Sources and licences

| Source | Licence | Used for |
|---|---|---|
| Ou, Elliott, Maghsoudi, Rollins, Lazecký & Wright (2026), *GNSS and InSAR velocities, vorticity and strain rates across the Tian Shan*, Zenodo, doi:10.5281/zenodo.20293601 | CC BY 4.0 (Zenodo record metadata) | strain-rate model `ou2026`: `dvedx.nc`, `dvndy.nc`, `dxy.nc` (0.05° grid, 63–93 °E, 37–50 °N) |
| Chang (2025), *Geodetic Strain Rates, Slip Deficit Rates, and Seismic Potential in Tianshan, Central Asia*, Zenodo, doi:10.5281/zenodo.16547905. Data of Chang et al. (2025), GRL 52, e2025GL118470 | CC BY 4.0 (Zenodo record metadata); the paper itself is CC BY-NC-ND 4.0 and only facts are cited from it | four strain-rate models (`chang_bforstrain`, `chang_gpsgridder`, `chang_locavggrad`, `chang_visr`): 1,349 points, 72.0–91.9 °E, 38.0–47.9 °N |
| ISC-GEM catalogue (ComCat mirror, `data/processed/iscgem.csv`) | CC BY-SA 3.0 | Mw and moment 1904–2021 |
| USGS ComCat (`data/processed/comcat_m45.csv`) | public domain | Mw-type magnitudes 2022 to the cut-off (this includes the 2024 Mw 7.0 Wushi earthquake) |

`fetch_deficit.py` stops if a Zenodo record's licence id is no longer `cc-by-4.0`. The derived files are CC BY-SA
4.0, like the rest of `site/data/`.

**No global layer was built.** The GEM product page for GSRM v2.1 (Kreemer, Blewitt & Klein 2014, G3 15,
3849–3889) contradicts itself. Its body text says "The open version is available under a Creative Commons CC
BY-NC-SA 4.0 license", while the licence heading on the same page reads "CC BY-SA 3.0". The non-commercial term
cannot be combined with this atlas's CC BY-SA 4.0 data licence, and the contradiction makes the licence unclear, so
GSRM was not downloaded or used. The UNR page offers the model files on e-mail request only. A global layer can be
built once GEM or the authors confirm a licence without NC.

## Method

### Geodetic moment rate

For each 0.05° grid node with strain-rate tensor (ε̇xx, ε̇yy, ε̇xy), the principal horizontal rates are ε̇1 ≥ ε̇2.
The scalar rate is ε̇SS = max(|ε̇1|, |ε̇2|, |ε̇1 + ε̇2|) (Savage & Simpson 1997, BSSA 87, 1345). With
incompressibility, the vertical rate is −(ε̇1 + ε̇2), so ε̇SS is the largest absolute principal value of the 3-D
tensor. The Kostrov (1974) summation then gives

  Ṁg = 2 μ H Σ A_i ε̇SS,i

where A_i is the exact spherical area of node i. This is the minimum scalar moment rate of the double couples that
produce the tensor, at **full coupling**.

| Parameter | Range (uniform) | Basis |
|---|---|---|
| shear modulus μ | 28–33 GPa | usual crustal range; Molnar & Ghose (2000) use 33 GPa |
| seismogenic thickness H | 15–25 km | Chang et al. (2025) use a uniform locking depth of 20 km; Molnar & Ghose (2000) let faulting reach 20 km |
| strain-rate model | one of the models that covers ≥ 70 % of the zone area, equal weight | epistemic spread |
| coupling χ | not sampled: Ṁg is for χ = 1 | see "Coupling" below |

Units: Ou et al. give velocity gradients from GMT `grdmath ... DDX 1000000 MUL` on mm/yr velocities with `-M`
(metres), so one grid unit is 1e-6 (mm/yr)/m = 1 nanostrain/yr. Our recomputation of their `sec_inv.nc` agrees to
7.7e-6 nanostrain/yr. Chang gives microstrain/yr at mesh centroids. Each grid node takes the nearest centroid within
40 km.

**Coverage.** The InSAR-based Ou et al. field has gaps (78 % of the Tien Shan outline covered), and Chang starts at
72 °E. A model enters a zone only if it covers ≥ 70 % of the zone. Its integral is then scaled to the full zone area
(the mean density of the covered part is assumed for the gaps), and `cov_min` records the coverage. With this rule
the western region (69–76 °E) uses Ou et al. only: Chang covers 69 % of it. The eastern region uses Chang only: Ou
covers 69 % of it.

**Per-node sum against the regional mean tensor.** Applying Savage-Simpson to the area-weighted mean tensor of a
zone gives 0.91 (whole belt), 0.96, 0.94 and 0.91 (west, central, east) of the per-node sum. The per-node sum is
used throughout.

### Seismic moment rate

The catalogue is ISC-GEM 1904–2021 plus ComCat Mw-type magnitudes from 2022 to the cut-off. It keeps depth ≤ 70 km
and Mw ≥ 5.8, with M0 = 10^(1.5 Mw + 9.1) N m.

**(a) Observed, band-wise.** Each magnitude band is summed over its own complete period. The periods follow the
shallow ISC-GEM completeness of Michael (2014): Mw 5.8–6.0 from 1976, 6.0–6.5 from 1964, 6.5–6.8 from 1955,
6.8–7.0 from 1940, 7.0–7.7 from 1918 and ≥ 7.7 from 1904. Each band's moment is divided by its own window length. A
naive sum over 1904–present is biased low, and the synthetic test shows the bias.

- The interval carries the Mw uncertainty: each event's moment is drawn from N(Mw, `magError`). `magError` is 0.2
  where ISC-GEM leaves it empty and an assumed 0.1 for ComCat. Band membership stays with the reported Mw. The
  central value `r_obs` uses the reported Mw. Several early events have `magError` 0.5–0.55 (1914, 1946), which makes
  the upper bounds long.
- `r_obs_x1` is the same ratio with the single largest event of the zone removed. It shows how much one earthquake
  decides the result.
- Events below Mw 5.8 are omitted. Under the tapered G-R below, they would add about 2–6 % of the moment (corner
  magnitude 8.5 to 7.75, b = 0.954).

**(b) Long-term, tapered Gutenberg-Richter (Kagan 2002).** Ṁs = α6 E[M0 | TGR], where E[M0] = Mt + Mt^β e^(Mt/Mc)
Mc^(1−β) Γ(1−β, Mt/Mc) and Mt is the moment at Mw 6.0. The inputs are:

- α6 is the rate of Mw ≥ 6.0 events since 1964 in the zone, drawn from its Jeffreys posterior Gamma(n + ½, T).
- β = 2b/3, with b from all events in the Mw 5.8 bin and above (Mw ≥ 5.75, binned to 0.1) in the whole outline,
  1976 to cut-off. That gives b = 0.954 ± 0.127 (n = 38, bootstrap 95 % [0.750, 1.260]) in 0.5.0, where the sample
  was cut at Mw ≥ 5.80 before binning, so the 5.8 bin lost its 5.75–5.79 events and b came out low (the 0.6.0
  rebuild gives about 1.00, n = 40). The bootstrap distribution is sampled, and the sub-zones are too small for
  their own b.
- The corner magnitude is uniform in 7.75–8.5. This range is an assumption. It is anchored on ISC-GEM's two largest
  events (1906 Mw 7.95 and 1911 Mw 8.02) and on Molnar & Ghose (2000), whose abstract mentions "two of comparable
  magnitude in the Nineteenth Century" to the M ≥ 8 events. Bird & Kagan (2004) give a corner magnitude for
  continental convergent boundaries, but their table was not read, so it was not used.

**Monte Carlo.** There are 20,000 draws per zone (seed 20261114). μ, H, the model, the Mw errors, α6, β and the
corner magnitude are drawn independently. Every published interval is the 2.5–97.5 percentile range.

### Catalogue-length test (`p_full`, `p_half`, `mc_bal`)

This test asks: if the zone were fully coupled, how unusual would the observed release be in a catalogue this short?
For each of 4,000 draws:

1. Solve for the corner magnitude `mc_bal` at which a tapered G-R with the drawn α6 and β releases exactly χ Ṁg.
   This is moment conservation, as in Bird & Kagan (2004).
2. Simulate one catalogue from 1904 to the cut-off: a Poisson count and tapered G-R sizes from Mw 5.8.
3. Apply the same band-wise estimator.

`p_full` is the fraction of simulated catalogues whose estimate is ≤ the observed one, for χ = 1. `p_half` is the
same for χ = 0.5. A small `p_full` (e.g. < 0.05) would mean a release lower than full coupling usually produces in
120 years. `unbal` is the fraction of draws where no corner magnitude ≤ 10.5 balances the budget. Those draws use
10.5. `over` (since 0.6.0) is the fraction where even a corner at 6.0 releases more than the budget (the observed
Mw ≥ 6 rate alone exceeds it); those draws use 6.0. Before 0.6.0 they were counted in `unbal` and simulated with
10.5.

### Coupling

Ṁg is computed for χ = 1, so the ratio itself estimates the seismic coupling coefficient. Many continental regions
release well below their geodetic rate seismically, through creep, folding, distributed off-fault strain or
post-seismic relaxation. Chang et al. (2025) attribute "∼60%" of the modelled Tien Shan strain to slip deficit on
mapped faults (52–69 % across their models) and the rest to distributed sources. A ratio near 0.5–0.7 therefore does
not by itself indicate a deficit. `p_half` shows how the test changes at χ = 0.5.

## Results (cut-off 2026-11-13)

Ṁ values are in N m/yr, with medians and 95 % intervals.

| Region | Models | n (Mw ≥ 6, 1964–) | Ṁg | Ṁs observed | r_obs | r_obs, largest removed | r_tgr | p_full | mc_bal |
|---|---|---|---|---|---|---|---|---|---|
| Tien Shan 69–92 °E | 5 | 31 | 2.14e19 [1.52e19, 2.85e19] | 3.03e19 | 1.42 [0.91, 8.99] | 0.90 | 0.93 [0.33, 2.89] | 0.81 | 8.15 |
| West 69–76 °E | ou2026 | 12 | 6.6e18 [4.9e18, 8.5e18] | 6.08e18 | 0.92 [0.52, 15.7] | 0.56 | 1.18 [0.37, 3.90] | 0.66 | 7.98 |
| Central 76–82 °E | 5 | 15 | 8.3e18 [6.0e18, 1.1e19] | 1.29e19 | 1.56 [0.58, 5.72] | 0.23 | 1.18 [0.38, 3.76] | 0.85 | 7.98 |
| East 82–92 °E | 4 (Chang) | 4 (`few`) | 4.0e18 [2.9e18, 5.2e18] | 1.14e19 | 2.87 [1.21, 20.2] | 0.70 | 0.67 [0.16, 2.66] | 0.94 | 8.42 |

What this shows:

- **No region shows a detectable deficit.** `p_full` is 0.66–0.94, so under full coupling most simulated
  120-year catalogues release *less* than observed. For the whole belt, the 95 % interval of the corner magnitude
  needed to balance the geodetic budget is 7.61–9.48 (median 8.15). This range includes the largest observed
  events.
- **The observed ratio is decided by one or two earthquakes.** In the central region, removing the 1911 Chon-Kemin
  event takes r_obs from 1.56 to 0.23. In the east, removing the 1906 Manas event takes it from 2.87 to 0.70.
- **The geodetic models agree.** For the whole belt, the per-model median Ṁg ranges from 1.88e19 (ou2026) to
  2.30e19 (chang_gpsgridder). The parameter ranges (μ, H) dominate the geodetic interval.
- **ISC-GEM magnitudes of the early great earthquakes dominate.** See the Molnar & Ghose comparison below. With
  their moments for seven events, the whole-belt r_obs is 0.71 [0.54, 1.01].
- H3 cells (`cells.geojson`, 10 cells overlapping the outline by ≥ 25 %): `p_full` ranges from 0.16 to 0.97. The
  lowest is cell `8220c7fffffffff` (41.2 °N, 80.7 °E, which holds the 2024 Wushi Mw 7.0), with r_obs 0.17
  [0.11, 0.33] and p_full 0.16. That is not significant either. Two cells have r_obs = 0 because their only large
  events (1914 Mw 7.42; 1937 Mw 6.4) predate the complete period of their band. Seven of the 10 cells are `few`.

Figures: `docs/img/deficit-map.png` (mean strain rate, outline, cells, Mw ≥ 6.5),
`docs/img/deficit-cumulative.png` (cumulative released moment against the geodetic accumulation band, whole belt)
and `docs/img/deficit-ratios.png` (the intervals above).

## Validation against the literature

**1. Chang et al. (2025), GRL: "approximately 70% of the total strain occurs west of 82°E (Table S3 in Supporting
Information S1)".** We recomputed this from their four published strain models. The area-weighted fraction west of
82 °E is 0.75 (BforStrain), 0.75 (gpsgridder), 0.75 (loc. avg. grad.) and 0.79 (VISR) for the second invariant, and
the Savage-Simpson rate gives the same to ±0.01. Ou et al. (2026), over the same domain, give 0.71. A plain sum over
their mesh points, which are denser in the west, gives 0.91–0.92. The area-weighted number matches "approximately
70%" to within 5–9 points. Table S3 (the exact definition) was not read, so this is a match within the stated
precision, not an exact reproduction.

**2. Molnar & Ghose (2000), GRL 27, 2377–2380: "an average shortening rate of 7 (± 2) mm yr−1 across the Tien
Shan".** Their Table 1 and parameters were read from the publisher PDF. They use μ = 3.3 × 10¹⁰ N m⁻², a depth of
20 km, a length of 1,800 km, a width of 300 km, 100 years, and a summed tensor M_NN = −16.3 (± 4.4) × 10²⁰ N m. Our
Kostrov function reproduces their arithmetic. From their M_NN, u = M/(2 μ H L T) = 6.86 mm/yr, and the strain rate is
22.9 × 10⁻⁹ /yr against their printed 23.1 × 10⁻⁹. From the sum of their seven scalar moments (16.5 × 10²⁰ N m), it
is 6.94 mm/yr. Both are checked in `test_kostrov_shortening_reproduces_molnar_ghose_2000`.

With **ISC-GEM moments for the same earthquakes** (their 1902 value kept, since 1902 precedes ISC-GEM), the same
arithmetic gives **14.5 mm/yr**. The difference is almost entirely in the early events:

| Event | Molnar & Ghose M0 (10²⁰ N m) | as Mw | ISC-GEM Mw (± magError) | ISC-GEM M0 (10²⁰ N m) |
|---|---|---|---|---|
| 1906-12-22 Manas | 1.3 ± 0.9 | 7.34 | 7.95 ± 0.20 | 10.6 |
| 1911-01-03 Chon-Kemin | 7.5 ± 2.9 | 7.85 | 8.02 ± 0.20 | 13.5 |
| 1914-08-04 Barköl | 0.6 ± 0.3 | 7.12 | 7.42 ± 0.53 | 1.7 |
| 1946-11-02 Chatkal | 1.1 ± 0.3 | 7.29 | 7.54 ± 0.55 | 2.6 |
| 1985-08-23 Wuqia | 0.2 ± 0.1 | 6.80 | 6.95 ± 0.10 | 0.33 |
| 1992-08-19 Suusamyr | 0.8 ± 0.2 | 7.20 | 7.20 ± 0.10 | 0.79 |

The modern events agree. The 1906 Manas event differs by a factor of 8 in moment. The atlas therefore reports both
versions: r_obs with ISC-GEM (1.42) and with the Molnar & Ghose moments (0.71). Our geodetic rate expressed as
Kostrov shortening over the outline's along-strike length (1,870 km) is 9.6 mm/yr (8.2–10.1 across models). That is
a belt-wide average, consistent with the "∼20 mm/yr of north–south crustal shortening" in the west that Chang et
al. (2025) and Abdrakhmatov et al. (1996) report, decreasing eastward ("∼70%" of strain west of 82 °E).

**Not reproduced:** Chang et al.'s fault-based moment accumulation rates (per-segment uncertainties of
0.1–26 × 10¹⁵ N m/yr) need their fault model and slip-deficit inversion. That is out of scope here: the layer is a regional budget, not a fault model.
No other published Tien Shan seismic/geodetic moment-rate *ratio* was found. A 2000 Acta Seismologica Sinica abstract
(GPS ~19 against seismic 13 mm/a, western Tien Shan) was seen only as a garbled search snippet and is not used.

## Limitations

- **Catalogue length against recurrence.** About 120 years against recurrence of centuries for Mw ≥ 7.5. One event
  changes a regional ratio by a factor of 2–7 (`r_obs_x1`). `p_full` and `r_tgr` quantify this; `r_obs` alone does
  not.
- **Early magnitudes.** The ratio is most sensitive to ISC-GEM Mw for 1906–1946, whose uncertainties are 0.2–0.55.
  An independent moment set (Molnar & Ghose 2000) halves the whole-belt ratio.
- **Aseismic deformation and coupling.** Creep, folding, distributed off-fault strain and post-seismic relaxation
  reduce the seismic share. χ = 1 is an upper bound, not an expectation (see Coupling).
- **Geodetic.** The velocity fields span roughly two decades. Savage-Simpson gives the minimum moment for a given
  tensor. Noise in the strain field biases |ε̇| upward. Chang's per-point 1σ was not propagated: the inter-model
  spread stands in for it. Gaps are filled by mean density, and the Chang nearest-neighbour grid shows the mesh
  pattern.
- **Geometry.** The outline is a hand-drawn envelope (vertices in `build_deficit.py`), and other outlines give other
  numbers. Large ruptures span several H3 cells, but each event is counted at its epicentre.
- **Completeness bands** are global (Michael 2014), not Tien Shan-specific. An event below its band's complete period
  is dropped even when it is large (1914 Mw 7.42 in the 7.0–7.7 band, complete from 1918).
- **Not done or not verified:** a global layer (licence, see above); Bird & Kagan (2004) corner magnitudes (not read);
  Chang et al. Table S3 definition (not read); GNSS-only or InSAR-only variants of Ou et al.; sensitivity to the
  outline.

## Data contract: `site/data/deficit/`

General rules are as in [data-schema.md](data-schema.md): WGS84 lon/lat, missing values omitted or `null`, numbers
rounded to 3 significant figures. Moment rates are in **N m / yr**; ratios are dimensionless, and 1 means seismic
release equals the full-coupling geodetic rate.

| File | Load | Content |
|---|---|---|
| `index.json` | first | disclaimer, licence, attribution, sources, `not_used` (GSRM), method parameters, validation numbers, `regions` (the same properties as `regions.geojson`), `files` with byte sizes |
| `regions.geojson` | first | 4 Polygon features: `tienshan`, `ts_west`, `ts_central`, `ts_east` |
| `cells.geojson` | first | one Polygon per H3 resolution-2 cell that overlaps the outline by ≥ 25 % (statistics over the whole cell) |

Feature properties (regions and cells):

| Property | Type / unit | Meaning |
|---|---|---|
| `id` | string | region id or H3 index |
| `name` | string | regions only |
| `lat`, `lon` | degrees | cells only: cell centre |
| `area_km2` | km² | zone area |
| `q` | code | `ok`: n6 ≥ 5; `few`: n6 < 5 (the ratio is mostly catalogue noise; show greyed out); `nogeod`: no strain model covers ≥ 70 % (no geodetic or ratio fields) |
| `models` | list | strain models used (`ou2026`, `chang_bforstrain`, `chang_gpsgridder`, `chang_locavggrad`, `chang_visr`) |
| `cov_min` | 0–1 | lowest area coverage among the models used (gaps are filled by mean density) |
| `n6` | count | Mw ≥ 6.0 events since 1964 (the rate behind `ms_tgr`) |
| `n_ev` | count | Mw ≥ 5.8 events 1904–cut-off, depth ≤ 70 km |
| `mw_max`, `mw_max_yr` | Mw, year | largest event in the zone |
| `mg`, `mg_lo`, `mg_hi` | N m/yr | geodetic moment rate at full coupling, median and 95 % interval |
| `ms_obs` | N m/yr | observed band-wise seismic moment rate (reported Mw) |
| `ms_tgr`, `ms_tgr_lo`, `ms_tgr_hi` | N m/yr | tapered G-R long-term seismic moment rate |
| `r_obs` | – | ms_obs / mg, median over the geodetic draws |
| `r_obs_lo`, `r_obs_hi` | – | 95 % interval, including Mw uncertainty (this interval can be wide and asymmetric) |
| `r_obs_x1` | – | r_obs with the zone's largest event removed |
| `r_tgr`, `r_tgr_lo`, `r_tgr_hi` | – | ms_tgr / mg, median and 95 % interval |
| `p_full` | 0–1 | fraction of synthetic catalogues under full coupling whose band-wise estimate is ≤ the observed one; small values (< 0.05) would indicate a deficit beyond catalogue noise |
| `p_half` | 0–1 | the same at 50 % coupling |
| `mc_bal` | Mw | median corner magnitude that balances the full-coupling geodetic budget at the observed Mw ≥ 6 rate |
| `unbal` | 0–1 | fraction of draws where no corner magnitude ≤ 10.5 balances the budget |
| `over` | 0–1 | fraction of draws where a corner at 6.0 already exceeds the budget (since 0.6.0) |

Display guidance (implemented in v0.3.1 by `site/js/deficit.js`, the Scientist-view layer and its panel): show `r_obs` with its interval and `p_full` together, as in "observed / geodetic
= 1.4 (0.9–9.0); full-coupling catalogues release less than this 81 % of the time". Grey out `few`. Put the
disclaimer from `index.json` next to the layer. Never colour a cell red for a "deficit" without `p_full` < 0.05,
which no zone currently reaches.
