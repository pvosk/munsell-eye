import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {legGeometry} from './pigment-leg-metrics';
import {readBankJson} from './research-bank-io';
const output='docs/pigment-leg-results-1/resolution.json';
if(existsSync(output))throw Error('Archive exists');
const rows=[1,2].flatMap(n=>readBankJson(`docs/pigment-leg-search-${n}/audits.json`));
let routes=0,maxFinishDifference=0,maxHueDifference=0;const flips:any[]=[];
for(const a of rows)for(const r of a.measured){
 const g=legGeometry(a.p.paints,a.p.start,a.p.target,r.legs,192);routes++;
 maxFinishDifference=Math.max(maxFinishDifference,Math.abs(g.finish-r.finish));
 maxHueDifference=Math.max(maxHueDifference,Math.abs(g.hueTravel-r.hueTravel));
 const changed=Object.keys(g.traits).filter(k=>g.traits[k as keyof typeof g.traits]!==r.traits[k]);
 if(changed.length)flips.push({id:a.p.id,legs:r.legs,changed,at48:r.traits,at192:g.traits});
}
const result={routes,samples:[48,192],maxFinishDifference,maxHueDifference,flips};
writeFileSync(output,JSON.stringify(result));console.log(JSON.stringify({...result,flips:flips.length}));
