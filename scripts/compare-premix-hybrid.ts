import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mixtureColor, colorDistance, LIVE_LANDING_TOLERANCE as T } from '../app/play-engine';
import { premixReplay } from '../app/play-premix';
import { refinePuzzle, targetOf, structuralVerdict, cleanupAttack, POLICY, type Puzzle, type RefinementMode } from './premix-hybrid';
import { compositionPlans } from './premix-composition-plan';
import { searchPremix } from './premix-search';
import { measureRegion } from './premix-region-metrics';

const output=process.env.COMPARISON_OUTPUT??'docs/premix-ablation-1';
if(existsSync(output))throw Error('Archive exists; choose a new COMPARISON_OUTPUT');
mkdirSync(output,{recursive:true});
const old=JSON.parse(readFileSync('docs/premix-hybrid-2/refined.json','utf8')) as ReturnType<typeof refinePuzzle>[];
const parents=old.filter(r=>!r.p.id.endsWith('-sub'));
const entries=parents.map((r,i)=>({p:r.initial,seed:751927+70000+i,source:'all-parent-candidates'}));
// Keep the successful substitution as an explicit extra anchor, not silently
// included in an unbiased yield denominator.
const child=old.find(r=>r.p.id==='hybrid-751927-865-0-3-sub')!;
entries.push({p:child.initial,seed:751927+90000+parents.findIndex(r=>r.p.id===child.p.id.replace(/-sub$/,'')),source:'selected-substitution-anchor'});
const modes:RefinementMode[]=['dose-only','start-only','target-only','joint'];
const begin=Date.now(),rows:any[]=[];
let evaluations=0;
const config={rounds:8,samples:192,restarts:10,modes,baseline:true,selection:'All 128 original parents from hybrid-2, plus one labeled successful-substitution anchor. No finalist-only selection.',tolerance:T,policy:POLICY};
writeFileSync(output+'/manifest.json',JSON.stringify({config,entries}));

for(const [index,entry] of entries.entries()){
 const initial=entry.p,variants=[{mode:'baseline',p:initial,history:[] as unknown[]}];
 for(const mode of modes){const r=refinePuzzle(initial,entry.seed,8,mode);variants.push({mode,p:r.p,history:r.history});}
 // Dose-only does not change endpoints of the reachable set. Reuse identical
 // fixed-start/target challenges to avoid attributing solver noise to improvement.
 const cache=new Map<string,any>();
 for(const variant of variants){
  const p=variant.p,target=targetOf(p),depth=p.control.order.length,key=JSON.stringify([p.start,p.targetRecipe]);
  let challenge=cache.get(key);
  if(!challenge){
   const raw=searchPremix(0,p.start,target,'normalized',depth-1,817921+index,192,10,p.paints);
   const algebra=compositionPlans(p.start,p.targetRecipe);
   const algebraicRoutes=algebra.legalRoutes.filter(r=>r.order.length>0&&r.order.length<depth).map(r=>({order:r.order,times:r.times!,error:colorDistance(mixtureColor(p.paints,premixReplay(p.start,r.order,r.times!,'normalized')),target)}));
   const best=[...raw.best];for(const r of algebraicRoutes)best[r.order.length-1]=Math.min(best[r.order.length-1],r.error);
   const cleanup=cleanupAttack(p,618211+index,128,28);evaluations+=raw.evaluations+cleanup.evaluations;
   challenge={raw:{...raw,best,bestT:best.map(e=>e/T)},cleanup,algebra};cache.set(key,challenge);
  }
  const witness=measureRegion(0,p.start,target,p.control,p.paints);
  const error=colorDistance(mixtureColor(p.paints,premixReplay(p.start,p.control.order,p.control.times,'normalized')),target);
  const verdict=structuralVerdict(depth,challenge.raw.best,challenge.cleanup.best);
  if(error>T)verdict.reasons.push('witness-misses');
  if(!witness.supported)verdict.reasons.push('witness-insufficient-timing-or-setup-support');
  if(!witness.allMeaningful)verdict.reasons.push('witness-split-deletable-or-small-action');
  verdict.pass=verdict.reasons.length===0;
  rows.push({id:initial.id,source:entry.source,seed:entry.seed,mode:variant.mode,p,target,history:variant.history,
   startShiftT:colorDistance(mixtureColor(p.paints,initial.start),mixtureColor(p.paints,p.start))/T,
   targetShiftT:colorDistance(targetOf(initial),target)/T,
   witness:{...witness,error},verdict,challenge,
   rawMinimum:Math.min(...challenge.raw.best.map((e:number,i:number)=>e<=T?i+1:Infinity),...(error<=T?[depth]:[])),
   timingMinimum:null,timingMinimumNote:'Not exhaustively assessed in this ablation; featured support is separate from shorter raw reachability.'});
 }
 writeFileSync(output+'/comparisons.json',JSON.stringify(rows));
 if(index%4===0)console.log(JSON.stringify({phase:'paired-comparison',cases:index+1,of:entries.length,seconds:(Date.now()-begin)/1000,evaluations}));
}

