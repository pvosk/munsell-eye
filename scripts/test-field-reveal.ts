import assert from 'node:assert/strict';
import {FIELD_POINTS,PLAY_LEVELS} from '../app/play-engine';
import {fieldRevealPlan,paletteReveal} from '../app/play-palette-reveal';

for(const level of PLAY_LEVELS.filter(p=>!p.retired)){
  const reveal=paletteReveal(level.paints),start=performance.now();
  const plan=fieldRevealPlan(reveal,FIELD_POINTS);
  assert.equal(plan.length,FIELD_POINTS.length*2);
  assert.equal(fieldRevealPlan(reveal,FIELD_POINTS),plan,'cached once per palette');
  let seeds=0,early=0,late=0;
  for(let i=0;i<plan.length;i+=2){
    assert(Number.isFinite(plan[i])&&plan[i]>=0&&plan[i]<.935,'every cell completes before intro ends');
    assert(plan[i+1]===0||plan[i+1]===1);
    seeds+=plan[i+1];early+=+(plan[i]<.53);late+=+(plan[i]>.66);
  }
  assert(seeds>0&&seeds<=level.paints.length);
  assert(early>seeds&&late>0,'arc cells and extended gamut both represented');
  console.log(level.name,FIELD_POINTS.length,'cells',Math.round(performance.now()-start)+'ms',seeds,'seeds',early,'arc cells');
}
