import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {outsideChromaFraction,stableRide} from './stable-route-measurement';
import {analyzeJourney} from '../app/play-journey-analysis';
import {makeAtlas} from '../app/play-course-analysis';
import {compareSelection} from './supported-selection';
test('chromatic segment integration resolves crossings in either direction',()=>{
 assert.ok(Math.abs(outsideChromaFraction([0,0],[.12,0])-.5)<1e-12);
 assert.ok(Math.abs(outsideChromaFraction([-.12,0],[.12,0])-.5)<1e-12);
 assert.equal(outsideChromaFraction([0,0],[.02,0]),0);
 assert.equal(outsideChromaFraction([.1,.1],[.1,.1]),1);
 assert.equal(outsideChromaFraction([0,0],[0,0]),0);
});
test('known 64-sample false negative converges to ride without changing controls',()=>{
 const report=JSON.parse(readFileSync('docs/play-ride-resolution-results.json','utf8')) as {results:{id:string;palette:number;order:number[];variants:{side:string;times:number[]}[]}[]};
 const r=report.results.find(r=>r.id==='ip-30-1109262-1')!,v=r.variants.find(v=>v.side==='no')!;
 for(const samples of [32,64,128]){const measured=stableRide(r.palette,{order:r.order,times:v.times},samples);assert.equal(measured.ride,true);assert.equal(measured.converged,true);}
});
test('stable measurement does not erase genuine below-length-cutoff variants',()=>{
 const report=JSON.parse(readFileSync('docs/play-ride-resolution-results.json','utf8')) as {results:{id:string;palette:number;order:number[];variants:{side:string;times:number[]}[]}[]};
 const r=report.results.find(r=>r.id==='ip-30-1109261-0'&&r.order.length===2)!;
 for(const v of r.variants)assert.equal(stableRide(r.palette,{order:r.order,times:v.times}).ride,v.side==='yes');
});
test('supported minimum does not discard the raw expert shortcut',()=>{
 const report=JSON.parse(readFileSync('docs/play-blind-validation-results.json','utf8')) as {rows:{id:string;palette:number;recipe:number[]}[]};
 const r=report.rows.find(r=>r.id==='ip-5-1109261-1')!;
 const a=analyzeJourney(r.palette,r.recipe,makeAtlas(r.palette,256,48),1209261),before=JSON.stringify(a),comparison=compareSelection(a);
 assert.equal(comparison.bases[1].rawFewest,2);assert.equal(comparison.bases[1].supportedFewest,3);assert.equal(comparison.bases[1].expertShorter,true);
 assert.equal(JSON.stringify(a),before,'Experimental view must not mutate original audit');
});
