import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type PlayLevel} from '../app/play-engine';
import {legExecution,type PigmentLeg} from '../app/play-pigment-legs';
import {premixReplay,premixStep} from '../app/play-premix';
import {acceptedIntervals} from './premix-region-metrics';
const path='app/generated/play-pigment-leg-lab.json';
const previous=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
const offset=previous?.paletteOffset??PLAY_LEVELS.length;
const audits=[...readBankJson('docs/pigment-leg-audit-1/audits.json'),...[1,2].flatMap(n=>readBankJson(`docs/pigment-leg-search-${n}/audits.json`))];
const index=readBankJson('docs/pigment-leg-results-2/index.json');
const styleChecks=readBankJson('docs/pigment-leg-style-challenge-1/checks.json');
const selection=[
 {id:'leg-319171-25-15-palette-first',style:'drop',title:'Near, then away',brief:'A close-looking start with room for an outward setup and a value drop. Does it invite the excursion, or do you find a cleaner approach?',sort:'finish'},
 {id:'leg-319171-2-11-palette-first',style:'interior-assembly',title:'Three-color assembly',brief:'A stronger three-leg setup in familiar RYB. Look for meaningful pigment changes, not merely more releases.',sort:'short'},
 {id:'leg-113291-418-6-palette-first',style:'chromatic-ride',title:'Ochre to chroma',name:'Ochre · Emerald · Prussian',brief:'A colored finishing arc, with an efficient alternative available. Does your natural route feel like a ride?',sort:'hue'},
 {id:'leg-319171-51-17-route-first',style:'rise',title:'Umber into light',name:'Umber · Violet · Blue',brief:'A lighter value finish in a wider, earth-and-blue palette. Was the setup interesting, or mainly preparation for one satisfying shot?',sort:'finish'},
 {id:'leg-113291-301-19-palette-first',style:'coupled-balance',title:'Chromatic counterweights',name:'Rose · Mars · Green',brief:'Three-leg structure without a white or black tube. Do the colored corrections create a useful tension?',sort:'short'},
 {id:'leg-113291-9-4-route-first',style:'coupled-balance',title:'Ember alternatives',brief:'A route-first Cobalt Ember specimen with competing efficient orders. Explore freely before comparing the examples.',sort:'short'},
 {id:'leg-113291-298-11-palette-first',style:'rise',title:'Lemon-driven lift',name:'Lemon · Violet · Earth',brief:'A bright chromatic paint supplies the value change. Compare the feel with the wider Umber palette, not just the score.',sort:'finish'},
 {id:'region-1-29-4-3-interior-assembly',style:'coupled-balance',title:'Zorn reference',brief:'The previously liked Zorn interior is back as a reference. Does it still feel stronger than the new cases?',sort:'short',reference:true},
 {id:'leg-319171-446-5-route-first',style:'rise',title:'Long way into light',name:'Manganese · Viridian · Orange',brief:'Longer-route exploration: a four-leg example exists, but a two-leg alternative is known. Does the longer journey add anything worth keeping?',sort:'demo',exploratory:true},
 {id:'leg-113291-282-14-palette-first',style:'coupled-balance',title:'Blue-family excursion',name:'Violet · Blue · Gold',brief:'Another four-leg example with a known two-leg alternative. Is the branching blue/violet journey compelling, or avoidable effort?',sort:'demo',exploratory:true},
];
const palettes:PlayLevel[]=[],holes:any[]=[];
const fingerprint=(paints:any[])=>JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]));
for(const [stage,s] of selection.entries()){
 const a=audits.find(a=>a.p.id===s.id);if(!a)throw Error('Missing '+s.id);
 const p=a.p,key=fingerprint(p.paints),known=PLAY_LEVELS.slice(0,offset).findIndex(l=>fingerprint(l.paints)===key);
 let level=known;
 if(level<0){const local=palettes.findIndex(l=>fingerprint(l.paints)===key);if(local>=0)level=offset+local;else{level=offset+palettes.length;palettes.push({name:s.name??p.paletteName,subtitle:p.paints.map((p:any)=>p.name).join(' · '),paints:p.paints,tolerance:T,labOnly:true});}}
 const convert=(m:any,label:string)=>{
  const execution=legExecution(m.legs);if(execution.some(e=>!e.times))return null;
  const order:number[]=[],times:number[]=[];
  for(const e of execution)for(const time of e.times!){order.push(e.paint);times.push(time);}
  let q=p.start;
  for(let i=0;i<order.length;i++){q=premixStep(q,order[i],times[i],'normalized').after;if(i<order.length-1&&colorDistance(mixtureColor(p.paints,q),p.target)<=T)return null;}
  const error=colorDistance(mixtureColor(p.paints,q),p.target);if(error>T)return null;
  const intervals=acceptedIntervals(t=>colorDistance(mixtureColor(p.paints,premixReplay(p.start,order,[...times.slice(0,-1),t],'normalized')),p.target)<=T);
  const interval=intervals.find(w=>times.at(-1)!>=w.lo-1e-6&&times.at(-1)!<=w.hi+1e-6);
  const finishWindowMs=interval?(interval.hi-interval.lo)*1000:0;
  return {label,order,times,error,finishWindowMs,setupCoverage:m.setupCoverage,supported:m.supported,legCount:m.legs.length,legs:m.legs as PigmentLeg[],finishShareWidth:m.finishWidth,proportionSupported:m.supported,travel:m.setup+m.finish,finish:m.finish,traits:m.traits};
 };
 const candidates=a.measured.filter((m:any)=>m.supported&&m.allMeaningful&&m.traits[s.style]&&(s.exploratory?m.source==='demonstration':m.legs.length===a.summary.rawMinimum))
  .map((m:any)=>({m,r:convert(m,'Featured example')})).filter((x:any)=>x.r&&x.r.finishWindowMs>=25);
 candidates.sort((x:any,y:any)=>s.sort==='short'?(x.m.setup+x.m.finish)-(y.m.setup+y.m.finish):s.sort==='hue'?y.m.hueTravel-x.m.hueTravel:y.m.finish-x.m.finish);
 if(!candidates.length)throw Error('No executable feature '+s.id);
 const feature=candidates[0].r!;
 const alternatives=a.measured.map((m:any)=>convert(m,'Alternative')).filter(Boolean).sort((x:any,y:any)=>x.legCount-y.legCount||x.times.length-y.times.length||y.finishWindowMs-x.finishWindowMs);
 const shortest=alternatives[0];if(!shortest||shortest.legCount!==a.summary.rawMinimum)throw Error('Minimum not executable '+s.id);
 shortest.label=`Shortest found · ${shortest.legCount} pigment legs`;
 const counter=styleChecks.find((x:any)=>x.id===s.id),bypass=counter?.supportedBypasses[s.style]??counter?.rawBypasses[s.style];
 const perOrder=alternatives.filter((r:any,i:number,all:any[])=>all.findIndex(x=>x.order.join()===r.order.join())===i);
 const witnesses=[shortest,...(bypass?[convert(bypass,'Style-bypassing alternative')]:[]),...perOrder,...alternatives].filter(Boolean);
 // Same pigment order with different accepted fractions can be the important
 // counterexample. Preserve it, then use remaining slots for order diversity.
 const rivals:any[]=[];for(const r of witnesses){if(rivals.length>=6)break;if(!rivals.some(x=>x.order.join()===r!.order.join()&&x.times.every((t:number,i:number)=>Math.abs(t-r!.times[i])<1e-6)))rivals.push(r);}
 const c=index.candidates.find((x:any)=>x.id===s.id);
 holes.push({id:'leg-lab-1-'+stage+'-'+s.id,level,stage,style:s.style,title:s.title,initial:p.start,targetRGB:p.target.rgb,paints:p.paints.map((p:any)=>[p.id,p.rgb,p.strength]),collection:'legs',role:s.reference?'reference-liked':'new',
  lab:{brief:s.brief,method:s.reference?'reference':a.method,sourceId:s.id,searchIntent:a.intent??null,exploratory:!!s.exploratory,rawLegMinimum:a.summary.rawMinimum,regionLegMinimum:a.summary.robustMinimum,styleStatus:c?.styles[s.style].status??'historical-reference',featuredLegs:feature.legCount},
  modes:{normalized:{order:feature.order,times:feature.times,error:feature.error,minimum:shortest.times.length,measurement:feature,rivals}}});
 console.log(JSON.stringify({stage:stage+1,title:s.title,palette:known>=0?PLAY_LEVELS[known].name:palettes[level-offset].name,legs:feature.legCount,releases:feature.times.length,minimum:a.summary.rawMinimum,window:Math.round(feature.finishWindowMs)}));
}
const output={version:'pigment-leg-lab-1',seed:131179,paletteOffset:offset,palettes,tolerance:T,selection:'Ten contrasting premix experiences: six palette-first, three route-first, one familiar reference. Labels are opportunities; two longer examples have explicit shortcuts. Constant par 3; unchanged controls and pigments.',holes};
if(previous&&JSON.stringify(previous)!==JSON.stringify(output)&&process.env.LEG_LAB_REBUILD!=='unpublished')throw Error('Existing lab differs; preserve it');
writeFileSync(path,JSON.stringify(output));
