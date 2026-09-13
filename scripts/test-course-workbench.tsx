import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WORKBENCH_SPECIMENS,workbenchBank} from '../app/play-premix-bank';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {labMixtureStep,premixStep} from '../app/play-premix';
import {newLabAttempt,validLabEvent} from '../app/play-lab-model';
import {CourseWorkbenchPicker,PremixRouteReview} from '../app/play-premix-ui';
Object.assign(globalThis,{React});

test('new workbench keeps six free-base and six premix specimens separate',()=>{
 assert.equal(WORKBENCH_SPECIMENS.length,12);
 const free=workbenchBank.holes.filter(h=>h.freeBase);
 assert.equal(free.length,6);
 assert.deepEqual([...new Set(free.map(h=>h.level))].map(l=>free.filter(h=>h.level===l).length),[2,2,2]);
 assert.equal(workbenchBank.board.length,24);
 for(const [i,s] of WORKBENCH_SPECIMENS.entries()){
  const h=workbenchBank.holes[i],m=h.modes.normalized!;
  assert.equal(s.hole.tolerance,T);assert.equal(s.hole.par,3);
  assert.equal(s.hole.premix?.massMode,'normalized');
  assert(Math.abs(h.initial.reduce((a,b)=>a+b,0)-(h.freeBase?0:1))<1e-12);
  if(h.freeBase)assert.equal(new Set([m.measurement,...m.rivals].map(r=>r.order[0])).size,h.paints.length,'review must expose every base');
  for(const r of [m.measurement,...m.rivals]){
   let q=h.initial;const attempt=newLabAttempt(s,`workbench-${i}`);
   r.order.forEach((paint,j)=>{
    const seconds=r.times[j],step=labMixtureStep(q,paint,seconds,'normalized',h.freeBase);
    attempt.shots.push({paint,seconds,amount:step.amount,before:q,after:step.after,cancelled:false});q=step.after;
    assert(Math.abs(q.reduce((a,b)=>a+b,0)-1)<1e-12);
    if(j<r.order.length-1)assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)>T,'no early capture');
   });
   assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=T);
   assert(validLabEvent({id:`workbench-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}),'replay must persist');
   const forged=structuredClone(attempt);forged.shots.at(-1)!.after[0]+=.1;
   assert(!validLabEvent({id:`forged-${i}`,attemptId:forged.id,type:'attempt',attempt:forged}));
  }
 }
});
test('free selection is duration independent; later normalization preserves mixing',()=>{
 for(const seconds of [0,.1,1,2])assert.deepEqual(labMixtureStep([0,0,0],1,seconds,'normalized',true).after,[0,1,0]);
 assert.deepEqual(labMixtureStep([0,1,0],0,.6,'normalized',true),premixStep([0,1,0],0,.6,'normalized'));
 assert.throws(()=>premixStep([0,0,0],0,.6,'normalized'));
 assert.throws(()=>labMixtureStep([0,0,0],0,.6,'accumulated',true));
});
test('navigation and colored reviews distinguish choice from fixed start',()=>{
 for(const s of WORKBENCH_SPECIMENS){
  const html=renderToStaticMarkup(<CourseWorkbenchPicker current={s} onChoose={()=>{}}/>);
  assert.match(html,/Testing track/);assert.match(html,/Hole in this selection/);assert.match(html,/French Light/);assert.match(html,/Replay earlier Hansa/);
  assert.doesNotMatch(html,/<(?:select|button)\b[^>]*disabled/);
  const graph=renderToStaticMarkup(<PremixRouteReview entry={{attempt:newLabAttempt(s,'workbench-review')}}/>);
  assert.match(graph,/Premix route comparison/);
  assert.match(graph,s.hole.premix?.freeBase?/Free base selection; examples may start with different paints/:/The starting recipe is fixed/);
  assert.doesNotMatch(graph,/NaN|undefined/);
 }
});
