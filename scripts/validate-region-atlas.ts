import {readFileSync,writeFileSync} from 'node:fs';
import {searchLegEndpoints,challengeLegOrders} from './pigment-leg-search';
import {colorPoint,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import type {AtlasCase} from '../app/chroma-atlas/types';import type {PaintColor} from '../app/paint-mixing';
const index=JSON.parse(readFileSync('public/atlas/index.json','utf8')),records=[];
for(const [i,c] of index.cases.entries()){
 const data=JSON.parse(readFileSync('public'+c.url,'utf8')) as AtlasCase,paints=data.paints as PaintColor[],target=colorPoint(data.target.rgb as [number,number,number]);
 const selected=[data.nodes[data.defaultNode],...[1,2,3].map(stage=>data.nodes.filter(n=>!n.known&&n.stage===stage)[17])].filter(Boolean);
 for(const [j,node] of selected.entries()){
  const search=searchLegEndpoints(paints,node.recipe,target,node.stage,819991+i*1009+j*37,96,6),minimum=search.best.findIndex(e=>e.error<=T)+1;
  const raw=minimum||null,known=data.knownRoutes.find(r=>r.node===node.id);
  const check=known?challengeLegOrders(paints,node.recipe,target,Math.max(1,(known.minimum??3)-1),919991+i*379,256,12):null;
  const counterexample=search.endpoints.filter(e=>e.error<=T).sort((a,b)=>a.paints.length-b.paints.length||a.error-b.error)[0]??null;
  records.push({case:data.id,node:node.id,layer:node.stage,rawMinimum:raw,knownMinimum:known?.minimum??null,missedKnownWitness:raw===null||raw>node.stage,shorterThanLayer:raw!==null&&raw<node.stage,bestT:search.best.map(e=>e.error/T),counterexample,knownShortcut:check?.routes.filter(r=>r.error<=T)??[]});
 }
}
const result={records,disagreements:records.filter(r=>r.missedKnownWitness||r.knownShortcut.length),shorterThanLayer:records.filter(r=>r.shorterThanLayer).length};
writeFileSync('docs/chroma-atlas-1/independent-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify({tested:records.length,disagreements:result.disagreements.length,shorterThanLayer:result.shorterThanLayer}));
