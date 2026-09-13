// Deeper backward regions for archived fixed destinations. Live engine unchanged.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,totalMass,LIVE_LANDING_TOLERANCE as T,type ColorPoint} from '../app/play-engine';
import {acceptedEndpointRecipes,normalizeRecipe,predecessorForFinish,recipePrefixes} from '../app/play-inverse-planning';
import {replayRoute} from '../app/play-course-analysis';
import {secondsForAmount} from '../app/play-route-design';
import {sampleJourney} from '../app/play-journey-analysis';
import {pathDescriptor} from './broad-palette-mine';
import {verify} from './backward-verification';
import type {RegionPalette} from './backward-region-proposals';
export const REFINEMENT_POLICY={version:'banked-backward-region-1',rays:32,peels:[.1,.25,.4,.55,.7,.85,1],maxAdditions:3,seed:91230017};
export const REFINEMENT_SOURCES=['scripts/refine-banked-setups.ts','scripts/backward-verification.ts','scripts/broad-palette-mine.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','app/play-inverse-planning.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts'];
export const refinementHash=()=>createHash('sha256').update(REFINEMENT_SOURCES.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex');
// Legacy frozen default infers the literal type 12; runtime accepts ray counts.
const expandRegions=acceptedEndpointRecipes as (...args:[number,readonly number[],number,number,number])=>ReturnType<typeof acceptedEndpointRecipes>;
const out='docs/play-banked-backward-refinement.json';
if(existsSync(out))throw Error('Preserve existing refinement');
const bank=[...JSON.parse(readFileSync('docs/play-broad-palette-audit.json','utf8')).deep,...JSON.parse(readFileSync('docs/play-broad-expanded-audit.json','utf8')).deep];
const ids=['mine-4-8-10-11-23-2','mine-11-19-27-8','mine-5-11-26-2','mine-7-10-12-26-7','mine-11-12-13-26-8','mine-0-3-11-22-26-4'];
type Control={order:number[];times:number[]};
type Job={id:string;trial:RegionPalette;target:ColorPoint;recipe:number[];known:Control[];parent:string|null};
const jobs:Job[]=ids.map(id=>{const a=bank.find(a=>a.proposal.id===id);if(!a)throw Error(id);return {id,trial:{id,name:a.paints.map((p:any)=>p.name).join(' / '),paints:a.paints,control:false,selection:'banked-backward',proxy:[]},target:a.proposal.target,recipe:a.proposal.recipe,known:[a.proposal,...a.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)])],parent:null};});
// Reachable neighboring goals are explicitly NEW goals, not recentered originals.
const warm=jobs[0],q=normalizeRecipe(warm.recipe),cool=warm.trial.paints.findIndex(p=>p.id==='cobalt-teal');
for(const [name,amount] of [['more-teal',.12],['more-warm',-.12]] as const){const recipe=[...q],change=amount>0?Math.min(amount,1-q[cool]):Math.max(amount,-q[cool]*.7);recipe[cool]+=change;for(let i=0;i<q.length;i++)if(i!==cool)recipe[i]-=change*q[i]/(1-q[cool]);jobs.push({id:warm.id+'-'+name,trial:warm.trial,target:mixtureColor(warm.trial.paints,recipe),recipe,known:[],parent:warm.id});}
const original=JSON.stringify(PLAY_LEVELS),start=Date.now(),results:any[]=[];
for(const [jobIndex,j] of jobs.entries()){
 console.log(`Backward refinement ${jobIndex+1}/${jobs.length}: ${j.id}`);
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:j.trial.name,subtitle:'Offline',paints:j.trial.paints,tolerance:T});
 let region:any;
 try{
  if(colorDistance(mixtureColor(j.trial.paints,j.recipe),j.target)>1e-8)throw Error('Fixed goal/recipe mismatch');
  const expanded=expandRegions(slot,j.recipe,REFINEMENT_POLICY.seed+jobIndex,T,REFINEMENT_POLICY.rays),routes=new Map<string,any>();
  for(const endpoint of expanded.endpoints)for(let finish=0;finish<j.recipe.length;finish++)for(const f of REFINEMENT_POLICY.peels){const share=endpoint[finish]*f,predecessor=predecessorForFinish(endpoint,finish,share);if(!predecessor)continue;
   for(const prefix of recipePrefixes(predecessor,2)){const before=replayRoute(slot,prefix.order,prefix.times),mass=totalMass(before),time=secondsForAmount(mass,mass*share/(1-share));if(time===null)continue;
    const order=[...prefix.order,finish],times=[...prefix.times,time],error=colorDistance(mixtureColor(j.trial.paints,replayRoute(slot,order,times)),j.target);if(error>T)continue;
    const {strokes,points}=sampleJourney(slot,{order,times}),descriptor=pathDescriptor(points.slice(-49)),setup=strokes.slice(0,-1).reduce((a,s)=>a+s.length,0);
    routes.set(order.join()+':'+times.join(),{order,times,error,endpoint,predecessor,share,finish,setup,descriptor});
   }
  }
  // Preserve different base/finish choices and goals, not only globally longest.
  const selected=new Map<string,any>();
  for(let base=0;base<j.recipe.length;base++)for(let finish=0;finish<j.recipe.length;finish++){
   const options=[...routes.values()].filter(r=>r.order[0]===base&&r.finish===finish);
   for(const rank of [(r:any)=>r.descriptor.value,(r:any)=>r.descriptor.valueOnly?0:r.descriptor.world,(r:any)=>r.descriptor.inward,(r:any)=>-r.times.length]){
    const r=options.sort((a,b)=>rank(b)-rank(a))[0];if(r)selected.set(r.order.join()+':'+r.times.join(),r);
   }
  }
  region={endpointCount:expanded.endpoints.length,routeCount:routes.size,selected:[...selected.values()]};
 }finally{PLAY_LEVELS.splice(slot,1);}
 const checked=verify(j.trial,j.id,j.target,[...j.known,...region.selected],null);
 const auditSlot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:j.trial.name,subtitle:'Offline',paints:j.trial.paints,tolerance:T});
 try{for(const b of checked.bases)for(const r of b.routes){const {strokes,points}=sampleJourney(auditSlot,r.witness),finish=pathDescriptor(points.slice(-49)),setup=strokes.slice(0,-1).reduce((a,s)=>a+s.length,0);
  Object.assign(r,{finishDescriptor:finish,setupTravel:setup,glide:r.witness.meaningfulPours>=2&&setup>=6&&finish.world>=30&&finish.ab>=.04&&!finish.valueOnly,
   finishPaint:j.trial.paints[r.witness.order.at(-1)!].name});
 }}finally{PLAY_LEVELS.splice(auditSlot,1);}
 results.push({job:j,region,checked});
 writeFileSync(out,JSON.stringify({policy:REFINEMENT_POLICY,sourceHash:refinementHash(),results,elapsedSeconds:(Date.now()-start)/1000}));
}
if(JSON.stringify(PLAY_LEVELS)!==original)throw Error('Live palettes changed');
console.log(JSON.stringify({jobs:jobs.length,seconds:(Date.now()-start)/1000}));
