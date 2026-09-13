import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {normalizeRecipe,predecessor} from '../app/play-premix';
import {legReplay,legStep,contributionRecipe,type PigmentLeg} from '../app/play-pigment-legs';
import type {PaintColor} from '../app/paint-mixing';
import {legGeometry,type LegStyle} from './pigment-leg-metrics';
import {searchLegEndpoints} from './pigment-leg-search';
import {ascend} from './premix-hybrid';
import type {LegPuzzle} from './pigment-leg-audit';
export type Proposal=LegPuzzle&{targetRecipe:number[];method:'palette-first'|'route-first';intent:LegStyle|null;paletteName:string;screen:number;eligible:boolean;depth:number;sourceSeed:number};
export const sampleRecipe=(n:number,random:()=>number)=>normalizeRecipe(Array.from({length:n},()=>Math.exp((random()-.5)*5)));
export function styleScore(g:ReturnType<typeof legGeometry>,style:LegStyle){
 switch(style){case 'rise':return 5*g.value+2*g.finish+Math.min(.1,g.setup);case 'drop':return-5*g.value+2*g.finish+Math.min(.1,g.setup);
 case 'chromatic-ride':return g.finish*g.chromaticFraction*(1+g.hueTravel);case 'setup-glide':return g.finish+g.abTravel-.25*g.setup;
 case 'coupled-balance':return 6*g.tradeoff+g.finish;case 'interior-assembly':return g.meaningful*.08+Math.min(g.setup,.5);}
}
function finishScore(paints:PaintColor[],recipe:number[],paint:number,share:number,style:LegStyle){
 const before=predecessor(recipe,paint,share);if(!before)return{before:null,score:-Infinity};
 const g=legGeometry(paints,before,mixtureColor(paints,recipe),[{paint,share}],20);
 return{before,score:styleScore(g,style)};
}
export function proposePaletteFirst(paints:PaintColor[],depth:number,random:()=>number){
 const start=sampleRecipe(paints.length,random),available=paints.map((_,i)=>i),legs:PigmentLeg[]=[];
 while(legs.length<depth){const i=Math.floor(random()*available.length),paint=available.splice(i,1)[0];legs.push({paint,share:.12+.84*random()});}
 return{start,legs,targetRecipe:legReplay(start,legs),internalTrials:1};
}
export function proposeRouteFirst(paints:PaintColor[],depth:number,style:LegStyle,random:()=>number){
 const targetRecipe=sampleRecipe(paints.length,random);let q=targetRecipe;const legs:PigmentLeg[]=[],used=new Set<number>();let internalTrials=0;
 // Desired finishing geometry chooses the final pigment and inverse share.
 // This is a route-first search WITHIN the shared palette pool, not unconstrained
 // continuous pigment invention. Palette competition is evaluated across the pool.
 let best:{paint:number;share:number;before:number[];score:number}|null=null;
 for(let paint=0;paint<paints.length;paint++)for(let trial=0;trial<3;trial++){
  const share=q[paint]*(.35+.649*random()),candidate=finishScore(paints,q,paint,share,style);internalTrials++;
  if(candidate.before&&(!best||candidate.score>best.score))best={paint,share,before:candidate.before,score:candidate.score};
 }
 if(!best)throw Error('No legal inverse finish');legs.unshift({paint:best.paint,share:best.share});used.add(best.paint);q=best.before;
 while(legs.length<depth){
  const available=paints.map((_,i)=>i).filter(i=>!used.has(i)),paint=available[Math.floor(random()*available.length)];
  const share=q[paint]*(.4+.599*random()),before=predecessor(q,paint,share);if(!before)throw Error('Illegal inverse setup');
  used.add(paint);legs.unshift({paint,share});q=before;
 }
 return{start:q,legs,targetRecipe,internalTrials};
}
export function proposalScreen(p:Omit<Proposal,'screen'|'eligible'>){
 let one=Infinity;for(let paint=0;paint<p.paints.length;paint++)for(let i=0;i<=24;i++)one=Math.min(one,colorDistance(mixtureColor(p.paints,legStep(p.start,{paint,share:Math.min(1-1e-9,i/24)})),p.target));
 const distance=colorDistance(mixtureColor(p.paints,p.start),p.target);
 // Blind to intended style: retain candidates, prioritize separation and target
 // coverage only for the expensive audit. Rejected slots remain in the bank.
 return{oneT:one/T,distanceT:distance/T,screen:Math.min(one/T,6)+.12*Math.min(distance/T,15),eligible:distance>T&&one/T>=1.25};
}
function logits(q:number[]){return q.slice(0,-1).map(x=>Math.log(Math.max(x,1e-10)/Math.max(q.at(-1)!,1e-10)));}
function recipe(x:number[]){const y=[...x,0],max=Math.max(...y);return normalizeRecipe(y.map(v=>Math.exp(v-max)));}
export function refineLegProposal(initial:Proposal,mode:'start-only'|'target-only'|'joint',seed:number,rounds=5){
 const n=initial.paints.length-1,depth=initial.demonstration.length;let p=initial;
 const encode=(p:Proposal)=>[...logits(p.start),...logits(p.targetRecipe),...p.demonstration.map(l=>l.share)];
 const decode=(x:number[])=>{const start=mode==='target-only'?initial.start:recipe(x.slice(0,n)),targetRecipe=mode==='start-only'?initial.targetRecipe:recipe(x.slice(n,2*n));return{...p,start,targetRecipe,target:mixtureColor(p.paints,targetRecipe),demonstration:p.demonstration.map((leg,i)=>({...leg,share:x[2*n+i]}))};};
 let rival=searchLegEndpoints(p.paints,p.start,p.target,Math.min(3,depth-1),seed,12,2),evaluations=rival.evaluations;
 const score=(p:Proposal,attacks:typeof rival.endpoints)=>{
  const errors=attacks.map(e=>colorDistance(mixtureColor(p.paints,contributionRecipe(p.start,e.paints,e.weights)),p.target)/T);
  const witness=colorDistance(mixtureColor(p.paints,legReplay(p.start,p.demonstration)),p.target)/T;
  const last=p.demonstration.at(-1)!,jitter=Math.max(...[-.0125,.0125].map(d=>colorDistance(mixtureColor(p.paints,legReplay(p.start,[...p.demonstration.slice(0,-1),{...last,share:Math.max(0,Math.min(1-1e-9,last.share+d))}])),p.target)/T));
  return Math.min(6,...errors)-25*Math.max(0,witness-.6)**2-2*Math.max(0,jitter-1)**2;
 };
 let value=score(p,rival.endpoints);const history=[];
 for(let round=0;round<rounds;round++){
  const x=encode(p),bounds:[number,number][]=x.map((v,i)=>((i<n&&mode==='target-only')||(i>=n&&i<2*n&&mode==='start-only'))?[v,v]:i<2*n?[-8,8]:[.00001,.99999]);
  const candidate=ascend(x=>score(decode(x),rival.endpoints),x,bounds,3),trial=decode(candidate.x);
  const next=searchLegEndpoints(p.paints,trial.start,trial.target,Math.min(3,depth-1),seed+31*(round+1),16,3);evaluations+=next.evaluations;
  const attacks=[...rival.endpoints,...next.endpoints],nextScore=score(trial,attacks),currentScore=score(p,attacks);
  const accepted=nextScore>currentScore+1e-7&&colorDistance(mixtureColor(p.paints,legReplay(trial.start,trial.demonstration)),trial.target)<=T;
  history.push({round,accepted,score:nextScore,bestT:next.best.map(e=>e.error/T)});
  rival={...next,endpoints:attacks};if(accepted){p=trial;value=nextScore;}else value=currentScore;
 }
 return{p:{...p,id:initial.id+'/'+mode},mode,initial:initial.id,history,score:value,evaluations};
}
