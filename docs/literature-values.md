# Literature values: published b, β and Mc at teleseismic magnitudes

Machine-readable source: `scripts/val_literature.json` (read by `scripts/val_literature.py`, results in
`results/val_literature.json`, rows appended to the site validation table).

**How these were collected.** The entries were extracted with LLM assistance from text that was actually fetched
(arXiv author preprints and a thesis read with `pdftotext`, and one abstract). Each quote was checked by script to
appear verbatim in the extracted text, after whitespace normalisation, except the Bird & Kagan (2004) abstract,
which was read from an HTML record. **Every entry has `needs_human_check: true`.** Before relying on a value, a
person should open the source at the stated table/page and confirm the number. No value was taken from memory, and
values that could only be read through a summarising tool were left out (list at the end).

**How ours is computed.** For each entry the same period, depth limit and magnitude threshold are applied to
ISC-GEM Mw (`compare` block in the JSON). Three numbers are reported:

- **TGR**: 1.5 × β of a tapered Gutenberg-Richter fit (maximum likelihood, β and corner moment free; Kagan 2002).
  This is the like-for-like estimator for the Kagan values, and the verdict uses it.
- **Aki**: the atlas estimator at the published threshold (Aki-Utsu, 0.1 bins, bootstrap 95 %).
- **TGR, magerr 0.10 only**: the same fit on events whose ISC-GEM magnitude uncertainty is 0.10. We take that as a
  marker of direct GCMT-type Mw (an inference: the ComCat copy of ISC-GEM does not flag proxy magnitudes).

Verdict: z = (ours − published) / √(se_ours² + se_pub²), with se_ours = (CI width)/3.92 and se_pub the printed
uncertainty (× 1.5 for β; 0 when none is printed). |z| ≤ 1.96 is a match.

Caveats that apply to all Kagan entries:

- Flinn-Engdahl (FE) regions are polygons. The boxes here are rough envelopes (`approximate: true`), so the event
  counts differ (column "N pub / ours"). Only the Tohoku box (35–40° N, 140–146° E) is defined exactly in the paper.
- Kagan's magnitude is m = (2/3)(log₁₀ M − 9.0); ISC-GEM uses log₁₀ M = 1.5 Mw + 9.1. The same moment threshold
  is therefore about 0.07 lower in Mw. We apply the printed threshold to Mw unchanged, which is slightly stricter.
- "Trenches" and "all 18 subduction zones" are approximated by the PB2002 `SUB` class (nearest boundary step
  within 200 km). That class is defined differently.

## Results

