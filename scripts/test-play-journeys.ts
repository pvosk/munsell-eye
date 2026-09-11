import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyGeometry,finishEpisode,measureJourney,classifyApproach,selectPortfolio,analyzeJourney,type JourneyRoute,type Stroke} from '../app/play-journey-analysis';
import {PLAY_LEVELS,colorPoint,mixtureColor,LIVE_LANDING_TOLERANCE,colorDistance,protectedLabBank} from '../app/play-engine';
import {makeAtlas,replayRoute,routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';

test('close endpoints can have large excursion; monotone curved paths still have excess travel',()=>{
 const p=(x:number,y:number)=>({rgb:[0,0,0] as [number,number,number],lab:[x,y,0] as [number,number,number],position:[x*100,y*100,0] as [number,number,number]});
 const target=p(.5,0),close=p(.55,0);
 const direct=journeyGeometry([close,target],target),indirect=journeyGeometry([close,p(.7,.15),target],target);
 assert.equal(direct.excess,0);assert.ok(indirect.excess>6);assert.ok(indirect.excursion>2);
 const monotone=journeyGeometry([p(.8,0),p(.65,.1),target],target);assert.equal(monotone.excursion,0);assert.ok(monotone.excess>0);
});
test('finish episode excludes base/free first pour and distinguishes cleanup from another main move',()=>{
 const point=(L:number)=>({rgb:[0,0,0] as [number,number,number],lab:[L,0,0] as [number,number,number],position:[0,L*100,0] as [number,number,number]});
 const stroke=(before:number,after:number,length:number):Stroke=>({paint:0,before:point(before),after:point(after),length,chromaticLength:0,excursion:0,backtrack:0});
 assert.equal(finishEpisode([stroke(.3,.7,40)],point(.7)),null);
 const clean=finishEpisode([stroke(.5,.3,20),stroke(.3,.68,38),stroke(.68,.7,2)],point(.7));
 assert.equal(clean?.index,1);assert.equal(clean?.dominant,true);
 const down=finishEpisode([stroke(.5,.8,30),stroke(.8,.42,38),stroke(.42,.4,2)],point(.4));
 assert.ok(down!.signedValue<0);assert.equal(down?.dominant,true);
 assert.equal(finishEpisode([stroke(.5,.3,20),stroke(.3,.68,38),stroke(.68,.7,30)],point(.7)),null);
});
test('a direct competitor defeats an otherwise close-indirect diagnostic',()=>{
 const base={times:[.5],finishWindowMs:100,setup:null,length:25,journey:{excess:15,excursion:2}} as JourneyRoute;
 assert.equal(classifyApproach(2,[base]).status,'close-indirect');
 const shortcut={...base,length:8,journey:{...base.journey,excess:0,excursion:0}};
 assert.equal(classifyApproach(2,[base,shortcut]).status,'short-direct');
});
test('journey sampling preserves the real endpoint and palette contents',()=>{
 const signature=JSON.stringify(PLAY_LEVELS),h=protectedLabBank.holes[6],target=mixtureColor(PLAY_LEVELS[h.levelIndex].paints,h.record.target);
 const r=measureJourney(h.levelIndex,measureDesignRoute(h.levelIndex,routeDetails(h.levelIndex,h.roles.intended.order,h.roles.intended.times,target,LIVE_LANDING_TOLERANCE),target),target);
 assert.equal(r.fingerprint.length,9);assert.ok(r.traits.ride);
 assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[h.levelIndex].paints,replayRoute(h.levelIndex,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE);
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);assert.ok(r.journey.excess>=0);
});
test('dense round-seven interior remains supported and portfolios reject repeated targets',()=>{
 const h=protectedLabBank.holes[1],audit=analyzeJourney(h.levelIndex,h.record.target,makeAtlas(h.levelIndex,128,24));
 assert.equal(audit.styles.interior.allAvailable,true);
 assert.ok(audit.bases.every(b=>b.fewest===3));
 const result=selectPortfolio([{id:'one',audit},{id:'two',audit}]);assert.equal(result.selected.length,1);assert.equal(result.excluded.length,1);
 assert.ok(colorPoint([128,128,128]).lab[0]>0);
});
