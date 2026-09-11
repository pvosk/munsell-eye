import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,COURSE_PALETTE_INDICES,nextCoursePalette,focusedLabBank,designLabBank,pairedLabBank,generateFocusedHole,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {LAB_FOCUSED,LAB_STARTERS,LAB_GROUPS,nextFixedLabSpecimen,newLabAttempt,validLabEvent,suggestedComparison} from '../app/play-lab-model';
import {measureStyleCoverage,coverageEligible,compareStyleCoverage} from '../app/play-style-coverage';
import {paletteSignature,replayRoute,playerPar} from '../app/play-course-analysis';
import {focusMatches} from './discover-focused-palettes';
import type {DesignRoute} from '../app/play-route-design';

test('coverage counts bases, not number of routes, and never averages away an unsupported base',()=>{
  const route=(style:boolean)=>({efficient:true,finishWindowMs:100,meaningfulPours:2,times:[.4,.5],setup:null,balance:style}) as DesignRoute;
  const template=focusedLabBank.holes[0].analysis;
  const a={...template,failures:[],bases:[{...template.bases[0],base:0,qualifies:true,routes:[route(true),route(true)]},{...template.bases[1],base:1,qualifies:true,routes:[route(false)]}]};
  const c=measureStyleCoverage(a,r=>r.balance);
  assert.equal(c.ratio,.5);assert.deepEqual(c.styleBases,[0]);
  assert.ok(coverageEligible(a,c,.5));assert.equal(coverageEligible(a,c,.75),false);
  assert.equal(coverageEligible({...a,bases:a.bases.map((b,i)=>({...b,qualifies:i===0}))},c,.5),false);
  assert.ok(compareStyleCoverage({...c,ratio:1,easiestRatio:0},c)<0);
});
test('round five has two distinct targets for each of four new palettes',()=>{
  assert.equal(LAB_FOCUSED.length,8);assert.equal(focusedLabBank.signature,paletteSignature(19));
  assert.deepEqual([...new Set(LAB_FOCUSED.map(s=>s.levelIndex))],[15,16,17,18]);
  assert.equal(new Set(LAB_FOCUSED.map(s=>s.hole.courseId)).size,8);
  for(const p of [15,16,17,18]){
    assert.ok(PLAY_LEVELS[p].labOnly);
    const [a,b]=LAB_FOCUSED.filter(s=>s.levelIndex===p);
    assert.ok(colorDistance(a.hole.target,b.hole.target)>=2*LIVE_LANDING_TOLERANCE);
  }
});
test('coverage labels and featured routes are backed by measurements; par formula is unchanged',()=>{
  for(const h of focusedLabBank.holes){
    const matches=(r:DesignRoute)=>focusMatches(h.levelIndex,r,h.record.target,h.focus);
    const coverage=measureStyleCoverage(h.analysis,matches);
    assert.deepEqual(coverage,h.coverage);assert.ok(coverageEligible(h.analysis,coverage,focusedLabBank.minimumCoverage));
    assert.ok(coverage.ratio>=.75,'selected examples prioritize at least three of four bases');
    const route=h.analysis.bases.flatMap(b=>b.routes).find(r=>r.order.join()===h.record.order.join()&&r.times.every((t,i)=>t===h.record.times[i]))!;
    assert.ok(route&&matches(route));
    assert.equal(h.record.par,playerPar(h.record.solutionShots,route.window,h.focus==='chromatic-ride'?.4:.8));
    for(const b of h.analysis.bases)for(const r of b.routes){
      const q=replayRoute(h.levelIndex,r.order,r.times);
      assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[h.levelIndex].paints,q),mixtureColor(PLAY_LEVELS[h.levelIndex].paints,h.record.target))<=LIVE_LANDING_TOLERANCE+1e-9);
    }
  }
});
test('new snapshots and suggested-base replays validate without allowing edited holes',()=>{
  for(const s of LAB_FOCUSED){
    assert.deepEqual(s.hole,generateFocusedHole(s.levelIndex,s.hole.stage));
    const a=newLabAttempt(s,'focus-attempt'),event={id:'focus-event',attemptId:a.id,type:'attempt',attempt:a};
    assert.ok(validLabEvent(JSON.parse(JSON.stringify(event))));
    const bad=structuredClone(event);bad.attempt.specimen.hole.par++;
    assert.equal(validLabEvent(bad),false);
    a.shots=[{paint:0,seconds:.1,amount:1,before:[0,0,0,0],after:[1,0,0,0],cancelled:false}];
    const next=suggestedComparison(a)!;assert.ok(next);assert.notEqual(next.comparison!.base,0);
    const replay=newLabAttempt(next,'focus-replay');assert.ok(validLabEvent({id:'replay-event',attemptId:replay.id,type:'attempt',attempt:replay}));
  }
});
test('retired palette is absent from selection and cycling but old attempts remain replayable',()=>{
  assert.equal(PLAY_LEVELS[11].name,'Viridian Rust');assert.ok(PLAY_LEVELS[11].retired);
  assert.equal(COURSE_PALETTE_INDICES.includes(11),false);
  assert.ok(LAB_GROUPS.every(g=>g.items.every(s=>s.levelIndex!==11)));
  assert.equal(nextCoursePalette(10),0);assert.equal(nextCoursePalette(11),0);
  const old=LAB_STARTERS.find(s=>s.levelIndex===11)!;
  const a=newLabAttempt(old,'old-rust');assert.ok(validLabEvent({id:'old-rust-event',attemptId:a.id,type:'attempt',attempt:a}));
  assert.notEqual(nextFixedLabSpecimen(old)?.levelIndex,11);
  assert.equal(designLabBank.signature,paletteSignature(15));assert.equal(pairedLabBank.signature,paletteSignature(12));
});
test('new target advances all eight tests and wraps without calling the normal generator',()=>{
  for(let i=0;i<LAB_FOCUSED.length;i++)assert.deepEqual(nextFixedLabSpecimen(LAB_FOCUSED[i]),LAB_FOCUSED[(i+1)%LAB_FOCUSED.length]);
});
test('all supplied historical lab events still validate',()=>{
  const path='/Users/atg_la02_macstudio/Desktop/chroma-lab (2).json';
  const data=JSON.parse(readFileSync(path,'utf8')) as {events:unknown[]};
  assert.equal(data.events.length,517);
  assert.ok(data.events.every(validLabEvent));
});