| # | Entry | Published (as printed) | b-equivalent | N pub / ours | Ours: TGR | Ours: Aki | TGR, magerr 0.10 only | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | `kj2013_fe01_alaska_aleutian` | beta 0.65 ±0.04 | 0.975 ± 0.06 | 280 / 291 | 0.990 [0.865, 1.133] | 1.001 [0.897, 1.106] | 0.915 [0.808, 1.044] | match (approximate region); magerr 0.10: match |
| 2 | `kj2013_fe05_mexico_guatemala` | beta 0.6 ±0.06 | 0.900 ± 0.09 | 164 / 125 | 0.819 [0.660, 1.021] | 0.880 [0.749, 1.066] | 0.795 [0.639, 0.946] | match (approximate region); magerr 0.10: match |
| 3 | `kj2013_fe06_central_america` | beta 0.68 ±0.06 | 1.020 ± 0.09 | 161 / 123 | 1.038 [0.880, 1.283] | 1.073 [0.923, 1.275] | 1.025 [0.868, 1.244] | match (approximate region); magerr 0.10: match |
| 4 | `kj2013_fe08_andean_south_america` | beta 0.57 ±0.04 | 0.855 ± 0.06 | 286 / 357 | 0.970 [0.866, 1.073] | 0.976 [0.879, 1.081] | 0.903 [0.804, 1.014] | match (approximate region); magerr 0.10: match |
| 5 | `kj2013_fe12_kermadec_tonga_samoa` | beta 0.8 ±0.04 | 1.200 ± 0.06 | 439 / 500 | 1.259 [1.156, 1.389] | 1.237 [1.137, 1.346] | 1.212 [1.108, 1.314] | match (approximate region); magerr 0.10: match |
| 6 | `kj2013_fe18_guam_japan` | beta 0.86 ±0.10 | 1.290 ± 0.15 | 88 / 94 | 1.285 [0.993, 1.651] | 1.312 [1.082, 1.631] | 1.259 [0.998, 1.631] | match (approximate region); magerr 0.10: match |
| 7 | `kj2013_fe19_japan_kamchatka` | beta 0.62 ±0.04 | 0.930 ± 0.06 | 425 / 435 | 1.072 [0.969, 1.201] | 1.049 [0.962, 1.152] | 0.993 [0.898, 1.116] | match (approximate region); magerr 0.10: match |
| 8 | `kj2013_tohoku_box` | beta 0.64 ±0.07 | 0.960 ± 0.11 | 109 / 105 | 1.082 [0.860, 1.333] | 1.096 [0.930, 1.335] | 1.023 [0.799, 1.260] | match; magerr 0.10: match |
| 9 | `kj2013_fe24_sunda_arc` | beta 0.65 ±0.04 | 0.975 ± 0.06 | 278 / 141 | 1.077 [0.901, 1.253] | 1.126 [0.969, 1.329] | 1.018 [0.862, 1.211] | match (approximate region); magerr 0.10: match |
| 10 | `kj2013_fe46_andaman_sumatra` | beta 0.71 ±0.07 | 1.065 ± 0.11 | 143 / 240 | 1.010 [0.868, 1.151] | 1.002 [0.878, 1.145] | 0.921 [0.798, 1.080] | match (approximate region); magerr 0.10: match |
| 11 | `kj2013_all_18_subduction_zones` | beta 0.65 ±0.01 | 0.975 ± 0.01 | 4217 / 2783 | 1.034 [0.996, 1.073] | 1.031 [0.997, 1.069] | 0.977 [0.938, 1.013] | mismatch (approximate region); magerr 0.10: match |
| 12 | `kagan2010_global_mt56` | beta 0.6773 | 1.016 ± 0.00 | 7369 / 7358 | 1.087 [1.063, 1.110] | 1.060 [1.037, 1.085] | 1.035 [1.012, 1.062] | mismatch; magerr 0.10: match |
| 13 | `kagan2010_trenches_mt56` | beta 0.6463 | 0.969 ± 0.00 | 4805 / 3513 | 1.053 [1.013, 1.094] | 1.037 [1.007, 1.069] | 0.992 [0.955, 1.029] | mismatch (approximate region); magerr 0.10: match |
| 14 | `kagan2010_global_declustered_mt56` | beta 0.648 | 0.972 ± 0.00 | 5841 / 3933 | 0.934 [0.902, 0.962] | 0.914 [0.889, 0.939] | 0.903 [0.874, 0.926] | mismatch (approximate region); magerr 0.10: mismatch |
| 15 | `birdkagan2004_pb2002_class_range` | beta 0.53–0.92 (range over 7 classes) | 0.80–1.38 | – | beta SUB 0.70, CCB 0.66, OCB 0.65, CTF 0.72, OTF 0.82, CRB 0.74, OSR 1.02 | – | – | mismatch (approximate) |
| 16 | `petruccelli2018_gcmt_mc_map` | Mc 5.4–5.5 (most of the map) | – | – | MAXC+0.2 5.4, MBS 5.6, GFT 5.2 (n=34012) | – | – | match |

**Summary.** 16 entries from four sources: Kagan & Jackson 2013 (11 entries), Kagan 2010 (3), Bird & Kagan 2004 (1)
and Petruccelli 2018 (1).

