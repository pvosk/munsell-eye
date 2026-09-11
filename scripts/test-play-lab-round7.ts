import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,protectedLabBank,mixtureColor,colorDistance,generateProtectedHole} from '../app/play-engine';
import {LAB_PROTECTED,LAB_GROUPS,newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress,suggestedComparison} from '../app/play-lab-model';
import {replayRoute} from '../app/play-course-analysis';
import {experienceMatches,experienceSupported,analyzeExperience} from '../app/play-experience-audit';

test('round 7 preserves replay, progress, and sync validation for all eight specimens',()=>{
 assert.equal(LAB_PROTECTED.length,8);assert.equal(LAB_GROUPS[0].items.length,8);
 for(const [i,s] of LAB_PROTECTED.entries()){
  assert.equal(labHoleProgress(s.hole),`${i+1}/8`);
  assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_PROTECTED[(i+1)%8].hole.courseId);
  const attempt=newLabAttempt(s,`test-round7-${i}`);
  assert.ok(validLabEvent({id:`test-event-${i}`,attemptId:attempt.id,type:'attempt',attempt}));
  const comparison=suggestedComparison({...attempt,shots:[{paint:0,seconds:0,amount:1,before:attempt.paints.map(()=>0),after:attempt.paints.map((_,j)=>+(j===0)),cancelled:false}]});
  assert.ok(comparison);assert.notEqual(comparison.comparison!.base,0);
  const a=newLabAttempt(comparison,`compare-${i}`);assert.ok(validLabEvent({id:`compare-event-${i}`,attemptId:a.id,type:'attempt',attempt:a}));
  const forged=structuredClone(attempt);forged.specimen.hole.par++;
  assert.equal(validLabEvent({id:`bad-${i}`,attemptId:forged.id,type:'attempt',attempt:forged}),false);
 }
 assert.throws(()=>generateProtectedHole(1,0));
});
test('stored intended and competing paths actually land, with direction and every-base claims intact',()=>{
 for(const h of protectedLabBank.holes){
  const target=mixtureColor(PLAY_LEVELS[h.levelIndex].paints,h.record.target);
  for(const r of [...Object.values(h.roles),...h.analysis.bases.flatMap(b=>b.routes)]){
   assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[h.levelIndex].paints,replayRoute(h.levelIndex,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE+1e-9);
   assert.ok(experienceSupported(r));
  }
  if(h.record.kind==='interior'){
   assert.ok(h.analysis.bases.every(b=>b.fewestFound===3&&b.bestTwoError>1.1));
   assert.equal(h.coverage.robustBases.length,h.analysis.bases.length);
  }else{
   assert.ok(experienceMatches(h.roles.intended,h.record.kind as 'ride'|'rise'|'drop'|'value-shift'));
   assert.ok(h.coverage.robustBases.length<h.analysis.bases.length);
  }
 }
});
test('joint search preserves physical paint definitions and verified witnesses without claiming full resistance',()=>{
 const results=JSON.parse(readFileSync('docs/play-directed-experiences-results.json','utf8')) as {evaluations:number;runs:{style:'ride'|'value-shift';finalists:{paints:typeof PLAY_LEVELS[number]['paints'];recipe:number[];audit:ReturnType<typeof analyzeExperience>}[]}[]};
 assert.equal(results.evaluations,200);
 const n=PLAY_LEVELS.length;
 try{
  for(const run of results.runs)for(const c of run.finalists){
   PLAY_LEVELS[n]={name:'test-only',subtitle:'',tolerance:.028,paints:c.paints};
   const target=mixtureColor(c.paints,c.recipe);
   assert.ok(colorDistance(target,c.audit.target)<1e-10);
   for(const b of c.audit.bases)for(const r of b.routes)assert.ok(colorDistance(mixtureColor(c.paints,replayRoute(n,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE+1e-9);
   assert.equal(c.audit.styles[run.style].everyBaseResistant,false);
  }
 }finally{PLAY_LEVELS.length=n;}
});
