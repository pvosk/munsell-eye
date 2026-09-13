import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {premixReplay} from '../app/play-premix';
import {canonicalLegs,legReplay,releasesToLegs,contributionRecipe,contributionLegs,routeContributions,recipeContributions,legExecution} from '../app/play-pigment-legs';
import {subsets,permutations,searchLegEndpoints,challengeLegOrders,optimizeSimplex} from './pigment-leg-search';
import {fractionIntervals,legGeometry,measureLegRegion,summarizeLegStyles} from './pigment-leg-metrics';
const paints=PLAY_LEVELS[1].paints,start=[.4,.3,.2,.1];
test('same-pigment releases collapse even beyond one-shot capacity',()=>{
 const legs=releasesToLegs(start,[3,3,3],[2.2,2.2,2.2]);assert.equal(legs.length,1);assert(legs[0].share>8/9);
 const expected=premixReplay(start,[3,3,3],[2.2,2.2,2.2],'normalized');legReplay(start,legs).forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-12));
 assert.equal(legExecution(legs)[0].releases,3);
});
test('nonadjacent returns stay distinct as paths but endpoint contributions consolidate',()=>{
 const legs=[{paint:0,share:.4},{paint:1,share:.3},{paint:0,share:.2}];assert.equal(canonicalLegs(legs).length,3);
 const c=routeContributions(start,legs),q=legReplay(start,legs);assert.equal(c.paints.length,2);
 for(const order of permutations(c.paints)){
  const actual=legReplay(start,contributionLegs(c.paints,c.weights,order));actual.forEach((v,i)=>assert(Math.abs(v-q[i])<1e-12));
 }
});
test('all permutations of contributions preserve endpoint but can change geometry',()=>{
 const indices=[0,1,3],weights=[.1,.3,.2,.4],target=mixtureColor(paints,contributionRecipe(start,indices,weights));
 const geometries=permutations(indices).map(order=>legGeometry(paints,start,target,contributionLegs(indices,weights,order)));
 assert(geometries.every(g=>g.error<1e-12));assert(new Set(geometries.map(g=>g.finish.toFixed(5))).size>1);
});
test('random repeated routes reduce to the same endpoint contribution mixture',()=>{
 for(let trial=1;trial<=300;trial++){
  const legs=Array.from({length:7},(_,i)=>({paint:(trial+i*i)%4,share:((trial*17+i*31)%97)/100}));
  const c=routeContributions(start,legs),a=legReplay(start,legs),b=contributionRecipe(start,c.paints,c.weights);
  a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-12));
 }
});
test('recipe construction supports a free pure-base start and triad two-leg upper bound',()=>{
 for(const p of [[1,0,0],[.3,.4,.3]]){
  const q=[.2,.6,.2],c=recipeContributions(p,q);assert(c.paints.length<=2);
  legReplay(p,contributionLegs(c.paints,c.weights)).forEach((v,i)=>assert(Math.abs(v-q[i])<1e-12));
 }
});
test('simplex optimizer searches both transfer directions and stays on simplex',()=>{
 const f=(q:number[])=>{assert(q.every(x=>x>=0));assert(Math.abs(q.reduce((a,b)=>a+b)-1)<1e-9);return(q[0]-.7)**2+(q[1]-.2)**2+(q[2]-.1)**2;};
 assert(optimizeSimplex(f,[.1,.2,.7],200).error<1e-10);assert.equal(subsets(6,3).length,20);
});
test('independent endpoint and ordered-fraction solvers find known two-leg solution',()=>{
 const target=mixtureColor(paints,legReplay(start,[{paint:1,share:.46},{paint:3,share:.57}]));
 const primary=searchLegEndpoints(paints,start,target,2,18921,64,5),secondary=challengeLegOrders(paints,start,target,2,71928,96,6);
 assert(primary.best[1].error<T/100);assert(secondary.best[1]<T/100);
});
test('fraction windows retain separate components and an otherwise missed narrow anchor',()=>{
 const windows=fractionIntervals(x=>(x>.2&&x<.3)||(x>.7001&&x<.7002),.70015,64);
 assert.equal(windows.length,2);assert(windows[1].hi-windows[1].lo<.00011);
});
test('white-only movement is not a chromatic ride and a zero-leg start is distinct',()=>{
 const target=mixtureColor(paints,legReplay(start,[{paint:3,share:.8}])),g=legGeometry(paints,start,target,[{paint:3,share:.8}]);
 assert(!g.traits['chromatic-ride']);assert.equal(measureLegRegion(paints,start,mixtureColor(paints,start),[]).legs.length,0);
});
test('raw shortcut cannot disappear behind a robust longer route',()=>{
 const target=mixtureColor(paints,legReplay(start,[{paint:3,share:.7}])),r=measureLegRegion(paints,start,target,[{paint:3,share:.7}]);
 const s=summarizeLegStyles([r],1,3);assert.equal(s.rawMinimum,1);assert.equal(s.unmeasured,3);
 assert(!JSON.stringify(s).includes('required'));
});
test('invalid legs cannot silently alter a recipe',()=>{
 assert.throws(()=>legReplay(start,[{paint:9,share:.5}]));assert.throws(()=>canonicalLegs([{paint:0,share:NaN}]));
 assert.throws(()=>contributionLegs([1,2],[.2,.3,.5],[1,1]));
});
