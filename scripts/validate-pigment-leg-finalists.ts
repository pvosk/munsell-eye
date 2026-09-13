import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {searchLegEndpoints,challengeLegOrders} from './pigment-leg-search';
import {LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {readBankBytes,readBankJson} from './research-bank-io';
const output='docs/pigment-leg-holdout-1';
if(existsSync(output))throw Error('Archive exists');
const paths=['docs/pigment-leg-audit-1/audits.json','docs/pigment-leg-search-1/audits.json','docs/pigment-leg-search-2/audits.json'];
// Include all historical survivors and all new baseline/refinement survivors,
// not just a hand-picked handful with the widest margins.
const candidates=paths.flatMap(path=>readBankJson(path).filter((a:any)=>a.summary.rawMinimum>=3).map((a:any)=>({path,a})));
mkdirSync(output,{recursive:true});
writeFileSync(output+'/manifest.json',JSON.stringify({inputs:paths.map(path=>({path,hash:createHash('sha256').update(readBankBytes(path)).digest('hex')})),cases:candidates.map(({path,a})=>({path,id:a.p.id})),seeds:[819173,991337],samples:1024,restarts:32,policy:'Counterexample search, not a global proof. Two parameterizations, fresh seeds, unchanged physical model.'}));
const rows:any[]=[];const begin=Date.now();let evaluations=0;
for(const [i,{path,a}] of candidates.entries()){
 const p=a.p,depth=a.summary.rawMinimum-1;
 const primary=searchLegEndpoints(p.paints,p.start,p.target,depth,819173,1024,32);
 const independent=challengeLegOrders(p.paints,p.start,p.target,depth,991337,1024,32);
 const bestT=primary.best.map((e,k)=>Math.min(e.error,independent.best[k])/T);
 evaluations+=primary.evaluations+independent.evaluations;
 rows.push({id:p.id,path,previousRawMinimum:a.summary.rawMinimum,bestT,survives:bestT.every(x=>x>1),primary,independent});
 writeFileSync(output+'/checks.json',JSON.stringify(rows));
 if(i%12===0)console.log(JSON.stringify({done:i+1,total:candidates.length,seconds:(Date.now()-begin)/1000}));
}
const summary={cases:rows.length,survivors:rows.filter(r=>r.survives).length,counterexamples:rows.filter(r=>!r.survives).map(r=>({id:r.id,bestT:r.bestT})),evaluations,seconds:(Date.now()-begin)/1000};
writeFileSync(output+'/summary.json',JSON.stringify(summary));console.log(JSON.stringify(summary));
