"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, ChevronRight, Database, Download, Flame, LayoutGrid, Mountain, Play, Settings2, X, Info } from "lucide-react";
import type { FireData, FireSummary, HMMModel, View } from "@/lib/types";
import { infer, observationValues, forecast, STATES } from "@/lib/hmm";
import { loadFire } from "@/lib/data";
import { date, download, number } from "@/lib/format";
import Overview from "./overview";

const ModelExplorer=dynamic(()=>import("./model-explorer"),{loading:()=> <Loading label="Opening model explorer…"/>});
const TerrainView=dynamic(()=>import("./terrain-view"),{loading:()=> <Loading label="Preparing terrain layers…"/>});
const DataLibrary=dynamic(()=>import("./data-library"),{loading:()=> <Loading label="Opening research library…"/>});

const NAV=[{id:"overview" as View,label:"Overview",icon:LayoutGrid},{id:"hmm" as View,label:"HMM explorer",icon:Activity},{id:"terrain" as View,label:"Terrain analysis",icon:Mountain},{id:"data" as View,label:"Data library",icon:Database}];
const TITLES={overview:["Wildfire overview","Explore the past. Understand what comes next."],hmm:["Inside the model","Five hidden states. One connected system."],terrain:["Read the landscape","Explore the terrain that shapes wildfire spread."],data:["The evidence behind the model","Explore the original data, or bring your own observations."]};

function Loading({label}:{label:string}) {return <div className="loading-state" role="status"><div className="loading-ring"/><p>{label}</p></div>;}

