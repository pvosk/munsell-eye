import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T,type Mixture} from '../app/play-engine';
import {normalizeRecipe,predecessor,holdForShare,premixReplay} from '../app/play-premix';
import {searchPremix,type PremixControl} from './premix-search';
import {FAMILIES,geometry,measureRegion,classifyAlternatives,METRIC_VERSION,type Family} from './premix-region-metrics';

const prefix=process.env.PREMIX_RUN??'docs/play-premix-regions-1';
if(existsSync(prefix+'.json'))throw Error('Run already archived: choose a new PREMIX_RUN');
const seed=Number(process.env.PREMIX_SEED??710921),levels=[0,1,4,5,8,10,16,17,29,39,42,43,44];
const draws=Number(process.env.PREMIX_DRAWS??192),limit=Number(process.env.PREMIX_FINALISTS??8);
let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
type Proposal={id:string;level:number;family:Family;start:Mixture;target:ReturnType<typeof mixtureColor>;end:Mixture;control:PremixControl;score:number;radius:number};
const proposed:Proposal[]=[],stats={anchors:0,endingRecipes:0,inverseDraws:0,legal:0,styleMatched:0};
const begin=Date.now();
for(const level of levels){
 const paints=PLAY_LEVELS[level].paints;
 for(let sample=0;sample<draws;sample++){
  const anchor=normalizeRecipe(paints.map(()=>Math.exp((random()-.5)*6))),target=mixtureColor(paints,anchor);stats.anchors++;
  // Accepted recipe rays: anchor plus inner/middle/near-boundary colors.
  // Rays explore composition preimages, not an RGB ball outside pigment gamut.
  const ends:{q:Mixture;radius:number}[]=[{q:anchor,radius:0}];
  for(let ray=0;ray<3;ray++){
   const other=normalizeRecipe(paints.map(()=>Math.exp((random()-.5)*7)));
   const blend=(t:number)=>anchor.map((v,i)=>v*(1-t)+other[i]*t);
   let lo=0,hi=1;for(let k=0;k<16;k++){const m=(lo+hi)/2;if(colorDistance(mixtureColor(paints,blend(m)),target)<=T)lo=m;else hi=m;}
   for(const fraction of [.3,.7,.96]){const q=blend(lo*fraction);if(colorDistance(mixtureColor(paints,q),target)<=T)ends.push({q,radius:colorDistance(mixtureColor(paints,q),target)/T});}
  }
  stats.endingRecipes+=ends.length;
  for(const [ei,endpoint] of ends.entries())for(const depth of [2,3]){
   stats.inverseDraws++;let q=endpoint.q;const order:number[]=[],times:number[]=[];let legal=true;
   for(let k=0;k<depth;k++){
    const paint=Math.floor(random()*paints.length);if(order[0]===paint){legal=false;break;}
    const alpha=q[paint]*(.3+.68*random()),t=holdForShare(1,alpha,'normalized'),p=predecessor(q,paint,alpha);
    if(!p||t===null){legal=false;break;}order.unshift(paint);times.unshift(t);q=p;
   }
   if(!legal||colorDistance(mixtureColor(paints,q),target)<=T)continue;stats.legal++;
   const control={order,times,error:colorDistance(mixtureColor(paints,premixReplay(q,order,times,'normalized')),target)},g=geometry(level,q,target,control);
   if(!g.allMeaningful)continue;
   for(const family of FAMILIES){
    if(!g.traits[family])continue;stats.styleMatched++;
    const score=family==='rise'||family==='drop'?Math.abs(g.value)+.25*g.setup:family==='chromatic-ride'?g.finish*g.chromaticFraction:family==='setup-glide'?g.finish+.3*g.setup:family==='coupled-balance'?g.tradeoff*4+Math.min(Math.abs(g.value),g.ab):g.setup+g.finish;
    proposed.push({id:`region-${level}-${sample}-${ei}-${depth}-${family}`,level,family,start:q,target,end:endpoint.q,control,score:score+.15*g.initialDistance,radius:endpoint.radius});
   }
  }
 }
 console.log(JSON.stringify({phase:'proposal',palette:PLAY_LEVELS[level].name,seconds:(Date.now()-begin)/1000,...stats}));
}
const results:any[]=[];
for(const family of FAMILIES){
 const ranked=proposed.filter(p=>p.family===family).sort((a,b)=>b.score-a.score),shortlist:Proposal[]=[];
 // Mix palettes; maximum two candidates per palette in a family challenge.
 for(const p of ranked){if(shortlist.filter(s=>s.level===p.level).length>=2)continue;if(shortlist.some(s=>s.level===p.level&&colorDistance(s.target,p.target)<T*2))continue;shortlist.push(p);if(shortlist.length>=limit)break;}
 for(const [index,p] of shortlist.entries()){
  console.log(JSON.stringify({phase:'challenge',family,index,id:p.id}));
  const first=searchPremix(p.level,p.start,p.target,'normalized',2,seed+index,64,4);
  // Independent fresh-seed, denser challenge; never sees proposed recipe/style.
  const fresh=searchPremix(p.level,p.start,p.target,'normalized',2,991731+index,256,10);
  const sameDepth=p.control.order.length===3&&!fresh.routes.some(r=>r.order.length<3)&&!first.routes.some(r=>r.order.length<3)?searchPremix(p.level,p.start,p.target,'normalized',3,831791+index,96,6):null;
  const unique=[...first.routes,...fresh.routes,...(sameDepth?.routes??[])].sort((a,b)=>a.times.length-b.times.length||a.error-b.error).filter((r,i,a)=>!a.slice(0,i).some(s=>s.order.join()===r.order.join()&&s.times.every((t,j)=>Math.abs(t-r.times[j])<.02)));
  const featured=measureRegion(p.level,p.start,p.target,p.control);
  const byOrder=unique.filter((r,i,a)=>a.findIndex(s=>s.order.join()===r.order.join())===i);
  const review=[...byOrder,...unique.filter(r=>!byOrder.includes(r))].slice(0,64);
  const rivals=review.map(r=>measureRegion(p.level,p.start,p.target,r));
  const classification=classifyAlternatives(family,rivals,featured);
  const pass=featured.supported&&featured.allMeaningful&&classification.rawMinimum===p.control.order.length;
  results.push({proposal:p,featured,rivals,classification,pass,first:{seed:first.seed,evaluations:first.evaluations,best:first.best},fresh:{seed:fresh.seed,evaluations:fresh.evaluations,best:fresh.best},sameDepth:sameDepth?{seed:sameDepth.seed,evaluations:sameDepth.evaluations,best:sameDepth.best}:null,unmeasuredRoutes:Math.max(0,unique.length-review.length)});
  // Checkpoint every candidate. Distinct partial name; final never overwritten.
  writeFileSync(prefix+'.partial.json',JSON.stringify({stats,results}));
  console.log(JSON.stringify({pass,status:classification.status,raw:classification.rawMinimum,featured:p.control.order.length,window:featured.finishWindowMs}));
 }
}
const selected:any[]=[];
for(const family of FAMILIES){
 const rows=results.filter(r=>r.pass&&r.proposal.family===family).sort((a,b)=>Number(b.classification.status!=='available')-Number(a.classification.status!=='available')||b.classification.rawMinimum-a.classification.rawMinimum||b.proposal.score-a.proposal.score);
 for(const r of rows){if(selected.some(s=>s.proposal.level===r.proposal.level&&colorDistance(s.proposal.target,r.proposal.target)<T*2))continue;selected.push(r);if(selected.filter(s=>s.proposal.family===family).length===2)break;}
}
const sources=['app/play-engine.ts','app/play-premix.ts','scripts/premix-search.ts','scripts/premix-region-metrics.ts','scripts/search-premix-regions.ts'];
writeFileSync(prefix+'.json',JSON.stringify({version:METRIC_VERSION,seed,levels,draws,stats,elapsedSeconds:(Date.now()-begin)/1000,tolerance:T,sources,sourceHash:createHash('sha256').update(sources.map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex'),results,selected:selected.map(r=>r.proposal.id)}));
console.log(JSON.stringify({complete:true,stats,selected:selected.map(r=>({id:r.proposal.id,status:r.classification.status,minimum:r.classification.rawMinimum}))}));
