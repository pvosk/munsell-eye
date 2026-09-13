import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE as T,mixtureColor,colorDistance} from '../app/play-engine';
import {blindReplay} from './recipe-blind-search';
import {normalizeRecipe} from '../app/play-inverse-planning';
const data=JSON.parse(readFileSync('docs/play-banked-backward-refinement.json','utf8'));
test('refinement source fingerprint matches and original fixed goals remain fixed',()=>{
 const source=readFileSync('scripts/refine-banked-setups.ts','utf8'),list=source.match(/export const REFINEMENT_SOURCES=\[([\s\S]*?)\];/)![1].match(/'[^']+'/g)!.map(s=>s.slice(1,-1));
 assert.equal(data.sourceHash,createHash('sha256').update(list.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex'));
 assert.equal(data.results.length,8);const previous=[...JSON.parse(readFileSync('docs/play-broad-palette-audit.json','utf8')).deep,...JSON.parse(readFileSync('docs/play-broad-expanded-audit.json','utf8')).deep];
 for(const r of data.results){if(!r.job.parent)assert.deepEqual(r.job.target,previous.find((a:any)=>a.proposal.id===r.job.id).proposal.target);assert.ok(colorDistance(mixtureColor(r.job.trial.paints,r.job.recipe),r.job.target)<1e-10);}
});
test('backward witnesses reconstruct endpoints and all kept competitors replay',()=>{
 const original=JSON.stringify(PLAY_LEVELS);let count=0;
 for(const r of data.results){const paints=r.job.trial.paints,slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'test',subtitle:'',paints,tolerance:T});
  try{for(const w of r.region.selected){const reconstructed=w.predecessor.map((x:number,i:number)=>(1-w.share)*x+(i===w.finish?w.share:0));const p=normalizeRecipe(w.endpoint);assert.ok(Math.hypot(...p.map((x,i)=>x-reconstructed[i]))<1e-9);}
   const witnesses=[...r.region.selected,...r.job.known,...r.checked.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((a:any)=>a.witness)])];
   for(const w of witnesses){assert.ok(colorDistance(mixtureColor(paints,blindReplay(slot,w.order,w.times)),r.job.target)<=T+1e-9);count++;}
  }finally{PLAY_LEVELS.splice(slot,1);}
 }assert.ok(count>100);assert.equal(JSON.stringify(PLAY_LEVELS),original);
});
