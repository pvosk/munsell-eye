import {type JourneyAudit,type JourneyStyle,type JourneyRoute} from '../app/play-journey-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {stableRide} from './stable-route-measurement';
export const SELECTION_POLICY={version:'supported-minimum-experiment-1',coverage:2/3,unchangedTimingMs:55,unchangedLocalSetup:.04};
export const STYLES=['ride','value-shift','interior','balance'] as const;
export function compareSelection(a:JourneyAudit){
 const bases=a.bases.map(b=>{
  const supported=b.routes.filter(experienceSupported),fewest=supported.length?Math.min(...supported.map(r=>r.times.length)):null;
  return {base:b.base,rawFewest:b.fewest,supportedFewest:fewest,expertShorter:b.fewest!==null&&fewest!==null&&b.fewest<fewest,
   routes:supported.map(r=>({route:r,stable:stableRide(a.palette,r)}))};
 });
 const variant=(supportedMinimum:boolean)=>{
  const efficient=(base:typeof bases[number])=>base.routes.filter(r=>r.route.times.length===(supportedMinimum?base.supportedFewest:base.rawFewest));
  const failures=a.failures.filter(f=>f!=='token-bypass');
  if(bases.some(b=>efficient(b).some(r=>r.route.meaningfulPours<Math.min(2,r.route.times.length))))failures.push('token-bypass');
  return {failures,styles:Object.fromEntries(STYLES.map(style=>{
   const has=(b:typeof bases[number],value:boolean)=>efficient(b).some(r=>(style==='ride'?r.stable.ride:r.route.traits[style])===value);
   const available=bases.filter(b=>has(b,true)).map(b=>b.base),bypass=bases.filter(b=>has(b,false)).map(b=>b.base);
   const uncertain=style==='ride'?bases.filter(b=>efficient(b).some(r=>r.stable.ride===null)).map(b=>b.base):[];
   const resistant=available.filter(b=>!bypass.includes(b)&&!uncertain.includes(b));
   const structural=style!=='interior'||bases.every(b=>(supportedMinimum?b.supportedFewest:b.rawFewest)===3&&(supportedMinimum||a.bases[b.base].bestTwoError>1.1)&&efficient(b).every(r=>r.route.meaningfulPours===3));
   const eligible=!failures.length&&structural&&available.length/bases.length>=SELECTION_POLICY.coverage;
   return [style,{available,bypass,resistant,uncertain,eligible,allAvailable:eligible&&available.length===bases.length,allResistant:eligible&&resistant.length===bases.length}];
  })) as Record<JourneyStyle,{available:number[];bypass:number[];resistant:number[];uncertain:number[];eligible:boolean;allAvailable:boolean;allResistant:boolean}>};
 };
 return {bases,stableRaw:variant(false),stableSupported:variant(true)};
}
export function compactWitness(r:JourneyRoute){return {order:r.order,times:r.times,error:r.error,finishWindowMs:r.finishWindowMs,setup:r.setup,meaningfulPours:r.meaningfulPours,traits:r.traits,length:r.length,valueFinish:r.valueFinish};}
