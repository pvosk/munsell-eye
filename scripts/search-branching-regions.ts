import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {rng} from './premix-hybrid';
import {sampleRecipe,proposalScreen} from './pigment-leg-proposals';
import {acceptedRecipeCloud,inverseChain,branchEvidence,witnessRegion} from './branching-regions';
import {searchLegEndpoints} from './pigment-leg-search';
import {auditLegPuzzle,type LegPuzzle} from './pigment-leg-audit';
const seed=Number(process.env.BRANCH_SEED??713903),out=process.env.BRANCH_OUTPUT??'docs/branching-region-search-1';
if(existsSync(out))throw Error('Archive exists');mkdirSync(out,{recursive:true});
const config={palettes:Number(process.env.BRANCH_PALETTES??96),targets:8,starts:4,auditsPerArm:Number(process.env.BRANCH_AUDITS??12)};
const random=rng(seed),key=(p:PaintColor[])=>JSON.stringify(p.map(x=>[x.id,x.rgb,x.strength]).sort());
const catalog=[...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].filter((p,i,a)=>a.findIndex(x=>key([x])===key([p]))===i);
const palettes:{name:string;paints:PaintColor[]}[]=[],seen=new Set<string>();
const add=(name:string,paints:PaintColor[])=>{const k=key(paints);if(!seen.has(k)){seen.add(k);palettes.push({name,paints});}};
for(const name of ['Zorny','Secondaries','Cobalt Ember','RYB','UltraOx Dual']){const p=PLAY_LEVELS.find(p=>p.name===name);if(p)add(p.name,p.paints);}
while(palettes.length<config.palettes){const n=3+palettes.length%4,paints:PaintColor[]=[];while(paints.length<n){const p=catalog[Math.floor(random()*catalog.length)];if(!paints.some(x=>x.id===p.id))paints.push(p);}add('Branch candidate '+palettes.length,paints);}
type Candidate=LegPuzzle&{arm:string;paletteName:string;targetRecipe:number[];endpointRecipe:number[];screen:number;eligible:boolean;depth:number};
const bank:Candidate[]=[],screened:{p:Candidate;margin:number;witness:ReturnType<typeof witnessRegion>}[]=[],audits:unknown[]=[];
const begin=Date.now();
writeFileSync(out+'/manifest.json',JSON.stringify({seed,config,palettes,policy:'Matched target centers/palettes/budgets; new starts derived backward. Region endpoints and center endpoints compared. No labels used in independent shortcut search. No gameplay changes.'}));
for(const [pi,palette] of palettes.entries()){
 for(let ti=0;ti<config.targets;ti++){
  const center=sampleRecipe(palette.paints.length,rng(seed+pi*1009+ti*73)),cloud=acceptedRecipeCloud(palette.paints,center,rng(seed+pi*9013+ti*179));
  for(const arm of ['center','region'])for(let si=0;si<config.starts;si++){
   const endpoint=arm==='center'?center:cloud[1+si%(cloud.length-1)],depth=Math.min(3,palette.paints.length),chain=inverseChain(endpoint,depth,rng(seed+pi*317+ti*103+si*37));if(!chain)continue;
   const p={id:`branch-${seed}-${pi}-${ti}-${si}-${arm}`,paints:palette.paints,start:chain.start,target:mixtureColor(palette.paints,center),demonstration:chain.legs,targetRecipe:center,endpointRecipe:endpoint,arm,paletteName:palette.name,depth};
   const screen=proposalScreen({...p,method:'route-first',intent:null,sourceSeed:seed});bank.push({...p,...screen});
  }
 }
 if(pi%24===0)console.log(JSON.stringify({phase:'proposal',palettes:pi+1,seconds:(Date.now()-begin)/1000}));
}
// Blind shortlist per palette/arm, then genuine two-leg endpoint attacks.
for(const palette of palettes)for(const arm of ['center','region']){
 const top=bank.filter(p=>p.paletteName===palette.name&&p.arm===arm&&p.eligible).sort((a,b)=>b.screen-a.screen).slice(0,2);
 for(const p of top){const check=searchLegEndpoints(p.paints,p.start,p.target,2,seed+1987,24,3),margin=Math.min(...check.best.map(x=>x.error/T)),witness=witnessRegion(p.paints,p.start,p.target,p.demonstration);screened.push({p,margin,witness});}
}
writeFileSync(out+'/proposals.json',JSON.stringify(bank));writeFileSync(out+'/screened.json',JSON.stringify(screened));
console.log(JSON.stringify({phase:'screened',proposals:bank.length,screened:screened.length,seconds:(Date.now()-begin)/1000}));
for(const arm of ['center','region']){
 const used=new Set<string>(),eligible=screened.filter(x=>x.p.arm===arm&&x.witness.supported&&x.witness.meaningful).sort((a,b)=>b.margin-a.margin);let count=0;
 for(const row of eligible){if(used.has(row.p.paletteName))continue;used.add(row.p.paletteName);
  const a=auditLegPuzzle(row.p,seed+31019+count,{samples:128,restarts:8,maxMeasured:48,maxLegs:3,fresh:true}),branch=branchEvidence(a);
  // Keep all replayable counterexamples, but omit duplicated heavy solver traces.
  const {search,fresh,...compact}=a;audits.push({...compact,branch,arm,solver:{evaluations:a.evaluations,seed:search.seed,samples:search.samples,restarts:search.restarts,freshVersion:fresh?.version}});
  writeFileSync(out+'/audits.json',JSON.stringify(audits));console.log(JSON.stringify({phase:'audit',arm,done:++count,minimum:branch.rawMinimum,firstPaints:branch.firstPaints.length,seconds:(Date.now()-begin)/1000}));if(count>=config.auditsPerArm)break;
 }
}
const rows=audits as {arm:string;branch:ReturnType<typeof branchEvidence>;p:Candidate}[];
const summary={seed,config,seconds:(Date.now()-begin)/1000,proposals:bank.length,screened:screened.length,
 groups:['center','region'].map(arm=>{const r=rows.filter(x=>x.arm===arm);return{arm,audited:r.length,threeLeg:r.filter(x=>x.branch.rawMinimum===3).length,multipleFirstPaints:r.filter(x=>x.branch.firstPaints.length>1&&!x.branch.shorterRawEscape).length,cases:r.map(x=>({id:x.p.id,palette:x.p.paletteName,...x.branch,pairs:undefined}))};}),
 sourceHash:createHash('sha256').update(['scripts/branching-regions.ts','scripts/search-branching-regions.ts','scripts/pigment-leg-search.ts','scripts/pigment-leg-metrics.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex'),
 limitations:['Finite sampling of landing inverse image, not full-region optimization','Selection is not a randomized player experiment','Branches are supported alternative pigment routes, not mandatory checkpoints','Same-order contribution permutations may yield branches without distinct perceived decisions','Local region coverage is not player success probability','New palette samples do not exhaust pigment combinations','No par, pigment strength, timing or live lab changes']};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
