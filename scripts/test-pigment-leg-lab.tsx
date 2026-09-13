import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import data from '../app/generated/play-pigment-leg-lab.json';
import {PLAY_LEVELS,colorDistance,mixtureColor,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legLabBank,LEG_SPECIMENS,generatePremixHole,premixProgress} from '../app/play-premix-bank';
import {premixStep} from '../app/play-premix';
import {releasesToLegs} from '../app/play-pigment-legs';
import {newLabAttempt,validLabEvent,nextFixedLabSpecimen} from '../app/play-lab-model';
import {LabPicker} from '../app/play-lab';
import {PremixRouteReview} from '../app/play-premix-ui';
Object.assign(globalThis,{React});
test('variety bank preserves append-only palettes, old indices and distinct specimens',()=>{
 assert.equal(LEG_SPECIMENS.length,10);assert.equal(new Set(legLabBank.holes.map(h=>h.id)).size,10);
 assert.deepEqual(PLAY_LEVELS.slice(data.paletteOffset,data.paletteOffset+data.palettes.length),data.palettes);
 assert.equal(legLabBank.holes.filter(h=>h.lab?.method==='route-first').length,3);
 assert.equal(legLabBank.holes.filter(h=>h.lab?.exploratory).length,2);
 assert(new Set(legLabBank.holes.map(h=>h.level)).size>=8);
 assert(legLabBank.holes.some(h=>PLAY_LEVELS[h.level].paints.length===3));
 assert(legLabBank.holes.some(h=>PLAY_LEVELS[h.level].paints.length===6));
});
test('every feature and alternative is executable, without premature capture',()=>{
 for(const item of legLabBank.holes){
  const hole=generatePremixHole(item.id,'normalized'),paints=PLAY_LEVELS[item.level].paints;
  assert.equal(hole.par,3);assert.equal(hole.tolerance,T);assert.throws(()=>generatePremixHole(item.id,'accumulated'));
  const mode=item.modes.normalized!;
  assert(mode.rivals.some(r=>r.legCount===item.lab!.rawLegMinimum));
  for(const r of [mode.measurement,...mode.rivals]){
   let q=item.initial;
   r.order.forEach((paint,i)=>{q=premixStep(q,paint,r.times[i],'normalized').after;if(i<r.order.length-1)assert(colorDistance(mixtureColor(paints,q),hole.target)>T);});
   assert(colorDistance(mixtureColor(paints,q),hole.target)<=T);
   assert.equal(releasesToLegs(item.initial,r.order,r.times).length,r.legCount);
  }
 }
});
test('all new attempts validate, replay, navigate and show honest leg/release evidence',()=>{
 for(const [i,s] of LEG_SPECIMENS.entries()){
  assert.equal(premixProgress(s.hole),`${i+1}/10 · normalized`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LEG_SPECIMENS[(i+1)%10].hole.courseId);
  const attempt=newLabAttempt(s,`leg-lab-${i}`);let q=s.hole.premix!.initial;
  s.hole.routeOrder.forEach((paint,j)=>{const seconds=s.hole.routeTimes[j],step=premixStep(q,paint,seconds,'normalized');attempt.shots.push({paint,seconds,amount:step.amount,before:q,after:step.after,cancelled:false});q=step.after;});
  assert(validLabEvent({id:`leg-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  const html=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);
  assert.match(html,/10 contrasting pigment-leg puzzles/);assert.match(html,/Replay this version/);assert.doesNotMatch(html,/<(?:select|button)\b[^>]*disabled/);
  const graph=renderToStaticMarkup(<PremixRouteReview entry={{attempt}}/>);
  assert.match(graph,/Shortest found/);assert.match(graph,/pigment legs/);assert.match(graph,/releases in this example/);assert.match(graph,/Premix route comparison/);
  if(legLabBank.holes[i].lab!.exploratory)assert.match(graph,/not necessary to win/);
 }
});
