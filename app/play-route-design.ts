// Offline design engine. Existing banks keep their original evaluator/results.
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,CHARGE_SECONDS,addPaint,chargeAmount,totalMass,mixtureColor,colorDistance,pourPath,type Mixture,type ColorPoint} from './play-engine';
import {routeDetails,makeAtlas,geometry,type Route} from './play-course-analysis';
import {measureRoute,searchCompetingRoutes,type MeasuredRoute,type HoleAnalysis,type RouteStyle} from './play-route-analysis';

export const DESIGN_VERSION='routes-2';
export type DesignStyle='chromatic-ride'|'setup-lift'|'coupled-balance'|'interior-weave';
export type DesignRoute=MeasuredRoute & {chromaticFraction:number;longestChromaticPour:number;opposedPairs:number;coupledPairs:number;setupTravel:number;lift:boolean;balance:boolean;efficient:boolean};
export type DesignAnalysis=Omit<HoleAnalysis,'style'|'bases'> & {
  style:DesignStyle;tolerance:number;styleBases:number[];nearestBase:number;
  bases:(Omit<HoleAnalysis['bases'][number],'routes'> & {routes:DesignRoute[]})[];
};
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const chroma=(p:ColorPoint)=>Math.hypot(p.lab[1],p.lab[2]);
export function secondsForAmount(mass:number,amount:number):number|null {
  const ratio=amount/Math.max(1,mass)**.8;
  if(ratio<.005-1e-10||ratio>8+1e-10)return null;
  const power=((Math.max(.005,Math.min(8,ratio))-.005)/7.995)**.25;
  return CHARGE_SECONDS*(1-(1-power)**(1/3));
}

// Merge consecutive equal-paint doses only when one LEGAL charge can carry
// their sum. Reconstruct later doses by mass, preserving the exact mixture.
export function mergeSplitPours(palette:number,r:Route,target:ColorPoint,tolerance=LIVE_LANDING_TOLERANCE):Route {
  let mass=1;const doses:{paint:number;amount:number}[]=[];
  for(let i=0;i<r.times.length;i++){const amount=chargeAmount(mass,r.times[i]);doses.push({paint:r.order[i+1],amount});mass+=amount;}
  const compact:typeof doses=[];mass=1;
  for(const d of doses){const prev=compact.at(-1);
    if(prev?.paint===d.paint&&secondsForAmount(mass-prev.amount,prev.amount+d.amount)!==null){prev.amount+=d.amount;mass+=d.amount;}
    else{compact.push({...d});mass+=d.amount;}
  }
  mass=1;const times:number[]=[];
  for(const d of compact){const t=secondsForAmount(mass,d.amount);if(t===null)return r;times.push(t);mass+=d.amount;}
  return routeDetails(palette,[r.order[0],...compact.map(d=>d.paint)],times,target,tolerance);
}

