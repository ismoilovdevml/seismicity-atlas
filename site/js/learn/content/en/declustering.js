export default {
  sentence: `Declustering removes events that look like aftershocks or foreshocks of a larger one, using windows in space and time; in this global catalogue it lowers b and depends strongly on the window choice, so the map shows the full catalogue.`,
  simple: [
    `Earthquakes cluster: a large one is followed by many smaller ones nearby. Some studies want only the “independent” mainshocks, for example to test whether events occur at random in time.`,
    `The classic method of Gardner and Knopoff (1974) draws a box around each event: a distance and a duration that grow with its magnitude. Smaller events inside the box of a larger one are marked as dependent and removed.`,
    `For a global catalogue of magnitude 5 and above, the boxes of the largest events last for years and reach hundreds of kilometres, so they remove much more than aftershocks. Since the removed events are mostly small, the b-value of what is left goes down.`,
  ],
  analogy: `Counting the people who visit a shop, but ignoring anyone who came within an hour of someone they know. With a short rule you remove groups of friends; with a rule of “within a year”, you remove most regular customers too, and the remaining count says more about your rule than about the shop.`,
  example: {
    title: `Declustered b in a subduction cell near {loc}`,
    body: [
      `Full catalogue: b = {b} [{lo}, {hi}]. After Gardner-Knopoff declustering: b = {bdecl} [{bdeclLo}, {bdeclHi}].`,
      `Across the {nShown} shown shallow cells with both values, the median declustered-minus-full difference is {med}, and declustered b is lower in {lower} cells.`,
    ],
  },
  diagram: {
    title: `Space-time windows remove clustered events`,
    caption: `Synthetic catalogue: random background events plus three sequences. Windows open from the largest event down; events inside a window are removed. Change the window scale to see how much the result depends on that choice.`,
    alt: `Scatter of events by time and distance; rectangles appear around large events and the events inside them turn grey; the b-value of the remaining events is shown below.`,
    lgKept: `Kept`, lgRemoved: `Removed as dependent`, lgWindow: `Window`,
    xLabel: `Time (years)`, yLabel: `Distance along the zone (km)`,
    slider: `Window scale`, all: `Show all windows`,
    readout: `Window scale {k}: {w} of {nw} windows opened, {kept} of {n} events kept. b of all events {bAll}, of kept events {bKept}.`,
  },
  tech: [
    `Gardner-Knopoff windows as in ZMAP and OpenQuake (scripts/seislib.py, gk_windows), distance L in km and duration T in days:<code class="lr-formula">L(M) = 10^(0.1238 M + 0.983),   T(M) = 10^(0.032 M + 2.7389) for M ≥ 6.5, else 10^(0.5409 M − 0.547)</code>Events are processed from the largest down; an event inside the window of a larger one is dependent.`,
    `Why the atlas does not decluster the main b: for M ≥ 6.5 the time window exceeds a year, so in a global M ≥ 5 catalogue the windows remove a large share of all events, including independent ones. The resulting declustered b mostly reflects the window choice. Kagan (2010) declusters with a different method, and the atlas's Gardner-Knopoff value does not reproduce his declustered global b; this is listed as a mismatch in docs/validation.md.`,
    `Published anyway: the declustered b and its bootstrap interval are in the data (<code>sh_bdecl</code>, <code>dp_bdecl</code>) and in the cell panel's robustness block, so the effect is visible per cell.`,
    `The same windows reappear for sequences: the Sequences page selects independent mainshocks with a related window (radius from Wells & Coppersmith 1994, one year).`,
  ],
};
