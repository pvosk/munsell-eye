import {Vector3,Quaternion,Matrix4,CubicBezierCurve3} from 'three';
import {mixtureColor,type ColorPoint} from './play-engine';
import type {PaintColor} from './paint-mixing';
import {easeQuint} from './play-motion';

export const PALETTE_REVEAL_SECONDS=7.2;
export const PALETTE_INTRO_SECONDS=11.2;
export type RevealSample={point:ColorPoint;origin:ColorPoint;phase:number;branch:number};
export type PaletteReveal={seeds:ColorPoint[];bridges:ColorPoint[][];bridgeTimings:{delay:number;duration:number;reverse:boolean}[];samples:RevealSample[];center:Vector3;radius:number;axis:Vector3;turn:number;lobes:number;signature:string};
const cache=new Map<string,PaletteReveal>();
const fieldCache=new WeakMap<PaletteReveal,WeakMap<ColorPoint[],Float32Array>>();
// Visual proximity to sampled pigment mixtures, not an exact reachable-gamut hull.
// Each existing field cell gets an arrival time and a pure-paint emphasis.
export function fieldRevealPlan(reveal:PaletteReveal,points:ColorPoint[]):Float32Array {
  let entries=fieldCache.get(reveal);if(!entries){entries=new WeakMap();fieldCache.set(reveal,entries);}
  const cached=entries.get(points);if(cached)return cached;
  const result=new Float32Array(points.length*2);
  const distance=(a:ColorPoint['position'],b:ColorPoint['position'])=>{const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;};
  const arcs=reveal.bridges.flatMap((path,k)=>path.map((point,i)=>{
    const timing=reveal.bridgeTimings[k],t=timing.reverse?1-i/(path.length-1):i/(path.length-1);
    // Inverse quintic easing makes cell arrival follow the old graph wave.
    let lo=0,hi=1;for(let n=0;n<16;n++){const mid=(lo+hi)/2;if(easeQuint(mid)<t)lo=mid;else hi=mid;}
    return {position:point.position,time:(timing.delay+timing.duration*(lo+hi)/2)*.66};
  }));
  const samples=reveal.samples.map(s=>s.point.position);
  points.forEach((point,i)=>{
    const position=point.position;
    let nearest=Infinity,arcTime=0;
    for(const arc of arcs){const d=distance(position,arc.position);if(d<nearest){nearest=d;arcTime=arc.time;}}
    let paletteDistance=nearest;for(const sample of samples)paletteDistance=Math.min(paletteDistance,distance(position,sample));
    const d=Math.sqrt(paletteDistance),phase=.5+.5*Math.sin(point.position[0]*.53+point.position[1]*.71+point.position[2]*.37);
    result[i*2]=nearest<1.8**2?arcTime: d<2.4?.53+.10*phase:.66+.22*(1-Math.exp(-(d-2.4)/12))+.015*phase;
  });
  // Highlight the nearest actual cells; never add surrogate paint spheres.
  for(const seed of reveal.seeds){let index=0,best=Infinity;points.forEach((point,i)=>{const d=distance(seed.position,point.position);if(d<best){best=d;index=i;}});result[index*2]=0;result[index*2+1]=1;}
  entries.set(points,result);return result;
}
export function paletteReveal(paints:PaintColor[]):PaletteReveal{
  const signature=JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]));
  const cached=cache.get(signature);if(cached)return cached;
  let hash=2166136261;for(const c of signature)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  let state=hash>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const seeds=paints.map((_,i)=>mixtureColor(paints,paints.map((_,j)=>+(j===i))));
  const bridges:ColorPoint[][]=[],pairs:{a:number;b:number;length:number}[]=[];
  for(let i=0;i<paints.length;i++)for(let j=i+1;j<paints.length;j++){
    const path=Array.from({length:49},(_,n)=>mixtureColor(paints,paints.map((_,k)=>k===i?48-n:k===j?n:0)));
    const length=path.slice(1).reduce((sum,p,k)=>sum+new Vector3(...p.position).distanceTo(new Vector3(...path[k].position)),0);
    bridges.push(path);pairs.push({a:i,b:j,length:Math.max(1,length)});
  }
  // A wave travels through the paint graph from one or two seeded origins.
  // Later edges begin at the endpoint reached first, not all at once.
  const arrival=paints.map(()=>Infinity),root=(hash>>>0)%paints.length;
  arrival[root]=0;if(paints.length>3&&(hash&2))arrival[(root+Math.ceil(paints.length/2))%paints.length]=0;
  for(let n=0;n<paints.length;n++)for(const e of pairs){
    arrival[e.b]=Math.min(arrival[e.b],arrival[e.a]+e.length);
    arrival[e.a]=Math.min(arrival[e.a],arrival[e.b]+e.length);
  }
  const extent=Math.max(...pairs.map(e=>Math.min(arrival[e.a],arrival[e.b])+e.length));
  const bridgeTimings=pairs.map(e=>({delay:.12+.64*Math.min(arrival[e.a],arrival[e.b])/extent,duration:.64*e.length/extent,reverse:arrival[e.b]<arrival[e.a]}));
  const center=seeds.reduce((v,p)=>v.add(new Vector3(...p.position)),new Vector3()).divideScalar(seeds.length);
  const radius=Math.max(12,...seeds.map(p=>new Vector3(...p.position).distanceTo(center)));
  const samples:RevealSample[]=[];
  for(let i=0;i<800;i++){
    const q=paints.map(()=>Math.exp((rand()-.5)*5)),dominant=q.indexOf(Math.max(...q));
    samples.push({point:mixtureColor(paints,q),origin:seeds[dominant],phase:rand()*Math.PI*2,branch:dominant});
  }
  const axis=new Vector3(rand()-.5,.25+rand(),rand()-.5).normalize();
  const result={seeds,bridges,bridgeTimings,samples,center,radius,axis,turn:(hash&1?1:-1)*(.7+rand()*.65),lobes:2+((hash>>>3)%4),signature};
  cache.set(signature,result);return result;
}

