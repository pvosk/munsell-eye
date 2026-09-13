import test from 'node:test';import assert from 'node:assert/strict';import {readdirSync} from 'node:fs';
import {readBankJson,readBankBytes} from './research-bank-io';
import {legReplay} from '../app/play-pigment-legs';import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
test('paired bank has matched palettes, replayable witnesses and run-qualified IDs',()=>{
 const dirs=['docs/branching-region-comparison-1','docs/branching-region-comparison-2'];let original:any;const ids=new Set<string>();
 for(const dir of dirs){const m=readBankJson(dir+'/manifest.json'),s=readBankJson(dir+'/summary.json');if(original)assert.deepEqual(m.palettes,original);else original=m.palettes;
  assert.equal(m.palettes.length,256);for(const n of [3,4,5,6])assert.equal(m.palettes.filter((p:any)=>p.paints.length===n).length,64);
  let total=0;
  for(let i=0;i<m.palettes.length;i++){const rows=JSON.parse(readBankBytes(`${dir}/proposals-${i}.json`,true).toString('utf8'));total+=rows.length;for(const p of rows){const id=dir+'/'+p.id;assert(!ids.has(id));ids.add(id);assert.equal(p.palette,i);const paints=m.palettes[i].paints,target=mixtureColor(paints,p.targetRecipe);assert(p.start.every((v:number)=>Number.isFinite(v)&&v>=-1e-9));assert(Math.abs(p.start.reduce((a:number,b:number)=>a+b,0)-1)<1e-8);assert(colorDistance(mixtureColor(paints,legReplay(p.start,p.demonstration)),target)<=T+1e-8);assert(p.demonstration.every((l:any,i:number,a:any[])=>!i||l.paint!==a[i-1].paint));}}
  assert.equal(total,s.proposals);
  for(const f of readdirSync(dir).filter(f=>/^audit-\d+\.json$/.test(f))){const a=readBankJson(dir+'/'+f);for(const r of a.measured)assert(colorDistance(mixtureColor(a.p.paints,legReplay(a.p.start,r.legs)),a.p.target)<=T+1e-8);}
 }
});
