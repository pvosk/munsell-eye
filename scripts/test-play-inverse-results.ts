import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import archived from '../docs/play-inverse-planning-results.json';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
type Finding={bases:number[];witnesses:{order:number[];times:number[]}[]};
const results=archived as unknown as {sourceHash:string;rows:{id:string;palette:number;recipe:number[];target:ReturnType<typeof mixtureColor>;methods:Record<'exact-recipe'|'inverse-region',{findings:Record<'ride'|'value-shift',Finding>}>;audit:null|{bases:{base:number;fewest:number|null}[]}}[]};

test('archived inverse pilot matches its engine source fingerprint',()=>{
 const files=['app/play-engine.ts','app/paint-mixing.ts','app/play-inverse-planning.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts','scripts/inspect-inverse-planning.ts'];
 assert.equal(createHash('sha256').update(files.map(p=>readFileSync(p)).join('\n')).digest('hex'),results.sourceHash,'Rerun or explicitly archive the pilot after engine changes');
});
test('all recorded witnesses still land on their original target',()=>{
 for(const row of results.rows){
  const target=mixtureColor(PLAY_LEVELS[row.palette].paints,row.recipe);
  assert.ok(colorDistance(target,row.target)<1e-12);
  for(const method of Object.values(row.methods))for(const finding of Object.values(method.findings))for(const w of finding.witnesses){
   const q=replayRoute(row.palette,w.order,w.times);
   assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[row.palette].paints,q),target)<=LIVE_LANDING_TOLERANCE+1e-12,row.id);
  }
 }
});
test('augmentation retains known bases and audits do not miss known shorter witnesses',()=>{
 for(const row of results.rows)for(const style of ['ride','value-shift'] as const){
  const inverse=row.methods['inverse-region'].findings[style];
  for(const base of row.methods['exact-recipe'].findings[style].bases)assert.ok(inverse.bases.includes(base));
  if(row.audit)for(const w of inverse.witnesses){
   const audited=row.audit.bases.find(b=>b.base===w.order[0]);
   assert.ok(audited&&audited.fewest!==null&&audited.fewest<=w.times.length,row.id);
  }
 }
});
