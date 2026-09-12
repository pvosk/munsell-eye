import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,colorPoint,mixtureColor,colorDistance,type ColorPoint} from '../app/play-engine';
import {routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureJourney} from '../app/play-journey-analysis';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {backwardRegions,type RegionPalette} from './backward-region-proposals';
import {blindSearch,BLIND_POLICY,setupSlice} from './recipe-blind-search';
import {stableRide} from './stable-route-measurement';
import {compactWitness} from './supported-selection';
type Controls={order:number[];times:number[]};
type ScreenHole={goal:string;target:ColorPoint;bases:{rawFewest:number|null;routes:{witness:Controls}[]}[];classification:Record<'ride'|'value-shift',{eligible:boolean}>};
type Study={sourceHash:string;trials:{trial:RegionPalette;holes:ScreenHole[]}[];deep:{palette:string;goal:string}[]};
import {verify} from "./backward-verification";
const initial=JSON.parse(readFileSync('docs/play-backward-palette-results.json','utf8')) as Study;
const signature=JSON.stringify(PLAY_LEVELS),started=performance.now();
const verified=[];
for(const finalist of initial.deep){
 const t=initial.trials.find(t=>t.trial.id===finalist.palette)!,h=t.holes.find(h=>h.goal===finalist.goal)!;
 const result=verify(t.trial,h.goal,h.target,h.bases.flatMap(b=>b.routes.map(r=>r.witness)),h);verified.push(result);console.log('VERIFIED',t.trial.id,h.goal,JSON.stringify({fail:result.failures,styles:result.styles}));
}
// Two explicitly chosen novel parents, selected for different experiences in
// the initial screen. No claims of global best. Distinct fixed perturbations,
// not fitted target shifts; failed neighbors are retained.
const parents=[{palette:'br-5-11-17-29',goal:'peach'},{palette:'br-3-16-17-21',goal:'olive'}];
const offsets=[[-35,-28,-18],[-25,10,-35],[15,-18,22]],neighbors=[];
for(const parent of parents){
 const t=initial.trials.find(t=>t.trial.id===parent.palette)!,h=t.holes.find(h=>h.goal===parent.goal)!;
 for(let i=0;i<offsets.length;i++){
  const target=colorPoint(h.target.rgb.map((x,j)=>Math.max(0,Math.min(255,x+offsets[i][j]))) as [number,number,number]),goal=`${parent.goal}-neighbor-${i+1}`;
  const slot=PLAY_LEVELS.length;PLAY_LEVELS.push({name:t.trial.name,subtitle:'Offline neighborhood inverse',paints:t.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  let inverse;try{inverse=backwardRegions(slot,target,91226661+i);}finally{PLAY_LEVELS.splice(slot,1);}
  const selected:Controls[]=[];for(let base=0;base<t.trial.paints.length;base++)for(const style of ['ride','value-shift']){
   const pool=inverse.routes.filter(r=>r.order[0]===base&&(style==='ride'?r.rideProxy>=34:r.shiftProxy>0)).sort((a,b)=>a.times.length-b.times.length||(style==='ride'?b.rideProxy-a.rideProxy:b.shiftProxy-a.shiftProxy));selected.push(...pool.slice(0,2));
  }
  const assessment=inverse.routes.length?verify(t.trial,goal,target,selected,null):null;
  neighbors.push({palette:parent.palette,goal,target,separationFromParent:colorDistance(target,h.target)/LIVE_LANDING_TOLERANCE,fitError:inverse.bestError,endpoints:inverse.endpointCount,proposalCount:inverse.routes.length,assessment});
  console.log('NEIGHBOR',parent.palette,goal,JSON.stringify(assessment?{fail:assessment.failures,styles:assessment.styles}:{fitError:inverse.bestError,unresolved:true}));
 }
}
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Live palette changed');
const sourceFiles=["scripts/backward-verification.ts",'scripts/verify-backward-finalists.ts','scripts/backward-region-proposals.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','app/play-engine.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-journey-analysis.ts','app/play-course-analysis.ts','app/paint-mixing.ts'];
writeFileSync('docs/play-backward-finalists.json',JSON.stringify({sourceFiles,sourceHash:createHash('sha256').update(sourceFiles.map(p=>readFileSync(p)).join('\n')).digest('hex'),parentSourceHash:initial.sourceHash,seconds:(performance.now()-started)/1000,verified,neighbors,
 limitations:['Deeper reclassification combines replayable screen witnesses with independent numeric routes; it is not independent reproduction of every style witness.',
 'Only two nearest-center numeric doses retained per order; outer acceptance-region bypasses may remain undiscovered.',
 'Six fixed RGB perturbations of two selected parents test local repeatability, not the entire palette gamut or an unbiased validation set.',
 'Global setup/finish slices fix earlier doses for three-addition routes. Uniform sampling can miss narrow bands; exact successful witness is retained.',
 'No bank publication or gameplay changes. Eligibility is majority style availability plus all-base support, not all-base style resistance.']})+'\n');
