// Offline inverse search against a FIXED requested color. Never re-centers the
// destination on the fitted recipe, and never modifies pigment properties.
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorDistance,totalMass,chargeAmount,addPaint,LIVE_LANDING_TOLERANCE,type ColorPoint} from '../app/play-engine';
import {recipePrefixes,predecessorForFinish,normalizeRecipe} from '../app/play-inverse-planning';
import {replayRoute} from '../app/play-course-analysis';
import {secondsForAmount} from '../app/play-route-design';
import {sampleJourney,finishEpisode} from '../app/play-journey-analysis';
import {finishProfile} from '../app/play-finish-profile';
import {halton} from './recipe-blind-search';
import {integrateChromaticPath} from './stable-route-measurement';
export const REGION_POLICY={version:'fixed-color-backward-regions-1',fitSeeds:20,fitIterations:96,fitKeep:4,endpointSafety:.92,regionDirections:10,peelFractions:[.2,.4,.6,.8,1],maxPours:3};
export type RegionRoute={order:number[];times:number[];error:number;endpoint:number[];predecessor:number[];finishShare:number;rideProxy:number;shiftProxy:number;direction:'rise'|'drop'|null};

export function fitFixedTarget(palette:number,target:ColorPoint,seed:number){
 const paints=PLAY_LEVELS[palette].paints,n=paints.length,seeds:number[][]=[];
 for(let i=0;i<n;i++)seeds.push(paints.map((_,j)=>+(i===j)));
 seeds.push(paints.map(()=>1/n));
 for(let i=0;i<REGION_POLICY.fitSeeds;i++)seeds.push(normalizeRecipe(paints.map((_,j)=>Math.exp(5*(halton(seed+i+1,[2,3,5,7][j])-.5)))));
 const fits=seeds.map(q=>{
  let recipe=[...q],error=colorDistance(mixtureColor(paints,q),target),step=.15;
  for(let iter=0;iter<REGION_POLICY.fitIterations&&step>1e-5;iter++){
   let next=recipe,best=error;
   for(let from=0;from<n;from++)for(let to=0;to<n;to++)if(from!==to&&recipe[from]>0){
    const amount=Math.min(recipe[from],step),candidate=[...recipe];candidate[from]-=amount;candidate[to]+=amount;
    const e=colorDistance(mixtureColor(paints,candidate),target);if(e<best){next=candidate;best=e;}
   }
   if(next===recipe)step*=.5;else {recipe=next;error=best;}
  }
  return {recipe,error};
 }).sort((a,b)=>a.error-b.error);
 const kept:typeof fits=[];
 for(const f of fits)if(f.error<=LIVE_LANDING_TOLERANCE*REGION_POLICY.endpointSafety&&!kept.some(k=>Math.hypot(...k.recipe.map((x,i)=>x-f.recipe[i]))<.01)){kept.push(f);if(kept.length===REGION_POLICY.fitKeep)break;}
 return {bestError:fits[0].error,fits:kept};
}

export function backwardRegions(palette:number,target:ColorPoint,seed:number){
 const fitted=fitFixedTarget(palette,target,seed),paints=PLAY_LEVELS[palette].paints,endpoints:number[][]=[];
 const valid=(q:number[])=>colorDistance(mixtureColor(paints,q),target)<=LIVE_LANDING_TOLERANCE*REGION_POLICY.endpointSafety;
 for(const fit of fitted.fits){
  endpoints.push(fit.recipe);
  const directions=paints.map((_,i)=>paints.map((_,j)=>+(i===j)));
  for(let k=0;k<REGION_POLICY.regionDirections;k++)directions.push(normalizeRecipe(paints.map((_,i)=>Math.exp(5*(halton(seed+k+19,[2,3,5,7][i])-.5)))));
  for(const to of directions){
   const at=(t:number)=>fit.recipe.map((x,i)=>x+(to[i]-x)*t);let lo=0,hi=1;
   // First connected segment only; don't assume the entire preimage is convex.
   for(let k=1;k<=12;k++){const t=k/12;if(!valid(at(t))){hi=t;break;}lo=t;}
   for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(valid(at(mid)))lo=mid;else hi=mid;}
   for(const fraction of [.35,.7,1]){const q=at(lo*fraction);if(valid(q)&&!endpoints.some(e=>Math.hypot(...e.map((x,i)=>x-q[i]))<.002))endpoints.push(q);}
  }
 }
 const routes=new Map<string,RegionRoute>();
 for(const endpoint of endpoints)for(let pigment=0;pigment<paints.length;pigment++)for(const fraction of REGION_POLICY.peelFractions){
  const finishShare=endpoint[pigment]*fraction,predecessor=predecessorForFinish(endpoint,pigment,finishShare);if(!predecessor)continue;
  for(const prefix of recipePrefixes(predecessor,2)){
   const q=replayRoute(palette,prefix.order,prefix.times),mass=totalMass(q),time=secondsForAmount(mass,mass*finishShare/(1-finishShare));if(time===null)continue;
   const order=[...prefix.order,pigment],times=[...prefix.times,time],error=colorDistance(mixtureColor(paints,replayRoute(palette,order,times)),target);if(error>LIVE_LANDING_TOLERANCE)continue;
   const {strokes,points}=sampleJourney(palette,{order,times}),profile=finishProfile(strokes,finishEpisode(strokes,target),strokes.filter(s=>s.length>=3).length);
   const total=integrateChromaticPath(points),rideProxy=Math.max(0,...strokes.filter(s=>s.length&&s.chromaticLength/s.length>=.75).map(s=>s.length));
   routes.set(order.join()+':'+times.map(t=>t.toFixed(6)).join(),{order,times,error,endpoint,predecessor,finishShare,rideProxy:total.colored/Math.max(total.length,1e-9)>=.75?rideProxy:0,shiftProxy:profile.valueLed?Math.abs(profile.deltaL):0,direction:profile.valueLed?profile.direction:null});
  }
 }
 return {target,bestError:fitted.bestError,fitCount:fitted.fits.length,endpointCount:endpoints.length,routes:[...routes.values()]};
}

