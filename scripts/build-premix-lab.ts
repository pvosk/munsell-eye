import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,totalMass,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {normalizeRecipe,predecessor,holdForShare,premixStep,premixReplay,premixRoute,type MassMode} from '../app/play-premix';
import {searchPremix,measurePremix} from './premix-search';
const output='docs/play-premix-search.json',bank='app/generated/play-premix-lab.json';
if(existsSync(output)||existsSync(bank))throw Error('Preserve premix run');
const seed=680107,jobs=[{level:1,style:'rise',finish:3},{level:1,style:'drop',finish:2},{level:5,style:'coupled-balance',finish:-1},{level:16,style:'long-finish',finish:-1}];
const modes:MassMode[]=['accumulated','normalized'],results:any[]=[],holes:any[]=[];
let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
for(const [ji,job] of jobs.entries()){
 const paints=PLAY_LEVELS[job.level].paints,proposals:any[]=[];
 for(let sample=0;sample<512;sample++){
  const end=normalizeRecipe(paints.map(()=>Math.exp((random()-.5)*4))),finish=job.finish<0?Math.floor(random()*paints.length):job.finish;
  const secondShare=end[finish]*(.45+random()*.5),setup=predecessor(end,finish,secondShare);if(!setup)continue;
  const first=Math.floor(random()*paints.length);if(first===finish)continue;
  const firstShare=setup[first]*(.4+random()*.55),start=predecessor(setup,first,firstShare);if(!start||firstShare<.02||secondShare<.04)continue;
  const target=mixtureColor(paints,end),point=mixtureColor(paints,start);if(colorDistance(point,target)<T*3)continue;
  const controls:any={};let legal=true;
  for(const mode of modes){let q=[...start];const times:number[]=[];for(const [p,share] of [[first,firstShare],[finish,secondShare]]){const t=holdForShare(totalMass(q),share,mode);if(t===null){legal=false;break;}times.push(t);q=premixStep(q,p,t,mode).after;}controls[mode]={order:[first,finish],times,error:colorDistance(mixtureColor(paints,q),target)};}
  if(!legal)continue;
  const path=premixRoute(paints,start,[first,finish],controls.accumulated.times,'accumulated'),a=path.stops[0].lab,b=path.stops[1].lab,c=path.stops[2].lab;
  const value=c[0]-b[0],ab=Math.hypot(c[1]-b[1],c[2]-b[2]),norm=Math.hypot(value,ab),opposing=(b[1]-a[1])*(c[1]-b[1])+(b[2]-a[2])*(c[2]-b[2])<0;
  if(colorDistance(path.stops[0],path.stops[1])<T||colorDistance(path.stops[1],target)<T)continue;
  const score=job.style==='rise'||job.style==='drop'?(job.style==='rise'?value:-value)*(Math.abs(value)/Math.max(norm,1e-9))*(Math.abs(value)>=.8*Math.abs(b[0]-a[0])?1:.2):job.style==='coupled-balance'?(opposing?1:0)*Math.min(Math.abs(value),ab):ab;
  if(score<=0)continue;
  proposals.push({id:`premix-${ji}-${sample}`,level:job.level,style:job.style,start,target,end,controls,score});
 }
 proposals.sort((a,b)=>b.score-a.score);
 const selected:any[]=[];for(const p of proposals){if(selected.every(s=>colorDistance(s.target,p.target)>T||colorDistance(mixtureColor(paints,s.start),mixtureColor(paints,p.start))>T*2))selected.push(p);if(selected.length===12)break;}
 const checked:any[]=[];
 for(const p of selected){
  console.log('Checking',p.id,job.style);const modesChecked:any={};let passes=true;
  for(const mode of modes){const blind=searchPremix(job.level,p.start,p.target,mode,2,seed+ji,96,6);const measured=measurePremix(job.level,p.start,p.target,mode,p.controls[mode]);
   const rivals=blind.routes.filter((r,i)=>blind.routes.findIndex(s=>s.order.join()===r.order.join())===i).map(r=>measurePremix(job.level,p.start,p.target,mode,r));
   const rawMinimum=blind.routes.length?Math.min(...blind.routes.map(r=>r.times.length)):2;
   const eligible=rawMinimum===2&&measured.supported&&measured.meaningful===2&&measured.traits[job.style as keyof typeof measured.traits];
   modesChecked[mode]={blind,measured,rivals,rawMinimum,eligible};passes&&=!!eligible;
  }
  checked.push({proposal:p,modes:modesChecked,passes});if(passes){holes.push({...p,checks:modesChecked});break;}
 }
 results.push({job,proposed:512,feasible:proposals.length,selected: selected.map(p=>p.id),checked});
}
const sources=['app/play-engine.ts','app/play-premix.ts','scripts/premix-search.ts','scripts/build-premix-lab.ts'];
const sourceHash=createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex');
writeFileSync(output,JSON.stringify({seed,sources,sourceHash,tolerance:T,results}));
writeFileSync(bank,JSON.stringify({version:'premix-1',seed,tolerance:T,holes:holes.map((h,i)=>({id:h.id,level:h.level,stage:i,style:h.style,initial:h.start,targetRGB:h.target.rgb,paints:PLAY_LEVELS[h.level].paints.map(p=>[p.id,p.rgb,p.strength]),modes:Object.fromEntries(modes.map(mode=>[mode,{...h.controls[mode],minimum:h.checks[mode].rawMinimum,measurement:h.checks[mode].measured,rivals:h.checks[mode].rivals}]))}))}));
console.log(JSON.stringify({holes:holes.length,styles:holes.map(h=>h.style)}));
