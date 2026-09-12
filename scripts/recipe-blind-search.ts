// Offline cross-check. Intentionally imports no route proposer, atlas, refinement,
// recipe witness, style classifier, or target recipe.
import {PLAY_LEVELS,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,chargeAmount,type ColorPoint} from '../app/play-engine';
export const BLIND_POLICY={version:'blind-halton-pattern-1',samples:72,restarts:5,iterations:80,minimumStep:.00002,timeExponent:1};
export function halton(index:number,base:number){let f=1,value=0;while(index>0){f/=base;value+=f*(index%base);index=Math.floor(index/base);}return value;}
export function blindReplay(palette:number,order:number[],times:number[]){
 const q=PLAY_LEVELS[palette].paints.map((_,i)=>+(i===order[0]));
 times.forEach((t,i)=>{q[order[i+1]]+=chargeAmount(q.reduce((a,b)=>a+b,0),t);});return q;
}
export type BlindRoute={order:number[];times:number[];error:number};
export function blindSearch(palette:number,target:ColorPoint,maxPours=3,seed=1209261,policy=BLIND_POLICY){
 const paints=PLAY_LEVELS[palette].paints;let evaluations=0;
 const score=(order:number[],times:number[])=>{evaluations++;return colorDistance(mixtureColor(paints,blindReplay(palette,order,times)),target);};
 const routes:BlindRoute[]=[],best=paints.map(()=>Array(maxPours).fill(Infinity) as number[]);
 const walk=(order:number[],depth:number)=>{
  if(order.length===depth+1){
   const samples=Array.from({length:policy.samples},(_,i)=>Array.from({length:depth},(_,j)=>CHARGE_SECONDS*halton(seed+i+1,[2,3,5][j])**policy.timeExponent));
   samples.push(Array(depth).fill(0),Array(depth).fill(CHARGE_SECONDS),Array(depth).fill(CHARGE_SECONDS/2));
   const ranked=samples.map(times=>({times,error:score(order,times)})).sort((a,b)=>a.error-b.error);
   for(const start of ranked.slice(0,policy.restarts)){
    let times=[...start.times],error=start.error,step=.35;
    for(let iter=0;iter<policy.iterations&&step>=policy.minimumStep;iter++){
     let next=times,nextError=error;
     // Evaluate a full coordinate neighborhood before committing a step.
     for(let axis=0;axis<depth;axis++)for(const direction of [-1,1]){
      const t=[...times];t[axis]=Math.max(0,Math.min(CHARGE_SECONDS,t[axis]+step));
      const e=score(order,t);if(e<nextError){next=t;nextError=e;}
     }
     if(next===times)step*=.5;else {times=next;error=nextError;}
    }
    best[order[0]][depth-1]=Math.min(best[order[0]][depth-1],error);
    if(error<=LIVE_LANDING_TOLERANCE&&!routes.some(r=>r.order.join()===order.join()&&r.times.every((t,i)=>Math.abs(t-times[i])<1e-5)))routes.push({order:[...order],times,error});
   }
   return;
  }
  for(let paint=0;paint<paints.length;paint++)walk([...order,paint],depth);
 };
 for(let depth=1;depth<=maxPours;depth++)for(let base=0;base<paints.length;base++)walk([base],depth);
 return {policy,seed,evaluations,best,routes};
}

// Full rising-leg samples, not centered on a proposed finishing dose. This
// measures a global setup slice for a FIXED order, not a global recipe preimage.
export function setupSlice(palette:number,target:ColorPoint,order:number[],prefix:number[],setupSteps=48,finishSteps=384){
 const cells=[];
 for(let i=0;i<=setupSteps;i++){
  const setup=CHARGE_SECONDS*i/setupSteps,accepted:number[]=[];
  for(let j=0;j<=finishSteps;j++){
   const finish=CHARGE_SECONDS*j/finishSteps;
   if(colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,blindReplay(palette,order,[...prefix,setup,finish])),target)<=LIVE_LANDING_TOLERANCE)accepted.push(finish);
  }
  cells.push({setup,accepted});
 }
 return {setupSteps,finishSteps,finishResolutionMs:CHARGE_SECONDS/finishSteps*1000,cells};
}
