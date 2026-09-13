import test from 'node:test';import assert from 'node:assert/strict';import {readdirSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {contributionRecipe,legReplay} from '../app/play-pigment-legs';
const dir='docs/bidirectional-exclusion-2';
test('raw proposals, gate decisions and all counterexamples replay',()=>{
 const palettes=readBankJson('docs/branching-region-comparison-2/manifest.json').palettes;let count=0,selected=0;
 for(const file of readdirSync(dir).filter(f=>/^selection-\d+\.json$/.test(f))){
  const r=readBankJson(dir+'/'+file),paints=palettes[r.palette].paints,target=mixtureColor(paints,r.targetRecipe);count+=r.raw.length;
  for(const p of r.raw)if(p.start)assert(colorDistance(mixtureColor(paints,legReplay(p.start,p.legs)),target)<=T+1e-8);
  const expected=r.candidates.find((p:any)=>p.marginT>1);assert.equal(r.exclusion?.id,expected?.id);
  for(const key of ['baseline','exclusion'])if(r[key]){
   const p=r.candidates.find((p:any)=>p.id===r[key].id);
   for(const c of r[key].counterexamples)assert(colorDistance(mixtureColor(paints,legReplay(p.start,c.order.map((paint:number,i:number)=>({paint,share:c.shares[i]})))),target)<=T+1e-8);
  }
  if(r.exclusion)selected++;
 }
 assert.equal(count,12288);assert.equal(selected,6);
});
test('both fixed-case solvers have valid measured witnesses and raw free-base witnesses',()=>{
 for(let i=0;i<20;i++){
  const r=readBankJson(`${dir}/fixed-${i}.json`),p=r.p;
  for(const method of ['direct','bidirectional'])for(const m of r[method].measured)assert(colorDistance(mixtureColor(p.paints,legReplay(p.start,m.legs)),p.target)<=T+1e-8);
  r.freeBases.forEach((b:any,j:number)=>{if(b.witness){const start=p.start.map((_:number,k:number)=>j===k?1:0);assert(colorDistance(mixtureColor(p.paints,contributionRecipe(start,b.witness.paints,b.witness.weights)),p.target)<=T+1e-8);}});
 }
});
