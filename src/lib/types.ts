import type { FeatureCollection } from "geojson";

export interface FireSummary {
  id: string;
  fireId: number;
  year: number;
  name: string;
  start: string;
  end: string;
  days: number;
  lat: number;
  lon: number;
  maxArea: number;
}

export interface Observation {
  [key: string]: number | string | null;
  jd: number;
  Map_Date: string;
  area_m2: number;
  perimeter_m: number;
  delta_area: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  wind_speed_10m_max: number;
  precipitation_sum: number;
  wind_direction_10m_dominant: number;
}

export type Grid = (number | null)[][];
export interface Terrain {
  dem: Grid;
  hillshade?: Grid;
  slope?: Grid;
  aspect?: Grid;
  bounds: number[];
}

export interface FireData extends FireSummary {
  rows: Observation[];
  geojson: FeatureCollection;
  terrain: Terrain | null;
}

export interface HMMModel {
  features: string[];
  start: number[];
  transition: number[][];
  means: number[][];
  variances: number[][];
  scalerMean: number[];
  scalerScale: number[];
  physicalMeans: number[][];
  covarianceType: string;
  source: string;
}

export type View = "overview" | "hmm" | "terrain" | "data";
