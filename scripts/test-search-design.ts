// Paired computational experiment. Does NOT replace a playable lab or policy.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,colorPoint,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {releasesToLegs,legReplay,canonicalLegs,type PigmentLeg} from '../app/play-pigment-legs';
import {searchLegEndpoints,challengeLegOrders} from './pigment-leg-search';
import {bidirectionalLegSearch,blindLandingRoots,forwardEndpointRoutes} from './bidirectional-leg-search';
import {legGeometry,measureLegRegion} from './pigment-leg-metrics';
import {inverseChain} from './branching-regions';
import {rng} from './premix-hybrid';
import {readBankJson} from './research-bank-io';

const output=process.env.DESIGN_OUTPUT??'docs/bidirectional-exclusion-1',seed=927451;
if(existsSync(output))throw Error('Use a fresh output directory');mkdirSync(output,{recursive:true});
const save=(name:string,data:unknown)=>writeFileSync(output+'/'+name+'.json',JSON.stringify(data,null,2));
const input=process.argv[2];if(!input)throw Error('Supply review export');
const data=JSON.parse(readFileSync(input,'utf8')),attempts=new Map<string,any>(),reviews=new Map<string,any>();
for(const e of data.events){if(e.attempt)attempts.set(e.attemptId,e.attempt);if(e.review)reviews.set(e.attemptId,e.review);}
const banks=['app/generated/play-branch-lab.json','app/generated/play-conditioned-lab.json'].map(readBankJson);
const cases=banks.flatMap(b=>b.holes.map((h:any)=>{
 const paints=PLAY_LEVELS[h.level].paints,target=colorPoint(h.targetRGB),played=[...attempts].filter(([,a])=>a.specimen.hole.courseId===h.id+'-normalized');
 return{id:h.id,title:h.title,palette:PLAY_LEVELS[h.level].name,paints,start:h.initial,target,expected:h.lab.rawLegMinimum,demonstration:releasesToLegs(h.initial,h.modes.normalized.order,h.modes.normalized.times),
  played:played.map(([id,a])=>({outcome:a.outcome,revealed:a.revealed,shots:a.shots.filter((s:any)=>!s.cancelled).map((s:any)=>s.paint),legs:canonicalLegs(a.shots.filter((s:any)=>!s.cancelled).map((s:any)=>({paint:s.paint,share:s.amount/(1+s.amount)}))).length,review:reviews.get(id)})),
  sourceMeasurement:h.modes.normalized.measurement};
}));
save('manifest',{seed,tolerance:T,inputHash:createHash('sha256').update(readFileSync(input)).digest('hex'),eventCount:data.events.length,distinctAttempts:attempts.size,
 policy:'Fixed cases use no intended route/recipe/style for either solver. Root recovery costs charged to bidirectional. All starts/targets frozen. Selection ablation uses same 64 proposals and ranking; only pre-selection shorter exclusion differs. Computational, not randomized player trial. No runtime changes.',
 physicsHash:createHash('sha256').update(['app/pigment-color.ts','app/play-pigment-legs.ts','scripts/bidirectional-leg-search.ts','scripts/test-search-design.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex')});
save('review',cases.map(({paints,demonstration,...p}:any)=>({...p,paints:paints.map((p:any)=>p.name),demoGeometry:legGeometry(paints,p.start,p.target,demonstration,192)})));
function inspect(p:any,rows:{legs:PigmentLeg[];error:number}[]){
 const sorted=[...rows].sort((a,b)=>a.legs.length-b.legs.length||a.error-b.error),picked:typeof rows=[];const seen=new Set<string>();
 for(const r of sorted){const k=r.legs.map(l=>l.paint).join();if(!seen.has(k)){seen.add(k);picked.push(r);if(picked.length===24)break;}}
 const measured=picked.map(r=>{const m=measureLegRegion(p.paints,p.start,p.target,r.legs,3);return{legs:r.legs,error:m.error,meaningful:m.allMeaningful,supported:m.supported,finishWidth:m.finishWidth,setupCoverage:m.setupCoverage,traits:m.traits};});
 const min=sorted.length?sorted[0].legs.length:null,efficient=measured.filter(m=>m.legs.length===min&&m.supported&&m.meaningful);
 return{minimum:min,routes:rows.length,orders:seen.size,measured,firstPaints:[...new Set(efficient.map(r=>r.legs[0]?.paint))],supportedEfficient:efficient.length};
}
const fixed:any[]=[];
for(const [i,p] of cases.entries()){
 const t=performance.now(),s=searchLegEndpoints(p.paints,p.start,p.target,3,seed+i*997,64,6),directMs=performance.now()-t;
 const tb=performance.now(),roots=blindLandingRoots(p.paints,p.target,seed+i*997+101,64),parts=[1,2,3].map(depth=>bidirectionalLegSearch(p.paints,p.start,p.target,roots.roots,depth));
 const bi={routes:parts.flatMap(b=>b.routes),evaluations:parts.reduce((s,b)=>s+b.evaluations,0),exact:parts.reduce((s,b)=>s+b.exact,0),approximate:parts.reduce((s,b)=>s+b.approximate,0)},biMs=performance.now()-tb;
 const direct=inspect(p,forwardEndpointRoutes(p.start,s.endpoints)),bidirectional=inspect(p,bi.routes);
 const check=challengeLegOrders(p.paints,p.start,p.target,Math.max(1,p.expected-1),seed+800003+i*337,192,12);
 const omissions=p.paints.map((paint:any,j:number)=>({paint:paint.name,bestWithoutT:Math.min(...s.endpoints.filter(e=>!e.paints.includes(j)).map(e=>e.error/T))}));
 const bases=p.paints.map((paint:any,j:number)=>{const start=p.start.map((_:number,k:number)=>k===j?1:0),f=searchLegEndpoints(p.paints,start,p.target,2,seed+600007+i*499+j*31,64,6);return{paint:paint.name,startDistanceT:f.zero/T,minimum:f.zero<=T?0:f.best.findIndex(e=>e.error<=T)<0?null:f.best.findIndex(e=>e.error<=T)+1,bestByDepth:f.best.map(e=>e.error/T),witness:f.best.find(e=>e.error<=T)??null};});
 const row={id:p.id,directMs,bidirectionalMs:biMs,directEvaluations:s.evaluations,bidirectionalEvaluations:roots.evaluations+bi.evaluations,rootCount:roots.roots.length,exactRootJoins:bi.exact,approximateRootProposals:bi.approximate,
  direct,bidirectional,check:{bestByDepth:check.best.map(e=>e/T),counterexamples:check.routes.filter(r=>r.error<=T),evaluations:check.evaluations},omissions,freeBases:bases};
 fixed.push(row);save('fixed-'+i,{p,...row});console.log(JSON.stringify({phase:'fixed',done:i+1,direct:direct.minimum,bidirectional:bidirectional.minimum,firstDirect:direct.firstPaints.length,firstBi:bidirectional.firstPaints.length}));
}
// Fresh inverse proposals at archived targets, not a fresh global palette survey.
// Predeclare strata rather than choosing targets after observing the gate result.
const archive='docs/branching-region-comparison-2',manifest=readBankJson(archive+'/manifest.json'),queries=readBankJson(archive+'/queries.json');
const chosen:any[]=[];
for(const n of [4,5,6])for(const request of ['dark','middle'])chosen.push(...queries.filter((q:any)=>!q.unavailable&&q.request===request&&manifest.palettes[q.palette].track==='novel'&&manifest.palettes[q.palette].paints.length===n).slice(0,32));
const selection:any[]=[];
for(const [i,q] of chosen.entries()){
 const paints=manifest.palettes[q.palette].paints,target=mixtureColor(paints,q.targetRecipe),roots=blindLandingRoots(paints,target,seed+900001+i*997,32),random=rng(seed+1000003+i*997),pool:any[]=[],raw:any[]=[];let gateMs=0,gateEvaluations=0;
 for(let k=0;k<64&&roots.roots.length;k++){
  const w=inverseChain(roots.roots[k%roots.roots.length],3,random);raw.push({id:k,...w});if(!w)continue;
  const g=legGeometry(paints,w.start,target,w.legs,24);if(!g.allMeaningful||g.initialDistance<=T)continue;
  let one=Infinity;for(let paint=0;paint<paints.length;paint++)for(let z=0;z<=24;z++)one=Math.min(one,colorDistance(mixtureColor(paints,legReplay(w.start,[{paint,share:z/24}])),target)/T);
  if(one<1.25)continue;
  const t=performance.now(),short=searchLegEndpoints(paints,w.start,target,2,seed+1100003+i*997+k,24,3);gateMs+=performance.now()-t;gateEvaluations+=short.evaluations;
  pool.push({id:k,start:w.start,legs:w.legs,oneT:one,score:Math.min(one,6)+.12*Math.min(g.initialDistance/T,15),marginT:Math.min(...short.best.map(e=>e.error/T)),shorterWitness:short.best.reduce((a,b)=>a.error<b.error?a:b)});
 }
 pool.sort((a,b)=>b.score-a.score);
 const baseline=pool[0]??null,excluded=pool.find(p=>p.marginT>1)??null;
 const audit=(p:any)=>{if(!p)return null;const check=challengeLegOrders(paints,p.start,target,2,seed+1200007+i*337,256,16),region=measureLegRegion(paints,p.start,target,p.legs,5);
  return{id:p.id,marginT:Math.min(...check.best.map(e=>e/T)),counterexamples:check.routes.filter(r=>r.error<=T),supported:region.supported,finishWidth:region.finishWidth,setupCoverage:region.setupCoverage};};
 const baseCheck=audit(baseline),gateCheck=excluded?.id===baseline?.id?baseCheck:audit(excluded);
 const row={palette:q.palette,paints:paints.map((p:any)=>p.name),request:q.request,pool:pool.length,baseline:baseCheck,exclusion:gateCheck,gateMs,gateEvaluations};selection.push(row);
 save('selection-'+i,{...row,targetRecipe:q.targetRecipe,roots:roots.roots,raw,candidates:pool});
 console.log(JSON.stringify({phase:'selection',done:i+1,pool:pool.length,baseline:baseCheck?.marginT,exclusion:gateCheck?.marginT}));
}
const count=(key:'baseline'|'exclusion')=>({selected:selection.filter(r=>r[key]).length,shorterFound:selection.filter(r=>r[key]?.marginT<=1).length,resistant:selection.filter(r=>r[key]?.marginT>1).length,resistantSupported:selection.filter(r=>r[key]?.marginT>1&&r[key]?.supported).length});
save('summary',{fixedCases:fixed.length,directSolved:fixed.filter(r=>r.direct.minimum!==null).length,bidirectionalSolved:fixed.filter(r=>r.bidirectional.minimum!==null).length,
 minimumDisagreements:fixed.filter(r=>r.direct.minimum!==r.bidirectional.minimum).map(r=>({id:r.id,direct:r.direct.minimum,bidirectional:r.bidirectional.minimum})),
 independentShorterDisagreements:fixed.filter(r=>r.check.counterexamples.length).map(r=>r.id),
 directMs:fixed.reduce((s,r)=>s+r.directMs,0),bidirectionalMs:fixed.reduce((s,r)=>s+r.bidirectionalMs,0),
 directEvaluations:fixed.reduce((s,r)=>s+r.directEvaluations,0),bidirectionalEvaluations:fixed.reduce((s,r)=>s+r.bidirectionalEvaluations,0),
 moreBidirectionalFirstPaints:fixed.filter(r=>r.bidirectional.firstPaints.length>r.direct.firstPaints.length).map(r=>r.id),
 moreDirectFirstPaints:fixed.filter(r=>r.bidirectional.firstPaints.length<r.direct.firstPaints.length).map(r=>r.id),
 selectionQueries:selection.length,rawProposals:selection.length*64,screened:selection.reduce((s,r)=>s+r.pool,0),baseline:count('baseline'),exclusion:count('exclusion'),
 changedSelections:selection.filter(r=>r.exclusion&&r.baseline?.id!==r.exclusion.id).length,gateMs:selection.reduce((s,r)=>s+r.gateMs,0),gateEvaluations:selection.reduce((s,r)=>s+r.gateEvaluations,0),
 limitations:['Algebraic meet-in-the-middle uses the affine recipe structure, not a general continuous bidirectional tree.','Accepted-root sampling is incomplete, and projected roots require actual-color replay; approximate and exact joins remain distinguished.','Same cases and same candidate pool do not mean equal CPU: work is reported explicitly.','Raw exclusion is finite numerical evidence, not a certified global non-reachability proof.','Support measurements are local fraction-grid estimates, not player probabilities.','No claim that more pigment legs or more alternatives equals better play.','Free-base endpoint analysis here ignores accumulated-mass timing and release limits.']});
console.log(JSON.stringify({phase:'done',output}));
