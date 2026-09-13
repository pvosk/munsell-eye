import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readBankJson,readBankBytes} from './research-bank-io';
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay} from '../app/play-pigment-legs';

test('both long-leg studies preserve proposals and independently replayed shorter counterexamples',()=>{
 let total=0,screened=0,finalists=0;
 for(const dir of ['docs/long-leg-limits-1','docs/long-leg-limits-2']){
  const summary=readBankJson(dir+'/summary.json'),rows=readBankJson(dir+'/finalists.json');
  for(const legs of [4,5,6]){const proposals=JSON.parse(readBankBytes(dir+`/proposals-${legs}.json`,true).toString());assert.equal(proposals.length,1280);assert(proposals.every((p:{paints:unknown[]})=>p.paints.length===legs+1));total+=proposals.length;}
  const screens=readBankJson(dir+'/screens.json');assert.equal(screens.length,summary.screened);screened+=screens.length;
  assert.equal(rows.length,18);
  for(const row of rows){
   assert(row.route.length<=3&&row.route.length<row.p.legs);
   assert(colorDistance(mixtureColor(row.p.paints,legReplay(row.p.start,row.route)),row.p.target)<=T);
   const witness=row.independent.witness;assert(witness&&witness.order.length<row.p.legs);
   const route=witness.order.map((paint:number,i:number)=>({paint,share:witness.shares[i]}));
   assert(colorDistance(mixtureColor(row.p.paints,legReplay(row.p.start,route)),row.p.target)<=T);
   assert(colorDistance(mixtureColor(row.p.paints,legReplay(row.p.start,row.demonstration)),row.p.target)<1e-8);finalists++;
  }
 }
 assert.equal(total,7680);assert.equal(screened,673);assert.equal(finalists,36);
});
