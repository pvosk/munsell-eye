// Offline only; private notes and IDs never become client assets.
import {readFileSync,writeFileSync} from 'node:fs';
import {labEntries,validLabEvent} from '../app/play-lab-model';
import {PLAY_LEVELS} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeRoutes,type RouteStyle} from '../app/play-route-analysis';
import old from '../app/generated/play-courses-v2.json';
import round2 from '../app/generated/play-lab-round2.json';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Supply export and private report path');
const d=JSON.parse(readFileSync(input,'utf8'));
if(!d.events.every(validLabEvent))throw new Error('Invalid feedback export');
const entries=labEntries(d.events).filter(e=>e.review?.verdict),atlases=new Map<number,ReturnType<typeof makeAtlas>>(),rows=[];
for(const id of new Set(entries.map(e=>e.attempt.specimen.hole.courseId))){
  const es=entries.filter(e=>e.attempt.specimen.hole.courseId===id),s=es[0].attempt.specimen,p=s.levelIndex;
  const record=id.startsWith('lab-2-')?round2.palettes.find(x=>x.levelIndex===p)?.holes.find(h=>h.id===id):old.palettes[p]?.rounds.flat().find(h=>h.id===id);
  if(!record)continue;
  if(!atlases.has(p))atlases.set(p,makeAtlas(p,128,24));
  const style:RouteStyle=record.kind==='chromatic-ride'?'chromatic-ride':record.kind==='value-finish'?'setup-lift':record.kind==='precision'?'precision-approach':'interior-weave';
  const analysis=analyzeRoutes(p,record.target,style,atlases.get(p));
  const row={palette:PLAY_LEVELS[p].name,id,notation:s.hole.notation,verdicts:[...new Set(es.map(e=>e.review!.verdict))],style,failures:analysis.failures,robustThree:analysis.robustThree,coverage:analysis.qualifyingBases.length,starts:analysis.bases.map(b=>({base:b.base,shots:b.fewestFound,travel:b.minimumTravel,regions:b.routes.map(r=>r.setup?.coverage),finishMs:b.routes.map(r=>r.finishWindowMs)}))};
  rows.push(row);console.log(JSON.stringify({...row,starts:undefined}));
}
writeFileSync(output,JSON.stringify({note:'Same feedback used to guide these rules; not held-out validation. Old simple-lift positives are not setup-lift negatives.',rows},null,2));
