import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {routeDetails,replayRoute,paletteSignature} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {analyzeAudit,auditTraits,timingSupported,AUDIT_STYLES,type AuditedHole} from '../app/play-route-audit';
import {reopenedShortlist} from './audit-and-reopen-palettes';
import type {PaletteTrial} from './discover-play-palettes';
import {assessStartBias} from '../app/play-route-starts';
import bank from '../app/generated/play-lab-round5.json';

test('same paint order can carry a balancing route and a token-correction bypass',()=>{
  const h=bank.holes[5],target=mixtureColor(PLAY_LEVELS[17].paints,h.record.target);
  const observed=measureDesignRoute(17,routeDetails(17,[0,2,1],[.788,.338],target,LIVE_LANDING_TOLERANCE),target,true,LIVE_LANDING_TOLERANCE);
  const featured=measureDesignRoute(17,routeDetails(17,h.record.order,h.record.times,target,LIVE_LANDING_TOLERANCE),target,true,LIVE_LANDING_TOLERANCE);
  assert.deepEqual(observed.order,featured.order);
  assert.ok(observed.error<LIVE_LANDING_TOLERANCE);
  assert.equal(observed.meaningfulPours,1);
  assert.ok(observed.finishWindowMs>160);
  assert.equal(auditTraits(17,observed,target).includes('opposing-colors'),false);
  assert.equal(auditTraits(17,featured,target).includes('opposing-colors'),true);
});
test('independent search detects Orange Echo bypass without injecting player controls',()=>{
  const a=analyzeAudit(17,bank.holes[5].record.target);
  assert.equal(a.globalFewest,2);
  assert.ok(a.styles['opposing-colors'].availableBases.includes(0));
  assert.ok(a.styles['opposing-colors'].bypassBases.includes(0));
  assert.equal(a.styles['opposing-colors'].robustBases.includes(0),false);
  assert.equal(a.styles['opposing-colors'].eligible,false);
  const r=a.bases[0].routes.find(r=>r.meaningfulPours<2&&timingSupported(r));assert.ok(r);
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[17].paints,replayRoute(17,r.order,r.times)),a.target)<=LIVE_LANDING_TOLERANCE);
});
test('substantial observed single additions remain rides',()=>{
  for(const [index,order,times] of [[0,[3,1],[.855]],[1,[1,2],[.813]],[7,[3,0],[.58]]] as const){
    const h=bank.holes[index],target=mixtureColor(PLAY_LEVELS[h.levelIndex].paints,h.record.target);
    const r=measureDesignRoute(h.levelIndex,routeDetails(h.levelIndex,[...order],[...times],target,LIVE_LANDING_TOLERANCE),target,true,LIVE_LANDING_TOLERANCE);
    assert.ok(r.error<=LIVE_LANDING_TOLERANCE);assert.equal(r.times.length,1);
    assert.ok(auditTraits(h.levelIndex,r,target).includes('chromatic-ride'));
  }
});
test('free white start is not a setup lift, even for a light target',()=>{
  const palette=1,order=[3,1],times=[.35],target=mixtureColor(PLAY_LEVELS[palette].paints,replayRoute(palette,order,times));
  const r=measureDesignRoute(palette,routeDetails(palette,order,times,target),target);
  assert.equal(auditTraits(palette,r,target).includes('setup-lift'),false);
});
test('reopened shortlist includes unfamiliar combinations and achromatic strata',()=>{
  const before=paletteSignature(19),s=reopenedShortlist();
  assert.equal(s.combinations,4845);assert.equal(s.trials.length,12);
  assert.equal(new Set(s.trials.map(p=>p.paints.map(p=>p.id).sort().join())).size,12);
  assert.ok(s.trials.some(p=>p.paints.some(p=>p.category==='White')));
  assert.ok(s.trials.some(p=>p.paints.some(p=>p.category==='Black')));
  assert.ok(s.trials.some(p=>p.paints.every(p=>!['White','Black'].includes(p.category))));
  assert.equal(paletteSignature(19),before);assert.equal(bank.signature,before);
});
test('fixed audit witnesses replay; robust coverage excludes reported supported bypasses',()=>{
  const report=JSON.parse(readFileSync('docs/play-route-audit-fixed.json','utf8')) as {fixed:{levelIndex:number;audit:AuditedHole}[]};
  assert.equal(report.fixed.length,8);
  let witnesses=0;
  for(const {levelIndex:p,audit:a} of report.fixed){
    for(const b of a.bases)for(const r of b.routes){
      witnesses++;assert.equal(r.times.length,b.fewest);
      assert.ok(r.times.every(t=>t>=0&&t<=2.2));
      assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[p].paints,replayRoute(p,r.order,r.times)),a.target)<=LIVE_LANDING_TOLERANCE+1e-9);
      assert.deepEqual(auditTraits(p,r,a.target),r.traits);
    }
    for(const s of AUDIT_STYLES){
      const style=a.styles[s];assert.ok(style.robustBases.every(b=>style.availableBases.includes(b)&&!style.bypassBases.includes(b)));
      if(style.eligible)assert.ok(style.robustRatio>=.5&&a.bases.every(b=>b.viable));
    }
  }
  assert.ok(witnesses>100);
});
test('fresh palette witnesses replay against saved paints, not temporary live indices',()=>{
  type Result={trial:PaletteTrial;seed:number;tested:number;examples:AuditedHole[]};
  const report=JSON.parse(readFileSync('docs/play-route-audit-discovery.json','utf8')) as {oldCohort:Result[];newCohort:Result[];holdout:Result[];finalists:string[]};
  const before=paletteSignature(19);let count=0;
  assert.equal(report.oldCohort.length,16);assert.equal(report.newCohort.length,12);
  assert.ok(report.holdout.some(e=>e.trial.id.startsWith('reopen-')));
  for(const e of report.holdout){
    assert.equal(e.seed,20270317);assert.equal(e.tested,48);
    const p=PLAY_LEVELS.length;
    PLAY_LEVELS.push({name:e.trial.id,subtitle:'Test replay',paints:e.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
    try{for(const a of e.examples){
      assert.ok(colorDistance(mixtureColor(e.trial.paints,a.recipe),a.target)<1e-10);
      for(const b of a.bases)for(const r of b.routes){
        count++;
        assert.ok(colorDistance(mixtureColor(e.trial.paints,replayRoute(p,r.order,r.times)),a.target)<=LIVE_LANDING_TOLERANCE+1e-9);
        assert.deepEqual(auditTraits(p,r,a.target),r.traits);
      }
    }}finally{PLAY_LEVELS.splice(p,1);}
  }
  assert.ok(count>100);assert.equal(paletteSignature(19),before);
});
test('majority ride coverage cannot hide a closest-paint shortcut',()=>{
  const report=JSON.parse(readFileSync('docs/play-route-audit-dense.json','utf8')) as {results:{trial:PaletteTrial;targets:{confirmed:string[];audit:AuditedHole}[]}[]};
  let rides=0,balancing=0;
  for(const e of report.results)for(const t of e.targets){
    const starts=assessStartBias(e.trial.paints,t.audit);
    if(t.confirmed.includes('chromatic-ride')){
      rides++;assert.equal(starts.styles['chromatic-ride'].majorityEligible,true);
      assert.equal(starts.styles['chromatic-ride'].freeStartEligible,false);
      // These bypasses are substantial differences, not 35.9 vs 36 rounding.
      assert.ok(starts.styles['chromatic-ride'].minimumClosestRide!<30);
    }
    if(t.confirmed.includes('opposing-colors')&&starts.styles['opposing-colors'].freeStartEligible)balancing++;
  }
  assert.equal(rides,11);assert.equal(balancing,2);
});
