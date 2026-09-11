'use client';
import {memo,useMemo,useState} from 'react';
import {PLAY_LEVELS,LANDING_TOLERANCE,withLiveLanding,designLabBank,focusedLabBank,addPaint,chargeAmount,colorDistance,mixtureColor,pourPath,rgbStyle,totalMass,type ColorPoint} from './play-engine';
import {supportedLabEngine,LAB_GROUPS,LAB_DESIGN,directedForHole,analysisForHole,suggestedComparison,labReviewEntries,selectedLabEntry,type LabAttempt,type LabReview,type LabSpecimen,type LabEntry} from './play-lab-model';
import type {usePlayLabSync} from './play-lab-sync';
import finishProfiles from './generated/play-finish-profiles.json';
import {CAMPAIGN_CHAPTERS,campaignForHole,campaignSourceId} from './play-campaign';
import {routeGraphBounds} from './play-lab-graph';

function FinishProfileReview({id}:{id:string}){
 const h=finishProfiles.holes.find(h=>h.id===campaignSourceId(id));if(!h)return null;
 const f=h.featured;
 return <details className="lab-base-analysis"><summary>Updated finish measurements · by starting paint</summary>
  <p>A value-led finish is mainly a lightness move after setup, and is not overshadowed by an earlier lightness change. A coupled finish can still be a good balancing route. Simple rides remain valid; they do not need a setup.</p>
  <p><strong>Featured route: {f.valueLed?'value-led finish':f.valueMovement?'coupled / earlier value shift':'no substantial value finish after setup'}.</strong> {f.reasons.join(' ')}</p>
  {f.valueMovement&&<p>Finish lightness change: {f.deltaL.toFixed(3)} OKLab L. Largest setup change: {f.largestSetupShift.toFixed(3)}. Lightness alignment: {(f.valueAlignment*100).toFixed(0)}% (direction, not a difficulty score).</p>}
  <div className="lab-base-scroll"><table><thead><tr><th>Starting paint</th><th>Value-led finish</th><th>Other efficient routes</th></tr></thead><tbody>{h.bases.map(b=><tr key={b.base}><td>{b.name}</td><td>{b.valueLed?'Found':'Not found'}</td><td>{!b.retained?'Unresolved':b.valueLedResistant?'None retained without this finish':'Alternatives without this finish found'}</td></tr>)}</tbody></table></div>
  <p>Remeasured from the full retained efficient route evidence, not just the displayed examples. Sampled—not proof that no other route exists. Provisional test: lightness alignment ≥80%; final lightness change ≥80% of the largest setup change. Original intentions and saved attempts are unchanged.</p>
 </details>;
}

