'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {AtlasCase,AtlasNode} from './types';
import Space from './space';
import {canonical,changeFraction,displayLab,distance,exactKey,labToLch,lchToLab,nodeRoute,replay,type LiveInput,type LiveResult} from './live-model';
const css=(rgb:number[])=>`rgb(${rgb.map(Math.round).join(' ')})`;
function Slider({label,value,min=0,max=1,step=.001,onChange,format}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(n:number)=>void;format?:(n:number)=>string}){
 return <label className="atlas-slider"><span>{label}<output>{format?format(value):`${(value*100).toFixed(1)}%`}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
export default function Workspace({data}:{data:AtlasCase}){
 const initial=()=>({...nodeRoute(data.nodes,data.defaultNode),target:[...data.target.lab]});
 const [input,setInput]=useState<LiveInput>(initial),[depth,setDepth]=useState(3),[field,setField]=useState(true),[auto,setAuto]=useState(true),[selected,setSelected]=useState(data.defaultNode),[result,setResult]=useState<LiveResult|null>(null),[cache,setCache]=useState<Map<string,LiveResult>>(()=>new Map()),[workerError,setWorkerError]=useState('');
 const [regionCache,setRegionCache]=useState<Map<string,AtlasNode[]>>(()=>new Map());
 const worker=useRef<Worker|null>(null),request=useRef(0),autoRef=useRef(auto),inputRef=useRef(input);
 const key=exactKey(data,input),trace=useMemo(()=>replay(data.paints,input.start,input.legs,input.target,data.tolerance),[data,input]);
 const current=cache.get(key)??(result?.key===key?result:null),done=current?.phase==='done',cached=current?.cacheHit||(cache.has(key)&&result?.key!==key),targetOriginal=distance(input.target,data.target.lab)<1e-12;
 const nodes=targetOriginal?data.nodes:(regionCache.get(JSON.stringify(input.target))??current?.nodes??[]),target=displayLab(input.target),start=trace.states[0],lch=labToLch(input.target);
 const known=data.knownRoutes.find(r=>r.node===selected),original=known&&targetOriginal&&distance(input.start,data.nodes[selected].recipe)<1e-12;
 const unchangedRoute=original&&JSON.stringify(input.legs)===JSON.stringify(nodeRoute(data.nodes,selected).legs);
 useEffect(()=>{autoRef.current=auto;inputRef.current=input;},[auto,input]);
 useEffect(()=>{
  let w:Worker;
  try{w=new Worker(new URL('./live.worker.ts',import.meta.url),{type:'module'});}catch{queueMicrotask(()=>setWorkerError('Background search is unavailable. Live route editing still works.'));return;}
  worker.current=w;w.postMessage({type:'init',data});
  w.onmessage=(event:MessageEvent<{id:number;result?:LiveResult;error?:string}>)=>{
   if(event.data.id!==request.current)return;
   if(event.data.error){setWorkerError('The background search could not finish. Live controls still work.');return;}
   const r=event.data.result!;setResult(r);
   if(r.nodes.length)setRegionCache(old=>{const k=JSON.stringify(r.target);if(old.get(k)===r.nodes)return old;const next=new Map(old);next.delete(k);next.set(k,r.nodes);while(next.size>32)next.delete(next.keys().next().value!);return next;});
   if(r.phase==='done')setCache(old=>{const next=new Map(old);next.delete(r.key);next.set(r.key,r);while(next.size>48)next.delete(next.keys().next().value!);return next;});
   if(autoRef.current&&r.best&&r.shortest!==null)setInput(previous=>exactKey(data,previous)===r.key?{...previous,legs:r.best!}:previous);
  };
  w.onerror=()=>setWorkerError('Background search is unavailable. Live route editing still works.');
  return()=>{worker.current=null;w.terminate();};
 },[data]);
 // No debounce: queue the latest position immediately. Superseded worker jobs
 // yield and cancel; results from an older request cannot overwrite this one.
 useEffect(()=>{const id=++request.current;worker.current?.postMessage({type:'query',id,input:inputRef.current});},[key]);
 const choose=(id:number)=>{const route=nodeRoute(nodes,id);setSelected(targetOriginal?id:-1);setInput(p=>({...p,...route}));setDepth(d=>Math.max(d,route.legs.length));};
 const reset=()=>{setInput(initial());setSelected(data.defaultNode);setAuto(true);setWorkerError('');};
 const editLeg=(i:number,share:number)=>{autoRef.current=false;setAuto(false);setInput(p=>({...p,legs:p.legs.map((l,j)=>i===j?{...l,share}:l)}));};
 const adopt=()=>{if(current?.best)setInput(p=>({...p,legs:current.best!}));};
 const routeStatus=trace.capture===0?'Start is already inside the landing region':trace.capture!==null&&trace.capture<input.legs.length?`Would finish after leg ${trace.capture} · later legs are unnecessary`:trace.error<=data.tolerance?'This route lands':'This route misses';
 return <>
  <div className="atlas-live-toolbar"><label>Reveal<select value={depth} onChange={e=>setDepth(Number(e.target.value))}><option value={0}>Landing region</option><option value={1}>One-leg finishes</option><option value={2}>Two-leg setups</option><option value={3}>Three-leg approaches</option></select></label><label className="atlas-check"><input type="checkbox" checked={field} onChange={e=>setField(e.target.checked)}/>Palette field</label><button onClick={reset}>Reset study</button></div>
  <div className="atlas-workspace"><section className="atlas-stage"><Space data={data} nodes={nodes} depth={depth} field={field} target={input.target} targetRGB={target.rgb} trace={trace} onSelect={choose}/><div className="atlas-target"><i style={{background:css(target.rgb)}}/><span>Destination<small>L {input.target[0].toFixed(3)} · C {lch[1].toFixed(3)}</small></span></div>
   <div className="atlas-live-status" data-lands={trace.capture!==null}><strong>{routeStatus}</strong><span>Endpoint distance {(trace.error/data.tolerance).toFixed(2)}× tolerance</span></div>
   <p className="atlas-coverage">{!targetOriginal&&!nodes.length?'No current region samples to show; old destination points are hidden.':'Points are sampled recipes, not filled proven regions.'} Layers are available paths—not required legs.</p>
   <div className="atlas-live-controls"><section><h2>Starting mixture</h2><div className="atlas-control-chip"><i style={{background:css(start.rgb)}}/><span>Other pigments rebalance proportionally.</span></div>{data.paints.map((p,i)=><Slider key={p.id} label={p.name} value={input.start[i]} onChange={v=>{setSelected(-1);setInput(s=>({...s,start:changeFraction(s.start,i,v)}));}}/>)}</section>
    <section><h2>Destination</h2><Slider label="Lightness" value={lch[0]} onChange={v=>setInput(p=>({...p,target:lchToLab([v,lch[1],lch[2]])}))}/><Slider label="Chroma" value={lch[1]} max={.4} format={v=>v.toFixed(3)} onChange={v=>setInput(p=>({...p,target:lchToLab([lch[0],v,lch[2]])}))}/><Slider label="Hue" value={lch[2]} max={360} step={.1} format={v=>`${v.toFixed(1)}°`} onChange={v=>setInput(p=>({...p,target:lchToLab([lch[0],lch[1],v])}))}/><p className="atlas-secondary">Exact OKLab target. {target.clipped?'The chip is display-clipped; scoring still uses the exact target.':'Reachability is checked against this palette.'}</p>{current?.phase!=='warm'&&current?.closestError!==undefined&&<p className="atlas-secondary">{current.landingRecipe?'A palette recipe reaches this destination.':`No accepted recipe found yet; closest sampled fit ${(current.closestError/data.tolerance).toFixed(2)}× tolerance. Not an impossibility proof.`}</p>}</section></div>
  </section>
  <aside className="atlas-inspector"><h2>Live route</h2><div className="atlas-readout"><strong>{canonical(input.legs).length}</strong><span>pigment legs shown</span></div>
   <label className="atlas-check"><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);if(e.target.checked)adopt();}}/>Follow fitted solution</label><p className="atlas-secondary">Edit a leg to keep your own route. Fitting may change pigment order.</p>
   <div className="atlas-search-status" role="status">{workerError||(!current?'Checking changed settings…':`${cached?'Cached · ':''}${done?'Search complete':'Searching alternatives…'}`)}<small>{current?.shortest!==null&&current?.shortest!==undefined?`Shortest found: ${current.shortest} legs. `:'No successful route found yet. '}{done?'Bounded search through three legs—not a proven minimum.':'Difficulty evidence is still updating.'}</small></div>
   {current?.best&&<button className="atlas-adopt" onClick={adopt}>Use best found route</button>}
   <label>Banked approaches<select value={known&&original?selected:''} onChange={e=>{const id=Number(e.target.value);setSelected(id);setInput({...nodeRoute(data.nodes,id),target:[...data.target.lab]});}}><option value="" disabled>Choose an audited original</option>{data.knownRoutes.map((r,i)=><option key={r.node} value={r.node}>Approach {i+1} · {data.paints[data.nodes[r.node].paint!].name}</option>)}</select></label>
   <ol className="atlas-route atlas-editable-route">{input.legs.map((leg,i)=><li key={i}><div className="atlas-control-chip"><i style={{background:css(trace.states[i].rgb)}}/><span>{i+1}. {data.paints[leg.paint].name}</span></div><Slider label="Incoming fraction" value={leg.share} max={.999999} onChange={v=>editLeg(i,v)}/></li>)}</ol>
   <div className="atlas-control-chip"><i style={{background:css(trace.states.at(-1)!.rgb)}}/><span>Route endpoint</span></div>
   {original&&<p className="atlas-secondary">Original-start audit: shortest found {known.minimum}; region-supported {known.regionMinimum}. Those findings are not transferred to edited starts or targets.</p>}
   {original&&current?.shortest!==null&&current?.shortest!==undefined&&known.minimum!==null&&current.shortest<known.minimum&&<p className="atlas-secondary">A shorter route was found than the stored audit. The live route is a counterexample to that older count.</p>}
   {unchangedRoute&&<details><summary>Original route evidence</summary><p className="atlas-secondary">Observed traits: {known.styles.join(', ').replaceAll('-',' ')}. These apply to this example, not every route.</p>{data.nodes[selected].shareWindow&&<p className="atlas-secondary">Sampled first-addition interval: {data.nodes[selected].shareWindow!.map(v=>(100*v).toFixed(1)).join('–')}%, later additions fixed. Not a timing window.</p>}</details>}
  </aside></div>
  <section className="atlas-palette"><h2>Available pigments</h2><div>{data.paints.map(p=><span key={p.id}><i style={{background:css(p.rgb)}}/>{p.name}</span>)}</div></section>
  <details className="atlas-method"><summary>Live checks, caching and limits</summary><p>Every route update is replayed with the game’s original-pigment spectral mixer. Fractions are composition controls—not hold durations. Moving a destination never silently snaps it to a reachable substitute. Live checks concern leg endpoints; passing through the region during a leg does not by itself count as a landing.</p><p>Up to 48 completed queries are cached for this visit. Nearby results provide initial guesses and are checked again. Changed settings invalidate old search claims immediately. Background searches test pigment subsets through three legs and rebuild sampled inverse branches. They are bounded numerical searches, not exhaustive proofs; live results do not certify timing, setup-region robustness or style.</p></details>
 </>;
}
