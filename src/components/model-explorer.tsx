"use client";

import { useState } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { ProbabilityBars, StateTimeline, TransitionGraph } from "./charts";
import { STATES, transitionCounts } from "@/lib/hmm";
import type { FireData, HMMModel } from "@/lib/types";
import { number } from "@/lib/format";

export default function ModelExplorer({model,fire,states,day,onDay}:{model:HMMModel;fire:FireData;states:number[];day:number;onDay:(i:number)=>void}) {
  const [featureCount,setFeatureCount]=useState(5);
  const [selectedState,setSelectedState]=useState(0);
  const [graphMode,setGraphMode]=useState("observed");
  const emissions=model.means[selectedState].map((value,i)=>({value,feature:model.features[i],physical:model.physicalMeans[selectedState][i]})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,featureCount);
  const counts=transitionCounts(states);
  return <div className="model-content">
    <div className="model-top-grid"><section className="panel transition-panel"><div className="panel-heading"><div><h2>Transition probabilities</h2><p>How one hidden state leads to the next</p></div><Info size={17} className="muted"/></div>
      <div className="table-scroll"><table className="matrix"><thead><tr><th>FROM / TO</th>{STATES.map((s,i)=><th key={s.name}><span style={{color:s.color}}>S{i}</span>{s.short}</th>)}</tr></thead><tbody>{model.transition.map((row,i)=><tr key={i}><th><i style={{background:STATES[i].color}}/>S{i} · {STATES[i].short}</th>{row.map((p,j)=><td key={j}><span style={{background:`rgba(239,105,62,${p*0.73+0.025})`,color:p>.6?"#9f3417":"#5d626c"}}>{number(p*100,1)}<small>%</small></span></td>)}</tr>)}</tbody></table></div>
      <p className="panel-footnote">Rows sum to 100%. Transitions are fixed learned model parameters.</p>
    </section><section className="panel initial-panel"><div className="panel-heading"><div><h2>Initial probabilities</h2><p>The model&apos;s starting distribution</p></div></div><ProbabilityBars probabilities={model.start}/><div className="inline-note">These probabilities initialize the first observation. They are updated as evidence arrives.</div></section></div>
    <section className="panel"><div className="panel-heading"><div><h2>Decoded state timeline</h2><p>Viterbi path through the selected observation · click a day to inspect</p></div><span className="subtle-label">{states.length} observations decoded</span></div><StateTimeline rows={fire.rows} states={states} day={day} onDay={onDay}/><div className="state-legend">{STATES.map((s,i)=><span key={i}><i style={{background:s.color}}/>S{i} · {s.short}</span>)}</div></section>
    <div className="model-bottom-grid"><section className="panel"><div className="panel-heading"><div><h2>{graphMode==="observed"?"Observed transitions":"Learned transition graph"}</h2><p>{graphMode==="observed"?"Counts along this fire's decoded state path":"Model transitions with probability above 5%"}</p></div><div className="segmented"><button className={graphMode==="observed"?"active":""} aria-pressed={graphMode==="observed"} onClick={()=>setGraphMode("observed")}>Observed</button><button className={graphMode==="model"?"active":""} aria-pressed={graphMode==="model"} onClick={()=>setGraphMode("model")}>Model</button></div></div><TransitionGraph counts={graphMode==="observed"?counts:model.transition} probabilities={graphMode==="model"}/></section>
      <section className="panel emission-panel"><div className="panel-heading"><div><h2>Emission features</h2><p>Features with the largest standardized means</p></div></div><div className="emission-controls"><label>State<select aria-label="Emission state" value={selectedState} onChange={e=>setSelectedState(Number(e.target.value))}>{STATES.map((s,i)=><option key={i} value={i}>S{i} · {s.name}</option>)}</select></label><label>Number of features <span>{featureCount}</span><input aria-label="Number of emission features" type="range" min="3" max={model.features.length} value={featureCount} onChange={e=>setFeatureCount(Number(e.target.value))}/></label></div>
        <div className="table-scroll emission-table"><table><thead><tr><th>Feature</th><th>Std. mean</th><th>Physical mean</th></tr></thead><tbody>{emissions.map(e=><tr key={e.feature}><td>{e.feature}</td><td>{number(e.value,3)}</td><td>{number(e.physical,2)}</td></tr>)}</tbody></table></div>
      </section></div>
    <section className="panel state-guide"><div className="panel-heading"><div><h2>State interpretation guide</h2><p>Physical emission means from the original trained model</p></div></div><div className="table-scroll"><table><thead><tr><th>Hidden state</th><th>Area change (ha)</th><th>Max temp. (°C)</th><th>Rain (mm)</th><th>Wind (km/h)</th><th>Slope (°)</th><th>Interpretation</th></tr></thead><tbody>{STATES.map((s,i)=><tr key={i}><td><i style={{background:s.color}}/><strong>S{i} · {s.name}</strong></td><td>{number(model.physicalMeans[i][8]/10000,1)}</td><td>{number(model.physicalMeans[i][13],1)}</td><td>{number(model.physicalMeans[i][17],1)}</td><td>{number(model.physicalMeans[i][19],1)}</td><td>{number(model.physicalMeans[i][0],1)}</td><td>{s.description}</td></tr>)}</tbody></table></div></section>
    <div className="research-note"><Info size={17}/><p>State names describe learned emissions; they do not establish containment. State IDs are zero-based and consistent with the trained model. The original demo&apos;s labels for S2 and S4 have been corrected to match their physical means.</p></div>
  </div>;
}
