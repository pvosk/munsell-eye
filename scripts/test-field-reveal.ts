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
  const seedTimes=Array.from({length:FIELD_POINTS.length},(_,i)=>i).filter(i=>plan[i*2+1]===1).map(i=>plan[i*2]);
  assert(new Set(seedTimes).size>1,'pure cells have a light stagger');
  assert(early>seeds&&late>0,'arc cells and extended gamut both represented');
  console.log(level.name,FIELD_POINTS.length,'cells',Math.round(performance.now()-start)+'ms',seeds,'seeds',early,'arc cells');
}

// Two equally deep interior cells follow their own local advancing edge,
// not a global random fill phase. The late edge must produce a later fill.
const point=(x:number,y:number)=>({rgb:[100,100,100] as [number,number,number],lab:[0,0,0] as [number,number,number],position:[x,y,0] as [number,number,number]});
const a=point(0,0),b=point(10,0),insideA=point(0,3),insideB=point(10,3);
const synthetic={...paletteReveal(PLAY_LEVELS[0].paints),seeds:[a,b],bridges:[[a,b]],bridgeTimings:[{delay:.12,duration:.64,reverse:false}],samples:[insideA,insideB].map(point=>({point,origin:a,phase:0,branch:0}))};
const cells=[a,b,insideA,insideB,point(.1,0),point(9.9,0)];
const schedule=fieldRevealPlan(synthetic,cells);
assert(schedule[4]>schedule[8]&&schedule[6]>schedule[10],'fill never precedes its source arc');
assert(schedule[4]<schedule[10],'early interior grows before later arcs finish');
assert(schedule[6]>schedule[4]+.2,'local edge order controls local interior order');
console.log('Local arc-to-interior propagation and seed stagger pass');
