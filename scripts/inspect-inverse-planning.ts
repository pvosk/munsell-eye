// Bounded, paired target study. No runtime changes and no classifier retuning.
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {INVERSE_POLICY,inverseRoutes,exactRecipeRoutes,normalizeRecipe,type PlannedRoute} from '../app/play-inverse-planning';
import {routeDetails,makeAtlas} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {sampleJourney,finishEpisode,measureJourney,analyzeJourney,JOURNEY_POLICY,type JourneyAudit,type JourneyStyle} from '../app/play-journey-analysis';
import {finishProfile} from '../app/play-finish-profile';
import {measureSetup} from '../app/play-route-analysis';
import {experienceSupported} from '../app/play-experience-audit';

export const PROTOCOL={version:'inverse-paired-1',seeds:[1109261,1109262],
 palettes:['UltraOx Dual','Zorny','CMY','Secondaries','Maroon Arc','Cobalt Ember'],
 targetsPerSeed:2,styles:['ride','value-shift'] as const,perBaseWitnessChecks:2,
 screen:[128,24],dense:[512,96],densePerStyle:2,
 comparator:'Exact generating-recipe permutations (existing witnessRoutes behavior), not a full search ablation',
 note:'Same independently generated target pool. Unequal proposal compute is timed. Audit sees only fixed target recipe, never the proposed witness. No new palette or gameplay changes.'};
