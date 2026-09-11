import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,type Mixture} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeDesign,matchesDesign,type DesignStyle,type DesignAnalysis} from '../app/play-route-design';

const STYLES:DesignStyle[]=['chromatic-ride','setup-lift','coupled-balance'];
const IDS=['titanium-white','cadmium-lemon','yellow-ochre','cadmium-orange','transparent-orange','cadmium-red-light','quinacridone-magenta','alizarin-crimson','dioxazine-purple','ultramarine-blue','cobalt-blue','cerulean-blue','cobalt-teal','phthalo-blue-green','phthalo-green-yellow','viridian','permanent-green-light','burnt-sienna'];
export type PaletteTrial={id:string;paints:PaintColor[];control:boolean;proxy:number[]};
const length=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
const median=(a:number[])=>a.length?[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]:0;
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};}

// Always four paints. Training/holdout use independent seeds but the same
// pair/triple/full-mixture distribution and balanced ingredient inclusion.
export function discoveryRecipes(seed:number,repeats=1):Mixture[]{
  const rng=random(seed),result:Mixture[]=[];
  for(let rep=0;rep<repeats;rep++){
    for(let mask=1;mask<16;mask++){
      const active=[0,1,2,3].filter(i=>(mask>>i)&1);if(active.length<2)continue;
      const count=active.length===4?6:active.length===3?3:1;
      for(let n=0;n<count;n++){
        const q=[0,0,0,0];for(const i of active)q[i]=Math.exp((rng()-.5)*4);
        const total=q.reduce((a,b)=>a+b,0);result.push(q.map(v=>v/total));
      }
    }
  }
  return result;
}
export function allBaseEligible(a:{failures:readonly string[];qualifyingBases:readonly number[];bases:readonly {qualifies:boolean}[]}){return a.failures.length===0&&a.bases.length>0&&a.bases.every(b=>b.qualifies)&&a.qualifyingBases.length===a.bases.length;}

// Cheap pairwise geometry is only a shortlist heuristic, never acceptance.
// Pure-paint interpolation is sampled with the real spectral model, not RGB.
export function shortlist():{trials:PaletteTrial[];combinations:number;pairCount:number}{
  const pool=IDS.map(id=>{const p=PAINTS.find(p=>p.id===id);if(!p)throw new Error(`Missing ${id}`);return p;});
  const pairs=new Map<string,number[]>();
  for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
    const path=Array.from({length:25},(_,k)=>mixtureColor([pool[i],pool[j]],[24-k,k]));
    let travel=0,colored=0;
    for(let k=1;k<path.length;k++){const d=length(path[k].position,path[k-1].position);travel+=d;if(Math.min(Math.hypot(...path[k].lab.slice(1)),Math.hypot(...path[k-1].lab.slice(1)))>.06)colored+=d;}
    const direct=length(path[0].position,path.at(-1)!.position),lift=Math.abs(path[0].lab[0]-path.at(-1)!.lab[0]);
    const bend=Math.max(0,travel-direct);
    pairs.set(`${i}-${j}`,[colored,travel*lift,bend+travel*.2]);
  }
  const existing=new Set(PLAY_LEVELS.map(p=>p.paints.map(x=>x.id).sort().join('|'))),candidates:PaletteTrial[]=[];
  for(let a=0;a<pool.length;a++)for(let b=a+1;b<pool.length;b++)for(let c=b+1;c<pool.length;c++)for(let d=c+1;d<pool.length;d++){
    const ids=[a,b,c,d],paints=ids.map(i=>pool[i]);if(existing.has(paints.map(p=>p.id).sort().join('|')))continue;
    // Each paint needs useful partners. Maximize the weakest paint's top-two
    // interactions, not a single dramatic pair plus two incidental paints.
    const proxy=[0,1,2].map(style=>Math.min(...ids.map(i=>ids.filter(j=>i!==j).map(j=>pairs.get(`${Math.min(i,j)}-${Math.max(i,j)}`)![style]).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0))));
    candidates.push({id:`novel-${ids.join('-')}`,paints,control:false,proxy});
  }
  const selected:PaletteTrial[]=[];
  for(let style=0;style<3;style++){
    let count=0;for(const p of [...candidates].sort((a,b)=>b.proxy[style]-a.proxy[style])){
      if(selected.some(s=>s.paints.filter(x=>p.paints.some(y=>x.id===y.id)).length>2))continue;
      selected.push(p);if(++count===4)break;
    }
  }
  const controls=[1,5,10].map(i=>({id:`control-${PLAY_LEVELS[i].name}`,paints:PLAY_LEVELS[i].paints,control:true,proxy:[]}));
  return {trials:[...selected,...controls],combinations:candidates.length,pairCount:pairs.size};
}
type Example={recipe:Mixture;analysis:DesignAnalysis;worstFinishMs:number};
type StyleResult={style:DesignStyle;tested:number;allBasePasses:number;twoBasePasses:number;worstBaseSupportRate:number;medianWorstFinishMs:number;minTravel:number|null;valueSpan:number;examples:Example[];failures:Record<string,number>};
type Evaluation={trial:PaletteTrial;split:string;seconds:number;styles:StyleResult[]};

