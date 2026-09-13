import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type Mixture,type ColorPoint} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {canonicalLegs,legStep,legReplay,legExecution,type PigmentLeg} from '../app/play-pigment-legs';
export const LEG_METRIC_POLICY={version:'leg-regions-1',finishShareWidth:.025,setupCoverage:.04,setupRadius:.12,meaningfulDistanceT:1.25};
export const LEG_STYLES=['rise','drop','chromatic-ride','setup-glide','coupled-balance','interior-assembly'] as const;
export type LegStyle=typeof LEG_STYLES[number];
export function legGeometry(paints:PaintColor[],start:Mixture,target:ColorPoint,input:PigmentLeg[],samples=48){
 const legs=canonicalLegs(input),stops=[mixtureColor(paints,start)],paths:ColorPoint[][]=[];let q=start;
 for(const leg of legs){const path=Array.from({length:samples+1},(_,i)=>mixtureColor(paints,legStep(q,{...leg,share:leg.share*i/samples})));paths.push(path);q=legStep(q,leg);stops.push(path.at(-1)!);}
 const delta=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]),norm=(x:number[])=>Math.hypot(...x);
 const lengths=paths.map(path=>path.slice(1).reduce((s,p,i)=>s+colorDistance(p,path[i]),0));
 const changes=stops.slice(1).map((p,i)=>delta(p.lab,stops[i].lab));
 const last=paths.at(-1)??[],d=changes.at(-1)??[0,0,0],finish=lengths.at(-1)??0,setup=lengths.slice(0,-1).reduce((a,b)=>a+b,0);
 let chromaticLength=0,hueTravel=0,abTravel=0;
 for(let i=1;i<last.length;i++){
  const a=last[i-1],b=last[i],ca=norm(a.lab.slice(1)),cb=norm(b.lab.slice(1));
  abTravel+=norm(delta(a.lab.slice(1),b.lab.slice(1)));
  if(Math.min(ca,cb)>=.06){chromaticLength+=colorDistance(a,b);const h=Math.atan2(b.lab[2],b.lab[1])-Math.atan2(a.lab[2],a.lab[1]);hueTravel+=Math.abs(Math.atan2(Math.sin(h),Math.cos(h)));}
 }
 const deletionErrors=legs.map((_,i)=>colorDistance(mixtureColor(paints,legReplay(start,legs.filter((_,j)=>i!==j))),target));
 const meaningful=changes.filter(d=>norm(d)>=T*LEG_METRIC_POLICY.meaningfulDistanceT).length;
 const allMeaningful=meaningful===legs.length&&deletionErrors.every(e=>e>T);
 const residual=(p:ColorPoint)=>[Math.abs(p.lab[0]-target.lab[0]),norm(delta(p.lab.slice(1),target.lab.slice(1)))];
 const initial=residual(stops[0]),end=residual(stops.at(-1)!),before=residual(stops.at(-2)??stops[0]);
 let tradeoff=0;
 for(let i=1;i<stops.length-1;i++){const a=residual(stops[i-1]),b=residual(stops[i]),v=a[0]-b[0],c=a[1]-b[1];if(v>0&&c<0&&b[1]-end[1]>.012)tradeoff=Math.max(tradeoff,Math.min(v,-c));if(c>0&&v<0&&b[0]-end[0]>.012)tradeoff=Math.max(tradeoff,Math.min(c,-v));}
 const setupPresent=legs.length>=2&&allMeaningful&&setup>=.045;
 const valueFinish=setupPresent&&Math.abs(d[0])>=.075&&Math.abs(d[0])/Math.max(norm(d),1e-12)>=.75&&before[0]-end[0]>=.055;
 const traits:Record<LegStyle,boolean>={rise:valueFinish&&d[0]>0,drop:valueFinish&&d[0]<0,
  'chromatic-ride':setupPresent&&finish>=.14&&chromaticLength/Math.max(finish,1e-12)>=.7&&hueTravel>=.35,
  'setup-glide':setupPresent&&finish>=.12&&finish>=Math.max(...lengths.slice(0,-1))*1.15&&abTravel>=.04,
  'coupled-balance':setupPresent&&tradeoff>=.012,
  'interior-assembly':allMeaningful&&legs.length>=3&&norm(target.lab.slice(1))<.12};
 const initialDistance=colorDistance(stops[0],target);
 return{legs,error:colorDistance(stops.at(-1)!,target),lengths,finish,setup,meaningful,allMeaningful,deletionErrors,tradeoff,hueTravel,abTravel,chromaticFraction:chromaticLength/Math.max(finish,1e-12),value:d[0],initialDistance,initialAB:initial[1],excursion:Math.max(0,...stops.map(p=>colorDistance(p,target)-initialDistance)),traits};
}
export function fractionIntervals(success:(share:number)=>boolean,anchor:number,steps=128){
 const xs=[...Array.from({length:steps+1},(_,i)=>Math.min(1-1e-9,i/steps)),anchor].sort((a,b)=>a-b).filter((v,i,a)=>!i||v>a[i-1]);
 const intervals:{lo:number;hi:number}[]=[];let previous=success(xs[0]),open:number|null=previous?xs[0]:null;
 const edge=(a:number,b:number)=>{const sa=success(a);for(let k=0;k<20;k++){const m=(a+b)/2;if(success(m)===sa)a=m;else b=m;}return(a+b)/2;};
 for(let i=1;i<xs.length;i++){const current=success(xs[i]);if(current&&!previous)open=edge(xs[i-1],xs[i]);if(!current&&previous){intervals.push({lo:open!,hi:edge(xs[i-1],xs[i])});open=null;}previous=current;}
 if(open!==null)intervals.push({lo:open,hi:xs.at(-1)!});return intervals;
}
export function measureLegRegion(paints:PaintColor[],start:Mixture,target:ColorPoint,input:PigmentLeg[],setupSteps=5){
 const geometry=legGeometry(paints,start,target,input),legs=geometry.legs;
 if(!legs.length)return{...geometry,intervals:[],finishWidth:0,setupCoverage:0,setupCells:0,supported:false,execution:[],sensitivity:{low:false,standard:false,high:false}};
 const success=(shares:number[])=>colorDistance(mixtureColor(paints,legReplay(start,legs.map((leg,i)=>({...leg,share:shares[i]})))),target)<=T;
 const shares=legs.map(l=>l.share),intervals=fractionIntervals(x=>success([...shares.slice(0,-1),x]),shares.at(-1)!);
 const local=intervals.find(w=>shares.at(-1)!>=w.lo-1e-8&&shares.at(-1)!<=w.hi+1e-8),finishWidth=local?local.hi-local.lo:0;
 let cells=0,accepted=0;
 const walk=(prefix:number[])=>{if(prefix.length===legs.length-1){cells++;if(Array.from({length:65},(_,i)=>Math.min(1-1e-9,i/64)).some(x=>success([...prefix,x])))accepted++;return;}
  const center=shares[prefix.length],lo=Math.max(0,center-.12),hi=Math.min(1-1e-9,center+.12);for(let i=0;i<setupSteps;i++)walk([...prefix,lo+(hi-lo)*i/(setupSteps-1)]);};walk([]);
 const setupCoverage=accepted/cells,support=(width:number)=>geometry.error<=T&&finishWidth>=width&&setupCoverage>=LEG_METRIC_POLICY.setupCoverage;
 return{...geometry,intervals,finishWidth,setupCoverage,setupCells:cells,supported:support(LEG_METRIC_POLICY.finishShareWidth),execution:legExecution(legs),sensitivity:{low:support(.01),standard:support(.025),high:support(.05)}};
}
export function summarizeLegStyles(rows:ReturnType<typeof measureLegRegion>[],rawMinimum:number|null,unmeasured:number){
 const supported=rows.filter(r=>r.supported),robustMinimum=supported.length?Math.min(...supported.map(r=>r.legs.length)):null;
 const efficient=supported.filter(r=>r.legs.length===robustMinimum),rawEfficient=rows.filter(r=>r.error<=T&&r.legs.length===rawMinimum);
 return{rawMinimum,robustMinimum,unmeasured,styles:Object.fromEntries(LEG_STYLES.map(style=>{
  const matches=efficient.filter(r=>r.traits[style]),bypasses=efficient.filter(r=>!r.traits[style]);
  return[style,{status:!matches.length?(rows.some(r=>r.traits[style])?'available-only':'not-observed'):bypasses.length?'competitive':unmeasured?'unopposed-in-measured-routes':'unopposed-in-tested-routes',efficient:efficient.length,matches:matches.length,rawBypasses:rawEfficient.filter(r=>!r.traits[style]).map(r=>r.legs),robustBypasses:bypasses.map(r=>r.legs)}];
 }))};
}
