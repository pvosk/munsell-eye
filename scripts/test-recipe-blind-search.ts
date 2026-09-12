import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import {blindReplay,blindSearch,setupSlice,BLIND_POLICY} from './recipe-blind-search';

test('blind replay agrees with live forward physics including repeated paints',()=>{
 for(const order of [[0,0,1],[1,2,1],[2,1,0,2]]){
  const times=order.slice(1).map((_,i)=>.25+i*.4);
  assert.deepEqual(blindReplay(0,order,times),replayRoute(0,order,times));
 }
});
test('recipe-blind solver recovers planted one and two addition endpoints',()=>{
 const paints=PLAY_LEVELS[0].paints,signature=JSON.stringify(PLAY_LEVELS);
 for(const order of [[0,1],[0,1,2]]){
  const target=mixtureColor(paints,blindReplay(0,order,order.slice(1).map((_,i)=>.51+i*.18)));
  const result=blindSearch(0,target,2,912,{...BLIND_POLICY,samples:48,restarts:4});
  assert.ok(result.routes.some(r=>r.order[0]===0&&r.order.length<=order.length));
  for(const r of result.routes)assert.ok(colorDistance(mixtureColor(paints,replayRoute(0,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE);
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);
});
test('global setup slice reports actual successful doses, not label or local-coverage guesses',()=>{
 const order=[0,1,2],target=mixtureColor(PLAY_LEVELS[0].paints,blindReplay(0,order,[.55,.55]));
 const slice=setupSlice(0,target,order,[],8,64);
 assert.ok(slice.cells.some(c=>c.accepted.length));
 for(const c of slice.cells)for(const finish of c.accepted)assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[0].paints,blindReplay(0,order,[c.setup,finish])),target)<=LIVE_LANDING_TOLERANCE);
});
test('blind search module cannot import existing proposal or validation routines',()=>{
 const imports=readFileSync('scripts/recipe-blind-search.ts','utf8').split('\n').filter(l=>l.startsWith('import '));
 assert.equal(imports.length,1);assert.ok(imports[0].includes("from '../app/play-engine'"));
});
test('normalizing quantity preserves color without disabling tinting strength',()=>{
 const paints=PLAY_LEVELS[0].paints,q=[2,3,1],normalized=q.map(x=>x/6);
 assert.ok(colorDistance(mixtureColor(paints,q),mixtureColor(paints,normalized))<1e-12);
 const changed=paints.map((p,i)=>({...p,strength:i===0?p.strength*3:p.strength}));
 assert.ok(colorDistance(mixtureColor(paints,normalized),mixtureColor(changed,normalized))>.001);
});
