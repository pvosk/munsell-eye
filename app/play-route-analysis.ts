// Offline only. Shared measurements, separate style evaluators. No searches
// run in the browser; neither the pigment model nor the controls are modified.
import {PLAY_LEVELS,CHARGE_SECONDS,addPaint,chargeAmount,totalMass,mixtureColor,colorDistance,pourPath,type Mixture,type ColorPoint} from './play-engine';
import {makeAtlas,evaluate,refine,routeDetails,geometry,witnessRoutes,type Route} from './play-course-analysis';

export const ANALYSIS_VERSION='routes-1';
export type RouteStyle='chromatic-ride'|'setup-lift'|'chromatic-correction'|'interior-weave'|'complementary-balance'|'precision-approach';
export type SetupRegion={radiusSeconds:number;dimensions:number;cells:number;successful:number;coverage:number;medianFinishWindowMs:number;minimumFinishWindowMs:number};
export type MeasuredRoute=Route & {pourLengths:number[];meaningfulPours:number;finishValue:number;finishHueChroma:number;chromaReduction:number;anticipatory:boolean;styles:RouteStyle[];finishWindowMs:number;setup:SetupRegion|null};
export type BaseAnalysis={base:number;fewestFound:number|null;bestOneError:number;bestTwoError:number;minimumTravel:number|null;routes:MeasuredRoute[];qualifies:boolean};
export type HoleAnalysis={version:string;search:string;style:RouteStyle;failures:string[];bases:BaseAnalysis[];qualifyingBases:number[];robustThree:boolean;minTravel:number;travelBalance:number};
const dist=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const median=(a:number[])=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:0;

// Success intervals are found across the whole rising meter leg, not only a
// binary search about one root. Local refinement catches narrow near-misses.
export function finishingIntervals(palette:number,before:Mixture,paint:number,target:ColorPoint,steps=96) {
  const level=PLAY_LEVELS[palette],error=(t:number)=>colorDistance(mixtureColor(level.paints,addPaint(before,paint,chargeAmount(totalMass(before),t))),target)/level.tolerance;
  const samples=Array.from({length:steps+1},(_,i)=>({t:i*CHARGE_SECONDS/steps,e:error(i*CHARGE_SECONDS/steps)}));
  for(let i=1;i<steps;i++)if(samples[i].e<samples[i-1].e&&samples[i].e<samples[i+1].e){
    let lo=samples[i-1].t,hi=samples[i+1].t;
    for(let n=0;n<12;n++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(error(a)<error(b))hi=b;else lo=a;}
    const t=(lo+hi)/2;samples.push({t,e:error(t)});
  }
  samples.sort((a,b)=>a.t-b.t);
  const intervals:{lo:number;hi:number}[]=[];
  const boundary=(outside:number,inside:number)=>{for(let n=0;n<12;n++){const mid=(outside+inside)/2;if(error(mid)<=1)inside=mid;else outside=mid;}return inside;};
  for(let i=0;i<samples.length;i++)if(samples[i].e<=1){
    const begin=i;while(i+1<samples.length&&samples[i+1].e<=1)i++;
    intervals.push({lo:begin===0?0:boundary(samples[begin-1].t,samples[begin].t),hi:i===samples.length-1?CHARGE_SECONDS:boundary(samples[i+1].t,samples[i].t)});
  }
  return intervals;
}

