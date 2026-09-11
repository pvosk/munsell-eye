// Selection-only revision. Historical audits, scoring and charge controls stay fixed.
import {LIVE_LANDING_TOLERANCE,colorDistance,type ColorPoint} from './play-engine';
import {sampleJourney,rankJourney,compareRank,requireCurrentValuePolicy,type JourneyAudit,type JourneyStyle} from './play-journey-analysis';
import {experienceSupported} from './play-experience-audit';

export const SELECTION_POLICY={version:'experience-selection-1',focusedFinishMs:[55,125],
 targetSeparation:1.5,quietChroma:.05,chromaticChroma:.09,maxQuiet:2,minChromatic:2,minValueSpan:.2} as const;
export function spatialExtent(points:Pick<ColorPoint,'position'>[]){
 if(!points.length)return 0;
 return Math.max(...points.map(p=>Math.hypot(...p.position.map((v,i)=>v-points[0].position[i]))));
}
export function timingDemand(ms:number){return ms<55?'unsupported':ms<=125?'focused':ms<=220?'moderate':'gentle';}
export function measureSelection(a:JourneyAudit){
 const bases=a.bases.map(b=>{
  const routes=b.routes.filter(experienceSupported).map(r=>{
   const points=sampleJourney(a.palette,r).points;
   return {order:r.order,times:r.times,extent:spatialExtent(points),travel:r.length,
    longestStroke:Math.max(...r.pourLengths),finishMs:r.finishWindowMs,timing:timingDemand(r.finishWindowMs),efficient:r.efficient,ride:r.traits.ride};
  });
  return {base:b.base,extentFloor:routes.length?Math.min(...routes.map(r=>r.extent)):0,
   focusedRide:routes.some(r=>r.efficient&&r.ride&&r.timing==='focused'),
   easierRide:routes.some(r=>r.efficient&&r.ride&&r.finishMs>125),routes};
 });
 return {version:SELECTION_POLICY.version,bases,extentFloor:Math.min(...bases.map(b=>b.extentFloor)),
  focusedRideBases:bases.filter(b=>b.focusedRide).map(b=>b.base),easierRideBases:bases.filter(b=>b.easierRide).map(b=>b.base)};
}
export function selectionRank(a:JourneyAudit,style:JourneyStyle,m:ReturnType<typeof measureSelection>){
 const original=rankJourney(a,style);
 // Safety and style coverage stay ahead of experiential preferences.
 return [...original.slice(0,5),m.extentFloor,style==='ride'?m.focusedRideBases.length/a.bases.length:0,original[5]];
}
export function setVariety(targets:ColorPoint[]){
 const quiet=targets.filter(p=>Math.hypot(...p.lab.slice(1))<SELECTION_POLICY.quietChroma).length;
 const chromatic=targets.filter(p=>Math.hypot(...p.lab.slice(1))>=SELECTION_POLICY.chromaticChroma).length;
 const valueSpan=targets.length?Math.max(...targets.map(p=>p.lab[0]))-Math.min(...targets.map(p=>p.lab[0])):0;
 const closest=targets.length<2?null:Math.min(...targets.flatMap((p,i)=>targets.slice(i+1).map(q=>colorDistance(p,q)/LIVE_LANDING_TOLERANCE)));
 return {quiet,chromatic,valueSpan,closest,passes:quiet<=SELECTION_POLICY.maxQuiet&&chromatic>=SELECTION_POLICY.minChromatic&&valueSpan>=SELECTION_POLICY.minValueSpan&&(closest===null||closest>=SELECTION_POLICY.targetSeparation)};
}
export function selectContrastSet<T extends {id:string;audit:JourneyAudit}>(slots:{style:JourneyStyle;candidates:T[]}[],measure:(c:T)=>ReturnType<typeof measureSelection>){
 const selected:T[]=[],excluded:{id:string;reason:string}[]=[];
 for(const slot of slots){
  for(const c of slot.candidates)requireCurrentValuePolicy(c.audit,slot.style);
  const ranked=slot.candidates.filter(c=>!c.audit.failures.length&&c.audit.styles[slot.style].eligible)
   .sort((a,b)=>compareRank(selectionRank(a.audit,slot.style,measure(a)),selectionRank(b.audit,slot.style,measure(b)))||a.id.localeCompare(b.id));
  const c=ranked.find(c=>{
   if(selected.some(s=>s.id===c.id||colorDistance(s.audit.target,c.audit.target)<LIVE_LANDING_TOLERANCE*SELECTION_POLICY.targetSeparation)){excluded.push({id:c.id,reason:'similar-target'});return false;}
   const quiet=[...selected,c].filter(x=>Math.hypot(...x.audit.target.lab.slice(1))<SELECTION_POLICY.quietChroma).length;
   if(quiet>SELECTION_POLICY.maxQuiet){excluded.push({id:c.id,reason:'quiet-target-budget'});return false;}return true;
  });
  if(!c)throw Error('No verified, contrasting candidate for '+slot.style);selected.push(c);
 }
 const variety=setVariety(selected.map(c=>c.audit.target));
 if(!variety.passes)throw Error('Selected set lacks chroma/value contrast; do not silently relax criteria');
 return {selected,excluded,variety};
}
