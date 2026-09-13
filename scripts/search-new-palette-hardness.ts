// Offline fresh-target search. Does not modify the live lab or mixing model.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {makeAtlas,witnessRoutes} from '../app/play-course-analysis';
import {blindSearch,BLIND_POLICY} from './recipe-blind-search';
import {verify} from './backward-verification';

const file='docs/play-new-palette-hardness.json';
if(existsSync(file))throw Error('Preserve the archived run; choose a new filename for a new search.');
const policy={seed:912661,targetsPerPalette:512,selectedPerPalette:4,deepPerPalette:2,atlas:[128,24],minimumSeparation:T,screen:{...BLIND_POLICY,samples:32,restarts:2,iterations:60},version:'new-palette-hardness-1'};
const sources=['scripts/search-new-palette-hardness.ts','scripts/backward-verification.ts','scripts/recipe-blind-search.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-experience-audit.ts'];
const sourceHash=createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex');
const rows=['docs/play-green-portfolios.json','docs/play-expanded-portfolios.json'].flatMap(p=>JSON.parse(readFileSync(p,'utf8')).results);
const original=JSON.stringify(PLAY_LEVELS),results:any[]=[],start=Date.now();
const save=()=>writeFileSync(file,JSON.stringify({policy,sources,sourceHash,tolerance:T,elapsedSeconds:(Date.now()-start)/1000,results}));
for(const [pi,row] of rows.entries()){
 const trial=row.trial,slot=PLAY_LEVELS.length;
 PLAY_LEVELS.push({name:trial.name,subtitle:'Offline hard target search',paints:trial.paints,tolerance:T,labOnly:true});
 let proposals:any[],selected:any[],screened:any[];
 try{
  const atlas=makeAtlas(slot,128,24),one=atlas.filter(a=>a.order.length===2).flatMap(a=>a.samples.map(s=>s.lab)),two=atlas.flatMap(a=>a.samples.map(s=>s.lab));
  let state=policy.seed+pi*10007;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
  const gap=(points:typeof one,lab:readonly number[])=>{let d=Infinity;for(const p of points){const e=(p[0]-lab[0])**2+(p[1]-lab[1])**2+(p[2]-lab[2])**2;if(e<d)d=e;}return Math.sqrt(d)/T;};
  proposals=Array.from({length:policy.targetsPerPalette},(_,i)=>{
   const q=trial.paints.map((p:any)=>Math.exp((random()-.5)*(i%2?1.6:4))/(i%2?p.strength:1)),sum=q.reduce((a:number,b:number)=>a+b,0),recipe=q.map((v:number)=>v/sum),target=mixtureColor(trial.paints,recipe);
   return{id:`hard-new-${pi}-${i}`,recipe,target,oneGap:gap(one,target.lab),twoGap:gap(two,target.lab),nearest:Math.min(...trial.paints.map((_:any,b:number)=>colorDistance(mixtureColor(trial.paints,trial.paints.map((_:any,j:number)=>+(j===b))),target)))/T};
  });
  // Reserve both objectives: demanding three-addition candidates and safer
  // two-addition setups. Never infer impossibility from sparse atlas distance.
  selected=[];
  for(const key of ['twoGap','oneGap'])for(const p of [...proposals].sort((a,b)=>b[key]-a[key])){
   if(p.nearest>1.8&&selected.every(s=>colorDistance(s.target,p.target)>=T))selected.push({...p,objective:key});
   if(selected.length>=(key==='twoGap'?2:4))break;
  }
  screened=selected.map(p=>{
   console.log(`Palette ${pi+1}/16 short-route challenge ${p.id}`);
   const screen=blindSearch(slot,p.target,2,policy.seed+pi,policy.screen);
   const known=witnessRoutes(slot,p.recipe,p.target,T).filter(r=>r.error<=T);
   return{proposal:p,screen,known};
  });
 }finally{PLAY_LEVELS.splice(slot,1);}
 const ranked=[...screened].sort((a,b)=>{
  const min=(h:any)=>h.screen.routes.length?Math.min(...h.screen.routes.map((r:any)=>r.times.length)):3;
  return min(b)-min(a)||b.proposal.twoGap-a.proposal.twoGap||b.proposal.oneGap-a.proposal.oneGap;
 });
 const result={trial,proposals,screened,deep:[] as any[]};results.push(result);save();
 for(const h of ranked.slice(0,policy.deepPerPalette)){
  console.log(`Palette ${pi+1}/16 deep every-base check ${h.proposal.id}`);
  const checked=verify(trial,h.proposal.id,h.proposal.target,[...h.screen.routes,...h.known],null);
  const qualified=!checked.failures.length&&checked.bases.every(b=>b.rawFewest!==null&&b.rawFewest>=2&&b.supportedFewest!==null&&b.supportedFewest>=2)&&h.proposal.nearest>1.8;
  const threeAll=qualified&&checked.bases.every(b=>b.rawFewest!>=3&&b.supportedFewest!>=3);
  result.deep.push({proposal:h.proposal,checked,qualified,threeAll});save();
  console.log(JSON.stringify({id:h.proposal.id,qualified,threeAll,raw:checked.bases.map(b=>b.rawFewest),supported:checked.bases.map(b=>b.supportedFewest),failures:checked.failures}));
 }
}
if(original!==JSON.stringify(PLAY_LEVELS))throw Error('Live palette mutation');
console.log(JSON.stringify({palettes:results.length,qualified:results.flatMap(r=>r.deep).filter(d=>d.qualified).length,threeAll:results.flatMap(r=>r.deep).filter(d=>d.threeAll).length,seconds:(Date.now()-start)/1000}));
