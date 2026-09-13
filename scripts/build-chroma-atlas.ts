import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readBankJson} from './research-bank-io';
import {atlasKey,destinationQueryKey,buildPaletteAtlas,expandSetupRegions,atlasShareWindow} from './setup-region-atlas';
import {legStep} from '../app/play-pigment-legs';
import {mixtureColor,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import type {AtlasCase,AtlasData} from '../app/chroma-atlas/types';
const dir='docs/chroma-atlas-1';mkdirSync(dir,{recursive:true});
const physics=createHash('sha256').update(['app/play-engine.ts','app/play-pigment-legs.ts','node_modules/spectral.js/spectral.js','scripts/setup-region-atlas.ts'].map(p=>readFileSync(p)).join('\n')).digest('hex');
const selected=[];
for(const run of [1,2]){
 const folder=`docs/conditioned-branch-search-${run}`,assessment=readBankJson(folder+'/assessment.json'),audits=readBankJson(folder+'/audits.json'),refs=readBankJson(folder+'/refinements.json');
 for(const row of assessment.selected){if(row.shorterMarginT<1.2)continue;const a=[...audits,...refs.map((r:any)=>r.audit)].find((a:any)=>a.p.id===row.id);selected.push({a,row});}
}
const cases:AtlasCase[]=[],benchmark=[];
for(const [index,{a,row}] of selected.entries()){
 const p=a.p,key=atlasKey(p.paints,physics,{field:768,depth:3,cap:320,seed:51001}),query=destinationQueryKey(key,p.target.rgb,T,3,p.targetRecipe),fieldPath=`${dir}/field-${key}.json`,queryPath=`${dir}/query-${query}.json`;
 const fieldHit=existsSync(fieldPath),queryHit=existsSync(queryPath);
 const field=fieldHit?readBankJson(fieldPath):buildPaletteAtlas(p.paints,51001);
 if(!fieldHit)writeFileSync(fieldPath,JSON.stringify(field));
 const result=queryHit?readBankJson(queryPath):expandSetupRegions(p.paints,p.target,p.targetRecipe,{seed:51001,depth:3,cap:320,tolerance:T});
 if(!queryHit)writeFileSync(queryPath,JSON.stringify(result));
 // Clone cached query before attaching known audited witness chains.
 const nodes=structuredClone(result.nodes),knownRoutes:AtlasCase['knownRoutes']=[];
 const routes=a.measured.filter((r:any)=>r.supported&&r.allMeaningful&&r.legs.length===a.summary.rawMinimum).slice(0,12);
 for(const r of routes){const states=[p.start];for(const l of r.legs)states.push(legStep(states.at(-1)!,l));let parent:number|null=null;
  for(let i=states.length-1;i>=0;i--){const c=mixtureColor(p.paints,states[i]),id=nodes.length;nodes.push({id,recipe:states[i],rgb:c.rgb,lab:c.lab,stage:r.legs.length-i,parent,paint:r.legs[i]?.paint??null,share:r.legs[i]?.share??0,known:true});parent=id;}
  knownRoutes.push({node:parent!,minimum:row.minimum,regionMinimum:row.regionMinimum,styles:Object.entries(r.traits).filter(([,v])=>v).map(([k])=>k),shorterMargin:row.shorterMarginT});
 }
 for(const node of nodes)if(node.parent!==null){node.shareWindow=atlasShareWindow(p.paints,nodes,node.id,p.target,T);node.arc=Array.from({length:9},(_,i)=>{const c=mixtureColor(p.paints,legStep(node.recipe,{paint:node.paint,share:node.share*i/8}));return [...c.lab,...c.rgb].map((v,j)=>Number(v.toFixed(j<3?6:2)));});}
 const name=p.paints.map((p:any)=>p.name.replace('Replacement','').trim()).join(' · ');
 cases.push({id:p.id,name,request:row.requested,paints:p.paints,target:p.target,tolerance:T,field,nodes,defaultNode:knownRoutes[0]?.node??nodes.at(-1)!.id,knownRoutes,cacheKey:query,stats:result.stats});
 benchmark.push({id:p.id,fieldHit,queryHit,stats:result.stats});console.log(JSON.stringify({done:index+1,id:p.id,points:nodes.length,queryHit}));
}
const data:AtlasData={version:'chroma-atlas-1',cases,notes:['Sampled recipe states, not solid reachable volumes.','Layers show available example lengths, not necessary leg counts.','Same-looking colors can retain different recipes.','Known routes are audited; generated branches have replay validation, not minimum-leg certification.']};
mkdirSync('public/atlas',{recursive:true});
cases.forEach((c,i)=>writeFileSync(`public/atlas/case-${i}.json`,JSON.stringify(c)));
writeFileSync('public/atlas/index.json',JSON.stringify({version:data.version,notes:data.notes,cases:cases.map((c,i)=>({id:c.id,name:c.name,request:c.request,url:`/atlas/case-${i}.json`}))}));
writeFileSync(dir+(benchmark.every(b=>b.queryHit)?'/benchmark-cached.json':'/benchmark.json'),JSON.stringify({physics,benchmark},null,2));
console.log(JSON.stringify({cases:cases.length,bytes:JSON.stringify(data).length}));
