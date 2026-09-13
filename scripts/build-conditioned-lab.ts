// Curate the overdue pre-Atlas research bank. Never replace a published lab.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type PlayLevel} from '../app/play-engine';
import {legExecution} from '../app/play-pigment-legs';
import {premixReplay,premixStep} from '../app/play-premix';
import {acceptedIntervals} from './premix-region-metrics';
import {legGeometry} from './pigment-leg-metrics';
import {challengeLegOrders} from './pigment-leg-search';

const path='app/generated/play-conditioned-lab.json',old=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null,offset=old?.paletteOffset??PLAY_LEVELS.length;
const out='docs/conditioned-branch-lab-1';mkdirSync(out,{recursive:true});
const entries=[1,2].flatMap(run=>{
 const dir=`docs/conditioned-branch-search-${run}`,assessment=readBankJson(dir+'/assessment.json');
 return [...readBankJson(dir+'/audits.json'),...readBankJson(dir+'/refinements.json').map((r:any)=>r.audit)].map(a=>({a,row:assessment.bank.find((r:any)=>r.id===a.p.id)}));
});
const choices=[
 ['condition-1031931-1-4-5/fixed-target','Secondaries','Shared destination · secondary balance','coupled-balance'],
 ['condition-929831-410-3-3/joint','Lemon · Ochre · Teal','Vivid green with competing approaches','chromatic-ride'],
 ['condition-929831-820-0-1/joint','Violet · Chromium','Light green · prepare the rise','rise'],
 ['condition-1031931-3-1-0/joint','Cobalt Ember','Dark interior · not a drop finish','interior-assembly'],
 ['condition-929831-2-3-5','RYB','Two-leg warm chromatic finish','chromatic-ride'],
 ['condition-1031931-698-2-5/joint','Rose · Chartreuse · Cerulean','Rose destination · balance the corrections','coupled-balance'],
 ['condition-929831-300-4-3/fixed-target','Maroon · Lemon · Green','Shared destination · different counterweights','rise'],
 ['condition-929831-354-1-1','Indigo · Cobalt Green','Shorter dark drop','drop'],
 ['condition-929831-546-2-0/joint','Deep Red · Blue · Yellows','Warm balancing without white','coupled-balance'],
 ['condition-929831-326-6-2','Hansa · Manganese · Violet','Pale destination · value rise','rise'],
 ['condition-1031931-546-0-2','Chartreuse · Rose · Black','Light target with a dark counterweight','rise'],
 ['condition-929831-302-4-7','Sienna · Orange · Prussian','Shared destination · earth pigments','rise'],
 ['condition-929831-304-3-2','Rose · Turquoise · Yellow','Two-leg green ride candidate','chromatic-ride'],
 ['condition-1031931-746-6-0/fixed-target','Cerulean · Bismuth · Indian Red','Pale finish through earth red','rise'],
 ['condition-1031931-4-6-6','Hansa · Scarlet · Violet','Five paints · three-leg alternatives','rise'],
 ['condition-929831-23-0-6','Orange · Raw Umber · Violet','Five paints · shorter lift contrast','rise'],
];
const palettes:PlayLevel[]=[],holes:any[]=[],checks:any[]=[],fingerprint=(p:any[])=>JSON.stringify(p.map(p=>[p.id,p.rgb,p.strength]));
for(const [stage,[id,name,title,wanted]] of choices.entries()){
 const entry=entries.find(e=>e.a.p.id===id);if(!entry)throw Error(id);const {a,row}=entry,p=a.p;
 const checkPath=`${out}/check-${stage}.json`;
 let check:any;
 if(existsSync(checkPath))check=JSON.parse(readFileSync(checkPath,'utf8'));
 else{
  const seed=613991+stage*997,c=challengeLegOrders(p.paints,p.start,p.target,a.summary.rawMinimum-1,seed,384,20);
  check={id,seed,samples:384,restarts:20,evaluations:c.evaluations,bestByDepth:c.best.map(e=>e/T),counterexamples:c.routes.filter(r=>r.error<=T)};
  writeFileSync(checkPath,JSON.stringify(check));
 }
 if(check.id!==id||check.counterexamples.length)throw Error('Fresh shortcut check disagrees: '+id);
 checks.push(check);
 const key=fingerprint(p.paints);let level=PLAY_LEVELS.slice(0,offset).findIndex(l=>fingerprint(l.paints)===key);
 if(level<0){const at=palettes.findIndex(l=>fingerprint(l.paints)===key);level=offset+(at<0?palettes.length:at);if(at<0)palettes.push({name,subtitle:p.paints.map((p:any)=>p.name).join(' · '),paints:p.paints,tolerance:T,labOnly:true});}
 const convert=(m:any)=>{
  const execution=legExecution(m.legs);if(execution.some(e=>!e.times))return null;
  const order:number[]=[],times:number[]=[];for(const e of execution)for(const time of e.times!){order.push(e.paint);times.push(time);}
  let q=p.start;for(let i=0;i<order.length;i++){q=premixStep(q,order[i],times[i],'normalized').after;if(i<order.length-1&&colorDistance(mixtureColor(p.paints,q),p.target)<=T)return null;}
  const error=colorDistance(mixtureColor(p.paints,q),p.target);if(error>T)return null;
  const windows=acceptedIntervals(t=>colorDistance(mixtureColor(p.paints,premixReplay(p.start,order,[...times.slice(0,-1),t],'normalized')),p.target)<=T);
  const w=windows.find(w=>times.at(-1)!>=w.lo-1e-6&&times.at(-1)!<=w.hi+1e-6);
  const geometry=legGeometry(p.paints,p.start,p.target,m.legs,192);
  return{order,times,error,finishWindowMs:w?(w.hi-w.lo)*1000:0,setupCoverage:m.setupCoverage,supported:m.supported,legCount:m.legs.length,finishShareWidth:m.finishWidth,proportionSupported:m.supported,traits:geometry.traits,allMeaningful:geometry.allMeaningful};
 };
 const routes=a.measured.map(convert).filter(Boolean).sort((a:any,b:any)=>a.legCount-b.legCount||b.finishWindowMs-a.finishWindowMs);
 const efficient=routes.filter((r:any)=>r.legCount===a.summary.rawMinimum&&r.supported&&r.allMeaningful&&r.finishWindowMs>=25);
 if(!efficient.length)throw Error('No supported executable example '+id);
 const feature=efficient.find((r:any)=>r.traits[wanted])??efficient[0],style=feature.traits[wanted]?wanted:'interior-assembly';
 const shortest={...routes[0],label:`Shortest found · ${routes[0].legCount} pigment legs`};
 const alternatives=[shortest,...efficient.filter((r:any)=>r.order[0]!==feature.order[0]).map((r:any)=>({...r,label:'Different first pigment'})),...routes.map((r:any)=>({...r,label:'Efficient alternative'}))];
 const rivals:any[]=[];for(const r of alternatives){if(rivals.length>=6)break;if(!rivals.some(x=>x.order.join()===r.order.join()&&x.times.every((t:number,i:number)=>Math.abs(t-r.times[i])<1e-7)))rivals.push(r);}
 const matched=efficient.filter((r:any)=>r.traits[style]).length;
 const brief=`From the earlier destination-conditioned bank, newly playable here. ${stage===0||stage===6||stage===11?'This target is identical across three palettes: compare how the corrections feel. ':''}${a.summary.rawMinimum===2?'A deliberate shorter contrast, not a claimed harder three-leg puzzle. ':''}The ${wanted} request ${style===wanted?'has an executable efficient example':'did not survive as a finishing style; assess this as interior play'}. Try naturally, then compare a different first pigment. Style is available, not guaranteed or necessary.`;
 holes.push({id:`conditioned-lab-1-${stage}`,level,stage,style,title,initial:p.start,targetRGB:p.target.rgb,paints:p.paints.map((p:any)=>[p.id,p.rgb,p.strength]),collection:'conditioned',role:'new',lab:{brief,method:'destination-conditioned',sourceId:id,searchIntent:row.requested,exploratory:false,rawLegMinimum:a.summary.rawMinimum,regionLegMinimum:a.summary.robustMinimum,styleStatus:`${matched}-of-${efficient.length}-executable-efficient-examples`,featuredLegs:feature.legCount},modes:{normalized:{order:feature.order,times:feature.times,error:feature.error,minimum:shortest.times.length,measurement:{...feature,label:'Featured efficient example'},rivals}}});
 console.log(JSON.stringify({stage:stage+1,id,style,min:a.summary.rawMinimum,window:Math.round(feature.finishWindowMs),shorterMargin:Math.min(...check.bestByDepth)}));
}
const output={version:'conditioned-lab-1',seed:613991,paletteOffset:offset,palettes,tolerance:T,holes};
if(old&&JSON.stringify(old)!==JSON.stringify(output))throw Error('Published bank is immutable');
writeFileSync(path,JSON.stringify(output));
writeFileSync(out+'/selection.json',JSON.stringify({source:'conditioned-branch-search-1 and -2; predates the new region comparison',holes:holes.map(h=>({id:h.id,title:h.title,sourceId:h.lab.sourceId,style:h.style,minimum:h.lab.rawLegMinimum})),checks:checks.map(c=>({id:c.id,bestByDepth:c.bestByDepth,evaluations:c.evaluations})),unchanged:['pigments','normalized mass','tolerance','par','controls']},null,2));
