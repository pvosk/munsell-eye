import {writeFileSync,readFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorPoint,colorDistance,type ColorPoint} from '../app/play-engine';
import {routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureJourney} from '../app/play-journey-analysis';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {backwardRegions,regionPalettes,REGION_POLICY,type RegionPalette,type RegionRoute} from './backward-region-proposals';
import {blindSearch,BLIND_POLICY,setupSlice} from './recipe-blind-search';
import {stableRide,STABLE_POLICY} from './stable-route-measurement';
import {compactWitness} from './supported-selection';

const GOALS:[string,[number,number,number]][]=[['light-warm',[220,204,175]],['peach',[205,159,128]],['warm-middle',[173,125,89]],['olive',[139,144,72]],['lavender',[156,145,182]],['sea',[69,143,129]],['cyan',[40,169,193]],['orange',[234,126,37]],['green',[91,164,73]],['magenta',[190,59,122]],['middle-neutral',[113,121,129]],['dark-violet',[82,57,97]]];
const styles=['ride','value-shift'] as const;
const PROTOCOL={version:'backward-palette-study-1',seed:91226401,goals:GOALS,perPaletteStyleFinalists:2,blindSeed:91226479,blindSamples:72,blindRestarts:5,finalBlindSeed:91226557};
const sourceFiles=['scripts/search-backward-palettes.ts','scripts/backward-region-proposals.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','scripts/supported-selection.ts','app/play-inverse-planning.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts'];
const sourceHash=createHash('sha256').update(sourceFiles.map(p=>readFileSync(p)).join('\n')).digest('hex');
const signature=JSON.stringify(PLAY_LEVELS),started=performance.now(),selection=regionPalettes();
mkdirSync('outputs/backward-regions',{recursive:true});
type Proposal={goal:string;target:ColorPoint;bestError:number;fitCount:number;endpointCount:number;routes:RegionRoute[]};

