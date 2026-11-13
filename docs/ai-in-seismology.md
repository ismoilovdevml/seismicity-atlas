# AI, ML and LLM agents in seismology: what could help a catalogue-statistics atlas

Research date: 2026-11-13. Short survey; claims are from the cited abstracts and pages unless marked otherwise.

## 1. Machine-learning catalogues (waveform level)

| Tool | What it does | Source |
|---|---|---|
| PhaseNet | deep-network P/S arrival picking | Zhu & Beroza 2019, GJI 216(1), 261–273 |
| EQTransformer | attention model for joint detection and picking | Mousavi et al. 2020, Nature Communications |
| SeisBench | open framework with a common interface to models and benchmark datasets | Woollam et al. 2022, SRL, doi:10.1785/0220210324 |
| Picker benchmark | six pickers on eight datasets: EQTransformer, GPD and PhaseNet best, small edge for EQTransformer on teleseismic data | Münchmeyer et al. 2022 ([KIT](https://publikationen.bibliothek.kit.edu/1000143103/146775569)) |
| QuakeFlow, GaMMA | end-to-end ML catalogue building: picking, association, location | Zhu et al.; the [SSA 2025 catalogue workshop](https://ai4eps.github.io/Earthquake_Catalog_Workshop/conclusion/SSA25_catalog_workshop_conclusion.pdf) lists them as reference workflows |

What ML catalogues change for completeness:

- **Lower Mc, regionally.** A study of Central Italy 2016–2017 found that ML catalogues lowered the median Mc from
  about 1.6 to 0.5 ([arXiv 2602.09792](https://www.arxiv.org/abs/2602.09792)).
- **Misses.** Pickers miss about 10 % of arrivals, which could drop up to about 10 % of known events
  ([arXiv 2511.09805](https://arxiv.org/html/2511.09805)).
- **The magnitude scale changes too.** Beroza, Segou & Mousavi (2021, Nat. Commun.,
  [PMC8346575](https://pmc.ncbi.nlm.nih.gov/articles/PMC8346575)) call for applying classic statistics such as b
  to these richer catalogues, and note that much work remains.

## 2. Foundation models and LLM fine-tunes (waveform level)

| Model | What it is | Source |
|---|---|---|
| SeisMoLLM | fine-tunes a pre-trained GPT-2 for picking, magnitude and other tasks on STEAD/DiTing; reports 36 best results out of 43 task metrics | [arXiv 2502.19960](https://arxiv.org/html/2502.19960v2) |
| SeisCLIP | contrastive pre-training on seismic spectra and event metadata | [arXiv 2309.02320](https://arxiv.org/pdf/2309.02320v1.pdf) |
| U-Trans | a waveform foundation model whose latent features improve picking, location, magnitude and polarity | Sci. Rep. 2026, [PubMed 41803205](https://pubmed.ncbi.nlm.nih.gov/41803205/) |
| Review | foundation models for seismic data processing | [arXiv 2503.24166](https://arxiv.org/html/2503.24166v2) |

The gains these papers report are on their authors' own benchmarks.

## 3. LLM agents and LLM tools

- **TRACE** ([arXiv 2603.21152](https://arxiv.org/abs/2603.21152v1), v1 22 Mar 2026, v4 30 Sep 2026).
  - *Architecture.* A multi-agent system with three stages: planning and task decomposition under seismological
    constraints, automated execution with diagnostics, and scientific integration. It has a knowledge library, a
    validated tool library (PhaseNet, GaMMA, HypoDD; it cites ObsPy, EQcorrscan, SeisBench, SeismoStats) and a
    provenance record of data, code versions and parameters.
  - *Models.* GPT-5.1 is the main backbone. Claude Sonnet 4 and Gemini 3 Flash (preview) are used in a
    cross-backbone benchmark.
  - *Cases.* 2019 Ridgecrest (delayed triggering), 2025 Santorini–Kolumbo (structurally guided intrusion), and
    Sanriku 2025–26 with local b-values (for example 0.51 ± 0.04 from 201 events).
  - *Limits stated by the authors.* Auditability does not guarantee correctness, and expert review is still
    needed.
  - *Caution.* Its short-window b-values come from 200–300 events; the authors call them diagnostics. Global
    plate-boundary numbers attributed to TRACE could not be found in the v4 text ([validation](validation.md) §4).
- **USGS "digital archivist"** (2026): Gemini 2.5 Pro extracted structured macroseismic data from legacy reports,
  about 2,300 geocoded intensity reports for the Daly City earthquake
  ([SSA news](https://www.seismosoc.org/news/llm-extracts-historical-california-earthquake-data-as-digital-archivist/),
  [USGS](https://www.usgs.gov/publications/digital-archivist-automating-legacy-macroseismic-data-processing-using-large-language)).

## 4. Takeaways for this atlas

1. **ML catalogues cannot feed a global atlas yet.** They are regional and event-specific, and each has its own
   Mc and magnitude scale. Mixing them into a global M ≥ 5 analysis would recreate the mixed-scale problem that
   makes ComCat unusable for b here (validation §5). A later version could add them as separate regional
   overlays, each with its own Mc and b, never merged into the global cells.
2. **LLMs are useful at the edges, not in the numbers.**
   - *Extracting published values.* The weakest part of our validation is the regional reference values: we
     found few verified b-values at Mw ≥ 5. An LLM extraction pass over the literature, in the style of the
     USGS digital archivist, could build a table of published regional b and Mc with page references. A person
     must check it before it is used.
   - *Orchestration and provenance.* TRACE's design (tool library, provenance record, explicit uncertainty) is
     a good pattern. This repository applies it without an agent: every number flows from code to
     `results/*.json` to the docs.
3. **Statistics stay deterministic.** b, Mc, intervals and masks must come from reproducible code with fixed
   seeds, not from a model's output. An agent may run the pipeline; it must not be the estimator.
4. **What we deliberately do not use.** We use no ML magnitude estimates and no LLM-generated numbers. The atlas
   contains no AI-derived values.