// Each style must pass every-base eligibility before contributing to yield.
// Style labels can differ across starts. Quality tests are still provisional.
export function evaluateTrial(trial:PaletteTrial,seed:number,repeats:number,split:string):Evaluation{
  const start=performance.now(),slot=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:trial.id,subtitle:'Offline candidate',paints:trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  try{
    const recipes=discoveryRecipes(seed,repeats),atlas=makeAtlas(slot,128,24),styles:StyleResult[]=[];
    for(const style of STYLES){
      const support=[0,0,0,0],examples:Example[]=[],failures:Record<string,number>={},finishes:number[]=[],travels:number[]=[],values:number[]=[];let twoBasePasses=0,allBasePasses=0;
      for(const recipe of recipes){
        const quick=analyzeDesign(slot,recipe,style,atlas,false);
        if(quick.failures.length){for(const f of quick.failures)failures[f]=(failures[f]??0)+1;continue;}
        const a=analyzeDesign(slot,recipe,style,atlas,true);
        if(!a.failures.length)twoBasePasses++;
        for(const b of a.bases)if(b.qualifies)support[b.base]++;
        if(!allBaseEligible(a)){for(const f of [...a.failures,...(a.bases.some(b=>!b.qualifies)?['not-supported-from-every-base']:[])])failures[f]=(failures[f]??0)+1;continue;}
        allBasePasses++;
        const worstFinishMs=Math.min(...a.bases.map(b=>Math.max(...b.routes.filter(r=>r.finishWindowMs>=55&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04)).map(r=>r.finishWindowMs))));
        finishes.push(worstFinishMs);travels.push(a.minTravel);values.push(mixtureColor(trial.paints,recipe).lab[0]);
        examples.push({recipe,analysis:a,worstFinishMs});
      }
      examples.sort((a,b)=>b.worstFinishMs-a.worstFinishMs);
      // Retain a few separated replayable witnesses, not private user data.
      const kept:Example[]=[];for(const e of examples){if(kept.some(x=>colorDistance(mixtureColor(trial.paints,e.recipe),mixtureColor(trial.paints,x.recipe))<LIVE_LANDING_TOLERANCE*2))continue;kept.push(e);if(kept.length===3)break;}
      styles.push({style,tested:recipes.length,allBasePasses,twoBasePasses,worstBaseSupportRate:Math.min(...support)/recipes.length,medianWorstFinishMs:median(finishes),minTravel:travels.length?Math.min(...travels):null,valueSpan:values.length?Math.max(...values)-Math.min(...values):0,examples:kept,failures});
    }
    return {trial,split,seconds:(performance.now()-start)/1000,styles};
  }finally{PLAY_LEVELS.splice(slot,1);}
}
// Lexicographic priority: every-base yield, then worst-start timing, then
// target range. Never trade one unsupported starting paint for a big average.
export function compareResults(a:StyleResult,b:StyleResult){return b.allBasePasses/b.tested-a.allBasePasses/a.tested||b.medianWorstFinishMs-a.medianWorstFinishMs||b.valueSpan-a.valueSpan;}

