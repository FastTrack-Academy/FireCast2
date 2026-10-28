# FireCast web

A standalone, frontend-only Next.js redesign of the original Streamlit FireCast research demo. The trained Gaussian HMM, scaler, observations, simplified boundaries and sampled terrain ship with the app. No Python service, API key, database, or server function is required at runtime.

## Start locally

Use Node.js 22 LTS (minimum 20.9).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. To build and check:

```sh
npm test
npm run typecheck
npm run build
```

`npm run build` creates the complete static site in `out/`. Serve that directory over HTTP; opening index.html via file:// cannot load the application data.

## Deploy to Netlify

Two options:

1. **Manual:** build, then drag the **out folder** into Netlify's manual deploy area. A ready-to-upload ZIP is also provided beside this project.
2. **Git:** use this folder as the repository root. If committing the entire parent workspace, set Netlify's **base directory** to `firecast-web`. The included `netlify.toml` sets the build command to `npm run build`, publish directory to `out`, Node to 22, and disables the unnecessary Next.js server adapter.

No environment variables are needed. Do not set the publish directory to `.next`. Upload only `out` for manual hosting, not the old multi-gigabyte Python dataset. Preserve the filenames and bytes of the `.json.gz` archives: the client unpacks them itself. The loader accepts both raw archives and responses already decompressed by the host/browser. HTTP transport compression provided by the host is fine.

Next.js static export: https://nextjs.org/docs/app/guides/static-exports
Netlify documentation: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/

## What's included

- **Overview:** year/fire selection, observation cutoff, real satellite or dark map, boundary history, tooltips, fit/expand/zoom, daily area chart, playback/seek/speed, weather and current state interpretation.
- **Prediction:** the original five-state, 24-feature diagonal Gaussian HMM. JavaScript implements StandardScaler, Viterbi decoding, forward-backward posterior inference, and 3/7/14-transition state projections. Forecasts use the selected prefix only; moving the cutoff clears the previous result.
- **HMM explorer:** complete initial and transition distributions, learned and observed transition graphs, decoded state timeline, emission feature inspection (3–24 features), and all five state interpretations with physical means.
- **Terrain:** original DEM as an adjustable isometric 3D surface and 2D elevation, hillshade, slope, and aspect rasters.
- **Data library:** searchable catalog of 624 fires (400 from 2018, 224 from 2019), 8,054 observations, all model features, CSV exports and template, and local CSV import/inference with result download.
- **Reports:** JSON analysis exports identify the cutoff, model, state definitions, decoded path, probabilities and any forecast.
- Responsive desktop/mobile layout, keyboard controls, reduced motion support, dialogs, loading/error states, and lazy-loaded map and analysis views.

## Scientific scope and original-demo fixes

The HMM forecasts **hidden-state probabilities**, not future geographic boundaries, damage, risk scores, or containment. The map shows observations only. Forecast labels assume one learned transition per day; where observation dates have gaps, this remains a modeling assumption, not a validated calendar-time forecast. No quantitative accuracy or calibration claim is made. This is a research demonstration, not an emergency decision system.

State IDs are zero-based. The original Python `state_names` list swapped S2 and S4 relative to its own interpretation table. This app labels S2 as **Chaotic breakdown** (largest contraction and highest rain/wind means), and S4 as **Extreme growth** (largest positive area change, highest temperature and zero rain mean), in agreement with the learned physical emission means. Descriptions are model interpretations, not proof of a cause or containment.

All inference uses original numeric feature values. Geographic display boundaries are topology-preserving simplifications at 0.0001 degrees, rounded to five decimal places. The 48x48 terrain grids are lightweight previews (DEM bilinear resampling, NumPy layers sampled), with elevation relative to each raster for the 3D projection; they are not full-resolution GIS analysis. Exported CSV contains the original observation features. Each fire loads on demand from a compressed archive; all 624 archives total about 54 MB. Modern browser support for DecompressionStream is required.

Map tiles require an internet connection: Esri World Imagery (Esri/Maxar/Earthstar and contributors) or CARTO/OSM. Attribution is visible on the map. HMM inference and local CSV processing require no external request after the model is loaded. There is no live weather feed or new boundary collection pipeline.

## CSV import

Use **Data library → Get template** for a valid example. Supply one fire sequence with all 24 feature column names, finite numeric values, and chronological rows. Optional Julian days must increase. Files are limited to 10 MB / 5,000 rows. Inputs remain in memory in the browser; they are not uploaded. The import results are separate from the selected historical fire's map and report; use **Download inference result** for imported data.

## Source layout

- `src/components/workspace.tsx`: workspace state, causal observation cutoff, lazy views and report export.
- `src/components/overview.tsx`, `fire-map.tsx`, `charts.tsx`: map, playback, outlook and charts.
- `src/components/model-explorer.tsx`, `terrain-view.tsx`, `data-library.tsx`: analytical views.
- `src/lib/hmm.ts`: browser model implementation and state descriptions.
- `public/data/model.json`, `catalog.json`, `fires/*.json.gz`: deployable source artifacts.
- `scripts/export_data.py`: repeatable one-time conversion from the neighboring original `FireCast/` folder. Only run this after updating the original trusted model/data. It requires NumPy, pandas, joblib, hmmlearn, rasterio and shapely. Exported artifacts are committed; Netlify does not run Python.
- `tests/`: independent Python-reference parity and probability/validation tests.
- `design/`: design concepts and implementation notes. Generated concepts contain illustrative values; the application always renders real model/data values.

The original project folders have been left intact.
