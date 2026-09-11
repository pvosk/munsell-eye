'use client';
import {memo,useMemo,useState} from 'react';
import {PLAY_LEVELS,LANDING_TOLERANCE,withLiveLanding,designLabBank,focusedLabBank,addPaint,chargeAmount,colorDistance,mixtureColor,pourPath,rgbStyle,totalMass,type ColorPoint} from './play-engine';
import {supportedLabEngine,LAB_GROUPS,LAB_DESIGN,analysisForHole,suggestedComparison,labEntries,type LabAttempt,type LabReview,type LabSpecimen,type LabEntry} from './play-lab-model';
import type {usePlayLabSync} from './play-lab-sync';

const RouteReview=memo(function RouteReview({entry}:{entry:LabEntry}) {
  const {attempt}=entry,[showSolution,setShowSolution]=useState(false),[step,setStep]=useState(0),[inspectExample,setInspectExample]=useState(false),[example,setExample]=useState(-1);
  const analysis=analysisForHole(attempt.specimen.hole.courseId);
  const alternatives=analysis?.bases.flatMap(b=>b.routes)??[];
  const exampleOrder=alternatives[example]?.order??attempt.specimen.hole.routeOrder,exampleTimes=alternatives[example]?.times??attempt.specimen.hole.routeTimes;
  const measurement=alternatives[example]??alternatives.find(r=>r.order.join()===exampleOrder.join()&&r.times.every((t,i)=>Math.abs(t-exampleTimes[i])<1e-8));
  const paths=useMemo(()=>{
    if(!supportedLabEngine(attempt.engine))return [];
    const paints=PLAY_LEVELS[attempt.specimen.levelIndex].paints;
    return attempt.shots.filter(s=>!s.cancelled).map(s=>pourPath(paints,s.before,s.paint,s.amount));
  },[attempt]);
  const solution=useMemo(()=>{
    const {levelIndex}=attempt.specimen,paints=PLAY_LEVELS[levelIndex].paints;
    const alternatives=analysisForHole(attempt.specimen.hole.courseId)?.bases.flatMap(b=>b.routes)??[];
    const order=alternatives[example]?.order??attempt.specimen.hole.routeOrder,times=alternatives[example]?.times??attempt.specimen.hole.routeTimes;
    let q=paints.map(()=>0);const path:ColorPoint[]=[],stops:ColorPoint[]=[];
    order.forEach((paint,i)=>{
      const amount=i?chargeAmount(totalMass(q),times[i-1]):1;
      if(i)path.push(...pourPath(paints,q,paint,amount));
      q=addPaint(q,paint,amount);stops.push(mixtureColor(paints,q));
      if(!i)path.push(stops[0]);
    });return {path,stops};
  },[attempt,example]);
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
    {showSolution&&<>{alternatives.length>0&&<label>Compare a route<select value={example} onChange={e=>{setExample(Number(e.target.value));setStep(0);}}><option value={-1}>Featured route</option>{alternatives.map((r,i)=><option key={i} value={i}>{r.order.map(p=>attempt.paints[p].name).join(' → ')}</option>)}</select></label>}<button type="button" aria-pressed={inspectExample} onClick={()=>{setInspectExample(!inspectExample);setStep(0);}}>Inspect {inspectExample?'my path':'example'}</button><div className="lab-route-stops">{solution.stops.map((p,i)=><div key={i}><i style={{background:rgbStyle(p.rgb)}}/><span>{i===0?'Start with':`After adding`}<strong>{attempt.paints[exampleOrder[i]].name}</strong></span></div>)}</div><p>Wide outlined line: example, colored by its mixture. Thin line: your route. This example takes {exampleTimes.length} additions; the fewest found for this hole is {attempt.specimen.hole.solutionShots}, excluding the free base. Neither is a required route or a proven minimum.</p></>}
    <p className="lab-muted">These are two projections of the same 3D paths, not aim guides. Screen overlap is not a color match.</p>
    {showSolution&&measurement&&<p className="lab-muted">Measured example: {measurement.meaningfulPours} meaningful pours · {Math.round(measurement.finishWindowMs)} ms full finishing window{measurement.setup?` · ${measurement.setup.successful}/${measurement.setup.cells} nearby setups admit a finish`:''}. {measurement.anticipatory?'Shows measured anticipatory setup.':''} These are local sampled measurements, not a success probability.</p>}
  </div>;
});

