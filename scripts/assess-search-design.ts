import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay,legExecution} from '../app/play-pigment-legs';
import {premixStep} from '../app/play-premix';
import {inverseChain,branchEvidence} from './branching-regions';
import {rng} from './premix-hybrid';
import {challengeLegOrders,searchLegEndpoints} from './pigment-leg-search';
import {auditLegPuzzle} from './pigment-leg-audit';
import {legGeometry,measureLegRegion} from './pigment-leg-metrics';
import {readBankJson} from './research-bank-io';
const dir=process.argv[2]??'docs/bidirectional-exclusion-2',seed=927451,manifest=readBankJson('docs/branching-region-comparison-2/manifest.json');
const get=(name:string)=>JSON.parse(readFileSync(dir+'/'+name+'.json','utf8'));
const save=(name:string,data:unknown)=>writeFileSync(dir+'/'+name+'.json',JSON.stringify(data,null,2));
const finalists:any[]=[];let rawCount=0;
for(const f of readdirSync(dir).filter(f=>/^selection-\d+\.json$/.test(f))){
 const i=Number(f.match(/\d+/)![0]),r=get(f.slice(0,-5)),random=rng(seed+1000003+i*997);
 // Reconstruct all rejected proposals, too. Verify every retained source exactly.
 const raw=Array.from({length:64},(_,id)=>({id,...inverseChain(r.roots[id%r.roots.length],3,random)}));rawCount+=raw.length;
 for(const p of r.candidates){const w=raw[p.id];if(JSON.stringify(w.start)!==JSON.stringify(p.start)||JSON.stringify(w.legs)!==JSON.stringify(p.legs))throw Error('Seed replay mismatch');}
 if(!r.raw)save(f.slice(0,-5),{...r,raw});
 if(!r.exclusion)continue;
 const p=r.candidates.find((p:any)=>p.id===r.exclusion.id),paints=manifest.palettes[r.palette].paints,target=mixtureColor(paints,r.targetRecipe);
 const puzzle={id:`${f}/${p.id}`,paints,start:p.start,target,demonstration:p.legs};
 const audit=auditLegPuzzle(puzzle,1879511+i,{samples:384,restarts:20,maxMeasured:48,maxLegs:3,fresh:true});
 const holdout=challengeLegOrders(paints,p.start,target,2,2287901+i*977,1024,32);
 const execution=legExecution(p.legs);let q=p.start;let earlyCapture=false,executable=true;
 const releases=execution.flatMap(e=>e.times?e.times.map(seconds=>({paint:e.paint,seconds})):[]);
 if(execution.some(e=>!e.times))executable=false;
 releases.forEach((r,k)=>{q=premixStep(q,r.paint,r.seconds,'normalized').after;if(k<releases.length-1&&colorDistance(mixtureColor(paints,q),target)<=T)earlyCapture=true;});
 const summary={id:puzzle.id,palette:r.paints,minimum:audit.summary.rawMinimum,supportedMinimum:audit.summary.robustMinimum,shorterMarginT:Math.min(...holdout.best.map(e=>e/T)),branch:branchEvidence(audit),
  styles:audit.summary.styles,executable:executable&&!earlyCapture&&colorDistance(mixtureColor(paints,q),target)<=T,earlyCapture,releases,traits:legGeometry(paints,p.start,target,p.legs,192).traits};
 finalists.push(summary);const {search,fresh,...compact}=audit;save('final-'+i,{...summary,audit:compact,holdout:{bestByDepth:holdout.best.map(e=>e/T),evaluations:holdout.evaluations,counterexamples:holdout.routes.filter(r=>r.error<=T)}});
}
const free:any[]=[];
for(const i of [2,3,9]){ // Cases with no <=2-leg pure-base solution in initial audit.
 const r=get('fixed-'+i),p=r.p;
 free.push({id:p.id,bases:p.paints.map((paint:any,j:number)=>{
  const start=p.start.map((_:number,k:number)=>k===j?1:0),s=searchLegEndpoints(p.paints,start,p.target,3,2879151+i*997+j,256,16),c=challengeLegOrders(p.paints,start,p.target,2,3187511+i*997+j,512,24);
  return{paint:paint.name,bestShorterT:Math.min(...c.best.map(e=>e/T)),minimum:s.best.findIndex(e=>e.error<=T)<0?null:s.best.findIndex(e=>e.error<=T)+1,witness:s.best.find(e=>e.error<=T)??null,counterexamples:c.routes.filter(r=>r.error<=T)};
 })});
}
// Refine the one extra first-paint result at the usual denser local grid.
const fixed=get('fixed-18'),extra=fixed.bidirectional.measured.filter((r:any)=>!fixed.direct.firstPaints.includes(r.legs[0]?.paint)).map((r:any)=>{const m=measureLegRegion(fixed.p.paints,fixed.p.start,fixed.p.target,r.legs,5);return{legs:r.legs,supported:m.supported,meaningful:m.allMeaningful,finishWidth:m.finishWidth,setupCoverage:m.setupCoverage};});
save('assessment',{rawCount,finalists,free,extraFirstPaintCheck:extra,notes:['Finalists checked with a fresh 1024-sample/32-restart ordered solver and full current-control release replay.','Free-start transfer is endpoint-only evidence; no claim yet about accumulated-mass timing or equal enjoyment.','Raw proposal replay adds the rejected seed witnesses without changing candidate selection.']});
console.log(JSON.stringify({finalists:finalists.map(f=>({id:f.id,min:f.minimum,margin:f.shorterMarginT,first:f.branch.firstPaints,executable:f.executable})),free:free.map(r=>({id:r.id,min:r.bases.map((b:any)=>b.minimum),margin:r.bases.map((b:any)=>b.bestShorterT)})),extra}));
