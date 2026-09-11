// Offline journey evaluator. Archived evaluators, game rules and banks stay unchanged.
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,CHARGE_SECONDS,mixtureColor,pourPath,addPaint,chargeAmount,totalMass,colorDistance,type ColorPoint} from './play-engine';
import {makeAtlas,routeDetails,refine,type Route} from './play-course-analysis';
import {searchAuditRoutes} from './play-route-audit';
import {measureDesignRoute,type DesignRoute} from './play-route-design';
import {measureSetup} from './play-route-analysis';
import {experienceSupported,EXPERIENCE_POLICY} from './play-experience-audit';
import {finishProfile,FINISH_PROFILE_POLICY} from './play-finish-profile';

export const JOURNEY_POLICY=Object.freeze({...EXPERIENCE_POLICY,version:'journeys-2-value-led',finishProfile:FINISH_PROFILE_POLICY,
  journeyVersion:'journeys-2-value-led',cleanupFraction:.35,finishDominance:.25,closeTolerances:3,
  excursionTolerances:.5,excessTravel:6,specialistFraction:2/3,routeSeparation:.05,targetSeparation:2});
export type JourneyStyle='interior'|'ride'|'value-shift'|'balance';
const d=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const ab=(a:readonly number[],b:readonly number[])=>d(a.slice(1),b.slice(1));
const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
export type Stroke={paint:number;length:number;chromaticLength:number;before:ColorPoint;after:ColorPoint;excursion:number;backtrack:number};
export function sampleJourney(palette:number,r:Pick<Route,'order'|'times'>){
 const paints=PLAY_LEVELS[palette].paints;let q=paints.map((_,i)=>+(i===r.order[0]));
 const strokes:Stroke[]=[],points:ColorPoint[]=[mixtureColor(paints,q)];
 for(let i=0;i<r.times.length;i++){
  const amount=chargeAmount(totalMass(q),r.times[i]),path=pourPath(paints,q,r.order[i+1],amount,48);
  let length=0,chromaticLength=0;for(let j=1;j<path.length;j++){const step=d(path[j].position,path[j-1].position);length+=step;if(Math.min(Math.hypot(...path[j].lab.slice(1)),Math.hypot(...path[j-1].lab.slice(1)))>=.06)chromaticLength+=step;}
  strokes.push({paint:r.order[i+1],length,chromaticLength,before:path[0],after:path.at(-1)!,excursion:0,backtrack:0});
  points.push(...path.slice(1));q=addPaint(q,r.order[i+1],amount);
 }return {strokes,points};
}
// Pure geometry helper: score-space excursion and display-world excess remain separate.
export function journeyGeometry(points:ColorPoint[],target:ColorPoint){
 const errors=points.map(p=>colorDistance(p,target)/LIVE_LANDING_TOLERANCE),startDistance=errors[0];
 const length=sum(points.slice(1).map((p,i)=>d(p.position,points[i].position)));
 const chord=d(points[0].position,points.at(-1)!.position);
 return {startDistance,worldStartDistance:d(points[0].position,target.position),length,chord,
  excess:Math.max(0,length-chord),stretch:chord>1e-6?length/chord:null,
  excursion:Math.max(0,...errors.map(e=>e-startDistance)),backtrack:sum(errors.slice(1).map((e,i)=>Math.max(0,e-errors[i])))};
}
export function finishEpisode(strokes:Stroke[],target:ColorPoint){
 const choices=strokes.map((s,i)=>{
  const tail=strokes.slice(i+1),setup=sum(strokes.slice(0,i).map(s=>s.length));
  const cleanup=sum(tail.map(s=>s.length)),signedValue=s.after.lab[0]-s.before.lab[0];
  const valueGain=Math.abs(s.before.lab[0]-target.lab[0])-Math.abs(s.after.lab[0]-target.lab[0]);
  const approachGain=colorDistance(s.before,target)-colorDistance(s.after,target);
  const fraction=s.length/Math.max(1e-9,sum(strokes.map(s=>s.length)));
  const structural=i>0&&setup>=6&&Math.abs(signedValue)>.1&&s.length>=9&&valueGain>0&&approachGain>0&&cleanup<=s.length*JOURNEY_POLICY.cleanupFraction;
  return {index:i,paint:s.paint,setup,length:s.length,cleanup,signedValue,valueGain,approachGain,fraction,structural,
   dominant:structural&&fraction>=JOURNEY_POLICY.finishDominance};
 }).filter(s=>s.structural).sort((a,b)=>Number(b.dominant)-Number(a.dominant)||b.length-a.length);
 return choices[0]??null;
}
export function measureJourney(palette:number,r:DesignRoute,target:ColorPoint){
 const {strokes,points}=sampleJourney(palette,r),g=journeyGeometry(points,target),finish=finishEpisode(strokes,target);
 let coupled=0,couplingStrength=0;
 for(let i=0;i<strokes.length-1;i++){
  const s=strokes[i];if(['White','Black'].includes(PLAY_LEVELS[palette].paints[s.paint].category))continue;
  const movement=s.after.lab.map((v,j)=>v-s.before.lab[j]),toward=target.lab.map((v,j)=>v-s.before.lab[j]);
  const valueGain=Math.abs(toward[0])-Math.abs(target.lab[0]-s.after.lab[0]);
  const denom=toward[1]**2+toward[2]**2;
  const projection=denom>1e-10?(movement[1]*toward[1]+movement[2]*toward[2])/denom:0;
  const lateral=[movement[1]-projection*toward[1],movement[2]-projection*toward[2]];
  const cost=ab(s.after.lab,target.lab)-ab(s.before.lab,target.lab);
  const recover=strokes.slice(i+1).some(t=>{
   const next=[t.after.lab[1]-t.before.lab[1],t.after.lab[2]-t.before.lab[2]];
   return cost>=.015?ab(t.after.lab,target.lab)<=ab(s.after.lab,target.lab)-.015:next[0]*lateral[0]+next[1]*lateral[1]<-.000225;
  });
  if(valueGain>=.035&&recover){couplingStrength=Math.max(couplingStrength,Math.max(cost,Math.hypot(...lateral)));if(cost>=.015||Math.hypot(...lateral)>=.015)coupled++;}
 }
 // Arc-length samples retain color-space path character, not just endpoint identity.
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+d(points[i].position,points[i-1].position));
 const fingerprint=Array.from({length:9},(_,i)=>{const at=g.length*i/8;const j=cumulative.findIndex(n=>n>=at);if(j<1)return points[0].lab;const t=(at-cumulative[j-1])/Math.max(1e-12,cumulative[j]-cumulative[j-1]);return points[j].lab.map((v,k)=>points[j-1].lab[k]+t*(v-points[j-1].lab[k]));});
 const ride=r.longestChromaticPour>=36&&r.chromaticFraction>=.8;
 const balance=r.meaningfulPours>=2&&(r.opposedPairs>0||coupled>0);
 const valueFinish=finishProfile(strokes,finish,r.meaningfulPours);
 return {...r,journey:g,finish,valueFinish,coupled,couplingStrength,fingerprint,
  traits:{interior:r.times.length===3&&r.meaningfulPours===3,ride,'value-shift':valueFinish.valueLed,balance}};
}
export type JourneyRoute=ReturnType<typeof measureJourney>;
export function routeDistance(a:JourneyRoute,b:JourneyRoute){return sum(a.fingerprint.map((p,i)=>d(p,b.fingerprint[i])))/a.fingerprint.length;}
export function classifyApproach(startDistance:number,routes:JourneyRoute[]){
 const supported=routes.filter(experienceSupported);
 const easy=supported.filter(r=>r.times.length===1&&r.length<14&&r.journey.excursion<.5);
 const minTravel=supported.length?Math.min(...supported.map(r=>r.length)):null;
 const minExcess=supported.length?Math.min(...supported.map(r=>r.journey.excess)):null;
 const minExcursion=supported.length?Math.min(...supported.map(r=>r.journey.excursion)):null;
 const indirect=!!supported.length&&supported.every(r=>r.journey.excess>=6||r.journey.excursion>=.5);
 return {status:!supported.length?'unresolved':easy.length?'short-direct':startDistance<=3&&indirect?'close-indirect':indirect?'indirect':'mixed-or-direct',
  easyRoutes:easy.length,minTravel,minExcess,minExcursion,rawMinTravel:routes.length?Math.min(...routes.map(r=>r.length)):null};
}
// Additional numerical three-pour exploration, including repeated paints. Only
// used for verification; does not claim exhaustive continuous three-dose coverage.
export function exploreThree(palette:number,target:ColorPoint,seed=771){
 let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
 const n=PLAY_LEVELS[palette].paints.length,out:Route[]=[];
 for(let base=0;base<n;base++)for(let a=0;a<n;a++)if(a!==base)for(let b=0;b<n;b++)for(let c=0;c<n;c++){
  const order=[base,a,b,c];
  for(let trial=0;trial<3;trial++){
   const times=Array.from({length:3},()=>.08+random()*CHARGE_SECONDS*.7),fit=refine(palette,order,times,target,.3);
   if(fit.error<=LIVE_LANDING_TOLERANCE)out.push(routeDetails(palette,order,fit.times,target,LIVE_LANDING_TOLERANCE));
  }
 }return out;
}
export function analyzeJourney(palette:number,recipe:number[],atlas=makeAtlas(palette,128,24),threeSeed?:number){
 const found=searchAuditRoutes(palette,recipe,atlas),target=found.target,paints=PLAY_LEVELS[palette].paints;
 const extra=threeSeed===undefined?[]:exploreThree(palette,target,threeSeed);
 const raw=[...found.routes,...extra].map(r=>measureDesignRoute(palette,r,target,false,LIVE_LANDING_TOLERANCE)).filter(r=>r.error<=LIVE_LANDING_TOLERANCE);
 const bases=paints.map((_,base)=>{
  const all=raw.filter(r=>r.order[0]===base),fewest=all.length?Math.min(...all.map(r=>r.times.length)):null;
  // Retain longer competitors too: a wider-window extra pour can be worthwhile.
  const measured=all.map(r=>measureJourney(palette,{...r,efficient:r.times.length===fewest},target));
  const groups=new Map<string,JourneyRoute[]>();
  for(const r of measured){const key=JSON.stringify([r.order,r.meaningfulPours,r.traits,r.journey.excursion>=.5,r.journey.excess>=6]);const group=groups.get(key)??[];group.push(r);groups.set(key,group);}
  const retained:JourneyRoute[]=[];
  for(const group of groups.values()){
   const seeds=[...group].sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,1);
   for(const key of ['length','excursion','excess'] as const){const r=[...group].filter(r=>r.finishWindowMs>=55).sort((a,b)=>(key==='length'?a.length-b.length:a.journey[key]-b.journey[key]))[0];if(r&&!seeds.includes(r))seeds.push(r);}
   for(const r of seeds){if(r.finishWindowMs>=55&&r.times.length>1)r.setup=measureSetup(palette,r,target,LIVE_LANDING_TOLERANCE);retained.push(r);}
  }
  const supported=retained.filter(experienceSupported),pure=mixtureColor(paints,paints.map((_,j)=>+(base===j)));
  const meaningful=supported.filter(r=>r.meaningfulPours>=Math.min(2,r.times.length));
  return {base,fewest,startDistance:colorDistance(pure,target)/LIVE_LANDING_TOLERANCE,
   bestOneError:found.errors[base].one,bestTwoError:found.errors[base].two,viable:meaningful.length>0,
   approach:classifyApproach(colorDistance(pure,target)/LIVE_LANDING_TOLERANCE,retained),routes:retained};
 });
 const failures:string[]=[];
 if(bases.some(b=>b.startDistance<=1))failures.push('pure-already-in-cup');
 if(bases.some(b=>!b.viable))failures.push('unsupported-base');
 if(bases.some(b=>b.approach.easyRoutes>0))failures.push('short-direct-shortcut');
 if(bases.some(b=>b.routes.some(r=>r.efficient&&experienceSupported(r)&&r.meaningfulPours<Math.min(2,r.times.length))))failures.push('token-bypass');
 const styles=Object.fromEntries((['interior','ride','value-shift','balance'] as const).map(style=>{
  const available=bases.filter(b=>b.routes.some(r=>r.efficient&&experienceSupported(r)&&r.traits[style])).map(b=>b.base);
  const bypass=bases.filter(b=>b.routes.some(r=>r.efficient&&experienceSupported(r)&&!r.traits[style])).map(b=>b.base);
  const resistant=available.filter(b=>!bypass.includes(b));
  const structural=style!=='interior'||bases.every(b=>b.fewest===3&&b.bestTwoError>1.1&&b.routes.filter(r=>r.efficient&&experienceSupported(r)).every(r=>r.meaningfulPours===3));
  const eligible=!failures.length&&structural&&available.length/paints.length>=2/3;
  return [style,{available,bypass,resistant,eligible,allAvailable:eligible&&available.length===paints.length,allResistant:eligible&&resistant.length===paints.length}];
 })) as Record<JourneyStyle,{available:number[];bypass:number[];resistant:number[];eligible:boolean;allAvailable:boolean;allResistant:boolean}>;
 return {version:JOURNEY_POLICY.journeyVersion,palette,recipe,target,failures,bases,styles,threeExplored:threeSeed!==undefined,
  minTravel:Math.min(...bases.map(b=>b.approach.minTravel??0))};
}
export type JourneyAudit=ReturnType<typeof analyzeJourney>;
export function requireCurrentValuePolicy(a:{version:string},style:JourneyStyle){
 if(style==='value-shift'&&a.version!==JOURNEY_POLICY.journeyVersion)throw Error('Archived value-shift labels require remeasurement before current selection.');
}
export function rankJourney(a:JourneyAudit,style:JourneyStyle){
 requireCurrentValuePolicy(a,style);
 const s=a.styles[style];return [Number(!a.failures.length),-a.failures.length,Number(s.eligible),s.available.length/a.bases.length,s.resistant.length/a.bases.length,
  Math.min(60,a.minTravel)];
}
export function compareRank(a:number[],b:number[]){for(let i=0;i<a.length;i++)if(Math.abs(b[i]-a[i])>1e-9)return b[i]-a[i];return 0;}
// Course diversity considers the easiest supported approach from EVERY shared
// base, not the prettiest intended route. A repeating easy approach is disclosed.
export function holeRouteDistance(a:JourneyAudit,b:JourneyAudit){
 const distances=a.bases.map((base,i)=>{
  const ar=base.routes.filter(r=>r.efficient&&experienceSupported(r)),br=b.bases[i].routes.filter(r=>r.efficient&&experienceSupported(r));
  return ar.length&&br.length?Math.min(...ar.flatMap(x=>br.map(y=>routeDistance(x,y)))):0;
 });return Math.min(...distances);
}
export function selectPortfolio<T extends {id:string;audit:JourneyAudit}>(items:T[]){
 const ranked=[...items].filter(c=>Object.values(c.audit.styles).some(s=>s.eligible)).sort((a,b)=>b.audit.minTravel-a.audit.minTravel||a.id.localeCompare(b.id));
 const selected:T[]=[],excluded:{id:string;similarTo:string}[]=[];
 for(const c of ranked){const similar=selected.find(p=>colorDistance(c.audit.target,p.audit.target)<LIVE_LANDING_TOLERANCE*2||holeRouteDistance(c.audit,p.audit)<JOURNEY_POLICY.routeSeparation);
  if(similar)excluded.push({id:c.id,similarTo:similar.id});else selected.push(c);
 }return {selected,excluded};
}
