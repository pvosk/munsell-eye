import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LAB_INVERSE,LAB_GROUPS,newLabAttempt,validLabEvent,nextFixedLabSpecimen,directedForHole} from '../app/play-lab-model';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {blindReplay} from './recipe-blind-search';
import {LabPicker} from '../app/play-lab';
Object.assign(globalThis,{React});
test('30 new holes replay; every archived example lands and attempts validate',()=>{
 assert.equal(LAB_INVERSE.length,30);assert.equal(new Set(LAB_INVERSE.map(s=>s.levelIndex)).size,15);
 for(const [i,s] of LAB_INVERSE.entries()){
  const a=newLabAttempt(s,'inverse-test-'+i);assert.ok(validLabEvent({id:'event-'+i,attemptId:a.id,type:'attempt',attempt:a}));
  assert.equal(s.hole.tolerance,T);assert.ok(PLAY_LEVELS[s.levelIndex].labOnly);
  const d=directedForHole(s.hole.courseId)!;assert.ok(d);
  for(const r of [...Object.values(d.roles),...d.analysis.bases.flatMap(b=>b.routes)])assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,blindReplay(s.levelIndex,r.order,r.times)),s.hole.target)<=T+1e-9,s.hole.courseId);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_INVERSE[(i+1)%30].hole.courseId);
 }
});
test('all old lab attempts remain valid; all new palette pickers are enabled',()=>{
 for(const g of LAB_GROUPS)for(const s of g.items){const a=newLabAttempt(s,'archive-test');assert.ok(validLabEvent({id:'archive-event',attemptId:a.id,type:'attempt',attempt:a}),s.hole.courseId);}
 for(const s of LAB_INVERSE){const html=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);assert.match(html,/Test palette<select/);assert.match(html,/Hole in this palette<select/);assert.doesNotMatch(html,/<(?:select|button)\b[^>]*\bdisabled/);assert.match(html,/30 inverse-planning holes/);}
});
