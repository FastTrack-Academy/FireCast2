"use client";

import { useEffect, useRef, useState } from "react";
import { Mountain, RotateCcw } from "lucide-react";
import type { FireData, Grid } from "@/lib/types";
import { number } from "@/lib/format";

const MODES = ["3D surface", "Hillshade", "Slope", "Aspect", "Elevation"] as const;
type Mode = typeof MODES[number];

function color(value: number, min: number, max: number, mode: Mode): string {
  const t = Math.max(0, Math.min(1, (value-min) / (max-min || 1)));
  if (mode === "Hillshade") return `rgb(${55+t*185},${60+t*180},${61+t*179})`;
  if (mode === "Aspect") return `hsl(${value}, 58%, 57%)`;
  if (mode === "Slope") return `hsl(${200-t*190}, ${50+t*30}%, ${73-t*25}%)`;
  return `hsl(${155-t*112}, ${20+t*30}%, ${28+t*44}%)`;
}

function TerrainCanvas({ grid, mode, angle, exaggeration }: { grid: Grid; mode: Mode; angle: number; exaggeration: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function paint() {
      if (!element) return;
      const ctx = element.getContext("2d");
      if (!ctx) return;
      const { width, height } = element.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = width*ratio; element.height = height*ratio;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#f5f7f6"; ctx.fillRect(0,0,width,height);
      const values = grid.flat().filter((x): x is number => x !== null && Number.isFinite(x));
      if (!values.length) return;
      const min = Math.min(...values), max = Math.max(...values);
      const rows = grid.length, cols = grid[0].length;
      if (mode !== "3D surface") {
        const side = Math.min(width-54, height-45), ox=(width-side)/2, oy=(height-side)/2;
        for (let r=0;r<rows;r++) for(let c=0;c<cols;c++) {
          const v = grid[r][c];
          if(v === null) continue;
          ctx.fillStyle = color(v, min, max, mode);
          ctx.fillRect(ox+c*side/cols,oy+r*side/rows,side/cols+0.6,side/rows+0.6);
        }
        ctx.fillStyle="#6a7474";ctx.font="11px system-ui";ctx.fillText("N ↑",ox,oy-9);
      } else {
        const rotation = angle*Math.PI/180, scale=Math.min(width/2.8,height/1.95);
        const project=(r:number,c:number) => {
          const px=c/(cols-1)-0.5,py=r/(rows-1)-0.5;
          const xx=px*Math.cos(rotation)-py*Math.sin(rotation), yy=px*Math.sin(rotation)+py*Math.cos(rotation);
          const v=grid[r][c] ?? min, z=(v-min)/(max-min || 1)*0.32*exaggeration;
          return {x:width/2+xx*scale*1.65,y:height*0.62+yy*scale*0.75-z*scale,depth:yy,v};
        };
        const quads=[];
        for(let r=0;r<rows-1;r++) for(let c=0;c<cols-1;c++) {
          if([grid[r][c],grid[r+1][c],grid[r+1][c+1],grid[r][c+1]].some(v=>v===null)) continue;
          const points=[project(r,c),project(r+1,c),project(r+1,c+1),project(r,c+1)];
          quads.push({points,depth:points.reduce((s,p)=>s+p.depth,0)/4,value:points.reduce((s,p)=>s+p.v,0)/4});
        }
        quads.sort((a,b)=>a.depth-b.depth).forEach(({points,value})=>{
          ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
          ctx.fillStyle=color(value,min,max,mode);ctx.fill();ctx.strokeStyle="rgba(255,255,255,0.13)";ctx.lineWidth=0.5;ctx.stroke();
        });
        ctx.fillStyle="#6a7474";ctx.font="11px system-ui";ctx.fillText(`Elevation ${number(min)}–${number(max)} m`,22,height-20);
      }
    }
    const observer=new ResizeObserver(paint);observer.observe(element);paint();
    return ()=>observer.disconnect();
  },[grid,mode,angle,exaggeration]);
  return <canvas ref={canvas} className="terrain-canvas" role="img" aria-label={`${mode} visualization of the selected fire's source terrain raster`} />;
}