- **Regional values (1–10): all ten match.** The intervals are wide (n ≈ 90–500), so this test is weak. For each
  region, ours is within about 0.15 of the published b, in both directions.
- **Aggregate values (11–13): mismatch with the full ISC-GEM catalogue, match without its non-GCMT magnitudes.**
  ISC-GEM gives b higher by 0.06–0.07. On events with magnitude uncertainty 0.10, the differences are:
  - global 1.035 [1.012, 1.062] against 1.016;
  - trenches 0.992 [0.955, 1.029] against 0.969;
  - all subduction zones 0.977 [0.938, 1.013] against 0.975.

  The events with larger magnitude uncertainty are concentrated near the threshold. In the global 1982–2008 set
  (`magerr_diagnostic_global_1982_2008`) they are 14.6 % of events at Mw 5.6–6.0 and about 1 % from Mw 7.0 up.
  - On their own they give Aki b = 1.736 [1.633, 1.850] (n = 995).
  - The rest give 1.006 [0.983, 1.028] (n = 7,138).

  So these events steepen the distribution. This is a property of the catalogue that affects the atlas. It is described here but not
  corrected in the map.
- **Declustered (14): mismatch.** Our Gardner-Knopoff declustering gives a lower b (0.934) than Kagan's own
  declustering (0.972). The two methods remove different events, so this is not a like-for-like comparison.
- **β range over classes (15): mismatch at the top end.**
  - Our OSR β is 1.02. The published best fits span 0.53–0.92.
  - Bird & Kagan split spreading ridges by mechanism, and the per-class table was not read, so we cannot tell which
    class gave 0.92.
  - All our other classes fall in 0.65–0.82, inside the published range.
- **Mc (16): match.** For 1980–2016 at 0–50 km, the global MAXC+0.2 is 5.4. Petruccelli reports 5.4–5.5 across
  most of the GCMT Mc map.

## Entries in detail

