// Campaign roster + branching contenders; research only until separately curated.
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {CAMPAIGN_CHAPTERS} from '../app/play-campaign';
import {readBankJson} from './research-bank-io';
import {rng} from './premix-hybrid';
import {sampleRecipe} from './pigment-leg-proposals';
import {acceptedRecipeCloud,inverseChain,branchEvidence} from './branching-regions';
import {legGeometry} from './pigment-leg-metrics';
import {searchLegEndpoints,challengeLegOrders} from './pigment-leg-search';
import {auditLegPuzzle} from './pigment-leg-audit';
const out='docs/course-workbench-1',seed=1937819;
if(existsSync(out))throw Error('Use a fresh research bank');mkdirSync(out,{recursive:true});
const save=(file:string,data:unknown)=>writeFileSync(`${out}/${file}.json`,JSON.stringify(data));
const roster:{name:string;paints:PaintColor[];origin:string}[]=[],key=(p:PaintColor[])=>JSON.stringify(p.map(x=>[x.id,x.rgb,x.strength]));
const add=(name:string,paints:PaintColor[],origin:string)=>{if(!roster.some(r=>key(r.paints)===key(paints)))roster.push({name,paints,origin});};
for(const c of CAMPAIGN_CHAPTERS)add(c.name,PLAY_LEVELS[c.levelIndex].paints,'campaign');
for(const name of ['Hansa · Scarlet · Violet','Earth Orange · Cobalt Green','Emerald · Yellow · Scarlet','Violet · Chromium','Chartreuse · Rose · Black','Crimson Current','Teal Earth']){const p=PLAY_LEVELS.find(p=>p.name===name);if(p)add(name,p.paints,'branching / reviewed reserve');}
const prior=readBankJson('docs/bidirectional-exclusion-2/assessment.json');
const nicknames:Record<string,string>={'selection-5.json/43':'Scarlet · Cobalt Green','selection-38.json/10':'Scarlet · Cobalt Green','selection-48.json/58':'Umber · Rose','selection-54.json/49':'Violet · Lemon · Blue','selection-116.json/9':'Rose · Indigo · Yellows','selection-186.json/32':'Turquoise · Orange · Violet'};
for(const f of prior.finalists){const r=readBankJson('docs/bidirectional-exclusion-2/final-'+f.id.match(/selection-(\d+)/)[1]+'.json');add(nicknames[f.id],r.audit.p.paints,'new exclusion contender');}
save('manifest',{seed,tolerance:T,roster,policy:'All original campaign chapters retained. Pigment definitions unchanged. Targets include old campaign snapshots and new palette-relative color regions. Free-base screening checks every base, before style selection. Premix three-leg proposals face explicit <=2 exclusion before nomination. Finite search, not complete palette capacity.'});
const board:any[]=[],premix:any[]=[],free:any[]=[];
for(const [pi,p] of roster.entries()){
 const random=rng(seed+pi*8191),pool=Array.from({length:160},()=>{const recipe=sampleRecipe(p.paints.length,random),target=mixtureColor(p.paints,recipe);return{recipe,target};});
 const targets:{id:string;target:ReturnType<typeof mixtureColor>;recipe:number[];zone:string;source:string}[]=[];
 const chapter=CAMPAIGN_CHAPTERS.find(c=>key(PLAY_LEVELS[c.levelIndex].paints)===key(p.paints));
 if(chapter)for(const slot of chapter.slots){if(slot.specimen)targets.push({id:slot.id,target:slot.specimen.hole.target,recipe:slot.specimen.hole.recipe,zone:slot.title,source:'campaign'});}
 const scores=[['light',(x:any)=>x.target.lab[0]],['dark',(x:any)=>-x.target.lab[0]],['chromatic',(x:any)=>Math.hypot(...x.target.lab.slice(1))],['warm',(x:any)=>x.target.lab[1]+x.target.lab[2]],['cool',(x:any)=>-x.target.lab[1]-x.target.lab[2]],['middle',(x:any)=>-Math.abs(x.target.lab[0]-.58)],['neutral',(x:any)=>-Math.hypot(...x.target.lab.slice(1))],['colorful-middle',(x:any)=>Math.hypot(...x.target.lab.slice(1))-.6*Math.abs(x.target.lab[0]-.6)]] as const;
 for(const [zone,score] of scores){const r=[...pool].sort((a,b)=>score(b)-score(a)).find(r=>targets.every(t=>colorDistance(r.target,t.target)>.035));if(r)targets.push({...r,id:`workbench-${pi}-${zone}`,zone,source:'new relative target'});}
 const paletteFree:any[]=[],palettePremix:any[]=[],raw:any[]=[];
 for(const [ti,t] of targets.entries()){
  const n=p.paints.length,bases=p.paints.map((paint,j)=>{const start=Array.from({length:n},(_,k)=>k===j?1:0),s=searchLegEndpoints(p.paints,start,t.target,2,seed+pi*997+ti*41+j,24,3);return{paint:j,distanceT:s.zero/T,minimum:s.zero<=T?0:s.best.findIndex(e=>e.error<=T)<0?3:s.best.findIndex(e=>e.error<=T)+1,bestByDepth:s.best.map(e=>e.error/T)};});
  paletteFree.push({...t,bases,minimum:Math.min(...bases.map(b=>b.minimum)),farT:Math.min(...bases.map(b=>b.distanceT))});
  // Native palette-relative targets provide known attainable roots; campaign
  // target snapshots need separate inverse recovery and stay in free-base audit.
  if(t.source==='campaign'||n<4||n>6)continue;
  const roots=acceptedRecipeCloud(p.paints,t.recipe,random,16);
  const candidates:any[]=[];
  for(let k=0;k<64;k++){
   const w=inverseChain(roots[k%roots.length],3,random);if(!w)continue;
   const id=`workbench-premix-${pi}-${ti}-${k}`,g=legGeometry(p.paints,w.start,t.target,w.legs,24);
   const r={id,start:w.start,demonstration:w.legs,target:t.target,targetRecipe:t.recipe,zone:t.zone,palette:pi};raw.push(r);
   if(g.legs.length!==3||!g.allMeaningful||g.initialDistance<T*2)continue;
   const short=searchLegEndpoints(p.paints,w.start,t.target,2,seed+pi*997+ti*71+k,16,2),margin=Math.min(...short.best.map(e=>e.error/T));
   if(margin<=1.08)continue;
   candidates.push({...r,margin,distanceT:g.initialDistance/T,traits:g.traits});
  }
  const best=candidates.sort((a,b)=>Math.min(b.margin,3)-Math.min(a.margin,3)||b.distanceT-a.distanceT)[0];
  if(best){palettePremix.push(best);premix.push(best);}
 }
 free.push(...paletteFree.map(r=>({...r,palette:pi})));
 board.push({palette:pi,name:p.name,origin:p.origin,targets:targets.length,freeNontrivial:paletteFree.filter(r=>r.minimum>=2&&r.farT>1.4).length,freeThreeCandidates:paletteFree.filter(r=>r.minimum===3).length,premixCandidates:palettePremix.length,zones:palettePremix.map(r=>r.zone),freeTargets:paletteFree.map(r=>({id:r.id,zone:r.zone,minimum:r.minimum,farT:r.farT})),premixTargets:palettePremix.map(r=>({id:r.id,zone:r.zone,margin:r.margin}))});
 save('raw-'+pi,raw);save('board',board);save('free',free);save('premix',premix);
 console.log(JSON.stringify({palette:p.name,done:pi+1,targets:targets.length,free:board.at(-1).freeNontrivial,premix:palettePremix.length}));
}
// Contrast target zones and palettes; audit up to two nominations per palette.
const audited:any[]=[];
for(const [pi,p] of roster.entries()){
 const rows=premix.filter(r=>r.palette===pi).sort((a,b)=>b.margin-a.margin).slice(0,2);
 for(const r of rows){const a=auditLegPuzzle({...r,paints:p.paints},seed+700001+audited.length*997,{samples:192,restarts:12,maxMeasured:36,maxLegs:3,fresh:true});const {search,fresh,...compact}=a;
  const result={...compact,branch:branchEvidence(a)};save('audit-'+audited.length,result);audited.push({id:r.id,index:audited.length,palette:pi,minimum:a.summary.rawMinimum,supported:a.summary.robustMinimum,first:result.branch.firstPaints.length,zone:r.zone,target:r.target.lab});
  console.log(JSON.stringify({phase:'audit',done:audited.length,name:p.name,minimum:a.summary.rawMinimum,first:result.branch.firstPaints.length}));
 }
}
save('audits',audited);console.log(JSON.stringify({done:true,palettes:roster.length,premixNominations:premix.length,audits:audited.length}));
