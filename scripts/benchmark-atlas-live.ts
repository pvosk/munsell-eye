import {readFileSync,writeFileSync} from 'node:fs';
import {LiveSolver} from '../app/chroma-atlas/live-search';
import {changeFraction,nodeRoute,replay,type LiveResult} from '../app/chroma-atlas/live-model';
import type {AtlasCase} from '../app/chroma-atlas/types';
const records=[];
for(let i=0;i<10;i++){
 const data=JSON.parse(readFileSync(`public/atlas/case-${i}.json`,'utf8')) as AtlasCase,solver=new LiveSolver(data),initial={...nodeRoute(data.nodes,data.defaultNode),target:data.target.lab};
 const updates=[initial,{...initial,target:initial.target.map((v,i)=>v+(i===0?.004:0))},{...initial,start:changeFraction(initial.start,0,Math.min(.99,initial.start[0]+.04))}];
 for(const [edit,input] of updates.entries()){
  let last:LiveResult|undefined;const begin=performance.now();await solver.solve(input,r=>{last=r;},()=>false,async()=>{});if(!last||last.phase!=='done')throw Error('Incomplete query');
  records.push({case:i,edit,computeMs:performance.now()-begin,shortest:last.shortest,nodes:last.nodes.length,errorT:last.bestError/data.tolerance,accepted:last.shortest!==null});
 }
}
writeFileSync('docs/chroma-atlas-live-checks.json',JSON.stringify({note:'Compute-only Node timings with scheduler yields omitted. Not browser frame timings or exhaustive minimum proofs.',records},null,2));
const d=JSON.parse(readFileSync('public/atlas/case-0.json','utf8')) as AtlasCase,r=nodeRoute(d.nodes,d.defaultNode),begin=performance.now();for(let i=0;i<240;i++)replay(d.paints,changeFraction(r.start,0,.1+i/600),r.legs,d.target.lab,d.tolerance);
console.log(JSON.stringify({queries:records.length,accepted:records.filter(r=>r.accepted).length,maxComputeMs:Math.max(...records.map(r=>r.computeMs)),meanTraceMs:(performance.now()-begin)/240}));
