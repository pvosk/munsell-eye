// Offline discovery archive: cheap ACTUAL mixing across every 3/4-paint set,
// then stratified competitor checks. Proposal labels never gate the archive.
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE as T,mixtureColor,colorDistance,chargeAmount,addPaint,totalMass,type ColorPoint} from '../app/play-engine';
import {routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureJourney,sampleJourney,journeyGeometry,classifyApproach} from '../app/play-journey-analysis';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {POOL_IDS} from './backward-region-proposals';
import {blindSearch,BLIND_POLICY} from './recipe-blind-search';
import {compactWitness} from './supported-selection';
import {stableRide} from './stable-route-measurement';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,createWriteStream,existsSync} from 'node:fs';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';

export const MINE_POLICY={version:'broad-mixing-bank-1',seed:91228001,samplesPerPalette:12,largePerSize:512,sizes:[3,4,5,6,8],shortlistPerCell:3,deepPerSize:4,
  // Descriptive provisional thresholds, not new live classifications.
  glideLength:30,setupLength:6,abTravel:.04,neutralMaximum:.03};
export const MINE_SOURCES=['scripts/broad-palette-mine.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','scripts/supported-selection.ts','scripts/backward-region-proposals.ts',
 'app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts'];
export const fingerprint=()=>createHash('sha256').update(MINE_SOURCES.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex');
export function rng(seed:number){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};}
export function combinations(n:number,k:number){const out:number[][]=[];const visit=(q:number[],lo:number)=>{if(q.length===k){out.push(q);return;}for(let i=lo;i<=n-(k-q.length);i++)visit([...q,i],i+1);};visit([],0);return out;}
export function paletteSets(){const small=[...combinations(32,3),...combinations(32,4)],large:number[][]=[],random=rng(MINE_POLICY.seed);
 for(const n of [5,6,8]){const unique=new Map<string,number[]>();while(unique.size<MINE_POLICY.largePerSize){const q:number[]=[];while(q.length<n){const i=Math.floor(random()*32);if(!q.includes(i))q.push(i);}q.sort((a,b)=>a-b);unique.set(q.join(','),q);}large.push(...unique.values());}return [...small,...large];}
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((x,i)=>x-b[i]));
const chroma=(p:ColorPoint)=>Math.hypot(p.lab[1],p.lab[2]);
export function pathDescriptor(points:ColorPoint[]){let world=0,ab=0,value=0;for(let i=1;i<points.length;i++){world+=distance(points[i].position,points[i-1].position);ab+=distance(points[i].lab.slice(1),points[i-1].lab.slice(1));value+=Math.abs(points[i].lab[0]-points[i-1].lab[0]);}
 return {world,ab,value,maxChroma:Math.max(...points.map(chroma)),inward:chroma(points[0])-chroma(points.at(-1)!),valueOnly:Math.max(...points.map(chroma))<MINE_POLICY.neutralMaximum||ab<.015};}
