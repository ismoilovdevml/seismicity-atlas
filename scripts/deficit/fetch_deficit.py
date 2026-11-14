"""Download the two Tien Shan strain-rate models (Zenodo, CC BY 4.0) and normalise them to one grid file each.

Usage:  python -I scripts/deficit/fetch_deficit.py [--refresh]

Raw files go to data/raw/deficit/<source>/ (cached, md5-checked against the Zenodo record). Downloads are untrusted
data: the text tables are parsed as numbers only and the NetCDF-4 grids are converted to classic NetCDF by GDAL
(`gdal_translate`, a host tool; the Python stack here has no HDF5 reader) and read with scipy.

Output: data/work/deficit/strain_<model>.npz with lon, lat (1-D, degrees), exx, eyy, exy (2-D, 1/yr, NaN = no data),
plus sig_exx/sig_eyy/sig_exy for the Chang (2025) models. All models are put on the 0.05 degree grid of
Ou et al. (2026) (63-93 E, 37-50 N, cell centres); a Chang (2025) value is used at a node when its observation
point is within CHANG_MAX_KM (nearest neighbour, as the points are centroids of an irregular triangular mesh).
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import requests
from scipy.io import netcdf_file
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "deficit"
WORK = ROOT / "data" / "work" / "deficit"
UA = {"User-Agent": "seismicity-atlas-fetch/0.3"}
CHANG_MAX_KM = 40.0

SOURCES = {
    "ou2026": {"record": "20293601",
               "files": ["dvedx.nc", "dvedy.nc", "dvndx.nc", "dvndy.nc", "dxy.nc", "sec_inv.nc"]},
    "chang2025": {"record": "16547905",
                  "files": ["2.1_Strain_rate_tensors_BforStrain.dat", "2.2_Strain_rate_tensors_gpsgridder.dat",
                            "2.3_strain_rate_tensors_loc_avg_grad.dat", "2.4_Strain_rate_tensors_VISR.dat"]},
}
CHANG_MODELS = {"chang_bforstrain": "2.1_Strain_rate_tensors_BforStrain.dat",
                "chang_gpsgridder": "2.2_Strain_rate_tensors_gpsgridder.dat",
                "chang_locavggrad": "2.3_strain_rate_tensors_loc_avg_grad.dat",
                "chang_visr": "2.4_Strain_rate_tensors_VISR.dat"}


def _md5(p: Path) -> str:
    h = hashlib.md5()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(refresh=False):
    for src, spec in SOURCES.items():
        d = RAW / src
        d.mkdir(parents=True, exist_ok=True)
        rec_path = d / "zenodo_record.json"
        if refresh or not rec_path.exists():
            r = requests.get(f"https://zenodo.org/api/records/{spec['record']}", headers=UA, timeout=60)
            r.raise_for_status()
            rec_path.write_text(r.text)
        rec = json.loads(rec_path.read_text())
        lic = rec["metadata"].get("license", {}).get("id")
        if lic != "cc-by-4.0":
            raise SystemExit(f"{src}: licence changed to {lic!r}, review before use")
        files = {f["key"]: f for f in rec["files"]}
        for name in spec["files"]:
            p, meta = d / name, files[name]
            want = meta["checksum"].split(":", 1)[1]
            if p.exists() and not refresh and _md5(p) == want:
                continue
            r = requests.get(meta["links"]["self"], headers=UA, timeout=300)
            r.raise_for_status()
            p.write_bytes(r.content)
            if _md5(p) != want:
                raise SystemExit(f"{src}/{name}: md5 mismatch")
            print("downloaded", src, name, len(r.content))


def _read_gmt_nc(path: Path):
    gdal = shutil.which("gdal_translate")
    if not gdal:
        raise SystemExit("gdal_translate not found (needed to read the NetCDF-4 grids of Ou et al. 2026)")
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "g.nc"
        subprocess.run([gdal, "-q", "-of", "netCDF", "-co", "FORMAT=NC", str(path), str(out)], check=True)
        with netcdf_file(out, "r", mmap=False) as f:
            lon = np.array(f.variables["lon"][:], float)
            lat = np.array(f.variables["lat"][:], float)
            z = np.array(f.variables["z"][:], float)
    if lat[0] > lat[-1]:
        lat, z = lat[::-1], z[::-1]
    return lon, lat, z


def build_grids():
    WORK.mkdir(parents=True, exist_ok=True)
    d = RAW / "ou2026"
    # GMT grdmath "DDX 1000000 MUL" on mm/yr velocities with -M (metres): 1 unit = 1e-6 (mm/yr)/m = 1e-9 /yr
    lon, lat, dvedx = _read_gmt_nc(d / "dvedx.nc")
    _, _, dvndy = _read_gmt_nc(d / "dvndy.nc")
    _, _, dxy = _read_gmt_nc(d / "dxy.nc")
    _, _, sec = _read_gmt_nc(d / "sec_inv.nc")
    # consistency with the published second invariant (grdmath dxy^2*2 + dvndy^2 + dvedx^2, sqrt)
    chk = np.sqrt(2 * dxy ** 2 + dvndy ** 2 + dvedx ** 2)
    ok = np.isfinite(chk) & np.isfinite(sec)
    maxdiff = float(np.nanmax(np.abs(chk[ok] - sec[ok])))
    np.savez_compressed(WORK / "strain_ou2026.npz", lon=lon, lat=lat, exx=dvedx * 1e-9, eyy=dvndy * 1e-9,
                        exy=dxy * 1e-9, sec_inv_check_maxdiff_nstr=maxdiff)
    print(f"ou2026 grid {lat.size} x {lon.size}, finite {np.isfinite(dvedx).mean():.3f}, sec_inv max |diff| {maxdiff:.2e} nstr/yr")

    LA, LO = np.meshgrid(lat, lon, indexing="ij")
    k = 111.195  # km per degree
    for name, fn in CHANG_MODELS.items():
        t = np.loadtxt(RAW / "chang2025" / fn, skiprows=1)   # lon lat Exx Exy Eyy Sig_Exx Sig_Exy Sig_Eyy, microstrain/yr
        lat0 = np.radians(t[:, 1].mean())
        tree = cKDTree(np.c_[t[:, 0] * k * np.cos(lat0), t[:, 1] * k])
        dist, idx = tree.query(np.c_[LO.ravel() * k * np.cos(lat0), LA.ravel() * k])
        good = (dist <= CHANG_MAX_KM).reshape(LA.shape)
        idx = idx.reshape(LA.shape)

        def grid(col):
            g = t[idx, col] * 1e-6
            g[~good] = np.nan
            return g
        np.savez_compressed(WORK / f"strain_{name}.npz", lon=lon, lat=lat, exx=grid(2), exy=grid(3), eyy=grid(4),
                            sig_exx=grid(5), sig_exy=grid(6), sig_eyy=grid(7), npoints=t.shape[0],
                            pts_lon=t[:, 0], pts_lat=t[:, 1], pts_exx=t[:, 2] * 1e-6, pts_exy=t[:, 3] * 1e-6,
                            pts_eyy=t[:, 4] * 1e-6)
        print(f"{name}: {t.shape[0]} points, grid coverage {good.mean():.3f}")


if __name__ == "__main__":
    fetch(refresh="--refresh" in sys.argv)
    build_grids()
