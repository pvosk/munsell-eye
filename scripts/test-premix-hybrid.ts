import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {premixReplay} from '../app/play-premix';
import {gradient,ascend,encode,decode,gradientChallenger,oneShotField,closestOne,cleanupAttack,structuralVerdict,targetOf,refinePuzzle,type Puzzle} from './premix-hybrid';
import {searchPremix} from './premix-search';
import {geometry,measureRegion} from './premix-region-metrics';
const p:Puzzle={id:'test',palette:'Zorn',paints:PLAY_LEVELS[1].paints,start:[.4,.3,.2,.1],targetRecipe:[],control:{order:[2,3,1],times:[.4,.4,.4],error:0}};
p.targetRecipe=premixReplay(p.start,p.control.order,p.control.times,'normalized');
test('finite differences and bounded optimizer have correct direction',()=>{
 const f=(x:number[])=>-((x[0]-.3)**2)-2*(x[1]-.7)**2,g=gradient(f,[.8,.1]);
 assert(Math.abs(g[0]+1)<1e-6&&Math.abs(g[1]-2.4)<1e-6);
 const r=ascend(f,[.8,.1],[[0,1],[0,1]],80);assert(r.score>-1e-7);assert(r.accepted>0);
});
test('start and destination have independent legal simplex coordinates',()=>{
 const x=encode(p),q=decode(p,x);assert(colorDistance(targetOf(p),targetOf(q))<1e-10);
 x[0]+=.2;const moved=decode(p,x);assert.notDeepEqual(moved.start,p.start);assert.deepEqual(moved.targetRecipe,q.targetRecipe);
 assert(Math.abs(moved.start.reduce((a,b)=>a+b)-1)<1e-12);
});
test('color derivatives are stable across finite-difference step sizes',()=>{
 const f=(x:number[])=>mixtureColor(p.paints,premixReplay(p.start,[1,3],x,'normalized')).lab[0];
 const a=gradient(f,[.4,.7],1e-4),b=gradient(f,[.4,.7],5e-5);
 assert(a.every((v,i)=>Math.abs(v-b[i])<1e-5));
});
test('both challengers find exact one-shot counterexamples with supplied paints',()=>{
 const q={...p,control:{order:[3],times:[.6],error:0},targetRecipe:premixReplay(p.start,[3],[.6],'normalized')};
 const g=gradientChallenger(q,1,64,881,32),independent=searchPremix(0,q.start,targetOf(q),'normalized',1,7799,256,12,q.paints);
 assert(g.best[0]<T&&independent.best[0]<T);assert(!structuralVerdict(2,independent.best,null).pass);
});
test('cleanup attack finds a concrete small-correction route',()=>{
 const q={...p,control:{order:[1,3],times:[.6,.1],error:0},targetRecipe:premixReplay(p.start,[1,3],[.6,.1],'normalized')};
 const attack=cleanupAttack(q,78911,128,36);assert(attack.best&&attack.best.error<=T);
 assert(!structuralVerdict(2,[T*3,T*.01],attack.best).pass);
});
test('legacy filters and custom-palette measurements agree',()=>{
 assert.deepEqual(geometry(1,p.start,targetOf(p),p.control),geometry(0,p.start,targetOf(p),p.control,p.paints));
 assert.deepEqual(measureRegion(1,p.start,targetOf(p),p.control),measureRegion(0,p.start,targetOf(p),p.control,p.paints));
});
test('near-one-shot is distinguished from formal one-shot failure',()=>{
 assert(!structuralVerdict(2,[T*1.08,T*.1],null).pass);
 assert(structuralVerdict(3,[T*3,T*1.4,T*.1],null).pass);
 const field=oneShotField(p.paints,p.start);assert(closestOne(field,targetOf(p))>=0);
});
test('refinement preserves physical parameters and playable witness',()=>{
 const snapshot=JSON.stringify(p.paints),r=refinePuzzle(p,99327,2);
 assert.equal(JSON.stringify(r.p.paints),snapshot);
 assert(colorDistance(mixtureColor(r.p.paints,premixReplay(r.p.start,r.p.control.order,r.p.control.times,'normalized')),targetOf(r.p))<=T);
 assert(r.history.length===2);
});
