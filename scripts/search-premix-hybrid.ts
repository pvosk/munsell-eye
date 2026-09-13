import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorPoint,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {normalizeRecipe,premixReplay,predecessor,holdForShare} from '../app/play-premix';
import {searchPremix} from './premix-search';
import {measureRegion,classifyAlternatives,FAMILIES} from './premix-region-metrics';
import {HYBRID_VERSION,POLICY,rng,oneShotField,closestOne,refinePuzzle,cleanupAttack,structuralVerdict,targetOf,type Puzzle} from './premix-hybrid';
import regression from '../app/generated/play-premix-regions.json';

const output=process.env.HYBRID_OUTPUT??'docs/premix-hybrid-1';
if(existsSync(output))throw Error('Immutable archive exists; select a new HYBRID_OUTPUT');
mkdirSync(output,{recursive:true});
const seed=Number(process.env.HYBRID_SEED??751291),random=rng(seed);
const config={palettes:Number(process.env.HYBRID_PALETTES??1024),starts:8,targetsPerStart:4,refine:Number(process.env.HYBRID_REFINE??96),rounds:8,validate:Number(process.env.HYBRID_VALIDATE??36)};
const stats={palettes:0,proposals:0,legal:0,screened:0,screenEndpoints:0,refined:0,paletteMutations:0,validationEndpoints:0};
const begin=Date.now(),fingerprint=(paints:PaintColor[])=>JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
const pigments=[...PAINTS,...PLAY_LEVELS.flatMap(l=>l.paints)].filter((p,i,a)=>a.findIndex(x=>fingerprint([p])===fingerprint([x]))===i);
const palettes:{name:string;paints:PaintColor[];source:string}[]=[],seen=new Set<string>();
function add(name:string,paints:PaintColor[],source:string){const key=fingerprint(paints);if(!seen.has(key)){seen.add(key);palettes.push({name,paints,source});}}
for(const p of PLAY_LEVELS)if(!p.retired)add(p.name,p.paints,'existing');
while(palettes.length<config.palettes){const n=[3,4,5,6][palettes.length%4],paints:PaintColor[]=[];while(paints.length<n){const p=pigments[Math.floor(random()*pigments.length)];if(!paints.some(q=>q.id===p.id))paints.push(p);}add('Hybrid '+palettes.length,paints,'novel');}
palettes.splice(config.palettes);
writeFileSync(output+'/manifest.json',JSON.stringify({version:HYBRID_VERSION,seed,config,policy:POLICY,tolerance:T,pigments,palettes}));
const recipe=(n:number)=>normalizeRecipe(Array.from({length:n},()=>Math.exp((random()-.5)*5)));
const candidates:(Puzzle&{screen:number;source:string})[]=[];
for(const [pi,palette] of palettes.entries()){
 const local:(Puzzle&{screen:number;source:string})[]=[];
 for(let s=0;s<config.starts;s++){
  const start=recipe(palette.paints.length),field=oneShotField(palette.paints,start);stats.screenEndpoints+=field.length;
  for(let j=0;j<config.targetsPerStart;j++){
   stats.proposals++;const depth=j%2?3:2,n=palette.paints.length,order:number[]=[];while(order.length<depth){const p=Math.floor(random()*n);if(p!==order.at(-1))order.push(p);}
   let initial=start,times=order.map(()=>.22+random()*.8),targetRecipe=premixReplay(start,order,times,'normalized');
   if(s%2){targetRecipe=recipe(n);let q=targetRecipe;const t:number[]=[];for(let k=depth-1;k>=0;k--){const alpha=q[order[k]]*(.25+random()*.68),before=predecessor(q,order[k],alpha),hold=holdForShare(1,alpha,'normalized');if(!before||hold===null){q=[];break;}q=before;t.unshift(hold);}if(!q.length)continue;initial=q;times=t;}
   stats.legal++;const target=mixtureColor(palette.paints,targetRecipe),curve=initial===start?field:oneShotField(palette.paints,initial);if(initial!==start)stats.screenEndpoints+=curve.length;
   const one=closestOne(curve,target)/T,dist=colorDistance(mixtureColor(palette.paints,initial),target)/T;
   if(one<1.35||dist<1.5)continue;stats.screened++;
   const p={id:`hybrid-${seed}-${pi}-${s}-${j}`,palette:palette.name,paints:palette.paints,start:initial,targetRecipe,control:{order,times,error:0},screen:Math.min(8,one)+.12*Math.min(15,dist)+(depth===3?.4:0),source:palette.source};local.push(p);
  }
 }
 local.sort((a,b)=>b.screen-a.screen);for(const depth of [2,3])candidates.push(...local.filter(p=>p.control.order.length===depth).slice(0,2));stats.palettes++;
 if(pi%64===0)console.log(JSON.stringify({phase:'broad',seconds:(Date.now()-begin)/1000,...stats}));
}
writeFileSync(output+'/screen-bank.json',JSON.stringify(candidates));

