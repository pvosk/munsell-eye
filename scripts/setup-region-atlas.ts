// Offline recipe-state primitives. A collection of witnesses is not a filled
// continuous region; downstream callers must retain that distinction.
import {createHash} from 'node:crypto';
import type {PaintColor} from '../app/paint-mixing';
import {legStep} from '../app/play-pigment-legs';
import {mixtureColor,colorDistance,type ColorPoint} from '../app/play-engine';
import {rng} from './premix-hybrid';
import {sampleRecipe} from './pigment-leg-proposals';
import type {AtlasNode,AtlasPoint} from '../app/chroma-atlas/types';

export const ATLAS_VERSION='recipe-region-atlas-1';
export type RecipeState={id:string;recipe:number[];lab:number[]};
export type RegionWitness={from:string;to:string;paint:number;share:number;stage:number;replayError:number};
export type SampledRegion={id:string;stage:number;states:RecipeState[];edges:RegionWitness[];coverage:'sampled-witnesses';unknownGaps:true};

function stable(value:unknown):string{
 if(value===undefined)throw Error('Undefined cache input');
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite cache input');
 return JSON.stringify(value);
}
const hash=(x:unknown)=>createHash('sha256').update(stable(x)).digest('hex');
// Keep palette ordering: recipe coordinates refer to that exact ordering.
export function atlasKey(paints:PaintColor[],mixingSourceHash:string,resolution:unknown){
 if(!mixingSourceHash)throw Error('Mixing implementation identity is required');
 return hash({version:ATLAS_VERSION,paints,mixingSourceHash,resolution});
}
export function destinationQueryKey(atlas:string,targetRGB:number[],tolerance:number,depth:number,seedRecipe?:number[]){
 if(targetRGB.length!==3||targetRGB.some(v=>!Number.isFinite(v))||!Number.isFinite(tolerance)||tolerance<=0||!Number.isInteger(depth)||depth<1)throw Error('Invalid destination query');
 return hash({atlas,targetRGB,tolerance,depth,seedRecipe});
}

// Solve q = (1-share) p + share e_paint without changing the endpoint.
// share=1 has an entire inverse set and cannot be represented by one witness.
export function predecessorRecipe(endpoint:number[],paint:number,share:number):number[]|null{
 if(!Number.isInteger(paint)||paint<0||paint>=endpoint.length||!Number.isFinite(share)||share<0||share>=1)return null;
 if(endpoint.some(v=>!Number.isFinite(v)||v<0)||Math.abs(endpoint.reduce((a,b)=>a+b,0)-1)>1e-8)return null;
 if(share>endpoint[paint])return null;
 const recipe=endpoint.map((v,i)=>(v-(i===paint?share:0))/(1-share));
 const replay=legStep(recipe,{paint,share});
 if(replay.some((v,i)=>Math.abs(v-endpoint[i])>1e-8))throw Error('Inverse witness failed replay');
 return recipe;
}

export function buildPaletteAtlas(paints:PaintColor[],seed:number,samples=768):AtlasPoint[]{
 const random=rng(seed),recipes=[...paints.map((_,i)=>paints.map((_,j)=>Number(i===j))),...Array.from({length:samples},()=>sampleRecipe(paints.length,random))];
 return recipes.map(recipe=>{const c=mixtureColor(paints,recipe);return{recipe,rgb:c.rgb,lab:c.lab};});
}

