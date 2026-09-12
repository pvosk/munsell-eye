// Offline proposal-only inverse planner. No live engine or classifier changes.
import {PLAY_LEVELS, LIVE_LANDING_TOLERANCE, mixtureColor, colorDistance, totalMass, type ColorPoint} from './play-engine';
import {replayRoute} from './play-course-analysis';
import {secondsForAmount} from './play-route-design';

export const INVERSE_POLICY = Object.freeze({version:'inverse-predecessors-1', endpointRays:12,
  raySteps:12, boundarySteps:12, endpointSafety:.9, peelFractions:[1,.75,.4], maxPours:3});
export type PlannedRoute={order:number[];times:number[];recipe:number[];error:number;
  endpointRecipe:number[];predecessor:number[]|null;finishShare:number|null};
export function normalizeRecipe(q:readonly number[]){
  if(!q.length||q.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(totalMass([...q]))||totalMass([...q])<=0)throw Error('Invalid recipe');
  const mass=totalMass([...q]);return q.map(x=>x/mass);
}
export function predecessorForFinish(q:readonly number[],paint:number,share:number):number[]|null{
  const p=normalizeRecipe(q);
  if(!Number.isInteger(paint)||paint<0||paint>=p.length||!Number.isFinite(share)||share<=0||share>=1||share>p[paint]+1e-12)return null;
  // Re-normalization can shift a component by an ulp. A full peel must not
  // invent a fourth active ingredient or reject a valid boundary predecessor.
  return normalizeRecipe(p.map((x,i)=>i===paint?(Math.abs(x-share)<=1e-12?0:x-share):x));
}
export function recipePrefixes(q:readonly number[],maxPours=2):{order:number[];times:number[]}[]{
  const p=normalizeRecipe(q),active=p.flatMap((x,i)=>x>0?[i]:[]),out:{order:number[];times:number[]}[]=[];
  if(active.length>maxPours+1)return out;
  const visit=(order:number[])=>{
    if(order.length<active.length){for(const i of active)if(!order.includes(i))visit([...order,i]);return;}
    let mass=1;const times:number[]=[];
    for(const i of order.slice(1)){const amount=p[i]/p[order[0]],seconds=secondsForAmount(mass,amount);if(seconds===null)return;times.push(seconds);mass+=amount;}
    out.push({order,times});
  };visit([]);return out;
}
const randomFor=(seed:number)=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};

// Explore the first connected acceptance segment along recipe-space rays.
// This is NOT a global preimage solver: disconnected matching recipes can be missed.
export function acceptedEndpointRecipes(palette:number,q:readonly number[],seed:number,tolerance=LIVE_LANDING_TOLERANCE,rays=INVERSE_POLICY.endpointRays){
  const paints=PLAY_LEVELS[palette].paints,p=normalizeRecipe(q),target=mixtureColor(paints,p),random=randomFor(seed);
  if(p.length!==paints.length||!Number.isFinite(tolerance)||tolerance<=0)throw Error('Invalid inverse target');
  const endpoints=[p],directions:number[][]=[];
  for(let i=0;i<p.length;i++){const omit=p.map((x,j)=>j===i?0:x);if(totalMass(omit)>0)directions.push(normalizeRecipe(omit));}
  for(let i=0;i<rays;i++)directions.push(normalizeRecipe(p.map(()=>Math.exp((random()-.5)*6))));
  const at=(to:number[],t:number)=>p.map((x,i)=>x+(to[i]-x)*t);
  const valid=(recipe:number[])=>colorDistance(mixtureColor(paints,recipe),target)<=tolerance*INVERSE_POLICY.endpointSafety;
  for(const to of directions){
    let lo=0,hi=1,exited=false;
    for(let i=1;i<=INVERSE_POLICY.raySteps;i++){const t=i/INVERSE_POLICY.raySteps;if(!valid(at(to,t))){hi=t;exited=true;break;}lo=t;}
    if(exited)for(let i=0;i<INVERSE_POLICY.boundarySteps;i++){const mid=(lo+hi)/2;if(valid(at(to,mid)))lo=mid;else hi=mid;}
    for(const fraction of [.45,.95,1]){const candidate=at(to,lo*fraction);if(valid(candidate)&&!endpoints.some(q=>q.every((x,i)=>Math.abs(x-candidate[i])<1e-8)))endpoints.push(candidate);}
  }
  return {target,endpoints};
}
export function exactRecipeRoutes(palette:number,q:readonly number[],target:ColorPoint,tolerance=LIVE_LANDING_TOLERANCE):PlannedRoute[]{
  const endpointRecipe=normalizeRecipe(q);
  return recipePrefixes(endpointRecipe,INVERSE_POLICY.maxPours).map(r=>{
    const recipe=replayRoute(palette,r.order,r.times);return {...r,recipe,endpointRecipe,predecessor:null,finishShare:null,error:colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,recipe),target)};
  }).filter(r=>r.error<=tolerance);
}
export function inverseRoutes(palette:number,q:readonly number[],seed:number,tolerance=LIVE_LANDING_TOLERANCE){
  const {target,endpoints}=acceptedEndpointRecipes(palette,q,seed,tolerance),unique=new Map<string,PlannedRoute>();
  let attempted=0,illegalDose=0;
  for(const endpointRecipe of endpoints)for(let paint=0;paint<endpointRecipe.length;paint++)for(const fraction of INVERSE_POLICY.peelFractions){
    const finishShare=endpointRecipe[paint]*fraction,predecessor=predecessorForFinish(endpointRecipe,paint,finishShare);if(!predecessor)continue;
    for(const prefix of recipePrefixes(predecessor,INVERSE_POLICY.maxPours-1)){
      attempted++;const before=replayRoute(palette,prefix.order,prefix.times),mass=totalMass(before);
      const time=secondsForAmount(mass,mass*finishShare/(1-finishShare));if(time===null){illegalDose++;continue;}
      const order=[...prefix.order,paint],times=[...prefix.times,time],recipe=replayRoute(palette,order,times);
      const error=colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,recipe),target);if(error>tolerance)continue;
      const key=order.join()+':'+times.map(t=>t.toFixed(8)).join();
      unique.set(key,{order,times,recipe,error,endpointRecipe,predecessor,finishShare});
    }
  }
  return {target,endpoints:endpoints.length,attempted,illegalDose,routes:[...unique.values()]};
}
