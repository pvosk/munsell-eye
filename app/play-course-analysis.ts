// Offline evaluator. Not imported by the live game: all searches run when
// building the versioned course bank, never inside a render or animation loop.
import { PLAY_LEVELS, CHARGE_SECONDS, addPaint, chargeAmount, colorDistance, generateCandidate, mixtureColor, pourPath, totalMass, type Mixture, type ColorPoint } from './play-engine';

export const COURSE_VERSION='courses-2';
export type HoleKind='chromatic-ride'|'value-finish'|'quiet-cool'|'interior'|'choice'|'precision'|'muted';
export const PROFILES: {name:string;challenge:number;preferences:Partial<Record<HoleKind,number>>;required?:Partial<Record<HoleKind,number>>}[]=[
  {name:'Warm / cool / lift',challenge:.1,preferences:{'value-finish':3,'chromatic-ride':2,interior:2},required:{'value-finish':1,interior:2}},
  {name:'Warmth and quiet cools',challenge:.15,preferences:{'quiet-cool':4,'value-finish':2,interior:1},required:{'quiet-cool':2}},
  {name:'Color and light',challenge:.3,preferences:{'chromatic-ride':3,'value-finish':2,precision:2},required:{interior:2,'chromatic-ride':1}},
  {name:'Earth against color',challenge:.65,preferences:{interior:3,'chromatic-ride':2,choice:2},required:{interior:2}},
  {name:'Chromatic rides and quieter depth',challenge:.35,preferences:{'chromatic-ride':3,precision:2,interior:3,muted:4},required:{'chromatic-ride':2,interior:2,muted:1}},
  {name:'Competing mixtures',challenge:.7,preferences:{choice:3,interior:3,precision:4,'chromatic-ride':2,'value-finish':2},required:{interior:2,precision:1,'chromatic-ride':1}},
  {name:'Find the useful paints',challenge:.45,preferences:{choice:5,'value-finish':2,interior:1},required:{choice:1}},
  {name:'Chromatic depth',challenge:.8,preferences:{'value-finish':4,precision:3,interior:2},required:{'value-finish':1}},
  {name:'Value with a hue cost',challenge:1,preferences:{precision:4,interior:3,choice:2},required:{interior:2}},
  {name:'Opposing pulls',challenge:.9,preferences:{choice:4,interior:3,precision:2},required:{interior:2}},
];
export type Route={order:number[];times:number[];recipe:Mixture;error:number;window:number;length:number;lastLength:number;valueChange:number;minChroma:number};
export type CourseRecord={id:string;target:Mixture;recipe:Mixture;order:number[];times:number[];solutionShots:number;par:number;timingWindow:number;kind:HoleKind;tags:HoleKind[];nearestBase:number;nearestWorld:number;tapError:number;routeLength:number;alternativeBases:number;alternativeRecipes:number;checks:{base:number;one:number;two:number}[]};
type Atlas={order:number[];samples:{times:number[];lab:number[]}[]};
const clamp=(n:number)=>Math.max(0,Math.min(CHARGE_SECONDS,n));
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export const paletteSignature=()=>JSON.stringify(PLAY_LEVELS.map(l=>({name:l.name,tolerance:l.tolerance,paints:l.paints.map(p=>[p.id,p.rgb,p.strength])})));