export function expandSetupRegions(paints:PaintColor[],target:ColorPoint,targetRecipe:number[],options:{seed:number;depth:number;cap:number;tolerance:number}){
 const begin=Date.now(),random=rng(options.seed),nodes:AtlasNode[]=[],layers:number[][]=[];let discarded=0,maxReplayError=0;
 if(colorDistance(mixtureColor(paints,targetRecipe),target)>options.tolerance)throw Error('Query seed lies outside landing region');
 const roots=[targetRecipe];
 for(let ray=0;ray<32;ray++){
  const other=sampleRecipe(paints.length,random);let lo=0,hi=1;
  const along=(t:number)=>targetRecipe.map((v,j)=>v*(1-t)+other[j]*t);
  for(let i=1;i<=32;i++){if(colorDistance(mixtureColor(paints,along(i/32)),target)>options.tolerance){hi=i/32;break;}lo=i/32;}
  for(let i=0;i<18&&hi>lo;i++){const mid=(lo+hi)/2;if(colorDistance(mixtureColor(paints,along(mid)),target)<=options.tolerance)lo=mid;else hi=mid;}
  const q=along(lo*(.15+.75*random()));if(colorDistance(mixtureColor(paints,q),target)<=options.tolerance)roots.push(q);
 }
 const add=(recipe:number[],stage:number,parent:number|null,paint:number|null,share:number,known=false)=>{const c=mixtureColor(paints,recipe),id=nodes.length;nodes.push({id,recipe,rgb:c.rgb,lab:c.lab,stage,parent,paint,share,known});return id;};
 layers.push(roots.map(q=>add(q,0,null,null,0)));
 for(let stage=1;stage<=options.depth;stage++){
  const candidates:{recipe:number[];parent:number;paint:number;share:number}[]=[];
  for(const parent of layers[stage-1])for(let paint=0;paint<paints.length;paint++){
   // Nearby duplicate pigment additions are one leg, not a new decision.
   if(nodes[parent].paint===paint)continue;
   for(const f of [.12,.3,.55,.8,.96]){
    const share=nodes[parent].recipe[paint]*f,q=predecessorRecipe(nodes[parent].recipe,paint,share);
    if(!q||share<.00498){discarded++;continue;}
    const c=mixtureColor(paints,q);
    if(colorDistance(c,target)<=options.tolerance*1.001||colorDistance(c,mixtureColor(paints,nodes[parent].recipe))<options.tolerance*.25){discarded++;continue;}
    candidates.push({recipe:q,parent,paint,share});
   }
  }
  // Stratified randomized thinning caps graph growth. Recipe states are never
  // merged merely because their projected colors happen to overlap.
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const buckets=new Map<number,typeof candidates>();for(const c of candidates)buckets.set(c.paint,[...(buckets.get(c.paint)??[]),c]);
  const selected:typeof candidates=[];let offset=0;
  while(selected.length<options.cap){let any=false;for(const b of buckets.values())if(b[offset]){selected.push(b[offset]);any=true;if(selected.length===options.cap)break;}if(!any)break;offset++;}
  discarded+=candidates.length-selected.length;
  layers.push(selected.map(c=>add(c.recipe,stage,c.parent,c.paint,c.share)));
 }
 // Validate every retained chain by replaying the original-pigment mixture.
 let validatedPaths=0;
 for(const n of nodes){if(n.parent===null)continue;let q=n.recipe,at:AtlasNode=n;
  while(at.parent!==null){q=legStep(q,{paint:at.paint!,share:at.share});const next=nodes[at.parent];maxReplayError=Math.max(maxReplayError,...q.map((v,i)=>Math.abs(v-next.recipe[i])));at=next;}
  if(colorDistance(mixtureColor(paints,q),target)>options.tolerance+1e-9)throw Error('Atlas path misses actual target');validatedPaths++;
 }
 return{nodes,stats:{seconds:(Date.now()-begin)/1000,counts:layers.map(l=>l.length),discarded,maxReplayError,validatedPaths}};
}

// Connected local first-share component with later controls held fixed. The
// coarse scan can miss tiny disconnected gaps; this is sampled, not certified.
export function atlasShareWindow(paints:PaintColor[],nodes:AtlasNode[],id:number,target:ColorPoint,tolerance:number):[number,number]{
 const n=nodes[id];if(n.parent===null)return[0,0];
 const accepts=(share:number)=>{share=Math.max(0,Math.min(1-1e-9,share));let q=legStep(n.recipe,{paint:n.paint!,share}),at=nodes[n.parent!];
  while(at.parent!==null){if(colorDistance(mixtureColor(paints,q),target)<=tolerance)return false;q=legStep(q,{paint:at.paint!,share:at.share});at=nodes[at.parent];}
  return colorDistance(mixtureColor(paints,q),target)<=tolerance;
 };
 if(!accepts(n.share))throw Error('Window anchor does not land');
 const boundary=(end:number)=>{let good=n.share,bad=end;
  for(let i=1;i<=24;i++){const s=n.share+(end-n.share)*i/24;if(!accepts(s)){bad=s;break;}good=s;}
  for(let i=0;i<14&&Math.abs(good-bad)>1e-8;i++){const s=(good+bad)/2;if(accepts(s))good=s;else bad=s;}return good;
 };return[boundary(0),boundary(1-1e-9)];
}
