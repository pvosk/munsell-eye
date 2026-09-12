import {PLAY_LEVELS,mixtureColor,colorDistance,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE as T,type ColorPoint,type Mixture} from '../app/play-engine';
import {premixReplay,premixRoute,type MassMode} from '../app/play-premix';
import {halton} from './recipe-blind-search';
export type PremixControl={order:number[];times:number[];error:number};
// Recipe-blind challenger: receives only the fixed start, target and mechanics.
export function searchPremix(level:number,start:Mixture,target:ColorPoint,mode:MassMode,max=2,seed=680013,samples=128,restarts=8){
 const paints=PLAY_LEVELS[level].paints,routes:PremixControl[]=[];let evaluations=0;
 const score=(order:number[],times:number[])=>{evaluations++;return colorDistance(mixtureColor(paints,premixReplay(start,order,times,mode)),target);};
 const best:number[]=Array(max).fill(Infinity);
 function walk(order:number[],depth:number){
  if(order.length<depth){for(let i=0;i<paints.length;i++)walk([...order,i],depth);return;}
  const ranked=Array.from({length:samples},(_,i)=>Array.from({length:depth},(_,j)=>CHARGE_SECONDS*halton(seed+i+1,[2,3,5][j]))).concat([Array(depth).fill(0),Array(depth).fill(CHARGE_SECONDS)]).map(times=>({times,error:score(order,times)})).sort((a,b)=>a.error-b.error);
  for(const r of ranked.slice(0,restarts)){
   let times=r.times,error=r.error,step=.3;
   for(let k=0;k<160&&step>1e-5;k++){
    let improved=false;
    for(let axis=0;axis<depth;axis++)for(const sign of [-1,1]){const t=[...times];t[axis]=Math.max(0,Math.min(CHARGE_SECONDS,t[axis]+sign*step));const e=score(order,t);if(e<error){times=t;error=e;improved=true;}}
    if(!improved)step*=.5;
   }
   best[depth-1]=Math.min(best[depth-1],error);
   if(error<=T&&!routes.some(r=>r.order.join()===order.join()&&r.times.every((t,i)=>Math.abs(t-times[i])<1e-5)))routes.push({order:[...order],times,error});
  }
 }
 for(let depth=1;depth<=max;depth++)walk([],depth);
 return{seed,samples,restarts,evaluations,best,routes};
}
export function measurePremix(level:number,start:Mixture,target:ColorPoint,mode:MassMode,r:PremixControl){
 const paints=PLAY_LEVELS[level].paints,route=premixRoute(paints,start,r.order,r.times,mode),last=route.strokes.at(-1)!;
 const lengths=route.strokes.map(s=>s.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.position.map((v,j)=>v-s[i].position[j])),0));
 const changes=route.stops.slice(1).map((p,i)=>p.lab.map((v,j)=>v-route.stops[i].lab[j]));
 const delta=changes.at(-1)!,value=delta[0],ab=Math.hypot(delta[1],delta[2]),norm=Math.hypot(...delta);
 const setupValue=Math.max(0,...changes.slice(0,-1).map(d=>Math.abs(d[0])));
 const finishValueLed=Math.abs(value)>=.1&&Math.abs(value)/Math.max(norm,1e-9)>=.8&&Math.abs(value)>=.8*setupValue;
 const finish=lengths.at(-1)!,setup=lengths.slice(0,-1).reduce((a,b)=>a+b,0),meaningful=changes.filter(d=>Math.hypot(...d)>=T).length;
 // Full rising-leg finishing acceptance intervals, not only the chosen dose.
 const success=(times:number[])=>colorDistance(mixtureColor(paints,premixReplay(start,r.order,times,mode)),target)<=T;
 const step=CHARGE_SECONDS/512,mask=Array.from({length:513},(_,i)=>success([...r.times.slice(0,-1),i*step]));
 let run=0,width=0;for(const v of mask){run=v?run+1:0;width=Math.max(width,run);}const finishWindowMs=Math.max(0,width-1)*step*1000;
 // Local first-setup perturbations +/- 10% of the charge leg, all finishes.
 let accepted=0;const cells=25;
 for(let i=0;i<cells;i++){const times=[...r.times];times[0]=Math.max(0,Math.min(CHARGE_SECONDS,times[0]+(i/(cells-1)-.5)*CHARGE_SECONDS*.2));
  if(Array.from({length:129},(_,j)=>success([...times.slice(0,-1),j*CHARGE_SECONDS/128])).some(Boolean))accepted++;
 }
 const chromaticFraction=last.filter(p=>Math.hypot(p.lab[1],p.lab[2])>=.06).length/last.length;
 const opposing=changes.length>=2&&changes[0][1]*delta[1]+changes[0][2]*delta[2]<0;
 return{...r,lengths,finish,setup,meaningful,value,ab,finishValueLed,chromaticFraction,opposing,finishWindowMs,setupCoverage:accepted/cells,supported:finishWindowMs>=55&&accepted/cells>=.04,traits:{rise:finishValueLed&&value>0,drop:finishValueLed&&value<0,'long-finish':finish>=30&&setup>=6&&ab>=.04,'coupled-balance':Math.abs(value)>=.035&&ab>=.035&&opposing}};
}
