// Post-selection holdout: new seed, different coordinates from the proposer.
// Keep every counterexample, including those which invalidate a shortlist row.
import {writeFileSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {challengeLegOrders} from './pigment-leg-search';
import {measureLegRegion} from './pigment-leg-metrics';
import {LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
const folders=['docs/conditioned-branch-search-1','docs/conditioned-branch-search-2'];
for(const [index,out] of folders.entries()){
 const assessment=readBankJson(out+'/assessment.json'),audits=readBankJson(out+'/audits.json'),refinements=readBankJson(out+'/refinements.json');
 const all=[...audits,...refinements.map((r:any)=>r.audit)];
 const ids=new Set(assessment.selected.map((r:any)=>r.id));
 // Also challenge the closest-to-surviving five-paint cases, even though their
 // proposed four-leg journeys already have known shorter solutions.
 const five=all.filter((a:any)=>a.p.paints.length===5).sort((a:any,b:any)=>b.bestByDepth[2]-a.bestByDepth[2]).slice(0,3);
 five.forEach((a:any)=>ids.add(a.p.id));
 const rows=[];
 for(const id of ids){
  const a=all.find((a:any)=>a.p.id===id),p=a.p,depth=Math.max(1,a.summary.rawMinimum-1);
  const seed:number=3071991+index*101003+rows.length*997;
  const check=challengeLegOrders(p.paints,p.start,p.target,depth,seed,384,20);
  const successes=check.routes.filter(r=>r.error<=T).map(r=>({order:r.order,shares:r.shares,errorT:r.error/T,region:measureLegRegion(p.paints,p.start,p.target,r.order.map((paint,i)=>({paint,share:r.shares[i]})))}));
  rows.push({id,previousMinimum:a.summary.rawMinimum,depth,seed,samples:384,restarts:20,evaluations:check.evaluations,bestByDepth:check.best.map(e=>e/T),counterexamples:successes});
 }
 const result={policy:'Fresh ordered-fraction coordinate search; finite numerical holdout, not a global proof',rows,counterexamples:rows.filter(r=>r.counterexamples.length).length};
 writeFileSync(out+'/holdout.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({out,tested:rows.length,counterexamples:result.counterexamples,margins:rows.map(r=>({id:r.id,margin:Math.min(...r.bestByDepth)}))}));
}
