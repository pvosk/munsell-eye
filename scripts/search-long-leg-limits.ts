import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {recipeContributions,contributionLegs,contributionRecipe,legReplay} from '../app/play-pigment-legs';
import {sampleRecipe} from './pigment-leg-proposals';
import {searchLegEndpoints,challengeLegOrders} from './pigment-leg-search';
import {rng,ascend} from './premix-hybrid';
import {measureLegRegion,legGeometry} from './pigment-leg-metrics';
import {inverseChain} from './branching-regions';
const seed=Number(process.env.LEG_LIMIT_SEED??611091),perDepth=Number(process.env.LEG_LIMIT_PALETTES??160),out=process.env.LEG_LIMIT_OUTPUT??'docs/long-leg-limits-1';
if(existsSync(out))throw Error('Archive exists');mkdirSync(out,{recursive:true});
const catalog=[...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].filter((p,i,a)=>a.findIndex(q=>q.id===p.id&&q.rgb.join()===p.rgb.join()&&q.strength===p.strength)===i);
const random=rng(seed),proposals:any[]=[],screens:any[]=[],finalists:any[]=[],begin=Date.now();
const mode=process.env.LEG_LIMIT_MODE??'independent-recipes';
const softmax=(z:number[])=>{const a=[...z,0],m=Math.max(...a),e=a.map(v=>Math.exp(v-m)),s=e.reduce((a,b)=>a+b);return e.map(x=>x/s);};
const logits=(q:number[])=>q.slice(0,-1).map(v=>Math.log(v/q.at(-1)!));
for(const legs of [4,5,6]){
 for(let pi=0;pi<perDepth;pi++){
  const paints:PaintColor[]=[];while(paints.length<legs+1){const p=catalog[Math.floor(random()*catalog.length)];if(!paints.some(q=>q.id===p.id))paints.push(p);}
  let chosen:any=null;
  for(let k=0;k<8;k++){
   // Preserve the original independent run's start-then-target random draw order.
   const first=sampleRecipe(paints.length,random),start=mode==='inverse-chain'?inverseChain(first,legs,random)!.start:first,targetRecipe=mode==='inverse-chain'?first:sampleRecipe(paints.length,random),target=mixtureColor(paints,targetRecipe),contrib=recipeContributions(start,targetRecipe),demo=contributionLegs(contrib.paints,contrib.weights);
   let one=Infinity;for(let paint=0;paint<paints.length;paint++)for(let s=0;s<=24;s++)one=Math.min(one,colorDistance(mixtureColor(paints,start.map((v,j)=>(1-s/24)*v+(j===paint?s/24:0))),target)/T);
   const p={id:`limit-${seed}-${legs}-${pi}-${k}`,paints,start,targetRecipe,target,legs,demonstration:demo,one};proposals.push(p);
   if(one>1.2&&(!chosen||one>chosen.one))chosen=p;
  }
  if(chosen){const p=chosen,search=searchLegEndpoints(p.paints,p.start,p.target,3,seed+pi*137+legs*10007,24,3),best=search.best.map(e=>e.error/T),counterexample=search.endpoints.filter(e=>e.error<=T).sort((a,b)=>a.paints.length-b.paints.length||a.error-b.error)[0]??null;
   screens.push({p,best,counterexample,evaluations:search.evaluations});
  }
  if(pi%32===0)console.log(JSON.stringify({phase:'screen',legs,palettes:pi+1,proposals:proposals.length,screened:screens.length,seconds:(Date.now()-begin)/1000}));
 }
 writeFileSync(out+`/proposals-${legs}.json`,JSON.stringify(proposals.filter(p=>p.legs===legs)));
 // Refine a few strongest misses even when they already have a shortcut.
 const top=screens.filter(s=>s.p.legs===legs).sort((a,b)=>Math.min(...b.best)-Math.min(...a.best)).slice(0,6);
 for(const [index,s] of top.entries()){
  let p=s.p,attacks=searchLegEndpoints(p.paints,p.start,p.target,3,seed+index*163+legs*71003,64,6).endpoints;const history=[];
  for(let round=0;round<3;round++){
   const score=(start:number[],targetRecipe:number[])=>{const target=mixtureColor(p.paints,targetRecipe);return Math.min(4,...attacks.map(e=>colorDistance(mixtureColor(p.paints,contributionRecipe(start,e.paints,e.weights)),target)/T))-.1*Math.max(0,3-colorDistance(mixtureColor(p.paints,start),target)/T)**2;};
   const x=[...logits(p.start),...logits(p.targetRecipe)],opt=ascend(z=>score(softmax(z.slice(0,legs)),softmax(z.slice(legs))),x,x.map(()=>[-8,8]),5),start=softmax(opt.x.slice(0,legs)),targetRecipe=softmax(opt.x.slice(legs)),target=mixtureColor(p.paints,targetRecipe);
   const c=searchLegEndpoints(p.paints,start,target,3,seed+round*617+index*977+legs*73001,64,6);attacks=[...attacks,...c.endpoints];
   const before=score(p.start,p.targetRecipe),after=score(start,targetRecipe),accepted=after>before+1e-8;history.push({round,before,after,accepted});if(accepted)p={...p,start,targetRecipe,target};
  }
  // If three already suffice, no factorial/deeper search is needed to refute
  // necessity of four, five or six. Otherwise enumerate every shorter subset.
  const check=searchLegEndpoints(p.paints,p.start,p.target,3,seed+index*541+legs*99001,256,12);
  const escaped=check.best.some(e=>e.error<=T),full=escaped?null:searchLegEndpoints(p.paints,p.start,p.target,legs-1,seed+index*743+legs*110003,192,10);
  const endpoints=[...check.endpoints,...(full?.endpoints??[])],success=endpoints.filter(e=>e.error<=T).sort((a,b)=>a.paints.length-b.paints.length||a.error-b.error)[0]??null;
  const contrib=recipeContributions(p.start,p.targetRecipe),demo=contributionLegs(contrib.paints,contrib.weights),route=success?contributionLegs(success.paints,success.weights):null;
  const independent=challengeLegOrders(p.paints,p.start,p.target,success?success.paints.length:Math.min(3,legs-1),seed+index*997+legs*130003,192,10);
  const independentSuccess=independent.routes.filter(r=>r.error<=T).sort((a,b)=>a.order.length-b.order.length||a.error-b.error)[0]??null;
  const verified=route?colorDistance(mixtureColor(p.paints,legReplay(p.start,route)),p.target)/T:null;
  const result={p,history,best3:check.best.map(e=>e.error/T),bestDeeper:full?.best.map(e=>e.error/T)??null,counterexample:success,route,verified,independent:{seed:independent.seed,best:independent.best.map(e=>e/T),witness:independentSuccess,evaluations:independent.evaluations},demonstration:demo,demoGeometry:legGeometry(p.paints,p.start,p.target,demo,96),routeRegion:route?measureLegRegion(p.paints,p.start,p.target,route):null};
  finalists.push(result);writeFileSync(out+'/finalists.json',JSON.stringify(finalists));console.log(JSON.stringify({phase:'final',legs,done:index+1,shortcut:success?.paints.length??null,seconds:(Date.now()-begin)/1000}));
 }
}
writeFileSync(out+'/screens.json',JSON.stringify(screens));
const summary={seed,mode,perDepth,catalog:catalog.length,proposals:proposals.length,screened:screens.length,refined:finalists.length,seconds:(Date.now()-begin)/1000,groups:[4,5,6].map(legs=>({legs,paints:legs+1,proposals:proposals.filter(p=>p.legs===legs).length,screened:screens.filter(s=>s.p.legs===legs).length,initial3LegEscapes:screens.filter(s=>s.p.legs===legs&&s.counterexample).length,final:finalists.filter(f=>f.p.legs===legs).map(f=>({id:f.p.id,shortcut:f.counterexample?.paints.length??null,independent:f.independent.witness?.order.length??null}))})),sourceHash:createHash('sha256').update(readFileSync('scripts/search-long-leg-limits.ts')).digest('hex'),limitations:['Finite sampling, not impossibility proof','All recipe targets and starts are movable within their palette','Search objectives do not imply route quality','Three-leg shortcuts refute longer necessity without testing every longer order']};
writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
