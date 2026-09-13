import { normalizeRecipe, holdForShare, premixReplay } from '../app/play-premix';
import type { Mixture } from '../app/play-engine';

// Algebraic attack in recipe space, separate from the recipe-blind color solver.
// q = lambda*p + residual, lambda = min(q_i/p_i). For full-support p at
// least one residual is zero, leaving at most n-1 distinct paint additions.
// This is a construction, not a minimum proof. Legal per-shot dose limits can
// invalidate it; other recipes can also match the target's displayed color.
export function compositionPlans(start:Mixture,finish:Mixture){
 const p=normalizeRecipe(start),q=normalizeRecipe(finish);
 if(p.length!==q.length||p.some(x=>x<=0))throw Error('Composition shortcut requires a full-support start');
 const lambda=Math.min(...q.map((x,i)=>x/p[i]));
 const residual=q.map((x,i)=>Math.max(0,x-lambda*p[i]));
 const active=residual.map((v,i)=>v>1e-10?i:-1).filter(i=>i>=0);
 const permutations=(a:number[]):number[][]=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(t=>[v,...t])):[[]];
 const routes=permutations(active).map(order=>{
  let retained=lambda;const shares=order.map(i=>{retained+=residual[i];return residual[i]/retained;});
  const holds=shares.map(a=>holdForShare(1,a,'normalized'));
  const times=holds.every(t=>t!==null)?holds as number[]:null;
  const recipeError=times?Math.max(...premixReplay(p,order,times,'normalized').map((x,i)=>Math.abs(x-q[i]))):null;
  return{order,shares,times,recipeError};
 });
 return{lambda,residual,distinctAdditions:active.length,routes,legalRoutes:routes.filter(r=>r.times!==null)};
}
