import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {geometry,measureRegion} from './premix-region-metrics';
import {PLAY_LEVELS,mixtureColor,colorDistance,colorPoint} from '../app/play-engine';
import bank from '../app/generated/play-premix-lab.json';
const source=process.argv[2];if(!source)throw Error('Pass the user export path');
const raw=readFileSync(source),data=JSON.parse(raw.toString()),attempts=new Map(),reviews=new Map();
for(const e of data.events){if(e.type==='attempt')attempts.set(e.attemptId,e.attempt);if(e.type==='review')reviews.set(e.attemptId,e.review);}
const cases=[
 {id:'e6b7f3cd-1657-456f-a7e8-50966199fa79',role:'definition',question:'First-shot rise must not establish setup-then-rise; efficient bypass remains visible.'},
 {id:'ee8c9c65-a9bd-4b21-a894-607d0b4d5e75',role:'definition',question:'Several recorded pours can hide one obvious adjustment and token corrections.'},
 {id:'975dcea5-c441-4116-bb47-5c1f7898a1c1',role:'held-out',question:'Pleasant finish and stronger-pigment precision: do not tune thresholds to make this pass.'},
 {id:'cea362b5-1f8c-408f-89dc-efd18da324ae',role:'held-out',question:'Accumulated-mode review is not a normalized difficulty label.'},
 {id:'cf893092-5bf0-4f37-b1d3-2eff9efb7947',role:'held-out',question:'Positive free-start close start: no universal distance exclusion; not premix evidence.'},
 {id:'20a71178-07a7-410f-9229-aaa2f65a57fe',role:'held-out',question:'Positive free-start alternative; preserve exact route and do not infer an unmentioned style.'},
];
const entries=cases.map(c=>{
 const attempt=attempts.get(c.id),review=reviews.get(c.id);if(!attempt||!review)throw Error('Missing review '+c.id);
 const p=attempt.specimen.hole.premix,level=attempt.specimen.levelIndex;
 const shots=attempt.shots.filter((s:any)=>!s.cancelled);
 const measurement=p?.massMode==='normalized'?geometry(level,p.initial,attempt.specimen.hole.target,{order:shots.map((s:any)=>s.paint),times:shots.map((s:any)=>s.seconds),error:colorDistance(mixtureColor(PLAY_LEVELS[level].paints,shots.at(-1).after),attempt.specimen.hole.target)}):null;
 return {...c,review,attempt,measurement,limitation:measurement?'Actual played route geometry, not assumed optimal; human quality remains separate.':'Mode differs: archived exactly, not relabeled with normalized metrics.'};
});
// Compare old featured routes without changing their immutable bank.
const references=bank.holes.map(h=>({id:h.id,style:h.style,measurement:measureRegion(h.level,h.initial,colorPoint(h.targetRGB as [number,number,number]),h.modes.normalized)}));
writeFileSync('docs/play-premix-evidence-1.json',JSON.stringify({sourceHash:createHash('sha256').update(raw).digest('hex'),eventCount:data.events.length,uniqueAttempts:attempts.size,uniqueReviews:reviews.size,heldOutPolicy:'Held out from threshold tuning, not a blinded prospective experiment: these reviews were previously discussed. Human labels are not training targets.',entries,references}));
console.log(entries.map(e=>({id:e.id,role:e.role,traits:e.measurement?.traits,meaningful:e.measurement?.meaningful})));
