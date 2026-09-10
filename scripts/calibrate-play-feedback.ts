// Private, offline calibration. Inputs/outputs are supplied explicitly; never
// copy raw player notes or event IDs into the public site or generated bank.
import {readFileSync,writeFileSync} from 'node:fs';
import {labEntries,validLabEvent} from '../app/play-lab-model';
import {PLAY_LEVELS} from '../app/play-engine';
import {analyzeCandidate,auditFreeStarts,makeAtlas,qualityFailures} from '../app/play-course-analysis';
import previous from '../app/generated/play-courses-v2.json';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Provide a lab export and an output JSON path outside the public project.');
const data=JSON.parse(readFileSync(input,'utf8'));
if(!Array.isArray(data.events)||!data.events.every(validLabEvent))throw new Error('Invalid or incompatible lab export');
const entries=labEntries(data.events).filter(e=>e.review?.verdict);
const ids=[...new Set(entries.map(e=>e.attempt.specimen.hole.courseId))];
const atlases=new Map<number,ReturnType<typeof makeAtlas>>();
const holes=[];
for(const id of ids){
  const reviews=entries.filter(e=>e.attempt.specimen.hole.courseId===id),sample=reviews[0].attempt.specimen;
  const p=sample.levelIndex,record=previous.palettes[p].rounds.flat().find(h=>h.id===id);
  if(!record)throw new Error(`No exact archived target for ${id}`);
  // A saved solution recipe can land off-center. Use the original target
  // recipe, NOT the witness recipe, to reproduce the exact reviewed target.
  if(!atlases.has(p))atlases.set(p,makeAtlas(p));
  const analyzed=analyzeCandidate(p,Number(id.split('-').at(-1)),atlases.get(p)!,record.target);
  const starts=auditFreeStarts(p,record.target);
  const shots=Math.min(...starts.map(s=>s.additionsFound??Infinity));
  const efficient=starts.filter(s=>s.additionsFound===shots),lengths=efficient.map(s=>s.shortestTravelFound!);
  const verdicts=[...new Set(reviews.map(e=>e.review!.verdict))];
  const result={id,palette:PLAY_LEVELS[p].name,notation:sample.hole.notation,
    verdict:verdicts.length===1?verdicts[0]:'mixed',reviewCount:reviews.length,
    issues:[...new Set(reviews.map(e=>e.review!.issue).filter(Boolean))],
    originalKind:record.kind,originalTags:record.tags,currentTags:analyzed?.tags??[],
    failures:analyzed?qualityFailures(analyzed.competition):['existing-eligibility-test'],
    fewestAdditions:shots,efficientCoverage:efficient.length/starts.length,
    minTravel:Math.min(...lengths),travelBalance:Math.min(...lengths)/Math.max(...lengths),
    minArcRatio:Math.min(...efficient.map(s=>s.shortestArcRatio!)),
    starts};
  holes.push(result);console.log(JSON.stringify({...result,starts:undefined}));
}
writeFileSync(output,JSON.stringify({source:'Local user export; feedback grouped by exact target, not attempts',reviewCount:entries.length,uniqueReviewedHoles:holes.length,holes},null,2)+'\n');
