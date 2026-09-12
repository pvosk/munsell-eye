import {mixtureColor,colorDistance,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE as T,type Mixture,type ColorPoint} from '../app/play-engine';
import {premixReplay,premixStep,normalizeRecipe} from '../app/play-premix';
import type {PaintColor} from '../app/paint-mixing';
import {halton} from './recipe-blind-search';
import type {PremixControl} from './premix-search';

export const HYBRID_VERSION='premix-hybrid-1';
export const POLICY={almostOne:1.5,shorterMargin:1.3,cleanupMove:1.5,finishMs:55,setupCoverage:.04};
export type Puzzle={id:string;palette:string;paints:PaintColor[];start:Mixture;targetRecipe:Mixture;control:PremixControl};
export const targetOf=(p:Puzzle)=>mixtureColor(p.paints,p.targetRecipe);
export const endpoint=(paints:PaintColor[],start:Mixture,order:number[],times:number[])=>mixtureColor(paints,premixReplay(start,order,times,'normalized'));
export const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
export function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};}
export function orders(n:number,depth:number):number[][]{let a:number[][]=[[]];for(let k=0;k<depth;k++)a=a.flatMap(q=>Array.from({length:n},(_,i)=>[...q,i]));return a;}

// Central finite differences through the EXACT forward model, not a trained
// surrogate. Projected ascent with backtracking accepts only real improvement.
export function gradient(f:(x:number[])=>number,x:number[],h=1e-4,bounds?:[number,number][]){return x.map((_,i)=>{const a=[...x],b=[...x];a[i]+=h;b[i]-=h;if(bounds){a[i]=clamp(a[i],...bounds[i]);b[i]=clamp(b[i],...bounds[i]);}return a[i]===b[i]?0:(f(a)-f(b))/(a[i]-b[i]);});}
export function ascend(f:(x:number[])=>number,initial:number[],bounds:[number,number][],iterations=16){
 let x=initial.map((v,i)=>clamp(v,...bounds[i])),score=f(x),accepted=0;
 for(let k=0;k<iterations;k++){
  const g=gradient(f,x,1e-4,bounds),norm=Math.hypot(...g);if(!Number.isFinite(norm)||norm<1e-9)break;
  let improved=false;
  for(let step=.25;step>=.0001;step*=.5){const y=x.map((v,i)=>clamp(v+step*g[i]/norm,...bounds[i])),s=f(y);if(Number.isFinite(s)&&s>score+1e-10){x=y;score=s;accepted++;improved=true;break;}}
  if(!improved)break;
 }
 return{x,score,accepted};
}

// All discrete orders, Halton seeds, gradient dose refinement. The independent
// final challenger deliberately uses the older derivative-free implementation.
export function gradientChallenger(p:Puzzle,max=2,samples=24,seed=27191,iterations=18){
 const target=targetOf(p),routes:PremixControl[]=[];let evaluations=0;
 for(let depth=1;depth<=max;depth++)for(const order of orders(p.paints.length,depth)){
  const score=(times:number[])=>{evaluations++;return-colorDistance(endpoint(p.paints,p.start,order,times),target);};
  const starts=Array.from({length:samples},(_,i)=>order.map((_,j)=>CHARGE_SECONDS*halton(seed+i+1,[2,3,5,7][j]))).concat([order.map(()=>0),order.map(()=>CHARGE_SECONDS)]);
  const ranked=starts.map(x=>({x,score:score(x)})).sort((a,b)=>b.score-a.score);
  const polished=ranked.slice(0,2).map(r=>ascend(score,r.x,order.map(()=>[0,CHARGE_SECONDS]),iterations));
  const best=[...ranked,...polished].sort((a,b)=>b.score-a.score)[0];routes.push({order,times:best.x,error:-best.score});
 }
 return{routes,evaluations,best:Array.from({length:max},(_,i)=>Math.min(...routes.filter(r=>r.order.length===i+1).map(r=>r.error)))};
}

// Reusable per-start curve samples make broad destination screening cheap.
export function oneShotField(paints:PaintColor[],start:Mixture,steps=64){return paints.flatMap((_,paint)=>Array.from({length:steps+1},(_,i)=>({paint,time:CHARGE_SECONDS*i/steps,point:endpoint(paints,start,[paint],[CHARGE_SECONDS*i/steps])})));}
export function closestOne(field:ReturnType<typeof oneShotField>,target:ColorPoint){let best=Infinity;for(const s of field)best=Math.min(best,colorDistance(s.point,target));return best;}

function logits(q:Mixture){const base=Math.log(Math.max(1e-8,q.at(-1)!));return q.slice(0,-1).map(x=>Math.log(Math.max(1e-8,x))-base);}
function simplex(z:number[]){const x=[...z,0],m=Math.max(...x);return normalizeRecipe(x.map(v=>Math.exp(v-m)));}
export function encode(p:Puzzle){return[...logits(p.start),...logits(p.targetRecipe),...p.control.times];}
export function decode(p:Puzzle,x:number[]):Puzzle{const n=p.paints.length-1;return{...p,start:simplex(x.slice(0,n)),targetRecipe:simplex(x.slice(n,2*n)),control:{...p.control,times:x.slice(2*n)}};}

