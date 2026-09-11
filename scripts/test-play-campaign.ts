import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_CHAPTERS,campaignForHole,campaignSourceId,campaignSnapshot} from '../app/play-campaign';
import {newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress,analysisForHole} from '../app/play-lab-model';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,type ColorPoint} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import {routeGraphBounds} from '../app/play-lab-graph';

test('campaign preserves the requested palette sequence and explicit gaps',()=>{
 assert.deepEqual(CAMPAIGN_CHAPTERS.map(c=>c.name),['UltraOx Dual','Maroon Drift','Zorny','RYB','Orange Echo','CMY','Secondaries','Sienna Field','Maroon Arc','Teal Ember','French Light','Cobalt Ember']);
 assert.equal(CAMPAIGN_CHAPTERS.flatMap(c=>c.slots).filter(s=>s.specimen).length,21);
 assert.equal(CAMPAIGN_CHAPTERS.flatMap(c=>c.slots).length,34);
 assert.equal(CAMPAIGN_CHAPTERS[9].slots.length,2);
 assert.equal(CAMPAIGN_CHAPTERS[10].slots[0].specimen,null);
});
test('every featured route lands, saves and replays without changing paints',()=>{
 const before=JSON.stringify(PLAY_LEVELS);
 for(const c of CAMPAIGN_CHAPTERS)for(const slot of c.slots){
  const s=slot.specimen;if(!s)continue;
  const q=replayRoute(s.levelIndex,s.hole.routeOrder,s.hole.routeTimes);
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,q),s.hole.target)<=s.hole.tolerance+1e-8,slot.id);
  assert.equal(s.hole.tolerance,LIVE_LANDING_TOLERANCE);
  const attempt=newLabAttempt(s,crypto.randomUUID());
  const event={id:crypto.randomUUID(),attemptId:attempt.id,type:'attempt',attempt};
  assert.ok(validLabEvent(event),slot.id);
  const changed=structuredClone(event);changed.attempt.specimen.hole.tolerance*=2;
  assert.equal(validLabEvent(changed),false);
  assert.equal(campaignSourceId(slot.id),slot.sourceId);
  const snap=campaignSnapshot(slot.id,s.levelIndex,s.hole.stage,s.hole.seed);
  assert.deepEqual(snap,s.hole);assert.notEqual(snap,s.hole);
  assert.equal(labHoleProgress(s.hole),`${c.slots.indexOf(slot)+1}/${c.slots.length}`);
  assert.equal(analysisForHole(slot.id),analysisForHole(slot.sourceId!));
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),before);
});
test('next candidate cycles only through playable holes in the same palette',()=>{
 for(const c of CAMPAIGN_CHAPTERS){const ready=c.slots.filter(s=>s.specimen);
  for(let i=0;i<ready.length;i++){
   const next=nextFixedLabSpecimen(ready[i].specimen!);
   assert.equal(next?.hole.courseId,ready[(i+1)%ready.length].id);
   assert.equal(campaignForHole(next!.hole.courseId)?.chapter.id,c.id);
  }
 }
});
test('empty and legacy attempt graphs include the full example route',()=>{
 const point=(position:number[])=>({position} as ColorPoint);
 const bounds=routeGraphBounds([],[],[point([-30,5,12]),point([40,20,-7])],point([1,2,3]));
 assert.deepEqual(bounds,[[-30,40],[2,20],[-7,12]]);
});
