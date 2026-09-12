import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import raw from '../app/generated/play-lab-round11.json';
import {LAB_HARD,newLabAttempt,validLabEvent,directedForHole,nextFixedLabSpecimen} from '../app/play-lab-model';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {blindReplay} from './recipe-blind-search';
import {LabPicker} from '../app/play-lab';
Object.assign(globalThis,{React});
test('hard lab has six checked setups and two explicit contrasts, with fixed targets',()=>{
 assert.equal(raw.holes.length,8);const core=raw.holes.filter(h=>h.evidence.core);assert.equal(core.length,6);
 assert.ok(core.every(h=>h.evidence.bases.every(b=>b.raw>=2&&b.supported>=2)));
 assert.equal(core.filter(h=>h.evidence.bases.every(b=>b.raw===3&&b.supported===3)).length,5);
 for(const [i,s] of LAB_HARD.entries()){
  assert.deepEqual(s.hole.target.rgb,raw.holes[i].record.targetRGB);assert.equal(s.hole.tolerance,T);
  const a=newLabAttempt(s,'hard-test-'+i);assert.ok(validLabEvent({id:'event-'+i,type:'attempt',attemptId:a.id,attempt:a}));
  const h=directedForHole(s.hole.courseId)!;for(const r of [...Object.values(h.roles),...h.analysis.bases.flatMap(b=>b.routes)])assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,blindReplay(s.levelIndex,r.order,r.times)),s.hole.target)<=T+1e-9);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_HARD[(i+1)%8].hole.courseId);
  const markup=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);assert.match(markup,/8 harder setup holes/);assert.match(markup,/Test palette<select/);assert.doesNotMatch(markup,/<(?:select|button)\b[^>]*\bdisabled/);
 }
});
