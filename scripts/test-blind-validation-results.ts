import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mixtureColor,PLAY_LEVELS,colorDistance,LIVE_LANDING_TOLERANCE,type ColorPoint} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
type Witness={order:number[];times:number[];error:number};
const report=JSON.parse(readFileSync('docs/play-blind-validation-results.json','utf8')) as {sourceFiles:string[];sourceHash:string;rows:{palette:number;recipe:number[];target:ColorPoint;comparisons:{auditExamples:Witness[];supportedBlindOrders:Witness[];auditedFewest:number|null;blindFewest:number|null}[]}[]};
test('validation archive is current and all retained evidence replays',()=>{
 assert.equal(createHash('sha256').update(report.sourceFiles.map(f=>readFileSync(f)).join('\n')).digest('hex'),report.sourceHash);
 for(const row of report.rows){
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[row.palette].paints,row.recipe),row.target)<1e-12);
  for(const c of row.comparisons)for(const w of [...c.auditExamples,...c.supportedBlindOrders]){
   const error=colorDistance(mixtureColor(PLAY_LEVELS[row.palette].paints,replayRoute(row.palette,w.order,w.times)),row.target);
   assert.ok(error<=LIVE_LANDING_TOLERANCE+1e-12);assert.ok(Math.abs(error-w.error)<1e-10);
  }
 }
});
test('known solver disagreements remain visible rather than being certified',()=>{
 assert.equal(report.rows.flatMap(r=>r.comparisons).filter(c=>c.auditedFewest!==c.blindFewest).length,2);
});
test('resolution counterexample is archived without silently retuning the classifier',()=>{
 const study=JSON.parse(readFileSync('docs/play-ride-resolution-results.json','utf8')) as {sourceStudyHash:string;results:{id:string;variants:{side:string;resolutions:{samples:number;ride:boolean}[]}[]}[]};
 assert.equal(study.sourceStudyHash,report.sourceHash);
 const variant=study.results.find(r=>r.id==='ip-30-1109262-1')!.variants.find(v=>v.side==='no')!;
 assert.equal(variant.resolutions.find(r=>r.samples===64)!.ride,false);
 assert.equal(variant.resolutions.find(r=>r.samples===2048)!.ride,true);
});