export function designScore(p:Puzzle,rivals:PremixControl[]){
 const target=targetOf(p),error=colorDistance(endpoint(p.paints,p.start,p.control.order,p.control.times),target)/T;
 const byDepth=(d:number)=>Math.min(...rivals.filter(r=>r.order.length===d).map(r=>colorDistance(endpoint(p.paints,p.start,r.order,r.times),target)/T));
 const one=byDepth(1),two=p.control.order.length>=3?byDepth(2):one;
 let q=p.start;const moves:number[]=[];for(let i=0;i<p.control.order.length;i++){const next=premixStep(q,p.control.order[i],p.control.times[i],'normalized').after;moves.push(colorDistance(mixtureColor(p.paints,q),mixtureColor(p.paints,next))/T);q=next;}
 // Prioritize resistance over travel, without rewarding arbitrarily far targets
 // or infinitesimal winning windows. These are search objectives, not labels.
 return Math.min(one,6)+1.6*Math.min(two,4)+.15*Math.min(12,colorDistance(mixtureColor(p.paints,p.start),target)/T)
  -35*Math.max(0,error-.65)**2-2*moves.reduce((sum,x)=>sum+Math.max(0,1.5-x)**2,0);
}

export function refinePuzzle(initial:Puzzle,seed:number,rounds=8){
 let p=initial,c=gradientChallenger(p,Math.min(2,p.control.order.length-1),20,seed),score=designScore(p,c.routes);
 const before={score,bestT:c.best.map(e=>e/T),start:p.start,targetRecipe:p.targetRecipe},history:any[]=[];
 let evaluations=c.evaluations;
 for(let round=0;round<rounds;round++){
  const n=p.paints.length-1,x=encode(p),bounds:[number,number][]=x.map((_,i)=>i<2*n?[-8,8]:[.08,1.6]);
  const proposal=ascend(z=>designScore(decode(p,z),c.routes),x,bounds,3),trial=decode(p,proposal.x);
  // Re-solve rivals after every proposed move. A stale shortcut gradient is not
  // accepted as improvement of the puzzle itself.
  const next=gradientChallenger(trial,Math.min(2,p.control.order.length-1),24,seed+round*137+1),nextScore=designScore(trial,next.routes);evaluations+=next.evaluations;
  const accepted=nextScore>score+1e-6&&colorDistance(endpoint(trial.paints,trial.start,trial.control.order,trial.control.times),targetOf(trial))<=T;
  history.push({round,score:nextScore,accepted,bestT:next.best.map(e=>e/T),gradientSteps:proposal.accepted});
  if(accepted){p=trial;c=next;score=nextScore;}else{
   // Keep newly discovered attacks even if the designer move was rejected.
   c={...c,routes:[...c.routes,...next.routes]};score=designScore(p,c.routes);
  }
 }
 p={...p,control:{...p.control,error:colorDistance(endpoint(p.paints,p.start,p.control.order,p.control.times),targetOf(p))}};
 return{p,before,after:{score,bestT:c.best.map(e=>e/T)},history,evaluations};
}

// An explicit cleanup attack: search any first pour plus a correction whose
// COLOR displacement is constrained, not whose pigment mass happens to be small.
export function cleanupAttack(p:Puzzle,seed=39173,samples=80,iterations=20,target:ColorPoint=targetOf(p)){
 const results:PremixControl[]=[];let evaluations=0;
 const correction=(order:number[],times:number[])=>{const middle=premixStep(p.start,order[0],times[0],'normalized').after;return colorDistance(mixtureColor(p.paints,middle),endpoint(p.paints,p.start,order,times))/T;};
 for(const order of orders(p.paints.length,2)){
  const objective=(times:number[])=>{evaluations++;const error=colorDistance(endpoint(p.paints,p.start,order,times),target)/T,move=correction(order,times);return-error-8*Math.max(0,move-POLICY.cleanupMove)**2;};
  const starts=Array.from({length:samples},(_,i)=>[CHARGE_SECONDS*halton(seed+i,2),.65*halton(seed+i,3)]);
  const ranked=starts.map(x=>({x,score:objective(x)})).sort((a,b)=>b.score-a.score);
  const polished=ranked.slice(0,3).map(r=>ascend(objective,r.x,[[0,CHARGE_SECONDS],[0,CHARGE_SECONDS]],iterations));
  for(const r of [...ranked.slice(0,3),...polished])if(correction(order,r.x)<=POLICY.cleanupMove+1e-5)results.push({order,times:r.x,error:colorDistance(endpoint(p.paints,p.start,order,r.x),target)});
 }
 results.sort((a,b)=>a.error-b.error);return{best:results[0]??null,routes:results.filter(r=>r.error<=T),evaluations};
}

export function structuralVerdict(depth:number,best:number[],cleanup:PremixControl|null){
 const reasons:string[]=[];
 if(best[0]/T<POLICY.almostOne)reasons.push('one-shot-or-near-one-shot');
 if(best[depth-2]/T<POLICY.shorterMargin)reasons.push('insufficient-shorter-route-margin');
 if(cleanup&&cleanup.error<=T)reasons.push('one-move-plus-small-cleanup');
 return{pass:reasons.length===0,reasons};
}
