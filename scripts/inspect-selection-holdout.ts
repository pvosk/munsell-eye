import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor} from '../app/play-engine';
import {makeAtlas,routeDetails} from '../app/play-course-analysis';
import {analyzeJourney,measureJourney} from '../app/play-journey-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {compareSelection,STYLES,SELECTION_POLICY,compactWitness} from './supported-selection';
import {stableRide,STABLE_POLICY} from './stable-route-measurement';
import {blindSearch,BLIND_POLICY} from './recipe-blind-search';

const PROTOCOL={version:'selection-holdout-1',seeds:[91226031,91226079],palettes:['UltraOx Dual','Zorny','CMY','Secondaries','Maroon Arc','Cobalt Ember'],targetsPerSeed:2,atlas:[128,24],threeSeed:91226119,blindSeeds:[91226201,91226333],blindMaxPours:3};
const started=performance.now(),signature=JSON.stringify(PLAY_LEVELS);
const randomFor=(seed:number)=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};
type Comparison=ReturnType<typeof compareSelection>;
type Row={id:string;palette:number;name:string;seed:number;stratum:string;recipe:number[];target:ReturnType<typeof mixtureColor>;minTravel:number;
 legacy:Pick<ReturnType<typeof analyzeJourney>,'failures'|'styles'>;stableRaw:Comparison['stableRaw'];stableSupported:Comparison['stableSupported'];
 bases:(Omit<Comparison['bases'][number],'routes'>&{routes:{witness:ReturnType<typeof compactWitness>;stable:ReturnType<typeof stableRide>}[]})[]};
