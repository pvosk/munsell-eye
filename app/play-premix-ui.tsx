'use client';
import {useState} from 'react';
import {PLAY_LEVELS,mixtureColor,rgbStyle,colorDistance,pourPath,type ColorPoint} from './play-engine';
import {premixRoute,type MassMode} from './play-premix';
import {premixBank,regionBank,generatePremixHole,premixItem,type PremixRow} from './play-premix-bank';
import type {LabSpecimen,LabEntry} from './play-lab-model';
import {routeGraphBounds} from './play-lab-graph';
const labels:Record<string,string>={rise:'Setup → value rise',drop:'Setup → value drop','coupled-balance':'Coupled balance','long-finish':'Setup → long chromatic finish','chromatic-ride':'Chromatic ride','setup-glide':'Setup → glide','interior-assembly':'Interior assembly'};
export function PremixPicker({current,onChoose,archive=false}:{current:LabSpecimen;onChoose:(s:LabSpecimen)=>void;archive?:boolean}){
 const rows:PremixRow[]=archive?premixBank.holes:regionBank.holes;
 const active=rows.find(h=>h.id===current.hole.premix?.pairId),item=active??rows[0],mode:MassMode=archive?(current.hole.premix?.massMode??'normalized'):'normalized';
 const choose=(id:string,m:MassMode)=>{const row=rows.find(h=>h.id===id)!;onChoose({levelIndex:row.level,hole:generatePremixHole(id,m)});};
 return <><label>Premix puzzle<select value={active?.id??''} onChange={e=>choose(e.target.value,mode)}>{!active&&<option value="">Choose a puzzle…</option>}{rows.map((h,i)=><option key={h.id} value={h.id}>{i+1}. {PLAY_LEVELS[h.level].name} · {labels[h.style]}{h.role?.startsWith('reference')?' · Familiar reference':''}</option>)}</select></label>
 {archive&&<label>Quantity behavior<select value={mode} onChange={e=>choose(item.id,e.target.value as MassMode)}><option value="accumulated">A · Archived accumulated mass</option><option value="normalized">B · Normalize to 1 part</option></select></label>}
 <button type="button" onClick={()=>choose(item.id,mode)}>{active?'Replay this version':'Start premix puzzle'}</button>
 {active&&archive&&<button type="button" onClick={()=>choose(item.id,mode==='accumulated'?'normalized':'accumulated')}>Replay same puzzle in {mode==='accumulated'?'B':'A'} →</button>}
 {!archive&&active&&<button type="button" onClick={()=>choose(rows[(rows.indexOf(item)+1)%rows.length].id,'normalized')}>Next puzzle →</button>}
 <p className="lab-muted">{archive?'Archived A/B comparison.':'Nine new puzzles and two familiar references. Normalized mass throughout; pigment strengths unchanged.'} Every pour counts; no free base choice. Par 3 is held constant, not a newly calibrated difficulty score. Labels describe candidate experiences, not guaranteed enjoyment.</p>
 {!archive&&active&&<RegionEvidence item={item}/>}
 <details><summary>Prepared mixture · 1 part at start</summary><div className="lab-route-stops">{item.initial.map((q,i)=><div key={i}><i style={{background:rgbStyle(PLAY_LEVELS[item.level].paints[i].rgb)}}/><span>{PLAY_LEVELS[item.level].paints[i].name}<strong>{(q*100).toFixed(1)}%</strong></span></div>)}</div><p>Normalized mode preserves pigment proportions and resets total quantity to 1 after each shot. Archived A keeps accumulated quantities.</p></details></>;
}
function RegionEvidence({item}:{item:PremixRow}){
 const c=item.classification;if(!c)return null;
 if(item.role?.startsWith('reference'))return <p>Familiar reference · {item.role==='reference-easy'?'Previously felt too easy.':'Previously enjoyed.'} Included for comparison, not presented as a newly validated finalist.</p>;
 return <div className="lab-muted"><p><strong>{c.rawMinimum} additions: shortest found · {c.timingMinimum??'none'}: timing-supported shortest.</strong></p><p>{c.status==='required-in-tested-routes'?'No efficient style bypass found in this bounded search.':c.status==='competitive'?'The intended style is competitive, but equally short alternatives can feel different.':'The intended style is available; a more efficient approach can bypass it.'} These are search findings, not proofs.</p></div>;
}
export function PremixRouteReview({entry}:{entry:LabEntry}){
 const {attempt}=entry,hole=attempt.specimen.hole,premix=hole.premix!,item=premixItem(hole)!,paints=PLAY_LEVELS[attempt.specimen.levelIndex].paints;
 const [shown,setShown]=useState(true),[example,setExample]=useState(-1);
 const evidence=item.modes[premix.massMode]!,r=example<0?evidence.measurement:evidence.rivals[example]??evidence.measurement;
 const solution=premixRoute(paints,premix.initial,r.order,r.times,premix.massMode);
 const paths=attempt.shots.filter(s=>!s.cancelled).map(s=>pourPath(paints,s.before,s.paint,s.amount,64));
 const bounds=routeGraphBounds(paths.flat(),[],solution.path,hole.target);
 const project=(p:ColorPoint,axes:[number,number])=>axes.map((axis,i)=>{const [min,max]=bounds[axis],t=(p.position[axis]-min)/Math.max(1,max-min);return i?150-t*130:15+t*270;});
 return <div className="lab-route"><p><strong>{labels[item.style]} · {premix.massMode==='accumulated'?'Archived accumulated':'Normalized'}</strong>. The starting recipe is fixed; all recorded actions count.</p><RegionEvidence item={item}/>
 <div className="lab-maps">{([[0,2],[0,1]] as [number,number][]).map((axes,i)=><figure key={i}><figcaption>{i?'Side · value':'Above · hue/chroma'}</figcaption><svg viewBox="0 0 300 170" role="img" aria-label="Premix route comparison">{[...(shown?[solution.path]:[]),...paths].map((path,j)=><g key={j}>{path.slice(1).map((p,k)=>{const a=project(path[k],axes),b=project(p,axes);return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={rgbStyle(p.rgb)} strokeWidth={shown&&j===0?5:2}/>;})}</g>)}{[solution.stops[0],hole.target].map((p,j)=>{const [x,y]=project(p,axes);return <circle key={j} cx={x} cy={y} r={j?7:5} fill={rgbStyle(p.rgb)} stroke="white"/>;})}</svg></figure>)}</div>
 <button type="button" onClick={()=>setShown(!shown)}>{shown?'Hide':'Show'} example</button>
 {shown&&<><label>Compare routes from this premix<select value={example} onChange={e=>setExample(Number(e.target.value))}><option value={-1}>Backward-planned finish</option>{evidence.rivals.map((r,i)=><option key={i} value={i}>{r.order.map(p=>paints[p].name).join(' → ')} · {r.supported?'timing-supported':'raw endpoint'}</option>)}</select></label><div className="lab-route-stops">{solution.stops.map((p,i)=><div key={i}><i style={{background:rgbStyle(p.rgb)}}/><span>{i?paints[r.order[i-1]].name:'Prepared mixture'}<strong>{i?`${r.times[i-1].toFixed(3)} s`:'Start'}</strong></span></div>)}</div><p>{r.times.length} additions · {Math.round(r.finishWindowMs)} ms sampled finish window · {(r.setupCoverage*100).toFixed(0)}% local setup slice. {item.role?'The window contains this example’s release; the setup slice perturbs all setup controls and re-searches the finish.':'Archived widest-window / first-setup measurement.'} Approximate—not success odds or a global region size.</p></>}
 <p className="lab-muted">Thick line: selected example. Thin lines: your pours. Saved attempts keep their original quantity mode and target.</p></div>;
}
