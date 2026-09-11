// OFFLINE v3 audit. Historical evaluators and live banks remain immutable.
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,CHARGE_SECONDS,mixtureColor,colorDistance,addPaint,chargeAmount,totalMass,type Mixture,type ColorPoint} from './play-engine';
import {makeAtlas,routeDetails,replayRoute,type Route} from './play-course-analysis';
import {searchCompetingRoutes,finishingIntervals,measureSetup} from './play-route-analysis';
import {mergeSplitPours,measureDesignRoute,matchesDesign,type DesignRoute} from './play-route-design';

export const AUDIT_VERSION='routes-3-dose-competition';
export const AUDIT_STYLES=['chromatic-ride','setup-lift','value-hue-balance','opposing-colors','interior-weave'] as const;
export type AuditStyle=typeof AUDIT_STYLES[number];
export type AuditRoute=DesignRoute & {traits:AuditStyle[]};
export type StyleAudit={availableBases:number[];robustBases:number[];bypassBases:number[];availableRatio:number;robustRatio:number;eligible:boolean;failures:string[]};
export type AuditedHole={version:string;target:ColorPoint;recipe:Mixture;nearestBase:number;globalFewest:number|null;failures:string[];sampledRoutes:number;
  bases:{base:number;fewest:number|null;bestOneError:number;bestTwoError:number;minimumTravel:number|null;viable:boolean;routes:AuditRoute[]}[];
  styles:Record<AuditStyle,StyleAudit>};
const d=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));

export function auditTraits(palette:number,r:DesignRoute,target:ColorPoint):AuditStyle[]{
  const traits:AuditStyle[]=[];
  for(const style of ['chromatic-ride','setup-lift','interior-weave'] as const)if(matchesDesign(r,style))traits.push(style);
  if(r.meaningfulPours>=2&&r.opposedPairs>0)traits.push('opposing-colors');
  const paints=PLAY_LEVELS[palette].paints;let q=paints.map((_,i)=>+(i===r.order[0]));
  const stops=[mixtureColor(paints,q).lab];
  for(let i=0;i<r.times.length;i++){q=addPaint(q,r.order[i+1],chargeAmount(totalMass(q),r.times[i]));stops.push(mixtureColor(paints,q).lab);}
  const ab=(p:number[])=>d(p.slice(1),target.lab.slice(1));
  for(let i=1;i<stops.length-1;i++){
    if(['White','Black'].includes(paints[r.order[i]].category))continue;
    if(r.meaningfulPours>=2&&Math.abs(stops[i-1][0]-target.lab[0])-Math.abs(stops[i][0]-target.lab[0])>=.035&&
      ab(stops[i])-ab(stops[i-1])>=.015&&stops.slice(i+1).some(p=>ab(stops[i])-ab(p)>=.015)){
      traits.push('value-hue-balance');break;
    }
  }
  return traits;
}

// Dose variants are evidence, not probabilities. Preserve raw successful grid
// samples (including near-boundary token finishes) alongside closest endpoints.
// Never deduplicate solely by ingredient order or use style to select samples.
export function searchAuditRoutes(palette:number,recipe:Mixture,atlas=makeAtlas(palette,128,24),targetOverride?:ColorPoint){
  const tolerance=LIVE_LANDING_TOLERANCE,found=searchCompetingRoutes(palette,recipe,atlas,tolerance);
  const target=targetOverride??found.target;
  // Fixed-bank recipes below are generating recipes, NOT featured route recipes.
  if(colorDistance(target,found.target)>1e-8)throw new Error('Audit recipe does not reproduce the fixed target');
  const extra:Route[]=[];
  for(const entry of atlas){
    const landed=entry.samples.filter(s=>d(s.lab,target.lab)<=tolerance);
    const seeds:number[][]=[];
    const add=(times:number[])=>{if(!seeds.some(t=>d(t,times)<.018))seeds.push(times);};
    for(let axis=0;axis<entry.order.length-1;axis++){
      const sorted=[...landed].sort((a,b)=>a.times[axis]-b.times[axis]);
      if(sorted.length){add(sorted[0].times);add(sorted.at(-1)!.times);add(sorted[Math.floor(sorted.length/2)].times);}
    }
    for(const r of found.routes.filter(r=>r.order.join()===entry.order.join()))add(r.times);
    // Explore the acceptance region rather than only minimizing center error.
    // Two-pour orders get local setup offsets and full finishing intervals.
    const anchors=seeds.slice(0,4);
    if(entry.order.length===3)for(const anchor of anchors)for(const offset of [-.07,0,.07]){
      const setup=Math.max(0,Math.min(CHARGE_SECONDS,anchor[0]+offset));
      const before=replayRoute(palette,entry.order.slice(0,2),[setup]);
      for(const interval of finishingIntervals(palette,before,entry.order[2],target,48,tolerance)){
        for(const fraction of [.12,.5,.88])add([setup,interval.lo+(interval.hi-interval.lo)*fraction]);
      }
    }
    // Bounded, deterministic farthest-point sampling, retaining dose extremes.
    const selected=seeds.slice(0,Math.min(4,seeds.length));
    while(selected.length<18&&selected.length<seeds.length){
      const next=[...seeds].sort((a,b)=>Math.min(...selected.map(t=>d(b,t)))-Math.min(...selected.map(t=>d(a,t))))[0];
      if(selected.some(t=>d(t,next)<1e-8))break;selected.push(next);
    }
    for(const times of selected)extra.push(routeDetails(palette,entry.order,times,target,tolerance));
  }
  const unique=new Map<string,Route>();
  for(const route of [...found.routes,...extra]){
    const r=mergeSplitPours(palette,route,target,tolerance);
    if(r.error>tolerance||!r.times.length)continue;
    const key=r.order.join()+':'+r.times.map(t=>t.toFixed(5)).join();unique.set(key,r);
  }
  return {...found,target,routes:[...unique.values()]};
}

