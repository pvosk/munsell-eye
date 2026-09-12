import test from 'node:test';
import assert from 'node:assert/strict';
import {predecessorForFinish,normalizeRecipe,recipePrefixes,inverseRoutes,acceptedEndpointRecipes,exactRecipeRoutes} from '../app/play-inverse-planning';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE,chargeAmount} from '../app/play-engine';
import {replayRoute,witnessRoutes} from '../app/play-course-analysis';
import {secondsForAmount} from '../app/play-route-design';
const near=(a:number[],b:number[],epsilon=1e-8)=>assert.ok(a.every((x,i)=>Math.abs(x-b[i])<epsilon),JSON.stringify({a,b}));
test('backward mixture step reconstructs the requested proportions',()=>{
  for(const share of [.1,.3,.5]){const p=[.2,.5,.3],before=predecessorForFinish(p,1,share)!;near(before.map((x,i)=>(1-share)*x+(i===1?share:0)),p);}
  assert.equal(predecessorForFinish([.2,.5,.3],1,.6),null);
  assert.equal(predecessorForFinish([0,1,0],1,1),null);
  assert.equal(predecessorForFinish([.2,.5,.3],-1,.1),null);
  assert.throws(()=>normalizeRecipe([0,0]));assert.throws(()=>normalizeRecipe([NaN,1]));
});
test('legal dose inversion preserves the existing charge curve at different masses',()=>{
  for(const mass of [1,4,30])for(const time of [0,.15,.7,1.9,2.2]){const amount=chargeAmount(mass,time),back=secondsForAmount(mass,amount)!;assert.ok(Math.abs(chargeAmount(mass,back)-amount)<1e-7);}
  assert.equal(secondsForAmount(1,9),null);
});
test('exact-recipe baseline is equivalent to existing analytical witnesses',()=>{
  const p=[.2,.3,.5],target=mixtureColor(PLAY_LEVELS[0].paints,p);
  const old=witnessRoutes(0,p,target,LIVE_LANDING_TOLERANCE),now=exactRecipeRoutes(0,p,target);
  assert.equal(now.length,old.length);for(const r of now){const match=old.find(o=>o.order.join()===r.order.join())!;near(r.times,match.times);}
  for(const r of recipePrefixes(p))near(normalizeRecipe(replayRoute(0,r.order,r.times)),p);
});
test('acceptance rays keep the fixed target and reproduce deterministically',()=>{
  const p=[.2,.3,.5],a=acceptedEndpointRecipes(0,p,847),b=acceptedEndpointRecipes(0,p,847);
  assert.deepEqual(a,b);assert.ok(a.endpoints.length>1);
  for(const q of a.endpoints)assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[0].paints,q),a.target)<=LIVE_LANDING_TOLERANCE*.9+1e-12);
});
test('inverse full peels retain exact-recipe witnesses despite floating point normalization',()=>{
  for(const q of [[.113,.197,.29,.4],[.137,.191,.293,.379],[.2,.3,.4,.7]]){
    const target=mixtureColor(PLAY_LEVELS[5].paints,q),exact=exactRecipeRoutes(5,q,target),inverse=inverseRoutes(5,q,781);
    for(const r of exact)assert.ok(inverse.routes.some(s=>s.order.join()===r.order.join()&&s.times.every((t,i)=>Math.abs(t-r.times[i])<1e-8)),r.order.join());
  }
});
test('inverse routes replay to the ORIGINAL target without changing palettes or calibration',()=>{
  const signature=JSON.stringify(PLAY_LEVELS),q=[.2,.3,.5],result=inverseRoutes(0,q,789);
  assert.ok(result.routes.length>0);assert.ok(result.routes.some(r=>r.order[0]===r.order.at(-1)),'Allows base pigment to return as a finish');
  for(const r of result.routes){assert.ok(r.times.length<=3);assert.equal(r.order.length,r.times.length+1);
    near(normalizeRecipe(r.recipe),r.endpointRecipe);
    assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[0].paints,replayRoute(0,r.order,r.times)),result.target)<=LIVE_LANDING_TOLERANCE);
  }
  assert.equal(JSON.stringify(PLAY_LEVELS),signature);
});
