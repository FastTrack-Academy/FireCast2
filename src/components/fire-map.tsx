"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import { Expand, Layers, LocateFixed } from "lucide-react";
import type { FireData } from "@/lib/types";
import { date } from "@/lib/format";

export default function FireMap({ fire, day }: { fire: FireData; day: number }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const polygons = useRef<L.GeoJSON | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const extent = useRef<L.LatLngBounds | null>(null);
  const [base, setBase] = useState("satellite");
  const [history, setHistory] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [tileError, setTileError] = useState(false);
  const jd = fire.rows[day].jd;

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { zoomControl: true, scrollWheelZoom: false, preferCanvas: true });
    map.current = instance;
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(instance);
    let frame = 0;
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        instance.invalidateSize();
        if(extent.current?.isValid()) instance.fitBounds(extent.current, {padding:[48,48], maxZoom:12, animate:false});
      });
    });
    resize.observe(host.current);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (tiles.current) tiles.current.remove();
    const layer = base === "satellite"
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community", maxZoom: 18,
      })
      : L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO', maxZoom: 19,
      });
    layer.on("tileerror", () => setTileError(true));
    layer.on("tileload", () => setTileError(false));
    layer.addTo(map.current);
    tiles.current = layer;
  }, [base]);

  useEffect(() => {
    if (!map.current) return;
    const bounds = L.geoJSON(fire.geojson).getBounds();
    extent.current = bounds;
    if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 12, animate: false });
    else map.current.setView([fire.lat, fire.lon], 10);
  }, [fire]);

  useEffect(() => {
    if (!map.current) return;
    polygons.current?.remove();
    const visible = fire.geojson.features.filter(f => {
      const value = Number(f.properties?.JD);
      return history ? value <= jd : value === jd;
    }).sort((a, b) => Number(a.properties?.JD) - Number(b.properties?.JD));
    const min = fire.rows[0].jd;
    const range = Math.max(1, fire.rows.at(-1)!.jd - min);
    const collection: FeatureCollection = { type: "FeatureCollection", features: visible };
    polygons.current = L.geoJSON(collection, {
      style: feature => {
        const p = (Number(feature?.properties?.JD) - min) / range;
        const selected = Number(feature?.properties?.JD) === jd;
        return { color: selected ? "#ff9560" : `hsl(${45 - p * 32}, 96%, 58%)`, weight: selected ? 2 : 1,
          fillColor: `hsl(${43 - p * 32}, 95%, 52%)`, fillOpacity: selected ? 0.22 : 0.055, opacity: selected ? 1 : 0.7 };
      },
      onEachFeature: (feature, layer) => {
        const element = document.createElement("div");
        element.textContent = `Fire ${fire.fireId} · Julian day ${feature.properties?.JD} · ${date(String(feature.properties?.Map_Date || fire.start), true)}`;
        layer.bindTooltip(element, { sticky: true });
      },
    }).addTo(map.current);
  }, [fire, history, jd]);

  function fit() {
    if (!map.current) return;
    if (extent.current?.isValid()) map.current.fitBounds(extent.current, { padding: [48, 48], maxZoom: 12 });
  }

  return <div className={`map-frame ${expanded ? "map-expanded" : ""}`}>
    <div ref={host} className="map-canvas" role="region" aria-label={`Observed wildfire boundaries for ${fire.name}`} />
    <div className="map-caption"><span className="map-dot" />Boundary progression</div>
    <div className="map-tools">
      <button onClick={fit} title="Fit fire extent"><LocateFixed size={15} /><span>Fit extent</span></button>
      <button onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Exit expanded map" : "Expand map"}><Expand size={15} /></button>
    </div>
    <div className="map-layers">
      <button onClick={() => setBase(base === "satellite" ? "dark" : "satellite")}><Layers size={15} />{base === "satellite" ? "Satellite" : "Dark map"}</button>
      <label><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)} />Boundary history</label>
    </div>
    <div className="map-key"><span />Earlier <i />Latest observation</div>
    {tileError ? <div className="map-network-note">Basemap unavailable. Observed boundaries remain interactive.</div> : null}
  </div>;
}
