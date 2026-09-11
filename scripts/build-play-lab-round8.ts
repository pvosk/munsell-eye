import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,type PlayLevel} from '../app/play-engine';
import {playerPar,paletteSignature} from '../app/play-course-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import type {JourneyAudit,JourneyRoute,JourneyStyle} from '../app/play-journey-analysis';
import type {DesignAnalysis} from '../app/play-route-design';
import type {AuditRoute,AuditStyle} from '../app/play-route-audit';

type Item={id:string;recipe:number[];audit:JourneyAudit};
type Row={palette:{id:string;name:string;paints:PlayLevel['paints']};items:Item[]};
const main=JSON.parse(readFileSync('docs/play-journey-inspection.json','utf8')) as {sourceHash:string;dense:Row[]};
const fresh=JSON.parse(readFileSync('docs/play-journey-targeted-holdout.json','utf8')) as {checked:Row[]};
const exceptions=JSON.parse(readFileSync('docs/play-journey-exceptions.json','utf8')) as {checked:(Item&{palette:Row['palette']})[]};
const close=JSON.parse(readFileSync('docs/play-close-start-check.json','utf8')) as {palette:PlayLevel;items:Item[]};
const rows=[...main.dense,...fresh.checked,...exceptions.checked.map(c=>({palette:c.palette,items:[c]})),{palette:{id:'close-zorn',name:'Zorny',paints:close.palette.paints},items:close.items}];
const plan:[string,string,JourneyStyle,string][]=[
 ['control-5-directed-fresh-27','Secondaries','interior','Interior · reference'],
 ['secondary-0-directed-fresh-27','Moss Violet','interior','Interior · new secondaries'],
 ['secondary-2-directed-fresh-5','Sap Violet','interior','Interior · new secondaries'],
 ['value-span-1-directed-fresh-39','Magenta Grove','interior','Interior · chromatic balance'],
 ['opposed-pairs-3-train-4','Teal Ember','interior','Interior · one-off discovery'],
 ['dark-and-light-1-value-shift-2','Maroon Drift','balance','Balance · without white'],
 ['dark-and-light-3-gap-1','Teal Earth','interior','Interior · longer approaches'],
 ['close-zorn-1','Zorny','interior','Close start · deliberate detour'],
 ['chromatic-triad-1-fresh-25','Ultramarine Gold','ride','Chromatic ride · experimental'],
 ['chromatic-triad-3-ride-2','Turquoise Rust','ride','Chromatic ride · experimental'],
];
// Regeneration never changes the first 21 palette identities.
PLAY_LEVELS.length=21;
const palettes:PlayLevel[]=[],holes=[];
for(const [sourceId,name,style,label] of plan){
 const row=rows.find(row=>row.items.some(c=>c.id===sourceId));if(!row)throw Error(`Missing ${sourceId}`);
 const item=row.items.find(c=>c.id===sourceId)!,a=item.audit;
 if(a.failures.length||!a.styles[style].eligible)throw Error(`Failed candidate ${sourceId}`);
 let levelIndex=PLAY_LEVELS.findIndex(p=>p.name===name);
 if(levelIndex<0){const p={name,subtitle:'Journey lab candidate',paints:row.palette.paints,tolerance:LANDING_TOLERANCE,labOnly:true};levelIndex=PLAY_LEVELS.length;PLAY_LEVELS.push(p);palettes.push(p);}
 if(JSON.stringify(PLAY_LEVELS[levelIndex].paints.map(p=>[p.id,p.rgb,p.strength]))!==JSON.stringify(row.palette.paints.map(p=>[p.id,p.rgb,p.strength])))throw Error('Palette identity mismatch');
 const all=a.bases.flatMap(b=>b.routes).filter(experienceSupported);
 const offered=all.filter(r=>r.efficient&&r.traits[style]).sort((a,b)=>style==='ride'?b.longestChromaticPour-a.longestChromaticPour:b.finishWindowMs-a.finishWindowMs);
 const shortest=[...all].sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
 const closestBase=[...a.bases].sort((a,b)=>a.startDistance-b.startDistance)[0].base;
 const closest=all.filter(r=>r.order[0]===closestBase).sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
 const typed=(r:JourneyRoute):AuditRoute=>({...r,traits:(Object.entries(r.traits).filter(([,v])=>v).map(([s])=>({interior:'interior-weave',ride:'chromatic-ride','value-shift':'setup-lift',balance:'value-hue-balance'}[s])) as AuditStyle[])});
 const roles={intended:typed(offered[0]),shortest:typed(shortest),closest:typed(closest)};
 const s=a.styles[style],focus=style==='ride'?'chromatic-ride':style==='balance'?'value-hue-balance':'interior-weave';
 const brief=sourceId.startsWith('close-')?'One occasional close-start test: Yellow Ochre is nearby, but no one- or two-addition route was found. Other bases remain free.':style==='interior'?'Three meaningful additions found from every base, with no one- or two-addition shortcut found. Compare the quality of different approaches.':`${s.available.length}/${a.bases.length} starts offer this style. Other approaches are legitimate; this is an opportunity, not a required route.`;
 const analysis:DesignAnalysis={version:'journeys-1-lab-8',style:style==='ride'?'chromatic-ride':style==='balance'?'coupled-balance':'interior-weave',tolerance:LIVE_LANDING_TOLERANCE,
  nearestBase:Math.min(...a.bases.map(b=>b.startDistance)),failures:a.failures,qualifyingBases:a.bases.filter(b=>b.viable).map(b=>b.base),styleBases:s.available,minTravel:a.minTravel,travelBalance:0,robustThree:a.styles.interior.allResistant,
  search:`Frozen journey inspection; ${a.threeExplored?'dense one/two plus bounded three-dose multistart':'dense one/two plus recipe-based three-dose witnesses'}. Sampled, not a proof.`,
  bases:a.bases.map(b=>({base:b.base,fewestFound:b.fewest,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,minimumTravel:b.approach.minTravel,qualifies:b.viable,
   routes:[...new Map([...Object.values(roles).filter(r=>r.order[0]===b.base),...b.routes.filter(experienceSupported).sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,4).map(typed)].map(r=>[JSON.stringify([r.order,r.times]),r])).values()]}))};
 const r=roles.intended,fewest=Math.min(...a.bases.map(b=>b.fewest!));
 const stage:number=holes.filter(h=>h.levelIndex===levelIndex).length;
 holes.push({sourceId,sourcePalette:row.palette.id,levelIndex,stage,focus,label,emphasis:style==='ride'?'experience':'flexibility',brief,analysis,roles,
  coverage:{availableBases:s.available,robustBases:s.resistant,bypassBases:s.bypass,availableRatio:s.available.length/a.bases.length,robustRatio:s.resistant.length/a.bases.length,eligible:s.allResistant,failures:s.allResistant?[]:['style-bypass-remains']},
  record:{id:`lab-8-${levelIndex}-${stage}-${createHash('sha256').update(sourceId).digest('hex').slice(0,12)}`,target:item.recipe,recipe:r.recipe,order:r.order,times:r.times,par:playerPar(fewest,r.window,style==='ride'?.4:.8),timingWindow:r.window,solutionShots:fewest,kind:style}});
 console.log(name,label,`${s.available.length}/${a.bases.length}`,Math.round(r.finishWindowMs)+'ms');
}
const output={version:'lab-8',seed:20261201,signature:paletteSignature(PLAY_LEVELS.length),sourceHash:main.sourceHash,palettes,
 selection:'Six robust interior/reference candidates, one no-white balance, one occasional close start, and two experimental rides. No par, scoring, control or pigment changes.',holes};
const path='app/generated/play-lab-round8.json';
if(existsSync(path)){const old=JSON.parse(readFileSync(path,'utf8'));if(old.holes.length&&JSON.stringify(old)!==JSON.stringify(output))throw Error('Immutable round 8 already exists');}
writeFileSync(path,JSON.stringify(output));