export default function Workspace() {
  const [catalog,setCatalog]=useState<FireSummary[]>([]);
  const [model,setModel]=useState<HMMModel|null>(null);
  const [selected,setSelected]=useState("2018-1435");
  const [fire,setFire]=useState<FireData|null>(null);
  const [view,setView]=useState<View>("overview");
  const [day,setDay]=useState(0);
  const [horizon,setHorizon]=useState(7);
  const [hasForecast,setHasForecast]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(1);
  const [error,setError]=useState("");
  const [bootstrapError,setBootstrapError]=useState("");
  const [retry,setRetry]=useState(0);
  const [notice,setNotice]=useState("");
  const about=useRef<HTMLDialogElement>(null);
  const cache=useRef(new Map<string,FireData>());
  const year=Number(selected.split("-")[0]);

  useEffect(()=>{
    const controller=new AbortController();
    async function bootstrap() {
      try {
        const [catalogResponse,modelResponse]=await Promise.all([fetch("/data/catalog.json",{signal:controller.signal}),fetch("/data/model.json",{signal:controller.signal})]);
        if(!catalogResponse.ok||!modelResponse.ok)throw new Error("Could not load the research catalog or model.");
        const [fires,parameters]=await Promise.all([catalogResponse.json(),modelResponse.json()]);
        setCatalog(fires);setModel(parameters);
      } catch(e) {if(!controller.signal.aborted)setBootstrapError(e instanceof Error?e.message:"Could not initialize workspace.");}
    }
    void bootstrap();return()=>controller.abort();
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    setFire(null);setError("");setPlaying(false);setHasForecast(false);
    const cached=cache.current.get(selected);
    if(cached){setFire(cached);setDay(cached.rows.length-1);return;}
    loadFire(selected,controller.signal).then(data=>{
      if(controller.signal.aborted)return;
      if(cache.current.size>=3)cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(selected,data);setDay(data.rows.length-1);setFire(data);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Could not load fire data.");});
    return()=>controller.abort();
  },[selected,retry]);

  useEffect(()=>{
    if(!playing||!fire)return;
    const timer=setInterval(()=>{
      setHasForecast(false);
      setDay(previous=>{
        if(previous>=fire.rows.length-1){setPlaying(false);return previous;}
        return previous+1;
      });
    },1200/speed);
    return()=>clearInterval(timer);
  },[playing,fire,speed]);

  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),4500);return()=>clearTimeout(timer);},[notice]);

  const inference=useMemo(()=>{
    if(!fire||!model)return null;
    try{return {result:infer(observationValues(fire.rows.slice(0,day+1),model),model),error:""};}
    catch(e){return {result:null,error:e instanceof Error?e.message:"Inference failed."};}
  },[fire,model,day]);
  const prediction=useMemo(()=>{
    if(!hasForecast||!inference?.result||!model)return null;
    return forecast(inference.result.posterior.at(-1)!,model,horizon);
  },[hasForecast,inference,model,horizon]);

  function selectFire(id:string){setSelected(id);setView("overview");}
  function changeDay(index:number){setDay(index);setHasForecast(false);setPlaying(false);}
  function runPrediction(){
    if(!inference?.result)return;
    setPlaying(false);setHasForecast(true);setView("overview");setNotice(`${horizon}-day state forecast ready. Based on ${day+1} observations.`);
  }
  function exportReport(){
    if(!fire||!model||!inference?.result)return;
    download(`firecast-${fire.id}-report.json`,JSON.stringify({
      fire:{id:fire.id,name:fire.name,year:fire.year},observationCutoff:fire.rows[day].Map_Date,
      observationsUsed:day+1,model:model.source,features:model.features,
      stateDefinitions:STATES.map((s,id)=>({id,name:s.name})),
      decodedStates:inference.result.states,currentStateProbabilities:inference.result.posterior.at(-1),
      forecast:prediction?{horizonDays:horizon,dailyStateProbabilities:prediction}:null,
      limitations:"Research model. State probabilities only; no geographic perimeter forecast, damage estimate, or containment assessment. Uses no observations after the selected cutoff.",
    },null,2));setNotice("Analysis report downloaded.");
  }

  const current=inference?.result?.states.at(-1)??0;
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to analysis</a>
    <aside className="sidebar"><a href="/" className="brand" aria-label="FireCast home"><Flame size={36} fill="currentColor" strokeWidth={1.4}/><div><strong>FireCast</strong><span>WILDFIRE INTELLIGENCE</span></div></a><nav aria-label="Main navigation">{NAV.map(({id,label,icon:Icon})=><button key={id} className={view===id?"active":""} aria-current={view===id?"page":undefined} onClick={()=>setView(id)}><Icon size={19} strokeWidth={1.6}/><span>{label}</span>{view===id?<span className="nav-indicator"/>:null}</button>)}</nav><div className="sidebar-bottom"><div className="research-emblem"><div className="emblem-line"/><Flame size={50} strokeWidth={.6}/><div className="emblem-line"/></div><p>Understanding fire.<br/>One observation at a time.</p><button onClick={()=>about.current?.showModal()}><Settings2 size={17}/><span>Research workspace</span><ChevronRight size={14}/></button><span className="model-version">Gaussian HMM · v1.0</span></div></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><strong>{NAV.find(n=>n.id===view)?.label}</strong></div><button className="button export-button" disabled={!inference?.result} onClick={exportReport}><Download size={15}/><span>Export report</span></button></header>
      <main id="main"><div className="page-heading"><div><h1>{TITLES[view][0]}</h1><p>{TITLES[view][1]}</p></div><button className="about-button" aria-label="About this research platform" onClick={()=>about.current?.showModal()}><Info size={18}/></button></div>
        {bootstrapError?<div className="error-state" role="alert"><h2>Workspace couldn&apos;t load</h2><p>{bootstrapError}</p><button className="button" onClick={()=>window.location.reload()}>Retry</button></div>:<>
        <div className="filter-bar"><label className="filter-field year-filter"><span>Year</span><select aria-label="Select year" value={year} disabled={!catalog.length} onChange={e=>{const target=catalog.find(f=>f.year===Number(e.target.value));if(target)setSelected(target.id);}}><option>2018</option><option>2019</option></select></label><label className="filter-field fire-filter"><span>Fire reference</span><select aria-label="Select fire" value={selected} disabled={!catalog.length} onChange={e=>setSelected(e.target.value)}>{catalog.filter(f=>f.year===year).map(f=><option key={f.id} value={f.id}>{f.name} ({f.fireId})</option>)}</select></label><label className="filter-field date-filter"><span>Observation cutoff</span><select aria-label="Observation cutoff" value={day} disabled={!fire} onChange={e=>changeDay(Number(e.target.value))}>{fire?fire.rows.map((r,i)=><option key={i} value={i}>{date(fire.start)} – {date(r.Map_Date,true)}</option>):<option>Loading observations…</option>}</select></label><button className="button primary run-button" disabled={!inference?.result} onClick={runPrediction}><Play size={15} fill="currentColor"/>Run prediction<ArrowRight size={15}/></button></div>
        {error?<div className="error-state" role="alert"><h2>Fire data couldn&apos;t load</h2><p>{error}</p><button className="button" onClick={()=>setRetry(r=>r+1)}>Retry fire data</button></div>:!fire||!model?<Loading label="Loading wildfire observations…"/>:<>
          <section className="metrics-strip" aria-label="Selected observation summary"><div title="Mapped area at the observation cutoff"><span>Observed area</span><strong>{number(fire.rows[day].area_m2/10000)}<small>ha</small></strong></div><div title="Mapped area change since the previous observation"><span>Boundary change</span><strong>{fire.rows[day].delta_area>0?"+":""}{number(fire.rows[day].delta_area/10000)}<small>ha</small></strong></div><div title={`Decoded through ${date(fire.rows[day].Map_Date)}`}><span>Current state</span><strong className="state-metric"><i style={{background:STATES[current].color}}/>{inference?.result?STATES[current].short:"Unavailable"}</strong></div><div title={`${date(fire.start)} – ${date(fire.end)}`}><span>Observations</span><strong>{day+1}<small>/ {fire.days} days</small></strong></div></section>
          {inference?.error?<div className="form-error" role="alert">{inference.error}</div>:null}
          {view==="overview"&&inference?.result?<Overview fire={fire} day={day} probabilities={prediction?.at(-1)??inference.result.posterior.at(-1)!} hasForecast={hasForecast} horizon={horizon} onHorizon={setHorizon} onDay={changeDay} playing={playing} onPlaying={()=>{if(day===fire.rows.length-1)setDay(0);setHasForecast(false);setPlaying(!playing);}} speed={speed} onSpeed={setSpeed} currentState={current} onModel={()=>setView("hmm")}/>:null}
          {view==="hmm"&&inference?.result?<ModelExplorer model={model} fire={fire} states={inference.result.states} day={day} onDay={changeDay}/>:null}
          {view==="terrain"?<TerrainView fire={fire}/>:null}
          {view==="data"?<DataLibrary catalog={catalog} fire={fire} model={model} onSelect={selectFire}/>:null}
          <footer className="workspace-footer"><span><i/>Research data · {fire.year}</span><p>Historical observations. Experimental state forecasts.</p><button onClick={()=>about.current?.showModal()}>About FireCast<ArrowUpIcon/></button></footer>
        </>}
        </>}
      </main>
    </div>
    {notice?<div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss notification"><X size={16}/></button></div>:null}
    <dialog ref={about} className="about-dialog" onClick={e=>{if(e.target===e.currentTarget)about.current?.close();}}><div className="dialog-heading"><Flame size={28} fill="#ef693e" color="#ef693e"/><h2>About FireCast</h2><button className="icon-button" aria-label="Close about" onClick={()=>about.current?.close()}><X size={20}/></button></div><p>A browser-based workspace for the original FireCast wildfire research project. Explore 624 historical fires, daily boundaries, terrain and weather from 2018–2019.</p><h3>The original model, in your browser</h3><p>The five-state Gaussian HMM uses 24 standardized features. Viterbi decoding, forward–backward inference and transition-based forecasts run locally using the exported trained model and scaler.</p><h3>What the forecast means</h3><p>Forecasts estimate future hidden-state probabilities from observations through the selected cutoff. They do not predict geographic boundaries, damage, or containment. This research prototype is not an operational emergency tool.</p><h3>Data & map sources</h3><p>Fire boundaries are simplified at 0.0001° and rounded to five decimals for display. Terrain rasters are sampled to 48 × 48 cells. Weather and model features retain source values. Satellite tiles: Esri and contributors. Dark basemap: CARTO / OpenStreetMap.</p><button className="button primary" onClick={()=>about.current?.close()}>Back to workspace<ArrowRight size={15}/></button></dialog>
  </div>;
}

function ArrowUpIcon(){return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12L12 4M4 4h8v8"/></svg>;}
