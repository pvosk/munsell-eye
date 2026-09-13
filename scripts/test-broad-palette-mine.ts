import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {PAINTS} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorDistance,colorPoint,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {blindReplay} from './recipe-blind-search';
import {POOL_IDS} from './backward-region-proposals';
import {paletteSets,propose,pathDescriptor,fingerprint} from './broad-palette-mine';

test('all 3/4-paint combinations and balanced larger sample are distinct',()=>{
 const sets=paletteSets();assert.equal(sets.length,42456);assert.equal(new Set(sets.map(s=>s.join())).size,sets.length);
 for(const [size,count] of [[3,4960],[4,35960],[5,512],[6,512],[8,512]])assert.equal(sets.filter(s=>s.length===size).length,count);
 assert.deepEqual(sets,paletteSets());
});
test('neutral axial travel is not automatically an interesting glide',()=>{
 const p=pathDescriptor([colorPoint([0,0,0]),colorPoint([128,128,128]),colorPoint([255,255,255])]);assert.equal(p.valueOnly,true);assert.ok(p.world>30);assert.ok(p.ab<.015);
});
test('proposal witnesses are deterministic legal original-pigment mixes',()=>{
 const original=JSON.stringify(PLAY_LEVELS);
 for(const indices of [[0,1,2],[4,12,18,25],[0,3,7,12,18,23,25,31]])for(let i=0;i<12;i++){
  const p=propose(indices,i);assert.deepEqual(p,propose(indices,i));const paints=indices.map(j=>PAINTS.find(p=>p.id===POOL_IDS[j])!);
  const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'test',subtitle:'',paints,tolerance:T});
  try{const q=blindReplay(slot,p.order,p.times);assert.deepEqual(q,p.recipe);assert.ok(colorDistance(mixtureColor(paints,q),p.target)<1e-10);}finally{PLAY_LEVELS.splice(slot,1);}
 }assert.equal(JSON.stringify(PLAY_LEVELS),original);
});
test('bank covers every proposal, and sampled archive witnesses reproduce',async()=>{
 const s=JSON.parse(readFileSync('docs/play-broad-palette-screen.json','utf8')),index=JSON.parse(readFileSync('docs/play-broad-bank-index.json','utf8'));assert.equal(s.sourceHash,fingerprint());assert.equal(index.sourceHash,fingerprint());let count=0;
 for(const shard of index.shards){assert.equal(createHash('sha256').update(readFileSync(shard.path)).digest('hex'),shard.sha256);let local=0;
  for await(const line of createInterface({input:createReadStream(shard.path).pipe(createGunzip()),crlfDelay:Infinity})){
   if(count%4096===0){const row=JSON.parse(line),p=propose(row[0],row[1]);assert.deepEqual(row,[p.indices,p.sample,p.order,p.times,p.recipe,p.target.rgb]);}count++;local++;
  }assert.equal(local,shard.count);
 }assert.equal(count,509472);assert.equal(Object.values(s.bands).reduce((a:any,b:any)=>a+b,0),count);
});
test('all screened and deep raw/efficient witnesses replay against fixed targets',()=>{
 const s=JSON.parse(readFileSync('docs/play-broad-palette-screen.json','utf8')),d=JSON.parse(readFileSync('docs/play-broad-palette-audit.json','utf8')),expanded=JSON.parse(readFileSync('docs/play-broad-expanded-audit.json','utf8'));
 assert.equal(d.sourceHash,fingerprint());assert.equal(d.deep.length,20);const original=JSON.stringify(PLAY_LEVELS);let count=0;
 assert.equal(expanded.parentSourceHash,fingerprint());assert.equal(expanded.sourceHash,createHash('sha256').update(readFileSync('scripts/expand-broad-audits.ts')).digest('hex'));assert.equal(expanded.deep.length,10);
 for(const a of [...s.screens,...d.deep,...expanded.screens,...expanded.deep]){const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'archive-test',subtitle:'',paints:a.paints,tolerance:T});
  try{for(const b of a.bases)for(const w of [...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)]){assert.ok(colorDistance(mixtureColor(a.paints,blindReplay(slot,w.order,w.times)),a.proposal.target)<=T+1e-9);count++;}}finally{PLAY_LEVELS.splice(slot,1);}
 }assert.ok(count>100);assert.equal(JSON.stringify(PLAY_LEVELS),original);
});
