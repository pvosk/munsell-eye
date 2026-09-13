import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,colorPoint,type RGB} from '../app/play-engine';
import {releasesToLegs} from '../app/play-pigment-legs';
import {auditLegPuzzle,type LegPuzzle} from './pigment-leg-audit';
const output=process.env.LEG_AUDIT_OUTPUT??'docs/pigment-leg-audit-1';if(existsSync(output))throw Error('Archive already exists');mkdirSync(output,{recursive:true});
const historical=JSON.parse(readFileSync('app/generated/play-premix-regions.json','utf8'));
const inputs:LegPuzzle[]=historical.holes.map((h:any)=>({id:h.id,paints:PLAY_LEVELS[h.level].paints,start:h.initial,target:colorPoint(h.targetRGB as RGB),demonstration:releasesToLegs(h.initial,h.modes.normalized.order,h.modes.normalized.times),provenance:{source:'played-region-bank',oldStyle:h.style}}));
const comparisons=JSON.parse(readFileSync('docs/premix-ablation-1/comparisons.json','utf8'));
// Audit all 645 conditions, caching identical endpoints but measuring different
// demonstrations separately. Deduplicate exact full cases; preserve memberships.
const memberships=new Map<string,string[]>();
for(const r of comparisons){const p={id:r.id+'/'+r.mode,paints:r.p.paints,start:r.p.start,target:r.target,demonstration:releasesToLegs(r.p.start,r.p.control.order,r.p.control.times),provenance:{source:'ablation-bank',mode:r.mode,oldPass:r.verdict.pass,oldRawMinimum:r.rawMinimum}};
 const key=JSON.stringify([p.paints,p.start,p.target.rgb,p.demonstration]);if(memberships.has(key)){memberships.get(key)!.push(p.id);continue;}memberships.set(key,[p.id]);inputs.push(p);}
writeFileSync(output+'/manifest.json',JSON.stringify({inputs,memberships:[...memberships.values()],policy:'No old specimen or game policy overwritten. Historical human judgements are calibration, not new labels.'}));
const rows=[];const startTime=Date.now();let evaluations=0;
for(const [i,p] of inputs.entries()){
 const row=auditLegPuzzle(p,913271+i,{samples:128,restarts:8,maxMeasured:36,fresh:true});rows.push(row);evaluations+=row.evaluations;
 writeFileSync(output+'/audits.json',JSON.stringify(rows));
 if(i%12===0)console.log(JSON.stringify({phase:'leg-reaudit',done:i+1,total:inputs.length,seconds:(Date.now()-startTime)/1000,evaluations,id:p.id,min:row.summary.rawMinimum}));
}
const summary={cases:rows.length,evaluations,seconds:(Date.now()-startTime)/1000,rawMinima:rows.reduce((a:Record<string,number>,r)=>{const k=String(r.summary.rawMinimum);a[k]=(a[k]??0)+1;return a;},{}),collapsed:rows.filter(r=>r.profile.rawShortcutToDemonstration).map(r=>({id:r.p.id,from:r.demonstrationLegs,to:r.summary.rawMinimum})),historical:rows.slice(0,historical.holes.length).map(r=>({id:r.p.id,min:r.summary.rawMinimum,robust:r.summary.robustMinimum,profile:r.profile,styles:r.summary.styles})),sourceHash:createHash('sha256').update(['app/play-pigment-legs.ts','scripts/pigment-leg-search.ts','scripts/pigment-leg-metrics.ts','scripts/pigment-leg-audit.ts','scripts/audit-pigment-leg-bank.ts'].map(p=>p+readFileSync(p,'utf8')).join('\n')).digest('hex')};
writeFileSync(output+'/summary.json',JSON.stringify(summary));console.log(JSON.stringify({phase:'complete',cases:rows.length,rawMinima:summary.rawMinima,seconds:summary.seconds}));