function ReviewForm({entry,onSave}:{entry:LabEntry;onSave:(review:LabReview)=>void}) {
  const [form,setForm]=useState<LabReview>(entry.review??{verdict:'',challenge:'',issue:'',note:'',shot:null});
  const [saved,setSaved]=useState(false);
  const experiment=designLabBank.holes.find(h=>h.record.id===entry.attempt.specimen.hole.courseId);
  const field=<K extends keyof LabReview>(key:K,value:LabReview[K])=>{setForm({...form,[key]:value});setSaved(false);};
  return <form className="lab-feedback" onSubmit={e=>{e.preventDefault();onSave(form);setSaved(true);}}>
    <label>Keep the hole overall?<select value={form.verdict} onChange={e=>field('verdict',e.target.value)}><option value="">Choose…</option><option value="keep">Keep</option><option value="revise">Revise</option><option value="reject">Reject</option></select></label>
    <label>Was this particular route worthwhile?<select value={form.routeVerdict??''} onChange={e=>field('routeVerdict',e.target.value)}><option value="">Choose…</option><option value="keep">Yes</option><option value="revise">With changes</option><option value="reject">No</option></select></label>
    {entry.attempt.specimen.comparison&&<label>Compared with your first start<select value={form.comparison??''} onChange={e=>field('comparison',e.target.value)}><option value="">Choose…</option><option value="both-good">Both worthwhile</option><option value="first-better">First start better</option><option value="second-better">This start better</option><option value="neither">Neither worthwhile</option></select></label>}
    {experiment&&!experiment.reference&&<label>After playing both palettes<select value={form.paletteVerdict??''} onChange={e=>field('paletteVerdict',e.target.value)}><option value="">Not compared yet</option><option value="original">Original palette better</option><option value="variant">Substituted palette better</option><option value="both">Both worthwhile</option><option value="neither">Neither worthwhile</option></select></label>}
    <label>What drove the challenge?<select value={form.challenge} onChange={e=>field('challenge',e.target.value)}><option value="">Choose…</option><option value="paint-choice">Choosing which paints to use</option><option value="setup">Setting up the next pour</option><option value="timing">Timing the finish</option></select></label>
    <label>What hurt it?<select value={form.issue} onChange={e=>field('issue',e.target.value)}><option value="">Nothing / not sure</option><option value="too-close">Too close to a base</option><option value="repetitive">Repetitive</option><option value="visibility">Unclear space</option><option value="correction">Frustrating correction</option><option value="other">Other</option></select></label>
    <label>Attach note to<select value={form.shot??''} onChange={e=>field('shot',e.target.value===''?null:Number(e.target.value))}><option value="">Whole attempt</option>{entry.attempt.shots.map((s,i)=><option key={i} value={i}>Action {i+1}: {entry.attempt.paints[s.paint].name}{s.cancelled?' (cancelled)':''}</option>)}</select></label>
    <label className="lab-note">Your note<textarea maxLength={3000} rows={3} value={form.note} onChange={e=>field('note',e.target.value)} placeholder="What made this route worth keeping—or changing?"/></label>
    <button type="submit">{saved?'Feedback queued ✓':'Save feedback'}</button>
  </form>;
}

export function LabPicker({current,onChoose,disabled}:{current:LabSpecimen;onChoose:(s:LabSpecimen)=>void;disabled:boolean}) {
  const tests=LAB_GROUPS.flatMap(g=>g.items);
  const choose=(s:LabSpecimen)=>onChoose({...s,hole:withLiveLanding(s.hole)});
  const index=tests.findIndex(s=>s.hole.courseId===current.hole.courseId&&s.levelIndex===current.levelIndex);
  const experiment=designLabBank.holes.find(h=>h.record.id===current.hole.courseId);
  const focused=focusedLabBank.holes.find(h=>h.record.id===current.hole.courseId);
  return <><label className="lab-picker">Route & palette lab<select disabled={disabled} value={index} onChange={e=>choose(tests[Number(e.target.value)])}>
    {index<0&&<option value={-1}>Current course hole · {PLAY_LEVELS[current.levelIndex].name}</option>}
    {LAB_GROUPS.map((group,j)=><optgroup key={group.name} label={group.name}>{group.items.map((s,i)=><option key={s.hole.courseId} value={LAB_GROUPS.slice(0,j).reduce((n,g)=>n+g.items.length,0)+i}>{String(i+1).padStart(2,'0')} · {PLAY_LEVELS[s.levelIndex].name} · {s.hole.kind.replaceAll('-',' ')} · {s.hole.notation}</option>)}</optgroup>)}
  </select></label>{index<tests.length-1&&<button type="button" disabled={disabled} onClick={()=>choose(tests[index+1])}>{index<0?'Start round 5':'Next test →'}</button>}{focused?<p className="lab-muted"><strong>{focused.coverage.styleBases.length}/{focused.coverage.total} starts support this style.</strong> {focused.brief} All starts meet route-support checks; choose your base freely.</p>:experiment&&<p className="lab-muted">{experiment.reference?'Reference · ':''}{experiment.brief} Free base choice; the brief is not an instruction to take a particular route.</p>}</>;
}

