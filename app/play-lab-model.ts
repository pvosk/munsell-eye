import { PLAY_LEVELS, LIVE_LANDING_TOLERANCE, withLiveLanding, generateHole, generateLabHole, generatePairedHole, generateDesignHole, generateFocusedHole, generateDirectedHole, directedLabBank, pairedLabBank, designLabBank, focusedLabBank, type Hole, type Mixture } from './play-engine';
import {inverseLabBank,generateInverseHole,contrastLabBank,generateContrastHole,journeyLabBank,generateJourneyHole,protectedLabBank,generateProtectedHole} from './play-engine';

import {campaignSourceId,campaignForHole,campaignSnapshot,nextCampaignSpecimen,campaignAnalysis} from './play-campaign';
export const LAB_INVERSE_ENGINE='glider-lab-10-controls-1';
export const LAB_CAMPAIGN_ENGINE='glider-campaign-draft-1-controls-1';
export const LAB_ENGINE = 'glider-courses-3-controls-1';
export const LAB_ROUND_ENGINE='glider-lab-2-controls-1';
export const LAB_PAIRED_ENGINE='glider-lab-3-controls-1';
export const LAB_DESIGN_ENGINE='glider-lab-4-controls-1';
export const LAB_FOCUSED_ENGINE='glider-lab-5-controls-1';
export const LAB_DIRECTED_ENGINE='glider-lab-6-controls-1';
export const LAB_PROTECTED_ENGINE='glider-lab-7-controls-1';
export const LAB_JOURNEY_ENGINE='glider-lab-8-controls-1';
export const LAB_CONTRAST_ENGINE='glider-lab-9-controls-1';
const originalEngine=(engine:string)=>engine.endsWith('-landing-2')?engine.slice(0,-10):engine;
export const supportedLabEngine=(engine:string)=>[LAB_INVERSE_ENGINE,LAB_CAMPAIGN_ENGINE,LAB_ENGINE,'glider-courses-2-controls-1',LAB_ROUND_ENGINE,LAB_PAIRED_ENGINE,LAB_DESIGN_ENGINE,LAB_FOCUSED_ENGINE,LAB_DIRECTED_ENGINE,LAB_PROTECTED_ENGINE,LAB_JOURNEY_ENGINE,LAB_CONTRAST_ENGINE].includes(originalEngine(engine));
export type LabSpecimen = { levelIndex: number; hole: Hole; comparison?:{base:number;sourceAttemptId:string} };
export type LabShot = { paint: number; seconds: number; amount: number; before: Mixture; after: Mixture; cancelled: boolean };
export type LabAttempt = {
  id: string; engine: string; specimen: LabSpecimen; started: string;
  paints: {id:string;name:string;rgb:number[];strength:number}[];
  shots: LabShot[]; outcome: 'playing' | 'landed' | 'replayed' | 'left'; revealed: boolean;
};
export type LabReview = { verdict: string; challenge: string; issue: string; note: string; shot: number | null; routeVerdict?:string; comparison?:string; paletteVerdict?:string; styleExperience?:string; shortcutVerdict?:string };
export type LabEvent = { id: string; attemptId: string; type: 'attempt'; attempt: LabAttempt } |
  { id: string; attemptId: string; type: 'review'; review: LabReview };
export type LabEntry = { attempt: LabAttempt; review?: LabReview };
export const LAB_STARTERS: LabSpecimen[] = [4,5,1,8,10,11].flatMap(levelIndex =>
  [0,1].map(stage=>({levelIndex,hole:generateLabHole(levelIndex,stage)})));
