import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {makeAtlas,replayRoute} from '../app/play-course-analysis';
import {searchCompetingRoutes} from '../app/play-route-analysis';
import type {AuditedHole} from '../app/play-route-audit';
const probe=JSON.parse(readFileSync('docs/play-interior-proposal-probe.json','utf8')) as {sourceHash:string;results:{palette:number;name:string;checked:{id:string;recipe:number[];audit:AuditedHole;metrics:{profileThree:boolean;allTravelFloor:number}}[]}[]};
const rows=[];
for(const e of probe.results){
  const chosen=e.checked.filter(c=>c.metrics.profileThree).sort((a,b)=>b.metrics.allTravelFloor-a.metrics.allTravelFloor).slice(0,e.palette===5?2:1);
  if(!chosen.length)continue;
  const atlas=makeAtlas(e.palette,512,96);
  for(const c of chosen){
    const found=searchCompetingRoutes(e.palette,c.recipe,atlas,LIVE_LANDING_TOLERANCE);
    const minimumTwoError=Math.min(...found.errors.map(e=>Math.min(e.one,e.two)));
    const shortcut=found.routes.some(r=>r.times.length<3);
    const replayErrors=c.audit.bases.map(b=>Math.min(...b.routes.filter(r=>r.times.length===3).map(r=>colorDistance(mixtureColor(PLAY_LEVELS[e.palette].paints,replayRoute(e.palette,r.order,r.times)),found.target)/LIVE_LANDING_TOLERANCE)));
    rows.push({id:c.id,palette:e.name,recipe:c.recipe,minimumTwoError,shortcut,replayErrors,passes:!shortcut&&minimumTwoError>1.1&&replayErrors.every(e=>e<=1)});
    console.log(e.name,c.id,'shortcut',shortcut,'margin',minimumTwoError.toFixed(3),'replays',replayErrors.every(e=>e<=1));
  }
}
writeFileSync('docs/play-selection-verified.json',JSON.stringify({sourceHash:probe.sourceHash,oneSteps:512,twoSteps:96,rows,note:'Higher-resolution shortcut check on representatives selected by worst-base travel. Sampled numerical evidence, not a global proof or a player-quality verdict.'},null,2)+'\n');
if(rows.some(r=>!r.passes))process.exitCode=1;
