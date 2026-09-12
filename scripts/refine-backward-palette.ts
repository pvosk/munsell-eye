import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS} from '../app/paint-mixing';
import {PLAY_LEVELS,colorPoint,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {backwardRegions,type RegionPalette} from './backward-region-proposals';
import {verify} from './backward-verification';
const initial=JSON.parse(readFileSync('docs/play-backward-palette-results.json','utf8')) as {sourceHash:string;trials:{trial:RegionPalette}[]};
const parent=initial.trials.find(t=>t.trial.id==='br-0-4-16-21')!.trial;
const variants=[{label:'parent',replace:null,pigment:null},
 {label:'cobalt-for-phthalo',replace:3,pigment:'cobalt-blue'},
 {label:'ultramarine-for-phthalo',replace:3,pigment:'ultramarine-blue'},
 {label:'flake-for-titanium',replace:0,pigment:'flake-white-replacement'},
 {label:'hansa-for-lemon',replace:1,pigment:'hansa-yellow-light'},
 {label:'maroon-for-violet',replace:2,pigment:'perylene-maroon'},
 {label:'white-lemon-violet-triad',replace:3,pigment:null}];
const goals:[string,[number,number,number]][]=[['light-warm',[220,204,175]],['peach',[205,159,128]],['lavender',[156,145,182]]];
const signature=JSON.stringify(PLAY_LEVELS),started=performance.now(),results=[];
for(const v of variants){
 const paints=parent.paints.flatMap((p,i)=>v.replace!==i?[p]:v.pigment?[PAINTS.find(p=>p.id===v.pigment)!]:[]);
 const trial:RegionPalette={id:`refine-${v.label}`,name:paints.map(p=>p.name).join(' / '),paints,control:v.label==='parent',selection:'single-pigment alteration of backward-search value-shift finalist',proxy:[]};
 const holes=[];
 for(let i=0;i<goals.length;i++){
  const [goal,rgb]=goals[i],target=colorPoint(rgb),slot=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:trial.name,subtitle:'Offline targeted refinement',paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  let inverse;try{inverse=backwardRegions(slot,target,91226741+i);}finally{PLAY_LEVELS.splice(slot,1);}
  const proposals=[];
  for(let base=0;base<paints.length;base++)for(const style of ['ride','value-shift']){
   const candidates=inverse.routes.filter(r=>r.order[0]===base&&(style==='ride'?r.rideProxy>=34:r.shiftProxy>0)).sort((a,b)=>a.times.length-b.times.length||(style==='ride'?b.rideProxy-a.rideProxy:b.shiftProxy-a.shiftProxy));
   proposals.push(...candidates.slice(0,2));
  }
  const assessment=inverse.routes.length?verify(trial,goal,target,proposals,null):null;
  holes.push({goal,target,bestError:inverse.bestError,endpoints:inverse.endpointCount,proposalCount:inverse.routes.length,assessment});
  console.log('REFINE',v.label,goal,JSON.stringify(assessment?{fail:assessment.failures,styles:assessment.styles}:{notFound:true,error:inverse.bestError}));
 }
 results.push({variant:v,trial,holes});
}
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Live palette mutation');
const sourceFiles=['scripts/refine-backward-palette.ts','scripts/backward-verification.ts','scripts/backward-region-proposals.ts','scripts/recipe-blind-search.ts','scripts/stable-route-measurement.ts','app/play-engine.ts','app/paint-mixing.ts','app/play-route-design.ts','app/play-journey-analysis.ts','app/play-route-analysis.ts','app/play-course-analysis.ts'];
writeFileSync('docs/play-backward-palette-refinement.json',JSON.stringify({sourceFiles,sourceHash:createHash('sha256').update(sourceFiles.map(p=>readFileSync(p)).join('\n')).digest('hex'),parentSourceHash:initial.sourceHash,seconds:(performance.now()-started)/1000,results,
 limitations:['Six explicit single-pigment variants of one successful parent, not exhaustive optimization. Pigment properties unchanged.',
 'Parent and variants receive the same three fixed destination colors and same search budgets. These are discovery targets, not a held-out quality test.',
 'Failed fits mean not found within bounded inverse search, not proof of impossibility. Independent verifier shares forward physics and support measurements.',
 'Multiple eligible destinations are course candidates, not proof of varied player experience or forced style. Preserve bypass and raw-shortcut evidence.']})+'\n');