const signature=JSON.stringify(PLAY_LEVELS),started=performance.now();
const files=['app/play-engine.ts','app/paint-mixing.ts','app/play-inverse-planning.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','app/play-finish-profile.ts','scripts/inspect-inverse-planning.ts'];
const sourceHash=createHash('sha256').update(files.map(p=>readFileSync(p)).join('\n')).digest('hex');
const randomFor=(seed:number)=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};
type Style=typeof PROTOCOL.styles[number];
const methods=['exact-recipe','inverse-region'] as const;
function shortlist(palette:number,routes:PlannedRoute[],target:ReturnType<typeof mixtureColor>){
 const quick=routes.filter(r=>r.times.length>0).map(r=>{
  const {strokes}=sampleJourney(palette,r),finish=finishEpisode(strokes,target);
  const total=strokes.reduce((a,s)=>a+s.length,0),chromatic=strokes.reduce((a,s)=>a+s.chromaticLength,0);
  const ride=Math.max(0,...strokes.filter(s=>s.length&&s.chromaticLength/s.length>=.8).map(s=>s.length));
  const value=finishProfile(strokes,finish,strokes.filter(s=>s.length>=3).length);
  return {r,ride,finish,value,eligible:{ride:ride>=36&&chromatic/Math.max(1e-9,total)>=.8,'value-shift':value.valueLed}};
 });
 const result={} as Record<Style,{bases:number[];witnesses:ReturnType<typeof measureJourney>[]} >;
 for(const style of PROTOCOL.styles){
  const witnesses:ReturnType<typeof measureJourney>[]=[];
  for(let base=0;base<PLAY_LEVELS[palette].paints.length;base++){
   const pool=quick.filter(q=>q.r.order[0]===base&&q.eligible[style]);
   pool.sort((a,b)=>a.r.times.length-b.r.times.length||(style==='ride'?b.ride-a.ride:Math.abs(b.value.deltaL)-Math.abs(a.value.deltaL)));
   for(const q of pool.slice(0,PROTOCOL.perBaseWitnessChecks)){
    const measured=measureJourney(palette,measureDesignRoute(palette,routeDetails(palette,q.r.order,q.r.times,target,LIVE_LANDING_TOLERANCE),target,false,LIVE_LANDING_TOLERANCE),target);
    if(!measured.traits[style]||measured.finishWindowMs<55)continue;
    if(measured.times.length>1)measured.setup=measureSetup(palette,measured,target,LIVE_LANDING_TOLERANCE);
    if(experienceSupported(measured)){witnesses.push(measured);break;}
   }
  }
  result[style]={bases:witnesses.map(w=>w.order[0]),witnesses};
 }
 return result;
}
type Findings=ReturnType<typeof shortlist>;
type ProposalResult={routeCount:number;ms:number;endpointRecipes?:number;findings:Findings};
type Row={id:string;palette:number;name:string;seed:number;recipe:number[];target:ReturnType<typeof mixtureColor>;nearestBase:number;methods:Record<typeof methods[number],ProposalResult>};
const rows:Row[]=[];
mkdirSync('outputs/inverse-planning',{recursive:true});
for(const name of PROTOCOL.palettes){
 const palette=PLAY_LEVELS.findIndex(p=>p.name===name);if(palette<0)throw Error('Missing palette '+name);
 for(const seed of PROTOCOL.seeds){
  const random=randomFor(seed+palette*7919),indices=PLAY_LEVELS[palette].paints.map((_,i)=>i);
  for(let i=indices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
  for(let t=0;t<PROTOCOL.targetsPerSeed;t++){
   const recipe=normalizeRecipe(indices.map((_,i)=>t===0&&!indices.slice(0,2).includes(i)?0:Math.exp((random()-.5)*3)));
   const target=mixtureColor(PLAY_LEVELS[palette].paints,recipe),id=`ip-${palette}-${seed}-${t}`;
   const baselineStart=performance.now(),baseline=exactRecipeRoutes(palette,recipe,target),baselineFindings=shortlist(palette,baseline,target),baselineMs=performance.now()-baselineStart;
   const inverseStart=performance.now(),inverse=inverseRoutes(palette,recipe,seed+t),inverseFindings=shortlist(palette,inverse.routes,target);
   // Augment known valid evidence rather than allowing a bounded shortlist to
   // crowd out already-verified exact-recipe witnesses. Charge their cost too.
   for(const style of PROTOCOL.styles)for(const witness of baselineFindings[style].witnesses){
    if(!inverseFindings[style].bases.includes(witness.order[0])){
     inverseFindings[style].bases.push(witness.order[0]);inverseFindings[style].witnesses.push(witness);
    }
   }
   const inverseMs=performance.now()-inverseStart+baselineMs;
   const row={id,palette,name,seed,recipe,target,nearestBase:Math.min(...PLAY_LEVELS[palette].paints.map((_,i)=>colorDistance(mixtureColor(PLAY_LEVELS[palette].paints,recipe.map((_,j)=>+(i===j))),target)/LIVE_LANDING_TOLERANCE)),
    methods:{'exact-recipe':{routeCount:baseline.length,ms:baselineMs,findings:baselineFindings},'inverse-region':{routeCount:inverse.routes.length,ms:inverseMs,endpointRecipes:inverse.endpoints,findings:inverseFindings}}};
   rows.push(row);console.log('PROPOSE',name,seed,t,JSON.stringify(Object.fromEntries(methods.map(m=>[m,PROTOCOL.styles.map(s=>row.methods[m].findings[s].bases.length)]))));
   writeFileSync('outputs/inverse-planning/proposals.json',JSON.stringify({sourceHash,protocol:PROTOCOL,rows}));
  }
 }
}
const selections:{palette:number;method:typeof methods[number];style:Style;id:string|null}[]=[];
for(const name of PROTOCOL.palettes)for(const method of methods)for(const style of PROTOCOL.styles){
 const available=rows.filter(r=>r.name===name&&r.methods[method].findings[style].bases.length>0);
 available.sort((a,b)=>b.methods[method].findings[style].bases.length-a.methods[method].findings[style].bases.length||b.nearestBase-a.nearestBase||a.id.localeCompare(b.id));
 selections.push({palette:PLAY_LEVELS.findIndex(p=>p.name===name),method,style,id:available[0]?.id??null});
}
const audits=new Map<string,JourneyAudit>();
const compact=(a:JourneyAudit)=>({version:a.version,failures:a.failures,styles:a.styles,minTravel:a.minTravel,
 bases:a.bases.map(b=>({base:b.base,fewest:b.fewest,startDistance:b.startDistance,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,viable:b.viable,approach:b.approach}))});
for(const name of PROTOCOL.palettes){
 const selected=rows.filter(r=>r.name===name&&selections.some(s=>s.id===r.id));if(!selected.length)continue;
 const atlas=makeAtlas(selected[0].palette,...PROTOCOL.screen as [number,number]);
 for(const row of selected){const a=analyzeJourney(row.palette,row.recipe,atlas);audits.set(row.id,a);
  console.log('AUDIT',name,row.id,JSON.stringify({failures:a.failures,ride:a.styles.ride,shift:a.styles['value-shift']}));
  writeFileSync('outputs/inverse-planning/audits.json',JSON.stringify([...audits.entries()]));
 }
}
const dense:{id:string;styles:Style[];audit:ReturnType<typeof compact>}[]=[];
for(const style of PROTOCOL.styles){
 const eligible=rows.filter(r=>audits.get(r.id)?.styles[style].eligible);
 eligible.sort((a,b)=>audits.get(b.id)!.styles[style].resistant.length/PLAY_LEVELS[b.palette].paints.length-audits.get(a.id)!.styles[style].resistant.length/PLAY_LEVELS[a.palette].paints.length||audits.get(b.id)!.minTravel-audits.get(a.id)!.minTravel);
 for(const row of eligible.slice(0,PROTOCOL.densePerStyle)){
  const existing=dense.find(d=>d.id===row.id);if(existing){existing.styles.push(style);continue;}
  const a=analyzeJourney(row.palette,row.recipe,makeAtlas(row.palette,...PROTOCOL.dense as [number,number]),1109277);
  dense.push({id:row.id,styles:[style],audit:compact(a)});audits.set(row.id,a);
  console.log('DENSE',row.name,style,JSON.stringify({failures:a.failures,ride:a.styles.ride,shift:a.styles['value-shift']}));
 }
}
if(signature!==JSON.stringify(PLAY_LEVELS))throw Error('Palette mutation');
const summary=Object.fromEntries(methods.map(method=>[method,{proposalMs:rows.reduce((n,r)=>n+r.methods[method].ms,0),
 styles:Object.fromEntries(PROTOCOL.styles.map(style=>[style,{targetsWithSupportedWitness:rows.filter(r=>r.methods[method].findings[style].bases.length).length,
  targetsWithWitnessFromEveryBase:rows.filter(r=>r.methods[method].findings[style].bases.length===PLAY_LEVELS[r.palette].paints.length).length,
  selected:selections.filter(s=>s.method===method&&s.style===style&&s.id).length,
  independentlyEligible:selections.filter(s=>s.method===method&&s.style===style&&s.id&&audits.get(s.id)?.styles[style].eligible).length,
  independentlyAllResistant:selections.filter(s=>s.method===method&&s.style===style&&s.id&&audits.get(s.id)?.styles[style].allResistant).length}]))} ]));
const result={sourceHash,protocol:PROTOCOL,inversePolicy:INVERSE_POLICY,journeyPolicy:JOURNEY_POLICY,seconds:(performance.now()-started)/1000,summary,selections,
 rows:rows.map(r=>({...r,audit:audits.has(r.id)?compact(audits.get(r.id)!):null})),dense,
 limitations:['Fixed 24-target pilot, not a global palette search or proof. Fresh seeds, established palettes.',
 'Exact-recipe baseline isolates endpoint-region/predecessor expansion; it is not a comparison with the whole existing target generator. Inverse uses more compute.',
 'Candidate support is not efficiency or style resistance. Both methods select from the same targets; independent audit never receives their witnesses.',
 'Only first connected acceptance segment per recipe ray, with bounded exact-recipe prefixes. Disconnected preimages and arbitrary repeated prefixes are not exhaustively searched.',
 'Only two candidates per style that pass screening receive dense numerical and extra three-pour verification. Other screening results stay provisional.',
 'No live game, mass, strength, controls, tolerance, par, palette, or bank changed. No player testing performed.']};
writeFileSync('docs/play-inverse-planning-results.json',JSON.stringify(result,null,2)+'\n');
console.log('SUMMARY',JSON.stringify(summary));console.log('DONE',result.seconds.toFixed(1),'seconds');
