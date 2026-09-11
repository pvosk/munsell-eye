import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,journeyLabBank,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,type PlayLevel} from '../app/play-engine';
import {paletteSignature,playerPar} from '../app/play-course-analysis';
import {experienceSupported} from '../app/play-experience-audit';
import {measureSelection,selectContrastSet,timingDemand,SELECTION_POLICY} from '../app/play-experience-selection';
import type {JourneyAudit,JourneyRoute,JourneyStyle} from '../app/play-journey-analysis';
import type {AuditRoute,AuditStyle} from '../app/play-route-audit';
import type {DesignAnalysis} from '../app/play-route-design';
type Item={id:string;recipe:number[];audit:JourneyAudit};
type Candidate=Item&{name:string;paints:PlayLevel['paints'];label:string;style:JourneyStyle;reference?:boolean};
const source=JSON.parse(readFileSync('docs/play-rides-muted-results.json','utf8')) as {rows:{palette:{id:string;paints:PlayLevel['paints']};finalists:Item[]}[]};
const exceptions=JSON.parse(readFileSync('docs/play-journey-exceptions.json','utf8')) as {checked:(Item&{palette:{paints:PlayLevel['paints']}})[]};
const ref=exceptions.checked.find(c=>c.id==='opposed-pairs-3-train-4')!;
if(!ref)throw Error('Missing reference');
const candidates=(id:string,name:string,style:JourneyStyle,label:string):Candidate[]=>source.rows.find(r=>r.palette.id===id)!.finalists.map(c=>({...c,name,style,label,paints:source.rows.find(r=>r.palette.id===id)!.palette.paints}));
PLAY_LEVELS.length=29;
const measurements=new Map<string,ReturnType<typeof measureSelection>>();
const measure=(c:Candidate)=>{
 let m=measurements.get(c.id);if(m)return m;
 const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Measurement only',subtitle:'',paints:c.paints,tolerance:LANDING_TOLERANCE});
 try{m=measureSelection({...c.audit,palette:scratch});measurements.set(c.id,m);return m;}finally{PLAY_LEVELS.pop();}
};
const selected=selectContrastSet<Candidate>([
 {style:'interior',candidates:[{...ref,name:'Teal Ember',paints:ref.palette.paints,style:'interior',label:'Interior · known-good reference',reference:true}]},
 {style:'ride',candidates:candidates('control-cmy','CMY','ride','Chromatic ride · warm target')},
 {style:'value-shift',candidates:candidates('muted-6','Sienna Field','value-shift','Value shift · muted triad')},
 {style:'ride',candidates:candidates('adjacent-1','Maroon Arc','ride','Chromatic ride · three-start opportunity')},
 {style:'value-shift',candidates:candidates('control-cmy','CMY','value-shift','Value shift · same palette, new problem')},
],measure);
const palettes:PlayLevel[]=[],holes=[];
for(const c of selected.selected){
 let levelIndex=PLAY_LEVELS.findIndex(p=>p.name===c.name);
 if(levelIndex<0){const p={name:c.name,subtitle:'Contrast lab candidate',paints:c.paints,tolerance:LANDING_TOLERANCE,labOnly:true};levelIndex=PLAY_LEVELS.length;PLAY_LEVELS.push(p);palettes.push(p);}
 if(JSON.stringify(PLAY_LEVELS[levelIndex].paints.map(p=>[p.id,p.rgb,p.strength]))!==JSON.stringify(c.paints.map(p=>[p.id,p.rgb,p.strength])))throw Error('Paint identity changed');
 const a=c.audit,m=measure(c),all=a.bases.flatMap(b=>b.routes).filter(experienceSupported),style=a.styles[c.style];
 const offered=all.filter(r=>r.efficient&&r.traits[c.style]).sort((a,b)=>c.style==='ride'?Number(timingDemand(b.finishWindowMs)==='focused')-Number(timingDemand(a.finishWindowMs)==='focused')||b.longestChromaticPour-a.longestChromaticPour:b.finishWindowMs-a.finishWindowMs);
 const typed=(r:JourneyRoute):AuditRoute=>({...r,traits:Object.entries(r.traits).filter(([,v])=>v).map(([s])=>({interior:'interior-weave',ride:'chromatic-ride','value-shift':'setup-lift',balance:'value-hue-balance'}[s])) as AuditStyle[]});
 const old=c.reference?journeyLabBank.holes.find(h=>PLAY_LEVELS[h.levelIndex].name===c.name):undefined;
 const closestBase=[...a.bases].sort((a,b)=>a.startDistance-b.startDistance)[0].base;
 const roles=old?.roles??{intended:typed(offered[0]),shortest:typed([...all].sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0]),closest:typed(all.filter(r=>r.order[0]===closestBase).sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0])};
 const analysis:DesignAnalysis={version:SELECTION_POLICY.version,style:c.style==='ride'?'chromatic-ride':c.style==='value-shift'?'setup-lift':'interior-weave',tolerance:LIVE_LANDING_TOLERANCE,nearestBase:Math.min(...a.bases.map(b=>b.startDistance)),failures:a.failures,qualifyingBases:a.bases.filter(b=>b.viable).map(b=>b.base),styleBases:style.available,minTravel:a.minTravel,travelBalance:0,robustThree:a.styles.interior.allResistant,
  search:'Archived dense competing-route checks, with selection-only spatial extent and timing preferences. Sampled, not exhaustive.',
  bases:a.bases.map(b=>({base:b.base,fewestFound:b.fewest,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,minimumTravel:b.approach.minTravel,qualifies:b.viable,routes:[...new Map([...Object.values(roles).filter(r=>r.order[0]===b.base),...b.routes.filter(experienceSupported).sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,4).map(typed)].map(r=>[JSON.stringify([r.order,r.times]),r])).values()]}))};
 const r=roles.intended,fewest=Math.min(...a.bases.map(b=>b.fewest!));const stage:number=holes.filter(h=>h.levelIndex===levelIndex).length;
 const focus=c.style==='ride'?'chromatic-ride':c.style==='value-shift'?'setup-lift':'interior-weave';
 const brief=(c.reference?'Exact target and par from your earlier Teal Ember test. ':`${style.available.length}/${a.bases.length} starts offer the intended style; ${style.resistant.length}/${a.bases.length} resist retained supported non-style alternatives. `)+`Shortest measured spatial reach across supported routes: ${m.extentFloor.toFixed(0)} world units. `+(c.style==='ride'?`Featured finish timing: ${timingDemand(r.finishWindowMs)}. This does not guarantee the same difficulty from every start.`:'Value shifts can rise or fall; the free base is not counted as a shift.');
 holes.push({sourceId:c.id,sourceRound:c.reference?'lab-8':'rides-muted-1',levelIndex,stage,focus,label:c.label,emphasis:c.style==='ride'?'experience':'flexibility',brief,analysis,roles,selectionMetrics:m,
  coverage:{availableBases:style.available,robustBases:style.resistant,bypassBases:style.bypass,availableRatio:style.available.length/a.bases.length,robustRatio:style.resistant.length/a.bases.length,eligible:style.allResistant,failures:style.allResistant?[]:['style-bypass-remains']},
  record:{id:`lab-9-${levelIndex}-${stage}-${createHash('sha256').update(c.id).digest('hex').slice(0,12)}`,target:c.recipe,recipe:r.recipe,order:r.order,times:r.times,par:old?.record.par??playerPar(fewest,r.window,c.style==='ride'?.4:.8),timingWindow:r.window,solutionShots:fewest,kind:c.style}});
 console.log(c.name,c.label,m.extentFloor.toFixed(1),r.finishWindowMs.toFixed(0),style.available.length+'/'+a.bases.length);
}
const output={version:'lab-9',seed:20261221,signature:paletteSignature(PLAY_LEVELS.length),palettes,selection:'Five contrasting tests; existing physics, timing mapping, tolerance and par formula unchanged.',policy:SELECTION_POLICY,variety:selected.variety,excluded:selected.excluded,holes};
const path='app/generated/play-lab-round9.json';if(existsSync(path)){const old=JSON.parse(readFileSync(path,'utf8'));if(old.holes.length&&JSON.stringify(old)!==JSON.stringify(output))throw Error('Immutable lab already exists');}
writeFileSync(path,JSON.stringify(output));console.log(selected.variety);