export function measureDesignRoute(palette:number,route:Route,target:ColorPoint,deep=false,tolerance=LIVE_LANDING_TOLERANCE):DesignRoute {
  const r=mergeSplitPours(palette,route,target,tolerance),m=measureRoute(palette,r,target,deep,tolerance),paints=PLAY_LEVELS[palette].paints;
  let q=paints.map((_,i)=>+(i===r.order[0])),length=0,coloredLength=0,longestChromaticPour=0;
  const stops=[mixtureColor(paints,q)];
  for(let i=0;i<r.times.length;i++){
    const amount=chargeAmount(totalMass(q),r.times[i]),path=pourPath(paints,q,r.order[i+1],amount,64);let n=0,c=0;
    for(let j=1;j<path.length;j++){const d=distance(path[j].position,path[j-1].position);n+=d;if(Math.min(chroma(path[j]),chroma(path[j-1]))>=.06)c+=d;}
    length+=n;coloredLength+=c;if(n&&c/n>=.8)longestChromaticPour=Math.max(longestChromaticPour,n);
    q=addPaint(q,r.order[i+1],amount);stops.push(mixtureColor(paints,q));
  }
  let opposedPairs=0,coupledPairs=0;
  for(let i=1;i<stops.length-1;i++){
    const a=stops[i].lab.map((v,j)=>v-stops[i-1].lab[j]),b=stops[i+1].lab.map((v,j)=>v-stops[i].lab[j]);
    const ca=Math.hypot(a[1],a[2]),cb=Math.hypot(b[1],b[2]);
    const opposite=ca>.025&&cb>.025&&(a[1]*b[1]+a[2]*b[2])/(ca*cb)<-.25;
    const colored=(j:number)=>!['White','Black'].includes(paints[r.order[j]].category);
    if(opposite&&colored(i)&&colored(i+1))opposedPairs++;
    if(opposite&&((colored(i)&&Math.abs(a[0])>.07)||(colored(i+1)&&Math.abs(b[0])>.07)))coupledPairs++;
  }
  const setupTravel=m.pourLengths.slice(0,-1).reduce((a,b)=>a+b,0);
  // A white start is allowed, but cannot supply the measured final lift.
  // Global one-/two-pour competition decides whether this is an optional detour.
  const lift=r.times.length>=2&&m.meaningfulPours>=2&&setupTravel>=6&&m.finishValue>.10&&m.lastLength>=9;
  return {...m,chromaticFraction:length?coloredLength/length:0,longestChromaticPour,opposedPairs,coupledPairs,setupTravel,lift,balance:opposedPairs>0||coupledPairs>0,efficient:false};
}
export function matchesDesign(r:DesignRoute,style:DesignStyle):boolean {
  if(style==='chromatic-ride')return r.longestChromaticPour>=36&&r.chromaticFraction>=.8;
  if(style==='setup-lift')return r.lift;
  if(style==='coupled-balance')return r.balance&&r.meaningfulPours>=2;
  return r.times.length>=2&&r.meaningfulPours===r.times.length;
}
const routeStyle=(s:DesignStyle):RouteStyle=>s==='coupled-balance'?'complementary-balance':s;
export function analyzeDesign(palette:number,recipe:Mixture,style:DesignStyle,atlas=makeAtlas(palette,128,24),deep=true,tolerance=LIVE_LANDING_TOLERANCE):DesignAnalysis {
  const {target,errors,routes}=searchCompetingRoutes(palette,recipe,atlas,tolerance),paints=PLAY_LEVELS[palette].paints;
  const canonical=routes.map(r=>mergeSplitPours(palette,r,target,tolerance)).filter(r=>r.error<=tolerance);
  const bases=paints.map((_,base)=>{
    const all=canonical.filter(r=>r.order[0]===base),fewest=all.length?Math.min(...all.map(r=>r.times.length)):null;
    const shortestLengths=all.filter(r=>r.times.length===fewest).map(r=>geometry(palette,r).length);
    // Always retain the easiest found competitor. Style is only a secondary
    // choice among routes with the same addition count, never a hiding filter.
    const orders=new Map<string,Route>();
    for(const r of all){const k=r.order.join('-'),old=orders.get(k);if(!old||r.window>old.window)orders.set(k,r);}
    const measured=[...orders.values()].map(r=>measureDesignRoute(palette,r,target,false,tolerance));
    for(const r of measured)r.efficient=r.times.length===fewest;
    const efficient=measured.filter(r=>r.efficient).sort((a,b)=>b.finishWindowMs-a.finishWindowMs);
    const candidates=[...efficient.slice(0,1),...efficient.filter(r=>matchesDesign(r,style)).sort((a,b)=>b.finishWindowMs-a.finishWindowMs),...efficient.slice(1)];
    const retained:DesignRoute[]=[];
    for(const r of candidates){if(retained.some(x=>x.order.join()===r.order.join()))continue;
      const next=deep?measureDesignRoute(palette,r,target,true,tolerance):r;next.efficient=true;
      next.styles=matchesDesign(next,style)?[routeStyle(style)]:[];retained.push(next);if(retained.length===3)break;
    }
    const qualifies=retained.some(r=>r.finishWindowMs>=55&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04));
    return {base,fewestFound:fewest,bestOneError:errors[base].one,bestTwoError:errors[base].two,minimumTravel:shortestLengths.length?Math.min(...shortestLengths):null,routes:retained,qualifies};
  });
  const lengths=bases.flatMap(b=>b.minimumTravel===null?[]:[b.minimumTravel]),minTravel=lengths.length?Math.min(...lengths):0;
  const nearestBase=Math.min(...paints.map((_,i)=>colorDistance(target,mixtureColor(paints,paints.map((_,j)=>+(i===j))))/tolerance));
  const qualifyingBases=bases.filter(b=>b.qualifies).map(b=>b.base);
  const styleBases=bases.filter(b=>b.qualifies&&b.routes.some(r=>matchesDesign(r,style)&&r.finishWindowMs>=55&&(!r.setup||r.setup.coverage>=.04))).map(b=>b.base);
  const failures:string[]=[];
  if(nearestBase<1.8)failures.push('near-pure-target');
  if(minTravel<14)failures.push('short-competing-route');
  if(qualifyingBases.length<2)failures.push('fewer-than-two-supported-starts');
  if(!styleBases.length)failures.push('no-efficient-style-route');
  if(style==='chromatic-ride'&&(minTravel<30||chroma(target)<.07))failures.push('short-or-muted-ride');
  if((style==='setup-lift'||style==='coupled-balance')&&bases.some(b=>b.fewestFound===1))failures.push('one-pour-style-bypass');
  return {version:DESIGN_VERSION,style,tolerance,nearestBase,failures,bases,qualifyingBases,styleBases,minTravel,travelBalance:lengths.length?minTravel/Math.max(...lengths):0,
    robustThree:bases.every(b=>b.fewestFound===3&&b.bestTwoError>1.1&&b.qualifies),
    search:'Every base: 129 one-pour and 25×25 two-pour samples per order, six refinements; three-pour recipe witnesses. Legal split doses merged. Sampled, not a proof.'};
}
