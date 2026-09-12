import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE,type ColorPoint} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import {stableRide} from './stable-route-measurement';
type Witness={order:number[];times:number[];error:number;traits:{ride:boolean}};
type Evidence={witness:Witness;stable:{ride:boolean|null}};
const data=JSON.parse(readFileSync('docs/play-selection-holdout-results.json','utf8')) as {sourceFiles:string[];sourceHash:string;rows:{id:string;palette:number;recipe:number[];target:ColorPoint;bases:{rawFewest:number|null;supportedFewest:number|null;expertShorter:boolean;routes:Evidence[]}[]}[];validations:{id:string;bases:{witnesses:Evidence[]}[]}[]};
test('holdout archive matches measured sources and preserves replayable witnesses',()=>{
 assert.equal(createHash('sha256').update(data.sourceFiles.map(f=>readFileSync(f)).join('\n')).digest('hex'),data.sourceHash);
 const verify=(row:typeof data.rows[number],e:Evidence)=>{
  const error=colorDistance(mixtureColor(PLAY_LEVELS[row.palette].paints,replayRoute(row.palette,e.witness.order,e.witness.times)),row.target);
  assert.ok(error<=LIVE_LANDING_TOLERANCE+1e-12);assert.ok(Math.abs(error-e.witness.error)<1e-10);
 };
 for(const row of data.rows){assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[row.palette].paints,row.recipe),row.target)<1e-12);for(const b of row.bases)for(const e of b.routes)verify(row,e);}
 for(const v of data.validations){const row=data.rows.find(r=>r.id===v.id)!;for(const b of v.bases)for(const e of b.witnesses)verify(row,e);}
});
test('every changed ride label agrees with a higher-resolution restart',()=>{
 let checked=0;
 for(const row of data.rows)for(const b of row.bases)for(const e of b.routes)if(e.stable.ride!==null&&e.stable.ride!==e.witness.traits.ride){
  assert.equal(stableRide(row.palette,e.witness,512).ride,e.stable.ride);checked++;
 }
 assert.ok(checked>0);
});
test('supported minima and expert warnings remain separate and internally consistent',()=>{
 for(const row of data.rows)for(const b of row.bases){
  assert.equal(b.supportedFewest,b.routes.length?Math.min(...b.routes.map(r=>r.witness.times.length)):null);
  assert.equal(b.expertShorter,b.rawFewest!==null&&b.supportedFewest!==null&&b.rawFewest<b.supportedFewest);
 }
});
