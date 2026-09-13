import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {predecessor} from '../app/play-premix';
import {legReplay,legStep,contributionRecipe,type PigmentLeg} from '../app/play-pigment-legs';
import type {PaintColor} from '../app/paint-mixing';
import {sampleRecipe} from './pigment-leg-proposals';
import {measureLegRegion} from './pigment-leg-metrics';
import type {auditLegPuzzle} from './pigment-leg-audit';
import {ascend} from './premix-hybrid';
import {searchLegEndpoints} from './pigment-leg-search';

// Sample the accepted region's inverse image in recipe coordinates, not a
// sphere in display coordinates. Finite directional sampling is NOT exhaustive.
export function acceptedRecipeCloud(paints:PaintColor[],center:number[],random:()=>number,count=24){
 const target=mixtureColor(paints,center),cloud=[center];
 for(let i=0;i<count;i++){
  const other=sampleRecipe(paints.length,random);let lo=0,hi=1;
  // Find the first connected exit along this recipe ray; do not assume global
  // monotonicity or silently include later disconnected accepted components.
  for(let j=1;j<=32;j++){const t=j/32,q=center.map((v,k)=>v*(1-t)+other[k]*t);if(colorDistance(mixtureColor(paints,q),target)>T){hi=t;break;}lo=t;}
  for(let k=0;k<20&&hi>lo;k++){const t=(lo+hi)/2,q=center.map((v,j)=>v*(1-t)+other[j]*t);if(colorDistance(mixtureColor(paints,q),target)<=T)lo=t;else hi=t;}
  const t=lo*(.2+.7*random()),q=center.map((v,j)=>v*(1-t)+other[j]*t);
  if(colorDistance(mixtureColor(paints,q),target)<=T)cloud.push(q);
 }return cloud;
}
export function inverseChain(endpoint:number[],depth:number,random:()=>number){
 let start=endpoint;const legs:PigmentLeg[]=[],used=new Set<number>();
 for(let i=0;i<depth;i++){
  const available=start.map((_,p)=>p).filter(p=>!used.has(p)),paint=available[Math.floor(random()*available.length)];
  const share=start[paint]*(.35+.64*random()),before=predecessor(start,paint,share);
  if(!before)return null;used.add(paint);legs.unshift({paint,share});start=before;
 }return{start,legs};
}
export function branchEvidence(a:ReturnType<typeof auditLegPuzzle>){
 const depth=a.summary.robustMinimum;
 // Only shortest region-supported, meaningful routes compete here. Longer
 // demonstrations cannot inflate branch counts. Raw shorter escapes stay visible.
 const routes=a.measured.filter(r=>r.supported&&r.allMeaningful&&r.legs.length===depth);
 const groups=new Map<number,typeof routes>();for(const r of routes){const p=r.legs[0]?.paint;if(p===undefined)continue;groups.set(p,[...(groups.get(p)??[]),r]);}
 const pairs:{firstPaints:number[];separationT:number;finishPaints:number[];routes:PigmentLeg[][]}[]=[];
 const entries=[...groups.entries()];
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
  let best:typeof pairs[number]|null=null;
  for(const x of entries[i][1])for(const y of entries[j][1]){
   const sx=mixtureColor(a.p.paints,legStep(a.p.start,x.legs[0])),sy=mixtureColor(a.p.paints,legStep(a.p.start,y.legs[0]));
   const separationT=colorDistance(sx,sy)/T;
   if(!best||separationT>best.separationT)best={firstPaints:[entries[i][0],entries[j][0]],separationT,finishPaints:[x.legs.at(-1)!.paint,y.legs.at(-1)!.paint],routes:[x.legs,y.legs]};
  }if(best)pairs.push(best);
 }
 return{rawMinimum:a.summary.rawMinimum,regionMinimum:depth,firstPaints:[...groups.keys()],pairs,
  shorterRawEscape:a.summary.rawMinimum!==null&&depth!==null&&a.summary.rawMinimum<depth,
  maxSeparationT:Math.max(0,...pairs.map(p=>p.separationT)),unmeasured:a.summary.unmeasured};
}
export function witnessRegion(paints:PaintColor[],start:number[],target:ReturnType<typeof mixtureColor>,legs:PigmentLeg[]){
 const region=measureLegRegion(paints,start,target,legs);
 return{supported:region.supported,meaningful:region.allMeaningful,finishWidth:region.finishWidth,setupCoverage:region.setupCoverage,error:colorDistance(mixtureColor(paints,legReplay(start,legs)),target)};
}

