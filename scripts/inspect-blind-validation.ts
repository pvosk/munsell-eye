import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pilot from '../docs/play-inverse-planning-results.json';
import {PLAY_LEVELS,protectedLabBank,mixtureColor,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {makeAtlas,routeDetails} from '../app/play-course-analysis';
import {analyzeJourney,measureJourney,routeDistance,type JourneyRoute} from '../app/play-journey-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {blindSearch,setupSlice,BLIND_POLICY,type BlindRoute} from './recipe-blind-search';

const signature=JSON.stringify(PLAY_LEVELS),started=performance.now();
const shift=pilot.rows.filter(r=>r.methods['inverse-region'].findings['value-shift'].bases.length>0)
 .sort((a,b)=>b.methods['inverse-region'].findings['value-shift'].bases.length-a.methods['inverse-region'].findings['value-shift'].bases.length||b.nearestBase-a.nearestBase);
const chosen=[pilot.rows.find(r=>r.id==='ip-30-1109261-0')!,shift[0],shift.find(r=>r.palette!==shift[0].palette)!];
const specimens=[...chosen.map(r=>({id:r.id,palette:r.palette,recipe:r.recipe,source:'inverse-pilot'})),
 ...[1,2,3,4].map(i=>({id:`control-${i}`,palette:protectedLabBank.holes[i].levelIndex,recipe:protectedLabBank.holes[i].record.target,source:'archived-control'}))];
const rows=[];
for(const specimen of specimens){
 const {palette,recipe,id}=specimen,target=mixtureColor(PLAY_LEVELS[palette].paints,recipe);
 const audit=analyzeJourney(palette,recipe,makeAtlas(palette,256,48),1209261);
 const first=blindSearch(palette,target,3,1209261),second=blindSearch(palette,target,3,1209299);
 const minimum=(routes:BlindRoute[],base:number)=>{const r=routes.filter(r=>r.order[0]===base);return r.length?Math.min(...r.map(r=>r.times.length)):null;};
 const needsDeep=audit.bases.some(b=>minimum([...first.routes,...second.routes],b.base)!==b.fewest||minimum(first.routes,b.base)!==minimum(second.routes,b.base));
 const deep=needsDeep?blindSearch(palette,target,3,1210111,{...BLIND_POLICY,samples:288,restarts:12,iterations:180,timeExponent:2}):null;
 const measure=(r:BlindRoute)=>{
  const route=measureJourney(palette,measureDesignRoute(palette,routeDetails(palette,r.order,r.times,target,LIVE_LANDING_TOLERANCE),target,false,LIVE_LANDING_TOLERANCE),target);
  if(route.finishWindowMs>=55&&route.times.length>1)route.setup=measureSetup(palette,route,target,LIVE_LANDING_TOLERANCE);
  return route;
 };
 const comparisons=PLAY_LEVELS[palette].paints.map((paint,base)=>{
  const all=[...first.routes,...second.routes,...(deep?.routes??[])].filter(r=>r.order[0]===base),fewest=all.length?Math.min(...all.map(r=>r.times.length)):null;
  // Measure one closest-center witness per order at the independently found
  // minimum. This support check is shared code, not a second support oracle.
  const orders=new Map<string,BlindRoute>();
  for(const r of all.filter(r=>r.times.length===fewest)){const k=r.order.join(),old=orders.get(k);if(!old||r.error<old.error)orders.set(k,r);}
  const measured=[...orders.values()].map(measure),supported=measured.filter(experienceSupported);
  const retained=audit.bases[base].routes.filter(r=>r.efficient&&experienceSupported(r));
  const allSupported=audit.bases[base].routes.filter(experienceSupported);
  const sameOrderDisagreements=[];
  for(const style of ['ride','value-shift','balance','interior'] as const){
   const groups=new Map<string,JourneyRoute[]>();for(const r of retained){const k=r.order.join();groups.set(k,[...(groups.get(k)??[]),r]);}
   for(const [order,routes] of groups){const yes=routes.filter(r=>r.traits[style]),no=routes.filter(r=>!r.traits[style]);if(!yes.length||!no.length)continue;
    const pairs=yes.flatMap(a=>no.map(b=>({a,b,distance:routeDistance(a,b)}))).sort((a,b)=>a.distance-b.distance),p=pairs[0];
    sameOrderDisagreements.push({style,order,pathDifference:p.distance,yes:{times:p.a.times,length:p.a.length,ride:p.a.longestChromaticPour,value:p.a.valueFinish},no:{times:p.b.times,length:p.b.length,ride:p.b.longestChromaticPour,value:p.b.valueFinish}});
   }
  }
  const seedMinimum=(routes:BlindRoute[])=>{const r=routes.filter(r=>r.order[0]===base);return r.length?Math.min(...r.map(r=>r.times.length)):null;};
  return {base,paint:paint.name,auditedFewest:audit.bases[base].fewest,blindFewest:fewest,seedMinima:[seedMinimum(first.routes),seedMinimum(second.routes)],deepMinimum:deep?seedMinimum(deep.routes):null,
   auditedSupportedFewest:allSupported.length?Math.min(...allSupported.map(r=>r.times.length)):null,
   auditExamples:audit.bases[base].routes.filter(r=>r.efficient).slice(0,3).map(r=>({order:r.order,times:r.times,error:r.error,finishMs:r.finishWindowMs,setup:r.setup})),
   oneError:first.best[base][0]/LIVE_LANDING_TOLERANCE,twoError:first.best[base][1]/LIVE_LANDING_TOLERANCE,
   shorterThanAudit:fewest!==null&&(audit.bases[base].fewest===null||fewest<audit.bases[base].fewest!),
   supportedBlindOrders:supported.map(r=>({order:r.order,times:r.times,error:r.error,traits:r.traits,finishMs:r.finishWindowMs,setup:r.setup})),sameOrderDisagreements};
 });
 // Inspect one setup/finish family per specimen, chosen only AFTER blind search.
 const family=[...first.routes,...second.routes,...(deep?.routes??[])].filter(r=>r.times.length>=2).sort((a,b)=>a.times.length-b.times.length||a.error-b.error)[0];
 const slice=family?setupSlice(palette,target,family.order,family.times.slice(0,-2)):null;
 const row={...specimen,name:PLAY_LEVELS[palette].name,target,comparisons,auditStyles:audit.styles,auditFailures:audit.failures,
  evaluations:first.evaluations+second.evaluations+(deep?.evaluations??0),deepPolicy:deep?{policy:deep.policy,seed:deep.seed}:null,globalSetupSlice:family&&slice?{order:family.order,fixedPrefix:family.times.slice(0,-2),...slice}:null};
 rows.push(row);console.log(id,row.name,JSON.stringify(comparisons.map(c=>({base:c.base,audit:c.auditedFewest,blind:c.blindFewest,seeds:c.seedMinima,shorter:c.shorterThanAudit,disagreements:c.sameOrderDisagreements.length}))));
}
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Palette changed');
const sourceFiles=['scripts/recipe-blind-search.ts','scripts/inspect-blind-validation.ts','app/play-engine.ts','app/play-journey-analysis.ts','app/play-route-analysis.ts','app/play-route-audit.ts','app/play-course-analysis.ts','app/play-route-design.ts','app/play-finish-profile.ts','app/play-experience-audit.ts','app/paint-mixing.ts'];
const result={version:'inverse-validation-study-1',sourceFiles,sourceHash:createHash('sha256').update(sourceFiles.map(f=>readFileSync(f)).join('\n')).digest('hex'),policy:BLIND_POLICY,seeds:[1209261,1209299],seconds:(performance.now()-started)/1000,
 limitations:['Recipe-blind search shares only forward physics and scoring; support and style measurements are shared, not independently verified here.',
 'Two seeded numerical searches, plus a stronger third pass when counts disagree or seeds are unstable; not a proof or global optimization. Includes repeated paints and adding the initial paint first.',
 'Seven selected diagnostic specimens, including established controls: not a prevalence estimate or fresh palette ranking.',
 'Global setup slice varies the penultimate and final dose; earlier doses are fixed for three-addition routes. Finite sampling can miss narrow regions.',
 'Same paint order does not guarantee the same experience. Continuous path differences are reported, never automatically excused.',
 'No live implementation, palette search expansion, controls, strength, tolerance, par, or lab deployment.'],rows};
writeFileSync('docs/play-blind-validation-results.json',JSON.stringify(result,null,2)+'\n');console.log('DONE',result.seconds);
