import test from 'node:test';
import assert from 'node:assert/strict';
import {PROTOCOL,roster,propose,noAchromaticPigment} from './search-rides-muted';
import {PLAY_LEVELS,mixtureColor,colorDistance} from '../app/play-engine';
import {replayRoute} from '../app/play-course-analysis';
test('fixed roster keeps controls intact and includes eight genuine three-paint no-white/black constructions',()=>{
 const a=roster();assert.deepEqual(a,roster());assert.equal(a.palettes.length,15);
 const triads=a.palettes.filter(p=>p.family==='dark-light-muted');assert.equal(triads.length,8);
 assert.ok(triads.every(p=>p.paints.length===3&&p.paints.every(noAchromaticPigment)));
 assert.ok(a.palettes.filter(p=>p.family==='control').every(p=>p.paints===PLAY_LEVELS.find(l=>l.name===p.name)!.paints));
});
test('direct and setup proposals replay exactly and repeat deterministically without editing palettes',()=>{
 const before=JSON.stringify(PLAY_LEVELS);
 for(const method of PROTOCOL.methods){const result=propose(4,method,PROTOCOL.seeds[0]);assert.deepEqual(result,propose(4,method,PROTOCOL.seeds[0]));assert.equal(result.selected.length,3);
  for(const c of result.selected)if(c.proposal){assert.equal(c.proposal.times.length,method==='direct-ride'?1:2);assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[4].paints,c.recipe),mixtureColor(PLAY_LEVELS[4].paints,replayRoute(4,c.proposal.order,c.proposal.times)))<1e-9);}
 }
 assert.equal(JSON.stringify(PLAY_LEVELS),before);
});
