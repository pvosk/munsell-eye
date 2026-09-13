import {mixtureColor,colorDistance,colorPoint,LIVE_LANDING_TOLERANCE as T,type ColorPoint} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {normalizeRecipe} from '../app/play-premix';
import {legReplay,legStep,contributionRecipe,type PigmentLeg} from '../app/play-pigment-legs';
import {sampleRecipe,styleScore} from './pigment-leg-proposals';
import {legGeometry,measureLegRegion,type LegStyle} from './pigment-leg-metrics';
import {searchLegEndpoints,simplexSeeds,optimizeSimplex,permutations} from './pigment-leg-search';
import {ascend} from './premix-hybrid';
import {contributionLegs} from '../app/play-pigment-legs';

export type DestinationSpec={id:string;value:[number,number];chroma:[number,number];style:LegStyle;rgb?:number[]};
const outside=(x:number,[lo,hi]:[number,number])=>Math.max(0,lo-x,x-hi);
export const destinationViolation=(c:ColorPoint,s:DestinationSpec)=>outside(c.lab[0],s.value)+outside(Math.hypot(...c.lab.slice(1)),s.chroma);
export function destinationRecipe(paints:PaintColor[],spec:DestinationSpec,seed:number){
 const fixed=spec.rgb?colorPoint(spec.rgb as [number,number,number]):null;
 const cost=(q:number[])=>{const c=mixtureColor(paints,q);return fixed?colorDistance(c,fixed):destinationViolation(c,spec)+.04*(Math.abs(c.lab[0]-(spec.value[0]+spec.value[1])/2)+Math.abs(Math.hypot(...c.lab.slice(1))-(spec.chroma[0]+spec.chroma[1])/2));};
 const samples=simplexSeeds(paints.length,160,seed).map(q=>({q,error:cost(q)})).sort((a,b)=>a.error-b.error);
 const polished=samples.slice(0,4).map(x=>{const r=optimizeSimplex(cost,x.q,100);return{q:r.weights,error:r.error};});
 const best=[...samples,...polished].sort((a,b)=>a.error-b.error)[0],q=normalizeRecipe(best.q.map(v=>Math.max(1e-5,v))),target=fixed??mixtureColor(paints,q),error=colorDistance(mixtureColor(paints,q),target);
 return{recipe:q,target,error,eligible:fixed?error<T*.8:destinationViolation(target,spec)<1e-8};
}
export function targetCloud(paints:PaintColor[],target:ColorPoint,seedRecipe:number[],random:()=>number,count=16){
 const out:number[][]=[];
 if(colorDistance(mixtureColor(paints,seedRecipe),target)<=T)out.push(seedRecipe);
 for(let i=0;i<count;i++){
  const other=sampleRecipe(paints.length,random);let lo=0,hi=1;
  for(let k=1;k<=32;k++){const t=k/32,q=seedRecipe.map((v,j)=>v*(1-t)+other[j]*t);if(colorDistance(mixtureColor(paints,q),target)>T){hi=t;break;}lo=t;}
  for(let k=0;k<18&&hi>lo;k++){const t=(lo+hi)/2,q=seedRecipe.map((v,j)=>v*(1-t)+other[j]*t);if(colorDistance(mixtureColor(paints,q),target)<=T)lo=t;else hi=t;}
  const t=lo*(.15+.7*random()),q=seedRecipe.map((v,j)=>v*(1-t)+other[j]*t);if(colorDistance(mixtureColor(paints,q),target)<=T)out.push(q);
 }return out;
}
export type ConditionedPuzzle={id:string;paints:PaintColor[];start:number[];target:ColorPoint;targetRecipe:number[];demonstration:PigmentLeg[];spec:DestinationSpec;paletteName:string};
export function refineConditioned(p:ConditionedPuzzle,initialRoutes:PigmentLeg[][],mode:'fixed-target'|'joint',seed:number){
 const n=p.start.length-1,depth=initialRoutes[0].length;
 const logits=(q:number[])=>q.slice(0,-1).map(v=>Math.log(Math.max(v,1e-9)/Math.max(q.at(-1)!,1e-9)));
 const recipe=(z:number[])=>{const y=[...z,0],m=Math.max(...y);return normalizeRecipe(y.map(v=>Math.exp(v-m)));};
 let state={start:p.start,targetRecipe:p.targetRecipe,target:p.target,routes:initialRoutes};
 let attacks=searchLegEndpoints(p.paints,state.start,state.target,depth-1,seed,32,3).endpoints;
 const decode=(x:number[])=>{const targetRecipe=mode==='fixed-target'?p.targetRecipe:recipe(x.slice(n,2*n));return{start:recipe(x.slice(0,n)),targetRecipe,target:mode==='fixed-target'?p.target:mixtureColor(p.paints,targetRecipe),routes:initialRoutes.map((r,j)=>r.map((l,i)=>({...l,share:x[2*n+j*depth+i]})))};};
 const score=(s:typeof state,rivals:typeof attacks)=>{
  const margin=Math.min(4,...rivals.map(e=>colorDistance(mixtureColor(p.paints,contributionRecipe(s.start,e.paints,e.weights)),s.target)/T));
  let penalty=1200*destinationViolation(s.target,p.spec)**2,shape=0;
  for(const legs of s.routes){const g=legGeometry(p.paints,s.start,s.target,legs,24);penalty+=40*Math.max(0,g.error/T-.65)**2;
   penalty+=g.lengths.reduce((sum,d)=>sum+2*Math.max(0,1.25-d/T)**2,0);
   for(const sign of [-1,1]){const r=legs.map((l,i)=>i===depth-1?{...l,share:Math.max(0,Math.min(.99999,l.share+sign*.0125))}:l);const e=colorDistance(mixtureColor(p.paints,legReplay(s.start,r)),s.target)/T;penalty+=3*Math.max(0,e-1)**2;}
   shape+=Math.min(1,styleScore(g,p.spec.style));
  }
  return margin+.12*shape-penalty;
 };
 const history=[];
 for(let round=0;round<4;round++){
  const x=[...logits(state.start),...logits(state.targetRecipe),...state.routes.flatMap(r=>r.map(l=>l.share))],bounds:[number,number][]=x.map((v,i)=>i>=n&&i<2*n&&mode==='fixed-target'?[v,v]:i<2*n?[-10,10]:[.00001,.99999]);
  const opt=ascend(x=>score(decode(x),attacks),x,bounds,5),trial=decode(opt.x);
  const next=searchLegEndpoints(p.paints,trial.start,trial.target,depth-1,seed+round*331+113,48,4);attacks=[...attacks,...next.endpoints];
  const before=score(state,attacks),after=score(trial,attacks),accepted=after>before+1e-8&&destinationViolation(trial.target,p.spec)<1e-8&&trial.routes.every(r=>measureLegRegion(p.paints,trial.start,trial.target,r).supported);
  history.push({round,accepted,before,after,shorterBestT:next.best.map(r=>r.error/T)});if(accepted)state=trial;
 }return{...state,mode,history};
}
// Recovery observations are independent of the proposer score. They are not a
// new filter: archive trivial recovery and missed recovery, not just good cases.
export function recoveryProfile(p:ConditionedPuzzle,routes:PigmentLeg[][],seed:number){
 const cases:any[]=[];for(const [ri,route] of routes.entries()){
  const first=route[0],nominal=legStep(p.start,first);
  const options=[...[-.06,.06].map(d=>({kind:'fraction-offset',paint:first.paint,share:Math.max(.00001,Math.min(.99999,first.share+d))})),...p.paints.map((_,paint)=>({kind:'different-first-pigment',paint,share:first.share})).filter(x=>x.paint!==first.paint)];
  for(const x of options){const q=legStep(p.start,x),distance=colorDistance(mixtureColor(p.paints,q),p.target),search=searchLegEndpoints(p.paints,q,p.target,Math.min(3,p.paints.length-1),seed+ri*137+cases.length,64,6),raw=distance<=T?0:search.best.findIndex(e=>e.error<=T)+1;
   const min=raw===0&&distance>T?null:raw;let supported:number|null=distance<=T?0:null,witness:unknown=null;
   for(const e of search.endpoints.filter(e=>e.error<=T).sort((a,b)=>a.paints.length-b.paints.length).slice(0,12)){
    for(const order of permutations(e.paints)){const r=contributionLegs(e.paints,e.weights,order),m=measureLegRegion(p.paints,q,p.target,r);if(m.supported){supported=supported===null?r.length:Math.min(supported,r.length);witness={legs:r,finishWidth:m.finishWidth,setupCoverage:m.setupCoverage};break;}}
    if(supported!==null)break;
   }
   cases.push({...x,branch:ri,start:q,distanceT:distance/T,displacementT:colorDistance(mixtureColor(p.paints,q),mixtureColor(p.paints,nominal))/T,rawMinimum:min,regionMinimum:supported,witness,bestByDepth:search.best.map(e=>e.error/T)});
  }
 }return{cases,policy:'First-leg fraction offsets ±0.06 and alternative pigments at the same share; finite up-to-three-leg recovery search. Missing recovery is not proof of a dead end. Not human error probabilities.'};
}
