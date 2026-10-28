"""One-time conversion of the trusted, local FireCast research artifacts.

Deployment needs only the generated public/data files, not Python or the old repo.
"""
import json
import math
import gzip
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import rasterio
from rasterio.enums import Resampling
from shapely.geometry import shape, mapping

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "FireCast"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data"
FEATURES = ["slope_mean", "slope_median", "slope_circular", "aspect_mean",
            "aspect_median", "aspect_circular", "hillshade_mean", "hillshade_median",
            "delta_area", "delta_perimeter", "delta_cx", "delta_cy", "centroid_shift_m",
            "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
            "precipitation_sum", "rain_sum", "snowfall_sum", "wind_speed_10m_max",
            "wind_gusts_10m_max", "wind_direction_10m_dominant",
            "shortwave_radiation_sum", "et0_fao_evapotranspiration"]


def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, np.ndarray):
        return clean(value.tolist())
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return float(value) if math.isfinite(value) else None
    return value


def save(path, value, compress=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(clean(value), separators=(",", ":"), allow_nan=False).encode("utf-8")
    if compress:
        path.with_suffix(".json.gz").write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))
    else:
        path.write_bytes(payload)


def coordinates(value):
    if isinstance(value, (list, tuple)):
        return [coordinates(v) for v in value]
    return round(value, 5)


def raster(folder, fire_id):
    path = folder / f"fire_{fire_id}_dem.tif"
    if not path.exists():
        return None
    with rasterio.open(path) as src:
        dem = src.read(1, out_shape=(48, 48), resampling=Resampling.bilinear).astype(float)
        dem[dem == src.nodata] = np.nan
        bounds = list(src.bounds)
    result = {"dem": np.round(dem, 1), "bounds": bounds}
    for name, suffix in [("hillshade", "hillshade"), ("slope", "slope_deg"), ("aspect", "aspect_deg")]:
        p = folder / f"fire_{fire_id}_{suffix}.npy"
        if p.exists():
            a = np.load(p)
            # Preserve georeferenced row order; sample pixel centres, not only an edge.
            ys = np.linspace(0, a.shape[0] - 1, 48).astype(int)
            xs = np.linspace(0, a.shape[1] - 1, 48).astype(int)
            result[name] = np.round(a[np.ix_(ys, xs)], 2)
    return result


def main():
    model = joblib.load(SOURCE / "model" / "gaussian_hmm_model.pkl")
    scaler = joblib.load(SOURCE / "model" / "scaler.pkl")
    save(OUTPUT / "model.json", {
        "features": FEATURES, "start": model.startprob_, "transition": model.transmat_,
        "means": model.means_, "variances": np.diagonal(model.covars_, axis1=1, axis2=2),
        "scalerMean": scaler.mean_, "scalerScale": scaler.scale_,
        "physicalMeans": scaler.inverse_transform(model.means_),
        "covarianceType": model.covariance_type,
        "source": "FireCast/model/gaussian_hmm_model.pkl",
    })
    catalog, fixtures = [], []
    for year in [2018, 2019]:
        folder = SOURCE / "data" / str(year)
        table = pd.read_csv(folder / f"fire_hmm_ready_{year}.csv")
        for fire_id, records in table.groupby("fire_id", sort=True):
            fire_id = int(fire_id)
            path = folder / f"fire_{fire_id}.json"
            if not path.exists():
                continue
            records = records.sort_values("jd")
            rows = records.to_dict(orient="records")
            geo = json.loads(path.read_text())
            features = []
            for f in geo["features"]:
                geometry = shape(f["geometry"])
                if geometry.is_empty:
                    continue
                simplified = geometry.simplify(0.0001, preserve_topology=True)
                geo_mapping = dict(mapping(simplified))
                geo_mapping["coordinates"] = coordinates(geo_mapping["coordinates"])
                features.append({"type": "Feature", "geometry": geo_mapping,
                                 "properties": {k: v for k, v in f["properties"].items()
                                                if k in ["JD", "Map_Date", "UID_Fire"]}})
            first = rows[0]
            name = str(first.get("REF_ID") or f"Fire {fire_id}")
            item = {"id": f"{year}-{fire_id}", "fireId": fire_id, "year": year, "name": name,
                    "start": first["Map_Date"], "end": rows[-1]["Map_Date"], "days": len(rows),
                    "lat": first["geom_lat"], "lon": first["geom_lon"],
                    "maxArea": float(records["area_m2"].max())}
            catalog.append(item)
            save(OUTPUT / "fires" / f"{year}-{fire_id}.json", {
                **item, "rows": rows, "geojson": {"type": "FeatureCollection", "features": features},
                "terrain": raster(folder, fire_id),
            }, compress=True)
            # Expected Python inference for independent browser implementation tests.
            values = records[FEATURES].to_numpy(dtype=float)
            if np.isfinite(values).all():
                x = scaler.transform(values)
                score, states = model.decode(x, algorithm="viterbi")
                posterior = model.predict_proba(x)
                fixtures.append({"id": item["id"], "values": values, "states": states,
                                 "logProbability": score, "posterior": posterior})
            if len(catalog) % 100 == 0:
                print(f"Exported {len(catalog)} fires", flush=True)
    save(OUTPUT / "catalog.json", catalog)
    save(OUTPUT.parent.parent / "tests" / "fixtures" / "python-inference.json", fixtures[:3] + fixtures[-3:])
    save(OUTPUT.parent.parent / "tests" / "fixtures" / "all-fires-python.json", [
        {"id": f["id"], "states": f["states"], "logProbability": f["logProbability"],
         "lastPosterior": f["posterior"][-1]} for f in fixtures
    ])
    print(f"Exported {len(catalog)} fires, {sum(x['days'] for x in catalog)} observations.")


if __name__ == "__main__":
    main()
