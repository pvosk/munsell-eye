import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PAINTS} from '../app/paint-mixing';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,addPaint,chargeAmount,totalMass,type Mixture} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeDesign,matchesDesign,type DesignAnalysis,type DesignRoute} from '../app/play-route-design';
import {discoveryRecipes,allBaseEligible,type PaletteTrial} from './discover-play-palettes';

export const FOCUSES=['chromatic-ride','value-hue-balance','opposing-colors'] as const;
export type Focus=typeof FOCUSES[number];
const IDS=['titanium-white','cadmium-lemon','yellow-ochre','cadmium-orange','transparent-orange','cadmium-red-light','quinacridone-magenta','alizarin-crimson','dioxazine-purple','ultramarine-blue','cobalt-blue','cerulean-blue','cobalt-teal','phthalo-blue-green','phthalo-green-yellow','viridian','permanent-green-light','burnt-sienna'];
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const median=(a:number[])=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:0;
const supported=(r:DesignRoute)=>r.finishWindowMs>=55&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04);

// This is a new OFFLINE selection policy, not a change to routes-2 or live banks.
// A featured ride must be long; alternative efficient starts need not all be long.
export function rideFailures(a:DesignAnalysis,targetChroma:number):string[]{
  const failures=a.failures.filter(f=>f!=='short-or-muted-ride');
  if(targetChroma<.07)failures.push('muted-ride-target');
  return failures;
}

// Count an actual post-base tradeoff: a colored pour improves value closeness,
// worsens hue/chroma closeness, and a later pour repairs that hue/chroma cost.
// This is deliberately a/b distance, NOT an assertion about hue angle alone.
export function valueTradeoffs(palette:number,r:DesignRoute,recipe:Mixture):number{
  const paints=PLAY_LEVELS[palette].paints,target=mixtureColor(paints,recipe).lab;
  let q=paints.map((_,i)=>+(i===r.order[0]));
  const stops=[mixtureColor(paints,q).lab];
  for(let i=0;i<r.times.length;i++){
    q=addPaint(q,r.order[i+1],chargeAmount(totalMass(q),r.times[i]));
    stops.push(mixtureColor(paints,q).lab);
  }
  const ab=(p:readonly number[])=>Math.hypot(p[1]-target[1],p[2]-target[2]);
  let count=0;
  for(let i=1;i<stops.length-1;i++){
    if(['White','Black'].includes(paints[r.order[i]].category))continue;
    const before=stops[i-1],after=stops[i];
    const valueGain=Math.abs(before[0]-target[0])-Math.abs(after[0]-target[0]);
    const colorCost=ab(after)-ab(before);
    if(valueGain>=.035&&colorCost>=.015&&stops.slice(i+1).some(p=>ab(after)-ab(p)>=.015))count++;
  }
  return count;
}
export function focusMatches(palette:number,r:DesignRoute,recipe:Mixture,focus:Focus){
  if(focus==='chromatic-ride')return matchesDesign(r,'chromatic-ride');
  if(focus==='value-hue-balance')return r.meaningfulPours>=2&&valueTradeoffs(palette,r,recipe)>0;
  return r.meaningfulPours>=2&&r.opposedPairs>0;
}