export function analyzeAudit(palette:number,recipe:Mixture,atlas=makeAtlas(palette,128,24)):AuditedHole{
  const {target,routes,errors}=searchAuditRoutes(palette,recipe,atlas),paints=PLAY_LEVELS[palette].paints;
  const bases=paints.map((_,base)=>{
    const all=routes.filter(r=>r.order[0]===base),fewest=all.length?Math.min(...all.map(r=>r.times.length)):null;
    const measured=all.filter(r=>r.times.length===fewest).map(r=>{
      const m=measureDesignRoute(palette,r,target,false,LIVE_LANDING_TOLERANCE);m.efficient=true;
      return {...m,traits:auditTraits(palette,m,target)};
    });
    // Retain the widest candidate for each distinct trait combination AND
    // meaningful-pour count, separately per order. Non-style/token routes stay.
    const groups=new Map<string,AuditRoute[]>();
    for(const r of measured){const key=r.order.join()+':'+r.traits.join()+':'+r.meaningfulPours;const g=groups.get(key)??[];g.push(r);groups.set(key,g);}
    const retained:AuditRoute[]=[];
    for(const group of groups.values()){
      group.sort((a,b)=>b.finishWindowMs-a.finishWindowMs||b.window-a.window);
      let chosen=group[0];
      // Sample local setup support independently of meaningfulness. A token
      // correction can bypass the intended style even if it is not a good demo.
      for(const r of group.slice(0,3)){
        if(r.finishWindowMs<55)break;
        if(r.times.length>1)r.setup=measureSetup(palette,r,target,LIVE_LANDING_TOLERANCE);
        chosen=r;if(!r.setup||r.setup.coverage>=.04)break;
      }
      retained.push(chosen);
    }
    const viable=retained.some(r=>timingSupported(r)&&r.meaningfulPours>=Math.min(2,r.times.length));
    return {base,fewest,bestOneError:errors[base].one,bestTwoError:errors[base].two,
      minimumTravel:measured.length?Math.min(...measured.map(r=>r.length)):null,viable,routes:retained};
  });
  const nearestBase=Math.min(...paints.map((_,i)=>colorDistance(target,mixtureColor(paints,paints.map((_,j)=>+(i===j))))/LIVE_LANDING_TOLERANCE));
  const failures:string[]=[];
  if(nearestBase<1.8)failures.push('near-pure-target');
  if(bases.some(b=>!b.viable))failures.push('not-supported-from-every-base');
  if(bases.some(b=>b.minimumTravel!==null&&b.minimumTravel<14))failures.push('short-competing-route');
  const counts=bases.flatMap(b=>b.fewest===null?[]:[b.fewest]);
  const globalFewest=counts.length?Math.min(...counts):null;
  const styles=Object.fromEntries(AUDIT_STYLES.map(style=>{
    const availableBases=bases.filter(b=>b.routes.some(r=>timingSupported(r)&&r.traits.includes(style))).map(b=>b.base);
    const bypassBases=bases.filter(b=>b.routes.some(r=>timingSupported(r)&&!r.traits.includes(style))).map(b=>b.base);
    const robustBases=availableBases.filter(b=>!bypassBases.includes(b)),styleFailures=[...failures];
    if(robustBases.length/bases.length<.5)styleFailures.push('less-than-half-starts-style-robust');
    if(style==='chromatic-ride'&&Math.hypot(...target.lab.slice(1))<.07)styleFailures.push('muted-ride-target');
    if(style!=='chromatic-ride'&&globalFewest===1)styleFailures.push('one-pour-style-bypass');
    return [style,{availableBases,robustBases,bypassBases,availableRatio:availableBases.length/bases.length,robustRatio:robustBases.length/bases.length,eligible:!styleFailures.length,failures:styleFailures}];
  })) as Record<AuditStyle,StyleAudit>;
  return {version:AUDIT_VERSION,target,recipe,nearestBase,globalFewest,failures,sampledRoutes:routes.length,bases,styles};
}
export function timingSupported(r:AuditRoute):boolean{
  return r.finishWindowMs>=55&&(r.times.length===1||!!r.setup&&r.setup.coverage>=.04);
}
