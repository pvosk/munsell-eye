import {readFileSync,writeFileSync} from 'node:fs';
import {AUDIT_STYLES,type AuditedHole,type AuditStyle} from '../app/play-route-audit';
import {assessStartBias} from '../app/play-route-starts';
import type {PaletteTrial} from './discover-play-palettes';
const dense=JSON.parse(readFileSync('docs/play-route-audit-dense.json','utf8')) as {sourceHash:string;results:{trial:PaletteTrial;targets:{recipe:number[];confirmed:AuditStyle[];audit:AuditedHole}[]}[]};
const results=dense.results.map(e=>{
  const targets=e.targets.map(t=>({recipe:t.recipe,confirmed:t.confirmed,starts:assessStartBias(e.trial.paints,t.audit)}));
  const counts=Object.fromEntries(AUDIT_STYLES.map(s=>[s,{
    majority:targets.filter(t=>t.confirmed.includes(s)).length,
    closestSafe:targets.filter(t=>t.confirmed.includes(s)&&t.starts.styles[s].freeStartEligible).length}]));
  console.log(e.trial.id,JSON.stringify(counts));return {trial:e.trial,counts,targets};
});
writeFileSync('docs/play-route-audit-starts.json',JSON.stringify({sourceHash:dense.sourceHash,policy:'starts-1-closest-paint',
  note:'Post-hoc diagnostic motivated by the stated closest-start behavior, not a new independent validation cohort. No claim of predicting actual human starting choices. Course selection should require closest-safe when the brief demands the intended style survive that behavior.',results},null,2));
