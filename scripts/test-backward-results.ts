import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE,type ColorPoint} from '../app/play-engine';
import {type PaintColor} from '../app/paint-mixing';
import {replayRoute} from '../app/play-course-analysis';
type Evidence={order:number[];times:number[];error:number};
type Assessment={trial?:{paints:PaintColor[]};target:ColorPoint;bases:{routes:{witness:Evidence}[];rawWitnesses?:Evidence[]}[]};
function check(pa:PaintColor[],a:Assessment){
 const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'archive-check',subtitle:'test',paints:pa,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
 try{for(const b of a.bases)for(const r of [...b.routes.map(r=>r.witness),...(b.rawWitnesses??[])]){
  const error=colorDistance(mixtureColor(pa,replayRoute(slot,r.order,r.times)),a.target);
  assert.ok(error<=LIVE_LANDING_TOLERANCE+1e-10);assert.ok(Math.abs(error-r.error)<1e-8);
 }}finally{PLAY_LEVELS.splice(slot,1);}
}
test('all backward-study artifacts match sources and preserve original fixed targets',()=>{
 const signature=JSON.stringify(PLAY_LEVELS);
 for(const file of ['docs/play-backward-palette-results.json','docs/play-backward-finalists.json','docs/play-backward-palette-refinement.json']){
  const r=JSON.parse(readFileSync(file,'utf8')) as {sourceFiles:string[];sourceHash:string;trials?:{trial:{paints:PaintColor[]};holes:Assessment[]}[];verified?:Assessment[];neighbors?:{assessment:Assessment|null}[];results?:{trial:{paints:PaintColor[]};holes:{assessment:Assessment|null}[]}[]};
  assert.equal(createHash('sha256').update(r.sourceFiles.map(p=>readFileSync(p)).join('\n')).digest('hex'),r.sourceHash,file);
  for(const t of r.trials??[])for(const h of t.holes)check(t.trial.paints,h);
  for(const h of r.verified??[])check(h.trial!.paints,h);
  for(const n of r.neighbors??[])if(n.assessment)check(n.assessment.trial!.paints,n.assessment);
  for(const t of r.results??[])for(const h of t.holes)if(h.assessment)check(t.trial.paints,h.assessment);
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);
});
test('single-hole wins and failed neighbors remain in the archive',()=>{
 const initial=JSON.parse(readFileSync('docs/play-backward-palette-results.json','utf8'));
 const deeper=JSON.parse(readFileSync('docs/play-backward-finalists.json','utf8'));
 assert.equal(initial.trials.length,18);assert.equal(deeper.verified.length,6);assert.equal(deeper.neighbors.length,6);
 assert.ok(deeper.neighbors.some((n:{assessment:unknown})=>n.assessment===null));
 assert.equal(deeper.parentSourceHash,initial.sourceHash);
});
