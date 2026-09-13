'use client';
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import type {AtlasCase,AtlasNode} from './types';
import type {Trace} from './live-model';
const position=(lab:number[])=>new THREE.Vector3(lab[1]*2,(lab[0]-.5)*2,lab[2]*2);
const color=(rgb:number[])=>new THREE.Color(`rgb(${rgb.map(v=>Math.round(v)).join(' ')})`);
type Props={data:AtlasCase;nodes:AtlasNode[];depth:number;field:boolean;target:number[];targetRGB:number[];trace:Trace;onSelect:(node:number)=>void};
export default function Space(props:Props){
 const host=useRef<HTMLDivElement>(null),update=useRef<((p:Props)=>void)|null>(null);
 useEffect(()=>{
  const root=host.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{const message=document.createElement('p');message.className='atlas-error';message.textContent='3D unavailable. The controls and route checks below still work.';root.appendChild(message);return()=>message.remove();}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#202c30');
  const camera=new THREE.PerspectiveCamera(42,1,.01,30);camera.position.set(1.35,.85,1.8);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.minDistance=.3;controls.maxDistance=5;
  const render=()=>renderer.render(scene,camera),content=new THREE.Group();scene.add(content);
  let resources:(THREE.BufferGeometry|THREE.Material)[]=[],points:THREE.Points|null=null,visible:AtlasNode[]=[],onSelect:(id:number)=>void=()=>{},frame=0,next:Props|null=null;
  const sphere=(lab:number[],rgb:number[],radius:number,wire=false)=>{const g=new THREE.SphereGeometry(radius,20,12),m=new THREE.MeshBasicMaterial({color:wire?'#f0eee2':color(rgb),wireframe:wire,transparent:wire,opacity:wire?.35:1});resources.push(g,m);const mesh=new THREE.Mesh(g,m);mesh.position.copy(position(lab));content.add(mesh);};
  const cloud=(items:{lab:number[];rgb:number[]}[],size:number,opacity:number)=>{const g=new THREE.BufferGeometry(),m=new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity,depthWrite:false});g.setAttribute('position',new THREE.Float32BufferAttribute(items.flatMap(p=>position(p.lab).toArray()),3));g.setAttribute('color',new THREE.Float32BufferAttribute(items.flatMap(p=>color(p.rgb).toArray()),3));resources.push(g,m);const mesh=new THREE.Points(g,m);content.add(mesh);return mesh;};
  const draw=(p:Props)=>{
   resources.forEach(r=>r.dispose());resources=[];content.clear();onSelect=p.onSelect;
   if(p.field)cloud(p.data.field,.009,.22);
   visible=p.nodes.filter(n=>n.stage<=p.depth&&!n.known);points=cloud(visible,.02,.8);
   for(const arc of p.trace.arcs){const g=new THREE.BufferGeometry(),m=new THREE.LineBasicMaterial({vertexColors:true});g.setAttribute('position',new THREE.Float32BufferAttribute(arc.flatMap(v=>position(v.slice(0,3)).toArray()),3));g.setAttribute('color',new THREE.Float32BufferAttribute(arc.flatMap(v=>color(v.slice(3)).toArray()),3));resources.push(g,m);content.add(new THREE.Line(g,m));}
   sphere(p.target,p.targetRGB,.025);sphere(p.target,p.targetRGB,p.data.tolerance*2,true);
   p.trace.states.forEach((s,i)=>{sphere(s.lab,s.rgb,i===0?.025:.013);if(i===0)sphere(s.lab,s.rgb,.029,true);});
   const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1,0),new THREE.Vector3(0,1,0)]),m=new THREE.LineBasicMaterial({color:'#76898d',transparent:true,opacity:.25});resources.push(g,m);content.add(new THREE.Line(g,m));render();
  };
  // One renderer/context for the whole visit. Slider updates change geometry
  // at most once per frame without resetting the user's camera or gestures.
  update.current=p=>{next=p;if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(next)draw(next);});};
  const ray=new THREE.Raycaster();ray.params.Points!.threshold=.025;const pointer=new THREE.Vector2();let down=[0,0];
  const start=(e:PointerEvent)=>{down=[e.clientX,e.clientY];},pick=(e:PointerEvent)=>{if(!points||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObject(points)[0];if(hit?.index!==undefined)onSelect(visible[hit.index].id);};
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',pick);controls.addEventListener('change',render);
  const resize=new ResizeObserver(()=>{const r=root.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}});resize.observe(root);controls.update();
  return()=>{update.current=null;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();resources.forEach(r=>r.dispose());renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',pick);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 useEffect(()=>{update.current?.(props);},[props]);
 return <div className="atlas-space" ref={host} role="img" aria-label="Live 3D pigment routes and sampled setup regions"><div className="atlas-space-caption">Drag to orbit · pinch or scroll to zoom · select a point<span>L ↑ · a / b color plane</span></div></div>;
}