export const POOL_IDS=['titanium-white','flake-white-replacement','ivory-black','hansa-yellow-light','cadmium-lemon','cadmium-yellow-deep','yellow-ochre','nickel-titanate-yellow','naples-yellow','cadmium-orange','transparent-orange','cadmium-red-light','cadmium-red-medium','quinacridone-magenta','alizarin-crimson','perylene-maroon','dioxazine-purple','ultramarine-violet','ultramarine-blue','cobalt-blue','cerulean-blue','phthalo-blue-green','indanthrone-blue','cobalt-teal','phthalo-green-yellow','viridian','permanent-green-light','chromium-oxide-green','burnt-sienna','raw-sienna','raw-umber','terre-verte'];
export type RegionPalette={id:string;name:string;paints:PaintColor[];control:boolean;selection:string;proxy:number[]};
export function regionPalettes(){
 const pool=POOL_IDS.map(id=>{const p=PAINTS.find(p=>p.id===id);if(!p)throw Error(id);return p;}),points=pool.map(p=>mixtureColor([p],[1]));
 const existing=new Set(PLAY_LEVELS.map(l=>l.paints.map(p=>p.id).sort().join('|'))),candidates:RegionPalette[]=[];
 const add=(indices:number[])=>{
  const paints=indices.map(i=>pool[i]);if(existing.has(paints.map(p=>p.id).sort().join('|')))return;
  const pair=(i:number,j:number)=>colorDistance(points[i],points[j]);
  const coverage=Math.min(...indices.map(i=>Math.max(...indices.filter(j=>j!==i).map(j=>pair(i,j)))));
  const span=Math.max(...indices.map(i=>points[i].lab[0]))-Math.min(...indices.map(i=>points[i].lab[0]));
  const chroma=Math.min(...indices.map(i=>Math.hypot(...points[i].lab.slice(1))));
  candidates.push({id:`br-${indices.join('-')}`,name:paints.map(p=>p.name).join(' / '),paints,control:false,selection:'',proxy:[coverage*span,coverage*(.05+chroma)]});
 };
 for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++){add([a,b,c]);for(let d=c+1;d<pool.length;d++)add([a,b,c,d]);}
 const selected:RegionPalette[]=[];
 for(const size of [3,4])for(const mode of ['shift-white','shift-colored','ride-colored','muted-colored','random-colored','random-any']){
  const subset=candidates.filter(p=>p.paints.length===size&&(!mode.includes('colored')||p.paints.every(p=>!['White','Black'].includes(p.category)))&&(!mode.includes('white')||p.paints.some(p=>p.category==='White'))&&(!mode.includes('muted')||p.paints.filter(p=>['Earth','Black'].includes(p.category)).length>=1)&&!selected.some(s=>s.id===p.id));
  const random=mode.startsWith('random');
  subset.sort((a,b)=>random?halton(Number(a.id.replace(/\D/g,'')),7)-halton(Number(b.id.replace(/\D/g,'')),7):b.proxy[mode.startsWith('ride')?1:0]-a.proxy[mode.startsWith('ride')?1:0]);
  const next=subset.find(p=>!selected.some(s=>s.paints.filter(a=>p.paints.some(b=>b.id===a.id)).length>=Math.min(size,s.paints.length)-1))??subset[0];
  if(next)selected.push({...next,selection:mode});
 }
 const controls=['Zorny','CMY','Secondaries','Maroon Arc','UltraOx Dual','Cobalt Ember'].map(name=>{const l=PLAY_LEVELS.find(p=>p.name===name)!;return {id:`control-${name}`,name,paints:l.paints,control:true,selection:'existing-control',proxy:[]};});
 return {poolIds:POOL_IDS,enumerated:candidates.length,selected:[...selected,...controls]};
}
