import { PLAY_LEVELS, generateHole, generateLabHole, type Hole, type Mixture } from './play-engine';

export const LAB_ENGINE = 'glider-courses-3-controls-1';
export const LAB_ROUND_ENGINE='glider-lab-2-controls-1';
export const supportedLabEngine=(engine:string)=>engine===LAB_ENGINE||engine==='glider-courses-2-controls-1'||engine===LAB_ROUND_ENGINE;
export type LabSpecimen = { levelIndex: number; hole: Hole };
export type LabShot = { paint: number; seconds: number; amount: number; before: Mixture; after: Mixture; cancelled: boolean };
export type LabAttempt = {
  id: string; engine: string; specimen: LabSpecimen; started: string;
  paints: {id:string;name:string;rgb:number[];strength:number}[];
  shots: LabShot[]; outcome: 'playing' | 'landed' | 'replayed' | 'left'; revealed: boolean;
};
export type LabReview = { verdict: string; challenge: string; issue: string; note: string; shot: number | null };
export type LabEvent = { id: string; attemptId: string; type: 'attempt'; attempt: LabAttempt } |
  { id: string; attemptId: string; type: 'review'; review: LabReview };
export type LabEntry = { attempt: LabAttempt; review?: LabReview };
export const LAB_STARTERS: LabSpecimen[] = [4,5,1,8,10,11].flatMap(levelIndex =>
  [0,1].map(stage=>({levelIndex,hole:generateLabHole(levelIndex,stage)})));

export function newLabAttempt(specimen:LabSpecimen,id:string):LabAttempt {
  return {id,engine:specimen.hole.courseId.startsWith('lab-2-')?LAB_ROUND_ENGINE:specimen.hole.courseId.startsWith('courses-2-')?'glider-courses-2-controls-1':LAB_ENGINE,specimen,started:new Date().toISOString(),shots:[],outcome:'playing',revealed:false,
    paints:PLAY_LEVELS[specimen.levelIndex].paints.map(({id,name,rgb,strength})=>({id,name,rgb:[...rgb],strength}))};
}
export function labEntries(events:LabEvent[]):LabEntry[] {
  const rows=new Map<string,LabEntry>(), reviews=new Map<string,LabReview>();
  for(const event of events) {
    if(event.type==='attempt') rows.set(event.attemptId,{attempt:event.attempt});
    else reviews.set(event.attemptId,event.review);
  }
  return [...rows.values()].map(row=>({...row,review:reviews.get(row.attempt.id)})).reverse();
}

function sameSnapshot(a:unknown,b:unknown):boolean {
  if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-7;
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;
  return Object.keys(aa).length===Object.keys(bb).length&&Object.keys(bb).every(k=>Object.hasOwn(aa,k)&&sameSnapshot(aa[k],bb[k]));
}

// A bounded, versioned envelope. Notes remain text; imported data is never code.
export function validLabEvent(value:unknown):value is LabEvent {
  if(!value || typeof value!=='object')return false;
  const e=value as LabEvent, id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
  if(!id(e.id)||!id(e.attemptId))return false;
  if(e.type==='review') {
    const r=e.review;
    return !!r && ['','keep','revise','reject'].includes(r.verdict) && ['','paint-choice','setup','timing'].includes(r.challenge)
      && ['','too-close','repetitive','visibility','correction','other'].includes(r.issue)
      && typeof r.note==='string' && r.note.length<=3000 && (r.shot===null || Number.isInteger(r.shot)&&r.shot>=0&&r.shot<200);
  }
  if(e.type!=='attempt'||!e.attempt)return false;
  const a=e.attempt,s=a.specimen;
  if(a.id!==e.attemptId||!supportedLabEngine(a.engine)||typeof a.started!=='string'||!Number.isFinite(Date.parse(a.started))||typeof a.revealed!=='boolean')return false;
  if(!s||!Number.isInteger(s.levelIndex)||!PLAY_LEVELS[s.levelIndex]||!s.hole)return false;
  if(!Number.isInteger(s.hole.seed)||s.hole.seed<0||s.hole.seed>0xffffffff||!Number.isInteger(s.hole.stage)||s.hole.stage<0||s.hole.stage>4)return false;
  let original:Hole;
  try {
    if(a.engine!==LAB_ROUND_ENGINE&&s.levelIndex>=10)return false;
    original=a.engine===LAB_ROUND_ENGINE?generateLabHole(s.levelIndex,s.hole.stage,s.hole.seed):generateHole(s.levelIndex,s.hole.seed,s.hole.stage,a.engine==='glider-courses-2-controls-1');
  }catch{return false;}
  // Snapshot equality catches accidental edits to the target, cup or controls.
  if(!sameSnapshot(s.hole,original))return false;
  const paints=PLAY_LEVELS[s.levelIndex].paints.map(({id,name,rgb,strength})=>({id,name,rgb:[...rgb],strength}));
  if(!sameSnapshot(a.paints,paints)||!Array.isArray(a.shots)||a.shots.length>200)return false;
  const q=(v:unknown)=>Array.isArray(v)&&v.length===paints.length&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1e15);
  return ['playing','landed','replayed','left'].includes(a.outcome)&&a.shots.every(t=>Number.isInteger(t.paint)&&t.paint>=0&&t.paint<paints.length
    &&Number.isFinite(t.seconds)&&t.seconds>=0&&t.seconds<86400&&Number.isFinite(t.amount)&&t.amount>0&&t.amount<1e15
    &&q(t.before)&&q(t.after)&&typeof t.cancelled==='boolean');
}
