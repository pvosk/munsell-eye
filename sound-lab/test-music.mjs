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
