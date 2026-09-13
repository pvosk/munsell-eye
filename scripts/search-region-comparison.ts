// Fresh, paired search. Research only: no generated game bank is overwritten.
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay,type PigmentLeg} from '../app/play-pigment-legs';
import {rng} from './premix-hybrid';
import {sampleRecipe} from './pigment-leg-proposals';
import {expandSetupRegions} from './setup-region-atlas';
import {inverseChain,branchEvidence} from './branching-regions';
import {legGeometry,measureLegRegion} from './pigment-leg-metrics';
import {searchLegEndpoints} from './pigment-leg-search';
import {auditLegPuzzle} from './pigment-leg-audit';
import {destinationRecipe,type DestinationSpec} from './conditioned-branches';

const seed=Number(process.env.REGION_SEED??731993),count=Number(process.env.REGION_PALETTES??256),cap=64;
const targetPolicy=process.env.REGION_TARGETS??'relative';
if(!['relative','conditioned'].includes(targetPolicy))throw Error('Unknown target policy');
const out=process.env.REGION_OUTPUT??'docs/branching-region-comparison-1';
if(existsSync(out))throw Error('Use a fresh archive directory');mkdirSync(out,{recursive:true});
const begin=Date.now(),random=rng(seed),key=(p:PaintColor[])=>JSON.stringify(p.map(x=>[x.id,x.rgb,x.strength]).sort());
const catalog=[...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].filter((p,i,a)=>a.findIndex(q=>key([p])===key([q]))===i);
const palettes:{name:string;track:string;paints:PaintColor[]}[]=[],seen=new Set<string>();
const add=(name:string,paints:PaintColor[],track:string)=>{const k=key(paints);if(paints.length>=3&&paints.length<=6&&!seen.has(k)){seen.add(k);palettes.push({name,paints,track});}};
for(const name of ['UltraOx Dual','Zorny','RYB','CMY','Secondaries','Cobalt Ember','Orange Echo','Crimson Current','Sienna Field','Maroon Arc','Maroon Drift','Teal Ember']){const p=PLAY_LEVELS.find(p=>p.name===name);if(p)add(name,p.paints,'familiar');}
const known=palettes.length;
// Balance total paint-count strata, including familiar palettes.
while(palettes.length<count){const sizes=[3,4,5,6],n=sizes.sort((a,b)=>palettes.filter(p=>p.paints.length===a).length-palettes.filter(p=>p.paints.length===b).length)[0];const paints:PaintColor[]=[];while(paints.length<n){const p=catalog[Math.floor(random()*catalog.length)];if(!paints.some(q=>q.id===p.id))paints.push(p);}add('Fresh palette '+palettes.length,paints,'novel');}
const requests=['light','dark','vivid','middle'] as const;
const specs:DestinationSpec[]=[{id:'light',value:[.72,.90],chroma:[.035,.13],style:'rise'},{id:'dark',value:[.27,.44],chroma:[.025,.10],style:'drop'},{id:'vivid',value:[.50,.82],chroma:[.12,.24],style:'chromatic-ride'},{id:'middle',value:[.46,.68],chroma:[.035,.14],style:'coupled-balance'}];
const manifest={seed,count,cap,targetPolicy,specs,catalogSize:catalog.length,palettes,requests,known,tolerance:T,
 policy:'Same palettes, targets, accepted landing seeds, retained proposal cap and downstream budgets. Region expansion has extra internal work, reported separately; this is not an equal-CPU experiment. Chains use distinct pigments; region paths may revisit a pigment after another leg. No style enters shortcut validation.',
 physics:createHash('sha256').update(['app/pigment-color.ts','app/play-pigment-legs.ts','scripts/setup-region-atlas.ts','scripts/pigment-leg-search.ts','scripts/pigment-leg-metrics.ts','scripts/search-region-comparison.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex')};
writeFileSync(out+'/manifest.json',JSON.stringify(manifest));
type Candidate={id:string;palette:number;method:string;request:string;start:number[];targetRecipe:number[];demonstration:PigmentLeg[];depth:number;oneT:number;distanceT:number;meaningful:boolean;traits:Record<string,boolean>};
const queries:any[]=[],screens:any[]=[],audits:any[]=[];
for(const [pi,palette] of palettes.entries()){
 const paints=palette.paints,n=paints.length,depth=Math.min(4,n-1),r=rng(seed+pi*8191);
 const pool=Array.from({length:96},()=>{const recipe=sampleRecipe(n,r),target=mixtureColor(paints,recipe);return{recipe,target,chroma:Math.hypot(target.lab[1],target.lab[2])};});
 const usedTargets=new Set<string>(),bank:Candidate[]=[];
 for(const [qi,request] of requests.entries()){
  // Palette-relative extremes provide coverage without silently pretending a
  // muted palette reached an absolute vivid target specification.
  const score=(x:typeof pool[number])=>request==='light'?x.target.lab[0]:request==='dark'?-x.target.lab[0]:request==='vivid'?x.chroma:-Math.abs(x.target.lab[0]-.57)+.2*x.chroma;
  let endpoint=[...pool].sort((a,b)=>score(b)-score(a)).find(x=>!usedTargets.has(x.recipe.join()))!;
  if(targetPolicy==='conditioned'){
   const d=destinationRecipe(paints,specs[qi],seed+pi*1093+qi*103);
   if(!d.eligible){queries.push({palette:pi,request,unavailable:true,error:d.error,regionRetained:0,chainRetained:0,regionStats:{seconds:0},chainSeconds:0});continue;}
   endpoint={recipe:d.recipe,target:d.target,chroma:Math.hypot(d.target.lab[1],d.target.lab[2])};
  }
  usedTargets.add(endpoint.recipe.join());
  const qseed=seed+pi*1093+qi*103,graph=expandSetupRegions(paints,endpoint.target,endpoint.recipe,{seed:qseed,depth,cap,tolerance:T});
  const roots=graph.nodes.filter(x=>x.parent===null).map(x=>x.recipe),chainsRandom=rng(qseed+500003);
  const region=graph.nodes.filter(x=>x.stage===depth).map(node=>{const legs:PigmentLeg[]=[];let at=node;while(at.parent!==null){legs.push({paint:at.paint!,share:at.share});at=graph.nodes[at.parent];}return{start:node.recipe,legs};});
  const chainBegin=Date.now(),chains=Array.from({length:cap},(_,i)=>inverseChain(roots[i%roots.length],depth,chainsRandom)).filter(x=>x!==null);
  const chainSeconds=(Date.now()-chainBegin)/1000;
  queries.push({palette:pi,request,seed:qseed,targetRecipe:endpoint.recipe,target: endpoint.target.lab,regionStats:graph.stats,chainSeconds,regionRetained:region.length,chainRetained:chains.length});
  for(const [method,pool] of [['region',region],['chain',chains]] as const){
   const arm:Candidate[]=[];
   for(const [i,w] of pool.entries()){
    if(colorDistance(mixtureColor(paints,legReplay(w.start,w.legs)),endpoint.target)>T+1e-9)throw Error('Invalid witness');
    const g=legGeometry(paints,w.start,endpoint.target,w.legs,24);let one=Infinity;
    for(let paint=0;paint<n;paint++)for(let k=0;k<=24;k++){const share=k/24,q=w.start.map((v,j)=>v*(1-share)+(j===paint?share:0));one=Math.min(one,colorDistance(mixtureColor(paints,q),endpoint.target)/T);}
    arm.push({id:`region-compare-${seed}-${pi}-${qi}-${method}-${i}`,palette:pi,method,request,start:w.start,targetRecipe:endpoint.recipe,demonstration:w.legs,depth,oneT:one,distanceT:g.initialDistance/T,meaningful:g.allMeaningful,traits:g.traits});
   }
   bank.push(...arm);
   // Preserve every raw proposal. One nominee per method/query keeps the
   // expensive competing-route budget matched, rather than favoring graph size.
   const candidate=arm.filter(p=>p.meaningful&&p.distanceT>1&&p.oneT>=1.25).sort((a,b)=>Math.min(b.oneT,6)+.12*Math.min(b.distanceT,15)-Math.min(a.oneT,6)-.12*Math.min(a.distanceT,15))[0];
   if(candidate){const start=Date.now(),s=searchLegEndpoints(paints,candidate.start,endpoint.target,depth-1,qseed+700001,24,3),support=measureLegRegion(paints,candidate.start,endpoint.target,candidate.demonstration,3);
    screens.push({p:candidate,bestByDepth:s.best.map(e=>e.error/T),margin:Math.min(...s.best.map(e=>e.error/T)),supported:support.supported,seconds:(Date.now()-start)/1000,evaluations:s.evaluations});}
  }
 }
 writeFileSync(`${out}/proposals-${pi}.json`,JSON.stringify(bank));
 if(pi%16===0||pi===palettes.length-1){writeFileSync(out+'/screens.json',JSON.stringify(screens));writeFileSync(out+'/queries.json',JSON.stringify(queries));console.log(JSON.stringify({phase:'screen',palettes:pi+1,screens:screens.length,seconds:(Date.now()-begin)/1000}));}
}
// Stratify audit slots by pigment count and target type. Same max slots per arm;
// absent eligible cells remain absent, not backfilled with convenient winners.
for(const method of ['region','chain'])for(const n of [3,4,5,6])for(const request of requests){
 const rows=screens.filter(s=>s.p.method===method&&palettes[s.p.palette].paints.length===n&&s.p.request===request&&s.supported).sort((a,b)=>b.margin-a.margin||b.p.distanceT-a.p.distanceT);
 const s=rows[0];if(!s)continue;const p=s.p,palette=palettes[p.palette],puzzle={...p,paints:palette.paints,target:mixtureColor(palette.paints,p.targetRecipe)};
 const result=auditLegPuzzle(puzzle,seed+audits.length*997+910001,{samples:192,restarts:12,maxMeasured:32,maxLegs:p.depth,fresh:true}),{search,fresh,...a}=result;
 const fine=a.measured.map(m=>({legs:m.legs,traits:legGeometry(puzzle.paints,puzzle.start,puzzle.target,m.legs,192).traits,supported:m.supported,allMeaningful:m.allMeaningful}));
 audits.push({...a,branch:branchEvidence(result),fine,screen:s});writeFileSync(`${out}/audit-${audits.length-1}.json`,JSON.stringify(audits.at(-1)));
 console.log(JSON.stringify({phase:'audit',done:audits.length,method,n,request,minimum:a.summary.rawMinimum,supportedMinimum:a.summary.robustMinimum,seconds:(Date.now()-begin)/1000}));
}
const groups=['region','chain'].flatMap(method=>[3,4,5,6].map(n=>{const s=screens.filter(s=>s.p.method===method&&palettes[s.p.palette].paints.length===n),a=audits.filter(a=>a.p.method===method&&a.p.paints.length===n);return{method,n,screened:s.length,screenSupported:s.filter(s=>s.supported).length,screenResistant:s.filter(s=>s.supported&&s.margin>1).length,audited:a.length,rawMinimumCounts:Object.fromEntries([1,2,3,4].map(d=>[d,a.filter(a=>a.summary.rawMinimum===d).length])),supportedBranches:a.filter(a=>a.branch.firstPaints.length>=2&&!a.branch.shorterRawEscape).length};}));
const summary={seed,targetPolicy,seconds:(Date.now()-begin)/1000,palettes:palettes.length,queries:queries.length,unavailable:queries.filter(q=>q.unavailable).length,proposals:queries.reduce((s,q)=>s+q.regionRetained+q.chainRetained,0),screened:screens.length,audited:audits.length,groups,
 budget:{regionExpansionSeconds:queries.reduce((s,q)=>s+q.regionStats.seconds,0),chainGenerationSeconds:queries.reduce((s,q)=>s+q.chainSeconds,0),screenSeconds:screens.reduce((s,r)=>s+r.seconds,0),screenEvaluations:screens.reduce((s,r)=>s+r.evaluations,0)},
 finalists:audits.map(a=>({id:a.p.id,method:a.p.method,palette:a.p.palette,request:a.p.request,rawMinimum:a.summary.rawMinimum,regionMinimum:a.summary.robustMinimum,branches:a.branch.firstPaints.length,shorterMargin:a.summary.rawMinimum>1?Math.min(...a.bestByDepth.slice(0,a.summary.rawMinimum-1)):null,styleEvidence:a.summary.styles,screenDisagreement:a.screen.margin>1&&a.summary.rawMinimum<a.p.depth})),
 limitations:['Finite sampled witnesses, not a solved continuous inverse region.','Matching retained proposal and audit caps is not equal computational cost.','Top-per-cell selection is not random population estimation.','Relative target bins do not certify finishing style.','Higher leg count or branch count is not proof of enjoyment.','Separate research bank; nothing here silently replaces the playable lab.']};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({phase:'done',...summary,finalists:summary.finalists.length}));
