// Re-evaluate the existing candidate pool without replacing any live courses.
import {readFileSync,writeFileSync} from 'node:fs';
import {analyzeCandidate,makeAtlas,qualityFailures,type CourseRecord} from '../app/play-course-analysis';
const output=process.argv[2];if(!output)throw new Error('Provide an output JSON path');
const pool=JSON.parse(readFileSync('docs/play-candidate-audit.json','utf8')) as {palettes:{palette:number;name:string;candidates:CourseRecord[]}[]};
const palettes=[];
for(const p of pool.palettes){
  const atlas=makeAtlas(p.palette),results=p.candidates.map(old=>{
    const current=analyzeCandidate(p.palette,Number(old.id.split('-').at(-1)),atlas,old.target);
    return {id:old.id,tags:old.proposedTags,previousEligible:old.tags.length>0,
      eligible:!!current?.tags.length,failures:current?qualityFailures(current.competition):['existing-eligibility-test']};
  });
  const tags=[...new Set(p.candidates.flatMap(c=>c.proposedTags))];
  const rows=tags.map(kind=>{const r=results.filter(x=>x.tags.includes(kind));return {kind,candidates:r.length,previousEligible:r.filter(x=>x.previousEligible).length,qualityEligible:r.filter(x=>x.eligible).length};});
  const summary={palette:p.name,candidates:results.length,previousEligible:results.filter(r=>r.previousEligible).length,qualityEligible:results.filter(r=>r.eligible).length,rows,results};
  palettes.push(summary);console.log(JSON.stringify({...summary,results:undefined,rows:undefined}));
}
writeFileSync(output,JSON.stringify({scope:'Same 960 unreviewed candidates; structural coverage test, not held-out player validation. Live bank unchanged.',palettes},null,2)+'\n');
