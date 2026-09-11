import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
import type {PaintColor} from '../app/paint-mixing';
import type {JourneyAudit} from '../app/play-journey-analysis';

type Item={id:string;audit:JourneyAudit};
type Row={palette:{id:string;paints:PaintColor[]};items:Item[]};
const path='docs/play-journey-inspection.json';
const results=existsSync(path)?JSON.parse(readFileSync(path,'utf8')) as {dense:Row[];deeper:{palette:Row['palette'];item:Item}[];singleHoles:{palette:string;id:string}[]}:null;

test('inspection finalists replay against saved paints and preserve live palettes',{skip:!results},()=>{
 const signature=JSON.stringify(PLAY_LEVELS),scratch=PLAY_LEVELS.length;
 PLAY_LEVELS.push({name:'Replay inspection only',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
 let witnesses=0;
 try{
  const exceptions=JSON.parse(readFileSync('docs/play-journey-exceptions.json','utf8')) as {checked:{palette:Row['palette'];id:string;audit:JourneyAudit}[]};
  const directed=JSON.parse(readFileSync('docs/play-journey-targeted-holdout.json','utf8')) as {checked:Row[]};
  const rows=[...results!.dense,...directed.checked,...exceptions.checked.map(c=>({palette:c.palette,items:[{id:c.id,audit:c.audit}]}))];
  for(const row of rows){
   PLAY_LEVELS[scratch].paints=row.palette.paints;
   for(const {audit} of row.items){
    assert.ok(colorDistance(mixtureColor(row.palette.paints,audit.recipe),audit.target)<1e-10);
    for(const base of audit.bases)for(const route of base.routes){
     assert.equal(route.order[0],base.base);
     const q=replayRoute(scratch,route.order,route.times),error=colorDistance(mixtureColor(row.palette.paints,q),audit.target);
     assert.ok(error<=LIVE_LANDING_TOLERANCE+1e-10);
     assert.ok(Math.abs(error-route.error)<1e-10);
     assert.ok(route.journey.excess>=0&&Number.isFinite(route.journey.length));
     witnesses++;
    }
    for(const s of Object.values(audit.styles)){
     if(s.eligible){assert.equal(audit.failures.length,0);assert.ok(s.available.length/audit.bases.length>=2/3);}
     assert.ok(s.resistant.every(b=>s.available.includes(b)&&!s.bypass.includes(b)));
     if(s.allAvailable)assert.equal(s.available.length,audit.bases.length);
     if(s.allResistant)assert.equal(s.resistant.length,audit.bases.length);
    }
   }
  }
  assert.ok(witnesses>0);
 }finally{PLAY_LEVELS.pop();}
 assert.equal(JSON.stringify(PLAY_LEVELS),signature);
 console.log('Replayed inspection witnesses:',witnesses);
});

test('stronger checks supersede earlier finalists; single-hole archive keeps only final passes',{skip:!results},()=>{
 for(const checked of results!.deeper){
  const retained=results!.dense.find(r=>r.palette.id===checked.palette.id)!.items.find(c=>c.id===checked.item.id)!;
  assert.deepEqual(retained.audit,checked.item.audit);
  assert.equal(retained.audit.threeExplored,true);
 }
 for(const entry of results!.singleHoles){
  const audit=results!.dense.find(r=>r.palette.id===entry.palette)!.items.find(c=>c.id===entry.id)!.audit;
  assert.equal(audit.failures.length,0);
  assert.ok(Object.values(audit.styles).some(s=>s.eligible));
 }
});

test('close-start Zorn diagnostics retain real three-addition witnesses',()=>{
 const saved=JSON.parse(readFileSync('docs/play-close-start-check.json','utf8')) as {items:Item[]};
 const [a,b]=saved.items.map(c=>c.audit);
 assert.ok(b.bases[0].startDistance<a.bases[0].startDistance);
 assert.ok(b.bases[0].startDistance<1.8);
 assert.ok(b.bases[0].approach.minExcess!>a.bases[0].approach.minExcess!);
 for(const audit of [a,b]){
  assert.equal(audit.bases[0].approach.status,'close-indirect');
  assert.equal(audit.styles.interior.allResistant,true);
  assert.ok(audit.bases.every(b=>b.fewest===3&&b.bestTwoError>1.1));
  for(const base of audit.bases)for(const r of base.routes){
   const actual=mixtureColor(PLAY_LEVELS[1].paints,replayRoute(1,r.order,r.times));
   assert.ok(colorDistance(actual,audit.target)<=LIVE_LANDING_TOLERANCE+1e-10);
  }
 }
});
