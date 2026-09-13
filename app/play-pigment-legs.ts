// Composition geometry shared by offline planners and future live adapters.
// No scoring policy, timing threshold, style label or pigment mutation here.
import { normalizeRecipe, premixStep, holdForShare } from './play-premix';
import { chargeAmount, CHARGE_SECONDS, type Mixture } from './play-engine';

export type PigmentLeg={paint:number;share:number};
export const LEG_SHARE_MAX=1-1e-9; // finite approximation to the pure-paint limit
export function legStep(recipe:Mixture,leg:PigmentLeg):Mixture {
 if(!Number.isInteger(leg.paint)||leg.paint<0||leg.paint>=recipe.length||!Number.isFinite(leg.share)||leg.share<0||leg.share>1)throw Error('Invalid pigment leg');
 const p=normalizeRecipe(recipe);return p.map((v,i)=>(1-leg.share)*v+(i===leg.paint?leg.share:0));
}
export function canonicalLegs(legs:PigmentLeg[]):PigmentLeg[]{
 const out:PigmentLeg[]=[];
 for(const leg of legs){
  if(!Number.isFinite(leg.share)||leg.share<0||leg.share>1||!Number.isInteger(leg.paint)||leg.paint<0)throw Error('Invalid pigment leg');
  if(leg.share===0)continue;
  const previous=out.at(-1);
  if(previous?.paint===leg.paint)previous.share=1-(1-previous.share)*(1-leg.share);
  else out.push({...leg});
 }return out;
}
export const legReplay=(start:Mixture,legs:PigmentLeg[])=>legs.reduce(legStep,normalizeRecipe(start));
export function releasesToLegs(start:Mixture,order:number[],times:number[]){
 if(order.length!==times.length)throw Error('One duration per release required');
 let q=normalizeRecipe(start);const legs:PigmentLeg[]=[];
 order.forEach((paint,i)=>{const step=premixStep(q,paint,times[i],'normalized');legs.push({paint,share:step.amount/(1+step.amount)});q=step.after;});
 return canonicalLegs(legs);
}
// A route-end recipe consists of retained start plus pure-pigment contributions.
// Reordering those contributions changes the trajectory, not the endpoint.
export function contributionRecipe(start:Mixture,paints:number[],weights:number[]):Mixture {
 if(weights.length!==paints.length+1)throw Error('Retained-start weight required');
 const p=normalizeRecipe(start),w=normalizeRecipe(weights),q=p.map(v=>v*w[0]);
 paints.forEach((paint,i)=>{if(!Number.isInteger(paint)||paint<0||paint>=q.length)throw Error('Invalid paint');q[paint]+=w[i+1];});return q;
}
export function contributionLegs(paints:number[],weights:number[],order=paints):PigmentLeg[]{
 const w=normalizeRecipe(weights);if(w.length!==paints.length+1||new Set(paints).size!==paints.length)throw Error('Invalid contributions');
 if(order.length!==paints.length||new Set(order).size!==order.length||order.some(i=>!paints.includes(i)))throw Error('Order must permute contributions');
 let mass=w[0];const legs:PigmentLeg[]=[];
 for(const paint of order){const d=w[paints.indexOf(paint)+1];if(d===0)continue;mass+=d;legs.push({paint,share:d/mass});}return legs;
}
export function recipeContributions(start:Mixture,target:Mixture){
 const p=normalizeRecipe(start),q=normalizeRecipe(target);if(p.length!==q.length)throw Error('Recipe dimensions differ');
 const ratios=q.flatMap((v,i)=>p[i]>0?[v/p[i]]:[]),retained=Math.min(1,...ratios);
 const paints:number[]=[],weights=[retained];q.forEach((v,i)=>{const d=v-retained*p[i];if(d>1e-12){paints.push(i);weights.push(d);}});
 return{paints,weights,recipe:contributionRecipe(p,paints,weights)};
}
export function routeContributions(start:Mixture,legs:PigmentLeg[]){
 let retained=1;const added=Array(start.length).fill(0) as number[];
 for(const leg of legs){retained*=1-leg.share;for(let i=0;i<added.length;i++)added[i]*=1-leg.share;added[leg.paint]+=leg.share;}
 const paints=added.flatMap((v,i)=>v>0?[i]:[]);return{paints,weights:[retained,...paints.map(i=>added[i])]};
}
// Current-control adapter. Repeated releases never increase the abstract leg count.
// Changing controls only requires regenerating this execution view.
export function legExecution(leg:PigmentLeg[]){
 const max=chargeAmount(1,CHARGE_SECONDS),maxShare=max/(1+max);
 return canonicalLegs(leg).map(l=>{
  if(l.share>=1)return{...l,releases:null,times:null,reason:'pure-limit-not-finite'};
  const count=Math.max(1,Math.ceil(Math.log1p(-l.share)/Math.log1p(-maxShare)-1e-12));
  const perShare=-Math.expm1(Math.log1p(-l.share)/count),hold=holdForShare(1,perShare,'normalized');
  return{...l,releases:hold===null?null:count,times:hold===null?null:Array(count).fill(hold),reason:hold===null?'below-current-minimum-dose':null};
 });
}
