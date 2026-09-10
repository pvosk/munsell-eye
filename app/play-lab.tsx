'use client';
import {memo,useMemo,useState} from 'react';
import {PLAY_LEVELS,addPaint,chargeAmount,colorDistance,mixtureColor,pourPath,rgbStyle,totalMass,type ColorPoint} from './play-engine';
import {supportedLabEngine,LAB_STARTERS,labEntries,type LabAttempt,type LabReview,type LabSpecimen,type LabEntry} from './play-lab-model';
import type {usePlayLabSync} from './play-lab-sync';

const RouteReview=memo(function RouteReview({entry}:{entry:LabEntry}) {
  const {attempt}=entry,[showSolution,setShowSolution]=useState(false),[step,setStep]=useState(0),[inspectExample,setInspectExample]=useState(false);
  const paths=useMemo(()=>{
    if(!supportedLabEngine(attempt.engine))return [];
    const paints=PLAY_LEVELS[attempt.specimen.levelIndex].paints;
    return attempt.shots.filter(s=>!s.cancelled).map(s=>pourPath(paints,s.before,s.paint,s.amount));
  },[attempt]);
  const solution=useMemo(()=>{
    const {hole,levelIndex}=attempt.specimen,paints=PLAY_LEVELS[levelIndex].paints;
    let q=paints.map(()=>0);const path:ColorPoint[]=[],stops:ColorPoint[]=[];
    hole.routeOrder.forEach((paint,i)=>{
      const amount=i?chargeAmount(totalMass(q),hole.routeTimes[i-1]):1;
      if(i)path.push(...pourPath(paints,q,paint,amount));
      q=addPaint(q,paint,amount);stops.push(mixtureColor(paints,q));
      if(!i)path.push(stops[0]);
    });return {path,stops};
  },[attempt]);
  const points=paths.flat(),target=attempt.specimen.hole.target;
  const inspected=showSolution&&inspectExample?solution.path:points;
  const selected=inspected[Math.min(step,inspected.length-1)];
  const all=[...points,...(showSolution?solution.path:[]),target];
  const bounds=[0,1,2].map(axis=>{const values=all.map(p=>p.position[axis]);return [Math.min(...values),Math.max(...values)];});
  const project=(p:ColorPoint,axes:[number,number])=>axes.map((axis,i)=>{
    const [min,max]=bounds[axis],ratio=(p.position[axis]-min)/Math.max(1,max-min);
    return i?150-ratio*130:15+ratio*270;
  });
  return <div className="lab-route">
    <div className="lab-maps">{([[0,2],[0,1]] as [number,number][]).map((axes,i)=><figure key={i}><figcaption>{i?'Side · value rises':'Above · hue + chroma'}</figcaption><svg viewBox="0 0 300 170" role="img" aria-label={i?'Side projection of the shot paths':'Top projection of the shot paths'}>
      {showSolution&&<g><polyline points={solution.path.map(p=>project(p,axes).join(',')).join(' ')} fill="none" stroke="#eee8d7" strokeWidth="7" opacity=".35"/>{solution.path.slice(1).map((p,k)=>{const a=project(solution.path[k],axes),b=project(p,axes);return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={rgbStyle(p.rgb)} strokeWidth="4"/>;})}</g>}
      {paths.map((path,j)=><g key={j}>{path.slice(1).map((p,k)=>{const a=project(path[k],axes),b=project(p,axes);return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={rgbStyle(p.rgb)} strokeWidth="3"/>;})}</g>)}
      <circle cx={project(target,axes)[0]} cy={project(target,axes)[1]} r="7" fill={rgbStyle(target.rgb)} stroke="white"/>
      {showSolution&&solution.stops.map((p,j)=>{const [x,y]=project(p,axes);return <g key={j}><circle cx={x} cy={y} r={j===0?8:4} fill={rgbStyle(p.rgb)} stroke="#fff" strokeWidth={j===0?2:1}/>{j===0&&<text x={Math.max(22,Math.min(265,x))} y={y>32?y-13:y+22} fill="white" fontSize="11" textAnchor="middle">Start</text>}</g>;})}
      {selected&&<circle cx={project(selected,axes)[0]} cy={project(selected,axes)[1]} r="4" fill={rgbStyle(selected.rgb)} stroke="white"/>}
    </svg></figure>)}</div>
    {inspected.length>0&&<label className="lab-scrubber">Inspect {showSolution&&inspectExample?'example route':'your path'}<input type="range" min="0" max={inspected.length-1} value={Math.min(step,inspected.length-1)} onChange={e=>setStep(Number(e.target.value))}/><span>{selected?`${(colorDistance(selected,target)/attempt.specimen.hole.tolerance).toFixed(2)} × landing tolerance`:''}</span></label>}
    <button type="button" aria-pressed={showSolution} onClick={()=>{setShowSolution(!showSolution);setInspectExample(!showSolution);setStep(0);}}>{showSolution?'Hide':'Show'} example route</button>
    {showSolution&&<><button type="button" aria-pressed={inspectExample} onClick={()=>{setInspectExample(!inspectExample);setStep(0);}}>Inspect {inspectExample?'my path':'example'}</button><div className="lab-route-stops">{solution.stops.map((p,i)=><div key={i}><i style={{background:rgbStyle(p.rgb)}}/><span>{i===0?'Start with':`After adding`}<strong>{attempt.paints[attempt.specimen.hole.routeOrder[i]].name}</strong></span></div>)}</div><p>Wide outlined line: example route, colored by its mixture at every point. Thin line: your route. {attempt.specimen.hole.solutionShots} additions found, excluding the free base. This is the most timing-forgiving shortest route found by the search—not a required start or a proven minimum.</p></>}
    <p className="lab-muted">These are two projections of the same 3D paths, not aim guides. Screen overlap is not a color match.</p>
  </div>;
});

