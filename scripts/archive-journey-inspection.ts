// Keep replayable finalist evidence in the repository and the complete numerical
// trace in an ignored local archive. This does not change search or classification.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import type {JourneyAudit} from '../app/play-journey-analysis';
import {experienceSupported} from '../app/play-experience-audit';

const path='docs/play-journey-inspection.json',raw=readFileSync(path);
const result=JSON.parse(raw.toString());
if(result.rawEvidence)throw new Error('Inspection already archived; use the original raw archive to repeat.');
mkdirSync('outputs',{recursive:true});
const archive=`outputs/play-journey-inspection-${result.sourceHash.slice(0,12)}.json.gz`;
writeFileSync(archive,gzipSync(raw));
function compact(a:JourneyAudit){
 return {...a,bases:a.bases.map(({routes,...base})=>({...base,
  retained:routes.length,supported:routes.filter(experienceSupported).length,
  efficientSupported:routes.filter(r=>r.efficient&&experienceSupported(r)).length,
  unsupportedSuccesses:routes.filter(r=>!experienceSupported(r)).length,
  shortestRaw:routes.length?Math.min(...routes.map(r=>r.length)):null,
  routeStyles:Object.fromEntries(['interior','ride','value-shift','balance'].map(s=>[s,
   routes.filter(r=>r.efficient&&experienceSupported(r)&&r.traits[s as keyof typeof r.traits]).length]))}))};
}
for(const key of ['training','holdouts'])result[key]=result[key].map((row:{items:{audit:JourneyAudit}[]})=>({...row,
 items:row.items.map(c=>({...c,audit:compact(c.audit)}))}));
result.rawEvidence={path:archive,sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length,
 note:'Complete training/fresh/finalist route traces are preserved locally here. Repository JSON retains all candidate recipes, decisions, base diagnostics, and full dense/deeper witnesses.'};
writeFileSync(path,JSON.stringify(result)+'\n');
console.log(JSON.stringify({archive,rawBytes:raw.length,repositoryBytes:readFileSync(path).length}));
