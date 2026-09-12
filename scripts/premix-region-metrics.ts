import {PLAY_LEVELS,mixtureColor,colorDistance,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE as T,type Mixture,type ColorPoint} from '../app/play-engine';
import {premixReplay,premixRoute,holdForShare,premixStep} from '../app/play-premix';
import type {PremixControl} from './premix-search';

export const FAMILIES=['rise','drop','chromatic-ride','setup-glide','coupled-balance','interior-assembly'] as const;
export type Family=typeof FAMILIES[number];
export const METRIC_VERSION='premix-regions-1';
const norm=(a:number[])=>Math.hypot(...a);
const delta=(a:number[],b:number[])=>a.map((x,i)=>x-b[i]);

// Geometry in scoring space, never projected world length or animation distance.
export function geometry(level:number,start:Mixture,target:ColorPoint,r:PremixControl){
 const paints=PLAY_LEVELS[level].paints,path=premixRoute(paints,start,r.order,r.times,'normalized');
 const changes=path.stops.slice(1).map((p,i)=>delta(p.lab,path.stops[i].lab));
 const lengths=path.strokes.map(s=>s.slice(1).reduce((sum,p,i)=>sum+colorDistance(p,s[i]),0));
 const finish=lengths.at(-1)??0,setup=lengths.slice(0,-1).reduce((a,b)=>a+b,0),d=changes.at(-1)??[0,0,0];
 let chromaticLength=0;
 const last=path.strokes.at(-1)??[];
 last.slice(1).forEach((p,i)=>{if(Math.min(norm(p.lab.slice(1)),norm(last[i].lab.slice(1)))>=.085)chromaticLength+=colorDistance(p,last[i]);});
 const meaningful=changes.filter(x=>norm(x)>=T*1.25).length;
 // Does deleting an action, retaining all other controls, still land? This is a
 // counterexample, not proof that an action cannot be optimized away.
 const deletionErrors=r.order.map((_,i)=>colorDistance(mixtureColor(paints,premixReplay(start,r.order.filter((_,j)=>i!==j),r.times.filter((_,j)=>i!==j),'normalized')),target));
 let mergeable=0;
 for(let i=1;i<r.order.length;i++)if(r.order[i]===r.order[i-1]){
  const pure=Array(paints.length).fill(0);pure[(r.order[i]+1)%paints.length]=1;
  const q=premixReplay(pure,[r.order[i],r.order[i]],[r.times[i-1],r.times[i]],'normalized');
  if(holdForShare(1,q[r.order[i]],'normalized')!==null)mergeable++;
 }
 const before=path.stops.at(-2)??path.stops[0],after=path.stops.at(-1)!;
 const initialDistance=colorDistance(path.stops[0],target),maxDistance=Math.max(...path.stops.map(p=>colorDistance(p,target)));
 const beforeValue=Math.abs(before.lab[0]-target.lab[0]),afterValue=Math.abs(after.lab[0]-target.lab[0]);
 const beforeAB=norm(delta(before.lab.slice(1),target.lab.slice(1))),initialAB=norm(delta(path.stops[0].lab.slice(1),target.lab.slice(1)));
 // Concrete competing-property evidence: a setup improves value while worsening
 // hue/chroma residual (or vice versa), and the finish repairs that residual.
 const tradeoffs=path.stops.slice(1,-1).map((p,i)=>{
  const a=path.stops[i],dv=Math.abs(a.lab[0]-target.lab[0])-Math.abs(p.lab[0]-target.lab[0]);
  const dc=norm(delta(a.lab.slice(1),target.lab.slice(1)))-norm(delta(p.lab.slice(1),target.lab.slice(1)));
  return Math.max(Math.min(dv,-dc),Math.min(-dv,dc));
 });
 const tradeoff=Math.max(0,...tradeoffs),finalABGain=beforeAB-norm(delta(after.lab.slice(1),target.lab.slice(1)));
 const allMeaningful=meaningful===r.order.length&&mergeable===0&&deletionErrors.every(e=>e>T);
 const setupPresent=r.order.length>=2&&setup>=.045&&allMeaningful;
 const valueFinish=setupPresent&&Math.abs(d[0])>=.075&&Math.abs(d[0])/Math.max(norm(d),1e-12)>=.75&&Math.abs(d[0])>=Math.max(...changes.slice(0,-1).map(x=>Math.abs(x[0])))*1.1&&beforeValue-afterValue>=.055;
 const traits:Record<Family,boolean>={
  rise:valueFinish&&d[0]>0,drop:valueFinish&&d[0]<0,
  'chromatic-ride':setupPresent&&finish>=.14&&chromaticLength/Math.max(finish,1e-12)>=.7&&norm(d.slice(1))>=.055,
  'setup-glide':setupPresent&&finish>=.12&&finish>=Math.max(...lengths.slice(0,-1))*1.15&&norm(d.slice(1))>=.035,
  'coupled-balance':setupPresent&&tradeoff>=.012&&Math.abs(d[0])>=.03&&norm(d.slice(1))>=.03&&finalABGain>=.015,
  'interior-assembly':allMeaningful&&r.order.length>=3&&norm(target.lab.slice(1))<.12,
 };
 return {lengths,finish,setup,meaningful,allMeaningful,mergeable,deletionErrors,value:d[0],ab:norm(d.slice(1)),chromaticFraction:chromaticLength/Math.max(finish,1e-12),tradeoff,initialAB,initialDistance,excursion:Math.max(0,maxDistance-initialDistance),traits};
}

