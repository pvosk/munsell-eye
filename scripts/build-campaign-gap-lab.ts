import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PLAY_LEVELS,neutralStart,LIVE_LANDING_TOLERANCE,colorDistance,mixtureColor} from '../app/play-engine';
import {replayRoute,playerPar,PROFILES} from '../app/play-course-analysis';
import {experienceSupported} from '../app/play-experience-audit';
const directory=process.argv[2];if(!directory)throw Error('Supply candidate-search archive directory.');
const load=(file:string)=>JSON.parse(readFileSync(`${directory}/${file}`,'utf8'));
const bank=load('campaign-gap-bank.json'),initial=load('results.json'),follow=load('followup-results.json'),remaining=load('remaining/results.json');
const audits=new Map<string,any>();
for(const c of [...initial.rows.flatMap((r:any)=>r.finalists),...follow.extra,...follow.dense,...remaining.rows.flatMap((r:any)=>r.finalists),...load('remaining/french-check.json').results,...load('remaining/style-check.json').rows.flatMap((r:any)=>r.finalists)])audits.set(c.id,c.audit);
const notes:Record<string,string>={
 'maroon-simple-303':'Rosy chromatic contrast. Simpler routes exist; judge whether the shorter travel feels satisfying.',
 'zorn-cool-1045':'Cool and mute a warm mixture with black—not a blue target. Some starting paints take simpler routes.',
 'zorn-finish-1484':'Three meaningful additions found from every base. Borderline protection: two-addition near-misses are about 1.09 tolerances away, short of the stricter 1.10 safety margin.',
 'ryb-cool-849':'Cool chromatic contrast, far from the pure paints. One-addition solutions exist from white and phthalo.',
 'ryb-dark-827':'Darker setup challenge: three additions from white, two from the other bases. Finishing windows can be demanding.',
 'orange-gap-1253':'Two additions found from every base; balance opportunities from all four. Not every efficient route requires that style.',
 'orange-gap-284':'Alternate for the same slot, not another course hole: very similar target, somewhat wider finish windows.',
 'cmy-ride-2106':'Efficient rides found from cyan and yellow; magenta can avoid the ride. Warmer target, less hue contrast with the existing ride.',
 'cmy-contrast-423':'Greener contrast and greater distance from every pure paint; efficient ride found from only one starting paint.',
 'cmy-ride-1482':'Golden ride alternative from cyan and magenta. Yellow has a narrow one-addition shortcut and a supported longer route.',
 'sienna-contrast-369':'Two additions from every base; another quiet green with a smaller visual contrast than ideal.',
 'sienna-warm-2363':'Experimental warm contrast. Fails the meaningful-pour safeguard: an efficient route includes a token-sized adjustment. Retained for comparison, not rated robust.',
 'maroon-arc-warm-1163':'Dark inward counterpart to the green ride. Two additions from every base, balance opportunities from all four.',
 'maroon-arc-finish-1612':'Muted yellow-earth finish; two additions from every base. Chosen for contrast and tighter finishing, not a higher minimum shot count.',
 'teal-intro-59':'Coral contrast to the inward anchor. Two additions from every base, with comparatively comfortable finish examples.',
 'french-studio-1721':'Broad-choice green: four starts have two-addition solutions, four have three. All eight have supported routes. Judge the paint-selection problem.',
 'french-studio-158':'Rose-gray alternative: five starts have two-addition solutions, three have three. All eight have supported routes.',
 'cobalt-intro-1198':'Chromatic pink-purple introduction before the neutral setups. Shorter approaches from some paints are expected.',
};
let checks=0;
const additions=bank.gaps.map((gap:any)=>{
 const stage=Number(gap.slotId.split('-').at(-1));
 const options=gap.candidates.map((c:any,index:number)=>{
  const a=audits.get(c.id);assert.ok(a,c.id);assert.equal(a.palette,gap.levelIndex);
  const supported=a.bases.flatMap((b:any)=>b.routes.filter(experienceSupported));assert.ok(supported.length);
  const candidates=supported.filter((r:any)=>r.efficient),style=gap.proposedStyle;
  const ordered=[...candidates.length?candidates:supported].sort((r:any,s:any)=>Number(!!s.traits[style])-Number(!!r.traits[style])||r.times.length-s.times.length||s.finishWindowMs-r.finishWindowMs);
  const cooling=c.cooling?.examples?.find((r:any)=>r.efficient);
  const featured=cooling? supported.find((r:any)=>r.order.join()===cooling.order.join()&&r.times.every((v:number,j:number)=>v===cooling.times[j]))??ordered[0]:ordered[0];
  const id=index===0?gap.slotId:`${gap.slotId}-alt-${c.id}`;
  const minimum=Math.min(...a.bases.map((b:any)=>b.fewest??Infinity));
  const hole={seed:2026091100+bank.gaps.indexOf(gap)*10+index,stage,start:neutralStart(PLAY_LEVELS[gap.levelIndex]),target:c.target,notation:c.notation,par:playerPar(minimum,featured.window,PROFILES[gap.levelIndex]?.challenge??.5),recipe:c.recipe,tolerance:LIVE_LANDING_TOLERANCE,timingWindow:featured.window,courseId:id,kind:style??'choice',solutionShots:minimum,routeOrder:featured.order,routeTimes:featured.times};
  assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[gap.levelIndex].paints,replayRoute(gap.levelIndex,hole.routeOrder,hole.routeTimes)),hole.target)<=hole.tolerance+1e-8);
  const bases=a.bases.map((b:any)=>{
   const supported=b.routes.filter(experienceSupported),fewestSupported=supported.length?Math.min(...supported.map((r:any)=>r.times.length)):null;
   const widest=[...supported].filter((r:any)=>r.times.length===fewestSupported).sort((a:any,b:any)=>b.finishWindowMs-a.finishWindowMs)[0];
   const shortest=[...b.routes].sort((a:any,b:any)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
   const styled=supported.find((r:any)=>r.efficient&&r.traits[style]);
   const routes=[...new Set([shortest,widest,styled,featured.order[0]===b.base?featured:null].filter(Boolean))].map((r:any)=>{
    assert.ok(colorDistance(mixtureColor(PLAY_LEVELS[gap.levelIndex].paints,replayRoute(gap.levelIndex,r.order,r.times)),hole.target)<=hole.tolerance+1e-8);checks++;
    const {order,times,recipe,error,window,length,lastLength,valueChange,minChroma,pourLengths,meaningfulPours,finishValue,finishHueChroma,chromaReduction,anticipatory,styles,finishWindowMs,setup}=r;
    return {order,times,recipe,error,window,length,lastLength,valueChange,minChroma,pourLengths,meaningfulPours,finishValue,finishHueChroma,chromaReduction,anticipatory,styles,finishWindowMs,setup};
   });
   return {base:b.base,fewestFound:b.fewest,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,minimumTravel:b.approach.minTravel,routes,qualifies:b.viable};
  });
  const analysis={version:a.version,search:c.resolution,style:'precision-approach',tolerance:LIVE_LANDING_TOLERANCE,failures:a.failures,bases,qualifyingBases:bases.filter((b:any)=>b.qualifies).map((b:any)=>b.base),robustThree:a.styles.interior.allResistant,minTravel:a.minTravel,travelBalance:0};
  return {id,sourceId:c.id,note:notes[c.id]??`Alternative target for this slot. ${a.failures.length?'Caution: '+a.failures.join(', ')+'.':'Supported routes found from every base; style and difficulty can differ by start.'}`,specimen:{levelIndex:gap.levelIndex,hole},analysis};
 });
 return {slotId:gap.slotId,primary:options[0],alternatives:options.slice(1)};
});
writeFileSync('app/generated/play-campaign-additions.json',JSON.stringify({version:'campaign-gap-reserve-2',sourceHash:bank.sourceHash,additions})+'\n');
console.log(`Added ${additions.length} primary candidates and ${additions.reduce((n:number,g:any)=>n+g.alternatives.length,0)} alternatives; ${checks} comparison routes verified.`);
