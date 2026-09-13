import test from 'node:test';import assert from 'node:assert/strict';
import {projectRecipe,verifyJoin,bidirectionalLegSearch,blindLandingRoots} from './bidirectional-leg-search';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {contributionRecipe,legReplay} from '../app/play-pigment-legs';
test('recipe projection covers interior, boundary and degenerate faces',()=>{
 const atoms=[[1,0,0],[0,1,0],[0,0,1]],q=[.2,.3,.5];assert(projectRecipe(q,atoms).residual<1e-12);
 assert.deepEqual(projectRecipe([-.2,.6,.6],atoms).recipe,[0,.5,.5]);
 assert(projectRecipe(q,[...atoms,atoms[0]]).residual<1e-12);
});
test('forward prefixes and backward suffixes rendezvous in recipe space',()=>{
 for(const order of [[0,1,2],[2,0,1],[1,2,0]])assert(verifyJoin([.1,.2,.3,.4],[0,1,2],[.25,.2,.3,.25],order)<1e-10);
});
test('actual-color replay validates exact and approximate proposals independently',()=>{
 const paints=PLAY_LEVELS.find(p=>p.name==='Zorny')!.paints,start=[.15,.2,.3,.35];
 const endpoint=contributionRecipe(start,[0,1,2],[.2,.3,.25,.25]),target=mixtureColor(paints,endpoint);
 const roots=blindLandingRoots(paints,target,918277,24);assert(roots.roots.length>0);
 for(const q of roots.roots)assert(colorDistance(mixtureColor(paints,q),target)<=T);
 const result=bidirectionalLegSearch(paints,start,target,[endpoint,...roots.roots]);assert(result.exact>0);
 for(const r of result.routes)assert(colorDistance(mixtureColor(paints,legReplay(start,r.legs)),target)<=T+1e-9);
});
test('accumulated mass changes dose cost, not the attainable abstract recipe arc',()=>{
 const start=[.15,.2,.3,.35],legs=[{paint:0,share:.42},{paint:2,share:.67},{paint:1,share:.28}];
 let mass=7,amounts=start.map(v=>v*mass);
 for(const l of legs){const dose=mass*l.share/(1-l.share);amounts[l.paint]+=dose;mass+=dose;}
 const expected=legReplay(start,legs);amounts.forEach((v,i)=>assert(Math.abs(v/mass-expected[i])<1e-12));
});
