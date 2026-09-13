// Recipe-blind endpoint solver. No witness, target recipe, style, or charge curve.
import { mixtureColor,colorDistance,type Mixture,type ColorPoint } from '../app/play-engine';
import type { PaintColor } from '../app/paint-mixing';
import { contributionRecipe } from '../app/play-pigment-legs';
export type LegEndpoint={paints:number[];weights:number[];error:number;source:string};
export const LEG_SEARCH_VERSION='subset-simplex-1';
export function subsets(n:number,k:number):number[][]{const out:number[][]=[];const walk=(q:number[],from:number)=>{if(q.length===k){out.push(q);return;}for(let i=from;i<n;i++)walk([...q,i],i+1);};walk([],0);return out;}
export function permutations(a:number[]):number[][]{return a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[v,...t])):[[]];}
export function radicalInverse(index:number,base:number){let value=0,f=1;while(index>0){f/=base;value+=f*(index%base);index=Math.floor(index/base);}return value;}
const PRIMES=[2,3,5,7,11,13,17,19,23];
export function simplexSeeds(dim:number,count:number,seed:number){
 const samples=Array.from({length:count},(_,i)=>{const v=Array.from({length:dim},(_,j)=>-Math.log(Math.max(1e-12,radicalInverse(seed+i+1,PRIMES[j]))));const sum=v.reduce((a,b)=>a+b);return v.map(x=>x/sum);});
 samples.push(Array(dim).fill(1/dim));
 for(let i=0;i<dim;i++){const w=Array(dim).fill(0);w[i]=1;if(i!==0){w[0]=1e-9;w[i]-=1e-9;}samples.push(w);}
 return samples;
}
export function optimizeSimplex(score:(weights:number[])=>number,initial:number[],iterations=140){
 let weights=[...initial],error=score(weights),step=.2,evaluations=1;
 for(let iter=0;iter<iterations&&step>1e-7;iter++){
  let next=weights,nextError=error;
  for(let from=0;from<weights.length;from++)for(let to=0;to<weights.length;to++)if(from!==to){
   const move=Math.min(step,weights[from]-(from===0?1e-9:0));if(move<=0)continue;
   const q=[...weights];q[from]-=move;q[to]+=move;const e=score(q);evaluations++;
   if(e<nextError-1e-14){next=q;nextError=e;}
  }
  if(next===weights)step*=.5;else{weights=next;error=nextError;}
 }return{weights,error,evaluations};
}
export function searchLegEndpoints(paints:PaintColor[],start:Mixture,target:ColorPoint,maxLegs:number,seed:number,samples=96,restarts=6){
 if(maxLegs<0||maxLegs>Math.min(6,paints.length))throw Error('Unsupported leg depth');
 let evaluations=0;const best:LegEndpoint[]=[],endpoints:LegEndpoint[]=[];
 const zero=colorDistance(mixtureColor(paints,start),target);
 for(let depth=1;depth<=maxLegs;depth++){
  let winner:LegEndpoint|null=null;
  for(const indices of subsets(paints.length,depth)){
   const score=(weights:number[])=>{evaluations++;return colorDistance(mixtureColor(paints,contributionRecipe(start,indices,weights)),target);};
   const ranked=simplexSeeds(depth+1,samples,seed).map(weights=>({weights,error:score(weights)})).sort((a,b)=>a.error-b.error);
   const polished=ranked.slice(0,restarts).map(r=>optimizeSimplex(score,r.weights));
   const all=[...ranked.slice(0,restarts),...polished].sort((a,b)=>a.error-b.error);
   for(const r of all){const endpoint={paints:indices,weights:r.weights,error:r.error,source:LEG_SEARCH_VERSION};if(!endpoints.some(e=>e.paints.join()===indices.join()&&e.weights.every((v,i)=>Math.abs(v-r.weights[i])<1e-5)))endpoints.push(endpoint);}
   const r={paints:indices,...all[0],source:LEG_SEARCH_VERSION};if(!winner||r.error<winner.error)winner=r;
  }best.push(winner!);
 }return{version:LEG_SEARCH_VERSION,seed,samples,restarts,evaluations,zero,best,endpoints};
}
// Different coordinates and local algorithm for independent fresh checks:
// ordered fractional legs, full coordinate-neighborhood search, no simplex solver.
export function challengeLegOrders(paints:PaintColor[],start:Mixture,target:ColorPoint,maxLegs:number,seed:number,samples=128,restarts=8){
 let evaluations=0;const best=Array(maxLegs).fill(Infinity) as number[],routes:{order:number[];shares:number[];error:number}[]=[];
 const evaluate=(order:number[],shares:number[])=>{evaluations++;let q=[...start];order.forEach((p,i)=>{q=q.map((v,j)=>(1-shares[i])*v+(j===p?shares[i]:0));});return colorDistance(mixtureColor(paints,q),target);};
 for(let depth=1;depth<=maxLegs;depth++)for(const set of subsets(paints.length,depth))for(const order of permutations(set)){
  const starts=Array.from({length:samples},(_,i)=>order.map((_,j)=>Math.min(1-1e-9,radicalInverse(seed+i+1,PRIMES[j]))));starts.push(order.map(()=>0),order.map(()=>1-1e-9));
  const ranked=starts.map(shares=>({shares,error:evaluate(order,shares)})).sort((a,b)=>a.error-b.error);
  for(const r of ranked.slice(0,restarts)){
   let shares=r.shares,error=r.error,step=.2;
   for(let iter=0;iter<160&&step>1e-7;iter++){
    let next=shares,nextError=error;
    for(let axis=0;axis<depth;axis++)for(const sign of [-1,1]){const x=[...shares];x[axis]=Math.max(0,Math.min(1-1e-9,x[axis]+sign*step));const e=evaluate(order,x);if(e<nextError-1e-14){next=x;nextError=e;}}
    if(next===shares)step*=.5;else{shares=next;error=nextError;}
   }best[depth-1]=Math.min(best[depth-1],error);routes.push({order,shares,error});
  }
 }return{version:'ordered-fraction-pattern-1',seed,samples,restarts,evaluations,best,routes};
}