function assess(palette:number,p:Proposal){
 const blind=blindSearch(palette,p.target,3,PROTOCOL.blindSeed);
 const selected:Pick<RegionRoute,'order'|'times'>[]=[];
 // Retain independently found closest endpoints per order, regardless of style.
 const independent=new Map<string,typeof blind.routes[number]>();
 for(const r of blind.routes){const key=r.order.join(),old=independent.get(key);if(!old||r.error<old.error)independent.set(key,r);}
 selected.push(...independent.values());
 // Proposal witnesses remain tagged conceptually as proposals, never counted
 // as independently recovered. Keep best two per base and requested style.
 for(let base=0;base<PLAY_LEVELS[palette].paints.length;base++)for(const style of styles){
  const rows=p.routes.filter(r=>r.order[0]===base&&(style==='ride'?r.rideProxy>=34:r.shiftProxy>0));
  rows.sort((a,b)=>a.times.length-b.times.length||(style==='ride'?b.rideProxy-a.rideProxy:b.shiftProxy-a.shiftProxy));selected.push(...rows.slice(0,2));
 }
 const measured=selected.map(r=>{
  const m=measureJourney(palette,measureDesignRoute(palette,routeDetails(palette,r.order,r.times,p.target,LIVE_LANDING_TOLERANCE),p.target),p.target);
  if(m.finishWindowMs>=55&&m.times.length>1)m.setup=measureSetup(palette,m,p.target,LIVE_LANDING_TOLERANCE);
  return m;
 });
 const bases=PLAY_LEVELS[palette].paints.map((paint,base)=>{
  const all=measured.filter(r=>r.order[0]===base),supported=all.filter(experienceSupported),fewest=supported.length?Math.min(...supported.map(r=>r.times.length)):null;
  const raw=blind.routes.filter(r=>r.order[0]===base),rawFewest=all.length||raw.length?Math.min(...all.map(r=>r.times.length),...raw.map(r=>r.times.length)):null;
  const efficient=supported.filter(r=>r.times.length===fewest);
  return {base,paint:paint.name,rawFewest,supportedFewest:fewest,blindRawFewest:raw.length?Math.min(...raw.map(r=>r.times.length)):null,
   expertShorter:rawFewest!==null&&fewest!==null&&rawFewest<fewest,
   startDistance:colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,PLAY_LEVELS[palette].paints.map((_,i)=>+(i===base))),p.target)/LIVE_LANDING_TOLERANCE,
   viable:supported.some(r=>r.meaningfulPours>=Math.min(2,r.times.length)),
   easy:supported.some(r=>r.times.length===1&&r.length<14&&r.journey.excursion<.5),
   token:efficient.some(r=>r.meaningfulPours<Math.min(2,r.times.length)),
   minTravel:supported.length?Math.min(...supported.map(r=>r.length)):null,
   routes:efficient.map(r=>({witness:compactWitness(r),stable:stableRide(palette,r)}))};
 });
 const failures=[] as string[];if(bases.some(b=>b.startDistance<=1))failures.push('pure-already-in-cup');if(bases.some(b=>!b.viable))failures.push('unsupported-base');if(bases.some(b=>b.easy))failures.push('short-direct-shortcut');if(bases.some(b=>b.token))failures.push('token-bypass');
 const classification=Object.fromEntries(styles.map(style=>{
  const available=bases.filter(b=>b.routes.some(r=>(style==='ride'?r.stable.ride:r.witness.traits[style])===true)).map(b=>b.base);
  const bypass=bases.filter(b=>b.routes.some(r=>(style==='ride'?r.stable.ride:r.witness.traits[style])===false)).map(b=>b.base);
  const uncertain=style==='ride'?bases.filter(b=>b.routes.some(r=>r.stable.ride===null)).map(b=>b.base):[];
  const resistant=available.filter(b=>!bypass.includes(b)&&!uncertain.includes(b));
  return [style,{available,bypass,resistant,uncertain,eligible:!failures.length&&available.length/bases.length>=2/3}];
 })) as Record<typeof styles[number],{available:number[];bypass:number[];resistant:number[];uncertain:number[];eligible:boolean}>;
 return {goal:p.goal,target:p.target,proposalStats:{bestError:p.bestError,fitCount:p.fitCount,endpointCount:p.endpointCount,routes:p.routes.length},failures,classification,bases,blindEvaluations:blind.evaluations};
}
type Assessed=ReturnType<typeof assess>;
type TrialResult={trial:RegionPalette;reachability:{goal:string;bestError:number;fits:number;endpoints:number;routes:number;rideBases:number;shiftBases:number}[];holes:Assessed[]};
const trials:TrialResult[]=[];
console.log('SHORTLIST',selection.enumerated,'combinations ->',selection.selected.length,'full-search palettes');
for(const trial of selection.selected){
 const cache=`outputs/backward-regions/${trial.id.replace(/[^a-zA-Z0-9-]/g,'-')}.json`;
 if(existsSync(cache)){const old=JSON.parse(readFileSync(cache,'utf8'));if(old.sourceHash===sourceHash){trials.push(old.result);console.log('CACHED',trial.id);continue;}}
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:trial.name,subtitle:'Offline fixed-target inverse search',paints:trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
 try{
  const proposals:Proposal[]=GOALS.map(([goal,rgb],index)=>({goal,...backwardRegions(slot,colorPoint(rgb),PROTOCOL.seed+index)}));
  const reachability=proposals.map(p=>({goal:p.goal,bestError:p.bestError,fits:p.fitCount,endpoints:p.endpointCount,routes:p.routes.length,rideBases:new Set(p.routes.filter(r=>r.rideProxy>=34).map(r=>r.order[0])).size,shiftBases:new Set(p.routes.filter(r=>r.shiftProxy>0).map(r=>r.order[0])).size}));
  const selected=new Set<string>();
  for(const style of styles){
   const ranked=reachability.filter(r=>(style==='ride'?r.rideBases:r.shiftBases)>0).sort((a,b)=>(style==='ride'?b.rideBases-a.rideBases:b.shiftBases-a.shiftBases)||a.bestError-b.bestError);
   for(const r of ranked.slice(0,PROTOCOL.perPaletteStyleFinalists))selected.add(r.goal);
  }
  console.log('PROPOSED',trial.id,trial.name,'reachable',reachability.filter(r=>r.routes).length,'finalists',[...selected].join(','));
  const holes:Assessed[]=[];
  for(const p of proposals.filter(p=>selected.has(p.goal))){const h=assess(slot,p);holes.push(h);console.log('CHECK',trial.id,p.goal,JSON.stringify({fail:h.failures,ride:h.classification.ride,shift:h.classification['value-shift']}));}
  const result={trial,reachability,holes};trials.push(result);writeFileSync(cache,JSON.stringify({sourceHash,result}));
 }finally{PLAY_LEVELS.splice(slot,1);}
}
// Retain every assessed candidate, including isolated wins and rejected holes.
// Deeper independent check for a small union of promising style finalists.
const finalists=trials.flatMap(t=>t.holes.filter(h=>styles.some(s=>h.classification[s].eligible)).map(h=>({trial:t.trial,hole:h})));
finalists.sort((a,b)=>Math.max(...styles.map(s=>b.hole.classification[s].resistant.length/b.trial.paints.length))-Math.max(...styles.map(s=>a.hole.classification[s].resistant.length/a.trial.paints.length))||Math.min(...b.hole.bases.map(b=>b.minTravel??0))-Math.min(...a.hole.bases.map(b=>b.minTravel??0)));
const deep=[];
for(const f of finalists.slice(0,6)){
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:f.trial.name,subtitle:'Offline finalist',paints:f.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
 try{
  const search=blindSearch(slot,f.hole.target,3,PROTOCOL.finalBlindSeed,{...BLIND_POLICY,samples:288,restarts:12,iterations:180,timeExponent:2});
  const baseCounts=f.hole.bases.map(b=>{const routes=search.routes.filter(r=>r.order[0]===b.base),fewest=routes.length?Math.min(...routes.map(r=>r.times.length)):null;return {base:b.base,oldRaw:b.rawFewest,blindRaw:fewest,shorter:fewest!==null&&(b.rawFewest===null||fewest<b.rawFewest)};});
  // Finish-region slice for a meaningful style witness. Includes exact setup
  // nearby in the archived witness even if a uniform grid misses its band.
  const witness=f.hole.bases.flatMap(b=>b.routes).filter(r=>r.witness.meaningfulPours>=2&&r.witness.times.length>=2&&(r.stable.ride===true||r.witness.traits['value-shift'])).sort((a,b)=>b.witness.finishWindowMs-a.witness.finishWindowMs)[0];
  const region=witness?{witness:witness.witness,slice:setupSlice(slot,f.hole.target,witness.witness.order,witness.witness.times.slice(0,-2),32,256)}:null;
  deep.push({palette:f.trial.id,goal:f.hole.goal,baseCounts,region,searchPolicy:search.policy,seed:search.seed});
  console.log('DEEP',f.trial.id,f.hole.goal,JSON.stringify(baseCounts));
 }finally{PLAY_LEVELS.splice(slot,1);}
}
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Live palette mutation');
const result={protocol:PROTOCOL,regionPolicy:REGION_POLICY,measurement:STABLE_POLICY,sourceFiles,sourceHash,seconds:(performance.now()-started)/1000,poolIds:selection.poolIds,enumerated:selection.enumerated,trials,deep,
 limitations:['Discrete shortlist from 32 existing pigments; pure-color proxies rank combinations, only selected palettes receive full inverse search. Not exhaustive palette optimization.',
 'Fixed RGB goal grid, not destinations recentered on fitted mixtures. Inverse search may miss reachable recipes; failures mean not found at this budget.',
 'Backward endpoints and predecessor clouds are sampled. Prefixes enumerate exact recipe orders with at most three total additions; disconnected inverse regions and longer routes can be missed.',
 'Independent numeric challenger sees only target and palette. Its routes and replayed proposal witnesses both inform final assessment, with independent counts recorded separately.',
 'Support and style measurements shared. Candidate selection and witness retention are bounded and can miss a meaningful alternative. Eligibility is not all-base style resistance.',
 'Up to six eligible finalists get a stronger blind count check and one setup/finish slice. Dense count agreement is not proof; extra style alternatives are not exhaustively audited.',
 'Existing controls and new palettes share the same target goals, but shortlist construction and targets are not a population sample. No human playtest or gameplay change.']};
writeFileSync('docs/play-backward-palette-results.json',JSON.stringify(result)+'\n');console.log('DONE',result.seconds,'seconds',finalists.length,'eligible palette/target candidates');