export const LAB_PAIRED:LabSpecimen[]=pairedLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generatePairedHole(h.levelIndex,h.stage)}));
export const LAB_DESIGN:LabSpecimen[]=designLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateDesignHole(h.levelIndex,h.stage)}));
export const LAB_FOCUSED:LabSpecimen[]=focusedLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateFocusedHole(h.levelIndex,h.stage)}));
export const LAB_DIRECTED:LabSpecimen[]=directedLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateDirectedHole(h.levelIndex,h.stage)}));
export const LAB_PROTECTED:LabSpecimen[]=protectedLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateProtectedHole(h.levelIndex,h.stage)}));
export const LAB_JOURNEYS:LabSpecimen[]=journeyLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateJourneyHole(h.levelIndex,h.stage)}));
export const LAB_CONTRAST:LabSpecimen[]=contrastLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateContrastHole(h.levelIndex,h.stage)}));
export const LAB_INVERSE:LabSpecimen[]=inverseLabBank.holes.map(h=>({levelIndex:h.levelIndex,hole:generateInverseHole(h.levelIndex,h.stage)}));
export const directedForHole=(raw:string)=>{const id=campaignSourceId(raw);return inverseLabBank.holes.find(h=>h.record.id===id)??contrastLabBank.holes.find(h=>h.record.id===id)??journeyLabBank.holes.find(h=>h.record.id===id)??protectedLabBank.holes.find(h=>h.record.id===id)??directedLabBank.holes.find(h=>h.record.id===id);};
export const labHoleProgress=(hole:Hole)=>campaignForHole(hole.courseId)?`${hole.stage+1}/${campaignForHole(hole.courseId)!.chapter.slots.length}`:hole.courseId.startsWith('lab-10-')?`${LAB_INVERSE.findIndex(s=>s.hole.courseId===hole.courseId)+1}/${LAB_INVERSE.length}`:hole.courseId.startsWith('lab-9-')?`${LAB_CONTRAST.findIndex(s=>s.hole.courseId===hole.courseId)+1}/${LAB_CONTRAST.length}`:hole.courseId.startsWith('lab-8-')?`${LAB_JOURNEYS.findIndex(s=>s.hole.courseId===hole.courseId)+1}/${LAB_JOURNEYS.length}`:hole.courseId.startsWith('lab-7-')?`${LAB_PROTECTED.findIndex(s=>s.hole.courseId===hole.courseId)+1}/${LAB_PROTECTED.length}`:hole.courseId.startsWith('lab-6-')?`${LAB_DIRECTED.findIndex(s=>s.hole.courseId===hole.courseId)+1}/8`:`${hole.stage+1}/${hole.courseId.startsWith('lab-5-')?2:5}`;
export const LAB_GROUPS=[
  {name:'Round 10 · Inverse-planning portfolios',items:LAB_INVERSE},
  {name:'Round 9 · Five contrasting journeys',items:LAB_CONTRAST},
  {name:'Round 8 · New palettes & measured journeys',items:LAB_JOURNEYS},
  {name:'Round 7 · Interiors, value shifts & rides',items:LAB_PROTECTED},
  {name:'Round 6 · Directed routes & alternatives',items:LAB_DIRECTED},
  {name:'Round 5 · New palettes & style coverage',items:LAB_FOCUSED},
  {name:'Round 4 · Routes & paint substitutions',items:LAB_DESIGN},
  {name:'Round 3 · Previous paired starts',items:LAB_PAIRED},
  {name:'Round 2 · Earlier tests',items:LAB_STARTERS},
].map(g=>({...g,items:g.items.filter(s=>!PLAY_LEVELS[s.levelIndex].retired)}));
export function nextFixedLabSpecimen(current:LabSpecimen):LabSpecimen|null{
  const campaign=nextCampaignSpecimen(current.hole.courseId);if(campaign)return campaign;
  const bank=current.hole.courseId.startsWith('lab-10-')?LAB_INVERSE:current.hole.courseId.startsWith('lab-9-')?LAB_CONTRAST:current.hole.courseId.startsWith('lab-8-')?LAB_JOURNEYS:current.hole.courseId.startsWith('lab-7-')?LAB_PROTECTED:current.hole.courseId.startsWith('lab-6-')?LAB_DIRECTED:current.hole.courseId.startsWith('lab-5-')?LAB_FOCUSED:current.hole.courseId.startsWith('lab-4-')?LAB_DESIGN:current.hole.courseId.startsWith('lab-3-')?LAB_PAIRED:current.hole.courseId.startsWith('lab-2-')?LAB_STARTERS:null;
  if(!bank)return null;
  const at=bank.findIndex(s=>s.hole.courseId===current.hole.courseId);
  if(at<0)return null;
  for(let step=1;step<=bank.length;step++){const s=bank[(at+step)%bank.length];if(!PLAY_LEVELS[s.levelIndex].retired)return s;}
  return null;
}
export const analysisForHole=(raw:string)=>{const id=campaignSourceId(raw);return campaignAnalysis(id)??directedForHole(id)?.analysis??focusedLabBank.holes.find(h=>h.record.id===id)?.analysis??designLabBank.holes.find(h=>h.record.id===id)?.analysis??pairedLabBank.holes.find(h=>h.record.id===id)?.analysis;};
export function suggestedComparison(attempt:LabAttempt):LabSpecimen|null {
  const first=attempt.shots.find(s=>!s.cancelled),item=analysisForHole(attempt.specimen.hole.courseId);
  if(!first||!item)return null;
  const candidates=item.bases.filter(b=>b.qualifies&&b.base!==first.paint);
  candidates.sort((a,b)=>(b.minimumTravel??0)-(a.minimumTravel??0));
  if(!candidates.length)return null;
  return {...attempt.specimen,comparison:{base:candidates[0].base,sourceAttemptId:attempt.id}};
}

