import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type PlayLevel} from '../app/play-engine';
import {legExecution} from '../app/play-pigment-legs';
import {premixReplay,premixStep} from '../app/play-premix';
import {acceptedIntervals} from './premix-region-metrics';
const path='app/generated/play-branch-lab.json',old=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null,offset=old?.paletteOffset??PLAY_LEVELS.length;
const results=readBankJson('docs/branching-region-refinement-1/results.json');
const selections=[
 {parent:'branch-817913-326-0-1-region',name:'Hansa · Scarlet · Violet',title:'Different corrections',brief:'A three-leg setup with alternative ingredient sets. Which first pigment makes the next correction legible? Compare the branches after your own attempt.'},
 {parent:'branch-817913-233-3-1-region',name:'Earth Orange · Cobalt Green',title:'Earth and cool counterweights',brief:'Earth orange, cobalt green, maroon and Prussian blue. Three-leg balancing without a white tube; the alternatives mostly reorder the same ingredients. Does each order create a different correction problem?'},
 {parent:'branch-817913-338-0-1-center',name:'Emerald · Yellow · Scarlet',title:'Choose a different set',brief:'A second three-leg case with alternative ingredient sets. Does the extra choice make a satisfying setup, or do the paints reveal an obvious answer?'},
 {parent:'branch-817913-3-6-1-center',name:'RYB',title:'RYB branching setup',brief:'A new RYB start and target, not the previous liked hole. Three-leg alternatives primarily change order. Does it retain the paint-choice tension you liked?'}
];
const palettes:PlayLevel[]=[],holes:any[]=[],fingerprint=(p:any[])=>JSON.stringify(p.map(p=>[p.id,p.rgb,p.strength]));
for(const [stage,s] of selections.entries()){
 const row=results.find((r:any)=>r.parent===s.parent);if(!row)throw Error(s.parent);const a=row.audit,p=a.p;
 const key=fingerprint(p.paints);let level=PLAY_LEVELS.slice(0,offset).findIndex(l=>fingerprint(l.paints)===key);
 if(level<0){level=offset+palettes.length;palettes.push({name:s.name,subtitle:p.paints.map((p:any)=>p.name).join(' · '),paints:p.paints,tolerance:T,labOnly:true});}
 const convert=(m:any,label:string)=>{
  const execution=legExecution(m.legs);if(execution.some(e=>!e.times))return null;
  const order:number[]=[],times:number[]=[];for(const e of execution)for(const time of e.times!){order.push(e.paint);times.push(time);}
  let q=p.start;for(let i=0;i<order.length;i++){q=premixStep(q,order[i],times[i],'normalized').after;if(i<order.length-1&&colorDistance(mixtureColor(p.paints,q),p.target)<=T)return null;}
  const error=colorDistance(mixtureColor(p.paints,q),p.target);if(error>T)return null;
  const windows=acceptedIntervals(t=>colorDistance(mixtureColor(p.paints,premixReplay(p.start,order,[...times.slice(0,-1),t],'normalized')),p.target)<=T);
  const w=windows.find(w=>times.at(-1)!>=w.lo-1e-6&&times.at(-1)!<=w.hi+1e-6);
  return{label,order,times,error,finishWindowMs:w?(w.hi-w.lo)*1000:0,setupCoverage:m.setupCoverage,supported:m.supported,legCount:m.legs.length,finishShareWidth:m.finishWidth,proportionSupported:m.supported,traits:m.traits};
 };
 const branches=row.witnesses.map((m:any,i:number)=>convert(m,`Refined branch ${i===0?'A':'B'}`));
 if(branches.some((b:any)=>!b||b.finishWindowMs<25))throw Error('Unplayable refined pair '+s.parent);
 const alternatives=a.measured.map((m:any)=>convert(m,'Efficient alternative')).filter(Boolean).sort((a:any,b:any)=>a.legCount-b.legCount||b.finishWindowMs-a.finishWindowMs);
 if(alternatives[0]?.legCount!==3||a.summary.rawMinimum!==3)throw Error('Unexpected minimum');
 const set=(r:any)=>[...new Set(r.order)].sort().join(),other=alternatives.find((r:any)=>r.legCount===3&&r.proportionSupported&&set(r)!==set(branches[0]));
 const shortest={...alternatives[0],label:'Shortest found · 3 pigment legs'};
 const rivals:any[]=[];for(const r of [branches[1],...(other?[{...other,label:'Different ingredient set'}]:[]),shortest,...alternatives]){
  if(rivals.length>=6)break;if(!rivals.some(x=>x.order.join()===r.order.join()&&x.times.every((t:number,i:number)=>Math.abs(t-r.times[i])<1e-7)))rivals.push(r);
 }
 if(stage===0||stage===2){if(!other)throw Error('Missing alternative ingredient set');}
 const feature=branches[0],style='interior-assembly';
 holes.push({id:'branch-lab-1-'+stage,level,stage,style,title:s.title,initial:p.start,targetRGB:p.target.rgb,paints:p.paints.map((p:any)=>[p.id,p.rgb,p.strength]),collection:'branches',role:'new',
  lab:{brief:s.brief,method:'branch-refined',sourceId:p.id,searchIntent:null,exploratory:false,rawLegMinimum:3,regionLegMinimum:a.summary.robustMinimum,styleStatus:a.summary.styles[style].status,featuredLegs:3},
  modes:{normalized:{order:feature.order,times:feature.times,error:feature.error,minimum:shortest.times.length,measurement:feature,rivals}}});
 console.log(JSON.stringify({title:s.title,level,windows:branches.map((b:any)=>Math.round(b.finishWindowMs)),differentSet:!!other}));
}
const output={version:'branch-lab-1',seed:139180,paletteOffset:offset,palettes,tolerance:T,holes};
if(old&&JSON.stringify(old)!==JSON.stringify(output))throw Error('Published bank is immutable');writeFileSync(path,JSON.stringify(output));