// Optimize a common start and TWO complete branches simultaneously. The target
// and actual pigments stay fixed in this controlled extension. An adversary is
// refreshed between steps so stale shortcuts cannot manufacture progress.
export function refineBranches(paints:PaintColor[],initial:number[],target:ReturnType<typeof mixtureColor>,input:PigmentLeg[][],seed:number){
 const n=initial.length-1,depth=input[0].length;
 const simplex=(z:number[])=>{const y=[...z,0],m=Math.max(...y),v=y.map(x=>Math.exp(x-m)),s=v.reduce((a,b)=>a+b);return v.map(x=>x/s);};
 let start=initial,routes=input,attacks=searchLegEndpoints(paints,start,target,depth-1,seed,48,4).endpoints;
 const decode=(x:number[])=>({start:simplex(x.slice(0,n)),routes:input.map((route,r)=>route.map((l,i)=>({...l,share:x[n+r*depth+i]})))});
 const score=(s:number[],rs:PigmentLeg[][],rivals:typeof attacks)=>{
  const margin=Math.min(4,...rivals.map(e=>colorDistance(mixtureColor(paints,contributionRecipe(s,e.paints,e.weights)),target)/T));
  let penalty=0;for(const legs of rs){
   const error=colorDistance(mixtureColor(paints,legReplay(s,legs)),target)/T;penalty+=30*Math.max(0,error-.65)**2;
   for(const sign of [-1,1]){const varied=legs.map((l,i)=>i===legs.length-1?{...l,share:Math.max(0,Math.min(.999999,l.share+sign*.0125))}:l);const e=colorDistance(mixtureColor(paints,legReplay(s,varied)),target)/T;penalty+=3*Math.max(0,e-1)**2;}
   let q=s;for(const leg of legs){const next=legStep(q,leg),travel=colorDistance(mixtureColor(paints,q),mixtureColor(paints,next))/T;penalty+=2*Math.max(0,1.25-travel)**2;q=next;}
  }
  // Separation is capped: huge detours must not dominate shortcut resistance.
  const separation=colorDistance(mixtureColor(paints,legStep(s,rs[0][0])),mixtureColor(paints,legStep(s,rs[1][0])))/T;
  return margin+.04*Math.min(6,separation)-penalty;
 };
 const history=[];
 for(let round=0;round<5;round++){
  const x=[...start.slice(0,-1).map(v=>Math.log(Math.max(v,1e-10)/Math.max(start.at(-1)!,1e-10))),...routes.flatMap(r=>r.map(l=>l.share))];
  const bounds:[number,number][]=x.map((_,i)=>i<n?[-8,8]:[.00001,.99999]);
  const step=ascend(x=>{const c=decode(x);return score(c.start,c.routes,attacks);},x,bounds,8),trial=decode(step.x);
  const next=searchLegEndpoints(paints,trial.start,target,depth-1,seed+round*337+11,64,6);attacks=[...attacks,...next.endpoints];
  const before=score(start,routes,attacks),after=score(trial.start,trial.routes,attacks);
  const accepted=after>before+1e-8&&trial.routes.every(r=>witnessRegion(paints,trial.start,target,r).supported);
  history.push({round,accepted,before,after,shorterBestT:next.best.map(e=>e.error/T)});
  if(accepted){start=trial.start;routes=trial.routes;}
 }
 return{start,routes,history,regions:routes.map(r=>witnessRegion(paints,start,target,r))};
}
