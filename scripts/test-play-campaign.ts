import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_CHAPTERS,campaignForHole,campaignSourceId,campaignSnapshot} from '../app/play-campaign';
import {newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress,analysisForHole} from '../app/play-lab-model';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,type ColorPoint} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import {routeGraphBounds} from '../app/play-lab-graph';
import original from '../app/generated/play-campaign-lab.json';

test('campaign preserves the requested sequence and fills all 13 gaps',()=>{
 assert.deepEqual(CAMPAIGN_CHAPTERS.map(c=>c.name),['UltraOx Dual','Maroon Drift','Zorny','RYB','Orange Echo','CMY','Secondaries','Sienna Field','Maroon Arc','Teal Ember','French Light','Cobalt Ember']);
 assert.equal(CAMPAIGN_CHAPTERS.flatMap(c=>c.slots).filter(s=>s.specimen).length,34);
 assert.equal(CAMPAIGN_CHAPTERS.flatMap(c=>c.slots).length,34);
 assert.equal(CAMPAIGN_CHAPTERS[9].slots.length,2);
 assert.ok(CAMPAIGN_CHAPTERS[10].slots[0].specimen);
 assert.equal(CAMPAIGN_CHAPTERS.flatMap(c=>c.slots.flatMap(s=>s.alternatives??[])).length,14);
 for(const c of original.chapters)for(const slot of c.slots)if(slot.specimen)assert.deepEqual(campaignForHole(slot.id)?.slot,slot);
});
test('alternatives retain distinct identities, save, replay and advance by slot',()=>{
 for(const chapter of CAMPAIGN_CHAPTERS)for(const [stage,slot] of chapter.slots.entries())for(const alternate of slot.alternatives??[]){
  const specimen=alternate.specimen,attempt=newLabAttempt(specimen,crypto.randomUUID());
  assert.notEqual(alternate.id,slot.id);
  assert.equal(specimen.hole.stage,stage);
  assert.equal(labHoleProgress(specimen.hole),`${stage+1}/${chapter.slots.length}`);
  assert.ok(validLabEvent({id:crypto.randomUUID(),attemptId:attempt.id,type:'attempt',attempt}));
  assert.deepEqual(campaignSnapshot(alternate.id,specimen.levelIndex,stage,specimen.hole.seed),specimen.hole);
  assert.equal(nextFixedLabSpecimen(specimen)?.hole.courseId,chapter.slots[(stage+1)%chapter.slots.length].id);
  const audit=analysisForHole(alternate.id);assert.ok(audit);
  for(const base of audit.bases)for(const route of base.routes)assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[specimen.levelIndex].paints,replayRoute(specimen.levelIndex,route.order,route.times)),specimen.hole.target)<=specimen.hole.tolerance+1e-8);
 }
});
test('new primaries have per-base analysis and unchanged featured target recipes',()=>{
 for(const chapter of CAMPAIGN_CHAPTERS)for(const slot of chapter.slots){
  if(!slot.alternatives)continue;
  const {hole,levelIndex}=slot.specimen!,audit=analysisForHole(slot.id)!;
  assert.ok(audit);assert.equal(audit.bases.length,PLAY_LEVELS[levelIndex].paints.length);
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[levelIndex].paints,hole.recipe),hole.target)<1e-9);
  assert.ok(audit.bases.every(b=>b.qualifies));
 }
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