export function replayRoute(palette:number,order:number[],times:number[]) {
  let q=PLAY_LEVELS[palette].paints.map((_,i)=>+(i===order[0]));
  for(let i=0;i<times.length;i++) q=addPaint(q,order[i+1],chargeAmount(totalMass(q),times[i]));
  return q;
}
function evaluate(palette:number,order:number[],times:number[],target:ColorPoint) {
  const recipe=replayRoute(palette,order,times);
  return {recipe,error:colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,recipe),target)};
}
function refine(palette:number,order:number[],initial:number[],target:ColorPoint,step:number,limit=CHARGE_SECONDS) {
  let times=[...initial], result=evaluate(palette,order,times,target);
  for(let iteration=0;iteration<9;iteration++,step*=.5) {
    for(let dimension=0;dimension<times.length;dimension++) for(const sign of [-1,1]) {
      const trial=[...times];trial[dimension]=Math.min(limit,clamp(trial[dimension]+step*sign));
      const next=evaluate(palette,order,trial,target);
      if(next.error<result.error){times=trial;result=next;}
    }
  }
  return {...result,times};
}
function routeDetails(palette:number,order:number[],times:number[],target:ColorPoint):Route {
  const level=PLAY_LEVELS[palette], result=evaluate(palette,order,times,target);
  let window=Infinity;
  // Replay all later charge TIMES after each perturbation, so accumulated-mass
  // changes affect subsequent doses exactly as in the controls.
  for(let i=0;i<times.length;i++) for(const sign of [-1,1]) {
    let low=0,high=Math.min(.3,sign<0?times[i]:CHARGE_SECONDS-times[i]);
    for(let k=0;k<10;k++) {
      const amount=(low+high)/2,trial=[...times];trial[i]+=sign*amount;
      if(evaluate(palette,order,trial,target).error<=level.tolerance) low=amount;else high=amount;
    }
    // The peak/zero boundary is not a failure: the meter reverses there.
    if(high>.0001) window=Math.min(window,low);
  }
  return {order,times,recipe:result.recipe,error:result.error,window:Number.isFinite(window)?window:.3,length:0,lastLength:0,valueChange:0,minChroma:0};
}
function geometry(palette:number,route:Route) {
  const level=PLAY_LEVELS[palette];let q=level.paints.map((_,i)=>+(i===route.order[0])), length=0,lastLength=0,valueChange=0,minChroma=Infinity;
  for(let i=0;i<route.times.length;i++) {
    const amount=chargeAmount(totalMass(q),route.times[i]),path=pourPath(level.paints,q,route.order[i+1],amount,48);
    lastLength=0;
    path.forEach((point,j)=>{minChroma=Math.min(minChroma,Math.hypot(point.lab[1],point.lab[2]));if(j)lastLength+=distance(point.position,path[j-1].position);});
    valueChange=path.at(-1)!.lab[0]-path[0].lab[0];length+=lastLength;q=addPaint(q,route.order[i+1],amount);
  }
  return {...route,length,lastLength,valueChange,minChroma};
}
export function makeAtlas(palette:number):Atlas[] {
  const count=PLAY_LEVELS[palette].paints.length,atlas:Atlas[]=[];
  for(let base=0;base<count;base++) for(let first=0;first<count;first++) if(first!==base) {
    const one:Atlas={order:[base,first],samples:[]};
    for(let i=0;i<=64;i++) {const times=[i*CHARGE_SECONDS/64];one.samples.push({times,lab:mixtureColor(PLAY_LEVELS[palette].paints,replayRoute(palette,one.order,times)).lab});}
    atlas.push(one);
    for(let second=0;second<count;second++) {
      const two:Atlas={order:[base,first,second],samples:[]};
      for(let i=0;i<=8;i++) for(let j=0;j<=8;j++) {const times=[i*CHARGE_SECONDS/8,j*CHARGE_SECONDS/8];two.samples.push({times,lab:mixtureColor(PLAY_LEVELS[palette].paints,replayRoute(palette,two.order,times)).lab});}
      atlas.push(two);
    }
  }
  return atlas;
}
function witnessRoutes(palette:number,recipe:Mixture,target:ColorPoint):Route[] {
  const active=recipe.map((q,i)=>q>0?i:-1).filter(i=>i>=0),routes:Route[]=[];
  const visit=(order:number[])=>{
    if(order.length<active.length){for(const i of active)if(!order.includes(i))visit([...order,i]);return;}
    const normalized=recipe.map(q=>q/recipe[order[0]]),times:number[]=[];let mass=1;
    for(const i of order.slice(1)) {
      const ratio=normalized[i]/Math.max(1,mass)**.8;if(ratio<.005 || ratio>8)return;
      const power=((ratio-.005)/7.995)**.25;times.push(CHARGE_SECONDS*(1-(1-power)**(1/3)));mass+=normalized[i];
    }
    routes.push(routeDetails(palette,order,times,target));
  };
  visit([]);return routes;
}
export function playerPar(shots:number,window:number,challenge:number) {
  const timingAllowance=+(window<.055)+ +(window<.022);
  const courseAllowance=+(challenge>=.8 && shots>=2);
  return Math.max(2,Math.min(6,shots+1+timingAllowance+courseAllowance));
}
export function analyzeCandidate(palette:number,seed:number,atlas:Atlas[],forced?:Mixture):CourseRecord|null {
  const level=PLAY_LEVELS[palette], candidate=forced?{recipe:forced,target:mixtureColor(level.paints,forced)}:generateCandidate(palette,seed,false);
  const target=candidate.target,nearestBase=Math.min(...level.paints.map((_,i)=>colorDistance(target,mixtureColor(level.paints,level.paints.map((_,j)=>+(i===j))))));
  // Hard condition. Never relax this to silently fill a round.
  if(nearestBase<level.tolerance*1.8)return null;
  const nearestWorld=Math.min(...level.paints.map((_,i)=>distance(target.position,mixtureColor(level.paints,level.paints.map((_,j)=>+(i===j))).position)));
  if(nearestWorld<6.5)return null;
  let tapError=Infinity;
  const checks=level.paints.map((_,base)=>({base,one:Infinity,two:Infinity}));
  const routes=witnessRoutes(palette,candidate.recipe,target);
  for(const entry of atlas) {
    if(entry.order.length===2) {
      let tapTime=0,tapDistance=Infinity;
      for(let i=0;i<=18;i++) {const t=i*.01,d=evaluate(palette,entry.order,[t],target).error;if(d<tapDistance){tapTime=t;tapDistance=d;}}
      tapError=Math.min(tapError,refine(palette,entry.order,[tapTime],target,.01,.18).error);
      if(tapError<=level.tolerance)return null;
    }
    let best=entry.samples[0],error=Infinity;
    for(const sample of entry.samples){const d=distance(target.lab,sample.lab);if(d<error){error=d;best=sample;}}
    const result=refine(palette,entry.order,best.times,target,CHARGE_SECONDS/(entry.order.length===2?64:8));
    const key=entry.order.length===2?'one':'two';checks[entry.order[0]][key]=Math.min(checks[entry.order[0]][key],result.error);
    if(result.error<level.tolerance-1e-8) routes.push(routeDetails(palette,entry.order,result.times,target));
  }
  const viable=routes.filter(r=>r.error<level.tolerance-1e-8);
  if(!viable.length)return null;
  const shots=Math.min(...viable.map(r=>r.times.length));
  const shortest=viable.filter(r=>r.times.length===shots);
  const best=geometry(palette,shortest.reduce((a,b)=>a.window>b.window?a:b));
  const bases=new Set(shortest.map(r=>r.order[0])).size;
  const masks=new Set(shortest.map(r=>r.recipe.map(q=>q/totalMass(r.recipe)>.015?1:0).join(''))).size;
  const tags:HoleKind[]=[];
  const allOne=Math.min(...checks.map(c=>c.one));
  if(shots===1 && best.minChroma>.055 && Math.hypot(target.lab[1],target.lab[2])>.075 && nearestWorld>9 && best.length>10)tags.push('chromatic-ride');
  const last=level.paints[best.order.at(-1)!];
  if((last.category==='White'||last.category==='Black') && Math.abs(best.valueChange)>.12 && best.lastLength>5)tags.push('value-finish');
  if(palette===1 && target.lab[0]>.4 && target.lab[0]<.88 && Math.hypot(target.lab[1],target.lab[2])<.035 && best.recipe[2]>0)tags.push('quiet-cool');
  if(shots>=2 && allOne>level.tolerance*1.05) tags.push('interior');
  if(shots>=2 && Math.hypot(target.lab[1],target.lab[2])<.08)tags.push('muted');
  if(masks>=2)tags.push('choice');
  if(shots>=2 && best.window<.07 && allOne>level.tolerance*1.05)tags.push('precision');
  if(!tags.length)return null;
  return {id:`${COURSE_VERSION}-${palette}-${seed}`,target:candidate.recipe,recipe:best.recipe,order:best.order,times:best.times,solutionShots:shots,par:playerPar(shots,best.window,PROFILES[palette].challenge),timingWindow:best.window,kind:tags[0],tags,nearestBase,nearestWorld,tapError,routeLength:best.length,alternativeBases:bases,alternativeRecipes:masks,checks};
}