// Diverse elites: distribute targets across value/chroma and palette sizes,
// retain at most two per palette. Not a style quota or a pass guarantee.
const cells=new Map<string,number>(),counts=new Map<string,number>(),elites:typeof candidates=[];
for(const p of candidates.sort((a,b)=>b.screen-a.screen)){
 const t=targetOf(p),cell=[p.paints.length,p.control.order.length,Math.floor(t.lab[0]*4),Math.floor(Math.hypot(...t.lab.slice(1))/.06)].join(':'),key=fingerprint(p.paints);
 if((cells.get(cell)??0)>=6||(counts.get(key)??0)>=2||elites.filter(x=>x.control.order.length===p.control.order.length).length>=Math.ceil(config.refine/2))continue;
 cells.set(cell,(cells.get(cell)??0)+1);counts.set(key,(counts.get(key)??0)+1);elites.push(p);if(elites.length>=config.refine)break;
}
const refined:ReturnType<typeof refinePuzzle>[]=[];
for(const [i,p] of elites.entries()){
 const r=refinePuzzle(p,seed+70000+i,config.rounds);refined.push(r);stats.refined++;
 // A discrete pigment substitution is followed by continuous refinement.
 // Original pigments/strengths are never edited, and parent stays archived.
 if(i%3===0){const slot=Math.floor(random()*p.paints.length),replacement=pigments[Math.floor(random()*pigments.length)];if(!p.paints.some(x=>x.id===replacement.id)){
  const paints=[...r.p.paints];paints[slot]=replacement;const child={...r.p,id:r.p.id+'-sub',palette:r.p.palette+' · '+replacement.name,paints,targetRecipe:premixReplay(r.p.start,r.p.control.order,r.p.control.times,'normalized')};
  const mutated=refinePuzzle(child,seed+90000+i,config.rounds);refined.push(mutated);stats.paletteMutations++;
 }}
 writeFileSync(output+'/refined.json',JSON.stringify(refined));
 if(i%8===0)console.log(JSON.stringify({phase:'refine',seconds:(Date.now()-begin)/1000,...stats}));
}

