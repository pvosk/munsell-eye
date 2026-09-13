import {test} from 'node:test';import assert from 'node:assert/strict';
import {readBankJson} from './research-bank-io';
import {measureLegRegion,legGeometry} from './pigment-leg-metrics';
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay,type PigmentLeg} from '../app/play-pigment-legs';
import type {PaintColor} from '../app/paint-mixing';
test('every refined branch replays and retains recomputed region support',()=>{
 const rows=readBankJson('docs/branching-region-refinement-1/results.json');assert.equal(rows.length,12);
 for(const row of rows){const p=row.audit.p;assert.equal(row.refined.routes.length,2);
  for(const legs of row.refined.routes as PigmentLeg[][]){
   assert.ok(colorDistance(mixtureColor(p.paints,p.start),p.target)>T);
   assert.ok(colorDistance(mixtureColor(p.paints,legReplay(p.start,legs)),p.target)<=T);
   const metric=measureLegRegion(p.paints as PaintColor[],p.start,p.target,legs);assert.ok(metric.supported);assert.ok(metric.allMeaningful);
   // Resolution checks report classifier drift instead of hiding it behind
   // branch count. No style is required for these candidate branches.
   const fine=legGeometry(p.paints,p.start,p.target,legs,192);assert.ok(fine.error<=T);
  }
  assert.equal(row.audit.p.target.lab.length,3);assert.ok(row.audit.bestByDepth[row.after.rawMinimum-2]>1);
 }
});