const rows:Row[]=[];
for(const name of PROTOCOL.palettes){
 const palette=PLAY_LEVELS.findIndex(p=>p.name===name),n=PLAY_LEVELS[palette].paints.length,atlas=makeAtlas(palette,128,24);
 for(const seed of PROTOCOL.seeds){
  const random=randomFor(seed+palette*7919),indices=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
  for(let stratum=0;stratum<2;stratum++){
   const weights=indices.map((_,i)=>stratum===0&&!indices.slice(0,2).includes(i)?0:Math.exp((random()-.5)*3)),sum=weights.reduce((a,b)=>a+b,0),recipe=weights.map(x=>x/sum);
   const audit=analyzeJourney(palette,recipe,atlas,PROTOCOL.threeSeed),comparison=compareSelection(audit);
   const row={id:`sh-${palette}-${seed}-${stratum}`,palette,name,seed,stratum: stratum===0?'two-ingredient':'all-ingredient',recipe,target:audit.target,minTravel:audit.minTravel,
    legacy:{failures:audit.failures,styles:audit.styles},stableRaw:comparison.stableRaw,stableSupported:comparison.stableSupported,
    bases:comparison.bases.map(b=>({...b,routes:b.routes.map(r=>({witness:compactWitness(r.route),stable:r.stable}))}))};
   rows.push(row);console.log(row.id,name,'eligible',STYLES.map(s=>`${s}:${+row.legacy.styles[s].eligible}/${+row.stableRaw.styles[s].eligible}/${+row.stableSupported.styles[s].eligible}`).join(' '));
  }
 }
}
const selections:{method:'legacy'|'stableRaw'|'stableSupported';style:typeof STYLES[number];id:string|null}[]=[];
for(const method of ['legacy','stableRaw','stableSupported'] as const)for(const style of STYLES){
 const pool=rows.filter(r=>r[method].styles[style].eligible);
 pool.sort((a,b)=>b[method].styles[style].resistant.length-a[method].styles[style].resistant.length||b[method].styles[style].available.length-a[method].styles[style].available.length||b.minTravel-a.minTravel||a.id.localeCompare(b.id));
 selections.push({method,style,id:pool[0]?.id??null});
}
// Challenge the union of top selections; no witnesses/recipes passed to the
// challenger. Missing candidates stay missing rather than weakening filters.
const validations=[];
for(const row of rows.filter(r=>selections.some(s=>s.id===r.id))){
 const searches=PROTOCOL.blindSeeds.map(seed=>blindSearch(row.palette,row.target,3,seed,{...BLIND_POLICY,samples:144,restarts:8,iterations:140,timeExponent:2}));
 const bases=row.bases.map(base=>{
  const found=searches.flatMap(s=>s.routes).filter(r=>r.order[0]===base.base),fewest=found.length?Math.min(...found.map(r=>r.times.length)):null;
  const orders=new Map<string,typeof found[number]>();
  for(const r of found){const key=r.order.join(),old=orders.get(key);if(!old||r.error<old.error)orders.set(key,r);}
  const supported=[...orders.values()].map(r=>{
   const m=measureJourney(row.palette,measureDesignRoute(row.palette,routeDetails(row.palette,r.order,r.times,row.target,LIVE_LANDING_TOLERANCE),row.target),row.target);
   if(m.finishWindowMs>=55&&m.times.length>1)m.setup=measureSetup(row.palette,m,row.target,LIVE_LANDING_TOLERANCE);
   return m;
  }).filter(experienceSupported);
  const supportedFewest=supported.length?Math.min(...supported.map(r=>r.times.length)):null;
  return {base:base.base,rawFewest:base.rawFewest,supportedFewest:base.supportedFewest,blindRawFewest:fewest,blindSupportedFewest:supportedFewest,
   shorterRaw:fewest!==null&&(base.rawFewest===null||fewest<base.rawFewest),shorterSupported:supportedFewest!==null&&(base.supportedFewest===null||supportedFewest<base.supportedFewest),
   witnesses:supported.map(r=>({witness:compactWitness(r),stable:stableRide(row.palette,r)}))};
 });
 validations.push({id:row.id,bases,evaluations:searches.reduce((n,s)=>n+s.evaluations,0)});
 console.log('VALIDATE',row.id,JSON.stringify(bases.map(b=>({base:b.base,raw:b.rawFewest,blind:b.blindRawFewest,supported:b.supportedFewest,blindSupported:b.blindSupportedFewest,shorter:b.shorterRaw||b.shorterSupported}))));
}
const summary=Object.fromEntries((['legacy','stableRaw','stableSupported'] as const).map(method=>[method,Object.fromEntries(STYLES.map(style=>[style,{eligible:rows.filter(r=>r[method].styles[style].eligible).length,allResistant:rows.filter(r=>r[method].styles[style].allResistant).length}]))]));
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Palette changed');
const sourceFiles=['scripts/inspect-selection-holdout.ts','scripts/supported-selection.ts','scripts/stable-route-measurement.ts','scripts/recipe-blind-search.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-journey-analysis.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-course-analysis.ts','app/play-route-audit.ts','app/play-finish-profile.ts','app/play-experience-audit.ts'];
writeFileSync('docs/play-selection-holdout-results.json',JSON.stringify({protocol:PROTOCOL,measurement:STABLE_POLICY,selection:SELECTION_POLICY,sourceFiles,sourceHash:createHash('sha256').update(sourceFiles.map(f=>readFileSync(f)).join('\n')).digest('hex'),seconds:(performance.now()-started)/1000,summary,selections,validations,rows,
 limitations:['Fresh seeds and fixed targets; 24-target feasibility cohort, not human quality validation or a universal palette ranking.',
 'All three selection views use the SAME retained route pool. Retention remains influenced by historical labels and may omit relevant variants. This isolates rescoring, not full new-generator performance.',
 'Stable ride uses linear threshold crossing and numerical convergence margins, not certified global integration error bounds.',
 'Supported minimum is shortest FOUND among retained timing-supported routes, not proof of global minimum. Raw expert shortcuts remain visible.',
 'Interior supported selection relaxes raw-three/no-two requirement only in the experimental ordinary-play view; it does not certify all-base mathematical shortcut resistance.',
 'Blind challenger receives only palette and target, but support measurements remain shared. It can miss valid routes; no discovery is not absence proof.',
 'No runtime changes, deployment, new lab, pigment edits, mass edits, or new palettes.']} ,null,2)+'\n');
console.log('SUMMARY',JSON.stringify(summary));
