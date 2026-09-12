import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE as T,mixtureColor,colorDistance} from '../app/play-engine';
import {blindReplay} from './recipe-blind-search';
for(const file of ['docs/play-green-portfolios.json','docs/play-expanded-portfolios.json']){
 test(file+' fingerprints, endpoints and rivals replay',()=>{
  const d=JSON.parse(readFileSync(file,'utf8')),original=JSON.stringify(PLAY_LEVELS);
  // Search preceded the append-only round-10 integration. Verify its exact
  // historical engine source, then replay every witness against today's engine.
  const source=(p:string)=>p==='app/play-engine.ts'?execFileSync('git',['show','a378b71:app/play-engine.ts'],{encoding:'utf8'}):readFileSync(p,'utf8');
  assert.equal(d.sourceHash,createHash('sha256').update(d.sources.map((p:string)=>p+source(p)).join('\n')).digest('hex'));
  assert.equal(d.results.length,8);let witnesses=0;
  for(const r of d.results){
   assert.equal(r.proposals.length,60);assert.equal(r.screened.length,12);
   for(const p of r.proposals)assert.ok(colorDistance(mixtureColor(r.trial.paints,p.recipe),p.target)<1e-9);
   assert.deepEqual(r.portfolio.candidateIds,r.deep.filter((x:any)=>!x.checked.failures.length).map((x:any)=>x.proposal.id));
   const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'test',subtitle:'',paints:r.trial.paints,tolerance:T});
   try{for(const h of r.deep)for(const w of [...h.known,...h.inverse.witnesses,...h.checked.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((x:any)=>x.witness)])]){
    assert.ok(colorDistance(mixtureColor(r.trial.paints,blindReplay(slot,w.order,w.times)),h.proposal.target)<=T+1e-9,h.proposal.id);witnesses++;
   }}finally{PLAY_LEVELS.splice(slot,1);}
  }assert.ok(witnesses>100);assert.equal(JSON.stringify(PLAY_LEVELS),original);
 });
}