// Quaternion-inspired unfolding, not a Julia-set claim and not a paint path.
// Decorative positions converge to exact modeled mixtures before fading out.
export function revealPosition(reveal:PaletteReveal,s:RevealSample,progress:number):Vector3{
  const unfold=easeQuint((progress-.14)/.48),rest=new Vector3(...s.point.position),origin=new Vector3(...s.origin.position);
  const radial=rest.clone().sub(reveal.center),envelope=Math.sin(Math.PI*unfold)*(1-unfold);
  const axis=reveal.axis.clone().applyAxisAngle(new Vector3(0,1,0),s.branch*.65);
  const rotation=new Quaternion().setFromAxisAngle(axis,reveal.turn*Math.sin(s.phase+unfold*Math.PI)*envelope*2);
  const folded=radial.clone().applyQuaternion(rotation).sub(radial);
  const curl=axis.clone().cross(radial).normalize().multiplyScalar(reveal.radius*.2*envelope*Math.sin(s.phase*reveal.lobes+unfold*Math.PI));
  return origin.lerp(rest,unfold).add(folded).add(curl);
}

export function planPaletteReveal(reveal:PaletteReveal,rest:Vector3,restLook:Vector3,target:Vector3,aspect:number){
  const up=new Vector3(0,1,0),back=rest.clone().sub(restLook).normalize();
  const direction=back.clone().applyAxisAngle(up,reveal.turn*.28).normalize();
  const right=new Vector3().crossVectors(up,direction).normalize();
  if(right.lengthSq()<.001)right.set(1,0,0);
  const screenUp=new Vector3().crossVectors(direction,right).normalize();
  const tanV=Math.tan(58*Math.PI/360),tanH=tanV*Math.max(.25,aspect);
  // Fit actual projected paint curves instead of the much larger bounding
  // sphere. The camera stays on the playing-view side of the destination.
  const landmarks=[...reveal.bridges.flat().map(p=>new Vector3(...p.position)),target];
  const distance=Math.max(18,...landmarks.map(p=>{
    const d=p.clone().sub(reveal.center);
    return d.dot(direction)+Math.max((Math.abs(d.dot(right))+4)/tanH,(Math.abs(d.dot(screenUp))+4)/tanV);
  }))*1.04;
  const initial=reveal.center.clone().addScaledVector(direction,distance);
  const side=new Vector3().crossVectors(back,up).normalize();
  if(side.lengthSq()<.001)side.set(1,0,0);
  const bow=Math.min(18,distance*.12)*Math.sign(reveal.turn);
  const broad=initial.clone().lerp(rest,.4).addScaledVector(side,bow);
  const approach=rest.clone().addScaledVector(back,Math.min(24,distance*.2)).addScaledVector(side,bow*.3);
  const curve=new CubicBezierCurve3(initial,broad,approach,rest);curve.arcLengthDivisions=500;
  return (progress:number)=>{
    const t=easeQuint(progress),position=curve.getPointAt(t);
    const focus=reveal.center.clone().lerp(target,easeQuint(progress/.48)).lerp(restLook,easeQuint((progress-.63)/.37));
    const quaternion=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,focus,up));
    return {position,quaternion};
  };
}

export function bridgeRevealRange(timing:PaletteReveal['bridgeTimings'][number],progress:number){
  const count=Math.floor(easeQuint((progress-timing.delay)/timing.duration)*48)*6;
  return {start:timing.reverse?48*6-count:0,count};
}
