import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,pourPath,chargeAmount,addPaint,totalMass} from '../app/play-engine';
type Variant={times:number[]};
const input=JSON.parse(readFileSync('docs/play-blind-validation-results.json','utf8')) as {sourceHash:string;rows:{id:string;palette:number;comparisons:{sameOrderDisagreements:{style:string;order:string;yes:Variant;no:Variant}[]}[]}[]};
const results=[];
for(const row of input.rows)for(const comparison of row.comparisons)for(const disagreement of comparison.sameOrderDisagreements.filter(d=>d.style==='ride')){
 const order=disagreement.order.split(',').map(Number),variants=[];
 for(const side of ['yes','no'] as const){
  const resolutions=[];
  for(const samples of [48,64,128,256,1024,2048]){
   let q=PLAY_LEVELS[row.palette].paints.map((_,i)=>+(i===order[0]));const strokes=[];
   for(let i=0;i<disagreement[side].times.length;i++){
    const amount=chargeAmount(totalMass(q),disagreement[side].times[i]),path=pourPath(PLAY_LEVELS[row.palette].paints,q,order[i+1],amount,samples);let length=0,colored=0;
    for(let j=1;j<path.length;j++){const d=Math.hypot(...path[j].position.map((v,k)=>v-path[j-1].position[k]));length+=d;if(Math.min(Math.hypot(...path[j].lab.slice(1)),Math.hypot(...path[j-1].lab.slice(1)))>=.06)colored+=d;}
    strokes.push({length,colored,fraction:colored/Math.max(length,1e-12)});q=addPaint(q,order[i+1],amount);
   }
   const longest=Math.max(0,...strokes.filter(s=>s.fraction>=.8).map(s=>s.length)),fraction=strokes.reduce((a,s)=>a+s.colored,0)/Math.max(1e-12,strokes.reduce((a,s)=>a+s.length,0));
   resolutions.push({samples,strokes,longest,fraction,ride:longest>=36&&fraction>=.8});
  }
  variants.push({side,times:disagreement[side].times,resolutions});
 }
 results.push({id:row.id,palette:row.palette,order,variants});
}
writeFileSync('docs/play-ride-resolution-results.json',JSON.stringify({sourceStudyHash:input.sourceHash,note:'Same controls and scoring. Only measurement sampling density changes. Convergence check, not proof of exact arc integration or live classifier change.',results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({id:r.id,order:r.order,variants:r.variants.map(v=>({side:v.side,labels:v.resolutions.map(x=>[x.samples,x.ride]),longest:v.resolutions.map(x=>x.longest)}))})),null,2));