**1. `kj2013_fe01_alaska_aleutian`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `1    1 Alaska-Aleutian Arc           280         0.65±0.04    5.10   9.35±0.28 8.0    1.71 0.336`  
Region: Flinn-Engdahl seismic region #1 'Alaska-Aleutian Arc'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [50, 65, 163, -140], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**2. `kj2013_fe05_mexico_guatemala`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `2    5 Mexico-Guatemala              164         0.60±0.06    2.38   9.17±0.29 8.0    1.35 0.567`  
Region: Flinn-Engdahl seismic region #5 'Mexico-Guatemala'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [13, 22, -106, -90], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**3. `kj2013_fe06_central_america`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `3    6 Central America               161         0.68±0.06    2.49   9.22±0.29 7.8    0.59 0.236`  
Region: Flinn-Engdahl seismic region #6 'Central America'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [7, 15, -92, -82], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**4. `kj2013_fe08_andean_south_america`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `5    8 Andean S. America             286         0.57±0.04    8.49   9.74±0.28 8.8    9.54 1.124`  
Region: Flinn-Engdahl seismic region #8 'Andean S. America' (includes Chile and Peru/Ecuador/Colombia margins; no Chile-only split in this table). Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [-56, 13, -82, -63], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**5. `kj2013_fe12_kermadec_tonga_samoa`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `6   12 Kermadec-Tonga-Samoa          439         0.80±0.04    5.95   9.12±0.28 8.1    2.16 0.363`  
Region: Flinn-Engdahl seismic region #12 'Kermadec-Tonga-Samoa'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [-38, -13, 175, -170], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**6. `kj2013_fe18_guam_japan`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `11   18 Guam-Japan                      88        0.86±0.10    2.89   9.82±0.30 7.8    0.34 0.117`  
Region: Flinn-Engdahl seismic region #18 'Guam-Japan' (Izu-Bonin-Mariana arc). Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [12, 34, 138, 148], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**7. `kj2013_fe19_japan_kamchatka`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `12   19 Japan-Kamchatka               425 0.62±0.04            8.49 9.43±0.28   8.4    5.30 0.624`  
Region: Flinn-Engdahl seismic region #19 'Japan-Kamchatka' (text: 'Japan-Kurile-Kamchatka #19'). Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [35, 60, 140, 165], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**8. `kj2013_tohoku_box`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `12a – Tohoku area (5 × 6 ) ◦ ◦ 109 0.64±0.07 1.76 9.26±0.29 7.7 0.32 0.180`  
Region: Spherical rectangle; text p.~13: 'Tohoku area (latitudes 35 − 40◦ N, longitudes 140 − 146◦E)'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [35, 40, 140, 146], "approximate": false, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**9. `kj2013_fe24_sunda_arc`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `17   24 Sunda Arc                     278         0.65±0.04    6.51   9.55±0.28 8.6    4.66 0.716`  
Region: Flinn-Engdahl seismic region #24 'Sunda Arc' (Java-Sumba; Sumatra is in FE #46). Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [-12, -5, 100, 125], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**10. `kj2013_fe46_andaman_sumatra`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `18   46 Andaman Is-Sumatra            143         0.71±0.07    2.66   9.37±0.29 9.1   15.26 5.734`  
Region: Flinn-Engdahl seismic region #46 'Andaman Is-Sumatra'. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "box", "box_SNWE": [-6, 15, 90, 102], "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**11. `kj2013_all_18_subduction_zones`** — Kagan, Y. Y. & Jackson, D. D. (2013). Tohoku earthquake: a surprise? Bulletin of the Seismological Society of America, 103(2B), 1181-1194. doi:10.1785/0120120110  
Read at: https://arxiv.org/pdf/1112.5217v2 (author preprint v2, 21 Jul 2012; read via pdftotext); location: Table 1 (Table 1: FE Subduction Seismic Zones, GCMT 1977-2010/12/31, mt = 5.8.) Columns: No | FE No | Flinn-Engdahl seismic region name | N | beta +/- sigma_beta | MT_dot x1e27 | mc +/- sigma | mo | Ms_dot x1e27 | psi; arXiv v2 p.35  
Quote: `1977-2010/12/31 ZONES      4217         0.65±0.01   77.57   9.36±0.27 9.1   49.07 0.633`  
Region: Union of the 18 Flinn-Engdahl subduction zones listed in Table 1. Magnitude: Mw (GCMT scalar moment). Threshold/Mc: mt = 5.8. Period: 1977-01-01 to 2010-12-31. Depth: 0-70 km (shallow). Declustering: none (all events). Estimator: maximum likelihood, tapered Gutenberg-Richter (beta and corner magnitude). Catalogue: GCMT.  
Our selection: {"kind": "class", "pb_class": "SUB", "approximate": true, "years": [1977, 2010], "depth_max_km": 70, "threshold": 5.8, "declustered": false}. needs_human_check: true.

**12. `kagan2010_global_mt56`** — Kagan, Y. Y. (2010). Earthquake size distribution: Power-law with exponent β ≡ 1/2? Tectonophysics, 490(1-2), 103-114. doi:10.1016/j.tecto.2010.04.034  
Read at: https://arxiv.org/pdf/0908.1207v2 (author preprint v2, 18 Mar 2010); location: Table 2: 'The β-values for various subdivisions of CMT catalog.' Columns: # | Earthquakes | mt = 5.6: β, Eq. # | mt = 5.8: β, Eq. #. Caption note: 'Shallow earthquakes in 1977-2008 (mt = 5.8) and 1982-2008 (mt = 5.6) CMT catalog.' (arXiv v2 p.41)  
Quote: `1.             Global              0.6773    7369    0.6820   5450`  
Region: Global, all shallow GCMT earthquakes. Magnitude: Mw (CMT moment). Threshold/Mc: mt = 5.6 (value recorded); same row gives mt = 5.8 value in column 5. Period: 1982-2008 for mt=5.6 (1977-2008 for mt=5.8). Depth: shallow (paper elsewhere: 0-70 km; not restated at the table). Declustering: none (rows 2-3 of same table give declustered global: 0.6480 / aftershock-moment-included 0.6229 at mt=5.6). Estimator: maximum likelihood beta (Kagan). Catalogue: GCMT (CMT).  
Our selection: {"kind": "global", "approximate": false, "declustered": false, "years": [1982, 2008], "depth_max_km": 70, "threshold": 5.6}. needs_human_check: true.

