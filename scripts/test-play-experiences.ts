import test from 'node:test';
import assert from 'node:assert/strict';
import {shiftDirection,experienceMatches,analyzeExperience,experienceSupported,rideShape} from '../app/play-experience-audit';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {routeDetails,replayRoute} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import bank from '../app/generated/play-lab-round6.json';

test('value shift is symmetric in direction and excludes base selection and single adjustments',()=>{
  const r={times:[.4,.6],meaningfulPours:2,setupTravel:10,lastLength:15,finishValue:.12};
  assert.equal(shiftDirection(r),'rise');assert.equal(shiftDirection({...r,finishValue:-.12}),'drop');
  assert.equal(shiftDirection({...r,times:[.6]}),null);
  assert.equal(shiftDirection({...r,setupTravel:0}),null);
  assert.equal(shiftDirection({...r,finishValue:.08}),null);
});
test('real upward and downward pours classify by signed measured finish, not paint category',()=>{
  for(const [order,times] of [[[1,0,3],[.6,.6]],[[3,0,1],[.6,.6]]] as const){
    const recipe=replayRoute(1,[...order],[...times]),target=mixtureColor(PLAY_LEVELS[1].paints,recipe);
    const r=measureDesignRoute(1,routeDetails(1,[...order],[...times],target,LIVE_LANDING_TOLERANCE),target);
    assert.ok(Math.abs(r.finishValue)>.1);assert.equal(shiftDirection(r),r.finishValue>0?'rise':'drop');
    assert.equal(experienceMatches(r,'value-shift'),true);
  }
});
test('new direction-aware audit preserves valid witnesses and the weak natural-start ride',()=>{
  const h=bank.holes[2],a=analyzeExperience(h.levelIndex,h.record.target);
  assert.equal(a.styles.ride.everyBaseResistant,false);
  assert.ok(a.rideFloor<36);
  for(const b of a.bases)for(const r of b.routes){
    assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[h.levelIndex].paints,replayRoute(h.levelIndex,r.order,r.times)),a.target)<=LIVE_LANDING_TOLERANCE+1e-9);
    if(experienceSupported(r)){const shape=rideShape(h.levelIndex,r);assert.ok(shape.arcRatio>=1-1e-9);assert.ok(shape.bow>=0);}
  }
});
