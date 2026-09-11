import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {focusedShortlist,rideFailures,focusMatches,valueTradeoffs,type Focus} from './discover-focused-palettes';
import {allBaseEligible} from './discover-play-palettes';
import {PLAY_LEVELS,mixtureColor,addPaint,chargeAmount,totalMass,colorDistance,LIVE_LANDING_TOLERANCE,CHARGE_SECONDS} from '../app/play-engine';
import type {DesignAnalysis,DesignRoute} from '../app/play-route-design';
import type {PaletteTrial} from './discover-play-palettes';

test('ride policy removes only the old every-base 30-unit requirement',()=>{
  const a={failures:['short-or-muted-ride','short-competing-route','near-pure-target']} as DesignAnalysis;
  assert.deepEqual(rideFailures(a,.1),['short-competing-route','near-pure-target']);
  assert.deepEqual(rideFailures(a,.06),['short-competing-route','near-pure-target','muted-ride-target']);
  assert.equal(a.failures.length,3);
});
test('shortlist has twelve new four-paint combinations and unchanged originals',()=>{
  const original=JSON.stringify(PLAY_LEVELS),s=focusedShortlist();
  const novel=s.trials.filter(t=>!t.control);
  assert.equal(novel.length,12);assert.equal(s.trials.length,16);
  assert.equal(new Set(novel.map(t=>t.paints.map(p=>p.id).sort().join())).size,12);
  assert.equal(JSON.stringify(PLAY_LEVELS),original);
  assert.ok(s.combinations>3000);
});
test('a base selection or a single adjustment cannot count as value–color setup',()=>{
  const paints=PLAY_LEVELS[1].paints,white=paints.findIndex(p=>p.category==='White');
  assert.ok(white>=0);
  for(const route of [{order:[white],times:[]},{order:[white,0],times:[.5]}]){
    assert.equal(valueTradeoffs(1,route as DesignRoute,[1,1,1,1]),0);
  }
});
test('all saved holdout witnesses independently land and retain every-base support',()=>{
  const data=JSON.parse(readFileSync('docs/play-focused-discovery.json','utf8')) as {
    holdout:{trial:PaletteTrial;results:{focus:Focus;passes:number;tested:number;examples:{recipe:number[];analysis:DesignAnalysis;styleBases:number[]}[]}[]}[];
  };
  const before=JSON.stringify(PLAY_LEVELS);let routesChecked=0,holesChecked=0;
  for(const e of data.holdout){
    const slot=PLAY_LEVELS.length;
    PLAY_LEVELS.push({name:e.trial.id,subtitle:'Test',paints:e.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
    try{
      for(const result of e.results){
        assert.ok(result.passes<=result.tested);
        for(const example of result.examples){
          holesChecked++;
          assert.ok(allBaseEligible(example.analysis));
          assert.equal(example.analysis.bases.length,4);
          const target=mixtureColor(e.trial.paints,example.recipe);
          assert.ok(example.analysis.bases.some(b=>b.routes.some(r=>focusMatches(slot,r,example.recipe,result.focus))));
          for(const b of example.analysis.bases)for(const r of b.routes){
            let q=e.trial.paints.map((_,i)=>+(i===b.base));
            assert.equal(r.order[0],b.base);assert.ok(r.efficient);
            for(let i=0;i<r.times.length;i++){
              assert.ok(r.times[i]>=0&&r.times[i]<=CHARGE_SECONDS);
              q=addPaint(q,r.order[i+1],chargeAmount(totalMass(q),r.times[i]));
            }
            assert.ok(colorDistance(mixtureColor(e.trial.paints,q),target)<=LIVE_LANDING_TOLERANCE+1e-9);
            routesChecked++;
          }
        }
      }
    }finally{PLAY_LEVELS.splice(slot,1);}
  }
  assert.equal(JSON.stringify(PLAY_LEVELS),before);assert.ok(holesChecked>0);assert.ok(routesChecked>=holesChecked*4);
  console.log(`Independently replayed ${routesChecked} routes across ${holesChecked} saved style-target examples.`);
});

test('dense finalist checks preserve exact endpoints and focused traits',()=>{
  const data=JSON.parse(readFileSync('docs/play-focused-finalists.json','utf8')) as {
    audits:{trial:PaletteTrial;focus:Focus;recipe:number[];accepted:boolean;analysis:DesignAnalysis}[];
  };
  let count=0;const unique=new Set<string>();
  for(const a of data.audits){
    if(!a.accepted)continue;
    assert.ok(allBaseEligible(a.analysis));
    unique.add(a.trial.id+JSON.stringify(a.recipe));
    const slot=PLAY_LEVELS.length;
    PLAY_LEVELS.push({name:a.trial.id,subtitle:'Test',paints:a.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
    try{
      const target=mixtureColor(a.trial.paints,a.recipe);
      assert.ok(a.analysis.bases.some(b=>b.routes.some(r=>focusMatches(slot,r,a.recipe,a.focus))));
      for(const b of a.analysis.bases)for(const r of b.routes){
        let q=a.trial.paints.map((_,i)=>+(i===b.base));
        for(let i=0;i<r.times.length;i++)q=addPaint(q,r.order[i+1],chargeAmount(totalMass(q),r.times[i]));
        assert.ok(colorDistance(mixtureColor(a.trial.paints,q),target)<=LIVE_LANDING_TOLERANCE+1e-9);count++;
      }
    }finally{PLAY_LEVELS.splice(slot,1);}
  }
  assert.ok(unique.size>0);
  console.log(`Checked ${count} dense-search route witnesses, ${unique.size} distinct proposed holes.`);
});
