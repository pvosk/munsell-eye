import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay,recipeContributions,contributionLegs} from '../app/play-pigment-legs';
import {proposePaletteFirst,proposeRouteFirst,proposalScreen,refineLegProposal,type Proposal} from './pigment-leg-proposals';
import {LEG_STYLES} from './pigment-leg-metrics';
import {rng} from './premix-hybrid';
const paints=PLAY_LEVELS[1].paints;
test('both proposers replay continuous recipes without changing physical paints',()=>{
 const snapshot=JSON.stringify(paints);
 for(let seed=1;seed<=30;seed++)for(const style of LEG_STYLES){
  for(const p of [proposePaletteFirst(paints,3,rng(seed)),proposeRouteFirst(paints,3,style,rng(seed))]){
   const q=legReplay(p.start,p.legs);
   assert(q.every((x,i)=>Math.abs(x-p.targetRecipe[i])<1e-10));
   assert(p.start.every(x=>x>=0));assert.equal(new Set(p.legs.map(l=>l.paint)).size,3);
  }
 }
 assert.equal(JSON.stringify(paints),snapshot);
});
test('start-only and target-only refinement preserve the locked recipe',()=>{
 const p=proposePaletteFirst(paints,3,rng(171));
 const base={id:'test',paints,start:p.start,targetRecipe:p.targetRecipe,target:mixtureColor(paints,p.targetRecipe),demonstration:p.legs,method:'palette-first' as const,intent:null,paletteName:'test',depth:3,sourceSeed:171};
 const initial:Proposal={...base,...proposalScreen(base)};
 for(const mode of ['start-only','target-only','joint'] as const){
  const r=refineLegProposal(initial,mode,1929,2).p;
  if(mode==='start-only')assert.deepEqual(r.targetRecipe,initial.targetRecipe);
  if(mode==='target-only')assert.deepEqual(r.start,initial.start);
  assert.deepEqual(r.demonstration.map(l=>l.paint),initial.demonstration.map(l=>l.paint));
  assert(colorDistance(mixtureColor(paints,legReplay(r.start,r.demonstration)),r.target)<=T);
 }
});
test('a five-component exact recipe can construct four pigment legs',()=>{
 const start=[.2,.2,.2,.2,.2],target=[.1,.15,.2,.25,.3];
 const c=recipeContributions(start,target),legs=contributionLegs(c.paints,c.weights);
 assert.equal(legs.length,4);assert(legReplay(start,legs).every((v,i)=>Math.abs(v-target[i])<1e-12));
 // This is an exact composition construction, NOT a four-leg color minimum.
});