function ReviewForm({entry,onSave}:{entry:LabEntry;onSave:(review:LabReview)=>void}) {
  const [form,setForm]=useState<LabReview>(entry.review??{verdict:'',challenge:'',issue:'',note:'',shot:null});
  const [saved,setSaved]=useState(false);
  const field=<K extends keyof LabReview>(key:K,value:LabReview[K])=>{setForm({...form,[key]:value});setSaved(false);};
  return <form className="lab-feedback" onSubmit={e=>{e.preventDefault();onSave(form);setSaved(true);}}>
    <label>Keep this hole?<select value={form.verdict} onChange={e=>field('verdict',e.target.value)}><option value="">Choose…</option><option value="keep">Keep</option><option value="revise">Revise</option><option value="reject">Reject</option></select></label>
    <label>What drove the challenge?<select value={form.challenge} onChange={e=>field('challenge',e.target.value)}><option value="">Choose…</option><option value="paint-choice">Choosing paints</option><option value="setup">Setting up</option><option value="timing">Timing the finish</option></select></label>
    <label>What hurt it?<select value={form.issue} onChange={e=>field('issue',e.target.value)}><option value="">Nothing / not sure</option><option value="too-close">Too close to a base</option><option value="repetitive">Repetitive</option><option value="visibility">Unclear space</option><option value="correction">Frustrating correction</option><option value="other">Other</option></select></label>
    <label>Attach note to<select value={form.shot??''} onChange={e=>field('shot',e.target.value===''?null:Number(e.target.value))}><option value="">Whole attempt</option>{entry.attempt.shots.map((s,i)=><option key={i} value={i}>Action {i+1}: {entry.attempt.paints[s.paint].name}{s.cancelled?' (cancelled)':''}</option>)}</select></label>
    <label className="lab-note">Your note<textarea maxLength={3000} rows={3} value={form.note} onChange={e=>field('note',e.target.value)} placeholder="What made this route worth keeping—or changing?"/></label>
    <button type="submit">{saved?'Feedback queued ✓':'Save feedback'}</button>
  </form>;
}

export function LabPicker({current,onChoose,disabled}:{current:LabSpecimen;onChoose:(s:LabSpecimen)=>void;disabled:boolean}) {
  const index=LAB_STARTERS.findIndex(s=>s.hole.courseId===current.hole.courseId&&s.levelIndex===current.levelIndex);
  return <label className="lab-picker">Test hole<select disabled={disabled} value={index} onChange={e=>onChoose(LAB_STARTERS[Number(e.target.value)])}>
    {index<0&&<option value={-1}>Current course hole · {PLAY_LEVELS[current.levelIndex].name}</option>}
    {LAB_STARTERS.map((s,i)=><option key={i} value={i}>{String(i+1).padStart(2,'0')} · {PLAY_LEVELS[s.levelIndex].name} · {s.hole.notation}</option>)}
  </select></label>;
}

