import {Vector3,Quaternion,Matrix4,CubicBezierCurve3} from 'three';
import {mixtureColor,type ColorPoint} from './play-engine';
import type {PaintColor} from './paint-mixing';
import {easeQuint} from './play-motion';

export const PALETTE_REVEAL_SECONDS=4.6;
export type RevealSample={point:ColorPoint;origin:ColorPoint;phase:number;branch:number};
export type PaletteReveal={seeds:ColorPoint[];bridges:ColorPoint[][];samples:RevealSample[];center:Vector3;radius:number;axis:Vector3;turn:number;lobes:number;signature:string};
const cache=new Map<string,PaletteReveal>();
export function paletteReveal(paints:PaintColor[]):PaletteReveal{
  const signature=JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]));
  const cached=cache.get(signature);if(cached)return cached;
  let hash=2166136261;for(const c of signature)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  let state=hash>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const seeds=paints.map((_,i)=>mixtureColor(paints,paints.map((_,j)=>+(j===i))));
  const bridges:ColorPoint[][]=[];
  for(let i=0;i<paints.length;i++)for(let j=i+1;j<paints.length;j++)bridges.push(Array.from({length:49},(_,n)=>mixtureColor(paints,paints.map((_,k)=>k===i?48-n:k===j?n:0))));
  const center=seeds.reduce((v,p)=>v.add(new Vector3(...p.position)),new Vector3()).divideScalar(seeds.length);
  const radius=Math.max(12,...seeds.map(p=>new Vector3(...p.position).distanceTo(center)));
  const samples:RevealSample[]=[];
  for(let i=0;i<800;i++){
    const q=paints.map(()=>Math.exp((rand()-.5)*5)),dominant=q.indexOf(Math.max(...q));
    samples.push({point:mixtureColor(paints,q),origin:seeds[dominant],phase:rand()*Math.PI*2,branch:dominant});
  }
  const axis=new Vector3(rand()-.5,.25+rand(),rand()-.5).normalize();
  const result={seeds,bridges,samples,center,radius,axis,turn:(hash&1?1:-1)*(.7+rand()*.65),lobes:2+((hash>>>3)%4),signature};
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

export function planPaletteReveal(reveal:PaletteReveal,end:{position:Vector3;quaternion:Quaternion},aspect:number){
  const up=new Vector3(0,1,0),vertical=58*Math.PI/180,horizontal=2*Math.atan(Math.tan(vertical/2)*Math.max(.25,aspect));
  const distance=(reveal.radius+6)/Math.sin(Math.min(vertical,horizontal)/2)*1.08;
  const direction=new Vector3(.25,.48,1).applyAxisAngle(up,reveal.turn*.9).normalize();
  const initial=reveal.center.clone().addScaledVector(direction,distance);
  const broad=initial.clone().sub(reveal.center).applyAxisAngle(up,reveal.turn*.22).add(reveal.center);
  const tangent=new Vector3(0,0,1).applyQuaternion(end.quaternion);
  const near=end.position.clone().addScaledVector(tangent,Math.min(distance*.2,18));
  const curve=new CubicBezierCurve3(initial,broad,near,end.position);curve.arcLengthDivisions=300;
  const first=new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(initial,reveal.center,up));
  return (progress:number)=>{
    const t=easeQuint((progress-.28)/.72),position=curve.getPointAt(t);
    return {position,quaternion:first.clone().slerp(end.quaternion,t)};
  };
}
