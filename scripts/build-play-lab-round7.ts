import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {makeAtlas,playerPar,paletteSignature} from '../app/play-course-analysis';
import {analyzeExperience,experienceMatches,experienceSupported,type Experience} from '../app/play-experience-audit';
import {auditTraits} from '../app/play-route-audit';
import type {DesignAnalysis,DesignRoute} from '../app/play-route-design';
type Audit=ReturnType<typeof analyzeExperience>;
const shifts=JSON.parse(readFileSync('docs/play-rides-value-shift-results.json','utf8')) as {finalists:{id:string;audit:Audit}[]};
const interiors=JSON.parse(readFileSync('docs/play-selection-verified.json','utf8')) as {rows:{id:string;recipe:number[];passes:boolean}[]};
const plan:[string,number,Experience|'interior',string,'experience'|'flexibility'][]=[
 ['gap-2-5',2,'interior','Interior setup','flexibility'],
 ['gap-5-4',5,'interior','Interior setup','flexibility'],
 ['gap-10-3',10,'interior','Interior setup','flexibility'],
 ['rs-20271013-17-25',17,'value-shift','Value shift · rise or drop','flexibility'],
 ['rs-20261013-0-107',0,'drop','Value shift · downward','experience'],
 ['rs-20271013-16-25',16,'rise','Value shift · upward','experience'],
 ['rs-20271013-10-130',10,'ride','Chromatic ride · broad choice','flexibility'],
 ['rs-20261013-10-94',10,'ride','Chromatic ride · stronger curve','experience'],
];
const holes=[];
for(const [sourceId,palette,style,label,emphasis] of plan){
 const previous=style==='interior'?interiors.rows.find(r=>r.id===sourceId):shifts.finalists.find(r=>r.id===sourceId);
 if(!previous)throw new Error(`Missing source ${sourceId}`);
 const recipe='audit' in previous?previous.audit.recipe:previous.recipe;
 const a=analyzeExperience(palette,recipe,makeAtlas(palette,256,48));
 if(a.failures.length)throw new Error(`${sourceId}: ${a.failures}`);
 const interior=style==='interior',matches=(r:DesignRoute)=>interior?r.times.length===3&&r.meaningfulPours===3:experienceMatches(r,style);
 if(interior&&!a.bases.every(b=>b.fewest===3&&b.bestTwoError>1.1&&b.meaningfulFloor===3))throw new Error(`Interior protection failed ${sourceId}`);
 const supported=a.bases.flatMap(b=>b.routes).filter(experienceSupported);
 const offered=supported.filter(matches).sort((a,b)=>style==='ride'?b.longestChromaticPour-a.longestChromaticPour:interior?b.finishWindowMs-a.finishWindowMs:Math.abs(b.finishValue)-Math.abs(a.finishValue));
 if(!offered.length)throw new Error(`No intended style ${sourceId}`);
 const typed=(r:DesignRoute)=>({...r,traits:auditTraits(palette,r,a.target)});
 const shortest=[...supported].sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
 // Nearest pure paint is measured in the scoring color space, not screen distance.
 const closestBase=PLAY_LEVELS[palette].paints.map((p,i)=>({i,d:Math.hypot(...a.target.lab.map((v,j)=>v-(pureLab(palette,i)[j])))})).sort((a,b)=>a.d-b.d)[0].i;
 const closest=supported.filter(r=>r.order[0]===closestBase).sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
 const roles={intended:typed(offered[0]),shortest:typed(shortest),closest:typed(closest)};
 const available=a.bases.filter(b=>b.routes.some(r=>experienceSupported(r)&&matches(r))).map(b=>b.base);
 const bypass=a.bases.filter(b=>b.routes.some(r=>experienceSupported(r)&&!matches(r))).map(b=>b.base);
 const resistant=available.filter(b=>!bypass.includes(b));
 const analysis:DesignAnalysis={version:'protected-7',style:interior?'interior-weave':style==='ride'?'chromatic-ride':'setup-lift',
  tolerance:LIVE_LANDING_TOLERANCE,nearestBase:a.nearest,failures:[],qualifyingBases:a.bases.map(b=>b.base),styleBases:available,
  minTravel:a.minimumTravel,travelBalance:0,robustThree:interior,search:'Every base; dense one/two-pour audit plus recipe-based three-pour witnesses. Supported alternatives retained. Sampled, not a proof.',
  bases:a.bases.map(b=>({base:b.base,fewestFound:b.fewest,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,minimumTravel:b.minimumTravel,qualifies:b.viable,
   routes:[...new Map([...Object.values(roles).filter(r=>r.order[0]===b.base),...b.routes.filter(experienceSupported).sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,3)].map(r=>[JSON.stringify([r.order,r.times]),r])).values()]}))};
 const stage:number=holes.filter(h=>h.levelIndex===palette).length,r=roles.intended,fewest=Math.min(...a.bases.map(b=>b.fewest!));
 const brief=interior?'Three meaningful additions found from every base; no one- or two-addition shortcut found.':`${available.length}/${a.bases.length} starts offer this style; ${resistant.length}/${a.bases.length} preserve it across retained supported efficient alternatives. Other styles remain legitimate.`;
 holes.push({sourceId,levelIndex:palette,stage,focus:interior?'interior-weave':style==='ride'?'chromatic-ride':'setup-lift',label,emphasis,brief,analysis,roles,
  coverage:{availableBases:available,robustBases:resistant,bypassBases:bypass,availableRatio:available.length/a.bases.length,robustRatio:resistant.length/a.bases.length,eligible:resistant.length===a.bases.length,failures:resistant.length===a.bases.length?[]:['style-bypass-remains']},
  record:{id:`lab-7-${palette}-${stage}-${createHash('sha256').update(sourceId).digest('hex').slice(0,12)}`,target:recipe,recipe:r.recipe,order:r.order,times:r.times,par:playerPar(fewest,r.window,style==='ride'?.4:.8),timingWindow:r.window,solutionShots:fewest,kind:style}});
 console.log(label,PLAY_LEVELS[palette].name,brief);
}
// Keep provenance and old rounds immutable; player replays refer to exact IDs.
const output={version:'lab-7',seed:20261108,signature:paletteSignature(21),selection:'Combined frozen interior, bidirectional shift and ride candidates. Not winners of the subsequent adaptive palette search.',holes};
const path='app/generated/play-lab-round7.json';
if(existsSync(path)&&JSON.stringify(JSON.parse(readFileSync(path,'utf8')))!==JSON.stringify(output))throw new Error('Immutable round 7 already exists');
writeFileSync(path,JSON.stringify(output));

import {mixtureColor} from '../app/play-engine';
function pureLab(palette:number,i:number){const paints=PLAY_LEVELS[palette].paints;return mixtureColor(paints,paints.map((_,j)=>+(i===j))).lab;}
