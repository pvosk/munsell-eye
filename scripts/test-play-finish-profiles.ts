import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {finishProfile} from '../app/play-finish-profile';
import {sampleJourney,finishEpisode,measureJourney,requireCurrentValuePolicy,JOURNEY_POLICY} from '../app/play-journey-analysis';
import {PLAY_LEVELS,contrastLabBank,mixtureColor,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
const stroke=(a:number[],b:number[])=>({before:{lab:a},after:{lab:b}});
test('value-led finishes work in both directions, not from a free base alone',()=>{
 for(const sign of [1,-1]){
  const a=[.5,0,0],b=[.5-sign*.15,.02,0],c=[.5+sign*.2,.01,0];
  assert.equal(finishProfile([stroke(a,b),stroke(b,c)],{index:1,dominant:true},2).valueLed,true);
 }
 assert.equal(finishProfile([stroke([.2,0,0],[.8,0,0])],null,1).valueLed,false);
});
test('a large setup shift and a hue-coupled finish are separate diagnostics',()=>{
 const a=finishProfile([stroke([.9,0,0],[.6,0,0]),stroke([.6,0,0],[.47,0,0])],{index:1,dominant:true},2);
 assert.equal(a.valueMovement,true);assert.equal(a.valueLed,false);assert.equal(a.reasons.length,1);
 const b=finishProfile([stroke([.4,0,0],[.3,0,0]),stroke([.3,0,0],[.5,.3,0])],{index:1,dominant:true},2);
 assert.equal(b.valueLed,false);assert.equal(b.reasons.length,1);
 const c=finishProfile([stroke([.4,0,0],[.4,.1,0]),stroke([.4,.1,0],[.7,.1,0])],{index:1,dominant:true},2);
 assert.equal(c.relativeToSetup,null);assert.equal(c.valueLed,true);
});
test('round-nine regressions retain actual routes and distinguish CMY correction from Sienna lift',()=>{
 const before=JSON.stringify(PLAY_LEVELS);
 for(const h of contrastLabBank.holes.filter(h=>h.focus==='setup-lift')){
  const target=mixtureColor(PLAY_LEVELS[h.levelIndex].paints,h.record.target);
  const r=measureJourney(h.levelIndex,measureDesignRoute(h.levelIndex,routeDetails(h.levelIndex,h.record.order,h.record.times,target,LIVE_LANDING_TOLERANCE),target),target);
  assert.equal(r.traits['value-shift'],h.levelIndex===29);
  assert.equal(r.valueFinish.valueMovement,true);
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),before);
});
test('published compact measurements exactly match offline full-evidence summaries',()=>{
 const full=JSON.parse(readFileSync('docs/play-finish-profile-audit.json','utf8'));
 const compact=JSON.parse(readFileSync('app/generated/play-finish-profiles.json','utf8'));
 assert.equal(full.holes.length,5);
 assert.deepEqual(compact,{policy:full.policy,holes:full.holes.map((h:typeof full.holes[number])=>({...h,bases:h.bases.map(({routes,...b}:typeof h.bases[number])=>({...b,routeCount:routes.length}))}))});
 for(const h of compact.holes){const archived=contrastLabBank.holes.find(x=>x.record.id===h.id)!;
  const target=mixtureColor(PLAY_LEVELS[archived.levelIndex].paints,archived.record.target);
  const {strokes}=sampleJourney(archived.levelIndex,archived.roles.intended);
  assert.deepEqual(h.featured,finishProfile(strokes,finishEpisode(strokes,target),archived.roles.intended.meaningfulPours));
 }
});
test('current selection refuses silently inherited historical value-shift labels',()=>{
 assert.throws(()=>requireCurrentValuePolicy({version:'journeys-1'},'value-shift'),/remeasurement/);
 assert.doesNotThrow(()=>requireCurrentValuePolicy({version:JOURNEY_POLICY.journeyVersion},'value-shift'));
 assert.doesNotThrow(()=>requireCurrentValuePolicy({version:'journeys-1'},'ride'));
});