export function measureRoute(palette:number,route:Route,target:ColorPoint,withSetup=false):MeasuredRoute {
  const level=PLAY_LEVELS[palette];let q=level.paints.map((_,i)=>+(i===route.order[0]));
  const stops=[mixtureColor(level.paints,q)],pourLengths:number[]=[];
  for(let i=0;i<route.times.length;i++){
    const amount=chargeAmount(totalMass(q),route.times[i]),path=pourPath(level.paints,q,route.order[i+1],amount,48);
    pourLengths.push(path.slice(1).reduce((sum,p,j)=>sum+dist(p.position,path[j].position),0));q=addPaint(q,route.order[i+1],amount);stops.push(mixtureColor(level.paints,q));
  }
  const last=stops.at(-1)!,before=stops.at(-2)!,prior=stops.at(-3),finishValue=last.lab[0]-before.lab[0];
  const finishHueChroma=dist(last.lab.slice(1),before.lab.slice(1));
  // Evidence of planned compensation: the preceding pour moves the a/b
  // components farther from target and opposes the final a/b displacement.
  // This is a route trait, not proof of player intention or a requirement that
  // overall perceptual distance increases.
  const anticipatory=!!prior&&Math.abs(finishValue)>.06&&finishHueChroma>.025&&dist(before.lab.slice(1),target.lab.slice(1))>dist(prior.lab.slice(1),target.lab.slice(1))+.01&&
    (before.lab[1]-prior.lab[1])*(last.lab[1]-before.lab[1])+(before.lab[2]-prior.lab[2])*(last.lab[2]-before.lab[2])<-.0002;
  const chroma=(p:ColorPoint)=>Math.hypot(p.lab[1],p.lab[2]);
  const chromaReduction=Math.max(...stops.map(chroma))-chroma(last);
  const meaningfulPours=pourLengths.filter((length,i)=>{
    // Remove the pour and replay subsequent controls. A tiny token dose must
    // not count merely because a recipe names an additional paint.
    const order=route.order.filter((_,j)=>j!==i+1),times=route.times.filter((_,j)=>j!==i);
    return length>=3&&evaluate(palette,order,times,target).error>level.tolerance;
  }).length;
  let finishBefore=level.paints.map((_,i)=>+(i===route.order[0]));
  for(let i=0;i<route.times.length-1;i++)finishBefore=addPaint(finishBefore,route.order[i+1],chargeAmount(totalMass(finishBefore),route.times[i]));
  const intervals=finishingIntervals(palette,finishBefore,route.order.at(-1)!,target);
  const interval=intervals.find(x=>route.times.at(-1)!>=x.lo-.00001&&route.times.at(-1)!<=x.hi+.00001);
  const finishWindowMs=interval?(interval.hi-interval.lo)*1000:0;
  const result:MeasuredRoute={...geometry(palette,route),pourLengths,meaningfulPours,finishValue,finishHueChroma,chromaReduction,anticipatory,styles:[],finishWindowMs,setup:null};
  if(withSetup&&route.times.length>=2)result.setup=measureSetup(palette,route,target);
  result.styles=routeStyles(result,level.paints[route.order.at(-1)!].category);
  return result;
}

export function measureSetup(palette:number,route:Route,target:ColorPoint):SetupRegion {
  const dimensions=route.times.length-1,radius=.18,counts=7,widths:number[]=[];let cells=0;
  // A local Cartesian region, varying EVERY setup dose together and then
  // searching all finishing doses. Bounds clip to the actual meter domain.
  const walk=(times:number[])=>{
    if(times.length<dimensions){const center=route.times[times.length],lo=Math.max(0,center-radius),hi=Math.min(CHARGE_SECONDS,center+radius);for(let n=0;n<counts;n++)walk([...times,lo+(hi-lo)*n/(counts-1)]);return;}
    cells++;let q=PLAY_LEVELS[palette].paints.map((_,i)=>+(i===route.order[0]));
    times.forEach((t,i)=>{q=addPaint(q,route.order[i+1],chargeAmount(totalMass(q),t));});
    const intervals=finishingIntervals(palette,q,route.order.at(-1)!,target,64);
    if(intervals.length)widths.push(Math.max(...intervals.map(x=>(x.hi-x.lo)*1000)));
  };
  walk([]);
  return {radiusSeconds:radius,dimensions,cells,successful:widths.length,coverage:widths.length/cells,medianFinishWindowMs:median(widths),minimumFinishWindowMs:widths.length?Math.min(...widths):0};
}

export function routeStyles(r:MeasuredRoute,finishCategory:string):RouteStyle[] {
  const styles:RouteStyle[]=[];
  if(Math.max(...r.pourLengths)>=24&&r.minChroma>.05)styles.push('chromatic-ride');
  if(r.times.length>=2&&r.finishValue>.10&&r.lastLength>=9&&r.meaningfulPours>=2)styles.push('setup-lift');
  if(!['White','Black'].includes(finishCategory)&&Math.abs(r.finishValue)>.07&&r.finishHueChroma>.03&&r.times.length>=2)styles.push('chromatic-correction');
  if(r.times.length>=2&&r.meaningfulPours===r.times.length)styles.push('interior-weave');
  if(r.chromaReduction>.065&&r.times.length>=2)styles.push('complementary-balance');
  if(r.times.length>=2&&r.setup&&r.setup.coverage>0&&r.setup.coverage<.65&&r.finishWindowMs>=45)styles.push('precision-approach');
  return styles;
}

