'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {AtlasCase,AtlasNode} from './types';
import './atlas.css';
type Index={cases:{id:string;name:string;request:string;url:string}[];notes:string[]};
const titles:Record<string,string>={'light-rise':'Light destination','dark-drop':'Dark destination','mid-balance':'Middle-value balance','vivid-ride':'Chromatic destination','fixed-hansa':'Shared target · Hansa study','fixed-ryb':'Shared target · RYB study'};
const css=(rgb:number[])=>`rgb(${rgb.map(v=>Math.round(v)).join(' ')})`;
const position=(lab:number[])=>new THREE.Vector3(lab[1]*2,(lab[0]-.5)*2,lab[2]*2);
function chain(data:AtlasCase,id:number){const result:AtlasNode[]=[];let node=data.nodes[id];while(node){result.push(node);if(node.parent===null)break;node=data.nodes[node.parent];}return result;}

function Space({data,depth,field,selected,onSelect}:{data:AtlasCase;depth:number;field:boolean;selected:number;onSelect:(n:number)=>void}){
 const host=useRef<HTMLDivElement>(null),select=useRef(onSelect),view=useRef<{id:string;p:THREE.Vector3;t:THREE.Vector3}|null>(null);
 useEffect(()=>{select.current=onSelect;},[onSelect]);
 useEffect(()=>{
  const root=host.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{const message=document.createElement('p');message.className='atlas-error';message.textContent='3D rendering is unavailable. You can still inspect the routes below.';root.appendChild(message);return()=>message.remove();}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#202c30');const camera=new THREE.PerspectiveCamera(42,1,.01,30);camera.position.set(1.35,.85,1.8);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(position(data.target.lab).multiplyScalar(.25));if(view.current?.id===data.id){camera.position.copy(view.current.p);controls.target.copy(view.current.t);}controls.enableDamping=false;controls.minDistance=.3;controls.maxDistance=5;controls.enablePan=true;
  const render=()=>renderer.render(scene,camera),resources:(THREE.BufferGeometry|THREE.Material)[]=[];
  const pointCloud=(items:{lab:number[];rgb:number[]}[],size:number,opacity:number)=>{
   const geo=new THREE.BufferGeometry(),positions=items.flatMap(p=>position(p.lab).toArray()),colors=items.flatMap(p=>new THREE.Color(css(p.rgb)).toArray());
   geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   const material=new THREE.PointsMaterial({size,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity===1,sizeAttenuation:true});resources.push(geo,material);const points=new THREE.Points(geo,material);scene.add(points);return points;
  };
  if(field)pointCloud(data.field,.009,.22);
  const visible=data.nodes.filter(n=>n.stage>0&&n.stage<=depth&&!n.known),points=pointCloud(visible,.021,.85);
  const path=chain(data,selected).filter(n=>n.stage<=depth);
  for(const n of path){if(!n.arc)continue;const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(n.arc.flatMap(p=>position(p.slice(0,3)).toArray()),3));geo.setAttribute('color',new THREE.Float32BufferAttribute(n.arc.flatMap(p=>new THREE.Color(css(p.slice(3))).toArray()),3));const material=new THREE.LineBasicMaterial({vertexColors:true});resources.push(geo,material);scene.add(new THREE.Line(geo,material));}
  const sphere=(lab:number[],rgb:number[],radius:number,wire=false)=>{const geo=new THREE.SphereGeometry(radius,20,12),material=new THREE.MeshBasicMaterial({color:wire?'#f0eee2':css(rgb),wireframe:wire,transparent:wire,opacity:wire?.35:1});resources.push(geo,material);const mesh=new THREE.Mesh(geo,material);mesh.position.copy(position(lab));scene.add(mesh);};
  sphere(data.target.lab,data.target.rgb,.027);sphere(data.target.lab,data.target.rgb,data.tolerance*2,true);
  if(path[0]?.stage){sphere(path[0].lab,path[0].rgb,.022);sphere(path[0].lab,path[0].rgb,.027,true);}
  // Actual OKLab axes, equal geometric scale in all three directions.
  const axes=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1,0),new THREE.Vector3(0,1,0)]),axisMaterial=new THREE.LineBasicMaterial({color:'#76898d',transparent:true,opacity:.28});resources.push(axes,axisMaterial);scene.add(new THREE.Line(axes,axisMaterial));
  const ray=new THREE.Raycaster();ray.params.Points!.threshold=.032;const pointer=new THREE.Vector2();let down=[0,0];
  const start=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};const pick=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(points)[0];if(hit?.index!==undefined)select.current(visible[hit.index].id);};
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',pick);controls.addEventListener('change',render);
  const resize=new ResizeObserver(()=>{const r=root.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();});resize.observe(root);controls.update();render();
  return()=>{view.current={id:data.id,p:camera.position.clone(),t:controls.target.clone()};resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',pick);resources.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();};
 },[data,depth,field,selected]);
 return <div className="atlas-space" ref={host} role="img" aria-label="Interactive 3D OKLab color field with sampled setup states and the selected pigment path"><div className="atlas-space-caption">Drag to orbit · pinch or scroll to zoom · select a point<span>L ↑ · a / b color plane</span></div></div>;
}

