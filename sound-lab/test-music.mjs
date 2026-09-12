import assert from 'node:assert/strict';
import { MODES, STACKS, ARPS, MUSIC_DEFAULTS, harmonicFrame, leadVoices, motif, sanitizeMusic } from '../app/sound-lab/music.ts';
const mod=(v,n)=>((v%n)+n)%n;
const sameClass=(a,b)=>Math.min(mod(a-b,12),mod(b-a,12))<1e-7;
let checked=0;
for(const mode of MODES)for(const stack of STACKS)for(const tonic of [0,3,8])for(const step of [0,1,3]){
 const m={...MUSIC_DEFAULTS,mode:mode.id,stack:stack.id,tonic,progression:'modal',pedal:false};
 const frame=harmonicFrame(m,step);
 assert.equal(frame.tones.length,6);
 for(const note of frame.tones)assert(frame.scale.some(s=>sameClass(note,s)),`${mode.id}/${stack.id} escaped scale`);
 for(const [arp] of ARPS){
  const settings={...m,arp};const phrase=motif(settings,frame.tones,frame.scale,0);
  assert.deepEqual(phrase,motif(settings,frame.tones,frame.scale,0));
  assert(phrase.length>0&&phrase.length<=24);
  assert(phrase.every((n,i)=>Number.isFinite(n.midi)&&n.strength>=0&&frame.tones.some(t=>sameClass(t,n.midi))&&(i===0||n.beat>=phrase[i-1].beat)));
 }
 checked++;
}
for(const progression of ['fifths','fourths']){
 const m={...MUSIC_DEFAULTS,progression,pedal:false};
 assert.equal(new Set(Array.from({length:12},(_,s)=>harmonicFrame(m,s).tonic)).size,12);
 assert.equal(harmonicFrame(m,12).tonic,m.tonic);
}
const m={...MUSIC_DEFAULTS,pedal:false,progression:'fifths'};
let previous=harmonicFrame(m,0).tones;
for(let i=1;i<12;i++){
 const next=harmonicFrame(m,i).tones,led=leadVoices(next,previous);
 assert(led.every((n,j)=>sameClass(n,next[j])&&(j===0||n>=led[j-1])));
 previous=led;
}
const invalid=sanitizeMusic({bpm:Infinity,mode:'unknown',tonic:99,variation:-1,sustain:'yes',seed:NaN});
assert.equal(invalid.bpm,MUSIC_DEFAULTS.bpm);assert.equal(invalid.mode,MUSIC_DEFAULTS.mode);assert.equal(invalid.tonic,11);assert.equal(invalid.variation,0);assert.equal(invalid.sustain,false);
console.log(`Passed ${checked} harmonic combinations, all arpeggio types, circle closure, voice leading, repeatability and input bounds.`);

const grid = sanitizeMusic({...MUSIC_DEFAULTS,melody:'grid',melodyLength:8,offspring:3,variation:.8,melodySteps:[0,null,4,2,null,1,3,null]});
const gf=harmonicFrame(grid,0), gn=motif(grid,gf.tones,gf.scale,0);
assert.equal(gn.length,32);
assert.equal(gn[0].midi,gf.scale[0]);
assert.equal(gn[8].midi,gf.scale[4]);
assert(gn.slice(4,8).every(n=>n.skip));
assert(gn.slice(-4).every(n=>n.skip));
assert(!gn[0].skip && !gn[8].skip);
assert.equal(gn[0].strength,gn[8].strength);
assert.equal(gn.at(-1).beat,7.75*grid.spacing);
assert.deepEqual(gn,motif(grid,gf.tones,gf.scale,0));
const alone=motif({...grid,offspring:0},gf.tones,gf.scale,0);
assert.equal(alone.length,8);
assert.equal(alone[2].midi,gn[8].midi);
const following=motif({...grid,melodyFollow:true},gf.tones,gf.scale,0,3);
assert.equal(following[0].midi,gf.scale[3]);
const seven=sanitizeMusic({...grid,mode:'seven-equal'}), sf=harmonicFrame(seven);
assert(Math.abs(motif(seven,sf.tones,sf.scale)[8].midi-sf.scale[4])<1e-7);
assert(sanitizeMusic({melody:'grid',melodySteps:[NaN,99,-12,'x'],offspring:99}).melodySteps.every(n=>n===null || (n>=0 && n<=14)));
assert.equal(sanitizeMusic({offspring:99}).offspring,3);
assert.equal(sanitizeMusic({}).melody,'procedural');
console.log('Passed custom melody anchors, rests, offspring, timing, progression following, alternate tuning and input bounds.');

const customGrid={...grid,offspring:0,melodySteps:[0,1,2,3,4,5,6,7]};
const customNotes=motif(customGrid,[48,55,60,62,67,72],[48,55,60,62,67,72]);
assert(customNotes.every((n,i)=>i===0||n.midi>customNotes[i-1].midi));
