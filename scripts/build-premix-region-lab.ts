import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,colorDistance,mixtureColor,colorPoint,LIVE_LANDING_TOLERANCE as T,CHARGE_SECONDS} from '../app/play-engine';
import {premixReplay} from '../app/play-premix';
import {searchPremix,type PremixControl} from './premix-search';
import {measureRegion,classifyAlternatives,type Family} from './premix-region-metrics';
import original from '../app/generated/play-premix-lab.json';
const archive='docs/play-premix-regions-final.json',output='app/generated/play-premix-regions.json';
if(existsSync(archive)||existsSync(output))throw Error('Preserve existing bank');
const runs=['docs/play-premix-regions-1.json','docs/play-premix-regions-2.json'].map(p=>JSON.parse(readFileSync(p,'utf8')));
const candidates=runs.flatMap(r=>r.results.filter((x:any)=>x.pass));
const quotas:[Family,number][]=[['rise',1],['drop',1],['chromatic-ride',2],['setup-glide',1],['coupled-balance',2],['interior-assembly',2]];
const selected:any[]=[],audits:any[]=[];
for(const [family,quota] of quotas){
 const rows=candidates.filter(r=>r.proposal.family===family).sort((a,b)=>Number(b.classification.status==='required-in-tested-routes')-Number(a.classification.status==='required-in-tested-routes')||b.classification.rawMinimum-a.classification.rawMinimum||b.proposal.score-a.proposal.score);
 let kept=0;
 for(const r of rows){
  if(kept===quota)break;const p=r.proposal;
  if(selected.some(s=>s.proposal.level===p.level&&colorDistance(s.proposal.target,p.target)<T*2)||selected.filter(s=>s.proposal.level===p.level).length>=2)continue;
  console.log('Final challenge',p.id);
  const independent=searchPremix(p.level,p.start,p.target,'normalized',p.control.order.length,1784911+audits.length,512,16);
  const controls:PremixControl[]=[p.control,...r.rivals,...independent.routes];
  // Inspect accepted controls away from center-optimized examples. Even a single
  // accepted style bypass matters; it need not be a center-optimal route.
  const nearby:PremixControl[]=[];
  for(const c of controls.filter((r,i,a)=>a.findIndex(s=>s.order.join()===r.order.join())===i)){
   for(let axis=0;axis<c.times.length;axis++)for(const offset of [-.055,-.0275,.0275,.055]){
    const times=[...c.times];times[axis]=Math.max(0,Math.min(CHARGE_SECONDS,times[axis]+offset));
    const error=colorDistance(mixtureColor(PLAY_LEVELS[p.level].paints,premixReplay(p.start,c.order,times,'normalized')),p.target);
    if(error<=T)nearby.push({order:c.order,times,error});
   }
  }
  const unique=[...controls,...nearby].filter((r,i,a)=>a.findIndex(s=>s.order.join()===r.order.join()&&s.times.every((t,j)=>Math.abs(t-r.times[j])<.003))===i);
  const measured=unique.map(c=>measureRegion(p.level,p.start,p.target,c));
  const featured=measureRegion(p.level,p.start,p.target,p.control),classification=classifyAlternatives(family,measured,featured);
  const pass=classification.rawMinimum===p.control.order.length&&featured.supported&&featured.allMeaningful;
  const row={...r,featured,rivals:measured,classification,pass,finalChallenge:{seed:independent.seed,samples:independent.samples,restarts:independent.restarts,evaluations:independent.evaluations,best:independent.best,acceptedPerturbations:nearby.length}};
  audits.push(row);if(pass){selected.push(row);kept++;}
  console.log(JSON.stringify({pass,classification,measured:measured.length}));
 }
}
const holes=selected.map((r,i)=>{
 const p=r.proposal,diverse=r.rivals.filter((s:any,j:number,a:any[])=>a.findIndex(x=>x.order.join()===s.order.join())===j);
 // Ensure a visible bypass is not lost just because another control uses its order.
 const bypass=r.rivals.find((s:any)=>s.supported&&s.order.length===r.classification.timingMinimum&&!s.traits[p.family]);
 const rivals=[...(bypass?[bypass]:[]),...diverse].filter((s,j,a)=>a.indexOf(s)===j).slice(0,10);
 return {id:p.id,level:p.level,stage:i,style:p.family,initial:p.start,targetRGB:p.target.rgb,paints:PLAY_LEVELS[p.level].paints.map(x=>[x.id,x.rgb,x.strength]),role:'new',radius:p.radius,classification:r.classification,modes:{normalized:{...p.control,minimum:r.classification.rawMinimum,measurement:r.featured,rivals}}};
});
// Two familiar normalized anchors: user rejected easy Secondaries and enjoyed
// Crimson Current. Reference quality is not inferred from the new classifier.
for(const id of ['premix-2-81','premix-3-496']){
 const h=original.holes.find(h=>h.id===id)!,measurement=measureRegion(h.level,h.initial,colorPoint(h.targetRGB as [number,number,number]),h.modes.normalized);
 holes.push({...h,id:'reference-'+h.id,stage:holes.length,role:id==='premix-2-81'?'reference-easy':'reference-liked',radius:0,classification:{rawMinimum:h.modes.normalized.minimum,timingMinimum:h.modes.normalized.minimum,efficientRoutes:0,styleRoutes:0,status:'reference',bypasses:[]},modes:{normalized:{...h.modes.normalized,measurement,rivals:[]}}} as any);
}
writeFileSync(archive,JSON.stringify({version:'premix-regions-final-1',tolerance:T,searchReports:runs.map(r=>({seed:r.seed,sourceHash:r.sourceHash,stats:r.stats,challenged:r.results.length})),audits,selected:selected.map(r=>r.proposal.id),limitations:['Bounded numerical search, not exhaustive proof','Local setup tensor, not global inverse-region volume','No perception or enjoyment model','Nearby accepted controls inspected; continuous region not exhausted']}));
writeFileSync(output,JSON.stringify({version:'premix-regions-1',seed:720923,tolerance:T,holes}));
console.log(JSON.stringify({holes:holes.map(h=>({id:h.id,palette:PLAY_LEVELS[h.level].name,role:h.role,status:h.classification.status}))}));
