import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,colorPoint,mixtureColor,colorDistance,type ColorPoint} from '../app/play-engine';
import {routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureJourney} from '../app/play-journey-analysis';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {backwardRegions,type RegionPalette} from './backward-region-proposals';
import {blindSearch,BLIND_POLICY,setupSlice} from './recipe-blind-search';
import {stableRide} from './stable-route-measurement';
import {compactWitness} from './supported-selection';
type Controls={order:number[];times:number[]};
type ScreenHole={goal:string;target:ColorPoint;bases:{rawFewest:number|null;routes:{witness:Controls}[]}[];classification:Record<'ride'|'value-shift',{eligible:boolean}>};
export function verify(trial:RegionPalette,goal:string,target:ColorPoint,proposals:Controls[],old:ScreenHole|null){
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:trial.name,subtitle:'Offline deeper check',paints:trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
 try{
  const blind=blindSearch(slot,target,3,91226557,{...BLIND_POLICY,samples:288,restarts:12,iterations:180,timeExponent:2});
  const orders=new Map<string,typeof blind.routes[number][]>();
  for(const r of blind.routes){const k=r.order.join(),group=orders.get(k)??[];group.push(r);orders.set(k,group);}
  const selected:Controls[]=[...proposals];for(const group of orders.values())selected.push(...group.sort((a,b)=>a.error-b.error).slice(0,2));
  const measured=selected.map(r=>{
   const m=measureJourney(slot,measureDesignRoute(slot,routeDetails(slot,r.order,r.times,target,LIVE_LANDING_TOLERANCE),target),target);
   if(m.finishWindowMs>=55&&m.times.length>1)m.setup=measureSetup(slot,m,target,LIVE_LANDING_TOLERANCE);return m;
  });
  const bases=trial.paints.map((paint,base)=>{
   const all=measured.filter(r=>r.order[0]===base),supported=all.filter(experienceSupported),fewest=supported.length?Math.min(...supported.map(r=>r.times.length)):null,efficient=supported.filter(r=>r.times.length===fewest),raw=blind.routes.filter(r=>r.order[0]===base);
   const rawFewest=all.length||raw.length?Math.min(...all.map(r=>r.times.length),...raw.map(r=>r.times.length)):null;
   return {base,paint:paint.name,rawFewest,supportedFewest:fewest,blindRawFewest:raw.length?Math.min(...raw.map(r=>r.times.length)):null,previousRaw:old?.bases[base].rawFewest??null,
    viable:supported.some(r=>r.meaningfulPours>=Math.min(2,r.times.length)),startDistance:colorDistance(mixtureColor(trial.paints,trial.paints.map((_,i)=>+(i===base))),target)/LIVE_LANDING_TOLERANCE,
    easy:supported.some(r=>r.times.length===1&&r.length<14&&r.journey.excursion<.5),token:efficient.some(r=>r.meaningfulPours<Math.min(2,r.times.length)),
    rawWitnesses:raw.sort((a,b)=>a.times.length-b.times.length||a.error-b.error).slice(0,3),routes:efficient.map(r=>({witness:compactWitness(r),stable:stableRide(slot,r)}))};
  });
  const failures:string[]=[];if(bases.some(b=>b.startDistance<=1))failures.push('pure-already-in-cup');if(bases.some(b=>!b.viable))failures.push('unsupported-base');if(bases.some(b=>b.easy))failures.push('short-direct-shortcut');if(bases.some(b=>b.token))failures.push('token-bypass');
  const styles=Object.fromEntries((['ride','value-shift'] as const).map(style=>{
   const available=bases.filter(b=>b.routes.some(r=>(style==='ride'?r.stable.ride:r.witness.traits[style])===true)).map(b=>b.base),bypass=bases.filter(b=>b.routes.some(r=>(style==='ride'?r.stable.ride:r.witness.traits[style])===false)).map(b=>b.base);
   const uncertain=style==='ride'?bases.filter(b=>b.routes.some(r=>r.stable.ride===null)).map(b=>b.base):[];
   return [style,{available,bypass,resistant:available.filter(b=>!bypass.includes(b)&&!uncertain.includes(b)),eligible:!failures.length&&available.length/bases.length>=2/3,uncertain}];
  }));
  const candidates=bases.flatMap(b=>b.routes).filter(r=>r.witness.meaningfulPours>=2&&r.witness.times.length>=2&&(r.stable.ride===true||r.witness.traits['value-shift'])).sort((a,b)=>b.witness.finishWindowMs-a.witness.finishWindowMs);
  const chosen=candidates[0],region=chosen?{witness:chosen.witness,earlierFixed:chosen.witness.times.slice(0,-2),slice:setupSlice(slot,target,chosen.witness.order,chosen.witness.times.slice(0,-2),32,256)}:null;
  return {trial,goal,target,failures,styles,bases,region,policy:blind.policy,seed:blind.seed,evaluations:blind.evaluations};
 }finally{PLAY_LEVELS.splice(slot,1);}
}