// Independent fresh seeds for every passing three-pour result, not only the
// joint arm. Cache duplicate puzzles across arms, but retain all arm outcomes.
const fresh:any[]=[],freshCache=new Map<string,any>();
for(const r of rows.filter(r=>r.verdict.pass&&r.p.control.order.length===3)){
 const key=JSON.stringify([r.p.paints,r.p.start,r.p.targetRecipe]);let result=freshCache.get(key);
 if(!result){
  const runs=[928171,1982171].map(seed=>searchPremix(0,r.p.start,r.target,'normalized',2,seed,768,32,r.p.paints));
  const cleanup=cleanupAttack(r.p,7192381,512,64),bestT=[0,1].map(i=>Math.min(...runs.map(r=>r.best[i]/T)));
  evaluations+=runs.reduce((s,r)=>s+r.evaluations,0)+cleanup.evaluations;
  result={runs,cleanup,bestT,survives:bestT[0]>=POLICY.almostOne&&bestT[1]>=POLICY.shorterMargin&&(!cleanup.best||cleanup.best.error>T)};freshCache.set(key,result);
 }
 fresh.push({id:r.id,mode:r.mode,...result});writeFileSync(output+'/fresh-validation.json',JSON.stringify(fresh));
 console.log(JSON.stringify({phase:'fresh',id:r.id,mode:r.mode,bestT:result.bestT,survives:result.survives}));
}
const sources=['scripts/premix-hybrid.ts','scripts/compare-premix-hybrid.ts','scripts/premix-composition-plan.ts','scripts/premix-search.ts','scripts/premix-region-metrics.ts','app/play-premix.ts','app/play-engine.ts','app/paint-mixing.ts'];
const summary={config,seconds:(Date.now()-begin)/1000,evaluations,cases:entries.length,comparisons:rows.length,
 sourceHash:createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex'),
 groups:[2,3].flatMap(depth=>['baseline',...modes].map(mode=>{
  const group=rows.filter(r=>r.source==='all-parent-candidates'&&r.mode===mode&&r.p.control.order.length===depth);
  return{depth,mode,n:group.length,passes:group.filter(r=>r.verdict.pass).length,freshSurvivors:depth===3?group.filter(r=>fresh.some(f=>f.id===r.id&&f.mode===mode&&f.survives)).length:null};
 })),
 byPaintCount:[3,4,5,6].flatMap(n=>['baseline',...modes].map(mode=>{
  const group=rows.filter(r=>r.source==='all-parent-candidates'&&r.mode===mode&&r.p.control.order.length===3&&r.p.paints.length===n);
  return{paints:n,depth:3,mode,n:group.length,passes:group.filter(r=>r.verdict.pass).length};
 })),
 limitations:['Selected parent cohort, not a random sample of all palettes','Fixed witness orders and bounded local iteration budget','Recipe-blind numerical validation is not a proof','Algebraic construction is a separate recipe-aware attack','No gameplay or live lab changes']};
writeFileSync(output+'/summary.json',JSON.stringify(summary));console.log(JSON.stringify(summary));
