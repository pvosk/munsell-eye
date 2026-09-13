import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {BRANCH_SPECIMENS,branchLabBank,premixProgress} from '../app/play-premix-bank';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {premixStep} from '../app/play-premix';
import {newLabAttempt,nextFixedLabSpecimen,validLabEvent} from '../app/play-lab-model';
import {LabPicker} from '../app/play-lab';import {PremixRouteReview} from '../app/play-premix-ui';
import bank from '../app/generated/play-branch-lab.json';
Object.assign(globalThis,{React});
test('four append-only branch puzzles replay both branches and every alternative',()=>{
 assert.equal(BRANCH_SPECIMENS.length,4);assert.deepEqual(PLAY_LEVELS.slice(bank.paletteOffset,bank.paletteOffset+bank.palettes.length),bank.palettes);
 for(const [i,s] of BRANCH_SPECIMENS.entries()){
  const item=branchLabBank.holes[i],mode=item.modes.normalized!;assert.equal(item.lab!.rawLegMinimum,3);assert.equal(s.hole.par,3);assert.equal(s.hole.tolerance,T);assert.equal(premixProgress(s.hole),`${i+1}/4 · normalized`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,BRANCH_SPECIMENS[(i+1)%4].hole.courseId);
  assert(mode.rivals.some(r=>r.label==='Refined branch B'));
  if(i===0||i===2)assert(mode.rivals.some(r=>r.label==='Different ingredient set'));
  for(const r of [mode.measurement,...mode.rivals]){
   const attempt=newLabAttempt(s,`branch-${i}`);let q=item.initial;
   r.order.forEach((paint,j)=>{const seconds=r.times[j],step=premixStep(q,paint,seconds,'normalized');attempt.shots.push({paint,seconds,amount:step.amount,before:q,after:step.after,cancelled:false});q=step.after;if(j<r.order.length-1)assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)>T);});
   assert(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=T);assert(validLabEvent({id:`branch-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  }
 }
});
test('branch picker, replay and colored alternatives render without locked controls',()=>{
 for(const s of BRANCH_SPECIMENS){const html=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);assert.match(html,/4 branching setups/);assert.match(html,/Replay this version/);assert.doesNotMatch(html,/<(?:select|button)\b[^>]*disabled/);
 const graph=renderToStaticMarkup(<PremixRouteReview entry={{attempt:newLabAttempt(s,'branch-review')}}/>);assert.match(graph,/Refined branch B/);assert.match(graph,/Premix route comparison/);assert.match(graph,/Shared start and two branches refined together/);
 }
});