export function selectRounds(palette:number,candidates:CourseRecord[],count=4) {
  const profile=PROFILES[palette],level=PLAY_LEVELS[palette];
  const points=new Map(candidates.map(c=>[c.id,mixtureColor(level.paints,c.target)]));
  const usage=new Map<string,number>();const rounds:CourseRecord[][]=[];
  for(let round=0;round<count;round++) {
    const chosen:CourseRecord[]=[];
    const choose=(required?:HoleKind)=>{
      const pool=candidates.filter(c=>!chosen.some(h=>h.id===c.id) && (!required||c.tags.includes(required)) && !(palette===4 && c.tags.includes('chromatic-ride') && chosen.filter(h=>h.tags.includes('chromatic-ride')).length>=2) && chosen.every(h=>colorDistance(points.get(h.id)!,points.get(c.id)!)>level.tolerance*1.8));
      if(!pool.length)throw new Error(`${level.name}: no valid ${required??'diverse'} candidate; expand search instead of relaxing constraints`);
      const merit=(c:CourseRecord)=>{
        const novelty=chosen.length?Math.min(...chosen.map(h=>colorDistance(points.get(h.id)!,points.get(c.id)!))):.1;
        const unusedType=c.tags.some(tag=>!chosen.some(h=>h.kind===tag));
        const preference=Math.max(...c.tags.map(t=>profile.preferences[t]??0));
        const travel=c.tags.some(t=>t==='chromatic-ride'||t==='value-finish')?Math.min(c.routeLength,40)*.035:0;
        const challenge=c.solutionShots>=2?Math.min(1,.055/Math.max(.015,c.timingWindow))*.55:0;
        return preference*.32+novelty*5+travel+challenge+(unusedType?.45:0)-(usage.get(c.id)??0)*1.6;
      };
      const winner=pool.reduce((a,b)=>merit(a)>merit(b)?a:b);
      const kind=required??winner.tags.reduce((a,b)=>(profile.preferences[a]??0)>(profile.preferences[b]??0)?a:b);
      chosen.push({...winner,kind});usage.set(winner.id,(usage.get(winner.id)??0)+1);
    };
    for(const [kind,n] of Object.entries(profile.required??{}))for(let i=0;i<n;i++)choose(kind as HoleKind);
    while(chosen.length<5)choose();
    // Only the finish is constrained; palette identities decide the other
    // experiences rather than imposing the same opening pair everywhere.
    const finish=chosen.reduce((a,b)=>a.par>b.par || (a.par===b.par && a.timingWindow<b.timingWindow)?a:b);
    const sequence=[...chosen.filter(h=>h.id!==finish.id),finish];
    if(palette===4) {
      // Do not postpone the first quiet CMY mix until the finale.
      const quiet=sequence.findIndex(h=>h.tags.includes('muted'));
      if(quiet>1) {
        const alternative=sequence.slice(0,-1).findIndex(h=>h.tags.includes('interior'));
        const move=quiet===4?alternative:quiet;
        if(move>1)[sequence[1],sequence[move]]=[sequence[move],sequence[1]];
      }
    }
    rounds.push(sequence);
  }
  return rounds;
}
