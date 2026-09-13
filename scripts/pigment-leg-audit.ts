import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type Mixture,type ColorPoint} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {canonicalLegs,contributionLegs,legReplay,type PigmentLeg} from '../app/play-pigment-legs';
import {searchLegEndpoints,permutations,challengeLegOrders} from './pigment-leg-search';
import {measureLegRegion,summarizeLegStyles,LEG_METRIC_POLICY} from './pigment-leg-metrics';
export type LegPuzzle={id:string;paints:PaintColor[];start:Mixture;target:ColorPoint;demonstration:PigmentLeg[];provenance?:unknown};
export function auditLegPuzzle(p:LegPuzzle,seed:number,options:{samples?:number;restarts?:number;maxMeasured?:number;fresh?:boolean;maxLegs?:number}={}){
 const demo=canonicalLegs(p.demonstration),maxLegs=options.maxLegs??Math.min(4,Math.max(1,demo.length));
 const search=searchLegEndpoints(p.paints,p.start,p.target,maxLegs,seed,options.samples??96,options.restarts??6);
 const proposals:{legs:PigmentLeg[];source:string}[]=[];
 const add=(legs:PigmentLeg[],source:string)=>{
  legs=canonicalLegs(legs);if(colorDistance(mixtureColor(p.paints,legReplay(p.start,legs)),p.target)>T)return;
  if(!proposals.some(r=>r.legs.length===legs.length&&r.legs.every((l,i)=>l.paint===legs[i].paint&&Math.abs(l.share-legs[i].share)<1e-4)))proposals.push({legs,source});
 };
 if(search.zero<=T)add([],'already-landed');
 // Preserve several distinct accepted recipes per subset. Enumerate ALL orders
 // of each retained recipe; a preferred final pigment never gets privileged.
 const perSubset=new Map<string,number>();
 for(const e of search.endpoints.sort((a,b)=>a.error-b.error))if(e.error<=T){
  const key=e.paints.join();if((perSubset.get(key)??0)>=3)continue;perSubset.set(key,(perSubset.get(key)??0)+1);
  for(const order of permutations(e.paints))add(contributionLegs(e.paints,e.weights,order),e.source);
 }
 add(demo,'demonstration');
 let fresh:ReturnType<typeof challengeLegOrders>|null=null;
 let rawMinimum=proposals.length?Math.min(...proposals.map(r=>r.legs.length)):null;
 if(options.fresh&&rawMinimum!==null&&rawMinimum>1){
  fresh=challengeLegOrders(p.paints,p.start,p.target,rawMinimum-1,seed+180019,256,16);
  for(const r of fresh.routes)if(r.error<=T)add(r.order.map((paint,i)=>({paint,share:r.shares[i]})),'independent-ordered-check');
  rawMinimum=Math.min(...proposals.map(r=>r.legs.length));
 }
 proposals.sort((a,b)=>a.legs.length-b.legs.length||a.legs.map(l=>l.paint).join().localeCompare(b.legs.map(l=>l.paint).join()));
 const maxMeasured=options.maxMeasured??48,selected:typeof proposals=[];
 // Round-robin across orders, then extra recipes. Avoid spending all measurement
 // on one paint ordering. Every unmeasured accepted candidate stays archived.
 const seen=new Set<string>();for(const r of proposals){const key=r.legs.map(l=>l.paint).join();if(!seen.has(key)){seen.add(key);selected.push(r);if(selected.length===maxMeasured)break;}}
 for(const r of proposals)if(selected.length<maxMeasured&&!selected.includes(r))selected.push(r);
 if(!selected.some(r=>r.source==='demonstration')){const d=proposals.find(r=>r.source==='demonstration');if(d)selected.push(d);}
 const measured=selected.map(r=>({...measureLegRegion(p.paints,p.start,p.target,r.legs),source:r.source}));
 const summary=summarizeLegStyles(measured,rawMinimum,proposals.length-selected.length);
 const efficient=measured.filter(r=>r.supported&&r.legs.length===summary.robustMinimum);
 const bestByDepth=search.best.map(e=>e.error/T);if(fresh)fresh.best.forEach((e,i)=>bestByDepth[i]=Math.min(bestByDepth[i],e/T));
 const profile={nearOne:search.zero<=T||(bestByDepth[0]??Infinity)<1.5,tinyEfficientLeg:efficient.some(r=>!r.allMeaningful),rawShortcutToDemonstration:rawMinimum!==null&&rawMinimum<demo.length,
  supportedEfficientOrders:new Set(efficient.map(r=>r.legs.map(l=>l.paint).join())).size,
  sharePolicySensitivity:Object.fromEntries(['low','standard','high'].map(key=>{const supported=measured.filter(r=>r.sensitivity[key as keyof typeof r.sensitivity]);return[key,supported.length?Math.min(...supported.map(r=>r.legs.length)):null];}))};
 return{version:'pigment-leg-audit-1',policy:LEG_METRIC_POLICY,p,demonstrationLegs:demo.length,search,fresh,bestByDepth,summary,profile,measured,acceptedUnmeasured:proposals.filter(r=>!selected.includes(r)),evaluations:search.evaluations+(fresh?.evaluations??0)};
}