export function focusedShortlist(){
  const pool=IDS.map(id=>{const p=PAINTS.find(x=>x.id===id);if(!p)throw new Error(id);return p;});
  const pairs=new Map<string,number[]>();
  for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
    const path=Array.from({length:33},(_,k)=>mixtureColor([pool[i],pool[j]],[32-k,k]));
    let travel=0,colored=0;
    const cs=path.map(p=>Math.hypot(p.lab[1],p.lab[2]));
    for(let k=1;k<path.length;k++){const d=distance(path[k].position,path[k-1].position);travel+=d;if(Math.min(cs[k],cs[k-1])>=.06)colored+=d;}
    const lift=Math.abs(path[0].lab[0]-path.at(-1)!.lab[0]);
    const dip=Math.max(0,Math.min(cs[0],cs.at(-1)!)-Math.min(...cs));
    const bothColored=![pool[i],pool[j]].some(p=>['White','Black'].includes(p.category));
    pairs.set(`${i}-${j}`,[colored,bothColored?colored*lift:0,bothColored?travel*dip:0]);
  }
  const existing=new Set(PLAY_LEVELS.map(l=>l.paints.map(p=>p.id).sort().join('|')));
  const candidates:PaletteTrial[]=[];
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++){
    const ids=[a,b,c,d],paints=ids.map(i=>pool[i]);if(existing.has(paints.map(p=>p.id).sort().join('|')))continue;
    const pair=(i:number,j:number,s:number)=>pairs.get(`${Math.min(i,j)}-${Math.max(i,j)}`)![s];
    const weakest=(s:number)=>Math.min(...ids.map(i=>ids.filter(j=>i!==j).map(j=>pair(i,j,s)).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0)));
    // Opposing-color shortlist favors two non-overlapping chroma-reducing pairs.
    // Physical trajectories and all-base support, not this proxy, decide acceptance.
    const opposed=Math.max(Math.min(pair(a,b,2),pair(c,d,2)),Math.min(pair(a,c,2),pair(b,d,2)),Math.min(pair(a,d,2),pair(b,c,2)));
    candidates.push({id:`focused-${ids.join('-')}`,paints,control:false,proxy:[weakest(0),weakest(1),opposed]});
  }
  const selected:PaletteTrial[]=[];
  for(let style=0;style<3;style++){
    const family:PaletteTrial[]=[];
    for(const p of [...candidates].sort((a,b)=>b.proxy[style]-a.proxy[style])){
      if(selected.some(x=>x.id===p.id)||family.some(x=>x.paints.filter(a=>p.paints.some(b=>b.id===a.id)).length>2))continue;
      family.push(p);selected.push(p);if(family.length===4)break;
    }
  }
  const controls=[1,5,10,11].map(i=>({id:`control-${PLAY_LEVELS[i].name}`,paints:PLAY_LEVELS[i].paints,control:true,proxy:[]}));
  return {combinations:candidates.length,pairCount:pairs.size,trials:[...selected,...controls]};
}
type Example={recipe:Mixture;analysis:DesignAnalysis;worstFinishMs:number;styleBases:number[];orders:string[];finishPaints:number[]};
type Result={focus:Focus;tested:number;passes:number;medianWorstFinishMs:number;examples:Example[];failures:Record<string,number>};
type Evaluation={trial:PaletteTrial;split:string;seconds:number;results:Result[]};