async function main(){
  const began=performance.now(),selected=shortlist(),cache='/tmp/chroma-palette-discovery-1';mkdirSync(cache,{recursive:true});
  const hash=createHash('sha256');for(const p of ['app/play-engine.ts','app/play-route-design.ts','app/play-route-analysis.ts','app/play-course-analysis.ts','app/paint-mixing.ts','scripts/discover-play-palettes.ts'])hash.update(readFileSync(p));const source=hash.digest('hex');
  const evalCached=(trial:PaletteTrial,seed:number,repeats:number,split:string)=>{
    const file=`${cache}/${trial.id}-${split}.json`,signature=source+JSON.stringify(trial.paints);
    if(existsSync(file)){const old=JSON.parse(readFileSync(file,'utf8'));if(old.signature===signature)return old.result as Evaluation;}
    const result=evaluateTrial(trial,seed,repeats,split);writeFileSync(file,JSON.stringify({signature,result}));return result;
  };
  console.log(`Screened ${selected.combinations} novel combinations using ${selected.pairCount} pigment-pair curves; route-testing ${selected.trials.length} palettes.`);
  const train:Evaluation[]=[];
  for(const p of selected.trials){const e=evalCached(p,20260914,1,'train');train.push(e);console.log(`${p.id} train: ${e.styles.map(s=>`${s.style} ${s.allBasePasses}/${s.tested}`).join('; ')} (${e.seconds.toFixed(1)}s)`);}
  // Select finalists ONLY on training data, one per style, plus the best
  // remaining broad palette. Frozen before any holdout target is examined.
  const finalists:Evaluation[]=[];
  for(const style of STYLES){const ranked=train.filter(e=>!e.trial.control).sort((a,b)=>compareResults(a.styles.find(s=>s.style===style)!,b.styles.find(s=>s.style===style)!));
    if(ranked[0]&&!finalists.includes(ranked[0]))finalists.push(ranked[0]);}
  const broad=(e:Evaluation)=>e.styles.reduce((sum,s)=>sum+s.allBasePasses,0);
  for(const e of train.filter(e=>!e.trial.control).sort((a,b)=>broad(b)-broad(a))){if(!finalists.includes(e))finalists.push(e);if(finalists.length===4)break;}
  const held:Evaluation[]=[];
  for(const e of [...finalists,...train.filter(e=>e.trial.control)]){const h=evalCached(e.trial,20270119,2,'holdout');held.push(h);console.log(`${h.trial.id} holdout: ${h.styles.map(s=>`${s.style} ${s.allBasePasses}/${s.tested}`).join('; ')}`);}
  const result={version:'palette-discovery-1',sourceHash:source,tolerance:LIVE_LANDING_TOLERANCE,seconds:(performance.now()-began)/1000,selection:{combinations:selected.combinations,pairCurves:selected.pairCount,novelRouteTested:selected.trials.filter(p=>!p.control).length,trainRecipes:24,holdoutRecipes:48,finalists:finalists.map(e=>e.trial.id)},training:train,holdout:held};
  writeFileSync('docs/play-palette-discovery.json',JSON.stringify(result,null,2));
  const names=(p:PaletteTrial)=>p.paints.map(p=>p.name).join(' / ');
  const lines=['# Novel palette discovery · first bounded search','',`Runtime: ${result.seconds.toFixed(1)} seconds. ${selected.combinations} novel four-paint combinations screened with pair geometry; ${result.selection.novelRouteTested} shortlisted novel palettes plus three controls received full route searches. Four novel finalists and the controls received 48 fresh targets each.`,
    '', '## Held-out results','', 'Each count is the number of targets whose requested style qualified AND had supported efficient routes from all four bases. These are model predictions, not human approval.','', '| Palette | Ride / 48 | Lift / 48 | Balance / 48 |','|---|---:|---:|---:|',
    ...held.map(e=>`| ${e.trial.control?e.trial.id:names(e.trial)} | ${e.styles.map(s=>s.allBasePasses).join(' | ')} |`),
    '', '## How to interpret this','', 'Every-base coverage is mandatory for a counted hole. Routes may differ in style across bases. A successful route from every base does not mean every possible decision sequence is good. The minimum finishing window is 55 ms; local setup coverage must be at least 4%. These are provisional playability proxies, not measured human success rates.',
    '', 'Training used 24 seeded recipes per palette; holdout used 48 independently seeded recipes with the same pair/triple/full-mixture distribution. All palettes have four paints. Finalists were chosen before holdout evaluation. Counts are conditional on this sampling distribution and have substantial small-sample uncertainty. Training/holdout targets are not manually selected successes.',
    '', 'The cheap shortlist favors the weakest paint’s useful pair interactions, with diversity between selected combinations. It is not exhaustive route optimization over every screened palette. Search covers every base and all one-/two-pour orders at 129 and 25×25 samples with six local refinements; three-pour routes are recipe witnesses, not an exhaustive search. Unfound routes can be real solver misses.',
    '', 'Paints use the existing modeled spectral behavior and tinting strengths, not measured brand reflectance. No physical mixing parameters, existing palettes, published holes, calibration, or user records were changed. This report and its saved recipe/route witnesses are for a subsequent lab selection, not a published new round.'];
  writeFileSync('docs/play-palette-discovery.md',lines.join('\n')+'\n');
  // Replayability sanity check for all retained holdout examples.
  for(const e of held)for(const s of e.styles)for(const x of s.examples){if(!allBaseEligible(x.analysis)||!x.analysis.bases.some(b=>b.routes.some(r=>matchesDesign(r,s.style))))throw new Error('Invalid saved discovery witness');}
  console.log(`Complete in ${result.seconds.toFixed(1)} seconds; report and witnesses saved.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
