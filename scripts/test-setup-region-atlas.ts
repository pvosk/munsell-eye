import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PAINTS} from '../app/paint-mixing';
import {atlasKey,destinationQueryKey,predecessorRecipe} from './setup-region-atlas';
import {legStep} from '../app/play-pigment-legs';
test('inverse region witnesses forward replay without replacing endpoints',()=>{
 for(const n of [3,4,5,6,7])for(let p=0;p<n;p++){
  const q=Array(n).fill(1/n),share=.6/n,start=predecessorRecipe(q,p,share)!;
  assert(start);legStep(start,{paint:p,share}).forEach((v,i)=>assert(Math.abs(v-q[i])<1e-10));
  assert.equal(predecessorRecipe(q,p,1),null);assert.equal(predecessorRecipe(q,p,2/n),null);
 }
});
test('atlas cache preserves recipe coordinates and invalidates physical inputs',()=>{
 const paints=PAINTS.slice(0,4),key=atlasKey(paints,'physics-source-1',{samples:64});
 assert.equal(key,atlasKey(paints,'physics-source-1',{samples:64}));
 assert.notEqual(key,atlasKey([...paints].reverse(),'physics-source-1',{samples:64}));
 assert.notEqual(key,atlasKey(paints,'physics-source-2',{samples:64}));
 assert.notEqual(key,atlasKey(paints.map((p,i)=>i? p:{...p,strength:p.strength+.01}),'physics-source-1',{samples:64}));
 const a=destinationQueryKey(key,[120,130,140],.0294,2);
 assert.notEqual(a,destinationQueryKey(key,[120,130,140],.0300,2));
 assert.notEqual(a,destinationQueryKey(key,[120,130,141],.0294,2));
 assert.notEqual(a,destinationQueryKey(key,[120,130,140],.0294,3));
});
