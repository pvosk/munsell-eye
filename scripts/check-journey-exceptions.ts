// Supplementary, post-hoc single-hole retention. This is NOT a fresh-target test
// and does not change the frozen eight-palette cohort or its reported yield.
import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,LANDING_TOLERANCE} from '../app/play-engine';
import type {PaintColor} from '../app/paint-mixing';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeJourney,type JourneyAudit} from '../app/play-journey-analysis';

type Candidate={id:string;recipe:number[];audit:JourneyAudit};
type Row={palette:{id:string;name:string;paints:PaintColor[];control:number|null};items:Candidate[]};
const source=JSON.parse(readFileSync('docs/play-journey-inspection.json','utf8')) as {sourceHash:string;holdoutRoster:string[];training:Row[]};
const selected=source.training.filter(r=>!source.holdoutRoster.includes(r.palette.id)).flatMap(row=>{
 const item=row.items.filter(c=>Object.values(c.audit.styles).some(s=>s.allResistant))
  .sort((a,b)=>b.audit.minTravel-a.audit.minTravel||a.id.localeCompare(b.id))[0];
 return item?[{palette:row.palette,item}]:[];
});
const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Single-hole exception check',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
const started=performance.now();
const checked=selected.map(({palette,item})=>{
 PLAY_LEVELS[scratch].paints=palette.paints;
 const audit=analyzeJourney(scratch,item.recipe,makeAtlas(scratch,512,96),20261119);
 console.log('EXCEPTION',palette.id,item.id,JSON.stringify(audit.styles),audit.failures);
 return {palette,id:item.id,recipe:item.recipe,previousStyles:item.audit.styles,audit};
});
PLAY_LEVELS.pop();
writeFileSync('docs/play-journey-exceptions.json',JSON.stringify({sourceHash:source.sourceHash,
 selection:'Post-hoc: one highest-minimum-travel training candidate per palette outside the frozen holdout cohort, provided it had any every-base-resistant style. Exact ties broken by ID. No new targets, no threshold changes.',
 interpretation:'Candidate-specific stronger checks; no independent evidence of palette repeatability or enjoyment. Final outcomes supersede their weaker training classifications.',
 seconds:(performance.now()-started)/1000,checked},null,2)+'\n');