const RouteReview=memo(function RouteReview({entry}:{entry:LabEntry}) {
  const {attempt}=entry,[showSolution,setShowSolution]=useState(true),[step,setStep]=useState(0),[inspectExample,setInspectExample]=useState(true),[example,setExample]=useState(-1);
  const analysis=analysisForHole(attempt.specimen.hole.courseId);
  const directed=directedForHole(attempt.specimen.hole.courseId);
  const alternatives=directed?[directed.roles.intended,directed.roles.shortest,directed.roles.closest,...directed.analysis.bases.flatMap(b=>b.routes)]:analysis?.bases.flatMap(b=>b.routes)??[];
  const exampleOrder=alternatives[example]?.order??attempt.specimen.hole.routeOrder,exampleTimes=alternatives[example]?.times??attempt.specimen.hole.routeTimes;
  const measurement=alternatives[example]??alternatives.find(r=>r.order.join()===exampleOrder.join()&&r.times.every((t,i)=>Math.abs(t-exampleTimes[i])<1e-8));
  const paths=useMemo(()=>{
    if(!supportedLabEngine(attempt.engine))return [];
    const paints=PLAY_LEVELS[attempt.specimen.levelIndex].paints;
    return attempt.shots.filter(s=>!s.cancelled).map(s=>pourPath(paints,s.before,s.paint,s.amount));
  },[attempt]);
  const solution=useMemo(()=>{
    const {levelIndex}=attempt.specimen,paints=PLAY_LEVELS[levelIndex].paints;
    const item=directedForHole(attempt.specimen.hole.courseId);
    const alternatives=item?[item.roles.intended,item.roles.shortest,item.roles.closest,...item.analysis.bases.flatMap(b=>b.routes)]:analysisForHole(attempt.specimen.hole.courseId)?.bases.flatMap(b=>b.routes)??[];
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
  const referenceBounds=useMemo(()=>{
    const paints=PLAY_LEVELS[attempt.specimen.levelIndex].paints;
    const routes=analysisForHole(attempt.specimen.hole.courseId)?.bases.flatMap(b=>b.routes)??[];
    return routes.flatMap(r=>{let q=paints.map(()=>0);return r.order.flatMap((paint,i)=>{
      const amount=i?chargeAmount(totalMass(q),r.times[i-1]):1;
      const path=i?pourPath(paints,q,paint,amount):[mixtureColor(paints,paints.map((_,j)=>+(j===paint)))];
      q=addPaint(q,paint,amount);return path;
    });});
  },[attempt]);
  const bounds=routeGraphBounds(points,referenceBounds,solution.path,target);
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
    {showSolution&&<>{alternatives.length>0&&<label>Compare a route<select value={example} onChange={e=>{setExample(Number(e.target.value));setStep(0);}}><option value={-1}>{directed?'Intended style · featured route':'Featured route'}</option>{alternatives.map((r,i)=><option key={i} value={i}>{directed&&i<3?['Intended style · ','Fewest additions found · ','Closest paint start · '][i]:''}{r.order.map(p=>attempt.paints[p].name).join(' → ')}</option>)}</select></label>}<button type="button" aria-pressed={inspectExample} onClick={()=>{setInspectExample(!inspectExample);setStep(0);}}>Inspect {inspectExample?'my path':'example'}</button><div className="lab-route-stops">{solution.stops.map((p,i)=><div key={i}><i style={{background:rgbStyle(p.rgb)}}/><span>{i===0?'Start with':`After adding`}<strong>{attempt.paints[exampleOrder[i]].name}</strong></span></div>)}</div><p>Wide outlined line: example, colored by its mixture. Thin line: your route. This example takes {exampleTimes.length} additions; the fewest found for this hole is {attempt.specimen.hole.solutionShots}, excluding the free base. Neither is a required route or a proven minimum.</p></>}
    <p className="lab-muted">These are two projections of the same 3D paths, not aim guides. Screen overlap is not a color match.</p>
    {showSolution&&measurement&&<p className="lab-muted">Measured example: {measurement.meaningfulPours} meaningful pours · {Math.round(measurement.finishWindowMs)} ms full finishing window{measurement.setup?` · ${measurement.setup.successful}/${measurement.setup.cells} nearby setups admit a finish`:''}. {measurement.anticipatory?'Shows measured anticipatory setup.':''} These are local sampled measurements, not a success probability.</p>}
  </div>;
});

function ReviewForm({entry,onSave}:{entry:LabEntry;onSave:(review:LabReview)=>void}) {
  const [form,setForm]=useState<LabReview>(entry.review??{verdict:'',challenge:'',issue:'',note:'',shot:null});
  const [saved,setSaved]=useState(false);
  const experiment=designLabBank.holes.find(h=>h.record.id===entry.attempt.specimen.hole.courseId);
  const directed=directedForHole(entry.attempt.specimen.hole.courseId);
  const field=<K extends keyof LabReview>(key:K,value:LabReview[K])=>{setForm({...form,[key]:value});setSaved(false);};
  return <form className="lab-feedback" onSubmit={e=>{e.preventDefault();onSave(form);setSaved(true);}}>
    <label>Keep the hole overall?<select value={form.verdict} onChange={e=>field('verdict',e.target.value)}><option value="">Choose…</option><option value="keep">Keep</option><option value="revise">Revise</option><option value="reject">Reject</option></select></label>
    <label>Was this particular route worthwhile?<select value={form.routeVerdict??''} onChange={e=>field('routeVerdict',e.target.value)}><option value="">Choose…</option><option value="keep">Yes</option><option value="revise">With changes</option><option value="reject">No</option></select></label>
    {entry.attempt.specimen.comparison&&<label>Compared with your first start<select value={form.comparison??''} onChange={e=>field('comparison',e.target.value)}><option value="">Choose…</option><option value="both-good">Both worthwhile</option><option value="first-better">First start better</option><option value="second-better">This start better</option><option value="neither">Neither worthwhile</option></select></label>}
    {experiment&&!experiment.reference&&<label>After playing both palettes<select value={form.paletteVerdict??''} onChange={e=>field('paletteVerdict',e.target.value)}><option value="">Not compared yet</option><option value="original">Original palette better</option><option value="variant">Substituted palette better</option><option value="both">Both worthwhile</option><option value="neither">Neither worthwhile</option></select></label>}
    {directed&&<><label>Did your route deliver {directed.label.toLowerCase()}?<select value={form.styleExperience??''} onChange={e=>field('styleExperience',e.target.value)}><option value="">Choose…</option><option value="clear">Clearly</option><option value="partial">Somewhat</option><option value="absent">Not really</option></select></label><label>After trying a shorter alternative<select value={form.shortcutVerdict??''} onChange={e=>field('shortcutVerdict',e.target.value)}><option value="">Choose…</option><option value="fun">A worthwhile discovery</option><option value="undermines">Made the hole less interesting</option><option value="not-tried">Not tried yet</option></select></label></>}
    <label>What drove the challenge?<select value={form.challenge} onChange={e=>field('challenge',e.target.value)}><option value="">Choose…</option><option value="paint-choice">Choosing which paints to use</option><option value="setup">Setting up the next pour</option><option value="timing">Timing the finish</option></select></label>
    <label>What hurt it?<select value={form.issue} onChange={e=>field('issue',e.target.value)}><option value="">Nothing / not sure</option><option value="too-close">Too close to a base</option><option value="repetitive">Repetitive</option><option value="visibility">Unclear space</option><option value="correction">Frustrating correction</option><option value="other">Other</option></select></label>
    <label>Attach note to<select value={form.shot??''} onChange={e=>field('shot',e.target.value===''?null:Number(e.target.value))}><option value="">Whole attempt</option>{entry.attempt.shots.map((s,i)=><option key={i} value={i}>Action {i+1}: {entry.attempt.paints[s.paint].name}{s.cancelled?' (cancelled)':''}</option>)}</select></label>
    <label className="lab-note">Your note<textarea maxLength={3000} rows={3} value={form.note} onChange={e=>field('note',e.target.value)} placeholder="What made this route worth keeping—or changing?"/></label>
    <button type="submit">{saved?'Feedback queued ✓':'Save feedback'}</button>
  </form>;
}

export function LabPicker(props:{current:LabSpecimen;onChoose:(s:LabSpecimen)=>void;disabled:boolean}) {
 const {current,onChoose,disabled}=props;
 const [view,setView]=useState('campaign'),[selected,setSelected]=useState(()=>Math.max(0,CAMPAIGN_CHAPTERS.findIndex(c=>c.levelIndex===current.levelIndex)));
 const chapter=CAMPAIGN_CHAPTERS[selected],playable=chapter.slots.filter(s=>s.specimen),at=playable.findIndex(s=>s.id===current.hole.courseId);
 const choose=(id:string)=>{const slot=chapter.slots.find(s=>s.id===id);if(slot?.specimen)onChoose(structuredClone(slot.specimen));};
 return <div className="lab-campaign-picker"><label>Test collection<select value={view} onChange={e=>setView(e.target.value)}><option value="campaign">Campaign · one palette at a time</option><option value="archive">Earlier lab rounds</option></select></label>
 {view==='archive'?<LegacyLabPicker {...props}/>:<>
  <label>Campaign palette<select value={selected} disabled={disabled} onChange={e=>{const i=Number(e.target.value);setSelected(i);const first=CAMPAIGN_CHAPTERS[i].slots.find(s=>s.specimen);if(first?.specimen)onChoose(structuredClone(first.specimen));}}>{CAMPAIGN_CHAPTERS.map((c,i)=><option key={c.id} value={i}>{i+1}. {c.name} · {c.slots.filter(s=>s.specimen).length}/{c.slots.length} candidates</option>)}</select></label>
  <label>Hole in this palette<select disabled={disabled||!playable.length} value={at<0?'':current.hole.courseId} onChange={e=>choose(e.target.value)}>{at<0&&<option value="">Choose a candidate…</option>}{chapter.slots.map((s,i)=><option key={s.id} value={s.id} disabled={!s.specimen}>{i+1}. {s.title}{s.specimen?` · ${s.specimen.hole.notation}`:' · Still to find'}</option>)}</select></label>
  {playable.length>0&&<button type="button" disabled={disabled} onClick={()=>choose(playable[at>=0&&at<playable.length-1?at+1:0].id)}>{at<0?'Start this palette':at<playable.length-1?'Next candidate →':'Replay palette'}</button>}
  <p className="lab-muted">{!playable.length?`No ${chapter.name} candidate is ready yet. The game below remains on your previous hole.`:at>=0?playable[at].note:'Review this palette on its own. Empty slots are planned experiences, not playable holes.'} Free base choice. No unlock requirements or par changes.</p>
  <details><summary>Planned sequence · {chapter.name}</summary><ol>{chapter.slots.map(s=><li key={s.id}><strong>{s.title}</strong> — {s.specimen?'Ready to test':'Still to find'}. {s.note}</li>)}</ol></details>
 </>}
 </div>;
}

function LegacyLabPicker({current,onChoose,disabled}:{current:LabSpecimen;onChoose:(s:LabSpecimen)=>void;disabled:boolean}) {
  const tests=LAB_GROUPS.flatMap(g=>g.items);
  const choose=(s:LabSpecimen)=>onChoose({...s,hole:withLiveLanding(s.hole)});
  const index=tests.findIndex(s=>s.hole.courseId===current.hole.courseId&&s.levelIndex===current.levelIndex);
  const experiment=designLabBank.holes.find(h=>h.record.id===current.hole.courseId);
  const focused=focusedLabBank.holes.find(h=>h.record.id===current.hole.courseId);
  const directed=directedForHole(current.hole.courseId);
  return <><label className="lab-picker">Route & palette lab<select disabled={disabled} value={index} onChange={e=>choose(tests[Number(e.target.value)])}>
    {index<0&&<option value={-1}>Current course hole · {PLAY_LEVELS[current.levelIndex].name}</option>}
    {LAB_GROUPS.map((group,j)=><optgroup key={group.name} label={group.name}>{group.items.map((s,i)=><option key={s.hole.courseId} value={LAB_GROUPS.slice(0,j).reduce((n,g)=>n+g.items.length,0)+i}>{String(i+1).padStart(2,'0')} · {PLAY_LEVELS[s.levelIndex].name} · {directedForHole(s.hole.courseId)?.label??s.hole.kind.replaceAll('-',' ')}{directedForHole(s.hole.courseId)?` · ${directedForHole(s.hole.courseId)!.emphasis==='experience'?'Experience':'Start flexibility'}`:''} · {s.hole.notation}</option>)}</optgroup>)}
  </select></label>{index<tests.length-1&&<button type="button" disabled={disabled} onClick={()=>choose(tests[index+1])}>{index<0?'Start round 9':'Next test →'}</button>}{directed?<p className="lab-muted"><strong>{directed.label} · {directed.emphasis==='experience'?'Experience-led candidate':'Starting-flexibility candidate'}.</strong> {directed.brief} Choose your base freely. Review reveals the intended route and competing shortcuts.</p>:focused?<p className="lab-muted"><strong>{focused.coverage.styleBases.length}/{focused.coverage.total} starts support this style.</strong> {focused.brief} All starts meet route-support checks; choose your base freely.</p>:experiment&&<p className="lab-muted">{experiment.reference?'Reference · ':''}{experiment.brief} Free base choice; the brief is not an instruction to take a particular route.</p>}</>;
}

export function PlayLabPanel({sync,current,onReplay,onReveal}:{sync:ReturnType<typeof usePlayLabSync>;current:LabAttempt|null;onReplay:(specimen:LabSpecimen)=>void;onReveal:()=>void}) {
  const [chosen,setChosen]=useState<string|null>(null),[reviewing,setReviewing]=useState(false);
  const entries=useMemo(()=>labReviewEntries(sync.events,current),[sync.events,current]);
  const entry=selectedLabEntry(entries,current,chosen);
  const same=entry?entries.filter(e=>e.attempt.specimen.hole.courseId===entry.attempt.specimen.hole.courseId&&e.attempt.specimen.levelIndex===entry.attempt.specimen.levelIndex):[];
  const currentId=current?.id;
  const comparison=entry?suggestedComparison(entry.attempt):null;
  const analysis=entry?analysisForHole(entry.attempt.specimen.hole.courseId):undefined;
  const experiment=designLabBank.holes.find(h=>h.record.id===entry?.attempt.specimen.hole.courseId);
  const focused=focusedLabBank.holes.find(h=>h.record.id===entry?.attempt.specimen.hole.courseId);
  const directed=entry?directedForHole(entry.attempt.specimen.hole.courseId):undefined;
  const counterpart=experiment&&!experiment.reference?designLabBank.holes.find(h=>h.pair===experiment.pair&&h.levelIndex!==experiment.levelIndex):undefined;
  const pairedSpecimen=counterpart?LAB_DESIGN.find(s=>s.hole.courseId===counterpart.record.id):undefined;
  return <section className="play-lab-panel" aria-label="Hole design lab">
    <header><div><h2>Hole Lab</h2><p>Repeat the hole. Keep the evidence.</p></div><div className="lab-sync"><span role="status">{sync.status}</span><button type="button" onClick={sync.retry}>Refresh / retry</button></div></header>
    {!sync.signedIn?<p><a href="/signin-with-chatgpt?return_to=%2F%3Fmode%3Dplay%26lab%3D1" target="_top">Sign in with ChatGPT</a> to save private attempts and notes across devices.</p>:<>
      <div className="lab-toolbar"><button type="button" disabled={!entry} onClick={()=>{setReviewing(!reviewing);if(!reviewing)onReveal();}}>{reviewing?'Hide review':'Reveal route analysis'}</button><button type="button" onClick={sync.exportFile}>Export backup</button><label className="lab-import">Import backup<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void sync.importFile(file);e.target.value='';}}/></label></div>
      <p className="lab-muted">Campaign draft: test one palette at a time. UltraOx has a complete three-candidate sequence; other chapters expose established candidates and clearly marked gaps. Earlier rounds remain available. Pigments, controls and par are unchanged; campaign tests use the current landing setting.</p>
      {current?.specimen.comparison&&<p className="lab-paired" role="status">Comparison attempt: try <strong>{current.paints[current.specimen.comparison.base].name}</strong> as your base. You remain free to choose otherwise.</p>}
      {entries.length>0&&<label className="lab-history">Attempt<select value={entry?.attempt.id??''} onChange={e=>{setChosen(e.target.value);setReviewing(true);onReveal();}}>{entries.map((e,i)=><option key={e.attempt.id} value={e.attempt.id}>{e.attempt.id===currentId?'Current · ':''}{PLAY_LEVELS[e.attempt.specimen.levelIndex].name} · {e.attempt.specimen.hole.notation} · {e.attempt.outcome} · {new Date(e.attempt.started).toLocaleString()} · {entries.length-i}</option>)}</select><button type="button" onClick={()=>{setChosen(null);setReviewing(true);onReveal();}}>Current attempt</button></label>}
      {reviewing&&entry&&<div className="lab-review" key={entry.attempt.id}>
        <div className="lab-review-heading"><h3>{PLAY_LEVELS[entry.attempt.specimen.levelIndex].name} · {entry.attempt.specimen.hole.notation}</h3><button type="button" onClick={()=>{onReplay(entry.attempt.specimen);setChosen(null);setReviewing(false);}}>Replay this exact hole ↗</button></div>
        <p>{entry.attempt.specimen.hole.courseId} · {entry.attempt.engine} · {entry.attempt.specimen.comparison?'Suggested-base comparison':entry.attempt.revealed?'Analysis revealed':'Unassisted attempt'}</p>
        <p>Design intent: {campaignForHole(entry.attempt.specimen.hole.courseId)?.slot.title??entry.attempt.specimen.hole.kind.replaceAll('-',' ')}. This describes the test—not a required starting paint or route.</p>
        {directed&&<p className="lab-muted">Original selection measurements: style opportunity from {directed.coverage.availableBases.length}/{directed.analysis.bases.length} starting paints; survives every retained efficient alternative from {directed.coverage.robustBases.length}/{directed.analysis.bases.length} starts. These archived labels are not updated finish classifications. Search is sampled; alternatives may overlap in style.</p>}
        <FinishProfileReview id={entry.attempt.specimen.hole.courseId}/>
        {focused&&<p className="lab-muted">Style coverage: {focused.coverage.styleBases.length}/{focused.coverage.total} starting paints have a supported efficient route of this style. For {focused.coverage.easiestStyleBases.length}/{focused.coverage.total}, the retained route with the widest finishing window also has this style. These are sampled route measurements, not predictions of which start you will prefer.</p>}
        <p className="lab-muted">Landing tolerance: {entry.attempt.specimen.hole.tolerance.toFixed(4)}. Exact replays retain this setting. The spherical outline is a visual marker, not the exact scoring boundary.{analysis&&'tolerance' in analysis?' Route measurements use the stored analysis tolerance; see the value below.':entry.attempt.specimen.hole.tolerance!==LANDING_TOLERANCE?' Archived route measurements and par use the original 0.028 tolerance.':''}</p>
        {analysis&&'tolerance' in analysis&&<p className="lab-muted">Analysis tolerance: {analysis.tolerance.toFixed(4)}{analysis.tolerance===entry.attempt.specimen.hole.tolerance?' · matches this attempt.':' · differs from this replay; archived measurements are not recalibrated.'}</p>}
        {pairedSpecimen&&<div className="lab-paired"><p>{experiment?.brief} Compare with <strong>{PLAY_LEVELS[pairedSpecimen.levelIndex].name}</strong>.</p><button type="button" onClick={()=>{onReplay(pairedSpecimen);setChosen(null);setReviewing(false);}}>Try paired palette ↗</button></div>}
        {comparison&&<div className="lab-paired"><p>Compare the same target from <strong>{PLAY_LEVELS[comparison.levelIndex].paints[comparison.comparison!.base].name}</strong>. Choose that base yourself; other paints remain available.</p><button type="button" onClick={()=>{onReplay(comparison);setChosen(null);setReviewing(false);}}>Replay with suggested start ↗</button></div>}
        {analysis&&<details className="lab-base-analysis"><summary>Starting-choice measurements</summary><p>{analysis.qualifyingBases.length}/{analysis.bases.length} starts meet provisional route-quality checks. {analysis.robustThree?'Three additions found from every base; no one- or two-addition solution found.':''} This predicts candidates, not enjoyment.</p><div className="lab-base-scroll"><table><thead><tr><th>Base</th><th>Additions found</th><th>Shortest travel</th><th>Measured support</th>{focused&&<th>Intended style</th>}</tr></thead><tbody>{analysis.bases.map(b=><tr key={b.base}><td>{entry.attempt.paints[b.base].name}</td><td>{b.fewestFound??'Not found'}</td><td>{b.minimumTravel?.toFixed(1)??'—'}</td><td>{b.qualifies?'Supported':'Uncertain'}</td>{focused&&<td>{focused.coverage.styleBases.includes(b.base)?'Found':'Not found'}</td>}</tr>)}</tbody></table></div><p>Travel is in display-world units. Search is sampled, not exhaustive. Setup tests vary earlier release times within ±0.18 seconds and search for a successful finish; they do not prove global difficulty.</p></details>}
        <div className="lab-comparison">{same.map((e,i)=>{const shots=e.attempt.shots.filter(s=>!s.cancelled),last=shots.at(-1),error=last?colorDistance(mixtureColor(PLAY_LEVELS[e.attempt.specimen.levelIndex].paints,last.after),e.attempt.specimen.hole.target)/e.attempt.specimen.hole.tolerance:null;return <button type="button" key={e.attempt.id} aria-pressed={entry.attempt.id===e.attempt.id} onClick={()=>setChosen(e.attempt.id)}><strong>Attempt {same.length-i}</strong><span>{Math.max(0,shots.length-1)} pours · {last?totalMass(last.after).toFixed(2):0} parts</span><span>{error===null?'No base yet':`${error.toFixed(2)} × tolerance`} · {e.attempt.outcome}</span></button>;})}</div>
        <RouteReview key={entry.attempt.id} entry={entry}/>
      </div>}
      {entry&&<div className="lab-review"><h3>Feedback · {PLAY_LEVELS[entry.attempt.specimen.levelIndex].name}</h3><p className="lab-muted">For this palette: did this hole fit its position, feel different from the previous one, and stay worthwhile from your chosen base? Add those observations to your note.</p><ReviewForm key={entry.attempt.id} entry={entry} onSave={review=>sync.save({id:crypto.randomUUID(),attemptId:entry.attempt.id,type:'review',review})}/></div>}
    </>}
  </section>;
}
