import { PLAY_LEVELS, LIVE_LANDING_TOLERANCE, withLiveLanding, generateHole, generateLabHole, generatePairedHole, pairedLabBank, type Hole, type Mixture } from './play-engine';

export const LAB_ENGINE = 'glider-courses-3-controls-1';
export const LAB_ROUND_ENGINE='glider-lab-2-controls-1';
export const LAB_PAIRED_ENGINE='glider-lab-3-controls-1';
const originalEngine=(engine:string)=>engine.endsWith('-landing-2')?engine.slice(0,-10):engine;
export const supportedLabEngine=(engine:string)=>[LAB_ENGINE,'glider-courses-2-controls-1',LAB_ROUND_ENGINE,LAB_PAIRED_ENGINE].includes(originalEngine(engine));
export type LabSpecimen = { levelIndex: number; hole: Hole; comparison?:{base:number;sourceAttemptId:string} };
export type LabShot = { paint: number; seconds: number; amount: number; before: Mixture; after: Mixture; cancelled: boolean };
export type LabAttempt = {
  id: string; engine: string; specimen: LabSpecimen; started: string;
  paints: {id:string;name:string;rgb:number[];strength:number}[];
  shots: LabShot[]; outcome: 'playing' | 'landed' | 'replayed' | 'left'; revealed: boolean;
};
export type LabReview = { verdict: string; challenge: string; issue: string; note: string; shot: number | null; routeVerdict?:string; comparison?:string };
export type LabEvent = { id: string; attemptId: string; type: 'attempt'; attempt: LabAttempt } |
  { id: string; attemptId: string; type: 'review'; review: LabReview };
export type LabEntry = { attempt: LabAttempt; review?: LabReview };
export const LAB_STARTERS: LabSpecimen[] = [4,5,1,8,10,11].flatMap(levelIndex =>
  [0,1].map(stage=>({levelIndex,hole:generateLabHole(levelIndex,stage)})));
export const LAB_PAIRED:LabSpecimen[]=pairedLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generatePairedHole(h.levelIndex,h.stage)}));
export function suggestedComparison(attempt:LabAttempt):LabSpecimen|null {
  const first=attempt.shots.find(s=>!s.cancelled),item=pairedLabBank.holes.find(h=>h.record.id===attempt.specimen.hole.courseId);
  if(!first||!item)return null;
  const candidates=item.analysis.bases.filter(b=>b.qualifies&&b.base!==first.paint);
  candidates.sort((a,b)=>(b.minimumTravel??0)-(a.minimumTravel??0));
  if(!candidates.length)return null;
  return {...attempt.specimen,comparison:{base:candidates[0].base,sourceAttemptId:attempt.id}};
}

export function newLabAttempt(specimen:LabSpecimen,id:string):LabAttempt {
  const base=specimen.hole.courseId.startsWith('lab-3-')?LAB_PAIRED_ENGINE:specimen.hole.courseId.startsWith('lab-2-')?LAB_ROUND_ENGINE:specimen.hole.courseId.startsWith('courses-2-')?'glider-courses-2-controls-1':LAB_ENGINE;
  return {id,engine:base+(specimen.hole.tolerance===LIVE_LANDING_TOLERANCE?'-landing-2':''),specimen,started:new Date().toISOString(),shots:[],outcome:'playing',revealed:false,
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
      && (r.routeVerdict===undefined||['','keep','revise','reject'].includes(r.routeVerdict))
      && (r.comparison===undefined||['','both-good','first-better','second-better','neither'].includes(r.comparison))
      && typeof r.note==='string' && r.note.length<=3000 && (r.shot===null || Number.isInteger(r.shot)&&r.shot>=0&&r.shot<200);
  }
  if(e.type!=='attempt'||!e.attempt)return false;
  const a=e.attempt,s=a.specimen;
  if(a.id!==e.attemptId||!supportedLabEngine(a.engine)||typeof a.started!=='string'||!Number.isFinite(Date.parse(a.started))||typeof a.revealed!=='boolean')return false;
  if(!s||!Number.isInteger(s.levelIndex)||!PLAY_LEVELS[s.levelIndex]||!s.hole)return false;
  const engine=originalEngine(a.engine);
  if(s.comparison&&(engine!==LAB_PAIRED_ENGINE||!id(s.comparison.sourceAttemptId)||!Number.isInteger(s.comparison.base)||!PLAY_LEVELS[s.levelIndex].paints[s.comparison.base]))return false;
  if(!Number.isInteger(s.hole.seed)||s.hole.seed<0||s.hole.seed>0xffffffff||!Number.isInteger(s.hole.stage)||s.hole.stage<0||s.hole.stage>4)return false;
  let original:Hole;
  try {
    if(engine!==LAB_ROUND_ENGINE&&engine!==LAB_PAIRED_ENGINE&&s.levelIndex>=10)return false;
    original=engine===LAB_PAIRED_ENGINE?generatePairedHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_ROUND_ENGINE?generateLabHole(s.levelIndex,s.hole.stage,s.hole.seed):generateHole(s.levelIndex,s.hole.seed,s.hole.stage,engine==='glider-courses-2-controls-1');
    if(a.engine.endsWith('-landing-2'))original=withLiveLanding(original);
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
