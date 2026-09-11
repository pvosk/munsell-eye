import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialExtent,timingDemand,setVariety} from '../app/play-experience-selection';
import {LAB_CONTRAST,LAB_GROUPS,newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress} from '../app/play-lab-model';
import {PLAY_LEVELS,contrastLabBank,journeyLabBank,generateJourneyHole,generateContrastHole,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
test('repeated compact motion cannot masquerade as expansive travel',()=>{
 const compact=Array.from({length:100},(_,i)=>({position:[i%2?5:0,0,0] as [number,number,number]}));
 assert.equal(spatialExtent(compact),5);
 assert.equal(spatialExtent([{position:[0,0,0]},{position:[25,0,0]}]),25);
 assert.equal(spatialExtent([]),0);
});
test('timing bands describe difficulty without redefining timing support',()=>{
 assert.equal(timingDemand(54),'unsupported');assert.equal(timingDemand(55),'focused');
 assert.equal(timingDemand(125),'focused');assert.equal(timingDemand(175),'moderate');assert.equal(timingDemand(258),'gentle');
});
test('small contrasting round preserves its exact anchor, fixed replays and sync validation',()=>{
 assert.equal(LAB_CONTRAST.length,5);assert.equal(LAB_GROUPS[0].items.length,5);
 assert.ok(setVariety(LAB_CONTRAST.map(s=>s.hole.target)).passes);
 assert.equal(LAB_CONTRAST.filter(s=>PLAY_LEVELS[s.levelIndex].name==='CMY').length,2);
 const old=journeyLabBank.holes.find(h=>PLAY_LEVELS[h.levelIndex].name==='Teal Ember')!;
 const a=generateJourneyHole(old.levelIndex,old.stage),b=LAB_CONTRAST[0].hole;
 assert.deepEqual(a.target,b.target);assert.equal(a.par,b.par);assert.deepEqual(a.routeTimes,b.routeTimes);
 for(const [i,s] of LAB_CONTRAST.entries()){
  assert.equal(s.hole.tolerance,LIVE_LANDING_TOLERANCE);assert.equal(labHoleProgress(s.hole),`${i+1}/5`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_CONTRAST[(i+1)%5].hole.courseId);
  const attempt=newLabAttempt(s,`contrast-${i}`),event={id:`event-${i}`,attemptId:attempt.id,type:'attempt',attempt};
  assert.ok(validLabEvent(event));const bad=structuredClone(event);bad.attempt.specimen.hole.par++;assert.equal(validLabEvent(bad),false);
 }
 assert.throws(()=>generateContrastHole(0,0));
});
test('all new bank witnesses still land and near-duplicate target sets fail selection',()=>{
 for(const h of contrastLabBank.holes){const paints=PLAY_LEVELS[h.levelIndex].paints,target=mixtureColor(paints,h.record.target);
  for(const r of [...Object.values(h.roles),...h.analysis.bases.flatMap(b=>b.routes)])assert.ok(colorDistance(mixtureColor(paints,replayRoute(h.levelIndex,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE+1e-9);
 }
 const targets=LAB_CONTRAST.map(s=>s.hole.target);assert.equal(setVariety([...targets,targets[0]]).passes,false);
});
