import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,pairedLabBank,generatePairedHole,mixtureColor,colorDistance,addPaint,chargeAmount,totalMass} from '../app/play-engine';
import {LAB_PAIRED,newLabAttempt,validLabEvent,suggestedComparison} from '../app/play-lab-model';
import {replayRoute,paletteSignature} from '../app/play-course-analysis';
import {analyzeRoutes,finishingIntervals} from '../app/play-route-analysis';
import round2 from '../app/generated/play-lab-round2.json';

test('six immutable paired targets preserve free starts and real scoring',()=>{
  assert.equal(LAB_PAIRED.length,6);assert.equal(pairedLabBank.signature,paletteSignature());
  assert.equal(new Set(LAB_PAIRED.map(s=>s.hole.courseId)).size,6);
  for(const s of LAB_PAIRED){
    assert.deepEqual(generatePairedHole(s.levelIndex,s.hole.stage),s.hole);
    const a=newLabAttempt(s,'paired');assert.equal(a.engine,'glider-lab-3-controls-1');
    assert.ok(validLabEvent({id:'event',attemptId:a.id,type:'attempt',attempt:a}));
    const b=structuredClone(a);b.specimen.hole.tolerance+=.01;
    assert.equal(validLabEvent({id:'bad',attemptId:b.id,type:'attempt',attempt:b}),false);
    const item=pairedLabBank.holes.find(h=>h.record.id===s.hole.courseId)!;
    assert.deepEqual(item.analysis.failures,[]);assert.ok(item.analysis.qualifyingBases.length>=2);
    for(const base of item.analysis.bases)for(const r of base.routes){
      assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[s.levelIndex].paints,replayRoute(s.levelIndex,r.order,r.times)),s.hole.target)<=s.hole.tolerance+1e-9);
      assert.ok(r.finishWindowMs>0);assert.equal(r.pourLengths.length,r.times.length);
      if(r.setup){assert.equal(r.setup.cells,7**(r.times.length-1));assert.ok(r.setup.coverage>0&&r.setup.coverage<=1);}
    }
  }
});
test('five fresh targets and one explicit positive reference',()=>{
  LAB_PAIRED.forEach((s,i)=>{
    const prior=round2.palettes.find(p=>p.levelIndex===s.levelIndex)!;
    if(i===5)assert.ok(colorDistance(s.hole.target,mixtureColor(PLAY_LEVELS[s.levelIndex].paints,prior.holes[0].target))<1e-9);
    else for(const h of prior.holes.slice(0,2))assert.ok(colorDistance(s.hole.target,mixtureColor(PLAY_LEVELS[s.levelIndex].paints,h.target))>s.hole.tolerance*2);
  });
});
test('paired replay suggests another supported paint without changing the target',()=>{
  const a=newLabAttempt(LAB_PAIRED[0],'source');
  assert.equal(suggestedComparison(a),null);
  const count=a.paints.length,q=Array(count).fill(0);q[0]=1;
  a.shots=[{paint:0,seconds:.1,amount:1,before:Array(count).fill(0),after:q,cancelled:false}];
  const s=suggestedComparison(a)!;assert.ok(s.comparison);assert.notEqual(s.comparison.base,0);assert.deepEqual(s.hole,a.specimen.hole);
  const next=newLabAttempt(s,'replay');assert.equal(next.shots.length,0);
  assert.ok(validLabEvent({id:'next',attemptId:next.id,type:'attempt',attempt:next}));
  const review={verdict:'keep',routeVerdict:'revise',comparison:'both-good',challenge:'setup',issue:'',note:'',shot:null};
  assert.ok(validLabEvent({id:'feedback',attemptId:'replay',type:'review',review}));
  assert.equal(validLabEvent({id:'bad-feedback',attemptId:'replay',type:'review',review:{...review,comparison:'invalid'}}),false);
});
test('the reviewed two-pour imbalance is exposed, while the interior positive retains three-pour coverage',()=>{
  const rust=round2.palettes.find(p=>p.levelIndex===11)!.holes[1];
  const a=analyzeRoutes(11,rust.target,'interior-weave',undefined,false);
  assert.ok(a.failures.includes('unequal-efficient-starts'));assert.equal(a.robustThree,false);
  assert.ok(a.bases.every(b=>b.fewestFound===2));
  const ember=round2.palettes.find(p=>p.levelIndex===10)!.holes[1];
  const b=analyzeRoutes(10,ember.target,'interior-weave',undefined,false);
  assert.equal(b.robustThree,true);assert.deepEqual(b.failures,[]);
});
test('finishing intervals replay inside tolerance, without moving endpoints or altering parts',()=>{
  const s=LAB_PAIRED[0],order=s.hole.routeOrder,times=s.hole.routeTimes,p=PLAY_LEVELS[s.levelIndex].paints;
  let before=p.map((_,i)=>+(i===order[0]));
  times.slice(0,-1).forEach((t,i)=>{before=addPaint(before,order[i+1],chargeAmount(totalMass(before),t));});
  const snapshot=[...before],intervals=finishingIntervals(s.levelIndex,before,order.at(-1)!,s.hole.target);
  assert.ok(intervals.length>0);assert.deepEqual(before,snapshot);
  for(const interval of intervals){assert.ok(interval.hi>=interval.lo);const t=(interval.lo+interval.hi)/2;
    assert.ok(colorDistance(mixtureColor(p,addPaint(before,order.at(-1)!,chargeAmount(totalMass(before),t))),s.hole.target)<=s.hole.tolerance+1e-8);
  }
});