export function newLabAttempt(specimen:LabSpecimen,id:string):LabAttempt {
  const base=campaignForHole(specimen.hole.courseId)?LAB_CAMPAIGN_ENGINE:specimen.hole.courseId.startsWith('lab-10-')?LAB_INVERSE_ENGINE:specimen.hole.courseId.startsWith('lab-9-')?LAB_CONTRAST_ENGINE:specimen.hole.courseId.startsWith('lab-8-')?LAB_JOURNEY_ENGINE:specimen.hole.courseId.startsWith('lab-7-')?LAB_PROTECTED_ENGINE:specimen.hole.courseId.startsWith('lab-6-')?LAB_DIRECTED_ENGINE:specimen.hole.courseId.startsWith('lab-5-')?LAB_FOCUSED_ENGINE:specimen.hole.courseId.startsWith('lab-4-')?LAB_DESIGN_ENGINE:specimen.hole.courseId.startsWith('lab-3-')?LAB_PAIRED_ENGINE:specimen.hole.courseId.startsWith('lab-2-')?LAB_ROUND_ENGINE:specimen.hole.courseId.startsWith('courses-2-')?'glider-courses-2-controls-1':LAB_ENGINE;
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

// Keep the live attempt selectable while its persistence request is still in flight.
export function labReviewEntries(events:LabEvent[],current:LabAttempt|null):LabEntry[] {
  const entries=labEntries(events);
  if(!current)return entries;
  const saved=entries.find(e=>e.attempt.id===current.id);
  return [{attempt:current,review:saved?.review},...entries.filter(e=>e.attempt.id!==current.id)];
}
export function selectedLabEntry(entries:LabEntry[],current:LabAttempt|null,chosen:string|null) {
  return entries.find(e=>e.attempt.id===(chosen??current?.id))??entries[0];
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
      && (r.paletteVerdict===undefined||['','original','variant','both','neither'].includes(r.paletteVerdict))
      && (r.styleExperience===undefined||['','clear','partial','absent'].includes(r.styleExperience))
      && (r.shortcutVerdict===undefined||['','fun','undermines','not-tried'].includes(r.shortcutVerdict))
      && typeof r.note==='string' && r.note.length<=3000 && (r.shot===null || Number.isInteger(r.shot)&&r.shot>=0&&r.shot<200);
  }
  if(e.type!=='attempt'||!e.attempt)return false;
  const a=e.attempt,s=a.specimen;
  if(a.id!==e.attemptId||!supportedLabEngine(a.engine)||typeof a.started!=='string'||!Number.isFinite(Date.parse(a.started))||typeof a.revealed!=='boolean')return false;
  if(!s||!Number.isInteger(s.levelIndex)||!PLAY_LEVELS[s.levelIndex]||!s.hole)return false;
  const engine=originalEngine(a.engine);
  if(s.comparison&&(![LAB_INVERSE_ENGINE,LAB_CAMPAIGN_ENGINE,LAB_PAIRED_ENGINE,LAB_DESIGN_ENGINE,LAB_FOCUSED_ENGINE,LAB_DIRECTED_ENGINE,LAB_PROTECTED_ENGINE,LAB_JOURNEY_ENGINE,LAB_CONTRAST_ENGINE].includes(engine)||!id(s.comparison.sourceAttemptId)||!Number.isInteger(s.comparison.base)||!PLAY_LEVELS[s.levelIndex].paints[s.comparison.base]))return false;
  if(!Number.isInteger(s.hole.seed)||s.hole.seed<0||s.hole.seed>0xffffffff||!Number.isInteger(s.hole.stage)||s.hole.stage<0||s.hole.stage>4)return false;
  let original:Hole;
  try {
    if(![LAB_INVERSE_ENGINE,LAB_CAMPAIGN_ENGINE,LAB_ROUND_ENGINE,LAB_PAIRED_ENGINE,LAB_DESIGN_ENGINE,LAB_FOCUSED_ENGINE,LAB_DIRECTED_ENGINE,LAB_PROTECTED_ENGINE,LAB_JOURNEY_ENGINE,LAB_CONTRAST_ENGINE].includes(engine)&&s.levelIndex>=10)return false;
    original=engine===LAB_INVERSE_ENGINE?generateInverseHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_CAMPAIGN_ENGINE?campaignSnapshot(s.hole.courseId,s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_CONTRAST_ENGINE?generateContrastHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_JOURNEY_ENGINE?generateJourneyHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_PROTECTED_ENGINE?generateProtectedHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_DIRECTED_ENGINE?generateDirectedHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_FOCUSED_ENGINE?generateFocusedHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_DESIGN_ENGINE?generateDesignHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_PAIRED_ENGINE?generatePairedHole(s.levelIndex,s.hole.stage,s.hole.seed):engine===LAB_ROUND_ENGINE?generateLabHole(s.levelIndex,s.hole.stage,s.hole.seed):generateHole(s.levelIndex,s.hole.seed,s.hole.stage,engine==='glider-courses-2-controls-1');
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
