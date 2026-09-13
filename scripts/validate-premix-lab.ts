import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {premixBank} from '../app/play-premix-bank';
import {colorPoint} from '../app/play-engine';
import {searchPremix,measurePremix} from './premix-search';
const path='docs/play-premix-challenge.json';if(existsSync(path))throw Error('Preserve challenge');
const results=[];
for(const h of premixBank.holes)for(const mode of ['accumulated','normalized'] as const){
 const target=colorPoint([...h.targetRGB] as [number,number,number]);
 const result=searchPremix(h.level,h.initial,target,mode,2,77168001,384,14);
 const shortest=result.routes.length?Math.min(...result.routes.map(r=>r.times.length)):null;
 const selected=result.routes.filter((r,i)=>r.times.length===shortest&&result.routes.findIndex(s=>s.order.join()===r.order.join())===i);
 const measured=selected.map(r=>measurePremix(h.level,h.initial,target,mode,r));
 results.push({id:h.id,mode,shortest,result,measured});console.log({id:h.id,mode,shortest,supported:measured.filter(r=>r.supported).length,style:measured.filter(r=>r.supported&&r.traits[h.style as keyof typeof r.traits]).length});
}
writeFileSync(path,JSON.stringify({results,source:'play-premix-search.json',firstPass:JSON.parse(readFileSync('docs/play-premix-search.json','utf8')).sourceHash}));
if(results.some(r=>r.shortest!==2))throw Error('Shortcut disagreement: review before publishing');
