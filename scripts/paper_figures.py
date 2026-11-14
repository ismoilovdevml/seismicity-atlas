"""Key atlas figures for a journal submission (Seismica), at 300 dpi, with Crameri Scientific colour maps.

Reads only the published data in site/data/ (no pipeline run needed) and writes PNGs to docs/img/paper/:

    .venv/bin/python -I scripts/paper_figures.py [--only name]

Colour maps (doi:10.5281/zenodo.8409685, MIT licence, see scripts/crameri.py): b-values use the diverging vik map centred
on b = 1 (the website's light-theme classes are steps of the same map); line colours are picked from vik and batlow.
Text is in ink colours, never in a data colour. Every b-value and every ratio is drawn with its 95 % interval.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import shape

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crameri  # noqa: E402
import figures as F  # noqa: E402  (map helpers; also sets the matplotlib style)
from common import GRID, INK, INK2, MUTED, SITE  # noqa: E402

plt = F.plt
from matplotlib.collections import PolyCollection  # noqa: E402
from matplotlib.colors import Normalize  # noqa: E402
from matplotlib.patches import Patch  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "docs" / "img" / "paper"
DPI = 300
VIK = crameri.cmap("vik")
C_LOW, C_HIGH = crameri.sample("vik", [0.18, 0.82])   # two series colours from vik (ours vs published, north vs south)
C_SEQ = crameri.sample("batlow", [0.2, 0.55, 0.8])    # categorical-ish picks from batlow for line pairs
NOTE = "Not a forecast and not a hazard map."


def load(rel):
    return json.loads((SITE / rel).read_text())


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{name}.png"
    fig.savefig(p, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"wrote {p.relative_to(OUT.parents[2])} ({p.stat().st_size / 1e3:.0f} kB)")


# ----------------------------------------------------------------------------------------------- 1, 2: b maps
def b_map(d):
    man = load("manifest.json")
    feats = load("cells.geojson")["features"]
    lab = "shallow, depth ≤ 70 km" if d == "sh" else "intermediate and deep, depth > 70 km"
    period = re.sub(r"(\d{4})-(\d{4})", "\\1–\\2", man["method"]["b_catalogue"])
    fig, ax = F.map_axes(f"Gutenberg-Richter b-value, {lab}",
                         f"{period}, direct Mw only, {man['method']['sample_radius_km']:.0f} km circles on H3 "
                         f"resolution-2 cells. Coloured: 95 % interval ≤ 0.5 (B fainter). Hatched: b withheld. Grey: too few events.")
    norm = Normalize(0.6, 1.4)
    shown = {"A": ([], []), "B": ([], [])}
    hatch, grey = [], []
    for ft in feats:
        p = ft["properties"]
        q = p.get(f"{d}_q")
        if q is None:
            continue
        polys = F.polys(shape(ft["geometry"]))
        if q in ("A", "B"):
            shown[q][0].extend(polys)
            shown[q][1].extend([VIK(norm(p[f"{d}_b"]))] * len(polys))
        elif q == "C":
            hatch.extend(polys)
        else:
            grey.extend(polys)
    ax.add_collection(PolyCollection(grey, facecolors="#dddcd6", edgecolors="none", zorder=2))
    pc = PolyCollection(hatch, facecolors="#f4f3ef", edgecolors=MUTED, linewidths=0.0, zorder=2.4)
    pc.set_hatch("//////")
    ax.add_collection(pc)
    ax.add_collection(PolyCollection(shown["A"][0], facecolors=shown["A"][1], edgecolors="none", zorder=2.6))
    ax.add_collection(PolyCollection(shown["B"][0], facecolors=shown["B"][1], edgecolors="none", alpha=0.55, zorder=2.5))
    F.add_plates(ax)
    cb = fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=VIK), ax=ax, orientation="horizontal", fraction=0.04, pad=0.08,
                      aspect=45, ticks=[0.6, 0.8, 1.0, 1.2, 1.4])
    cb.set_label("b (Crameri vik, centred on b = 1)", color=INK2)
    cb.outline.set_visible(False)
    counts = {q: sum(1 for ft in feats if ft["properties"].get(f"{d}_q") == q) for q in ("A", "B", "C", "insufficient")}
    F.footer(ax, f"Cells: quality A {counts['A']}, B {counts['B']}, C {counts['C']}, insufficient {counts['insufficient']}. {NOTE} "
                 f"Plates: Bird (2003). Equal Earth, centred 150° E. Cut-off {man['data_cutoff_utc']}.")
    save(fig, f"b_map_{'shallow' if d == 'sh' else 'deep'}")


# ----------------------------------------------------------------------------------------------- 3: validation
NUM = r"(\d+(?:\.\d+)?)"


def validation():
    """Every b row of the validation table with an atlas interval and a published number (or range), quality A/B only."""
    rows = []
    for r in load("global.json")["validation_table"]:
        ours, pub, test = str(r["ours"]), str(r["published"]), r["test"]
        m = re.match(rf"^(?:TGR )?{NUM} \[{NUM}, {NUM}\]", ours)
        if not m or "q=C" in ours or "q=insuff" in ours or not re.search(r"\bb\b", test):
            continue
        pb = re.search(rf"\(b {NUM}", pub) or re.match(rf"^{NUM}(?:-{NUM})?(?:\s|$)", pub)
        if not pb:
            continue
        lo_p = float(pb.group(1))
        hi_p = float(pb.group(2)) if pb.re.groups > 1 and pb.group(2) else lo_p
        label = re.sub(r"^Literature b: ", "", test).split(" (")[0].replace("_", " ")
        rows.append((label, *map(float, m.groups()), lo_p, hi_p, r["verdict"]))
    fig, ax = plt.subplots(figsize=(7.2, 0.42 * len(rows) + 1.2))
    for i, (test, b, lo, hi, plo, phi, verdict) in enumerate(rows):
        y = len(rows) - 1 - i
        if phi > plo:
            ax.add_patch(plt.Rectangle((plo, y - 0.22), phi - plo, 0.44, color=C_HIGH, alpha=0.25, lw=0))
        else:
            ax.plot([plo], [y], marker="D", ms=5.5, color=C_HIGH, zorder=3)
        ax.plot([lo, hi], [y, y], color=C_LOW, lw=2.2, solid_capstyle="round")
        ax.plot([b], [y], "o", ms=6, color=C_LOW, mec="white", mew=1.2, zorder=4)
        label = re.sub(r"\s+", " ", test)
        ax.text(-0.01, y, label[:58] + ("…" if len(label) > 58 else ""), transform=ax.get_yaxis_transform(), ha="right", va="center", fontsize=7.5, color=INK)
    ax.axvline(1.0, color=GRID, lw=1, zorder=0)
    ax.set_yticks([])
    ax.set_ylim(-0.7, len(rows) - 0.3)
    ax.set_xlabel("b")
    ax.set_title("Atlas b-values against published values", loc="left")
    ax.legend(handles=[plt.Line2D([], [], color=C_LOW, marker="o", lw=2.2, label="atlas, 95 % interval"),
                       plt.Line2D([], [], color=C_HIGH, marker="D", lw=0, label="published value"),
                       Patch(color=C_HIGH, alpha=0.25, label="published range")], loc="lower right", fontsize=7.5)
    save(fig, "validation_b")


# ----------------------------------------------------------------------------------------------- 4: plate boundaries
PB = {"SUB": "subduction", "CCB": "continental convergent", "OCB": "oceanic convergent", "CTF": "continental transform",
      "OTF": "oceanic transform", "CRB": "continental rift", "OSR": "oceanic spreading ridge", "none": "away from boundaries"}


def plate_b():
    pb = load("global.json")["plate_boundary_types"]
    items = [(k, v) for k, v in pb.items() if v.get("b") is not None]
    items.sort(key=lambda kv: kv[1]["b"])
    fig, ax = plt.subplots(figsize=(6.4, 3.2))
    for y, (k, v) in enumerate(items):
        lo, hi = v["ci95"]
        c = C_LOW  # one colour: the value is read from the position (vik near b = 1 is almost white)
        ax.plot([lo, hi], [y, y], color=c, lw=2.4, solid_capstyle="round")
        ax.plot([v["b"]], [y], "o", ms=6.5, color=c, mec="white", mew=1.2)
        ax.text(hi + 0.015, y, f"{v['b']:.3f} [{lo:.3f}, {hi:.3f}]  n = {v['n_b']:,}", va="center", fontsize=7, color=INK2)
    ax.set_yticks(range(len(items)), [PB.get(k, k) for k, _ in items], fontsize=8)
    ax.axvline(1.0, color=GRID, lw=1, zorder=0)
    ax.set_xlim(0.75, 1.85)
    ax.set_xlabel("b, 95 % bootstrap interval")
    ax.set_title("b by plate-boundary class (PB2002), shallow, ISC-GEM direct Mw", loc="left")
    save(fig, "plate_boundary_b")


# ----------------------------------------------------------------------------------------------- 5: Mc over time
def mc_time():
    per = load("global.json")["michael_periods"]
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 2.9), sharey=True)
    for ax, depth, title in ((axes[0], "<60 km", "depth < 60 km"), (axes[1], ">=60 km", "depth ≥ 60 km")):
        ps = [p for p in per if p["depth"] == depth]
        x = np.arange(len(ps))
        mc = [p["maxc02"][0] for p in ps]
        err = np.array([[p["maxc02"][0] - p["maxc02"][1], p["maxc02"][2] - p["maxc02"][0]] for p in ps]).T
        ax.errorbar(x - 0.08, mc, yerr=err, fmt="o", color=C_LOW, ms=5, lw=1.6, capsize=0, label="atlas MAXC + 0.2, 95 %")
        ax.plot(x + 0.08, [p["michael_mc"] for p in ps], "D", color=C_HIGH, ms=5, label="Michael (2014)")
        ax.set_xticks(x, [p["period"].replace("-", "–") for p in ps], rotation=35, ha="right", fontsize=7.5)
        ax.set_title(title, loc="left")
    axes[0].set_ylabel("Mc (Mw)")
    axes[0].legend(fontsize=7.5, loc="upper right")
    fig.suptitle("ISC-GEM completeness over time", x=0.02, y=1.06, ha="left", fontsize=10.5, fontweight="bold", color=INK)
    save(fig, "mc_time")


# ----------------------------------------------------------------------------------------------- 6: FMD example
def fmd_example():
    cells = [ft["properties"] for ft in load("cells.geojson")["features"]]
    tk = [p for p in cells if p.get("sh_q") == "A" and p.get("detail") and -38 <= p["lat"] <= -14 and (p["lon"] >= 172 or p["lon"] <= -170)]
    p = sorted(tk, key=lambda c: -(c.get("sh_nb") or 0))[0]
    d = load(f"cells/{p['id']}.json")["sh"]
    m = np.array([x[0] for x in d["fmd_iscgem"]])
    n = np.array([x[1] for x in d["fmd_iscgem"]])
    cum = n[::-1].cumsum()[::-1]
    mc, b = p["sh_mc"], p["sh_b"]
    fig, ax = plt.subplots(figsize=(5.0, 3.4))
    ax.bar(m, n, width=0.08, color=C_SEQ[1], alpha=0.55, label="per 0.1 bin")
    ax.plot(m, cum, "o", ms=3.8, color=C_LOW, label="cumulative")
    above = m >= mc - 1e-9
    a = np.log10(cum[above][0]) + b * mc
    xs = np.linspace(mc, m.max(), 20)
    ax.plot(xs, 10 ** (a - b * xs), color=C_HIGH, lw=1.8, label=f"b = {b:.2f} [{p['sh_b_lo']:.2f}, {p['sh_b_hi']:.2f}]")
    ax.axvline(mc, color=MUTED, ls="--", lw=1)
    ax.text(mc + 0.03, cum.max(), f"Mc {mc:.1f}", color=INK2, fontsize=8, va="top")
    ax.set_yscale("log")
    ax.set_xlabel("Mw (ISC-GEM direct)")
    ax.set_ylabel("number of events")
    ax.set_title(f"Frequency-magnitude distribution, cell at {abs(p['lat']):.1f}° S, {p['lon'] % 360:.1f}° E", loc="left", fontsize=9.5)
    ax.legend(fontsize=7.5)
    save(fig, "fmd_example")


# ----------------------------------------------------------------------------------------------- 7: Groningen
def groningen():
    r = load("induced/groningen/rates.json")
    mon = r["monthly"]
    x = np.array([int(s[:4]) + (int(s[5:7]) - 0.5) / 12 for s in mon["month"]])
    prod = np.array([np.nan if v is None else v for v in mon["prod_bcm"]])
    n = np.array(mon["n_ge15"], float)
    roll = np.convolve(n, np.ones(12), "valid")
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.2, 4.6), sharex=True, gridspec_kw={"height_ratios": [1, 1.1]})
    a1.plot(x, prod, color=C_SEQ[0], lw=1.3)
    a1.set_ylabel("gas, 10⁹ m³ / month")
    a1.set_title("Groningen gas field: production and earthquakes ML ≥ 1.5", loc="left")
    a1.text(0.0, -0.02, "Production: Source: NLOG.NL", transform=a1.transAxes, fontsize=7, color=MUTED, va="top")
    a2.plot(x[11:], roll, color=C_HIGH, lw=1.5, label="events in the previous 12 months")
    for ph in r["phases"]:
        x0 = int(ph["start"][:4]) + (int(ph["start"][5:7]) - 1) / 12
        x1 = int(ph["end"][:4]) + (int(ph["end"][5:7]) - 1) / 12
        a2.fill_between([x0, x1], ph["rate_lo"], ph["rate_hi"], color=C_LOW, alpha=0.18, lw=0)
        a2.plot([x0, x1], [ph["rate_per_yr"]] * 2, color=C_LOW, lw=1.8)
    a2.plot([], [], color=C_LOW, lw=1.8, label="phase rate per year, Poisson 95 %")
    for ms in r["milestones"]:
        xm = int(ms["date"][:4]) + (int(ms["date"][5:7]) - 0.5) / 12
        for a in (a1, a2):
            a.axvline(xm, color=MUTED, lw=0.8, ls="--" if ms["kind"] == "policy" else "-", zorder=0)
    a2.set_ylabel("earthquakes")
    a2.legend(fontsize=7.5, loc="upper left")
    a2.set_xlim(1991, 2027)
    a2.text(0.0, -0.16, f"{NOTE} Earthquakes: KNMI, Netherlands Seismic and Acoustic Network, doi:10.21944/e970fd34-23b9-3411-b366-e4f72877d2c5. "
            "Dashed: policy milestones; solid: ML ≥ 3.4.", transform=a2.transAxes, fontsize=6.5, color=MUTED, va="top", wrap=True)
    save(fig, "groningen_rate")


# ----------------------------------------------------------------------------------------------- 8: deficit
def deficit():
    idx = load("deficit/index.json")
    regs = idx["regions"]
    names = {"tienshan": "Tien Shan (69–92° E)", "ts_west": "West (69–76° E)", "ts_central": "Central (76–82° E)", "ts_east": "East (82–92° E)"}
    fig, ax = plt.subplots(figsize=(6.6, 3.0))
    for i, p in enumerate(regs):
        y = len(regs) - 1 - i
        few = p["q"] != "ok"
        for dy, key, col, mk in ((0.14, "r_obs", C_LOW, "o"), (-0.14, "r_tgr", C_HIGH, "s")):
            ax.plot([p[f"{key}_lo"], p[f"{key}_hi"]], [y + dy] * 2, color=col, lw=2.2, alpha=0.45 if few else 1)
            ax.plot([p[key]], [y + dy], mk, ms=6, color="white" if few else col, mec=col, mew=1.4)
        ax.text(32, y, f"p_full {p['p_full']:.2f}" + ("  (few events)" if few else ""), va="center", fontsize=7.5, color=INK2)
    ax.set_yticks(range(len(regs)), [names.get(p["id"], p["id"]) for p in regs][::-1], fontsize=8)
    ax.set_xscale("log")
    ax.set_xlim(0.1, 30)
    ax.set_ylim(-1.3, len(regs) - 0.5)
    ax.axvline(1.0, color=MUTED, lw=1)
    ax.set_xticks([0.1, 0.3, 1, 3, 10, 30], ["0.1", "0.3", "1", "3", "10", "30"])
    ax.set_xlabel("seismic / geodetic moment rate (full coupling)")
    ax.set_title("Seismic moment budget, Tien Shan: no detectable deficit beyond catalogue noise", loc="left", fontsize=9.5)
    ax.legend(handles=[plt.Line2D([], [], color=C_LOW, marker="o", lw=2.2, label="observed, 95 %"),
                       plt.Line2D([], [], color=C_HIGH, marker="s", lw=2.2, label="tapered G-R long-term, 95 %")],
              loc="lower right", fontsize=7.5, ncol=2)
    ax.text(0.0, -0.22, f"{NOTE} Strain rates: Ou et al. (2026), Chang (2025), CC BY 4.0. Hollow: fewer than 5 events Mw ≥ 6 since 1964.",
            transform=ax.transAxes, fontsize=6.5, color=MUTED, va="top")
    save(fig, "deficit_ratios")


FIGS = {"b_map_shallow": lambda: b_map("sh"), "b_map_deep": lambda: b_map("dp"), "validation_b": validation, "plate_boundary_b": plate_b,
        "mc_time": mc_time, "fmd_example": fmd_example, "groningen_rate": groningen, "deficit_ratios": deficit}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(FIGS))
    a = ap.parse_args()
    for name, fn in FIGS.items():
        if not a.only or a.only == name:
            fn()


if __name__ == "__main__":
    main()
