// Fresh-seed shortcut challenge and endpoint replay; never trusts labels.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {blindReplay,blindSearch,BLIND_POLICY} from './recipe-blind-search';
const input=JSON.parse(readFileSync('docs/play-new-palette-hardness.json','utf8'));
assert.equal(input.results.length,16);assert(input.results.every((r:any)=>r.deep.length===2));
const output='docs/play-new-palette-hardness-challenge.json';if(existsSync(output))throw Error('Preserve challenge archive');
const original=JSON.stringify(PLAY_LEVELS),results:any[]=[],seed=77120913;
let replayed=0;
for(const row of input.results){
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:row.trial.name,subtitle:'Offline challenge',paints:row.trial.paints,tolerance:T});
 try{for(const h of row.deep){
  assert(colorDistance(mixtureColor(row.trial.paints,h.proposal.recipe),h.proposal.target)<1e-12);
  for(const b of h.checked.bases)for(const r of [...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)]){
   assert.equal(r.order[0],b.base);
   const error=colorDistance(mixtureColor(row.trial.paints,blindReplay(slot,r.order,r.times)),h.proposal.target);
   assert(error<=T+1e-10,`${h.proposal.id} invalid endpoint ${error}`);replayed++;
  }
  if(!h.qualified)continue;
  // Checks all one/two-addition orders, including repeated colors. Three-pour
  // existence/support comes from the deeper first pass, not this challenger.
  const challenge=blindSearch(slot,h.proposal.target,2,seed,{...BLIND_POLICY,samples:384,restarts:14,iterations:200,timeExponent:1});
  const raw=row.trial.paints.map((_:any,b:number)=>{const rs=challenge.routes.filter(r=>r.order[0]===b);return rs.length?Math.min(...rs.map(r=>r.times.length)):null;});
  const retained=!raw.some((v:number|null)=>v===1),threeAllRetained=h.threeAll&&raw.every((v:number|null)=>v===null);
  const meaningfulFloor=Math.min(...h.checked.bases.flatMap((b:any)=>b.routes.map((r:any)=>r.witness.meaningfulPours)));
  results.push({id:h.proposal.id,trialId:row.trial.id,raw,retained,threeAllRetained,meaningfulFloor,threeMeaningfulAll:threeAllRetained&&meaningfulFloor>=3,challenge});
  console.log(JSON.stringify({id:h.proposal.id,retained,threeAllRetained,raw}));
 }}finally{PLAY_LEVELS.splice(slot,1);}
}
assert.equal(JSON.stringify(PLAY_LEVELS),original);
writeFileSync(output,JSON.stringify({seed,inputSourceHash:input.sourceHash,replayed,results}));
console.log(JSON.stringify({replayed,retained:results.filter(r=>r.retained).length,threeAllRetained:results.filter(r=>r.threeAllRetained).length}));
