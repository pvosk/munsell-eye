// Offline, bidirectional experience audit. Historical labels/banks are untouched.
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,addPaint,chargeAmount,totalMass,pourPath,colorDistance} from './play-engine';
import {makeAtlas} from './play-course-analysis';
import {searchAuditRoutes} from './play-route-audit';
import {measureDesignRoute,type DesignRoute} from './play-route-design';
import {measureSetup} from './play-route-analysis';

export const EXPERIENCE_POLICY=Object.freeze({version:'experience-1-bidirectional',finishMs:55,setupCoverage:.04,minimumTravel:14,
  pureSeparation:1.8,rideLength:36,chromaticFraction:.8,shiftMagnitude:.10,setupTravel:6,finishTravel:9});
export type Experience='ride'|'rise'|'drop'|'value-shift';
export function shiftDirection(r:Pick<DesignRoute,'times'|'meaningfulPours'|'setupTravel'|'lastLength'|'finishValue'>):'rise'|'drop'|null{
  if(r.times.length<2||r.meaningfulPours<2||r.setupTravel<EXPERIENCE_POLICY.setupTravel||r.lastLength<EXPERIENCE_POLICY.finishTravel||Math.abs(r.finishValue)<=EXPERIENCE_POLICY.shiftMagnitude)return null;
  return r.finishValue>0?'rise':'drop';
}
export function experienceMatches(r:DesignRoute,s:Experience){
  if(s==='ride')return r.longestChromaticPour>=EXPERIENCE_POLICY.rideLength&&r.chromaticFraction>=EXPERIENCE_POLICY.chromaticFraction;
  const direction=shiftDirection(r);return s==='value-shift'?direction!==null:direction===s;
}
export function experienceSupported(r:DesignRoute){return r.finishWindowMs>=EXPERIENCE_POLICY.finishMs&&(r.times.length===1||!!r.setup&&r.setup.coverage>=EXPERIENCE_POLICY.setupCoverage);}
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function rideShape(palette:number,r:DesignRoute){
  const paints=PLAY_LEVELS[palette].paints;let q=paints.map((_,i)=>+(i===r.order[0]));
  let longest=0,arcRatio=1,bow=0;
  for(let i=0;i<r.times.length;i++){
    const amount=chargeAmount(totalMass(q),r.times[i]),path=pourPath(paints,q,r.order[i+1],amount,64);let length=0,colored=0;
    for(let j=1;j<path.length;j++){const d=distance(path[j].position,path[j-1].position);length+=d;if(Math.min(Math.hypot(...path[j].lab.slice(1)),Math.hypot(...path[j-1].lab.slice(1)))>=.06)colored+=d;}
    if(length>longest&&colored/length>=.8){
      longest=length;const a=path[0].position,b=path.at(-1)!.position,axis=b.map((v,j)=>v-a[j]),chord=distance(a,b);
      arcRatio=length/Math.max(chord,1e-9);bow=Math.max(...path.map(p=>{
        const t=Math.max(0,Math.min(1,p.position.reduce((s,v,j)=>s+(v-a[j])*axis[j],0)/Math.max(chord*chord,1e-18)));
        return distance(p.position,a.map((v,j)=>v+axis[j]*t));
      }));
    }q=addPaint(q,r.order[i+1],amount);
  }return {longest,arcRatio,bow};
}
export function analyzeExperience(palette:number,recipe:number[],atlas=makeAtlas(palette,128,24)){
  const {target,routes,errors}=searchAuditRoutes(palette,recipe,atlas),paints=PLAY_LEVELS[palette].paints;
  const bases=paints.map((_,base)=>{
    const found=routes.filter(r=>r.order[0]===base),fewest=found.length?Math.min(...found.map(r=>r.times.length)):null;
    const measured=found.filter(r=>r.times.length===fewest).map(r=>({...measureDesignRoute(palette,r,target,false,LIVE_LANDING_TOLERANCE),efficient:true}));
    // Group on the NEW direction, not the old lift-only trait. Keep non-style
    // variants and weak endpoints, not just an attractive direction witness.
    const groups=new Map<string,DesignRoute[]>();
    for(const r of measured){const key=JSON.stringify([r.order,r.meaningfulPours,shiftDirection(r),experienceMatches(r,'ride')]);const g=groups.get(key)??[];g.push(r);groups.set(key,g);}
    const kept:DesignRoute[]=[];
    for(const g of groups.values()){
      const seeds=[...g].sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,1);
      for(const compare of [(a:DesignRoute,b:DesignRoute)=>a.longestChromaticPour-b.longestChromaticPour,(a:DesignRoute,b:DesignRoute)=>Math.abs(a.finishValue)-Math.abs(b.finishValue),(a:DesignRoute,b:DesignRoute)=>a.length-b.length]){
        const r=[...g].filter(r=>r.finishWindowMs>=EXPERIENCE_POLICY.finishMs).sort(compare)[0];if(r&&!seeds.includes(r))seeds.push(r);
      }
      for(const r of seeds){if(r.finishWindowMs>=EXPERIENCE_POLICY.finishMs&&r.times.length>1)r.setup=measureSetup(palette,r,target,LIVE_LANDING_TOLERANCE);kept.push(r);}
    }
    const supported=kept.filter(experienceSupported);
    return {base,fewest,bestOneError:errors[base].one,bestTwoError:errors[base].two,
      minimumTravel:measured.length?Math.min(...measured.map(r=>r.length)):0,
      viable:supported.some(r=>r.meaningfulPours>=Math.min(2,r.times.length)),routes:kept,
      meaningfulFloor:supported.length?Math.min(...supported.map(r=>r.meaningfulPours)):0};
  });
  const failures:string[]=[];
  const nearest=Math.min(...paints.map((_,i)=>colorDistance(mixtureColor(paints,paints.map((_,j)=>+(i===j))),target)))/LIVE_LANDING_TOLERANCE;
  if(nearest<EXPERIENCE_POLICY.pureSeparation)failures.push('near-pure-target');
  if(bases.some(b=>!b.viable))failures.push('unsupported-base');
  if(bases.some(b=>b.minimumTravel<EXPERIENCE_POLICY.minimumTravel))failures.push('short-competing-route');
  if(bases.some(b=>b.meaningfulFloor<Math.min(2,b.fewest??0)))failures.push('token-bypass');
  const styles=Object.fromEntries((['ride','rise','drop','value-shift'] as const).map(style=>{
    const available=bases.filter(b=>b.routes.some(r=>experienceSupported(r)&&experienceMatches(r,style))).map(b=>b.base);
    const bypass=bases.filter(b=>b.routes.some(r=>experienceSupported(r)&&!experienceMatches(r,style))).map(b=>b.base);
    const resistant=available.filter(b=>!bypass.includes(b));
    const safe=!failures.length&&(style==='ride'||bases.every(b=>(b.fewest??0)>=2));
    return [style,{available,resistant,bypass,opportunity:safe&&available.length/paints.length>=.5,
      everyBaseAvailable:safe&&available.length===paints.length,everyBaseResistant:safe&&resistant.length===paints.length}];
  })) as Record<Experience,{available:number[];resistant:number[];bypass:number[];opportunity:boolean;everyBaseAvailable:boolean;everyBaseResistant:boolean}>;
  return {version:EXPERIENCE_POLICY.version,palette,recipe,target,failures,bases,styles,nearest,
    minimumTravel:Math.min(...bases.map(b=>b.minimumTravel)),
    rideFloor:Math.min(...bases.map(b=>Math.min(b.minimumTravel,...b.routes.filter(experienceSupported).map(r=>r.longestChromaticPour))))};
}
