import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,designLabBank,generateDesignHole,mixtureColor,colorDistance,totalMass,chargeAmount,addPaint} from '../app/play-engine';
import {LAB_DESIGN,newLabAttempt,validLabEvent,suggestedComparison} from '../app/play-lab-model';
import {replayRoute,routeDetails,paletteSignature} from '../app/play-course-analysis';
import {mergeSplitPours,secondsForAmount,analyzeDesign,matchesDesign,measureDesignRoute} from '../app/play-route-design';
import {finishingIntervals} from '../app/play-route-analysis';
import round3 from '../app/generated/play-lab-round3.json';

test('single-paint substitutions do not change the twelve existing palettes',()=>{
  for(const [base,variant] of [[4,12],[1,13],[5,14]]){
    assert.equal(PLAY_LEVELS[variant].labOnly,true);
    assert.equal(PLAY_LEVELS[base].paints.filter((p,i)=>p.id!==PLAY_LEVELS[variant].paints[i].id).length,1);
  }
  assert.equal(round3.signature,paletteSignature(12));
  assert.equal(designLabBank.signature,paletteSignature(15));
});
test('legal repeated doses merge without changing mixture or subsequent pours',()=>{
  const palette=1,order=[3,1,1,0],times=[.25,.3,.2],q=replayRoute(palette,order,times),target=mixtureColor(PLAY_LEVELS[palette].paints,q);
  const merged=mergeSplitPours(palette,routeDetails(palette,order,times,target),target);
  assert.deepEqual(merged.order,[3,1,0]);
  const after=replayRoute(palette,merged.order,merged.times);
  q.forEach((v,i)=>assert.ok(Math.abs(v-after[i])<1e-10));
  assert.equal(secondsForAmount(1,9),null);
  const heavy=[2.2,2.2],dest=mixtureColor(PLAY_LEVELS[palette].paints,replayRoute(palette,[3,1,1],heavy));
  assert.equal(mergeSplitPours(palette,routeDetails(palette,[3,1,1],heavy,dest),dest).times.length,2);
});
test('the rejected white-start lift cannot qualify through an optional return to white',()=>{
  const old=round3.holes.find(h=>h.levelIndex===1)!;
  const a=analyzeDesign(1,old.record.target,'setup-lift',undefined,false);
  assert.ok(a.failures.includes('one-pour-style-bypass'));
  const white=a.bases[3];assert.equal(white.fewestFound,1);
  assert.ok(white.routes.every(r=>r.times.length===1));
});
test('desaturation alone is not opposing-color or coupled balancing',()=>{
  const p=1,order=[1,3],times=[.7],target=mixtureColor(PLAY_LEVELS[p].paints,replayRoute(p,order,times));
  const m=measureDesignRoute(p,routeDetails(p,order,times,target),target);
  assert.equal(m.balance,false);assert.equal(m.opposedPairs,0);assert.equal(m.coupledPairs,0);
  assert.equal(m.lift,false);
});
test('eight immutable tests score at the same tolerance used for analysis',()=>{
  assert.equal(LAB_DESIGN.length,8);assert.equal(new Set(LAB_DESIGN.map(s=>s.hole.courseId)).size,8);
  for(const s of LAB_DESIGN){
    assert.deepEqual(generateDesignHole(s.levelIndex,s.hole.stage),s.hole);
    assert.equal(s.hole.tolerance,LIVE_LANDING_TOLERANCE);
    const item=designLabBank.holes.find(h=>h.record.id===s.hole.courseId)!,a=item.analysis;
    assert.equal(a.tolerance,s.hole.tolerance);assert.deepEqual(a.failures,[]);assert.ok(a.qualifyingBases.length>=2);
    assert.ok(a.styleBases.length>0);
    for(const base of a.bases)for(const r of base.routes){
      assert.equal(r.efficient,true);assert.equal(r.times.length,base.fewestFound);
      assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,replayRoute(s.levelIndex,r.order,r.times)),s.hole.target)<=s.hole.tolerance+1e-8);
    }
    const example=a.bases.flatMap(b=>b.routes).find(r=>r.order.join()===s.hole.routeOrder.join()&&r.times.every((t,i)=>Math.abs(t-s.hole.routeTimes[i])<1e-10))!;
    assert.ok(matchesDesign(example,a.style));assert.ok(example.finishWindowMs>=55);
    const attempt=newLabAttempt(s,'design-test');assert.ok(validLabEvent({id:'event',attemptId:attempt.id,type:'attempt',attempt}));
    const bad=structuredClone(attempt);bad.specimen.hole.tolerance=.04;
    assert.equal(validLabEvent({id:'bad',attemptId:bad.id,type:'attempt',attempt:bad}),false);
  }
});
test('matched pairs really use the changed paint and preserve recipe proportions',()=>{
  for(const pair of ['ride','lift','balance']){
    const [a,b]=designLabBank.holes.filter(h=>h.pair===pair);assert.ok(a&&b);
    assert.deepEqual(a.record.target,b.record.target);
    const changed=PLAY_LEVELS[a.levelIndex].paints.findIndex((p,i)=>p.id!==PLAY_LEVELS[b.levelIndex].paints[i].id);
    assert.ok(a.record.target[changed]>=.03);
    const ca=mixtureColor(PLAY_LEVELS[a.levelIndex].paints,a.record.target),cb=mixtureColor(PLAY_LEVELS[b.levelIndex].paints,b.record.target);
    assert.ok(colorDistance(ca,cb)>LIVE_LANDING_TOLERANCE*.5);
  }
  assert.equal(designLabBank.holes.filter(h=>h.reference).length,2);
});
test('new attempts, base comparisons, and palette feedback preserve replay and validation',()=>{
  const a=newLabAttempt(LAB_DESIGN[0],'first'),count=a.paints.length,q=Array(count).fill(0);q[0]=1;
  a.shots=[{paint:0,seconds:.1,amount:1,before:Array(count).fill(0),after:q,cancelled:false}];
  const other=suggestedComparison(a)!;assert.ok(other);assert.notEqual(other.comparison!.base,0);assert.deepEqual(other.hole,a.specimen.hole);
  const replay=newLabAttempt(other,'second');assert.ok(validLabEvent({id:'e',attemptId:'second',type:'attempt',attempt:replay}));
  const review={verdict:'keep',challenge:'setup',issue:'',note:'',shot:null,paletteVerdict:'variant'};
  assert.ok(validLabEvent({id:'r',attemptId:'second',type:'review',review}));
  assert.equal(validLabEvent({id:'r',attemptId:'second',type:'review',review:{...review,paletteVerdict:'invalid'}}),false);
});
test('reported finishing windows land at current tolerance when replayed',()=>{
  for(const s of LAB_DESIGN){
    const {routeOrder:order,routeTimes:times,target,tolerance}=s.hole,paints=PLAY_LEVELS[s.levelIndex].paints;
    let before=paints.map((_,i)=>+(i===order[0]));
    times.slice(0,-1).forEach((t,i)=>{before=addPaint(before,order[i+1],chargeAmount(totalMass(before),t));});
    const intervals=finishingIntervals(s.levelIndex,before,order.at(-1)!,target,96,tolerance);
    assert.ok(intervals.length);
    for(const x of intervals){const q=addPaint(before,order.at(-1)!,chargeAmount(totalMass(before),(x.lo+x.hi)/2));assert.ok(colorDistance(mixtureColor(paints,q),target)<=tolerance+1e-8);}
  }
});