export default function TerrainView({ fire }: { fire: FireData }) {
  const [mode,setMode]=useState<Mode>("3D surface");
  const [angle,setAngle]=useState(36);
  const [exaggeration,setExaggeration]=useState(1);
  const terrain=fire.terrain;
  const key=mode==="Slope"?"slope":mode==="Aspect"?"aspect":mode==="Hillshade"?"hillshade":"dem";
  const grid=terrain?.[key];
  const values=grid?.flat().filter((x):x is number=>x!==null && Number.isFinite(x)) || [];
  const min=values.length?Math.min(...values):0, max=values.length?Math.max(...values):0;
  return <div className="terrain-layout">
    <section className="panel terrain-panel"><div className="panel-heading"><div><h2>Terrain & elevation</h2><p>The landscape beneath the boundary</p></div><Mountain size={21} className="muted" /></div>
      <div className="tab-list" aria-label="Terrain view">{MODES.map(item=><button key={item} aria-pressed={mode===item} className={mode===item?"active":""} onClick={()=>setMode(item)}>{item}</button>)}</div>
      {grid && values.length ? <TerrainCanvas grid={grid} mode={mode} angle={angle} exaggeration={exaggeration} />:<div className="empty-state"><Mountain size={36}/><h3>Terrain layer unavailable</h3><p>This fire does not have a usable {mode.toLowerCase()} raster in the source dataset.</p></div>}
      {grid && values.length ? <div className="terrain-scale"><span>{number(min,1)}{mode==="Slope"||mode==="Aspect"?"°":mode==="Hillshade"?"":" m"}</span><div style={{background:mode==="Aspect"?"linear-gradient(90deg,#d95151,#d9d951,#51d951,#51d9d9,#5151d9,#d951d9,#d95151)":mode==="Hillshade"?"linear-gradient(90deg,#373c3d,#f0f0f0)":mode==="Slope"?"linear-gradient(90deg,#92c4dc,#a0c663,#e8884b)":"linear-gradient(90deg,#395e50,#7c9c56,#d7bf83)"}}/><span>{number(max,1)}{mode==="Slope"||mode==="Aspect"?"°":mode==="Hillshade"?"":" m"}</span></div>:null}
    </section>
    <aside className="terrain-inspector panel"><div className="panel-heading"><div><h2>Layer details</h2><p>Source raster · {fire.name}</p></div></div>
      <dl className="detail-list"><div><dt>Visualization</dt><dd>{mode}</dd></div><div><dt>Display resolution</dt><dd>48 × 48 cells</dd></div><div><dt>Terrain source</dt><dd>Original DEM / NumPy layers</dd></div><div><dt>Mean slope</dt><dd>{number(Number(fire.rows[0].slope_mean),1)}°</dd></div><div><dt>Mean aspect</dt><dd>{number(Number(fire.rows[0].aspect_mean),1)}°</dd></div></dl>
      {mode==="3D surface"?<div className="terrain-controls"><label>Rotation <strong>{angle}°</strong><input aria-label="Surface rotation" type="range" min="0" max="360" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><label>Vertical exaggeration <strong>{exaggeration.toFixed(1)}×</strong><input aria-label="Vertical exaggeration" type="range" min="0.2" max="3" step="0.1" value={exaggeration} onChange={e=>setExaggeration(Number(e.target.value))}/></label><button className="button" onClick={()=>{setAngle(36);setExaggeration(1);}}><RotateCcw size={14}/>Reset view</button></div>:null}
      <div className="inline-note">{mode==="Aspect"?"Aspect gives the downslope compass bearing: 0° north, 90° east, 180° south, 270° west.":mode==="Hillshade"?"Hillshade shows illumination and terrain relief. It is not a measurement of fire intensity.":"Terrain is sampled from the original files for a lightweight browser view. Elevation is in meters; no future fire geometry is generated."}</div>
    </aside>
  </div>;
}
