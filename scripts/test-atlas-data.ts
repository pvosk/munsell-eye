import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,colorPoint,colorDistance,mixtureColor} from '../app/play-engine';
import {legStep} from '../app/play-pigment-legs';
import {expandSetupRegions,atlasShareWindow,destinationQueryKey} from './setup-region-atlas';
import type {AtlasCase} from '../app/chroma-atlas/types';import type {PaintColor} from '../app/paint-mixing';
test('query expansion is deterministic, replayable and tolerance aware',()=>{
 const paints=PLAY_LEVELS[2].paints,q=paints.map(()=>1/paints.length),target=mixtureColor(paints,q),options={seed:31,depth:2,cap:25,tolerance:.025};
 const a=expandSetupRegions(paints,target,q,options),b=expandSetupRegions(paints,target,q,options);assert.deepEqual(a.nodes,b.nodes);assert(a.stats.maxReplayError<1e-9);assert(a.nodes.some(n=>n.stage===2));
 assert.notEqual(destinationQueryKey('a',target.rgb,.025,2,q),destinationQueryKey('a',target.rgb,.025,2,q.map((v,i)=>v+(i===0?.001:i===1?-.001:0))));
 const node=a.nodes.find(n=>n.stage===2)!;const interval=atlasShareWindow(paints,a.nodes,node.id,target,.025);assert(interval[0]<=node.share&&interval[1]>=node.share);
});
test('published atlas bank keeps every retained recipe chain and known route valid',()=>{
 const index=JSON.parse(readFileSync('public/atlas/index.json','utf8'));assert(index.cases.length>=8);const shared:number[][]=[];
 for(const c of index.cases){const data=JSON.parse(readFileSync('public'+c.url,'utf8')) as AtlasCase,paints=data.paints as PaintColor[],target=colorPoint(data.target.rgb as [number,number,number]);
  if(c.request==='fixed-hansa')shared.push(data.target.rgb);
  for(const node of data.nodes){assert.equal(data.nodes[node.id],node);assert(node.recipe.every(x=>Number.isFinite(x)&&x>=0));assert(Math.abs(node.recipe.reduce((a,b)=>a+b)-1)<1e-8);let q=node.recipe,at=node;
   while(at.parent!==null){assert(at.parent<at.id);q=legStep(q,{paint:at.paint!,share:at.share});at=data.nodes[at.parent];assert(q.every((v,i)=>Math.abs(v-at.recipe[i])<1e-8));}
   assert(colorDistance(mixtureColor(paints,q),target)<=data.tolerance+1e-8);
   if(node.parent!==null){assert(node.arc?.length===9);assert(node.shareWindow);assert(node.shareWindow[0]<=node.share+1e-8&&node.shareWindow[1]>=node.share-1e-8);}
  }
  assert(data.knownRoutes.length>0);
 }
 assert(shared.length>=2);shared.forEach(rgb=>assert.deepEqual(rgb,shared[0]));
});
