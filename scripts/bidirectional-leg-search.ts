// Research-only recipe-space rendezvous. No game policy/physics mutations.
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type ColorPoint} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {canonicalLegs,contributionLegs,contributionRecipe,legReplay,type PigmentLeg} from '../app/play-pigment-legs';
import {subsets,permutations,simplexSeeds,optimizeSimplex} from './pigment-leg-search';
import {rng} from './premix-hybrid';
import {sampleRecipe} from './pigment-leg-proposals';

function solve(a:number[][],b:number[]):number[]|null {
 const m=a.map((row,i)=>[...row,b[i]]),n=b.length;
 for(let i=0;i<n;i++){
  let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[pivot][i]))pivot=j;
  if(Math.abs(m[pivot][i])<1e-12)return null;
  [m[i],m[pivot]]=[m[pivot],m[i]];const d=m[i][i];for(let k=i;k<=n;k++)m[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}
 }return m.map(row=>row[n]);
}
// Exhaust every face of the SMALL recipe simplex (<=4 atoms in this test).
// The quadratic projection is exact to floating-point precision; the nonlinear
// color acceptance and coverage of target recipes are NOT thereby certified.
export function projectRecipe(point:number[],atoms:number[][]){
 let best={weights:[] as number[],recipe:[] as number[],residual:Infinity};
 for(let size=1;size<=atoms.length;size++)for(const active of subsets(atoms.length,size)){
  const anchor=atoms[active[0]],d=active.slice(1).map(i=>atoms[i].map((v,j)=>v-anchor[j]));
  const rhs=point.map((v,j)=>v-anchor[j]),dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
  const x=size===1?[]:solve(d.map(a=>d.map(b=>dot(a,b))),d.map(a=>dot(a,rhs)));if(!x)continue;
  const w=[1-x.reduce((s,v)=>s+v,0),...x];if(w.some(v=>v < -1e-9))continue;
  const weights=Array(atoms.length).fill(0) as number[];active.forEach((i,k)=>weights[i]=Math.max(0,w[k]));
  const total=weights.reduce((s,v)=>s+v);weights.forEach((v,i)=>weights[i]=v/total);
  const recipe=point.map((_,j)=>weights.reduce((s,v,i)=>s+v*atoms[i][j],0));
  const residual=Math.hypot(...recipe.map((v,i)=>v-point[i]));if(residual<best.residual)best={weights,recipe,residual};
 }return best;
}

// Recover several accepted root recipes WITHOUT reading the intended recipe,
// start, style, or demonstration. Rays are measured against the ORIGINAL target.
export function blindLandingRoots(paints:PaintColor[],target:ColorPoint,seed:number,count=64){
 let evaluations=0;const error=(q:number[])=>{evaluations++;return colorDistance(mixtureColor(paints,q),target);};
 const ranked=simplexSeeds(paints.length,128,seed).map(recipe=>({recipe,error:error(recipe)})).sort((a,b)=>a.error-b.error);
 const centers=ranked.slice(0,8).map(r=>optimizeSimplex(error,r.recipe)).filter(r=>r.error<=T*.8).map(r=>r.weights);
 const roots:number[][]=[];for(const q of centers)if(!roots.some(r=>Math.hypot(...r.map((v,i)=>v-q[i]))<1e-5))roots.push(q);
 const random=rng(seed);let attempts=0;
 while(roots.length<count&&centers.length&&attempts++<count*3){
  const center=centers[attempts%centers.length],other=sampleRecipe(paints.length,random);let lo=0,hi=1;
  const at=(t:number)=>center.map((v,i)=>v*(1-t)+other[i]*t);
  for(let i=1;i<=32;i++){const t=i/32;if(error(at(t))>T){hi=t;break;}lo=t;}
  for(let i=0;i<18&&hi>lo;i++){const mid=(lo+hi)/2;if(error(at(mid))<=T)lo=mid;else hi=mid;}
  const q=at(lo*(.15+.80*random()));if(error(q)<=T)roots.push(q);
 }return{roots,evaluations,centerCount:centers.length};
}

export type JoinedRoute={legs:PigmentLeg[];error:number;recipeResidual:number;exactRootJoin:boolean;root:number};
export function bidirectionalLegSearch(paints:PaintColor[],start:number[],target:ColorPoint,roots:number[][],depth=3){
 const routes:JoinedRoute[]=[];let evaluations=0,projections=0,exact=0,approximate=0;
 for(const indices of subsets(paints.length,depth)){
  const atoms=[start,...indices.map(p=>start.map((_,i)=>i===p?1:0))];
  for(const [root,q] of roots.entries()){
   projections++;const p=projectRecipe(q,atoms);
   if(p.weights[0]<1e-8)continue; // Do not claim the unattainable pure limit.
   const error=colorDistance(mixtureColor(paints,p.recipe),target);evaluations++;if(error>T)continue;
   if(p.residual<1e-7)exact++;else approximate++;
   for(const order of permutations(indices)){
    const legs=canonicalLegs(contributionLegs(indices,p.weights,order));
    if(legs.some(l=>l.share>=1)||routes.some(r=>r.legs.length===legs.length&&r.legs.every((l,i)=>l.paint===legs[i].paint&&Math.abs(l.share-legs[i].share)<1e-4)))continue;
    // Forward prefix vs backward suffix meet in RECIPE coordinates. Approximate
    // root proposals are accepted only after the whole physical replay passes.
    routes.push({legs,error,recipeResidual:p.residual,exactRootJoin:p.residual<1e-7,root});
   }
  }
 }
 return{routes,evaluations,projections,exact,approximate};
}

export function forwardEndpointRoutes(start:number[],endpoints:{paints:number[];weights:number[];error:number}[]){
 const routes:{legs:PigmentLeg[];error:number}[]=[];
 for(const e of endpoints)if(e.error<=T&&e.weights[0]>=1e-8)for(const order of permutations(e.paints)){
  const legs=canonicalLegs(contributionLegs(e.paints,e.weights,order));
  if(!routes.some(r=>r.legs.length===legs.length&&r.legs.every((l,i)=>l.paint===legs[i].paint&&Math.abs(l.share-legs[i].share)<1e-4)))routes.push({legs,error:e.error});
 }
 return routes;
}

export function verifyJoin(start:number[],indices:number[],weights:number[],order:number[]){
 const legs=contributionLegs(indices,weights,order),split=Math.max(1,legs.length-1),forward=legReplay(start,legs.slice(0,split));
 let backward=contributionRecipe(start,indices,weights);
 for(const l of legs.slice(split).reverse())backward=backward.map((v,i)=>(v-(i===l.paint?l.share:0))/(1-l.share));
 return Math.hypot(...forward.map((v,i)=>v-backward[i]));
}
