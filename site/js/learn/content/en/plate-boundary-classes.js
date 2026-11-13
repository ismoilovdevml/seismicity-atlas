export default {
  sentence: `Each earthquake in the atlas is labelled with the type of the nearest plate boundary in the PB2002 model (subduction, ridge, transform, rift and others), which lets b be compared between tectonic settings.`,
  simple: [
    `The outer shell of the Earth is broken into plates. Where they meet, they move in different ways: one dives under another (subduction), they pull apart (spreading ridges and rifts), or they slide past each other (transform faults).`,
    `Peter Bird's PB2002 model maps these boundaries and labels each segment with a class. The atlas gives every event the class of the nearest boundary within 200 km.`,
    `The classes have measurably different b-values. Spreading ridges have the highest b (relatively many small events); convergent boundaries the lowest, which fits the idea that b falls as stress rises.`,
  ],
  analogy: `Like cracks in a frozen lake: where ice sheets push together you get big ridges and loud cracks; where they pull apart, many small cracks. The kind of edge shapes the mix of sizes.`,
  example: {
    title: `b by boundary class, whole world`,
    body: [
      `Pooling every direct-Mw event of 1976–2021 by class, the highest b is at {hiName} ({hiCode}): {hiB}. The lowest is at {loName} ({loCode}): {loB}. Subduction zones give {subB}.`,
      `The {nClasses} classes include “none”, events more than 200 km from a boundary. The Validation page compares the values and their ranking with published studies.`,
    ],
  },
  diagram: {
    title: `b with its 95 % interval by PB2002 class`,
    caption: `Real data (global.json). The vertical line is b = 1. Choose a class with the slider or by clicking its row.`,
    alt: `Dot-and-interval chart of b per plate-boundary class, sorted from highest to lowest.`,
    slider: `Class`, colClass: `Class`, colN: `Events`,
    readout: `{code}, {name}: b = {b} from {n} events. {what}`,
    classes: {
      SUB: `One plate sinks under another; the largest earthquakes on Earth.`,
      CCB: `Two continents collide, as in the Himalaya.`,
      OCB: `Convergence within oceanic lithosphere without a clear slab.`,
      CTF: `Continental plates slide past each other, as on the San Andreas fault.`,
      OTF: `Short faults that offset mid-ocean ridges.`,
      CRB: `A continent being pulled apart, as in East Africa.`,
      OSR: `New sea floor forms; many small, few large earthquakes.`,
      none: `More than 200 km from any PB2002 boundary: plate interiors and wide deformation zones.`,
    },
  },
  tech: [
    `Classes (Bird 2003): SUB subduction, CCB continental convergent boundary, OCB oceanic convergent boundary, CTF continental transform, OTF oceanic transform, CRB continental rift, OSR oceanic spreading ridge; “none” if no boundary step is within 200 km.`,
    `Assignment: each event gets the class of the nearest PB2002 step within 200 km. Bird & Kagan (2004) used a more careful assignment; intraslab events in subduction zones can be mislabelled. The class b values pool all events of a class (direct Mw, per-event thresholds) and use the same bootstrap as the cells.`,
    `Interpretation: b ≈ 1.5 β where β is the seismic-moment exponent; Bird & Kagan found β near-universal for most classes and higher at ridges. Schorlemmer et al. (2005) show b highest for normal faulting, intermediate for strike-slip and lowest for thrust faulting.`,
    `On the site: the plate-boundary overlay on the map and the class in each cell panel; class b-values on the Validation page.`,
  ],
};