const audits:any[]=[],regressions:any[]=[],inputs=[2,3].flatMap(depth=>refined.filter(r=>r.p.control.order.length===depth).sort((a,b)=>b.after.score-a.after.score).slice(0,Math.ceil(config.validate/2))).map(r=>({p:r.p,optimization:r}));
// All historical tests are inspected, not just examples we expect to pass.
for(const h of regression.holes){inputs.push({p:{id:h.id,palette:PLAY_LEVELS[h.level].name,paints:PLAY_LEVELS[h.level].paints,start:h.initial,targetRecipe:h.initial,control:h.modes.normalized} as Puzzle,optimization:null as any});}
for(const [i,input] of inputs.entries()){
 const p=input.p,h=regression.holes.find(h=>h.id===p.id);
 // Historical target is an RGB snapshot, not its original recipe.
 const actualTarget=h?colorPoint(h.targetRGB as [number,number,number]):targetOf(p);
 const raw=searchPremix(0,p.start,actualTarget,'normalized',p.control.order.length,961921+i,192,10,p.paints);stats.validationEndpoints+=raw.evaluations;
 const witness=measureRegion(0,p.start,actualTarget,p.control,p.paints),accepted=raw.routes;
 // Cleanup requires the historical target, too; supply explicit target below.
 const cleanup=cleanupAttack(p,871913+i,128,28,actualTarget);stats.validationEndpoints+=cleanup.evaluations;
 const selected=[...accepted,...cleanup.routes].filter((r,i,a)=>a.slice(0,i).filter(s=>s.order.join()===r.order.join()).length<2);
 const alternate=selected.map(r=>measureRegion(0,p.start,actualTarget,r,p.paints));
 const verdict=structuralVerdict(p.control.order.length,raw.best,cleanup.best);
 if(!witness.supported)verdict.reasons.push('witness-insufficient-timing-or-setup-support');
 if(!witness.allMeaningful)verdict.reasons.push('witness-split-deletable-or-small-action');
 verdict.pass=verdict.reasons.length===0;const passes=verdict.pass;
 const rawMinimum=Math.min(p.control.order.length,...accepted.map(r=>r.order.length)),supported=alternate.filter(r=>r.supported),timingMinimum=Math.min(...[...(witness.supported?[p.control.order.length]:[]),...supported.map(r=>r.order.length)]);
 let baseline=null;
 if(input.optimization){const original=input.optimization.initial,b=searchPremix(0,original.start,targetOf(original),'normalized',Math.min(2,p.control.order.length-1),961921+i,192,10,p.paints);stats.validationEndpoints+=b.evaluations;baseline={bestT:b.best.map(e=>e/T),seed:b.seed,evaluations:b.evaluations};}
 const row={p,target:actualTarget,optimization:input.optimization?{initial:input.optimization.initial,before:input.optimization.before,after:input.optimization.after,history:input.optimization.history,baseline}:null,rawMinimum,timingMinimum:Number.isFinite(timingMinimum)?timingMinimum:null,bestT:raw.best.map(e=>e/T),cleanup,witness,verdict,passes,styles:Object.fromEntries(FAMILIES.map(f=>[f,classifyAlternatives(f,alternate,witness)])),independent:{seed:raw.seed,samples:raw.samples,restarts:raw.restarts,evaluations:raw.evaluations,unmeasuredAccepted:accepted.length+cleanup.routes.length-selected.length},routes:alternate};
 (h?regressions:audits).push(row);writeFileSync(output+'/audits.json',JSON.stringify(audits));writeFileSync(output+'/regressions.json',JSON.stringify(regressions));
 console.log(JSON.stringify({phase:'validation',i,id:p.id,passes,bestT:row.bestT,reasons:verdict.reasons,seconds:(Date.now()-begin)/1000}));
}
const sources=['scripts/premix-hybrid.ts','scripts/search-premix-hybrid.ts','scripts/premix-search.ts','scripts/premix-region-metrics.ts','app/play-premix.ts','app/play-engine.ts','app/paint-mixing.ts'];
writeFileSync(output+'/summary.json',JSON.stringify({version:HYBRID_VERSION,seed,config,stats,seconds:(Date.now()-begin)/1000,sourceHash:createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex'),passed:audits.filter(r=>r.passes).map(r=>r.p.id),rejected:audits.filter(r=>!r.passes).map(r=>({id:r.p.id,reasons:r.verdict.reasons})),limitations:['Numerical searches, not global proofs','Finite-difference gradients, no learned or autodiff model','Frozen-policy audit is in-sample calibration, not independent human validation','Gameplay unchanged; bank is offline and not yet human tested']}));
console.log(JSON.stringify({phase:'complete',output,...stats,passed:audits.filter(r=>r.passes).length}));
