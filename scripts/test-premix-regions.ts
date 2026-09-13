import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptedIntervals,geometry,measureRegion,classifyAlternatives} from './premix-region-metrics';
import {PLAY_LEVELS,mixtureColor,colorPoint,colorDistance} from '../app/play-engine';
import {premixReplay,normalizeRecipe,predecessor,holdForShare} from '../app/play-premix';
import bank from '../app/generated/play-premix-lab.json';

test('disconnected acceptance intervals are not combined into a fake window',()=>{
 const windows=acceptedIntervals(t=>(t>=.2&&t<=.22)||(t>=.8&&t<=1.2));
 assert.equal(windows.length,2);assert(Math.abs(windows[0].hi-windows[0].lo-.02)<1e-5);assert(Math.abs(windows[1].hi-windows[1].lo-.4)<1e-5);
});
test('exact recipe inversion works throughout accepted endpoint neighborhoods',()=>{
 const paints=PLAY_LEVELS[5].paints,anchor=[.2,.3,.2,.3],target=mixtureColor(paints,anchor);
 for(const offset of [-.01,0,.01]){const end=normalizeRecipe([.2+offset,.3,.2,.3-offset]);assert(colorDistance(mixtureColor(paints,end),target)<.0294);
  const q=predecessor(end,3,.15)!,t=holdForShare(1,.15,'normalized')!;
  assert(colorDistance(mixtureColor(paints,premixReplay(q,[3],[t],'normalized')),mixtureColor(paints,end))<1e-10);
 }
});
test('one-shot value change is not setup-then-lift; split additions are flagged',()=>{
 const start=[.4,.4,.1,.1],paints=PLAY_LEVELS[1].paints;
 const one={order:[3],times:[.7],error:0},target=mixtureColor(paints,premixReplay(start,one.order,one.times,'normalized'));
 assert.equal(geometry(1,start,target,one).traits.rise,false);
 const split={order:[3,3],times:[.3,.3],error:0},end=mixtureColor(paints,premixReplay(start,split.order,split.times,'normalized'));
 const g=geometry(1,start,end,split);assert.equal(g.mergeable,1);assert.equal(g.traits.rise,false);assert.equal(g.traits['interior-assembly'],false);
});
test('old examples remain replayable; local support uses the demonstrated interval',()=>{
 for(const h of bank.holes){const r=h.modes.normalized,m=measureRegion(h.level,h.initial,colorPoint(h.targetRGB as [number,number,number]),r);
  assert(m.intervals.some(w=>r.times.at(-1)!>=w.lo&&r.times.at(-1)!<=w.hi));assert.equal(m.setupCells,9);assert(m.finishWindowMs>=0);
 }
});
test('raw shortcuts stay visible even without supported timing',()=>{
 const h=bank.holes[0],m=measureRegion(h.level,h.initial,colorPoint(h.targetRGB as [number,number,number]),h.modes.normalized);
 const raw={...m,order:[0],times:[.3],supported:false};const c=classifyAlternatives('rise',[raw],m);
 assert.equal(c.rawMinimum,1);assert.equal(c.timingMinimum,m.supported?2:null);
});
