import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE,colorPoint} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import {fitFixedTarget,backwardRegions,regionPalettes} from './backward-region-proposals';
test('inverse fit finds a known destination without changing its center',()=>{
 const target=mixtureColor(PLAY_LEVELS[0].paints,[.2,.35,.45]),copy=JSON.stringify(target),fit=fitFixedTarget(0,target,98431);
 assert.ok(fit.fits.length);assert.ok(fit.bestError<LIVE_LANDING_TOLERANCE);
 assert.equal(JSON.stringify(target),copy);
 for(const f of fit.fits)assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[0].paints,f.recipe),target)<=LIVE_LANDING_TOLERANCE);
});
test('backward predecessor proposals replay to the fixed destination',()=>{
 const signature=JSON.stringify(PLAY_LEVELS),target=mixtureColor(PLAY_LEVELS[0].paints,[.2,.35,.45]),result=backwardRegions(0,target,98431);
 assert.ok(result.routes.length);assert.ok(result.endpointCount>1);
 for(const r of result.routes){
  const reconstructed=r.predecessor.map((x,i)=>(1-r.finishShare)*x+(i===r.order.at(-1)?r.finishShare:0));
  assert.ok(reconstructed.every((x,i)=>Math.abs(x-r.endpoint[i])<1e-8));
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[0].paints,replayRoute(0,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE);
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);
});
test('unreachable fixed goal stays unreachable instead of being moved onto palette',()=>{
 const target=colorPoint([0,255,0]),before=JSON.stringify(target),fit=fitFixedTarget(0,target,98431);
 assert.equal(fit.fits.length,0);assert.ok(fit.bestError>LIVE_LANDING_TOLERANCE);assert.equal(JSON.stringify(target),before);
});
test('palette shortlist preserves existing definitions and includes novel triads and quartets',()=>{
 const signature=JSON.stringify(PLAY_LEVELS),result=regionPalettes(),novel=result.selected.filter(p=>!p.control);
 assert.equal(novel.length,12);assert.equal(new Set(novel.map(p=>p.id)).size,12);
 assert.ok(novel.some(p=>p.paints.length===3));assert.ok(novel.some(p=>p.paints.length===4));
 assert.ok(novel.some(p=>p.paints.every(p=>!['White','Black'].includes(p.category))));
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);
});