export default function ChromaAtlas(){
 const [index,setIndex]=useState<Index|null>(null),[choice,setChoice]=useState(0),[data,setData]=useState<AtlasCase|null>(null),[selected,setSelected]=useState(0),[depth,setDepth]=useState(3),[field,setField]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/atlas/index.json',{signal:c.signal}).then(r=>{if(!r.ok)throw Error('Could not load the atlas index.');return r.json() as Promise<Index>;}).then(setIndex).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 useEffect(()=>{if(!index)return;const c=new AbortController();fetch(index.cases[choice].url,{signal:c.signal}).then(r=>{if(!r.ok)throw Error('Could not load this palette.');return r.json() as Promise<AtlasCase>;}).then(d=>{setData(d);setSelected(d.defaultNode);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[index,choice]);
 const path=useMemo(()=>data?chain(data,selected):[],[data,selected]),known=data?.knownRoutes.find(r=>r.node===selected);
 const select=(id:number)=>{setSelected(id);if(data)setDepth(d=>Math.max(d,data.nodes[id].stage));};
 return <div className="atlas-app">
  <header className="atlas-header"><Link href="/?mode=play" className="atlas-brand">◐ <span>Munsell Eye</span></Link><nav aria-label="App sections"><Link href="/?mode=play">Play</Link><Link href="/sound-lab">Sound Lab</Link><Link href="/chroma-atlas" aria-current="page">Chroma Atlas</Link><details><summary>More</summary><div><Link href="/?mode=practice">Practice</Link><Link href="/?mode=image">Image</Link><Link href="/?mode=mix">Mix</Link><Link href="/?mode=explore">Explore</Link><Link href="/?mode=reference">Reference</Link></div></details></nav></header>
  <main><div className="atlas-title"><h1>Chroma Atlas</h1><p>Destination → finish → setup</p></div>
   <div className="atlas-toolbar"><label>Palette & banked destination<select value={choice} onChange={e=>{setError('');setData(null);setChoice(Number(e.target.value));}} disabled={!index}>{index?.cases.map((c,i)=><option key={c.id} value={i}>{titles[c.request]??c.request} — {c.name}</option>)}</select></label><label>Reveal<select value={depth} onChange={e=>setDepth(Number(e.target.value))}><option value={0}>Destination only</option><option value={1}>One-leg finishes</option><option value={2}>Two-leg setups</option><option value={3}>Three-leg approaches</option></select></label><label className="atlas-check"><input type="checkbox" checked={field} onChange={e=>setField(e.target.checked)}/>Palette field</label></div>
   {error&&<p role="alert">{error} <button onClick={()=>window.location.reload()}>Retry</button></p>}
   {data?<><div className="atlas-workspace"><section className="atlas-stage"><Space data={data} depth={depth} field={field} selected={selected} onSelect={select}/><div className="atlas-target"><i style={{background:css(data.target.rgb)}}/><span>Destination<small>L {data.target.lab[0].toFixed(3)} · C {Math.hypot(...data.target.lab.slice(1)).toFixed(3)}</small></span></div><p className="atlas-coverage">Points are sampled recipes—not filled, proven regions. Layers show available path lengths, not required legs.</p></section>
    <aside className="atlas-inspector"><h2>Selected approach</h2><div className="atlas-readout"><strong>{path.length-1}</strong><span>pigment {path.length===2?'leg':'legs'} in this example</span></div><p>{known?`Shortest found: ${known.minimum}. Region-supported: ${known.regionMinimum}.`:'Generated branch · endpoint replay checked; minimum not evaluated.'}</p>
     <label>Audited approaches<select value={known?selected:''} onChange={e=>select(Number(e.target.value))}><option value="" disabled>Choose an audited route</option>{data.knownRoutes.map((r,i)=><option key={r.node} value={r.node}>Approach {i+1} · {data.paints[data.nodes[r.node].paint!]?.name}</option>)}</select></label>
     <ol className="atlas-route">{path.map((n,i)=><li key={n.id}><button onClick={()=>select(n.id)} aria-current={i===0?'step':undefined}><i style={{background:css(n.rgb)}}/><span>{n.parent===null?'Accepted landing':data.paints[n.paint!].name}<small>{n.parent===null?'Within scoring tolerance':`${(n.share*100).toFixed(1)}% incoming mixture fraction`}</small></span></button></li>)}</ol>
     <details><summary>Starting recipe</summary><ul className="atlas-recipe">{data.paints.map((p,i)=><li key={p.id}><i style={{background:css(p.rgb)}}/>{p.name}<span>{((path[0]?.recipe[i]??0)*100).toFixed(1)}%</span></li>)}</ul></details>
     {path[0]?.shareWindow&&<p>First addition window: <strong>{(path[0].shareWindow[0]*100).toFixed(1)}–{(path[0].shareWindow[1]*100).toFixed(1)}%</strong><small className="atlas-window-note">Sampled connected interval, with later additions held fixed. Not a timing window.</small></p>}
     {known&&<p className="atlas-secondary">Observed traits: {known.styles.join(', ').replaceAll('-',' ')}. These describe this witness, not every successful route.</p>}
    </aside></div>
    <section className="atlas-palette"><h2>Available pigments</h2><div>{data.paints.map(p=><span key={p.id}><i style={{background:css(p.rgb)}}/>{p.name}</span>)}</div></section>
    <details className="atlas-method"><summary>What this view does—and does not—show</summary><p>Every displayed branch retains its original pigment recipe and replays into the accepted destination region. Nearby points can have different future behavior. We have not verified all mixtures between them. Current scoring tolerance is {data.tolerance}; pigment strengths and gameplay are unchanged.</p><p>{data.stats.validatedPaths.toLocaleString()} generated paths were replayed. The selected route shows actual sampled mixing curves. No minimum or difficulty is inferred from a branch layer. Matching “shared target” entries let you compare different palettes without changing the destination.</p></details>
   </>:<p role="status">Loading computed regions…</p>}
  </main>
 </div>;
}
