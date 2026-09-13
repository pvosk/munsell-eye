import {test} from 'node:test';import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay} from '../app/play-pigment-legs';
import {acceptedRecipeCloud,inverseChain,branchEvidence} from './branching-regions';import {rng} from './premix-hybrid';
import {measureLegRegion} from './pigment-leg-metrics';
import type {auditLegPuzzle} from './pigment-leg-audit';
test('landing cloud is accepted and inverse chains exactly replay each endpoint',()=>{
 for(const palette of PLAY_LEVELS.slice(0,6)){
  const q=palette.paints.map(()=>1/palette.paints.length),cloud=acceptedRecipeCloud(palette.paints,q,rng(911));assert.equal(cloud.length,25);
  for(const endpoint of cloud){assert.ok(colorDistance(mixtureColor(palette.paints,endpoint),mixtureColor(palette.paints,q))<=T);
   const chain=inverseChain(endpoint,Math.min(3,q.length),rng(123));assert.ok(chain);const replay=legReplay(chain.start,chain.legs);
   replay.forEach((v,i)=>assert.ok(Math.abs(v-endpoint[i])<1e-10));assert.equal(new Set(chain.legs.map(x=>x.paint)).size,chain.legs.length);
  }
 }
});
test('long demonstrations cannot inflate shortest-route branch count; raw escape remains visible',()=>{
 const paints=PLAY_LEVELS[0].paints,start=paints.map(()=>1/paints.length),target=mixtureColor(paints,start);
 const short={...measureLegRegion(paints,start,target,[{paint:0,share:.2}]),supported:true,allMeaningful:true};
 const long={...short,legs:[{paint:1,share:.2},{paint:0,share:.2}]};
 const a={p:{paints,start},summary:{rawMinimum:0,robustMinimum:1,unmeasured:7},measured:[short,long]} as unknown as ReturnType<typeof auditLegPuzzle>;
 const b=branchEvidence(a);assert.deepEqual(b.firstPaints,[0]);assert.equal(b.pairs.length,0);assert.equal(b.shorterRawEscape,true);assert.equal(b.unmeasured,7);
});