export function PlayLabPanel({sync,current,onReplay,onReveal}:{sync:ReturnType<typeof usePlayLabSync>;current:LabAttempt|null;onReplay:(specimen:LabSpecimen)=>void;onReveal:()=>void}) {
  const [chosen,setChosen]=useState<string|null>(null),[reviewing,setReviewing]=useState(false);
  const entries=useMemo(()=>labEntries(sync.events),[sync.events]);
  const entry=entries.find(e=>e.attempt.id===(chosen??current?.id))??entries[0];
  const same=entry?entries.filter(e=>e.attempt.specimen.hole.courseId===entry.attempt.specimen.hole.courseId&&e.attempt.specimen.levelIndex===entry.attempt.specimen.levelIndex):[];
  const currentId=current?.id;
  const comparison=entry?suggestedComparison(entry.attempt):null;
  const analysis=entry?analysisForHole(entry.attempt.specimen.hole.courseId):undefined;
  const experiment=designLabBank.holes.find(h=>h.record.id===entry?.attempt.specimen.hole.courseId);
  const focused=focusedLabBank.holes.find(h=>h.record.id===entry?.attempt.specimen.hole.courseId);
  const counterpart=experiment&&!experiment.reference?designLabBank.holes.find(h=>h.pair===experiment.pair&&h.levelIndex!==experiment.levelIndex):undefined;
  const pairedSpecimen=counterpart?LAB_DESIGN.find(s=>s.hole.courseId===counterpart.record.id):undefined;
  return <section className="play-lab-panel" aria-label="Hole design lab">
    <header><div><h2>Hole Lab</h2><p>Repeat the hole. Keep the evidence.</p></div><div className="lab-sync"><span role="status">{sync.status}</span><button type="button" onClick={sync.retry}>Refresh / retry</button></div></header>
    {!sync.signedIn?<p><a href="/signin-with-chatgpt?return_to=%2F%3Fmode%3Dplay%26lab%3D1" target="_top">Sign in with ChatGPT</a> to save private attempts and notes across devices.</p>:<>
      <div className="lab-toolbar"><button type="button" disabled={!entry} onClick={()=>{setReviewing(!reviewing);if(!reviewing)onReveal();}}>{reviewing?'Hide review':'Review routes & feedback'}</button><button type="button" onClick={sync.exportFile}>Export backup</button><label className="lab-import">Import backup<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void sync.importFile(file);e.target.value='';}}/></label></div>
      <p className="lab-muted">Round 5: four new palettes, two holes each. Selection favors the intended style working from more starting paints, while every start must have a supported route. Start naturally, then replay from another base. In your note, say whether that route delivered the intended style. Par and landing calibration are unchanged. Earlier rounds remain available; retired palettes can only be replayed from your history.</p>
      {current?.specimen.comparison&&<p className="lab-paired" role="status">Comparison attempt: try <strong>{current.paints[current.specimen.comparison.base].name}</strong> as your base. You remain free to choose otherwise.</p>}
      {entries.length>0&&<label className="lab-history">Attempt<select value={entry?.attempt.id??''} onChange={e=>{setChosen(e.target.value);setReviewing(true);onReveal();}}>{entries.map((e,i)=><option key={e.attempt.id} value={e.attempt.id}>{e.attempt.id===currentId?'Current · ':''}{PLAY_LEVELS[e.attempt.specimen.levelIndex].name} · {e.attempt.specimen.hole.notation} · {e.attempt.outcome} · {new Date(e.attempt.started).toLocaleString()} · {entries.length-i}</option>)}</select><button type="button" onClick={()=>setChosen(null)}>Current attempt</button></label>}
      {reviewing&&entry&&<div className="lab-review" key={entry.attempt.id}>
        <div className="lab-review-heading"><h3>{PLAY_LEVELS[entry.attempt.specimen.levelIndex].name} · {entry.attempt.specimen.hole.notation}</h3><button type="button" onClick={()=>{onReplay(entry.attempt.specimen);setChosen(null);setReviewing(false);}}>Replay this exact hole ↗</button></div>
        <p>{entry.attempt.specimen.hole.courseId} · {entry.attempt.engine} · {entry.attempt.specimen.comparison?'Suggested-base comparison':entry.attempt.revealed?'Analysis revealed':'Unassisted attempt'}</p>
        <p>Design intent: {entry.attempt.specimen.hole.kind.replaceAll('-',' ')}. This describes the test—not a required starting paint or route.</p>
        {focused&&<p className="lab-muted">Style coverage: {focused.coverage.styleBases.length}/{focused.coverage.total} starting paints have a supported efficient route of this style. For {focused.coverage.easiestStyleBases.length}/{focused.coverage.total}, the retained route with the widest finishing window also has this style. These are sampled route measurements, not predictions of which start you will prefer.</p>}
        <p className="lab-muted">Landing tolerance: {entry.attempt.specimen.hole.tolerance.toFixed(4)}. Exact replays retain this setting. The spherical outline is a visual marker, not the exact scoring boundary.{analysis&&'tolerance' in analysis?' Route measurements use this same landing tolerance.':entry.attempt.specimen.hole.tolerance!==LANDING_TOLERANCE?' Archived route measurements and par use the original 0.028 tolerance.':''}</p>
        {pairedSpecimen&&<div className="lab-paired"><p>{experiment?.brief} Compare with <strong>{PLAY_LEVELS[pairedSpecimen.levelIndex].name}</strong>.</p><button type="button" onClick={()=>{onReplay(pairedSpecimen);setChosen(null);setReviewing(false);}}>Try paired palette ↗</button></div>}
        {comparison&&<div className="lab-paired"><p>Compare the same target from <strong>{PLAY_LEVELS[comparison.levelIndex].paints[comparison.comparison!.base].name}</strong>. Choose that base yourself; other paints remain available.</p><button type="button" onClick={()=>{onReplay(comparison);setChosen(null);setReviewing(false);}}>Replay with suggested start ↗</button></div>}
        {analysis&&<details className="lab-base-analysis"><summary>Starting-choice measurements</summary><p>{analysis.qualifyingBases.length}/{analysis.bases.length} starts meet provisional route-quality checks. {analysis.robustThree?'Three additions found from every base; no one- or two-addition solution found.':''} This predicts candidates, not enjoyment.</p><div className="lab-base-scroll"><table><thead><tr><th>Base</th><th>Additions found</th><th>Shortest travel</th><th>Measured support</th>{focused&&<th>Intended style</th>}</tr></thead><tbody>{analysis.bases.map(b=><tr key={b.base}><td>{entry.attempt.paints[b.base].name}</td><td>{b.fewestFound??'Not found'}</td><td>{b.minimumTravel?.toFixed(1)??'—'}</td><td>{b.qualifies?'Supported':'Uncertain'}</td>{focused&&<td>{focused.coverage.styleBases.includes(b.base)?'Found':'Not found'}</td>}</tr>)}</tbody></table></div><p>Travel is in display-world units. Search is sampled, not exhaustive. Setup tests vary earlier release times within ±0.18 seconds and search for a successful finish; they do not prove global difficulty.</p></details>}
        <div className="lab-comparison">{same.map((e,i)=>{const shots=e.attempt.shots.filter(s=>!s.cancelled),last=shots.at(-1),error=last?colorDistance(mixtureColor(PLAY_LEVELS[e.attempt.specimen.levelIndex].paints,last.after),e.attempt.specimen.hole.target)/e.attempt.specimen.hole.tolerance:null;return <button type="button" key={e.attempt.id} aria-pressed={entry.attempt.id===e.attempt.id} onClick={()=>setChosen(e.attempt.id)}><strong>Attempt {same.length-i}</strong><span>{Math.max(0,shots.length-1)} pours · {last?totalMass(last.after).toFixed(2):0} parts</span><span>{error===null?'No base yet':`${error.toFixed(2)} × tolerance`} · {e.attempt.outcome}</span></button>;})}</div>
        <RouteReview entry={entry}/>
        <ReviewForm entry={entry} onSave={review=>sync.save({id:crypto.randomUUID(),attemptId:entry.attempt.id,type:'review',review})}/>
      </div>}
    </>}
  </section>;
}
