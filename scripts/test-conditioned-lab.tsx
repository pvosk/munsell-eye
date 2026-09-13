import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {CONDITIONED_SPECIMENS,conditionedLabBank,premixProgress} from '../app/play-premix-bank';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {premixStep} from '../app/play-premix';
import {newLabAttempt,nextFixedLabSpecimen,validLabEvent} from '../app/play-lab-model';
import {LabPicker} from '../app/play-lab';import {PremixRouteReview} from '../app/play-premix-ui';
import bank from '../app/generated/play-conditioned-lab.json';
Object.assign(globalThis,{React});
test('sixteen new puzzles are append-only, replayable and persistable',()=>{
 assert.equal(CONDITIONED_SPECIMENS.length,16);assert.deepEqual(PLAY_LEVELS.slice(bank.paletteOffset,bank.paletteOffset+bank.palettes.length),bank.palettes);
 assert.equal(bank.holes.filter(h=>h.lab.rawLegMinimum===3).length,12);
 for(const [i,s] of CONDITIONED_SPECIMENS.entries()){
  const item=conditionedLabBank.holes[i],mode=item.modes.normalized!;assert.equal(s.hole.par,3);assert.equal(s.hole.tolerance,T);assert.equal(s.hole.premix!.massMode,'normalized');
  assert.equal(premixProgress(s.hole),`${i+1}/16 · normalized`);assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,CONDITIONED_SPECIMENS[(i+1)%16].hole.courseId);
  assert(mode.rivals.some(r=>r.label?.startsWith('Shortest found')));
  for(const r of [mode.measurement,...mode.rivals]){
   let q=item.initial;const attempt=newLabAttempt(s,`conditioned-${i}`);
   r.order.forEach((paint,j)=>{const seconds=r.times[j],step=premixStep(q,paint,seconds,'normalized');attempt.shots.push({paint,seconds,amount:step.amount,before:q,after:step.after,cancelled:false});q=step.after;if(j<r.order.length-1)assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)>T);});
   assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=T);assert(validLabEvent({id:`conditioned-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  }
 }
 assert.deepEqual(bank.holes[0].targetRGB,bank.holes[6].targetRGB);assert.deepEqual(bank.holes[0].targetRGB,bank.holes[11].targetRGB);
});
test('collection navigation and colored route evidence are available',()=>{
 for(const s of CONDITIONED_SPECIMENS){const html=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);assert.match(html,/16 destination branching puzzles/);assert.match(html,/Replay this version/);assert.doesNotMatch(html,/<(?:select|button)\b[^>]*disabled/);
  const graph=renderToStaticMarkup(<PremixRouteReview entry={{attempt:newLabAttempt(s,'conditioned-review')}}/>);assert.match(graph,/Premix route comparison/);assert.match(graph,/fresh independent shortcut check/);
 }
});
