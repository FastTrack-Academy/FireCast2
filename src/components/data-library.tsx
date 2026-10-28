"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Download, Search, Upload, CheckCircle2 } from "lucide-react";
import type { FireData, FireSummary, HMMModel } from "@/lib/types";
import { csv, date, download, number } from "@/lib/format";
import { parseCSV } from "@/lib/data";
import { forecast, infer, STATES } from "@/lib/hmm";
import { ProbabilityBars } from "./charts";

export default function DataLibrary({catalog,fire,model,onSelect}:{catalog:FireSummary[];fire:FireData;model:HMMModel;onSelect:(id:string)=>void}) {
  const [tab,setTab]=useState("catalog");
  const [query,setQuery]=useState("");
  const [group,setGroup]=useState("summary");
  const [error,setError]=useState("");
  const [custom,setCustom]=useState<{name:string;rows:number;states:number[];probabilities:number[]}|null>(null);
  const upload=useRef<HTMLInputElement>(null);
  const filtered=useMemo(()=>catalog.filter(f=>`${f.name} ${f.fireId} ${f.year}`.toLowerCase().includes(query.toLowerCase())),[catalog,query]);
  const columns=group==="weather"?["jd","Map_Date",...model.features.slice(13)]:group==="all"?["jd","Map_Date",...model.features]:["jd","Map_Date","area_m2","perimeter_m","delta_area","temperature_2m_max","wind_speed_10m_max","precipitation_sum"];
  async function importCSV(file:File) {
    setError("");setCustom(null);
    try {
      if(file.size>10*1024*1024) throw new Error("Please use a CSV smaller than 10 MB.");
      const rows=parseCSV(await file.text());
      const missing=model.features.filter(f=>!(f in rows[0]));
      if(missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
      const fireIds=new Set(rows.map(r=>r.fire_id).filter(Boolean));
      if(fireIds.size>1) throw new Error("Import one fire sequence at a time. This CSV contains multiple fire IDs.");
      if(new Set(rows.map(r=>r.year).filter(Boolean)).size>1) throw new Error("Import observations from one year at a time.");
      const days=rows.map(r=>r.jd?Number(r.jd):NaN);
      if(days.every(Number.isFinite) && days.some((d,i)=>i>0 && d<=days[i-1])) throw new Error("Julian days must be in increasing order. Sort the sequence before importing.");
      const values=rows.map((row,i)=>model.features.map(f=> {
        if(!row[f] || !Number.isFinite(Number(row[f]))) throw new Error(`Row ${i+2}: ${f} needs a finite numeric value.`);
        return Number(row[f]);
      }));
      const result=infer(values,model);
      const probabilities=forecast(result.posterior.at(-1)!,model,7).at(-1)!;
      setCustom({name:file.name,rows:rows.length,states:result.states,probabilities});
    } catch(e) {setError(e instanceof Error?e.message:"Could not read this CSV.");}
  }
  return <div className="data-content"><div className="panel data-panel"><div className="panel-heading"><div><h2>Research data</h2><p>{catalog.length} fires · 2018–2019 · original FireCast observations</p></div><button className="button" onClick={()=>download(`${fire.id}-observations.csv`,csv(fire.rows,["fire_id","year","jd","Map_Date",...model.features,"area_m2","perimeter_m"]),"text/csv")}><Download size={15}/>Download CSV</button></div>
    <div className="data-toolbar"><div className="tab-list"><button className={tab==="catalog"?"active":""} onClick={()=>setTab("catalog")}>Fire catalog</button><button className={tab==="observations"?"active":""} onClick={()=>setTab("observations")}>Selected observations</button></div>{tab==="catalog"?<label className="search-field"><Search size={16}/><input aria-label="Search fires" placeholder="Search by fire, ID or year…" value={query} onChange={e=>setQuery(e.target.value)}/></label>:<select aria-label="Observation features" value={group} onChange={e=>setGroup(e.target.value)}><option value="summary">Summary features</option><option value="weather">Weather features</option><option value="all">All 24 model features</option></select>}</div>
    <div className="table-scroll data-table">{tab==="catalog"?<table><thead><tr><th>Fire reference</th><th>Year</th><th>Observation period</th><th>Observations</th><th>Maximum mapped area</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map(f=><tr key={f.id} className={f.id===fire.id?"selected-row":""}><td><button className="text-button" onClick={()=>onSelect(f.id)}>{f.name}<span>Fire ID {f.fireId}</span></button></td><td>{f.year}</td><td>{date(f.start)} – {date(f.end)}</td><td>{f.days} days</td><td>{number(f.maxArea/10000)} ha</td><td><button className="icon-button" aria-label={`Explore ${f.name}`} onClick={()=>onSelect(f.id)}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table>:<table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{fire.rows.map((r,i)=><tr key={i}>{columns.map(c=><td key={c}>{typeof r[c]==="number"?number(r[c] as number,3):r[c]??"—"}</td>)}</tr>)}</tbody></table>}{tab==="catalog"&&!filtered.length?<div className="empty-state"><Search size={30}/><h3>No matching fires</h3><p>Try a different ID, year or reference.</p></div>:null}</div>
    <div className="panel-footnote">{tab==="catalog"?`${filtered.length} fires shown. Select a fire to open its analysis.`:"Source units: area m², perimeter m, temperature °C, wind km/h, rain mm, slope/aspect degrees."}</div>
  </div>
  <section className="panel import-panel"><div className="import-copy"><div className="import-icon"><Upload size={23}/></div><div><h2>Bring your own observations</h2><p>Run the same trained HMM on a single fire sequence. Your file stays in this browser.</p><p className="import-hint">CSV · 24 model feature columns · chronological rows · maximum 5,000 observations</p></div></div><div className="import-actions"><button className="button" onClick={()=>download("firecast-template.csv",csv(fire.rows.slice(0,3),["jd",...model.features]),"text/csv")}><Download size={14}/>Get template</button><button className="button primary" onClick={()=>upload.current?.click()}><Upload size={15}/>Import & run</button><input ref={upload} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Import observation CSV" onChange={e=>{const file=e.target.files?.[0];if(file)void importCSV(file);e.target.value="";}}/></div>
    {error?<div role="alert" className="form-error">{error}</div>:null}
    {custom?<div className="import-results"><div><CheckCircle2 size={18}/><h3>{custom.name}</h3><p>{custom.rows} observations decoded. Last state: {STATES[custom.states.at(-1)!].name}.</p><button className="text-link" onClick={()=>download("firecast-import-result.json",JSON.stringify({...custom,horizonDays:7,modelSource:model.source},null,2))}>Download inference result <ArrowUpRight size={13}/></button></div><div><h3>7-day state forecast</h3><ProbabilityBars probabilities={custom.probabilities}/></div></div>:null}
  </section></div>;
}
