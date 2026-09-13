import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legExecution} from '../app/play-pigment-legs';
import {labMixtureStep,premixReplay} from '../app/play-premix';
import {acceptedIntervals} from './premix-region-metrics';
import {auditLegPuzzle} from './pigment-leg-audit';
import {challengeLegOrders} from './pigment-leg-search';
import {legGeometry} from './pigment-leg-metrics';
import {readBankJson} from './research-bank-io';
const dir='docs/course-workbench-1',get=(f:string)=>readBankJson(`${dir}/${f}.json`),save=(f:string,d:unknown)=>writeFileSync(`${dir}/${f}.json`,JSON.stringify(d));
const path='app/generated/play-course-workbench.json',old=JSON.parse(readFileSync(path,'utf8')),manifest=get('manifest'),free=get('free'),board=get('board'),seed=1937819;
const offset=old.holes.length?old.paletteOffset:PLAY_LEVELS.length,palettes:any[]=[],holes:any[]=[];
const key=(p:any[])=>JSON.stringify(p.map(p=>[p.id,p.rgb,p.strength]));
function levelFor(name:string,paints:any[]){const index=PLAY_LEVELS.slice(0,offset).findIndex(p=>key(p.paints)===key(paints));if(index>=0)return index;let j=palettes.findIndex(p=>key(p.paints)===key(paints));if(j<0){j=palettes.length;palettes.push({name,subtitle:paints.map(p=>p.name).join(' · '),paints,tolerance:T,labOnly:true});}return offset+j;}
function convert(p:any,m:any,base:number|null){
 const execution=legExecution(m.legs);if(execution.some(e=>!e.times))return null;
 const order:number[]=base===null?[]:[base],times:number[]=base===null?[]:[0];
 for(const e of execution)for(const t of e.times!){order.push(e.paint);times.push(t);}
 const initial=base===null?p.start:p.start.map(()=>0);let q=initial;
 for(let i=0;i<order.length;i++){q=labMixtureStep(q,order[i],times[i],'normalized',base!==null).after;if(i<order.length-1&&colorDistance(mixtureColor(p.paints,q),p.target)<=T)return null;}
 const error=colorDistance(mixtureColor(p.paints,q),p.target);if(error>T)return null;
 const windows=acceptedIntervals(t=>colorDistance(mixtureColor(p.paints,premixReplay(initial,order,[...times.slice(0,-1),t],'normalized',base!==null)),p.target)<=T),w=windows.find(w=>times.at(-1)!>=w.lo-1e-8&&times.at(-1)!<=w.hi+1e-8);
 const g=legGeometry(p.paints,p.start,p.target,m.legs,192);
 return{order,times,error,finishWindowMs:w?(w.hi-w.lo)*1000:0,setupCoverage:m.setupCoverage,supported:m.supported,legCount:m.legs.length,finishShareWidth:m.finishWidth,proportionSupported:m.supported,traits:g.traits,allMeaningful:g.allMeaningful,base};
}
function add(p:any,routes:any[],meta:{id:string;name:string;title:string;style:string;brief:string;method:string;sourceId:string;freeBase?:true;minimum:number;regionMinimum:number|null}){
 const eligible=routes.filter(r=>r.proportionSupported&&r.allMeaningful&&r.finishWindowMs>=25).sort((a,b)=>a.legCount-b.legCount||b.finishWindowMs-a.finishWindowMs);if(!eligible.length)throw Error('No executable supported example '+meta.id);
 const feature=eligible.find(r=>r.legCount===meta.minimum&&r.traits[meta.style])??eligible[0],style=feature.traits[meta.style]?meta.style:Object.entries(feature.traits).find(([k,v])=>v)?.[0]??'mixing';
 const rivals:any[]=[];for(const r of [...eligible.filter(r=>r.base!==feature.base),...eligible.filter(r=>r.order[0]!==feature.order[0]),...eligible]){if(rivals.length>=8)break;if(!rivals.some(x=>x.order.join()===r.order.join()))rivals.push({...r,label:meta.freeBase?`Start: ${p.paints[r.order[0]].name}`:r.legCount===meta.minimum?'Shortest-found alternative':'Longer alternative'});}
 const level=levelFor(meta.name,p.paints),minimum=Math.min(...eligible.map(r=>r.times.length-(meta.freeBase?1:0)));
 holes.push({id:meta.id,level,stage:0,collection:'workbench',role:'new',...(meta.freeBase?{freeBase:true}:{}),title:meta.title,style,initial:meta.freeBase?p.start.map(()=>0):p.start,targetRGB:p.target.rgb,paints:p.paints.map((p:any)=>[p.id,p.rgb,p.strength]),lab:{brief:meta.brief,method:meta.method,sourceId:meta.sourceId,searchIntent:meta.style,exploratory:false,rawLegMinimum:meta.minimum,regionLegMinimum:meta.regionMinimum,styleStatus:'available-in-measured-alternatives',featuredLegs:feature.legCount},modes:{normalized:{order:feature.order,times:feature.times,error:feature.error,minimum,measurement:{...feature,label:'Featured supported example'},rivals}}});
}
// Two contrasting targets per original campaign palette. Not new target claims:
// these are newly executable normalized-free-base versions with new specimen IDs.
const selections=[
 ['campaign-draft-1-0-0','UltraOx Dual','1 · Warm / cool balance','coupled-balance'],
 ['campaign-draft-1-0-2','UltraOx Dual','2 · Blue finish / lift alternative','rise'],
 ['campaign-draft-1-2-0','Zorny','1 · Warm nuance through counterweights','coupled-balance'],
 ['campaign-draft-1-2-3','Zorny','2 · Lighter, muted finish','rise'],
 ['campaign-draft-1-6-2','Secondaries','1 · Violet-side balance','coupled-balance'],
 ['campaign-draft-1-6-3','Secondaries','2 · Lighter multi-approach finish','rise'],
];
for(const [i,[id,name,title,style]] of selections.entries()){
 const r=free.find((r:any)=>r.id===id),paints=manifest.roster[r.palette].paints,perBase:any[]=[],routes:any[]=[];
 for(let base=0;base<paints.length;base++){
  const p={id:`${id}/normalized-base-${base}`,paints,start:paints.map((_:unknown,j:number)=>base===j?1:0),target:r.target,demonstration:[]};
  const file=`free-audit-${i}-${base}`;let a:any;
  if(existsSync(`${dir}/${file}.json`))a=get(file);else{const result=auditLegPuzzle(p,seed+i*997+base*71,{samples:192,restarts:12,maxMeasured:36,maxLegs:Math.min(3,paints.length-1),fresh:true});const {search,fresh,...compact}=result;a=compact;save(file,a);}
  const converted=a.measured.map((m:any)=>convert(p,m,base)).filter(Boolean);if(!converted.some((m:any)=>m.supported&&m.allMeaningful&&m.finishWindowMs>=25))throw Error('Missing playable base '+name+'/'+base);
  routes.push(...converted);perBase.push({base,paint:paints[base].name,minimum:a.summary.rawMinimum,supportedMinimum:a.summary.robustMinimum,bestByDepth:a.bestByDepth,executable:converted.length});
 }
 const minimum=Math.min(...perBase.map(b=>b.minimum));save('free-evidence-'+i,perBase);
 add({paints,start:paints.map(()=>0),target:r.target},routes,{id:`course-workbench-free-${i}`,name,title,style,freeBase:true,minimum,regionMinimum:Math.min(...perBase.map(b=>b.supportedMinimum)),method:'normalized-free-base',sourceId:id,
  brief:`Original campaign target, revalidated with normalized quantity and every pure base. First paint is free. Shortest found by base: ${perBase.map(b=>`${b.paint}: ${b.minimum}`).join('; ')} additions. The featured style is an available approach, not guaranteed from every start. Compare this with the other target in the same palette.`});
}
// Four fresh search outcomes, two unplayed numerical finalists. Different value
// ranges and palette identities; no claim of required finishing labels.
const premixes=[
 [dir+'/audit-0.json','RYB','Pale destination · new setup','rise'],
 [dir+'/audit-3.json','Hansa · Scarlet · Violet','A different middle-value balance','coupled-balance'],
 [dir+'/audit-4.json','Earth Orange · Cobalt Green','Low-value counterweights','coupled-balance'],
 [dir+'/audit-5.json','Teal Earth','Green middle · earth correction','coupled-balance'],
 ['docs/bidirectional-exclusion-2/final-5.json','Scarlet · Cobalt Green','Dark destination · new palette','interior-assembly'],
 ['docs/bidirectional-exclusion-2/final-54.json','Violet · Lemon · Blue','Chromatic balancing / drop option','chromatic-ride'],
];
for(const [i,[source,name,title,style]] of premixes.entries()){
 const raw=readBankJson(source),a=raw.audit??raw,p=a.p;
 const check=challengeLegOrders(p.paints,p.start,p.target,2,seed+800001+i*997,512,24);if(check.best.some(e=>e<=T))throw Error('Fresh shortcut '+name);save('premix-check-'+i,{source,bestByDepth:check.best.map(e=>e/T),evaluations:check.evaluations});
 add(p,a.measured.map((m:any)=>convert(p,m,null)).filter(Boolean),{id:`course-workbench-premix-${i}`,name,title,style,minimum:a.summary.rawMinimum,regionMinimum:a.summary.robustMinimum,method:i<4?'hybrid-exclusion':'exclusion-bank',sourceId:source+'#'+p.id,
  brief:`${i<4?'Fresh start/target search on the combined campaign and contender roster.':'Previously banked numerical finalist, not previously playable.'} No one- or two-leg shortcut found in a fresh independent check. Multiple first-pigment alternatives are available. Judge the correction decisions and whether this palette offers something distinct; three legs alone do not establish quality.`});
}
const priorBranches=JSON.parse(readFileSync('app/generated/play-branch-lab.json','utf8')).holes;
const publishedBoard=board.map((r:any)=>{
 const p=manifest.roster[r.palette],playable=holes.filter(h=>key(p.paints)===JSON.stringify(h.paints)).map(h=>h.id),oldEvidence=p.origin==='campaign';
 const premixScreened=p.paints.length>=4&&p.paints.length<=6,existingBranchTargets=priorBranches.filter((h:any)=>key(p.paints)===JSON.stringify(h.paints)).length,earlierNumericalTargets=holes.filter(h=>key(p.paints)===JSON.stringify(h.paints)&&h.lab.method==='exclusion-bank').length;
 const status=oldEvidence?'Campaign draft · reassess':existingBranchTargets&&r.premixCandidates?'Earlier branching + new target · compare chapter potential':r.premixCandidates>=2?'Several new targets · potential chapter':earlierNumericalTargets?'Earlier numerical finalist · now playable':r.premixCandidates===1?'One new target · retain candidate':existingBranchTargets?'Earlier branching evidence retained':'No new nomination · not a rejection';
 const note=(oldEvidence?'Preserve earlier player feedback and the original chapter plan.':existingBranchTargets?'Earlier branching specimens and new targets are separate evidence; compare them before deciding chapter depth.':earlierNumericalTargets?'The playable hole comes from the earlier exclusion bank, not this target sweep.':'A passing target is not yet a course; contrasting player-approved experiences still matter.')+(premixScreened?' This is a bounded screen, not a quality ranking or complete palette capacity.':' New premix proposal search was not run: this sweep covers 4–6-paint palettes. Free-base screening was still performed.');
 return{...r,paints:p.paints.map((p:any)=>p.name),status,playable,note,premixScreened,existingBranchTargets,earlierNumericalTargets};
});
const result={version:'course-workbench-1',seed,tolerance:T,paletteOffset:offset,palettes,holes,board:publishedBoard};
if(old.holes.length&&JSON.stringify(old)!==JSON.stringify(result)&&spawnSync('git',['ls-files','--error-unmatch',path],{stdio:'ignore'}).status===0)throw Error('Published bank is immutable');
writeFileSync(path,JSON.stringify(result));save('selection',{holes:holes.map(h=>({id:h.id,level:h.level,title:h.title,freeBase:!!h.freeBase,lab:h.lab})),board:publishedBoard});console.log(JSON.stringify({holes:holes.length,palettesAdded:palettes.length,board:publishedBoard.length}));