export function PlayLabPanel({sync,current,onReplay,onReveal}:{sync:ReturnType<typeof usePlayLabSync>;current:LabAttempt|null;onReplay:(specimen:LabSpecimen)=>void;onReveal:()=>void}) {
  const [chosen,setChosen]=useState<string|null>(null),[reviewing,setReviewing]=useState(false);
  const entries=useMemo(()=>labEntries(sync.events),[sync.events]);
  const entry=entries.find(e=>e.attempt.id===(chosen??current?.id))??entries[0];
  const same=entry?entries.filter(e=>e.attempt.specimen.hole.courseId===entry.attempt.specimen.hole.courseId&&e.attempt.specimen.levelIndex===entry.attempt.specimen.levelIndex):[];
  const currentId=current?.id;
  return <section className="play-lab-panel" aria-label="Hole design lab">
    <header><div><h2>Hole Lab</h2><p>Repeat the hole. Keep the evidence.</p></div><div className="lab-sync"><span role="status">{sync.status}</span><button type="button" onClick={sync.retry}>Refresh / retry</button></div></header>
    {!sync.signedIn?<p><a href="/signin-with-chatgpt?return_to=%2F%3Fmode%3Dplay%26lab%3D1" target="_top">Sign in with ChatGPT</a> to save private attempts and notes across devices.</p>:<>
      <div className="lab-toolbar"><button type="button" disabled={!entry} onClick={()=>{setReviewing(!reviewing);if(!reviewing)onReveal();}}>{reviewing?'Hide review':'Review routes & feedback'}</button><button type="button" onClick={sync.exportFile}>Export backup</button><label className="lab-import">Import backup<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void sync.importFile(file);e.target.value='';}}/></label></div>
      <p className="lab-muted">Twelve repeatable starter holes—not yet curated favorites. Free base selection stays on. No auto-advance. Par and route analysis stay hidden until review.</p>
      {entries.length>0&&<label className="lab-history">Attempt<select value={entry?.attempt.id??''} onChange={e=>{setChosen(e.target.value);setReviewing(true);onReveal();}}>{entries.map((e,i)=><option key={e.attempt.id} value={e.attempt.id}>{e.attempt.id===currentId?'Current · ':''}{PLAY_LEVELS[e.attempt.specimen.levelIndex].name} · {e.attempt.specimen.hole.notation} · {e.attempt.outcome} · {new Date(e.attempt.started).toLocaleString()} · {entries.length-i}</option>)}</select><button type="button" onClick={()=>setChosen(null)}>Current attempt</button></label>}
      {reviewing&&entry&&<div className="lab-review" key={entry.attempt.id}>
        <div className="lab-review-heading"><h3>{PLAY_LEVELS[entry.attempt.specimen.levelIndex].name} · {entry.attempt.specimen.hole.notation}</h3><button type="button" onClick={()=>{onReplay(entry.attempt.specimen);setChosen(null);setReviewing(false);}}>Replay this exact hole ↗</button></div>
        <p>{entry.attempt.specimen.hole.courseId} · {entry.attempt.engine} · {entry.attempt.revealed?'Analysis revealed':'Unassisted attempt'}</p>
        <div className="lab-comparison">{same.map((e,i)=>{const shots=e.attempt.shots.filter(s=>!s.cancelled),last=shots.at(-1),error=last?colorDistance(mixtureColor(PLAY_LEVELS[e.attempt.specimen.levelIndex].paints,last.after),e.attempt.specimen.hole.target)/e.attempt.specimen.hole.tolerance:null;return <button type="button" key={e.attempt.id} aria-pressed={entry.attempt.id===e.attempt.id} onClick={()=>setChosen(e.attempt.id)}><strong>Attempt {same.length-i}</strong><span>{Math.max(0,shots.length-1)} pours · {last?totalMass(last.after).toFixed(2):0} parts</span><span>{error===null?'No base yet':`${error.toFixed(2)} × tolerance`} · {e.attempt.outcome}</span></button>;})}</div>
        <RouteReview entry={entry}/>
        <ReviewForm entry={entry} onSave={review=>sync.save({id:crypto.randomUUID(),attemptId:entry.attempt.id,type:'review',review})}/>
      </div>}
    </>}
  </section>;
}
