import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor} from '../app/play-engine';
import {rng} from './premix-hybrid';
import {proposePaletteFirst,proposeRouteFirst,proposalScreen,refineLegProposal,type Proposal} from './pigment-leg-proposals';
import {legGeometry,type LegStyle} from './pigment-leg-metrics';
import {searchLegEndpoints} from './pigment-leg-search';
import {auditLegPuzzle} from './pigment-leg-audit';
const seed=Number(process.env.LEG_SEARCH_SEED??113291),output=process.env.LEG_SEARCH_OUTPUT??'docs/pigment-leg-search-1';
if(existsSync(output))throw Error('Archive already exists');mkdirSync(output,{recursive:true});
const config={palettes:Number(process.env.LEG_PALETTES??512),slots:20,auditPerDepth:Number(process.env.LEG_AUDITS_PER_DEPTH??16),refinePerMethod:6};
const random=rng(seed),fingerprint=(paints:PaintColor[])=>JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
const catalog=[...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].filter((p,i,a)=>a.findIndex(q=>fingerprint([p])===fingerprint([q]))===i);
const palettes:{name:string;paints:PaintColor[];source:string}[]=[],seen=new Set<string>();
const add=(name:string,paints:PaintColor[],source:string)=>{const key=fingerprint(paints);if(!seen.has(key)){seen.add(key);palettes.push({name,paints,source});}};
for(const p of PLAY_LEVELS)if(!p.retired&&p.paints.length<=6)add(p.name,p.paints,'established');
while(palettes.length<config.palettes){const n=[3,4,5,6][palettes.length%4],paints:PaintColor[]=[];while(paints.length<n){const p=catalog[Math.floor(random()*catalog.length)];if(!paints.some(q=>q.id===p.id))paints.push(p);}add('Unpromoted '+palettes.length,paints,'catalog-combination');}
palettes.splice(config.palettes);
const methods=['palette-first','route-first'] as const;
const intents:LegStyle[]=['rise','chromatic-ride','coupled-balance','interior-assembly','setup-glide'];
const bank:(Proposal&{geometry:ReturnType<typeof legGeometry>;screenEvidence:ReturnType<typeof proposalScreen>})[]=[],screened:any[]=[],audits:any[]=[],refinements:any[]=[];
const begin=Date.now();const stats={proposalSlots:{'palette-first':0,'route-first':0},internalTrials:{'palette-first':0,'route-first':0},proposalMs:{'palette-first':0,'route-first':0},screenEvaluations:0,auditEvaluations:0,refinementEvaluations:0};
writeFileSync(output+'/manifest.json',JSON.stringify({seed,config,catalog,palettes,policy:'Same palette pool and number of emitted candidate slots. Route-first tries extra finishing options; not equal CPU cost. No style label enters shortcut validation.'}));
for(const [pi,palette] of palettes.entries()){
 for(let slot=0;slot<config.slots;slot++)for(const method of methods){
  const before=Date.now(),r=rng(seed+pi*100003+slot*313+(method==='route-first'?17019:0)),depth=Math.min(palette.paints.length-1,2+slot%3);
  const intent=intents[slot%intents.length]==='rise'&&slot>=10?'drop':intents[slot%intents.length];
  const generated=method==='palette-first'?proposePaletteFirst(palette.paints,depth,r):proposeRouteFirst(palette.paints,depth,intent,r);
  const base={id:`leg-${seed}-${pi}-${slot}-${method}`,paints:palette.paints,start:generated.start,targetRecipe:generated.targetRecipe,target:mixtureColor(palette.paints,generated.targetRecipe),demonstration:generated.legs,
   method,intent:method==='route-first'?intent:null,paletteName:palette.name,depth,sourceSeed:seed,provenance:{paletteSource:palette.source,paletteIndex:pi,slot}};
  const screenEvidence=proposalScreen(base),p={...base,...screenEvidence,screenEvidence,geometry:legGeometry(palette.paints,base.start,base.target,base.demonstration)};
  bank.push(p);stats.proposalSlots[method]++;stats.internalTrials[method]+=generated.internalTrials;stats.proposalMs[method]+=Date.now()-before;
 }
 if(pi%64===0)console.log(JSON.stringify({phase:'proposals',palettes:pi+1,total:config.palettes,seconds:(Date.now()-begin)/1000}));
}
writeFileSync(output+'/proposal-bank.json',JSON.stringify(bank));
// Stage 2: up to two candidates of each depth per palette/method receive a
// genuine shorter-leg endpoint challenge, rather than ranking three-leg holes
// solely by distance from one-leg curves.
for(const method of methods)for(const [pi] of palettes.entries())for(const depth of [2,3,4]){
 const group=bank.filter(p=>p.method===method&&(p.provenance as {paletteIndex:number}).paletteIndex===pi&&p.depth===depth&&p.eligible).sort((a,b)=>b.screen-a.screen).slice(0,2);
 for(const p of group){const check=searchLegEndpoints(p.paints,p.start,p.target,depth-1,seed+51791,12,2);stats.screenEvaluations+=check.evaluations;
  const margin=Math.min(...check.best.map(r=>r.error/.0294));screened.push({p,screenCheck:check,priority:Math.min(6,margin)+.05*Math.min(12,p.screenEvidence.distanceT)});}
}
writeFileSync(output+'/screened-bank.json',JSON.stringify(screened));
console.log(JSON.stringify({phase:'screened',cases:screened.length,seconds:(Date.now()-begin)/1000,evaluations:stats.screenEvaluations}));
const selected:any[]=[];
for(const method of methods)for(const depth of [2,3,4]){
 const used=new Map<string,number>(),bins=new Map<string,number>();let count=0;
 for(const r of screened.filter(r=>r.p.method===method&&r.p.depth===depth).sort((a,b)=>b.priority-a.priority)){
  const p=r.p,key=fingerprint(p.paints),bin=[Math.floor(p.target.lab[0]*4),Math.floor(Math.hypot(...p.target.lab.slice(1))/.06)].join(':');
  if((used.get(key)??0)>=2||(bins.get(bin)??0)>=5)continue;used.set(key,(used.get(key)??0)+1);bins.set(bin,(bins.get(bin)??0)+1);selected.push(r);if(++count>=config.auditPerDepth)break;
 }
}
for(const [i,r] of selected.entries()){
 const audit=auditLegPuzzle(r.p,seed+71791+i,{samples:160,restarts:10,maxMeasured:64,fresh:true});audits.push({...audit,origin:'selected-baseline',method:r.p.method,depth:r.p.depth,intent:r.p.intent});stats.auditEvaluations+=audit.evaluations;
 writeFileSync(output+'/audits.json',JSON.stringify(audits));if(i%8===0)console.log(JSON.stringify({phase:'audit',done:i+1,total:selected.length,seconds:(Date.now()-begin)/1000}));
}
for(const method of methods){
 const candidates=[3,4].flatMap(depth=>selected.filter(r=>r.p.method===method&&r.p.depth===depth).slice(0,config.refinePerMethod/2));
 for(const [i,r] of candidates.entries())for(const mode of ['start-only','target-only','joint'] as const){
  const refinement=refineLegProposal(r.p,mode,seed+91791+i);refinements.push(refinement);stats.refinementEvaluations+=refinement.evaluations;
  const audit=auditLegPuzzle(refinement.p,seed+117791+i,{samples:160,restarts:10,maxMeasured:64,fresh:true});audits.push({...audit,origin:'refined',refinementMode:mode,parent:r.p.id,method,depth:r.p.depth,intent:r.p.intent});stats.auditEvaluations+=audit.evaluations;
  writeFileSync(output+'/refinements.json',JSON.stringify(refinements));writeFileSync(output+'/audits.json',JSON.stringify(audits));
  console.log(JSON.stringify({phase:'refine-audit',method,mode,id:r.p.id,min:audit.summary.rawMinimum,robust:audit.summary.robustMinimum,seconds:(Date.now()-begin)/1000}));
 }
}
const profile=(group:any[])=>({n:group.length,rawMinima:group.reduce((a:Record<string,number>,r)=>{const k=String(r.summary.rawMinimum);a[k]=(a[k]??0)+1;return a;},{}),robustAtDepth:group.filter(r=>r.summary.rawMinimum>=r.depth&&r.summary.robustMinimum===r.depth&&!r.profile.nearOne&&!r.profile.tinyEfficientLeg).length,
 threeOrMore:group.filter(r=>r.summary.rawMinimum>=3&&r.summary.robustMinimum>=3).map(r=>r.p.id),
 intentAvailable:group.filter(r=>r.intent&&r.measured.some((m:any)=>m.traits[r.intent])).length,
 intentEfficient:group.filter(r=>r.intent&&r.summary.styles[r.intent].matches>0).length});
const sources=['app/play-pigment-legs.ts','scripts/pigment-leg-search.ts','scripts/pigment-leg-metrics.ts','scripts/pigment-leg-audit.ts','scripts/pigment-leg-proposals.ts','scripts/search-pigment-leg-methods.ts','app/play-engine.ts','app/paint-mixing.ts'];
const summary={seed,config,stats,seconds:(Date.now()-begin)/1000,sourceHash:createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex'),
 groups:methods.flatMap(method=>[2,3,4].map(depth=>({method,depth,...profile(audits.filter(r=>r.method===method&&r.depth===depth&&r.origin==='selected-baseline'))}))),
 refinements:methods.map(method=>({method,...profile(audits.filter(r=>r.method===method&&r.origin==='refined'))})),
 limitations:['Candidate counts are not exhaustive palette coverage','Equal output slots, unequal proposal compute','Local fraction regions are not player success probabilities','Style unopposed in tested routes is not mathematical necessity','Source labels never enter the endpoint challenger','All archives remain separate from live campaign and lab']};
writeFileSync(output+'/summary.json',JSON.stringify(summary));console.log(JSON.stringify(summary));