export function evaluateFocused(trial:PaletteTrial,seed:number,repeats:number,split:string):Evaluation{
  const began=performance.now(),slot=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:trial.id,subtitle:'Offline focused candidate',paints:trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  try{
    const recipes=discoveryRecipes(seed,repeats),atlas=makeAtlas(slot,128,24);
    const results=FOCUSES.map(focus=>({focus,tested:recipes.length,passes:0,medianWorstFinishMs:0,examples:[] as Example[],failures:{} as Record<string,number>}));
    for(const recipe of recipes){
      const cache=new Map<string,DesignAnalysis>();
      for(const result of results){
        const style=result.focus==='chromatic-ride'?'chromatic-ride':'coupled-balance';
        const get=(deep:boolean)=>{const key=style+deep;let a=cache.get(key);if(!a){a=analyzeDesign(slot,recipe,style,atlas,deep);cache.set(key,a);}return a;};
        const chroma=Math.hypot(...mixtureColor(trial.paints,recipe).lab.slice(1));
        const failuresFor=(a:DesignAnalysis)=>result.focus==='chromatic-ride'?rideFailures(a,chroma):[...a.failures];
        let a=get(false),failures=failuresFor(a);
        if(!failures.length){a=get(true);failures=failuresFor(a);}
        const styleBases=a.bases.filter(b=>b.routes.some(r=>supported(r)&&focusMatches(slot,r,recipe,result.focus))).map(b=>b.base);
        if(!styleBases.length)failures.push('no-supported-focused-route');
        if(!a.bases.every(b=>b.qualifies))failures.push('not-supported-from-every-base');
        if(!allBaseEligible({...a,failures})){
          for(const f of new Set(failures))result.failures[f]=(result.failures[f]??0)+1;
          continue;
        }
        result.passes++;
        const worstFinishMs=Math.min(...a.bases.map(b=>Math.max(...b.routes.filter(supported).map(r=>r.finishWindowMs))));
        const routes=a.bases.flatMap(b=>b.routes.filter(supported));
        result.examples.push({recipe,analysis:{...a,version:'focused-discovery-2',failures},worstFinishMs,styleBases,
          orders:[...new Set(routes.map(r=>r.order.join('-')))],finishPaints:[...new Set(routes.map(r=>r.order.at(-1)!))]});
      }
    }
    for(const r of results){
      r.medianWorstFinishMs=median(r.examples.map(e=>e.worstFinishMs));
      r.examples.sort((a,b)=>b.styleBases.length-a.styleBases.length||b.finishPaints.length-a.finishPaints.length||b.worstFinishMs-a.worstFinishMs);
      const kept:Example[]=[];
      for(const e of r.examples){if(kept.some(k=>colorDistance(mixtureColor(trial.paints,k.recipe),mixtureColor(trial.paints,e.recipe))<2*LIVE_LANDING_TOLERANCE))continue;kept.push(e);if(kept.length===3)break;}
      r.examples=kept;
    }
    return {trial,split,seconds:(performance.now()-began)/1000,results};
  }finally{PLAY_LEVELS.splice(slot,1);}
}

