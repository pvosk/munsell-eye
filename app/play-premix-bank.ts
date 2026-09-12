import bank from './generated/play-premix-lab.json';
import regions from './generated/play-premix-regions.json';
import {PLAY_LEVELS,colorPoint,mixtureColor,nearestNotation,type Hole} from './play-engine';
import {premixReplay,type MassMode} from './play-premix';
export const PREMIX_ENGINE='glider-premix-1';
export const premixBank=bank;
type Measurement={order:number[];times:number[];error:number;finishWindowMs:number;setupCoverage:number;supported:boolean};
type ModeEvidence={order:number[];times:number[];error:number;minimum:number;measurement:Measurement;rivals:Measurement[]};
export type PremixRow={id:string;level:number;stage:number;style:string;initial:number[];targetRGB:number[];paints:unknown[];modes:Partial<Record<MassMode,ModeEvidence>>;role?:string;classification?:{rawMinimum:number;timingMinimum:number|null;status:string;efficientRoutes:number;styleRoutes:number}};
export const regionBank=regions as unknown as {seed:number;tolerance:number;holes:PremixRow[]};
export const allPremixRows:PremixRow[]=[...bank.holes,...regionBank.holes];
export function generatePremixHole(pairId:string,mode:MassMode):Hole{
 const item=allPremixRows.find(h=>h.id===pairId);if(!item||!['accumulated','normalized'].includes(mode)||!item.modes[mode])throw Error('Unknown premix');
 const paints=PLAY_LEVELS[item.level].paints;
 if(JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]))!==JSON.stringify(item.paints))throw Error('Premix pigments changed');
 const r=item.modes[mode]!,target=colorPoint([...item.targetRGB] as [number,number,number]),source=item.role?regionBank:bank;
 return{seed:source.seed,stage:item.role?0:item.stage,start:mixtureColor(paints,item.initial),target,notation:nearestNotation(target),par:3,recipe:premixReplay(item.initial,r.order,r.times,mode),tolerance:source.tolerance,timingWindow:r.measurement.finishWindowMs/1000,courseId:`${item.id}-${mode}`,kind:item.style,solutionShots:r.minimum,routeOrder:[...r.order],routeTimes:[...r.times],premix:{initial:[...item.initial],massMode:mode,pairId}};
}
export function premixProgress(hole:Hole){const rows=premixItem(hole)?.role?regionBank.holes:premixBank.holes;return `${rows.findIndex(h=>h.id===hole.premix?.pairId)+1}/${rows.length} · ${hole.premix?.massMode}`;}
export const PREMIX_SPECIMENS=bank.holes.flatMap(h=>(['accumulated','normalized'] as const).map(mode=>({levelIndex:h.level,hole:generatePremixHole(h.id,mode)})));
export const REGION_SPECIMENS=regionBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export function premixItem(hole:Hole){return hole.premix?allPremixRows.find(h=>h.id===hole.premix!.pairId):undefined;}
