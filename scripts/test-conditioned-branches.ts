import {test} from 'node:test';import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {PAINTS} from '../app/paint-mixing';
import {destinationRecipe,targetCloud,destinationViolation,type DestinationSpec} from './conditioned-branches';
import {inverseChain} from './branching-regions';import {legReplay} from '../app/play-pigment-legs';import {rng} from './premix-hybrid';
test('fixed targets do not silently become nearest reachable substitutes',()=>{
 const paints=PLAY_LEVELS[2].paints,q=paints.map(()=>1/paints.length),target=mixtureColor(paints,q),spec:DestinationSpec={id:'fixed',rgb:target.rgb,value:[0,1],chroma:[0,.5],style:'rise'};
 const d=destinationRecipe(paints,spec,917);assert.deepEqual(d.target.rgb,spec.rgb);assert(d.eligible);
 for(const endpoint of targetCloud(paints,d.target,d.recipe,rng(131))){assert(colorDistance(mixtureColor(paints,endpoint),d.target)<=T);const chain=inverseChain(endpoint,paints.length-1,rng(81))!;const replay=legReplay(chain.start,chain.legs);replay.forEach((v,i)=>assert(Math.abs(v-endpoint[i])<1e-9));}
});
test('range constraints are explicit and unavailable requests remain unavailable',()=>{
 const spec:DestinationSpec={id:'impossible',value:[1.5,1.6],chroma:[0,.1],style:'rise'},d=destinationRecipe(PLAY_LEVELS[1].paints,spec,183);
 assert(!d.eligible);assert(destinationViolation(d.target,spec)>0);
});
test('five-paint n−1 chains replay recipes without claiming a four-leg minimum',()=>{
 const paints=PAINTS.slice(0,5),q=[.11,.17,.23,.29,.20];
 for(let seed=0;seed<20;seed++){
  const chain=inverseChain(q,4,rng(seed+711))!;assert(chain);assert.equal(chain.legs.length,4);
  assert.equal(new Set(chain.legs.map(l=>l.paint)).size,4);
  const replay=legReplay(chain.start,chain.legs);replay.forEach((v,i)=>assert(Math.abs(v-q[i])<1e-9));
  assert(colorDistance(mixtureColor(paints,replay),mixtureColor(paints,q))<1e-8);
 }
});