async function main(){
  const start=performance.now(),selection=focusedShortlist(),cache='/tmp/chroma-focused-discovery-2';mkdirSync(cache,{recursive:true});
  const hash=createHash('sha256');for(const file of ['scripts/discover-focused-palettes.ts','scripts/discover-play-palettes.ts','app/play-engine.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-course-analysis.ts','app/paint-mixing.ts'])hash.update(readFileSync(file));
  const sourceHash=hash.digest('hex');
  const run=(trial:PaletteTrial,seed:number,repeats:number,split:string):Evaluation=>{
    const file=`${cache}/${trial.id}-${split}.json`,signature=sourceHash+JSON.stringify(trial.paints);
    if(existsSync(file)){const old=JSON.parse(readFileSync(file,'utf8'));if(old.signature===signature)return old.result;}
    const result=evaluateFocused(trial,seed,repeats,split);writeFileSync(file,JSON.stringify({signature,result}));return result;
  };
  const log=(e:Evaluation)=>console.log(`${e.trial.id} ${e.split}: ${e.results.map(r=>`${r.focus} ${r.passes}/${r.tested}`).join('; ')} (${e.seconds.toFixed(1)}s)`);
  console.log(`Pair-screened ${selection.combinations} novel palettes; testing ${selection.trials.length} shortlisted palettes including controls.`);
  const training:Evaluation[]=[];
  for(const p of selection.trials){const e=run(p,20260925,1,'train');training.push(e);log(e);}
  // Freeze up to two novel finalists per focus BEFORE looking at fresh targets.
  const finalists:Evaluation[]=[];
  for(const focus of FOCUSES){
    const result=(e:Evaluation)=>e.results.find(r=>r.focus===focus)!;
    const ranked=training.filter(e=>!e.trial.control).sort((a,b)=>result(b).passes-result(a).passes||result(b).medianWorstFinishMs-result(a).medianWorstFinishMs);
    for(const e of ranked.filter(e=>result(e).passes>0).slice(0,2))if(!finalists.includes(e))finalists.push(e);
  }
  const holdout:Evaluation[]=[];
  for(const p of [...finalists,...training.filter(e=>e.trial.control)]){const e=run(p.trial,20270223,2,'holdout');holdout.push(e);log(e);}
  const report={version:'focused-discovery-2',sourceHash,tolerance:LIVE_LANDING_TOLERANCE,seconds:(performance.now()-start)/1000,
    selection:{combinations:selection.combinations,pairCount:selection.pairCount,trainingRecipes:24,holdoutRecipes:48,finalists:finalists.map(e=>e.trial.id)},training,holdout};
  writeFileSync('docs/play-focused-discovery.json',JSON.stringify(report,null,2));
  const lines=['# Focused palette discovery','',`Completed in ${report.seconds.toFixed(1)} seconds. ${selection.combinations} combinations cheaply screened; ${training.length} palettes route-tested. Finalists selected on 24 training targets before 48 fresh targets each.`,
    '', '| Palette | Ride | Value–color tradeoff | Opposing colors |','|---|---:|---:|---:|',
    ...holdout.map(e=>`| ${e.trial.control?e.trial.id:e.trial.paints.map(p=>p.name).join(' / ')} | ${e.results.map(r=>`${r.passes}/${r.tested}`).join(' | ')} |`),
    '', '## What acceptance means','',
    'Every counted target has supported efficient routes from every starting paint; at least one supported efficient route has the requested trait. Other bases need not share its style. Minimum whole-route travel is 14 world units; target separation is 1.8 scoring tolerances; timing support is at least 55 ms and sampled setup support at least 4%. These thresholds are provisional, not validated human difficulty standards.',
    '', 'Ride: at least one efficient route has a pour at least 36 world units long, with at least 80% chromatic travel on that pour and on the whole route. Target chroma is at least 0.07 Oklab. Unlike the previous search, alternative efficient routes need not all exceed 30 world units. The shared 14-unit floor remains.',
    '', 'Value–color tradeoff: a colored addition AFTER the free base reduces absolute target lightness error by at least 0.035, increases target a/b error by at least 0.015, and a subsequent addition repairs at least 0.015 of that a/b error. This measures combined hue/chroma cost, not hue angle alone. A free white start is not a value-lift event.',
    '', 'Opposing colors: consecutive colored additions have substantial opposing a/b displacement (each greater than 0.025; cosine less than -0.25). This is measured modeled interaction, not a claim that paints are exact complements. The shortlist favors two distinct chroma-reducing pigment pairs, but a passing route need only use one opposing interaction. The two balance traits can overlap.',
    '', 'Balance searches reject any found one-addition shortcut. Rides allow a substantial one-addition route. Meaningful additions, legal merging of split doses, and competing shortest-count routes are inherited from routes-2. Only three retained efficient orders per base are inspected for focused traits: missing traits can be search/retention misses.',
    '', '## Limits and reproducibility','',
    'Search covers every base and all one-/two-addition orders on sampled grids with local refinement. Three-addition solutions are generating-recipe witnesses, not an exhaustive search. Counts are lower-bound model findings conditional on the cohort distribution, not proof that other targets or routes are impossible. Small holdout samples do not establish a statistically reliable palette ranking.',
    '', 'Recipes and route witnesses are saved in play-focused-discovery.json. Finish-paint and order diversity are reported for replay selection; they are not proof of spatially different paths. Palette IDs refer to temporary offline slots; replay against the saved paint definitions, never a current live index.',
    '', 'No existing palette, physical mixing model, tolerance, published lab, or user data was changed. These are new-to-this-game candidates, not claims of historical originality.'];
  writeFileSync('docs/play-focused-discovery.md',lines.join('\n')+'\n');
  console.log(`Finished in ${report.seconds.toFixed(1)}s. Saved report and replayable candidate witnesses.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
