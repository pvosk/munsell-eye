import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Color,mix} from 'spectral.js';
import {mixtureColor,PLAY_LEVELS} from '../app/play-engine';
import {mixPigmentRGB} from '../app/pigment-color';
import type {AtlasCase} from '../app/chroma-atlas/types';
import {canonical,changeFraction,displayLab,distance,exactKey,lchToLab,labToLch,nodeRoute,point,QueryCache,replay,step,type LiveResult} from '../app/chroma-atlas/live-model';
import {LiveSolver} from '../app/chroma-atlas/live-search';
const data=JSON.parse(readFileSync('public/atlas/case-0.json','utf8')) as AtlasCase;
const input={...nodeRoute(data.nodes,data.defaultNode),target:data.target.lab};
const tick=async()=>{};
test('shared physical mixer preserves original spectral arithmetic and exported arcs',()=>{
 for(const level of PLAY_LEVELS.slice(0,20))for(let k=0;k<12;k++){
  const q=level.paints.map((_,i)=>k===0?Number(i===0):.01+((i+1)*1.723+k*.513)%1),mass=q.reduce((a,b)=>a+b);
  const active=level.paints.map((p,i)=>{const c=new Color(p.rgb);c.tintingStrength=p.strength;return [c,q[i]/mass] as [Color,number];}).filter(([,v])=>v>0),c=active.length===1?active[0][0]:mix(...active);
  const original=c.lRGB.map(v=>{v=Math.max(0,Math.min(1,v));return 255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055);});
  assert.deepEqual(mixPigmentRGB(level.paints,q),original);assert.deepEqual(mixtureColor(level.paints,q).rgb,original);
 }
 for(const n of data.nodes){const c=point(data.paints,n.recipe);assert(distance(c.lab,n.lab)<1e-10);assert(distance(c.rgb,n.rgb)<1e-9);}
});
test('slider recipe rebalance, leg composition and zero-leg capture remain honest',()=>{
 const q=changeFraction([1,0,0,0],0,.4);assert(distance(q,[.4,.2,.2,.2])<1e-12);assert(Math.abs(changeFraction(q,1,.7).reduce((a,b)=>a+b)-1)<1e-12);
 assert.equal(canonical([{paint:0,share:.2},{paint:0,share:.4}]).length,1);
 const target=point(data.paints,input.start).lab,t=replay(data.paints,input.start,input.legs,target,data.tolerance);assert.equal(t.capture,0);
 assert(distance(lchToLab(labToLch(input.target)),input.target)<1e-12);assert(displayLab([.7,.4,.4]).clipped);
});
test('exact cache keys invalidate tiny changes; nearby results are only seeds',()=>{
 const cache=new QueryCache(2),a=exactKey(data,input),changed={...input,target:input.target.map((v,i)=>v+(i===0?1e-8:0))},b=exactKey(data,changed);assert.notEqual(a,b);
 assert.notEqual(a,exactKey({...data,paints:data.paints.map((p,i)=>i? p:{...p,strength:p.strength+.01})},input));
 const r={key:a,target:input.target,phase:'done',best:input.legs,bestError:0,shortest:3,checkedDepth:3,nodes:[],landingRecipe:null,closestError:0,cacheHit:false} as LiveResult;
 cache.put(a,input,r);assert(cache.get(a));assert.equal(cache.get(b),undefined);assert.equal(cache.near(changed).length,1);cache.put(b,changed,{...r,key:b});cache.put('third',input,{...r,key:'third'});assert.equal(cache.size,2);assert.equal(cache.get(a),undefined);
});
test('live search replays solutions and rebuilt regions; revisits are exact cache hits',async()=>{
 const solver=new LiveSolver(data),all:LiveResult[]=[];const changed={...input,target:input.target.map((v,i)=>v+(i===0?.004:0))};
 await solver.solve(changed,r=>all.push(r),()=>false,tick);const done=all.at(-1)!;assert.equal(done.phase,'done');assert.equal(done.checkedDepth,3);assert(done.best&&done.shortest!==null);assert.equal(done.shortest,done.best.length);assert(replay(data.paints,changed.start,done.best,changed.target,data.tolerance,0).error<=data.tolerance);
 assert(done.nodes.length>10);for(const n of done.nodes){const r=nodeRoute(done.nodes,n.id);assert(replay(data.paints,r.start,r.legs,changed.target,data.tolerance,0).error<=data.tolerance+1e-9);}
 const hits:LiveResult[]=[];await solver.solve(changed,r=>hits.push(r),()=>false,tick);assert.equal(hits.length,1);assert(hits[0].cacheHit);
});
test('superseded searches cancel without saving or publishing a completion',async()=>{
 const solver=new LiveSolver(data),all:LiveResult[]=[];let cancelled=false;await solver.solve(input,r=>all.push(r),()=>cancelled,async()=>{cancelled=true;});assert(all.every(r=>r.phase!=='done'));assert.equal(solver.cache.size,0);
});
test('unreachable query is preserved, never silently replaced by a palette color',async()=>{
 const solver=new LiveSolver(data),impossible={...input,target:[1.5,0,0]},all:LiveResult[]=[];await solver.solve(impossible,r=>all.push(r),()=>false,tick);const last=all.at(-1)!;assert.deepEqual(last.target,impossible.target);assert.equal(last.shortest,null);assert.equal(last.landingRecipe,null);assert.equal(last.nodes.length,0);assert(last.closestError>data.tolerance);
});
test('live fraction steps match direct contribution endpoints',()=>{
 const q=step(input.start,{paint:1,share:.32});q.forEach((v,i)=>assert(Math.abs(v-(input.start[i]*.68+(i===1?.32:0)))<1e-12));
});
