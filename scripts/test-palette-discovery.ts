import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryRecipes,shortlist,allBaseEligible,compareResults} from './discover-play-palettes';
import {PLAY_LEVELS} from '../app/play-engine';

test('balanced four-paint cohorts have distinct deterministic training and holdout recipes',()=>{
  const train=discoveryRecipes(20260914),held=discoveryRecipes(20270119,2);
  assert.equal(train.length,24);assert.equal(held.length,48);assert.deepEqual(train,discoveryRecipes(20260914));
  for(const recipes of [train,held]){
    for(const q of recipes){assert.equal(q.length,4);assert.ok(Math.abs(q.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(q.every(x=>x>=0));}
    const inclusion=[0,1,2,3].map(i=>recipes.filter(q=>q[i]>0).length);assert.equal(new Set(inclusion).size,1);
  }
  assert.equal(held.some(q=>train.some(p=>p.every((v,i)=>Math.abs(v-q[i])<1e-9))),false);
});
test('a single unsupported starting paint cannot be averaged away',()=>{
  const a={failures:[],qualifyingBases:[0,1,2,3],bases:[0,1,2,3].map(()=>({qualifies:true}))};
  assert.equal(allBaseEligible(a),true);
  assert.equal(allBaseEligible({...a,bases:a.bases.map((b,i)=>({...b,qualifies:i!==3}))}),false);
  assert.equal(allBaseEligible({...a,failures:['short-competing-route']}),false);
  assert.equal(allBaseEligible({failures:[],qualifyingBases:[],bases:[]}),false);
});
test('screening produces twelve genuinely new diverse palettes without mutating the game',()=>{
  const old=JSON.stringify(PLAY_LEVELS),s=shortlist(),novel=s.trials.filter(p=>!p.control);
  assert.equal(novel.length,12);assert.equal(s.trials.length,15);assert.equal(JSON.stringify(PLAY_LEVELS),old);
  assert.equal(new Set(novel.map(p=>p.paints.map(p=>p.id).sort().join())).size,12);
  for(const p of novel){assert.equal(p.paints.length,4);assert.equal(PLAY_LEVELS.some(l=>l.paints.map(p=>p.id).sort().join()===p.paints.map(p=>p.id).sort().join()),false);}
});
test('every-base yield outranks timing averages in selection',()=>{
  const a={allBasePasses:2,tested:24,medianWorstFinishMs:55,valueSpan:.1},b={...a,allBasePasses:1,medianWorstFinishMs:1000,valueSpan:1};
  assert.ok(compareResults(a as Parameters<typeof compareResults>[0],b as Parameters<typeof compareResults>[1])<0);
});