export function searchCompetingRoutes(palette:number,recipe:Mixture,atlas=makeAtlas(palette,128,24)) {
  const level=PLAY_LEVELS[palette],target=mixtureColor(level.paints,recipe),routes=witnessRoutes(palette,recipe,target).filter(r=>r.times.length<=3);
  const errors=level.paints.map(()=>({one:Infinity,two:Infinity}));
  for(const entry of atlas){
    const ranked=entry.samples.map(s=>({...s,error:dist(s.lab,target.lab)})).sort((a,b)=>a.error-b.error),starts:number[][]=[];
    for(const sample of ranked){
      if(starts.some(t=>dist(t,sample.times)<.10))continue;starts.push(sample.times);
      const result=refine(palette,entry.order,sample.times,target,CHARGE_SECONDS/(entry.order.length===2?128:24));
      const key=entry.order.length===2?'one':'two',base=entry.order[0];errors[base][key]=Math.min(errors[base][key],result.error/level.tolerance);
      if(result.error<=level.tolerance)routes.push(routeDetails(palette,entry.order,result.times,target));
      if(starts.length===6)break;
    }
  }
  // Three-addition coverage is witnessed through recipe permutations. It is
  // deliberately not described as an exhaustive arbitrary three-pour search.
  return {target,errors,routes:routes.filter(r=>r.error<=level.tolerance)};
}

export function analyzeRoutes(palette:number,recipe:Mixture,style:RouteStyle,atlas?:ReturnType<typeof makeAtlas>,deep=true):HoleAnalysis {
  const {target,errors,routes}=searchCompetingRoutes(palette,recipe,atlas),level=PLAY_LEVELS[palette];
  const bases:BaseAnalysis[]=level.paints.map((_,base)=>{
    const viable=routes.filter(r=>r.order[0]===base),fewest=viable.length?Math.min(...viable.map(r=>r.times.length)):null;
    const shortest=viable.filter(r=>r.times.length===fewest).map(r=>geometry(palette,r));
    // Keep competing orders, not six almost-identical doses on one order.
    const orders=new Map<string,Route>();
    for(const r of viable){const key=r.order.join('-'),old=orders.get(key);if(!old||r.window>old.window)orders.set(key,r);}
    const measured=[...orders.values()].filter(r=>r.times.length<=(fewest??3)+1).map(r=>measureRoute(palette,r,target));
    const ranked=measured.sort((a,b)=>+(b.styles.includes(style))-+(a.styles.includes(style))||b.window-a.window);
    const retained=ranked.slice(0,3).map(r=>deep?measureRoute(palette,r,target,true):r);
    const qualifies=retained.some(r=>r.finishWindowMs>=40&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04));
    return {base,fewestFound:fewest,bestOneError:errors[base].one,bestTwoError:errors[base].two,minimumTravel:shortest.length?Math.min(...shortest.map(r=>r.length)):null,routes:retained,qualifies};
  });
  const lengths=bases.flatMap(b=>b.minimumTravel===null?[]:[b.minimumTravel]),minTravel=lengths.length?Math.min(...lengths):0;
  const failures:string[]=[];
  if(bases.some((_,i)=>colorDistance(mixtureColor(level.paints,level.paints.map((_,j)=>+(i===j))),target)<=level.tolerance*1.8))failures.push('near-pure-target');
  // Shared shortcut screen now applies to two-addition routes as well.
  if(bases.some(b=>b.fewestFound!==null&&b.fewestFound<=2&&(b.minimumTravel??Infinity)<14))failures.push('short-one-or-two-pour-bypass');
  if(routes.some(r=>r.times.length===1&&r.order.every(i=>['White','Black'].includes(level.paints[i].category))))failures.push('neutral-only-one-pour-bypass');
  if(style==='chromatic-ride'&&minTravel<24)failures.push('short-competing-ride');
  const efficient=bases.filter(b=>b.fewestFound===Math.min(...bases.map(b=>b.fewestFound??Infinity))),efficientLengths=efficient.flatMap(b=>b.minimumTravel===null?[]:[b.minimumTravel]);
  // Provisional comparison criterion, explicitly calibrated rather than a
  // universal law: equally efficient starts should not halve the journey.
  if(style!=='precision-approach'&&efficientLengths.length>1&&Math.min(...efficientLengths)/Math.max(...efficientLengths)<.60)failures.push('unequal-efficient-starts');
  const qualifyingBases=bases.filter(b=>b.qualifies).map(b=>b.base);
  if(qualifyingBases.length<2)failures.push('fewer-than-two-supported-starts');
  if(!bases.some(b=>b.routes.some(r=>r.styles.includes(style)&&r.finishWindowMs>=40)))failures.push('no-playable-featured-route');
  return {version:ANALYSIS_VERSION,search:'128-step one-pour; 25×25 two-pour per order; six local refinements; three-pour recipe permutations. Sampled, not a proof.',style,failures,bases,qualifyingBases,
    robustThree:bases.every(b=>b.fewestFound===3&&b.bestTwoError>1.1&&b.routes.some(r=>r.meaningfulPours===3&&r.finishWindowMs>=40)),minTravel,travelBalance:lengths.length?minTravel/Math.max(...lengths):0};
}
