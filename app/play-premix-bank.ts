import bank from './generated/play-premix-lab.json';
import regions from './generated/play-premix-regions.json';
import legLab from './generated/play-pigment-leg-lab.json';
import branchLab from './generated/play-branch-lab.json';
import conditionedLab from './generated/play-conditioned-lab.json';
import workbench from './generated/play-course-workbench.json';
import {PLAY_LEVELS,colorPoint,mixtureColor,nearestNotation,neutralStart,type Hole} from './play-engine';
import {premixReplay,type MassMode} from './play-premix';
export const PREMIX_ENGINE='glider-premix-1';
export const premixBank=bank;
type Measurement={order:number[];times:number[];error:number;finishWindowMs:number;setupCoverage:number;supported:boolean;label?:string;legCount?:number;finishShareWidth?:number;proportionSupported?:boolean};
type ModeEvidence={order:number[];times:number[];error:number;minimum:number;measurement:Measurement;rivals:Measurement[]};
export type PremixRow={id:string;level:number;stage:number;style:string;initial:number[];targetRGB:number[];paints:unknown[];modes:Partial<Record<MassMode,ModeEvidence>>;role?:string;collection?:'legs'|'branches'|'conditioned'|'workbench';freeBase?:true;title?:string;lab?:{brief:string;method:string;sourceId:string;searchIntent:string|null;exploratory:boolean;rawLegMinimum:number;regionLegMinimum:number|null;styleStatus:string;featuredLegs:number};classification?:{rawMinimum:number;timingMinimum:number|null;status:string;efficientRoutes:number;styleRoutes:number}};
export const regionBank=regions as unknown as {seed:number;tolerance:number;holes:PremixRow[]};
export const legLabBank=legLab as unknown as {seed:number;tolerance:number;holes:PremixRow[]};
export const branchLabBank=branchLab as unknown as {seed:number;tolerance:number;holes:PremixRow[]};
export const conditionedLabBank=conditionedLab as unknown as {seed:number;tolerance:number;holes:PremixRow[]};
export const workbenchBank=workbench as unknown as {seed:number;tolerance:number;holes:PremixRow[];board:{name:string;origin:string;paints:string[];status:string;note:string;targets:number;freeNontrivial:number;premixCandidates:number;zones:string[];playable:string[]}[]};
export const allPremixRows:PremixRow[]=[...bank.holes,...regionBank.holes,...legLabBank.holes,...branchLabBank.holes,...conditionedLabBank.holes,...workbenchBank.holes];
export function generatePremixHole(pairId:string,mode:MassMode):Hole{
 const item=allPremixRows.find(h=>h.id===pairId);if(!item||!['accumulated','normalized'].includes(mode)||!item.modes[mode])throw Error('Unknown premix');
 const paints=PLAY_LEVELS[item.level].paints;
 if(JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]))!==JSON.stringify(item.paints))throw Error('Premix pigments changed');
 const r=item.modes[mode]!,target=colorPoint([...item.targetRGB] as [number,number,number]),source=item.collection==='workbench'?workbenchBank:item.collection==='conditioned'?conditionedLabBank:item.collection==='branches'?branchLabBank:item.collection==='legs'?legLabBank:item.role?regionBank:bank;
 return{seed:source.seed,stage:item.role?0:item.stage,start:item.freeBase?neutralStart(PLAY_LEVELS[item.level]):mixtureColor(paints,item.initial),target,notation:nearestNotation(target),par:3,recipe:premixReplay(item.initial,r.order,r.times,mode,item.freeBase),tolerance:source.tolerance,timingWindow:r.measurement.finishWindowMs/1000,courseId:`${item.id}-${mode}`,kind:item.style,solutionShots:r.minimum,routeOrder:[...r.order],routeTimes:[...r.times],premix:{initial:[...item.initial],massMode:mode,pairId,...(item.freeBase?{freeBase:true as const}:{})}};
}
export function premixCollection(hole:Hole){const item=premixItem(hole);return item?.collection==='workbench'?workbenchBank:item?.collection==='conditioned'?conditionedLabBank:item?.collection==='branches'?branchLabBank:item?.collection==='legs'?legLabBank:item?.role?regionBank:premixBank;}
export function premixProgress(hole:Hole){const rows=premixCollection(hole).holes;return `${rows.findIndex(h=>h.id===hole.premix?.pairId)+1}/${rows.length} · ${hole.premix?.massMode}`;}
export const PREMIX_SPECIMENS=bank.holes.flatMap(h=>(['accumulated','normalized'] as const).map(mode=>({levelIndex:h.level,hole:generatePremixHole(h.id,mode)})));
export const REGION_SPECIMENS=regionBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export const LEG_SPECIMENS=legLabBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export const BRANCH_SPECIMENS=branchLabBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export const CONDITIONED_SPECIMENS=conditionedLabBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export const WORKBENCH_SPECIMENS=workbenchBank.holes.map(h=>({levelIndex:h.level,hole:generatePremixHole(h.id,'normalized')}));
export function premixItem(hole:Hole){return hole.premix?allPremixRows.find(h=>h.id===hole.premix!.pairId):undefined;}
