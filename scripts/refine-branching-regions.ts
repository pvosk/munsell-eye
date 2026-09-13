import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
import {branchEvidence,refineBranches} from './branching-regions';
import {auditLegPuzzle} from './pigment-leg-audit';
import {measureLegRegion} from './pigment-leg-metrics';
const source=process.env.BRANCH_SOURCE??'docs/branching-region-search-2',out=process.env.BRANCH_REFINE_OUTPUT??'docs/branching-region-refinement-1';
if(existsSync(out))throw Error('Archive exists');mkdirSync(out,{recursive:true});
const audits=readBankJson(source+'/audits.json') as (ReturnType<typeof auditLegPuzzle>&{branch:ReturnType<typeof branchEvidence>})[];
const selected=audits.filter(a=>a.branch.pairs.length&&!a.branch.shorterRawEscape).sort((a,b)=>(b.branch.rawMinimum??0)-(a.branch.rawMinimum??0)||b.branch.maxSeparationT-a.branch.maxSeparationT).slice(0,12);
const results=[];
for(const [i,a] of selected.entries()){
 const pair=[...a.branch.pairs].sort((a,b)=>b.separationT-a.separationT)[0],refined=refineBranches(a.p.paints,a.p.start,a.p.target,pair.routes,901931+i*83);
 const p={...a.p,id:a.p.id+'/branch-refined',start:refined.start,demonstration:refined.routes[0]},audit=auditLegPuzzle(p,921913+i*71,{samples:256,restarts:12,maxMeasured:96,maxLegs:3,fresh:true});
 // Preserve both refined witnesses even if the blind solver finds other routes.
 const witnesses=refined.routes.map(r=>measureLegRegion(p.paints,p.start,p.target,r));
 const {search,fresh,...compact}=audit;results.push({parent:a.p.id,before:a.branch,refined,witnesses,audit:compact,after:branchEvidence(audit)});
 writeFileSync(out+'/results.json',JSON.stringify(results));console.log(JSON.stringify({done:i+1,total:selected.length,acceptedSteps:refined.history.filter(h=>h.accepted).length,before:a.branch.rawMinimum,after:audit.summary.rawMinimum}));
}
writeFileSync(out+'/summary.json',JSON.stringify({source,cases:results.length,acceptedRefinements:results.filter(r=>r.refined.history.some(h=>h.accepted)).length,threeLegAfter:results.filter(r=>r.after.rawMinimum===3).length,policy:'Shared start plus two branch controls refined; target/pigments fixed. Dense independent endpoint/order validation after refinement. Region support and branch counts are not required journey/style claims.'},null,2));
