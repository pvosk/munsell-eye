// Experimental OFFLINE measurements. Does not replace the live/archival evaluator.
import {PLAY_LEVELS,addPaint,chargeAmount,totalMass,pourPath,type ColorPoint} from '../app/play-engine';
export const STABLE_POLICY={version:'chromatic-crossings-1',initialSamples:64,maxSamples:2048,absoluteConvergence:.002,relativeConvergence:.0001,chroma:.06,strokeFraction:.8,routeFraction:.8,rideLength:36};

// Exact fraction outside the chroma circle for a LINEAR a/b segment. Unlike
// endpoint-only counting, handles two outside endpoints crossing its interior.
export function outsideChromaFraction(a:readonly number[],b:readonly number[],radius=.06){
 const dx=b[0]-a[0],dy=b[1]-a[1],A=dx*dx+dy*dy,B=2*(a[0]*dx+a[1]*dy),C=a[0]*a[0]+a[1]*a[1]-radius*radius;
 if(A<1e-24)return C>=0?1:0;
 const cuts=[0,1],discriminant=B*B-4*A*C;
 if(discriminant>0)for(const t of [(-B-Math.sqrt(discriminant))/(2*A),(-B+Math.sqrt(discriminant))/(2*A)])if(t>0&&t<1)cuts.push(t);
 cuts.sort((x,y)=>x-y);let fraction=0;
 for(let i=1;i<cuts.length;i++){const t=(cuts[i]+cuts[i-1])/2;if(A*t*t+B*t+C>=0)fraction+=cuts[i]-cuts[i-1];}
 return fraction;
}
export function integrateChromaticPath(path:ColorPoint[]){
 let length=0,colored=0;for(let j=1;j<path.length;j++){
  const distance=Math.hypot(...path[j].position.map((x,k)=>x-path[j-1].position[k]));
  length+=distance;colored+=distance*outsideChromaFraction(path[j-1].lab.slice(1),path[j].lab.slice(1));
 }return {length,colored};
}
export function stableRide(palette:number,r:{order:number[];times:number[]},initialSamples=STABLE_POLICY.initialSamples){
 let q=PLAY_LEVELS[palette].paints.map((_,i)=>+(i===r.order[0]));
 const strokes=r.times.map((time,i)=>{
  const amount=chargeAmount(totalMass(q),time),at=(samples:number)=>integrateChromaticPath(pourPath(PLAY_LEVELS[palette].paints,q,r.order[i+1],amount,samples));
  let samples=initialSamples,previous=at(samples),current=previous,lengthDelta=Infinity,coloredDelta=Infinity,converged=false;
  while(samples<STABLE_POLICY.maxSamples){
   samples=Math.min(samples*2,STABLE_POLICY.maxSamples);current=at(samples);
   lengthDelta=Math.abs(current.length-previous.length);coloredDelta=Math.abs(current.colored-previous.colored);
   if(Math.max(lengthDelta,coloredDelta)<=STABLE_POLICY.absoluteConvergence+STABLE_POLICY.relativeConvergence*current.length){converged=true;break;}
   previous=current;
  }
  q=addPaint(q,r.order[i+1],amount);
  // Numerical margin is a convergence diagnostic, NOT a certified error bound.
  const lengthMargin=2*lengthDelta+1e-6,coloredMargin=2*coloredDelta+1e-6;
  const lowFraction=Math.max(0,current.colored-coloredMargin)/Math.max(1e-12,current.length+lengthMargin);
  const highFraction=Math.min(1,(current.colored+coloredMargin)/Math.max(1e-12,current.length-lengthMargin));
  return {...current,fraction:current.colored/Math.max(current.length,1e-12),samples,converged,lengthMargin,coloredMargin,lowFraction,highFraction};
 });
 const length=strokes.reduce((a,s)=>a+s.length,0),colored=strokes.reduce((a,s)=>a+s.colored,0),lm=strokes.reduce((a,s)=>a+s.lengthMargin,0),cm=strokes.reduce((a,s)=>a+s.coloredMargin,0);
 const definiteStroke=strokes.some(s=>s.length-s.lengthMargin>=36&&s.lowFraction>=.8);
 const possibleStroke=strokes.some(s=>s.length+s.lengthMargin>=36&&s.highFraction>=.8);
 const routeLow=Math.max(0,colored-cm)/Math.max(1e-12,length+lm),routeHigh=Math.min(1,(colored+cm)/Math.max(1e-12,length-lm));
 const converged=strokes.every(s=>s.converged);
 const ride:boolean|null=!converged?null:definiteStroke&&routeLow>=.8?true:!possibleStroke||routeHigh<.8?false:null;
 return {version:STABLE_POLICY.version,strokes,length,colored,fraction:colored/Math.max(length,1e-12),ride,converged,
  longestQualifying:Math.max(0,...strokes.filter(s=>s.fraction>=.8).map(s=>s.length))};
}
