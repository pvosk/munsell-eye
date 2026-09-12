// Offline multi-target portfolios. Discovery labels do not gate target banking.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS} from '../app/paint-mixing';
import {PLAY_LEVELS,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {inverseRoutes} from '../app/play-inverse-planning';
import {propose,audit,pathDescriptor} from './broad-palette-mine';
import {sampleJourney} from '../app/play-journey-analysis';
import {POOL_IDS,type RegionPalette} from './backward-region-proposals';
import {verify} from './backward-verification';
const output='docs/play-green-portfolios.json';if(existsSync(output))throw Error('Preserve existing portfolio run');
const sources=['scripts/search-green-portfolios.ts','scripts/broad-palette-mine.ts','scripts/backward-verification.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','app/play-inverse-planning.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts'];
const sourceHash=createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex');
const policy={version:'green-portfolios-1',samples:60,screenTargets:12,deepTargets:3,minimumTargetSeparation:T*2,seed:91231200};
const sets=[{indices:[11,19,27],role:'focus'}, {indices:[5,11,26],role:'focus'},{indices:[7,10,12,26],role:'focus'},{indices:[11,12,13,26],role:'focus'},
 {indices:[8,17,26],role:'exploratory'}, {indices:[3,16,23],role:'exploratory'},{indices:[0,9,16,24],role:'secondaries-reference'},{indices:[4,8,10,11,23],role:'warm-cool-reference'}];
const previous=[...JSON.parse(readFileSync('docs/play-broad-palette-audit.json','utf8')).deep,...JSON.parse(readFileSync('docs/play-broad-expanded-audit.json','utf8')).deep];
const original=JSON.stringify(PLAY_LEVELS),start=Date.now(),results:any[]=[];
const save=()=>writeFileSync(output,JSON.stringify({sources,sourceHash,policy,results,elapsedSeconds:(Date.now()-start)/1000}));
for(const [paletteIndex,set] of sets.entries()){
 const paints=set.indices.map(i=>PAINTS.find(p=>p.id===POOL_IDS[i])!),trial:RegionPalette={id:'portfolio-'+set.indices.join('-'),name:paints.map(p=>p.name).join(' / '),paints,control:set.role.includes('reference'),selection:set.role,proxy:[]};
 const proposals=Array.from({length:policy.samples},(_,sample)=>propose(set.indices,sample)),chosen:typeof proposals=[];
 // Preserve distinct light/dark/chromatic/muted/far/control proposals before
 // numerical tests; actual palette range, not a universal white/black demand.
 const metrics=[(p:typeof proposals[number])=>p.target.lab[0],(p:typeof proposals[number])=>-p.target.lab[0],(p:typeof proposals[number])=>Math.hypot(...p.target.lab.slice(1)),(p:typeof proposals[number])=>-Math.hypot(...p.target.lab.slice(1)),(p:typeof proposals[number])=>p.nearest,(p:typeof proposals[number])=>p.rank.control];
 for(const metric of metrics){const p=[...proposals].sort((a,b)=>metric(b)-metric(a)).find(p=>!chosen.some(q=>q.id===p.id));if(p)chosen.push(p);}
 while(chosen.length<policy.screenTargets){const p=[...proposals].filter(p=>!chosen.some(q=>q.id===p.id)).sort((a,b)=>Math.min(...chosen.map(q=>colorDistance(b.target,q.target)))-Math.min(...chosen.map(q=>colorDistance(a.target,q.target))))[0];if(!p)break;chosen.push(p);}
 const screened=chosen.map((p,i)=>{console.log(`Portfolio ${paletteIndex+1}/8 screen ${i+1}/12: ${p.id}`);return audit(p,false);});
 const prioritized=[...screened].sort((a,b)=>a.flags.length-b.flags.length||Math.max(b.availability.glide.length,b.availability.balance.length)/paints.length-Math.max(a.availability.glide.length,a.availability.balance.length)/paints.length||b.proposal.nearest-a.proposal.nearest);
 const selected:typeof screened=[];for(const candidate of prioritized){if(selected.every(s=>colorDistance(s.proposal.target,candidate.proposal.target)>=policy.minimumTargetSeparation))selected.push(candidate);if(selected.length===policy.deepTargets)break;}
 const deep:any[]=[];
 for(const screen of selected){const p=screen.proposal,slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:trial.name,subtitle:'Offline',paints,tolerance:T});let inverse:any;
  try{inverse=inverseRoutes(slot,p.recipe,policy.seed+paletteIndex*60+p.sample,T);}finally{PLAY_LEVELS.splice(slot,1);}
  // Keep short witnesses and a range of finishing paints without forwarding
  // the target recipe to the independent numerical challenger itself.
  const extras:any[]=[];
  for(let base=0;base<paints.length;base++)for(let finish=0;finish<paints.length;finish++){
   const routes=inverse.routes.filter((r:any)=>r.order[0]===base&&r.order.at(-1)===finish).sort((a:any,b:any)=>a.times.length-b.times.length||a.error-b.error);extras.push(...routes.slice(0,2));
  }
  const old=previous.find(a=>a.proposal.id===p.id),known=[p,...screen.bases.flatMap(b=>[...b.rawWitnesses,...b.routes.map(r=>r.witness)]),...(old?old.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)]):[])];
  console.log(`Portfolio ${paletteIndex+1}/8 deeper: ${p.id}`);
  const checked=verify(trial,p.id,p.target,[...known,...extras],null),measureSlot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:trial.name,subtitle:'Offline',paints,tolerance:T});
  try{for(const b of checked.bases)for(const r of b.routes){const {strokes,points}=sampleJourney(measureSlot,r.witness),finish=pathDescriptor(points.slice(-49)),setup=strokes.slice(0,-1).reduce((s,p)=>s+p.length,0);Object.assign(r,{finishDescriptor:finish,setupTravel:setup,glide:r.witness.meaningfulPours>=2&&setup>=6&&finish.world>=30&&finish.ab>=.04&&!finish.valueOnly});}}
  finally{PLAY_LEVELS.splice(measureSlot,1);}
  deep.push({proposal:p,known,inverse:{endpointCount:inverse.endpoints,routeCount:inverse.routes.length,witnesses:extras},checked});
 }
 const viable=deep.filter(d=>!d.checked.failures.length),distances=viable.flatMap((a,i)=>viable.slice(i+1).map(b=>colorDistance(a.proposal.target,b.proposal.target)/T));
 results.push({trial,role:set.role,proposals,screened,deep,portfolio:{candidateIds:viable.map(d=>d.proposal.id),count:viable.length,minimumPairSeparation:distances.length?Math.min(...distances):null,
  caveat:'General-check survivors, not all-base style-resistant or player-approved holes; fewer than three is an explicit gap.'}});save();
}
if(original!==JSON.stringify(PLAY_LEVELS))throw Error('Live palette mutation');console.log(JSON.stringify({palettes:results.length,screened:results.reduce((s,r)=>s+r.screened.length,0),deep:results.reduce((s,r)=>s+r.deep.length,0),seconds:(Date.now()-start)/1000}));
