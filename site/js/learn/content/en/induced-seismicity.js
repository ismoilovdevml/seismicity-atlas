export default {
  sentence: `Induced earthquakes are caused or triggered by human activity, such as producing gas, injecting waste water or filling a reservoir; the Groningen gas field in the Netherlands is the best-recorded European example.`,
  simple: [
    `Taking gas out of a porous sandstone lowers the pressure in it. The rock compacts by a fraction of a millimetre per metre, and the faults that cross the reservoir take extra stress. When that stress is released, the fault slips: a small earthquake, usually shallow (about 3 km), so even magnitude 3 can damage houses.`,
    `The number of such earthquakes follows the production history, but with a delay and not one to one. Groningen produced gas from 1963; the first recorded earthquake was in 1991, the largest (ML 3.6) in 2012, and earthquakes continued after production stopped in 2023.`,
    `The atlas shows the record: production per month, earthquakes per month, b-values and a comparison with the published studies. It does not model the physics and does not forecast future earthquakes.`,
  ],
  analogy: `Squeezing a sponge that is glued into a frame: the harder and longer you squeeze, the more the glue joints crack, and some keep cracking for a while after you let go.`,
  example: {
    title: `Groningen: production and earthquakes ML ≥ {mc}`,
    body: [
      `Earthquakes of ML {mc} or more per year: {rise} in 2003–2013 while production rose to its peak of {peak} billion m³ ({peakYear}), {restr} in the first five years of restrictions (2014–2018), and {after} after production stopped (95 % intervals).`,
      `Over {years}, the rank correlation between annual production and the number of earthquakes is {rho} in the same year and {rho1} with production one year earlier. A correlation describes the record; it does not separate production from other changes at the same time.`,
    ],
  },
  diagram: {
    title: `Production one year, earthquakes later`,
    caption: `Real annual totals of the Groningen field (NLOG.NL production, KNMI catalogue in the study region). Each dot is one year of production against the earthquakes of the same or a later year; choose the lag. The rank correlation is recomputed for the years shown. Play adds the years one by one.`,
    alt: `Scatter plot of annual gas production against the annual number of ML 1.5 or larger earthquakes, Groningen 2003 to 2024. More production goes with more earthquakes, most clearly with a one-year lag.`,
    xLabel: `Production, 10⁹ m³ per year`,
    yLabel: `Earthquakes ML ≥ 1.5`,
    readout: `Lag {lag} year(s): rank correlation ρ = {rho} over {n} years.`,
    lagLabel: `Earthquakes counted`,
    lagOpt: `+{k} yr`,
    colYear: `Year`,
    colEvents: `Earthquakes, same year`,
  },
  tech: [
    `Data: KNMI catalogue (FDSN event service, local magnitude ML, event type "induced or triggered event"), NLOG monthly production of the Groningen field (10⁹ m³, from 2003), study region the NLOG field outline buffered by 2 km, which reproduces the counts of Dost et al. (2017) within 2 %.`,
    `Rates use ML ≥ 1.5 for the whole period, the conservative completeness of the original network (Dost et al. 2017; Kraaijpoel et al. 2022). Phase rates carry exact Poisson 95 % intervals. b-values use three estimators: the atlas MAXC + 0.2 with bootstrap, Aki-Utsu at a fixed ML 1.5, and b-positive (van der Elst 2021).`,
    `The correlation is a Spearman rank correlation of 22 annual values (2003–2024). Annual values are autocorrelated, so p-values are indicative only. The physical link (pressure depletion, compaction and stress on faults) is modelled by Bourne et al. (2014) and later work; the atlas does not model it.`,
    `Validation against published values (Dost et al. 2017; Kraaijpoel et al. 2022; Gulia & Wiemer 2026): the classic field-wide numbers are reproduced; one map comparison differs because the KNMI catalogue alone maps only the densest part of the field. The table is on the Case studies page.`,
  ],
};