type Proposal={id:string;indices:number[];sample:number;order:number[];times:number[];recipe:number[];target:ColorPoint;nearest:number;nearestBase:number;descriptors:{finish:ReturnType<typeof pathDescriptor>;setup:number;startDistance:number;excursion:number;total:number};rank:Record<string,number>};
export function propose(indices:number[],sample:number):Proposal{
 const paints=indices.map(i=>PAINTS.find(p=>p.id===POOL_IDS[i])!),random=rng(MINE_POLICY.seed+indices.reduce((s,i)=>Math.imul(s,37)+i,1)+sample*777),n=paints.length;
 const depth=sample%3+1,order=[Math.floor(random()*n)],times:number[]=[];let q=paints.map((_,i)=>+(i===order[0]));
 const stops=[mixtureColor(paints,q)];
 for(let j=0;j<depth;j++){let next=Math.floor(random()*n);if(next===order.at(-1))next=(next+1)%n;order.push(next);const time=.06+1.75*random()**(sample%2?2:1);times.push(time);q=addPaint(q,next,chargeAmount(totalMass(q),time));stops.push(mixtureColor(paints,q));}
 const target=stops.at(-1)!,errors=paints.map((_,i)=>colorDistance(mixtureColor(paints,paints.map((_,j)=>+(i===j))),target)/T),nearest=Math.min(...errors),nearestBase=errors.indexOf(nearest);
 // Screening chords only. Full paths are remeasured during audits.
 const finish=pathDescriptor(stops.slice(-2)),setup=pathDescriptor(stops.slice(0,-1)).world,startDistance=errors[order[0]],excursion=Math.max(0,...stops.map(p=>colorDistance(p,target)/T-startDistance)),total=pathDescriptor(stops).world;
 const chromaChange=distance(stops.at(-2)!.lab.slice(1),target.lab.slice(1));
 return {id:`mine-${indices.join('-')}-${sample}`,indices,sample,order,times,recipe:q,target,nearest,nearestBase,descriptors:{finish,setup,startDistance,excursion,total},rank:{
 far:nearest,glide:setup>=6&&!finish.valueOnly?finish.world:0,ride:Math.min(chroma(stops.at(-2)!),chroma(target))>=.06?finish.world:0,
 value:setup>=6?finish.value:0,inward:setup>=6?finish.inward:0,close:nearest<=3&&order[0]===nearestBase?excursion:0,
 unusual:setup>=6?chromaChange+excursion*.01:0,control:random()}};
}
const LANES=['far','glide','ride','value','inward','close','unusual','control'];
function targetBand(p:Proposal){return p.target.lab[0]<.48?'dark':p.target.lab[0]>.75?'light':chroma(p.target)<.05?'middle-neutral':'middle-color';}
export function audit(p:Proposal,deep:boolean){const paints=p.indices.map(i=>PAINTS.find(p=>p.id===POOL_IDS[i])!),slot=PLAY_LEVELS.length;
 PLAY_LEVELS.push({name:p.id,subtitle:'Offline discovery only',paints,tolerance:T,labOnly:true});
 try{
 const policy={...BLIND_POLICY,samples:deep?(paints.length<=4?144:72):32,restarts:deep?(paints.length<=4?6:3):2,iterations:deep?120:60,timeExponent:deep?2:1};
 const blind=blindSearch(slot,p.target,deep?3:2,MINE_POLICY.seed+991,policy),groups=new Map<string,typeof blind.routes>();
 for(const r of blind.routes){const key=r.order.join(',');const g=groups.get(key)??[];g.push(r);groups.set(key,g);}
 const witnesses=[{order:p.order,times:p.times},...Array.from(groups.values()).flatMap(g=>g.sort((a,b)=>a.error-b.error).slice(0,deep?2:1))];
 const measured=witnesses.map(r=>{const m=measureJourney(slot,measureDesignRoute(slot,routeDetails(slot,r.order,r.times,p.target,T),p.target),p.target);if(m.finishWindowMs>=55&&m.times.length>1)m.setup=measureSetup(slot,m,p.target,T);return m;});
 const bases=paints.map((paint,base)=>{const all=measured.filter(r=>r.order[0]===base),supported=all.filter(experienceSupported),rawFewest=all.length?Math.min(...all.map(r=>r.times.length)):null,supportedFewest=supported.length?Math.min(...supported.map(r=>r.times.length)):null;
  const efficient=supported.filter(r=>r.times.length===supportedFewest),startDistance=colorDistance(mixtureColor(paints,paints.map((_,i)=>+(i===base))),p.target)/T;
  return {base,paint:paint.name,rawFewest,supportedFewest,startDistance,approach:classifyApproach(startDistance,all),token:efficient.some(r=>r.meaningfulPours<Math.min(2,r.times.length)),
   routes:efficient.map(r=>{const {strokes}=sampleJourney(slot,r),last=strokes.at(-1)!,finish=pathDescriptor([last.before,last.after]),setup=strokes.slice(0,-1).reduce((a,b)=>a+b.length,0);
    // Full finish a/b travel, not just endpoint difference.
    const one=sampleJourney(slot,{order:r.order,times:r.times});const finishPoints=one.points.slice(-49);const full=pathDescriptor(finishPoints);
    return {witness:compactWitness(r),journey:r.journey,finish:{...finish,...full},setup,glide:r.meaningfulPours>=2&&setup>=6&&full.world>=30&&full.ab>=.04&&!full.valueOnly,
     neutralValueOnly:full.valueOnly,stable:deep?stableRide(slot,r):null};}),
   rawWitnesses:blind.routes.filter(r=>r.order[0]===base).sort((a,b)=>a.times.length-b.times.length||a.error-b.error).slice(0,2)};
 });
 const flags=[];if(bases.some(b=>b.startDistance<=1))flags.push('pure-in-cup');if(bases.some(b=>b.supportedFewest===null))flags.push('support-unresolved');if(bases.some(b=>b.approach.easyRoutes))flags.push('short-direct');if(bases.some(b=>b.token))flags.push('token');
 const available=(f:(r:typeof bases[number]['routes'][number])=>boolean)=>bases.filter(b=>b.routes.some(f)).map(b=>b.base);
 return {proposal:p,paints,deep,policy,maxBlindAdditions:deep?3:2,evaluations:blind.evaluations,flags,bases,availability:{glide:available(r=>r.glide),ride:available(r=>r.stable?.ride===true),value:available(r=>r.witness.traits['value-shift']),balance:available(r=>r.witness.traits.balance),interior:available(r=>r.witness.meaningfulPours===3),neutralValueOnly:available(r=>r.neutralValueOnly)},
  closeIndirect:bases.filter(b=>b.approach.status==='close-indirect').map(b=>b.base),allSupported:bases.every(b=>b.supportedFewest!==null)};
 }finally{PLAY_LEVELS.splice(slot,1);}
}
async function main(){const start=Date.now(),sourceHash=fingerprint(),original=JSON.stringify(PLAY_LEVELS),sets=paletteSets(),shortlists=new Map<string,Proposal[]>(),counts:Record<number,number>={},bands:Record<string,number>={};
 const archive='docs/play-broad-palette-bank.jsonl.gz',screenFile='docs/play-broad-palette-screen.json',finalFile='docs/play-broad-palette-audit.json';
 if([archive,screenFile,finalFile].some(existsSync))throw Error('Archive exists; use a new run name instead of overwriting a bank');
 const gzip=createGzip(),file=createWriteStream(archive);gzip.pipe(file);
 for(let i=0;i<sets.length;i++){const indices=sets[i];counts[indices.length]=(counts[indices.length]??0)+1;
  for(let sample=0;sample<MINE_POLICY.samplesPerPalette;sample++){const p=propose(indices,sample),band=targetBand(p);bands[band]=(bands[band]??0)+1;
   if(!gzip.write(JSON.stringify(p)+'\n'))await once(gzip,'drain');
   for(const lane of LANES){const key=`${indices.length}:${lane}:${band}`,group=shortlists.get(key)??[];
    // One representative per palette per cell; no target/near-base rejection.
    const same=group.findIndex(q=>q.indices.join()===indices.join());if(same>=0){if(group[same].rank[lane]>=p.rank[lane])continue;group.splice(same,1);}group.push(p);group.sort((a,b)=>b.rank[lane]-a.rank[lane]);shortlists.set(key,group.slice(0,MINE_POLICY.shortlistPerCell));}
  }
  if(i%2048===0)console.log(`Mixing ${i}/${sets.length}; ${((Date.now()-start)/1000).toFixed(1)}s`);
 }
 gzip.end();await once(file,'finish');
 // One palette per size/lane initially; rotate bands, retain a separate random lane.
 const picked=new Map<string,Proposal>();for(const size of MINE_POLICY.sizes)for(let l=0;l<LANES.length;l++){
  const lane=LANES[l],band=['dark','light','middle-neutral','middle-color'][l%4];
  const list=[...(shortlists.get(`${size}:${lane}:${band}`)??[]),...Array.from(shortlists.entries()).filter(([k])=>k.startsWith(`${size}:${lane}:`)).flatMap(([,v])=>v)];
  const p=list.find(p=>!Array.from(picked.values()).some(q=>q.indices.join()===p.indices.join()))??list[0];if(p)picked.set(p.id,p);
 }
 const screens=[];for(const p of picked.values()){console.log(`Audit two-addition ${screens.length+1}/${picked.size}: ${p.id}`);screens.push(audit(p,false));}
 writeFileSync(screenFile,JSON.stringify({sourceHash,policy:MINE_POLICY,counts,bands,pigments:POOL_IDS.map(id=>PAINTS.find(p=>p.id===id)),archive,shortlists:Object.fromEntries(shortlists),screens,elapsedSeconds:(Date.now()-start)/1000}));
 const deep=[];for(const size of MINE_POLICY.sizes){const group=screens.filter(s=>s.paints.length===size),ranked=[...group].sort((a,b)=>Number(b.allSupported)-Number(a.allSupported)||a.flags.length-b.flags.length||b.proposal.nearest-a.proposal.nearest);
  // Preserve both best-looking cases and a rejected/exploratory control per size.
  const selected=ranked.slice(0,MINE_POLICY.deepPerSize-1);const control=group.find(s=>!selected.includes(s)&&s.proposal.nearest<=3)??group.find(s=>!selected.includes(s));if(control)selected.push(control);
  for(const s of selected){console.log(`Audit three-addition ${deep.length+1}: ${s.proposal.id}`);deep.push(audit(s.proposal,true));writeFileSync(finalFile,JSON.stringify({sourceHash,policy:MINE_POLICY,counts,archive,screenFile,deep,elapsedSeconds:(Date.now()-start)/1000}));}
 }
 if(original!==JSON.stringify(PLAY_LEVELS))throw Error('Live palettes changed');console.log(JSON.stringify({counts,proposals:sets.length*12,screens:screens.length,deep:deep.length,elapsedSeconds:(Date.now()-start)/1000}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
