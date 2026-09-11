import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {LabPicker} from '../app/play-lab';
import {CAMPAIGN_CHAPTERS} from '../app/play-campaign';
Object.assign(globalThis,{React});

test('every campaign and alternate picker renders enabled, independent of auth or flight',()=>{
 for(const c of CAMPAIGN_CHAPTERS)for(const slot of c.slots){
  for(const s of [slot.specimen,...(slot.alternatives??[]).map(a=>a.specimen)]){
   assert.ok(s);
   const markup=renderToStaticMarkup(<LabPicker current={s} onChoose={()=>{}}/>);
   assert.match(markup,/Campaign palette<select/);assert.match(markup,/Hole in this palette<select/);
   assert.doesNotMatch(markup,/<(?:select|button)\b[^>]*\bdisabled/);
   if(slot.alternatives?.length)assert.match(markup,/Candidate version<select/);
  }
 }
});
test('lab navigation uses the interruption-safe hole transition, not gameplay locks',()=>{
 const source=readFileSync(new URL('../app/play.tsx',import.meta.url),'utf8');
 const picker=source.match(/<LabPicker[^>]*\/>/)?.[0];assert.ok(picker);
 assert.doesNotMatch(picker,/disabled/);assert.match(picker,/onChoose=\{replaySpecimen\}/);
 const transition=source.slice(source.indexOf('const startHole ='),source.indexOf('const replaySpecimen='));
 assert.match(transition,/cancelShot\(\)/);assert.match(transition,/cancelCharge\(\)/);
 assert.match(transition,/sceneEpoch.current\+\+/);assert.match(transition,/ready:false/);
 assert.match(transition,/attemptRef.current=null;setAttempt\(null\)/);
 assert.match(source,/if\(epoch!==sceneEpoch.current\)return;/);
});
