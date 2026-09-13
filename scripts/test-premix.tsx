import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PLAY_LEVELS,mixtureColor,colorDistance,chargeAmount,addPaint,totalMass,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {normalizeRecipe,premixStep,premixReplay,premixRoute,predecessor,holdForShare} from '../app/play-premix';
import {premixBank,PREMIX_SPECIMENS,REGION_SPECIMENS,regionBank,generatePremixHole,premixProgress} from '../app/play-premix-bank';
import {PremixPicker,PremixRouteReview} from '../app/play-premix-ui';
import {newLabAttempt,validLabEvent,nextFixedLabSpecimen} from '../app/play-lab-model';
import {LabPicker} from '../app/play-lab';
Object.assign(globalThis,{React});
test('normalization preserves spectral composition; accumulated steps preserve current physics',()=>{
 const paints=PLAY_LEVELS[1].paints,q=[1,2,3,4];
 assert(colorDistance(mixtureColor(paints,q),mixtureColor(paints,normalizeRecipe(q)))<1e-12);
 for(const seconds of [0,.02,.4,1,2.2,3,4.4]){
  const a=premixStep(q,2,seconds,'accumulated');assert.deepEqual(a.after,addPaint(q,2,chargeAmount(10,seconds)));
  const b=premixStep(q,2,seconds,'normalized'),c=premixStep(q.map(v=>v*10),2,seconds,'normalized');
  assert(Math.abs(totalMass(b.after)-1)<1e-12);assert.deepEqual(b.after,c.after);
 }
 assert.throws(()=>normalizeRecipe([0,0]));assert.throws(()=>premixStep(q,0,NaN,'normalized'));
});
test('analytic predecessors and mode-specific holds reproduce composition, without RGB remixing',()=>{
 const end=[.2,.3,.4,.1],p=predecessor(end,2,.25)!;assert(p);
 for(const mode of ['accumulated','normalized'] as const){
  const q=p.map(v=>v*4),t=holdForShare(4,.25,mode)!;assert(t>=0&&t<=CHARGE_SECONDS);
  const actual=normalizeRecipe(premixStep(q,2,t,mode).after);actual.forEach((v,i)=>assert(Math.abs(v-end[i])<1e-12));
 }
 assert.equal(predecessor(end,0,.3),null);assert.equal(holdForShare(1,.999,'normalized'),null);
});
test('four paired puzzles replay, count first pours, validate exports and preserve paired geometry',()=>{
 assert.equal(premixBank.holes.length,4);assert.equal(PREMIX_SPECIMENS.length,8);
 for(const item of premixBank.holes){
  const a=generatePremixHole(item.id,'accumulated'),b=generatePremixHole(item.id,'normalized');
  assert.deepEqual(a.start,b.start);assert.deepEqual(a.target,b.target);assert.equal(a.par,b.par);
  const paints=PLAY_LEVELS[item.level].paints;
  const routes=(['accumulated','normalized'] as const).map(mode=>premixRoute(paints,item.initial,item.modes[mode].order,item.modes[mode].times,mode));
  routes[0].stops.forEach((p,i)=>assert(colorDistance(p,routes[1].stops[i])<1e-12));
 }
 for(const [i,s] of PREMIX_SPECIMENS.entries()){
  const p=s.hole.premix!,q=premixReplay(p.initial,s.hole.routeOrder,s.hole.routeTimes,p.massMode);
  assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=T);
  const attempt=newLabAttempt(s,`premix-test-${i}`),event={id:`evt-${i}`,attemptId:attempt.id,type:'attempt' as const,attempt};assert(validLabEvent(event));
  let state=[...p.initial];for(const [j,paint] of s.hole.routeOrder.entries()){
   const seconds=s.hole.routeTimes[j],step=premixStep(state,paint,seconds,p.massMode);attempt.shots.push({paint,seconds,amount:step.amount,before:[...state],after:step.after,cancelled:false});state=step.after;
  }
  assert(validLabEvent(event));const changed=structuredClone(event);changed.attempt.shots[0].after[0]+=.1;assert(!validLabEvent(changed));
  const wrong=structuredClone(event);wrong.attempt.specimen.hole.premix!.massMode=p.massMode==='normalized'?'accumulated':'normalized';assert(!validLabEvent(wrong));
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,PREMIX_SPECIMENS[(i+1)%8].hole.courseId);
  const markup=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);assert.match(markup,/Quantity behavior/);assert.match(markup,/Every pour counts/);assert.doesNotMatch(markup,/disabled/);
 }
});
test('new region collection is normalized, replayable and validates all saved shot chains',()=>{
 assert.equal(REGION_SPECIMENS.length,11);assert.equal(regionBank.holes.filter(h=>h.role==='new').length,9);
 for(const [i,s] of REGION_SPECIMENS.entries()){
  assert.equal(s.hole.premix!.massMode,'normalized');assert.equal(s.hole.stage,0);
  assert.equal(s.hole.par,3);assert.equal(s.hole.tolerance,T);
  assert.throws(()=>generatePremixHole(s.hole.premix!.pairId,'accumulated'));
  assert.equal(premixProgress(s.hole),`${i+1}/11 · normalized`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,REGION_SPECIMENS[(i+1)%11].hole.courseId);
  const attempt=newLabAttempt(s,`region-test-${i}`);let q=s.hole.premix!.initial;
  for(const [j,paint] of s.hole.routeOrder.entries()){
   const seconds=s.hole.routeTimes[j],step=premixStep(q,paint,seconds,'normalized');
   attempt.shots.push({paint,seconds,amount:step.amount,before:q,after:step.after,cancelled:false});q=step.after;
  }
  assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=T);
  assert(validLabEvent({id:`region-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  const markup=renderToStaticMarkup(<PremixPicker current={s} onChoose={()=>{}}/>);
  assert.match(markup,/Next puzzle/);assert.doesNotMatch(markup,/Quantity behavior/);assert.doesNotMatch(markup,/disabled/);
  const graph=renderToStaticMarkup(<PremixRouteReview entry={{attempt} as any}/>);assert.match(graph,/Premix route comparison/);assert.match(graph,/Prepared mixture/);
 }
});
