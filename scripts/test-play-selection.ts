import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import type {AuditedHole} from '../app/play-route-audit';
import {assessSelection,plausibleStarts,compareSelection} from '../app/play-route-selection';
const pool=JSON.parse(readFileSync('docs/play-lab-round6-search.json','utf8')) as {candidates:{palette:number;audit:AuditedHole}[]};

test('plausible starts include independent closest and hue scenarios without mutation',()=>{
  for(const {palette,audit} of pool.candidates){
    const before=JSON.stringify(audit),p=PLAY_LEVELS[palette].paints,s=plausibleStarts(p,audit);
    assert.ok(s.closest.every(i=>s.plausible.includes(i)));
    assert.ok(s.hue.every(i=>s.plausible.includes(i)));
    assert.ok(s.closest.every(i=>s.distances[i]<=Math.min(...s.distances)+1e-8));
    assert.ok(s.plausible.length>0);assert.equal(JSON.stringify(audit),before);
  }
});
test('neutral hue is not used; observed scenarios are validated and kept separate',()=>{
  const c=pool.candidates[0],a=structuredClone(c.audit);a.target.lab=[.5,0,0];
  const s=plausibleStarts(PLAY_LEVELS[c.palette].paints,a,[1,1,-1,99,.5]);
  assert.deepEqual(s.hue,[]);assert.deepEqual(s.observed,[1]);assert.ok(s.plausible.includes(1));
});
test('all-base scope never omits a starting paint; floors cannot improve by adding scenarios',()=>{
  for(const {palette,audit} of pool.candidates){
    const p=PLAY_LEVELS[palette].paints;
    const close=assessSelection(p,audit,'chromatic-ride','closest'),plausible=assessSelection(p,audit,'chromatic-ride'),all=assessSelection(p,audit,'chromatic-ride','all');
    assert.equal(all.selected.length,p.length);
    assert.ok(plausible.travelFloor<=close.travelFloor+1e-8);
    assert.ok(all.travelFloor<=plausible.travelFloor+1e-8);
    assert.ok(all.rideFloor<=plausible.rideFloor+1e-8);
    assert.ok(plausible.rank.every(Number.isFinite));
  }
});
test('featured length cannot outweigh earlier weakest-start criteria',()=>{
  assert.ok(compareSelection({rank:[1,1,2,30,5]},{rank:[1,1,1,1000,100000]})<0);
  assert.equal(compareSelection({rank:[1,2]},{rank:[1,2]}),0);
});
test('the strict three-addition profile needs support and no found one/two route from every base',()=>{
  const c=pool.candidates[0],a=structuredClone(c.audit),p=PLAY_LEVELS[c.palette].paints;
  for(const b of a.bases){b.fewest=3;b.bestTwoError=1.2;b.viable=true;for(const r of b.routes)r.meaningfulPours=3;}
  assert.equal(assessSelection(p,a,'interior-weave').profileThree,true);
  a.bases[0].fewest=2;assert.equal(assessSelection(p,a,'interior-weave').profileThree,false);
  a.bases[0].fewest=3;a.bases[0].bestTwoError=1.05;assert.equal(assessSelection(p,a,'interior-weave').profileThree,false);
});
test('new gap-selected interior evidence replays from every base with three meaningful additions',()=>{
  const report=JSON.parse(readFileSync('docs/play-interior-proposal-probe.json','utf8')) as {results:{palette:number;checked:{audit:AuditedHole}[]}[]};
  let passing=0;
  for(const e of report.results)for(const c of e.checked){
    const paints=PLAY_LEVELS[e.palette].paints,a=c.audit,m=assessSelection(paints,a,'interior-weave','all');
    if(!m.profileThree)continue;passing++;
    for(const b of a.bases){
      assert.equal(b.fewest,3);assert.ok(b.bestTwoError>1.1);
      const route=b.routes.find(r=>r.meaningfulPours===3&&r.finishWindowMs>=55&&r.setup&&r.setup.coverage>=.04);
      assert.ok(route);
      assert.ok(colorDistance(mixtureColor(paints,replayRoute(e.palette,route.order,route.times)),a.target)<=LIVE_LANDING_TOLERANCE);
    }
  }
  assert.equal(passing,18);
});
test('higher-resolution independent checks do not expose a shortcut in six representatives',()=>{
  const r=JSON.parse(readFileSync('docs/play-selection-verified.json','utf8')) as {rows:{passes:boolean;minimumTwoError:number}[]};
  assert.equal(r.rows.length,6);assert.ok(r.rows.every(e=>e.passes&&e.minimumTwoError>1.1));
});
