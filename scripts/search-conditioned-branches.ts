import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {rng} from './premix-hybrid';
import {inverseChain,branchEvidence} from './branching-regions';
import {destinationRecipe,destinationViolation,targetCloud,refineConditioned,recoveryProfile,type DestinationSpec,type ConditionedPuzzle} from './conditioned-branches';
import {legGeometry,measureLegRegion} from './pigment-leg-metrics';
import {styleScore,sampleRecipe} from './pigment-leg-proposals';
import {searchLegEndpoints,optimizeSimplex} from './pigment-leg-search';
import {auditLegPuzzle} from './pigment-leg-audit';
import {routeContributions,contributionLegs} from '../app/play-pigment-legs';
import lab from '../app/generated/play-branch-lab.json';
const seed=Number(process.env.CONDITION_SEED??929831),out=process.env.CONDITION_OUTPUT??'docs/conditioned-branch-search-1';
if(existsSync(out))throw Error('Archive exists');mkdirSync(out,{recursive:true});
const config={palettes:Number(process.env.CONDITION_PALETTES??1024),starts:8,auditsPerGroup:Number(process.env.CONDITION_AUDITS??5),refine:Number(process.env.CONDITION_REFINE??12),interior:process.env.CONDITION_INTERIOR==='1'};
const specs:DestinationSpec[]=[
 {id:'light-rise',value:[.72,.90],chroma:[.035,.13],style:'rise'},
 {id:'dark-drop',value:[.27,.44],chroma:[.025,.10],style:'drop'},
 {id:'mid-balance',value:[.46,.68],chroma:[.035,.14],style:'coupled-balance'},
 {id:'vivid-ride',value:[.50,.82],chroma:[.12,.24],style:'chromatic-ride'},
 ...[0,1,3].map((i)=>({id:'fixed-'+['hansa','earth','unused','ryb'][i],rgb:lab.holes[i].targetRGB,value:[0,1] as [number,number],chroma:[0,.5] as [number,number],style:(i===1?'coupled-balance':'rise') as DestinationSpec['style']}))
];
const random=rng(seed),fingerprint=(p:PaintColor[])=>JSON.stringify(p.map(x=>[x.id,x.rgb,x.strength]).sort()),catalog=[...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].filter((p,i,a)=>a.findIndex(q=>fingerprint([p])===fingerprint([q]))===i);
const palettes:{name:string;paints:PaintColor[]}[]=[],seen=new Set<string>();
const add=(name:string,paints:PaintColor[])=>{if(![4,5].includes(paints.length))return;const k=fingerprint(paints);if(!seen.has(k)){seen.add(k);palettes.push({name,paints});}};
for(const name of ['Zorny','Secondaries','RYB','Cobalt Ember','Hansa · Scarlet · Violet','Earth Orange · Cobalt Green','Emerald · Yellow · Scarlet']){const p=PLAY_LEVELS.find(p=>p.name===name);if(p)add(p.name,p.paints);}
while(palettes.length<config.palettes){const n=4+palettes.length%2,paints:PaintColor[]=[];while(paints.length<n){const p=catalog[Math.floor(random()*catalog.length)];if(!paints.some(q=>q.id===p.id))paints.push(p);}add('Conditioned palette '+palettes.length,paints);}
type Candidate=ConditionedPuzzle&{depth:number;paletteIndex:number;oneT:number;distanceT:number;shape:number;geometry:ReturnType<typeof legGeometry>};
const bank:Candidate[]=[],unavailable:any[]=[],screens:any[]=[],audits:any[]=[],refinements:any[]=[],begin=Date.now();
writeFileSync(out+'/manifest.json',JSON.stringify({seed,config,specs,palettes,catalogSize:catalog.length,policy:'Four/five-paint n−1 proposal depth. Fixed targets remain exact; range targets use reachable palette recipes. Refined labels do not enter the independent shortcut solvers.'}));
for(const [pi,palette] of palettes.entries()){
 for(const [gi,spec] of specs.entries()){
  const destination=destinationRecipe(palette.paints,spec,seed+pi*1093+gi*103);
  if(!destination.eligible){unavailable.push({palette:pi,spec:spec.id,error:destination.error});continue;}
  const cloud=targetCloud(palette.paints,destination.target,destination.recipe,rng(seed+pi*1013+gi*137));
  const poolRandom=rng(seed+pi*8093+gi*313),pool=config.interior?Array.from({length:256},()=>sampleRecipe(palette.paints.length,poolRandom)):[];
  const acceptedPool=spec.rgb?[]:pool.filter(q=>destinationViolation(mixtureColor(palette.paints,q),spec)<1e-8);
  if(config.interior&&spec.rgb){
   const score=(q:number[])=>Math.max(0,colorDistance(mixtureColor(palette.paints,q),destination.target)/T-.65)**2-.15*Math.min(...q);
   for(const q of [destination.recipe,...pool.slice(0,7)]){const r=optimizeSimplex(score,q,100);if(colorDistance(mixtureColor(palette.paints,r.weights),destination.target)<T*.9)acceptedPool.push(r.weights);}
  }
  for(let si=0;si<config.starts;si++){
   const endpoint=acceptedPool.length?acceptedPool[si%acceptedPool.length]:cloud[si%cloud.length],depth=palette.paints.length-1,chain=inverseChain(endpoint,depth,rng(seed+pi*1907+gi*271+si*37));if(!chain)continue;
   const target=config.interior&&!spec.rgb?mixtureColor(palette.paints,endpoint):destination.target,start=chain.start,paints=palette.paints;let one=Infinity;
   for(let paint=0;paint<paints.length;paint++)for(let k=0;k<=20;k++){const q=start.map((v,j)=>v*(1-k/20)+(j===paint?k/20:0));one=Math.min(one,colorDistance(mixtureColor(paints,q),target));}
   const geometry=legGeometry(paints,start,target,chain.legs,24);
   bank.push({id:`condition-${seed}-${pi}-${gi}-${si}`,paints,paletteIndex:pi,paletteName:palette.name,start,target,targetRecipe:config.interior?endpoint:destination.recipe,spec,demonstration:chain.legs,depth,oneT:one/T,distanceT:geometry.initialDistance/T,shape:styleScore(geometry,spec.style),geometry});
  }
 }
 if(pi%128===0)console.log(JSON.stringify({phase:'proposals',palettes:pi+1,proposals:bank.length,seconds:(Date.now()-begin)/1000}));
}
// Retain all proposals compactly with palette references; no survivor-only bank.
writeFileSync(out+'/proposals.json',JSON.stringify(bank.map(({paints,geometry,...p})=>({...p,geometry:{traits:geometry.traits,finish:geometry.finish,setup:geometry.setup,allMeaningful:geometry.allMeaningful}}))));
writeFileSync(out+'/unavailable.json',JSON.stringify(unavailable));
for(const [pi] of palettes.entries()){
 const candidates=specs.flatMap(s=>bank.filter(p=>p.paletteIndex===pi&&p.spec.id===s.id&&p.distanceT>1&&p.oneT>=1.25&&p.geometry.allMeaningful).sort((a,b)=>(b.oneT+.25*b.shape)-(a.oneT+.25*a.shape)).slice(0,1));
 // At most four targeted candidates per palette; priority rotates target bins.
 candidates.sort((a,b)=>((specs.findIndex(s=>s.id===a.spec.id)+pi)%specs.length)-((specs.findIndex(s=>s.id===b.spec.id)+pi)%specs.length));
 for(const p of candidates.slice(0,4)){
  const search=searchLegEndpoints(p.paints,p.start,p.target,p.depth-1,seed+pi*151,24,3),margin=Math.min(...search.best.map(e=>e.error/T));
  const region=measureLegRegion(p.paints,p.start,p.target,p.demonstration,3);
  screens.push({p,margin,regionSupported:region.supported,finishWidth:region.finishWidth,bestByDepth:search.best.map(e=>e.error/T)});
 }
 if(pi%128===0)console.log(JSON.stringify({phase:'screen',palettes:pi+1,screened:screens.length,seconds:(Date.now()-begin)/1000}));
}
writeFileSync(out+'/screens.json',JSON.stringify(screens));
for(const n of [4,5])for(const spec of specs){
 const group=screens.filter(r=>r.p.paints.length===n&&r.p.spec.id===spec.id&&r.regionSupported).sort((a,b)=>b.margin-a.margin||b.p.shape-a.p.shape).slice(0,config.auditsPerGroup);
 for(const row of group){const a=auditLegPuzzle(row.p,seed+audits.length*197,{samples:160,restarts:10,maxMeasured:64,maxLegs:row.p.depth,fresh:true}),{search,fresh,...compact}=a;
  audits.push({...compact,branch:branchEvidence(a),n,requested:spec.id});writeFileSync(out+'/audits.json',JSON.stringify(audits));
  console.log(JSON.stringify({phase:'audit',done:audits.length,n,spec:spec.id,minimum:a.summary.rawMinimum,seconds:(Date.now()-begin)/1000}));
 }
}
// Include higher-depth attempts even if they collapsed, and reserve different
// requested destinations. Fixed/joint arms share the same parent and routes.
const selected:any[]=[],used=new Set<string>();
for(const spec of specs)for(const n of [5,4]){
 const candidates=audits.filter(a=>a.n===n&&a.requested===spec.id).sort((a,b)=>Math.min(...b.bestByDepth.slice(0,n-2))-Math.min(...a.bestByDepth.slice(0,n-2)));
 const a=candidates.find(a=>!used.has(a.p.id));if(a){selected.push(a);used.add(a.p.id);}
 if(selected.length>=config.refine)break;
}
for(const [i,a] of selected.slice(0,config.refine).entries()){
 const p=a.p as Candidate,contributions=routeContributions(p.start,p.demonstration),reverse=contributionLegs(contributions.paints,contributions.weights,[...contributions.paints].reverse());
 const routes=[p.demonstration,reverse];
 for(const mode of (p.spec.rgb?['fixed-target']:['fixed-target','joint']) as ('fixed-target'|'joint')[]){
  const r=refineConditioned(p,routes,mode,seed+77191+i*167),next={...p,id:p.id+'/'+mode,start:r.start,target:r.target,targetRecipe:r.targetRecipe,demonstration:r.routes[0]};
  const checked=auditLegPuzzle(next,seed+97193+i*113,{samples:256,restarts:12,maxMeasured:96,maxLegs:p.depth,fresh:true}),{search,fresh,...compact}=checked;
  const witnesses=r.routes.map(route=>({...measureLegRegion(p.paints,r.start,r.target,route),fine:legGeometry(p.paints,r.start,r.target,route,192)}));
  const recovery=recoveryProfile(next,r.routes,seed+117191+i*191);
  refinements.push({parent:p.id,mode,history:r.history,witnesses,audit:compact,branch:branchEvidence(checked),recovery});writeFileSync(out+'/refinements.json',JSON.stringify(refinements));
  console.log(JSON.stringify({phase:'refinement',done:refinements.length,n:p.paints.length,spec:p.spec.id,mode,min:checked.summary.rawMinimum,seconds:(Date.now()-begin)/1000}));
 }
}
const groups=[4,5].flatMap(n=>specs.map(s=>{const a=audits.filter(a=>a.n===n&&a.requested===s.id);return{n,spec:s.id,audited:a.length,minNMinusOne:a.filter(a=>a.summary.rawMinimum===n-1).length,regionNMinusOne:a.filter(a=>a.summary.rawMinimum===n-1&&a.summary.robustMinimum===n-1).length,styleEfficient:a.filter(a=>a.summary.styles[s.style].matches>0).length};}));
const summary={seed,config,seconds:(Date.now()-begin)/1000,proposals:bank.length,unavailable:unavailable.length,screened:screens.length,audited:audits.length,refinements:refinements.length,groups,sourceHash:createHash('sha256').update(['scripts/conditioned-branches.ts','scripts/search-conditioned-branches.ts','scripts/pigment-leg-search.ts','scripts/pigment-leg-metrics.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex'),limitations:['Finite candidate and region sampling; not exhaustive','n−1 is proposal depth, not automatic minimum','Recipe-level four-leg witnesses may have color-equivalent three-leg shortcuts','Recovery depth capped at three; missing recovery is not a dead end proof','Recovery is measured, not optimized or player-calibrated','No control, tolerance, pigment strength or live lab changes']};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