**13. `kagan2010_trenches_mt56`** — Kagan, Y. Y. (2010). Earthquake size distribution: Power-law with exponent β ≡ 1/2? Tectonophysics, 490(1-2), 103-114. doi:10.1016/j.tecto.2010.04.034  
Read at: https://arxiv.org/pdf/0908.1207v2 (author preprint v2, 18 Mar 2010); location: Table 2: 'The β-values for various subdivisions of CMT catalog.' Columns: # | Earthquakes | mt = 5.6: β, Eq. # | mt = 5.8: β, Eq. #. Caption note: 'Shallow earthquakes in 1977-2008 (mt = 5.8) and 1982-2008 (mt = 5.6) CMT catalog.' (arXiv v2 p.41)  
Quote: `4.   Trenches (Subduction zones)   0.6463    4805    0.6507   3223`  
Region: Trenches (subduction zones) as defined in Kagan et al. (2010) PAGEOPH tectonic-zone regionalisation (Kagan, Bird & Jackson 2010). Magnitude: Mw (CMT moment). Threshold/Mc: mt = 5.6 (value recorded); same row gives mt = 5.8 value in column 5. Period: 1982-2008 for mt=5.6 (1977-2008 for mt=5.8). Depth: shallow (paper elsewhere: 0-70 km; not restated at the table). Declustering: none (rows 2-3 of same table give declustered global: 0.6480 / aftershock-moment-included 0.6229 at mt=5.6). Estimator: maximum likelihood beta (Kagan). Catalogue: GCMT (CMT).  
Our selection: {"kind": "class", "pb_class": "SUB", "approximate": true, "declustered": false, "years": [1982, 2008], "depth_max_km": 70, "threshold": 5.6}. needs_human_check: true.

**14. `kagan2010_global_declustered_mt56`** — Kagan, Y. Y. (2010). Earthquake size distribution: Power-law with exponent β ≡ 1/2? Tectonophysics, 490(1-2), 103-114. doi:10.1016/j.tecto.2010.04.034  
Read at: https://arxiv.org/pdf/0908.1207v2 (author preprint v2, 18 Mar 2010); location: Table 2: 'The β-values for various subdivisions of CMT catalog.' Columns: # | Earthquakes | mt = 5.6: β, Eq. # | mt = 5.8: β, Eq. #. Caption note: 'Shallow earthquakes in 1977-2008 (mt = 5.8) and 1982-2008 (mt = 5.6) CMT catalog.' (arXiv v2 p.41)  
Quote: `2.       Global declustered        0.6480    5841    0.6568   4498`  
Region: Global, all shallow GCMT earthquakes. Magnitude: Mw (CMT moment). Threshold/Mc: mt = 5.6 (value recorded); same row gives mt = 5.8 value in column 5. Period: 1982-2008 for mt=5.6 (1977-2008 for mt=5.8). Depth: shallow (paper elsewhere: 0-70 km; not restated at the table). Declustering: Kagan's own declustering (not Gardner-Knopoff; method not restated at the table). Estimator: maximum likelihood beta (Kagan). Catalogue: GCMT (CMT).  
Our selection: {"kind": "global", "approximate": true, "declustered": true, "years": [1982, 2008], "depth_max_km": 70, "threshold": 5.6}. needs_human_check: true.