export function acceptedIntervals(success:(t:number)=>boolean,steps=512){
 const intervals:{lo:number;hi:number}[]=[];const dt=CHARGE_SECONDS/steps;
 let open:number|null=null;
 const edge=(a:number,b:number)=>{const sa=success(a);for(let k=0;k<14;k++){const m=(a+b)/2;if(success(m)===sa)a=m;else b=m;}return(a+b)/2;};
 let previous=success(0);if(previous)open=0;
 for(let i=1;i<=steps;i++){const t=i*dt,current=success(t);if(current&&!previous)open=edge(t-dt,t);if(!current&&previous){intervals.push({lo:open!,hi:edge(t-dt,t)});open=null;}previous=current;}
 if(open!==null)intervals.push({lo:open,hi:CHARGE_SECONDS});return intervals;
}
export function measureRegion(level:number,start:Mixture,target:ColorPoint,r:PremixControl){
 const paints=PLAY_LEVELS[level].paints,g=geometry(level,start,target,r);
 const success=(times:number[])=>colorDistance(mixtureColor(paints,premixReplay(start,r.order,times,'normalized')),target)<=T;
 const intervals=acceptedIntervals(t=>success([...r.times.slice(0,-1),t]));
 const local=intervals.find(w=>r.times.at(-1)!>=w.lo-1e-6&&r.times.at(-1)!<=w.hi+1e-6);
 const finishWindowMs=local?(local.hi-local.lo)*1000:0;
 // Distinct, unclipped tensor samples across ALL setup controls, not only first.
 const axes=r.times.slice(0,-1).map(t=>Array.from({length:9},(_,i)=>Math.max(0,t-.22)+(Math.min(CHARGE_SECONDS,t+.22)-Math.max(0,t-.22))*i/8));
 const setups:number[][]=[];const walk=(q:number[])=>{if(q.length===axes.length){setups.push(q);return;}for(const t of axes[q.length])walk([...q,t]);};walk([]);
 let accepted=0;for(const q of setups){if(Array.from({length:129},(_,i)=>i*CHARGE_SECONDS/128).some(t=>success([...q,t])))accepted++;}
 // Fixed-control jitter is a separate measure, not the reoptimized setup slice.
 let recovered=0,count=0;for(let i=0;i<r.times.length;i++)for(const s of [-1,1]){const t=[...r.times];t[i]=Math.max(0,Math.min(CHARGE_SECONDS,t[i]+s*.0275));count++;if(success(t))recovered++;}
 return {...r,...g,intervals,finishWindowMs,setupCoverage:accepted/setups.length,setupCells:setups.length,jitterSurvival:recovered/Math.max(1,count),supported:finishWindowMs>=55&&accepted/setups.length>=.04};
}

// The target is deliberately the same for every route. Never feed style into
// the numerical challenger; only classify its returned controls afterward.
export function classifyAlternatives(family:Family,rows:ReturnType<typeof measureRegion>[],featured:ReturnType<typeof measureRegion>){
 const all=[featured,...rows],rawMinimum=Math.min(...all.map(r=>r.order.length));
 const supported=all.filter(r=>r.supported),timingMinimum=supported.length?Math.min(...supported.map(r=>r.order.length)):null;
 const efficient=supported.filter(r=>r.order.length===timingMinimum),matching=efficient.filter(r=>r.traits[family]);
 return {rawMinimum,timingMinimum,efficientRoutes:efficient.length,styleRoutes:matching.length,
  status:matching.length?(matching.length===efficient.length?'required-in-tested-routes':'competitive'):'available',
  bypasses:efficient.filter(r=>!r.traits[family]).map(r=>({order:r.order,times:r.times,error:r.error})),
 };
}
