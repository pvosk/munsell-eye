// Further strata from the existing bank; no new pigment or live-rule edits.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {audit,fingerprint,rng} from './broad-palette-mine';
const out='docs/play-broad-expanded-audit.json';if(existsSync(out))throw Error('Preserve existing run');
const source=JSON.parse(readFileSync('docs/play-broad-palette-screen.json','utf8'));
if(source.sourceHash!==fingerprint())throw Error('Source drift');
const sourceHash=createHash('sha256').update(readFileSync('scripts/expand-broad-audits.ts')).digest('hex');
const pool=Array.from(new Map(Object.values(source.shortlists).flat().map((p:any)=>[p.id,p])).values()) as any[];
const selected:any[]=[],random=rng(91228881),seen=new Set(source.screens.map((s:any)=>s.proposal.indices.join()));
// Broader quotas, with half selected randomly within represented archive cells.
// Not an unbiased sample of all 509k proposals: the cells already retain extrema.
for(const size of [3,4,5,6,8]){
 const list=pool.filter(p=>p.indices.length===size&&!seen.has(p.indices.join())).map(p=>({p,random:random()}));
 const quota=size<=4?32:16;
 const ranked=[...list].sort((a,b)=>b.p.nearest-a.p.nearest),shuffled=[...list].sort((a,b)=>a.random-b.random);
 for(let i=0;i<quota;i++){const list=i%2?shuffled:ranked;const next=list.find(x=>!seen.has(x.p.indices.join()));if(!next)break;selected.push(next.p);seen.add(next.p.indices.join());}
}
const start=Date.now(),screens:any[]=[],deep:any[]=[];
for(const p of selected){console.log(`Additional two-addition audit ${screens.length+1}/${selected.length}: ${p.id}`);screens.push(audit(p,false));}
const save=()=>writeFileSync(out,JSON.stringify({sourceHash,parentSourceHash:source.sourceHash,seed:91228881,screens,deep,elapsedSeconds:(Date.now()-start)/1000}));save();
for(const size of [3,4,5,6,8]){
 const group=screens.filter(s=>s.paints.length===size);
 // General support first, then multibase chromatic movement / coupled balance.
 group.sort((a,b)=>a.flags.length-b.flags.length||Math.max(b.availability.glide.length,b.availability.balance.length)/size-Math.max(a.availability.glide.length,a.availability.balance.length)/size||b.proposal.nearest-a.proposal.nearest);
 for(const s of group.slice(0,2)){console.log(`Additional three-addition audit ${deep.length+1}: ${s.proposal.id}`);deep.push(audit(s.proposal,true));save();}
}
console.log(JSON.stringify({screens:screens.length,deep:deep.length,seconds:(Date.now()-start)/1000}));
