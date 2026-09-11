import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,journeyLabBank,mixtureColor,colorDistance} from '../app/play-engine';
import {LAB_JOURNEYS,LAB_GROUPS,newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress,labReviewEntries,selectedLabEntry} from '../app/play-lab-model';
import {replayRoute} from '../app/play-course-analysis';

test('round 8 preserves exact replay, progress and validated persistence',()=>{
 assert.equal(LAB_JOURNEYS.length,10);assert.equal(LAB_GROUPS.find(g=>g.name.startsWith('Round 8'))?.items.length,10);
 assert.equal(journeyLabBank.holes.filter(h=>h.record.kind==='ride').length,2);
 assert.equal(journeyLabBank.holes.filter(h=>h.label.startsWith('Close start')).length,1);
 for(const [i,s] of LAB_JOURNEYS.entries()){
  assert.equal(labHoleProgress(s.hole),`${i+1}/10`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_JOURNEYS[(i+1)%10].hole.courseId);
  assert.equal(s.hole.tolerance,LIVE_LANDING_TOLERANCE);
  const attempt=newLabAttempt(s,`round8-${i}`);
  assert.ok(validLabEvent({id:`event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  const forged=structuredClone(attempt);forged.specimen.hole.par++;
  assert.equal(validLabEvent({id:`bad-${i}`,attemptId:forged.id,type:'attempt',attempt:forged}),false);
 }
 assert.ok(PLAY_LEVELS.slice(21).every(p=>p.labOnly));
});
test('every archived route witness lands under unchanged physics',()=>{
 for(const h of journeyLabBank.holes){
  const paints=PLAY_LEVELS[h.levelIndex].paints,target=mixtureColor(paints,h.record.target);
  for(const r of [...Object.values(h.roles),...h.analysis.bases.flatMap(b=>b.routes)]){
   assert.ok(colorDistance(mixtureColor(paints,replayRoute(h.levelIndex,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE+1e-9);
  }
 }
});
test('current feedback is available before sync and after reviewing another attempt',()=>{
 const current=newLabAttempt(LAB_JOURNEYS[0],'current'),older=newLabAttempt(LAB_JOURNEYS[1],'older');
 const entries=labReviewEntries([{id:'older-event',attemptId:'older',type:'attempt',attempt:older}],current);
 assert.equal(entries.length,2);
 assert.equal(selectedLabEntry(entries,current,null)?.attempt.id,'current');
 assert.equal(selectedLabEntry(entries,current,'older')?.attempt.id,'older');
 assert.equal(selectedLabEntry(entries,current,null)?.attempt.id,'current');
});
