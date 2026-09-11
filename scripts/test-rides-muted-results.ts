import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import type {PaintColor} from '../app/paint-mixing';
import type {JourneyAudit} from '../app/play-journey-analysis';
type Candidate={id:string;recipe:number[];audit:JourneyAudit};
const data=JSON.parse(readFileSync('docs/play-rides-muted-results.json','utf8')) as {evaluations:number;rows:{palette:{paints:PaintColor[]};items:{id:string;failures:string[];styles:JourneyAudit['styles'];recipe:number[];proposal:{order:number[];times:number[]}|null}[];finalists:Candidate[]}[]};
test('frozen run covers all 15 palettes, both seeds and four proposal methods without dropping failed stronger checks',()=>{
 assert.equal(data.rows.length,15);assert.equal(data.evaluations,390);
 for(const r of data.rows){assert.equal(r.items.length,24);assert.equal(r.finalists.length,2);
  for(const c of r.finalists){assert.ok(c.audit.threeExplored);const row=r.items.find(i=>i.id===c.id)!;assert.deepEqual(row.styles,c.audit.styles);assert.deepEqual(row.failures,c.audit.failures);}
 }
});
test('every proposal and retained dense route replays under the frozen paint definitions and tolerance',()=>{
 const scratch=PLAY_LEVELS.length;let routes=0;
 PLAY_LEVELS.push({name:'Test only',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE});
 try{for(const row of data.rows){PLAY_LEVELS[scratch].paints=row.palette.paints;
  for(const c of row.items)if(c.proposal)assert.ok(colorDistance(mixtureColor(row.palette.paints,c.recipe),mixtureColor(row.palette.paints,replayRoute(scratch,c.proposal.order,c.proposal.times)))<1e-8);
  for(const c of row.finalists){const target=mixtureColor(row.palette.paints,c.recipe);assert.ok(colorDistance(target,c.audit.target)<1e-10);
   for(const b of c.audit.bases)for(const r of b.routes){assert.ok(colorDistance(mixtureColor(row.palette.paints,replayRoute(scratch,r.order,r.times)),target)<=LIVE_LANDING_TOLERANCE+1e-8);routes++;}
  }
 }}finally{PLAY_LEVELS.pop();}console.log('Dense archived routes replayed:',routes);
});
