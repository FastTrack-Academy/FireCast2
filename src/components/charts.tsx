"use client";

import { STATES } from "@/lib/hmm";
import type { Observation } from "@/lib/types";
import { date, number } from "@/lib/format";

export function AreaChart({ rows, day }: { rows: Observation[]; day: number }) {
  const width = 480, height = 170, left = 52, right = 15, top = 14, bottom = 30;
  const max = Math.max(...rows.map(r => r.area_m2 / 10000), 1) * 1.12;
  const minDay = rows[0].jd, span = Math.max(1, rows.at(-1)!.jd - minDay);
  const x = (i: number) => left + ((rows[i].jd - minDay) / span) * (width - left - right);
  const y = (area: number) => height - bottom - (area / max) * (height - top - bottom);
  const points = rows.map((r, i) => `${x(i)},${y(r.area_m2 / 10000)}`).join(" ");
  const selectedPoints = rows.slice(0,day+1).map((r,i)=>`${x(i)},${y(r.area_m2/10000)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Observed daily fire area in hectares; orange through the selected cutoff, gray for later observations" className="area-chart">
    <defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef693e" stopOpacity=".14"/><stop offset="100%" stopColor="#ef693e" stopOpacity="0"/></linearGradient></defs>
    {[0, 1, 2, 3].map(t => { const value = max * t / 3; return <g key={t}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#eceef1"/><text x={left - 10} y={y(value) + 4} textAnchor="end">{number(value)}</text></g>; })}
    <polygon points={`${left},${height - bottom} ${selectedPoints} ${x(day)},${height - bottom}`} fill="url(#area-fill)" />
    <polyline points={points} fill="none" stroke="#d6dbe1" strokeWidth="1.5" strokeLinejoin="round"/>
    <polyline points={selectedPoints} fill="none" stroke="#ef693e" strokeWidth="2.2" strokeLinejoin="round"/>
    <line x1={x(day)} x2={x(day)} y1={top} y2={height - bottom} stroke="#b1b7c0" strokeDasharray="4 4"/>
    <circle cx={x(day)} cy={y(rows[day].area_m2 / 10000)} r="4" fill="#ef693e" stroke="white" strokeWidth="2" />
    {[...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].map(i => <text key={i} x={x(i)} y={height - 7} textAnchor="middle">{date(rows[i].Map_Date)}</text>)}
  </svg>;
}

export function ProbabilityBars({ probabilities }: { probabilities: number[] }) {
  return <div className="probability-bars">{STATES.map((state, i) => <div className="probability-row" key={state.name}>
    <span title={state.name}>{state.short}</span><div className="bar-track"><div style={{ width: `${probabilities[i] * 100}%`, backgroundColor: state.color }} /></div><strong>{number(probabilities[i] * 100, 1)}<small>%</small></strong>
  </div>)}</div>;
}

export function StateTimeline({ rows, states, day, onDay }: { rows: Observation[]; states: number[]; day: number; onDay: (i: number) => void }) {
  return <div className="state-timeline"><div className="timeline-cells">{rows.map((row, i) => <button key={`${row.jd}-${i}`} onClick={() => onDay(i)} aria-label={`${date(row.Map_Date)}, ${i <= day ? STATES[states[i]].name : "not yet decoded"}`} title={`${date(row.Map_Date)} · JD ${row.jd}${i <= day ? ` · ${STATES[states[i]].name}` : ""}`} className={i === day ? "selected" : ""} style={{ backgroundColor: i <= day ? STATES[states[i]].color : "#edf0f2" }} />)}</div>
    <div className="timeline-labels"><span>JD {rows[0].jd} · {date(rows[0].Map_Date)}</span><span>JD {rows.at(-1)!.jd} · {date(rows.at(-1)!.Map_Date)}</span></div>
  </div>;
}

export function TransitionGraph({ counts, probabilities = false }: { counts: number[][]; probabilities?: boolean }) {
  const positions = [[90, 74], [300, 54], [440, 182], [300, 310], [90, 280]];
  const edges = counts.flatMap((row, a) => row.flatMap((count, b) => count > (probabilities ? 0.05 : 0) && a !== b ? [{ a, b, count }] : []));
  return <svg viewBox="0 0 530 365" className="transition-graph" role="img" aria-label="Observed state transitions with occurrence counts">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b2b7bf" /></marker></defs>
    {edges.map(({ a, b, count }) => { const [x1, y1] = positions[a], [x2, y2] = positions[b]; const dx = x2-x1, dy=y2-y1, length=Math.hypot(dx,dy); const cx=(x1+x2)/2-dy/length*28,cy=(y1+y2)/2+dx/length*28; return <g key={`${a}-${b}`}><path d={`M${x1+dx/length*29},${y1+dy/length*29} Q${cx},${cy} ${x2-dx/length*30},${y2-dy/length*30}`} fill="none" stroke="#bfc4cb" strokeWidth={probabilities?1+count*2:Math.min(3,1+count/3)} markerEnd="url(#arrow)"/><text x={(x1+x2+2*cx)/4} y={(y1+y2+2*cy)/4-4} textAnchor="middle">{probabilities?`${number(count*100)}%`:count}</text></g>; })}
    {positions.map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="25" fill="white" stroke={STATES[i].color} strokeWidth="3"/><text x={x} y={y+5} textAnchor="middle" className="state-node">S{i}</text><text x={x} y={y+43} textAnchor="middle">{STATES[i].short}</text>{counts[i][i] > 0 ? <g><path d={`M${x+21},${y-14} C${x+66},${y-55} ${x+66},${y+34} ${x+26},${y+10}`} fill="none" stroke="#bfc4cb" markerEnd="url(#arrow)"/><text x={x+58} y={y-12} fill="#8b9099">{probabilities?`${number(counts[i][i]*100)}%`:counts[i][i]}</text></g> : null}</g>)}
  </svg>;
}
