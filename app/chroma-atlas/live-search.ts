import type {AtlasCase,AtlasNode} from './types';
import {canonical,distance,exactKey,nodeRoute,normalize,point,QueryCache,replay,step,type Leg,type LiveInput,type LiveResult} from './live-model';

function subsets(n:number,k:number){const out:number[][]=[];function visit(q:number[],from:number){if(q.length===k){out.push(q);return;}for(let i=from;i<n;i++)visit([...q,i],i+1);}visit([],0);return out;}
function seeds(n:number,count:number){return [Array(n).fill(1/n),...Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)),...Array.from({length:count},(_,i)=>normalize(Array.from({length:n},(_,j)=>.02+((Math.sin((i+3)*127.1+(j+7)*311.7)*43758.5453)%1+1)%1)))];}
export function fitSimplex(score:(q:number[])=>number,initial:number[],iterations=65){let q=normalize(initial),error=score(q),size=.15;for(let i=0;i<iterations&&size>1e-5;i++){let best=q,e=error;for(let a=0;a<q.length;a++)for(let b=0;b<q.length;b++){if(a===b)continue;const d=Math.min(size,q[a]-(a===0?1e-9:0));if(d<=0)continue;const candidate=[...q];candidate[a]-=d;candidate[b]+=d;const ce=score(candidate);if(ce<e-1e-12){best=candidate;e=ce;}}if(best===q)size*=.5;else {q=best;error=e;}}return {q,error};}
function fromWeights(indices:number[],weights:number[]){let retained=weights[0];const legs:Leg[]=[];for(let i=0;i<indices.length;i++){const amount=weights[i+1];if(amount<1e-10)continue;retained+=amount;legs.push({paint:indices[i],share:Math.min(1-1e-9,amount/retained)});}return canonical(legs);}
function endpoint(start:number[],indices:number[],weights:number[]){const q=start.map(v=>v*weights[0]);indices.forEach((p,i)=>{q[p]+=weights[i+1];});return q;}

