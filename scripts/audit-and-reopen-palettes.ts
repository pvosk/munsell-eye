import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PAINTS} from '../app/paint-mixing';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {makeAtlas,routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {analyzeAudit,auditTraits,AUDIT_STYLES,AUDIT_VERSION,type AuditStyle,type AuditedHole} from '../app/play-route-audit';
import {discoveryRecipes,type PaletteTrial} from './discover-play-palettes';
import old from '../docs/play-focused-discovery.json';
import bank from '../app/generated/play-lab-round5.json';

const IDS=['titanium-white','cadmium-lemon','yellow-ochre','cadmium-orange','transparent-orange','cadmium-red-light','quinacridone-magenta','alizarin-crimson','dioxazine-purple','ultramarine-blue','cobalt-blue','cerulean-blue','cobalt-teal','phthalo-blue-green','phthalo-green-yellow','viridian','permanent-green-light','burnt-sienna','ivory-black','cadmium-red-medium'];
const dist=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function reopenedShortlist(){
  const pool=IDS.map(id=>{const p=PAINTS.find(p=>p.id===id);if(!p)throw new Error(id);return p;});
  const pairs=new Map<string,number[]>();
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++){
    const path=Array.from({length:41},(_,i)=>mixtureColor([pool[a],pool[b]],[40-i,i]));
    const cs=path.map(p=>Math.hypot(...p.lab.slice(1)));let travel=0,colored=0;
    for(let i=1;i<path.length;i++){const length=dist(path[i].position,path[i-1].position);travel+=length;if(Math.min(cs[i],cs[i-1])>=.06)colored+=length;}
    const lift=Math.abs(path[0].lab[0]-path.at(-1)!.lab[0]);
    const dip=Math.max(0,Math.min(cs[0],cs.at(-1)!)-Math.min(...cs));
    pairs.set(`${a}-${b}`,[colored,travel*lift,travel*dip]);
  }
  const key=(p:PaletteTrial)=>p.paints.map(p=>p.id).sort().join('|');
  const previous=new Set([...old.training.map(e=>key(e.trial as PaletteTrial)),...PLAY_LEVELS.map(l=>l.paints.map(p=>p.id).sort().join('|'))]);
  const candidates:PaletteTrial[]=[];
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++){
    const ids=[a,b,c,d],paints=ids.map(i=>pool[i]);
    const pair=(i:number,j:number,s:number)=>pairs.get(`${Math.min(i,j)}-${Math.max(i,j)}`)![s];
    const weakest=(s:number)=>Math.min(...ids.map(i=>ids.filter(j=>j!==i).map(j=>pair(i,j,s)).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0)));
    const sorted=ids.flatMap((i,n)=>ids.slice(n+1).map(j=>pair(i,j,2))).sort((a,b)=>b-a);
    // Counterpart coverage plus two chroma-reducing interactions. A proxy only;
    // neutral paints are not automatically excluded from opposing searches.
    candidates.push({id:`reopen-${ids.join('-')}`,paints,control:false,proxy:[weakest(0),weakest(1),(sorted[0]+sorted[1])*Math.max(1,weakest(1))**.25]});
  }
  const selected:PaletteTrial[]=[];
  // Explicit strata fix the earlier proxy's silent exclusion of white/black.
  for(let family=0;family<3;family++)for(const stratum of ['colored','white','black','colored'] as const){
    const match=(p:PaletteTrial)=>stratum==='colored'?p.paints.every(p=>!['White','Black'].includes(p.category)):
      stratum==='white'?p.paints.some(p=>p.category==='White')&&!p.paints.some(p=>p.category==='Black'):
      p.paints.some(p=>p.category==='Black')&&!p.paints.some(p=>p.category==='White');
    const next=[...candidates].filter(p=>match(p)&&!previous.has(key(p))&&!selected.some(s=>key(s)===key(p)))
      .sort((a,b)=>b.proxy[family]-a.proxy[family]).find(p=>!selected.some(s=>s.paints.filter(x=>p.paints.some(y=>x.id===y.id)).length>2));
    if(next)selected.push(next);
  }
  return {pool:IDS,combinations:candidates.length,trials:selected};
}
type TargetSummary={recipe:number[];lab:number[];fewest:(number|null)[];failures:string[];available:Record<AuditStyle,number>;robust:Record<AuditStyle,number>;eligible:AuditStyle[]};
type Evaluation={trial:PaletteTrial;seed:number;repeats:number;seconds:number;tested:number;allBase:number;styles:Record<AuditStyle,{available:number;robust:number;distinct:number}>;distinctTargets:number;valueSpan:number;chromaSpan:number;valueBins:string[];chromaBins:string[];additionCounts:number[];targets:TargetSummary[];examples:AuditedHole[]};
function separated<T>(items:T[],point:(t:T)=>readonly number[],limit=Infinity){const kept:T[]=[];for(const item of items){if(kept.every(k=>dist(point(k),point(item))>=2*LIVE_LANDING_TOLERANCE))kept.push(item);if(kept.length>=limit)break;}return kept;}
export function evaluateReopened(trial:PaletteTrial,seed:number,repeats:number):Evaluation{
  const started=performance.now(),p=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:trial.id,subtitle:'Offline audit only',paints:trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  try{
    const atlas=makeAtlas(p,128,24),targets:TargetSummary[]=[],examples:AuditedHole[]=[];
    for(const recipe of discoveryRecipes(seed,repeats)){
      const a=analyzeAudit(p,recipe,atlas),eligible=AUDIT_STYLES.filter(s=>a.styles[s].eligible);
      targets.push({recipe,lab:a.target.lab,fewest:a.bases.map(b=>b.fewest),failures:a.failures,
        available:Object.fromEntries(AUDIT_STYLES.map(s=>[s,a.styles[s].availableRatio])) as Record<AuditStyle,number>,
        robust:Object.fromEntries(AUDIT_STYLES.map(s=>[s,a.styles[s].robustRatio])) as Record<AuditStyle,number>,eligible});
      // Save exact playable witnesses for each trait without making a live bank.
      if(eligible.some(s=>examples.filter(e=>e.styles[s].eligible).length<2)&&examples.every(e=>colorDistance(e.target,a.target)>=2*LIVE_LANDING_TOLERANCE))examples.push(a);
    }
    const useful=targets.filter(t=>t.eligible.length),values=useful.map(t=>t.lab[0]),chromas=useful.map(t=>Math.hypot(...t.lab.slice(1)));
    return {trial,seed,repeats,seconds:(performance.now()-started)/1000,tested:targets.length,allBase:targets.filter(t=>!t.failures.length).length,
      styles:Object.fromEntries(AUDIT_STYLES.map(s=>[s,{
        available:targets.filter(t=>!t.failures.length&&t.available[s]>=.5&&(s==='chromatic-ride'?Math.hypot(...t.lab.slice(1))>=.07:!t.fewest.includes(1))).length,
        robust:targets.filter(t=>t.eligible.includes(s)).length,
        distinct:separated(targets.filter(t=>t.eligible.includes(s)),t=>t.lab).length}])) as Evaluation['styles'],
      distinctTargets:separated(useful,t=>t.lab).length,
      valueSpan:values.length?Math.max(...values)-Math.min(...values):0,chromaSpan:chromas.length?Math.max(...chromas)-Math.min(...chromas):0,
      valueBins:[...new Set(values.map(v=>v<.45?'low':v<.7?'middle':'high'))],chromaBins:[...new Set(chromas.map(c=>c<.05?'quiet':c<.12?'moderate':'chromatic'))],
      additionCounts:[...new Set(useful.flatMap(t=>t.fewest.filter((n):n is number=>n!==null)))].sort(),targets,examples};
  }finally{PLAY_LEVELS.splice(p,1);}
}
async function main(){
  const start=performance.now();mkdirSync('docs',{recursive:true});const cache='/tmp/chroma-route-audit-3';mkdirSync(cache,{recursive:true});
  const hash=createHash('sha256');for(const path of ['app/play-route-audit.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-course-analysis.ts','app/play-engine.ts','app/paint-mixing.ts','scripts/discover-play-palettes.ts','scripts/audit-and-reopen-palettes.ts'])hash.update(readFileSync(path));const sourceHash=hash.digest('hex');
  const run=(trial:PaletteTrial,seed:number,repeats:number):Evaluation=>{
    const path=`${cache}/${trial.id}-${seed}-${repeats}.json`,signature=sourceHash+JSON.stringify(trial.paints);
    if(existsSync(path)){const cached=JSON.parse(readFileSync(path,'utf8'));if(cached.signature===signature)return cached.result;}
    const result=evaluateReopened(trial,seed,repeats);writeFileSync(path,JSON.stringify({signature,result}));return result;
  };
  const log=(label:string,e:Evaluation)=>console.log(`${label} ${e.trial.id}: ${e.distinctTargets} distinct; ${AUDIT_STYLES.map(s=>`${s} ${e.styles[s].available} available/${e.styles[s].robust} robust`).join('; ')} (${e.seconds.toFixed(1)}s)`);
  const fixed=bank.holes.map(h=>{
    const audit=analyzeAudit(h.levelIndex,h.record.target,makeAtlas(h.levelIndex,256,48));
    console.log(`FIXED ${h.record.id}: ${h.focus} available ${audit.styles[h.focus as AuditStyle].availableRatio}, robust ${audit.styles[h.focus as AuditStyle].robustRatio}`);
    return {id:h.record.id,palette:PLAY_LEVELS[h.levelIndex].name,levelIndex:h.levelIndex,focus:h.focus,oldCoverage:h.coverage,oldFeaturedAdditions:h.record.times.length,oldGlobalFewest:h.record.solutionShots,audit};
  });
  // Same order, different dose semantics: actual Orange Echo observation.
  const orange=bank.holes.find(h=>h.record.id==='lab-5-17-1-b46b6def6b93')!;
  const target=mixtureColor(PLAY_LEVELS[17].paints,orange.record.target);
  const player=measureDesignRoute(17,routeDetails(17,[0,2,1],[.788,.338],target,LIVE_LANDING_TOLERANCE),target,true,LIVE_LANDING_TOLERANCE);
  const regression={order:player.order,times:player.times,normalizedError:player.error/LIVE_LANDING_TOLERANCE,traits:auditTraits(17,player,target),meaningfulPours:player.meaningfulPours,finishWindowMs:player.finishWindowMs,setup:player.setup};
  writeFileSync('docs/play-route-audit-fixed.json',JSON.stringify({version:AUDIT_VERSION,sourceHash,fixed,regression},null,2));
  const oldCohort:Evaluation[]=[];
  for(const e of old.training){const result=run(e.trial as PaletteTrial,20260925,1);oldCohort.push(result);log('SAME COHORT',result);}
  const selection=reopenedShortlist(),newCohort:Evaluation[]=[];
  console.log(`REOPEN: ${selection.combinations} four-paint combinations; ${selection.trials.length} new full-search candidates.`);
  for(const trial of selection.trials){const result=run(trial,20260925,1);newCohort.push(result);log('NEW',result);}
  // Freeze specialists and broad-course candidates before fresh targets.
  const all=[...oldCohort,...newCohort],finalistIds=new Set<string>();
  for(const style of AUDIT_STYLES){
    const ranked=[...all].filter(e=>e.styles[style].robust>0).sort((a,b)=>b.styles[style].distinct-a.styles[style].distinct||b.styles[style].robust-a.styles[style].robust);
    if(ranked[0])finalistIds.add(ranked[0].trial.id);
  }
  const broad=[...all].sort((a,b)=>b.distinctTargets-a.distinctTargets||b.valueSpan-a.valueSpan);
  for(const e of broad.slice(0,2))finalistIds.add(e.trial.id);
  // Current favorites are controls, not mandatory winners. Test them on the
  // same fresh cohort as any new finalists, even when training ranks them low.
  const benchmarkIds=['focused-2-3-10-12','focused-1-6-7-11','focused-3-4-9-16','focused-1-5-8-10','control-Secondaries','control-Zorny','control-Cobalt Ember'];
  const holdout:Evaluation[]=[];
  writeFileSync('docs/play-route-audit-selection.json',JSON.stringify({sourceHash,finalists:[...finalistIds],benchmarkIds,seed:20270317},null,2));
  for(const e of all.filter(e=>finalistIds.has(e.trial.id)||benchmarkIds.includes(e.trial.id))){const result=run(e.trial,20270317,2);holdout.push(result);log('FRESH',result);}
  const report={version:AUDIT_VERSION,sourceHash,tolerance:LIVE_LANDING_TOLERANCE,seconds:(performance.now()-start)/1000,selection,finalists:[...finalistIds],oldCohort,newCohort,holdout};
  writeFileSync('docs/play-route-audit-discovery.json',JSON.stringify(report,null,2));
  const name=(e:Evaluation)=>e.trial.id.startsWith('control-')?e.trial.id.slice(8):e.trial.paints.map(p=>p.name).join(' / ');
  const lines=['# Route audit and reopened palette search','',`Offline ${AUDIT_VERSION}. Runtime ${report.seconds.toFixed(1)} s. No live bank, par, tolerance, paint definition, animation or deployment changed.`,
    '', '## Fixed-target regression','',
    'The eight v52 targets were reexamined unchanged with a 257-sample one-pour / 49×49 two-pour atlas. Dose variants are retained within each paint order. Available coverage means a supported efficient style route exists. Robust coverage means no supported equally shot-efficient non-style variant was found from that base. These are sampled findings, not proofs.',
    '', '| Palette / hole | Intended style | Available starts | Robust starts | Featured / fewest additions |','|---|---|---:|---:|---:|',
    ...fixed.map(h=>`| ${h.palette} ${h.id.split('-')[3]} | ${h.focus} | ${h.audit.styles[h.focus as AuditStyle].availableBases.length}/4 | ${h.audit.styles[h.focus as AuditStyle].robustBases.length}/4 | ${h.oldFeaturedAdditions} / ${h.audit.globalFewest} |`),
    '', `The observed Orange Echo shortcut replays at ${regression.normalizedError.toFixed(3)} scoring tolerances, with ${regression.meaningfulPours} meaningful addition, a ${regression.finishWindowMs.toFixed(0)} ms finishing window, and no opposing-color trait. It is the same paint order as the featured example but different doses. The independent search now retains non-style bypass evidence instead of suppressing it.`,
    '', '## Same training targets, corrected competition','',
    'All 16 previously inspected palettes were rerun on the exact same 24 recipe targets (seed 20260925). The entries below are old accepted counts → new robust counts. Policies differ intentionally; this is not a randomized comparison of palette quality.',
    '', '| Palette | Ride | Value–color balance | Opposing colors |','|---|---:|---:|---:|',
    ...oldCohort.map(e=>{const prior=old.training.find(x=>x.trial.id===e.trial.id)!;return `| ${name(e)} | ${(['chromatic-ride','value-hue-balance','opposing-colors'] as const).map(s=>`${prior.results.find(r=>r.focus===s)!.passes} → ${e.styles[s].robust}`).join(' | ')} |`;}),
    '', '## Fresh-target course potential','',
    `A ${selection.pool.length}-paint pool supplied ${selection.combinations} combinations for cheap pair screening. ${selection.trials.length} new combinations received full route analysis, explicitly including white, black and all-colored groups. Previous finalists were not locked in. New and old candidates shared the training recipe cohort; finalists were frozen before 48 fresh targets (seed 20270317). Current favorites and historical controls also received those fresh targets.`,
    '', '| Palette | Ride | Lift | Value–color balance | Opposing | Interior | Distinct useful targets | Value / chroma zones |','|---|---:|---:|---:|---:|---:|---:|---|',
    ...holdout.map(e=>`| ${name(e)} | ${AUDIT_STYLES.map(s=>e.styles[s].robust).join(' | ')} | ${e.distinctTargets}/48 | ${e.valueBins.join(', ')} / ${e.chromaBins.join(', ')} |`),
    '', '## Interpretation and limitations','',
    '- All-base viability is separate from style. A hole must offer a supported meaningful route from every base; at least half the starts must resist sampled non-style shortcuts for a style to pass. Non-ride styles also reject any found one-addition solution. Substantial one-addition rides remain valid.',
    '- Every equally short successful route is eligible to expose a bypass, even if its correction is too small to count as a meaningful decision. Style support requires 55 ms finishing width and at least 4% sampled local setup coverage. These are provisional filters, not validated player difficulty thresholds. Robust does not mean mathematically unavoidable.',
    '- The audit samples successful dose regions, not only closest-to-center solutions. It does not exhaust continuous times. One/two-pour search covers all orders; three-pour solutions still come from legal generating-recipe permutations, so missing three-pour alternatives remain a limitation.',
    '- Distinct targets are a deterministic greedy subset separated by two scoring tolerances. Style totals overlap: never sum columns as independent holes. Value bins use Oklab L < .45 / .45–.70 / ≥ .70; chroma bins use < .05 / .05–.12 / ≥ .12. These are analysis bins, not Munsell labels.',
    '- More accepted targets do not establish a better course. The table separately shows style yield, target separation, value/chroma breadth and all-base addition counts in the JSON. It does not measure emotional quality, camera quality or actual difficulty. A specialist can be excellent with a narrow range.',
    '- This is a bounded 20-paint, four-paint-palette search, not an optimum over every pigment or palette size. French Light’s eight-paint problem is outside this comparison. Pigment behavior remains the existing spectral approximation from stored colors and tinting strengths, not measured brand spectra.',
    '- Exact targets, paint definitions, route witnesses, seeds and a source hash are saved alongside this report. The saved public lab is unchanged. A future course builder must explicitly consume the new audit; historical bank labels are not silently rewritten.',
    ''];
  writeFileSync('docs/play-route-audit-discovery.md',lines.join('\n'));
  console.log(`DONE ${report.seconds.toFixed(1)} seconds. Offline report saved.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
