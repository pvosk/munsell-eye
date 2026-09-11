import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeAudit,AUDIT_STYLES,type AuditStyle,type AuditedHole} from '../app/play-route-audit';
import type {PaletteTrial} from './discover-play-palettes';

type Evaluation={trial:PaletteTrial;targets:{recipe:number[];eligible:AuditStyle[]}[]};
const discovery=JSON.parse(readFileSync('docs/play-route-audit-discovery.json','utf8')) as {sourceHash:string;holdout:Evaluation[]};
const results=[];let checked=0,changed=0;
for(const e of discovery.holdout){
  const accepted=e.targets.filter(t=>t.eligible.length);if(!accepted.length)continue;
  const p=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:e.trial.id,subtitle:'Dense verification',paints:e.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  try{
    const atlas=makeAtlas(p,256,48),targets:{recipe:number[];original:AuditStyle[];confirmed:AuditStyle[];audit:AuditedHole}[]=[];
    for(const t of accepted){
      const audit=analyzeAudit(p,t.recipe,atlas),confirmed=t.eligible.filter(s=>audit.styles[s].eligible);
      checked++;if(confirmed.length!==t.eligible.length)changed++;
      targets.push({recipe:t.recipe,original:t.eligible,confirmed,audit});
    }
    const counts=Object.fromEntries(AUDIT_STYLES.map(s=>[s,targets.filter(t=>t.confirmed.includes(s)).length]));
    console.log(`${e.trial.id}: ${targets.length} targets rechecked, confirmed ${JSON.stringify(counts)}`);
    results.push({trial:e.trial,counts,targets});
  }finally{PLAY_LEVELS.splice(p,1);}
}
writeFileSync('docs/play-route-audit-dense.json',JSON.stringify({sourceHash:discovery.sourceHash,checked,changed,results},null,2));
console.log(`Dense verification: ${checked} initially accepted targets; ${changed} lost at least one style. This is a resolution check, not an independent target cohort.`);