export class LiveSolver {
 cache=new QueryCache();
 private regions=new Map<string,{nodes:AtlasNode[];recipe:number[]|null;error:number}>();
 constructor(readonly data:AtlasCase){}
 async solve(input:LiveInput,emit:(r:LiveResult)=>void,cancelled=()=>false,pause=()=>new Promise<void>(r=>setTimeout(r,0))){
  const data=this.data,paints=data.paints,target=input.target,tolerance=data.tolerance,key=exactKey(data,input),cached=this.cache.get(key);
  if(cached){emit({...cached,cacheHit:true});return;}
  let best:Leg[]|null=null,bestError=Infinity,shortest:number|null=null,checkedDepth=0,nodes:AtlasNode[]=[],landingRecipe:number[]|null=null,closestError=Infinity;
  const score=(q:number[])=>distance(point(paints,q).lab,target);
  const accept=(candidate:Leg[])=>{let route=canonical(candidate);const t=replay(paints,input.start,route,target,tolerance,0);if(t.capture!==null)route=route.slice(0,t.capture);const error=score(route.reduce(step,input.start));if(error<=tolerance){if(shortest===null||route.length<shortest||(route.length===shortest&&error<bestError)){best=route;bestError=error;shortest=route.length;}}else if(shortest===null&&error<bestError){best=route;bestError=error;}};
  const result=(phase:LiveResult['phase']):LiveResult=>({key,target,phase,best,bestError,shortest,checkedDepth,nodes,landingRecipe,closestError,cacheHit:false});
  const send=(phase:LiveResult['phase'])=>{if(!cancelled())emit(result(phase));};
  accept([]);accept(input.legs);
  const nearby=this.cache.near(input),warm=[input.legs,...nearby.flatMap(x=>x.result.best?[x.result.best]:[]),...data.knownRoutes.slice(0,4).map(r=>nodeRoute(data.nodes,r.node).legs)];
  for(const candidate of warm){
   let legs=candidate.map(l=>({...l})),error=score(legs.reduce(step,input.start)),size=.08;
   for(let k=0;k<22&&size>1e-4;k++){let next=legs,e=error;for(let axis=0;axis<legs.length;axis++)for(const direction of [-1,1]){const q=legs.map((l,i)=>i===axis?{...l,share:Math.max(0,Math.min(1-1e-9,l.share+direction*size))}:l);const qe=score(q.reduce(step,input.start));if(qe<e){next=q;e=qe;}}if(next===legs)size*=.5;else {legs=next;error=e;}}
   accept(legs);send('warm');await pause();if(cancelled())return;
  }
  const targetKey=JSON.stringify(target),oldRegion=this.regions.get(targetKey);
  if(oldRegion){nodes=oldRegion.nodes;landingRecipe=oldRegion.recipe;closestError=oldRegion.error;}
  else {
   const roots=data.field.slice().sort((a,b)=>distance(a.lab,target)-distance(b.lab,target)).slice(0,8).map(p=>p.recipe);
   roots.push(...nearby.flatMap(x=>x.result.landingRecipe?[x.result.landingRecipe]:[]),...seeds(paints.length,6));
   for(const q of roots){const fitted=fitSimplex(score,q,75);if(fitted.error<closestError){closestError=fitted.error;landingRecipe=fitted.q;}await pause();if(cancelled())return;}
   if(landingRecipe&&closestError<=tolerance){
    const add=(recipe:number[],stage:number,parent:number|null,paint:number|null,share:number)=>{const id=nodes.length;nodes.push({...point(paints,recipe),id,stage,parent,paint,share,known:false});return id;};
    add(landingRecipe,0,null,null,0);
    // Sample the accepted landing neighborhood before taking inverse edges.
    for(const other of roots.slice(0,8)){let lo=0,hi=1;const at=(t:number)=>landingRecipe!.map((v,j)=>v*(1-t)+other[j]*t);for(let j=1;j<=16;j++){if(score(at(j/16))>tolerance){hi=j/16;break;}lo=j/16;}for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(score(at(mid))<=tolerance)lo=mid;else hi=mid;}const q=at(lo*.7);if(score(q)<=tolerance)add(q,0,null,null,0);}
    let layer=nodes.map(n=>n.id);
    for(let stage=1;stage<=3;stage++){
     const next:number[]=[];
     // Interleave paint and parent so a capped layer does not all use one paint.
     for(const fraction of [.32,.72,.93])for(const parent of layer)for(let paint=0;paint<paints.length;paint++){
      if(next.length>=120||nodes[parent].paint===paint)continue;
      const share=nodes[parent].recipe[paint]*fraction;if(share<.00498||share>=1)continue;
      const q=nodes[parent].recipe.map((v,i)=>(v-(i===paint?share:0))/(1-share));
      if(score(q)<=tolerance||distance(point(paints,q).lab,nodes[parent].lab)<tolerance*.25)continue;
      next.push(add(q,stage,parent,paint,share));
     }
     layer=next;await pause();if(cancelled())return;
    }
   }else landingRecipe=null;
   this.regions.set(targetKey,{nodes,recipe:landingRecipe,error:closestError});if(this.regions.size>32)this.regions.delete(this.regions.keys().next().value!);
  }
  send('search');
  // Fresh subset attacks are separate from warm witness fitting. Numerical
  // failure never becomes an impossibility or minimum-leg certificate.
  for(let depth=1;depth<=Math.min(3,paints.length);depth++){
   for(const indices of subsets(paints.length,depth)){
    const evaluate=(weights:number[])=>score(endpoint(input.start,indices,weights));
    const ranked=seeds(depth+1,14).map(q=>({q,error:evaluate(q)})).sort((a,b)=>a.error-b.error);
    for(const seed of ranked.slice(0,3)){const fitted=fitSimplex(evaluate,seed.q);accept(fromWeights(indices,fitted.q));await pause();if(cancelled())return;}
   }
   checkedDepth=depth;send('search');
  }
  const done=result('done');this.cache.put(key,input,done);send('done');
 }
}
