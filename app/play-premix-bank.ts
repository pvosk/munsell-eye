import bank from './generated/play-premix-lab.json';
import {PLAY_LEVELS,colorPoint,mixtureColor,nearestNotation,type Hole} from './play-engine';
import {premixReplay,type MassMode} from './play-premix';
export const PREMIX_ENGINE='glider-premix-1';
export const premixBank=bank;
export function generatePremixHole(pairId:string,mode:MassMode):Hole{
 const item=bank.holes.find(h=>h.id===pairId);if(!item||!['accumulated','normalized'].includes(mode))throw Error('Unknown premix');
 const paints=PLAY_LEVELS[item.level].paints;
 if(JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]))!==JSON.stringify(item.paints))throw Error('Premix pigments changed');
 const r=item.modes[mode],target=colorPoint([...item.targetRGB] as [number,number,number]);
 return{seed:bank.seed,stage:item.stage,start:mixtureColor(paints,item.initial),target,notation:nearestNotation(target),par:3,recipe:premixReplay(item.initial,r.order,r.times,mode),tolerance:bank.tolerance,timingWindow:r.measurement.finishWindowMs/1000,courseId:`${item.id}-${mode}`,kind:item.style,solutionShots:r.minimum,routeOrder:[...r.order],routeTimes:[...r.times],premix:{initial:[...item.initial],massMode:mode,pairId}};
}
export const PREMIX_SPECIMENS=bank.holes.flatMap(h=>(['accumulated','normalized'] as const).map(mode=>({levelIndex:h.level,hole:generatePremixHole(h.id,mode)})));
export function premixItem(hole:Hole){return hole.premix?bank.holes.find(h=>h.id===hole.premix!.pairId):undefined;}