**15. `birdkagan2004_pb2002_class_range`** — Bird, P. & Kagan, Y. Y. (2004). Plate-tectonic analysis of shallow seismicity: apparent boundary width, beta, corner magnitude, coupled lithosphere thickness, and coupling in seven tectonic settings. Bulletin of the Seismological Society of America, 94(6), 2380-2399. doi:10.1785/0120030107  
Read at: https://central.scec.org/node/3563 (SCEC record, abstract; raw HTML via curl); location: Abstract  
Quote: `Best-fitting ß values range from 0.53 to 0.92, but all 95% confidence ranges are consistent with a common value of 0.61–0.66.`  
Region: Seven PB2002 plate-boundary classes (CRB, CTF, CCB, OSR, OTF, OCB, SUB), platelike (non-orogen) regions, apparent boundary half-widths. Magnitude: Mw (CMT moment). Threshold/Mc: not read (Bird et al. 2010 SRL, which uses these parameters, uses mT = 5.66). Period: CMT 1977 onward (exact end not read). Depth: shallow (<= 70 km per Bird et al. 2010 description). Declustering: none. Estimator: maximum likelihood tapered Gutenberg-Richter. Catalogue: CMT (Harvard/GCMT).  
Our selection: {"kind": "class_range", "years": [1977, 2002], "depth_max_km": 70, "threshold": 5.8, "approximate": true, "declustered": false}. needs_human_check: true.

**16. `petruccelli2018_gcmt_mc_map`** — Petruccelli, A. (2018). PhD thesis, Alma Mater Studiorum Università di Bologna (AMS Dottorato eprint 8466) - material later published in Petruccelli et al. (2019) EPSL 527, 115791 and GRL 46. doi:none (thesis)  
Read at: https://amsdottorato.unibo.it/id/eprint/8466/1/Petruccelli_Antonio_tesi.pdf (read via pdftotext); location: Part 2, Methods (around Fig. 2.2, thesis p.~46)  
Quote: `However, the Mc-map (Fig. 2.2) of the GCMT catalog for the full period since 1980 shows that most Mc-values are in the range 5.4–5.5, with only little deviations in some particular zones: along most oceanic ridges and in the Himalayan area the Mc-values are slightly lower with 5.1–5.3.`  
Region: Global map of local Mc (spatially variable cylinder radius R, Fig. 2.1). Magnitude: Mw (GCMT). Threshold/Mc: local Mc map. Period: 1980-2016. Depth: 0-50 km. Declustering: none. Estimator: not read in detail (local Mc per node). Catalogue: GCMT.  
Our selection: {"kind": "mc_global", "years": [1980, 2016], "depth_max_km": 50, "approximate": true}. needs_human_check: true.

## Read but not used

| Source | Why not used |
|---|---|
| Petruccelli 2018 thesis, Table 3.7: GCMT b by rake (thrust 0.907 ± 0.01, normal 1.129 ± 0.025, strike-slip 1.015 ± 0.016; 1980–2016, 0–50 km, Mc 5.5) | The quotes were read, but ISC-GEM has no focal mechanisms, so the same selection cannot be made. It would need a GCMT join. |
| Kagan 2002 (GJI 148, 520): global shallow β 0.675 ± 0.014, m ≥ 5.8 | The number was read only through a summarising tool, not verbatim. |
| Bird, Kreemer & Holt 2010 (SRL 81, 184): intraplate β 0.63 | The authors adopted this value as a fit, not as a formal estimate, and "intraplate" has no equivalent selection in the atlas. |
| Nishikawa & Ide 2014 (Nat. Geosci.): per-zone b | Paywalled; the supplement was not retrievable. |
| Bird & Kagan 2004 Table 5: β per class | Paywalled; author copies returned errors on 2026-11-13. |
| Kagan, Bird & Jackson 2010 (PAGEOPH 167) | Not retrievable. |
| Crisosto & Tassara 2024 (GRL, doi:10.1029/2024GL110984): b for 157 trench transects from ISC, including Chile | Open access but returned HTTP 403 on 2026-11-13. This is the best lead for Chile segment values. |
| Frohlich & Davis 1993; Kagan 1997, 1999; Legrand et al. | No open copy found. |
