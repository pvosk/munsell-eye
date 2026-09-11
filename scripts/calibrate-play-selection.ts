// Reproducible offline calibration, not a live bank builder. No private export
// is required or copied: review-derived benchmark expectations are explicit.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeAudit,timingSupported,type AuditStyle,type AuditedHole} from '../app/play-route-audit';
import {assessSelection,compareSelection,SELECTION_VERSION,type StartScope} from '../app/play-route-selection';
import {discoveryRecipes} from './discover-play-palettes';
import round3 from '../app/generated/play-lab-round3.json';
import round6 from '../app/generated/play-lab-round6.json';

const styles:AuditStyle[]=['setup-lift','chromatic-ride','interior-weave','opposing-colors'];
const started=performance.now(),cache='/tmp/chroma-selection-1';mkdirSync(cache,{recursive:true});
const hash=createHash('sha256');
for(const p of ['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts'])hash.update(readFileSync(p));
const sourceHash=hash.digest('hex');
const policyHash=createHash('sha256').update(readFileSync('app/play-route-selection.ts')).digest('hex');
const atlases=new Map<string,ReturnType<typeof makeAtlas>>();
type Entry={id:string;palette:number;recipe:number[];origin:string;audit:AuditedHole;proposedStyle?:AuditStyle};
const audit=(palette:number,recipe:number[],dense=false)=>{
  const key=createHash('sha256').update(sourceHash+JSON.stringify([PLAY_LEVELS[palette].paints,recipe,dense])).digest('hex');
  const path=`${cache}/${key}.json`;if(existsSync(path))return JSON.parse(readFileSync(path,'utf8')) as AuditedHole;
  const ak=`${palette}-${dense}`;if(!atlases.has(ak))atlases.set(ak,makeAtlas(palette,dense?256:128,dense?48:24));
  const result=analyzeAudit(palette,recipe,atlases.get(ak));writeFileSync(path,JSON.stringify(result));return result;
};
const measure=(e:Entry,s:AuditStyle,scope:StartScope='plausible')=>assessSelection(PLAY_LEVELS[e.palette].paints,e.audit,s,scope);
const brief=(e:Entry,s:AuditStyle,scope:StartScope='plausible')=>({id:e.id,palette:PLAY_LEVELS[e.palette].name,levelIndex:e.palette,origin:e.origin,recipe:e.recipe,
  globalFewest:e.audit.globalFewest,failures:e.audit.failures,metrics:measure(e,s,scope)});
const withStyle=(e:Entry,s:AuditStyle)=>e.audit.bases.some(b=>b.routes.some(r=>timingSupported(r)&&r.traits.includes(s)));
const winners=(pool:Entry[])=>styles.map(style=>{
  const offered=pool.filter(e=>withStyle(e,style));
  const old=offered.filter(e=>!e.audit.failures.length).sort((a,b)=>measure(b,style).showcase-measure(a,style).showcase);
  const top=(scope:StartScope)=>[...offered].sort((a,b)=>compareSelection(measure(a,style,scope),measure(b,style,scope))).slice(0,3).map(e=>brief(e,style,scope));
  return {style,candidates:offered.length,oldShowcase:old.slice(0,3).map(e=>brief(e,style)),closest:top('closest'),plausible:top('plausible'),all:top('all')};
});

const fixed:Entry[]=round6.holes.map(h=>({id:h.record.id,palette:h.levelIndex,recipe:h.record.target,origin:'round6',audit:audit(h.levelIndex,h.record.target,true)}));
for(const h of round3.holes.filter(h=>[1,5,10].includes(h.levelIndex)))fixed.push({id:h.record.id,palette:h.levelIndex,recipe:h.record.target,origin:'round3-benchmark',audit:audit(h.levelIndex,h.record.target,true)});
console.log(`Fixed: ${fixed.length} exact historical targets re-audited at dense resolution.`);
// Pairwise expectations are calibration examples, NOT held-out validation.
const pairs=[
  {name:'Known Secondaries balancing challenge above too-close RYB interior',positive:'lab-3-5-2417069514',negative:round6.holes[4].record.id,style:'interior-weave' as AuditStyle},
  {name:'Known Secondaries interior above too-close RYB interior',positive:'lab-3-5-3966395694',negative:round6.holes[4].record.id,style:'interior-weave' as AuditStyle},
  {name:'Neutral Crimson over rejected bright Crimson (general multi-step quality)',positive:round6.holes[7].record.id,negative:round6.holes[0].record.id,style:'opposing-colors' as AuditStyle},
];
const comparisons=pairs.map(pair=>{
  const a=fixed.find(e=>e.id===pair.positive)!,b=fixed.find(e=>e.id===pair.negative)!;
  const outcomes=Object.fromEntries((['closest','plausible','all'] as const).map(s=>[s,compareSelection(measure(a,pair.style,s),measure(b,pair.style,s))<0]));
  return {...pair,outcomes,positiveMetrics:brief(a,pair.style),negativeMetrics:brief(b,pair.style)};
});
for(const c of comparisons)console.log(`BENCHMARK ${c.name}: ${JSON.stringify(c.outcomes)}`);
const old=JSON.parse(readFileSync('docs/play-lab-round6-search.json','utf8')) as {candidates:{palette:number;recipe:number[];style:AuditStyle;score:number}[]};
const pool:Entry[]=[];
for(const [i,c] of old.candidates.entries()){
  pool.push({id:`previous-pool-${i}`,palette:c.palette,recipe:c.recipe,origin:'previous-pool',proposedStyle:c.style,audit:audit(c.palette,c.recipe)});
  if((i+1)%12===0)console.log(`Previous pool ${i+1}/${old.candidates.length}`);
}
const oldPool=winners(pool);
// No showcase prefilter: every recipe is audited, including failures. Same
// fixed cohort across all palettes. This is a new sampling check, not new
// player validation. No claims that an absent route is mathematically absent.
const fresh:Entry[]=[],seed=20261007,palettes=[1,2,4,5,7,10,16,19,20];
function recipes(palette:number){
  const n=PLAY_LEVELS[palette].paints.length;if(n===4)return discoveryRecipes(seed);
  if(n!==3)throw new Error('This bounded cohort covers three/four-paint palettes only');
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const result:number[][]=[];
  for(let mask=1;mask<8;mask++){
    const active=[0,1,2].filter(i=>(mask>>i)&1);if(active.length<2)continue;
    for(let k=0;k<(active.length===2?4:12);k++){
      const q=[0,0,0];for(const i of active)q[i]=Math.exp((random()-.5)*4);
      const sum=q.reduce((a,b)=>a+b,0);result.push(q.map(v=>v/sum));
    }
  }return result;
}
for(const palette of palettes){
  for(const [i,recipe] of recipes(palette).entries())fresh.push({id:`broad-${palette}-${i}`,palette,recipe,origin:'broad-unfiltered',audit:audit(palette,recipe)});
  const es=fresh.filter(e=>e.palette===palette);
  console.log(`BROAD ${PLAY_LEVELS[palette].name}: ${es.length} tested, ${es.filter(e=>!e.audit.failures.length).length} base-valid, ${es.filter(e=>measure(e,'interior-weave').profileThree).length} supported three-from-every-base with >1.1 shortcut margin.`);
}
const all=[...pool,...fresh];
const provisional=winners(all);
// Dense-check the union of top candidates from every ablation, not only our
// preferred policy. Rerank the verified finalist set; don't accept stale rank.
const finalIds=new Set(provisional.flatMap(w=>[...w.oldShowcase,...w.closest,...w.plausible,...w.all].map(e=>e.id)));
const verified=all.filter(e=>finalIds.has(e.id)).map(e=>({...e,audit:audit(e.palette,e.recipe,true)}));
const final=winners(verified);
const counts=(es:Entry[])=>({tested:es.length,baseValid:es.filter(e=>!e.audit.failures.length).length,
  supportedThreeAllBases:es.filter(e=>e.audit.bases.every(b=>b.viable&&b.fewest===3)).length,
  threeAllBasesWithMargin:es.filter(e=>measure(e,'interior-weave').profileThree).length,
  styles:styles.map(s=>({style:s,available:es.filter(e=>withStyle(e,s)).length,
    plausibleResistant:es.filter(e=>measure(e,s).requestedStyleResistant).length,
    allResistant:es.filter(e=>measure(e,s,'all').requestedStyleResistant).length}))});
const result={version:SELECTION_VERSION,sourceHash,policyHash,tolerance:LIVE_LANDING_TOLERANCE,seed,palettes,
  seconds:(performance.now()-started)/1000,comparisons,fixed:fixed.map(e=>({id:e.id,palette:PLAY_LEVELS[e.palette].name,audit:e.audit,
    styles:styles.map(s=>({style:s,metrics:measure(e,s)}))})),
  oldPool,freshByPalette:palettes.map(p=>({palette:PLAY_LEVELS[p].name,...counts(fresh.filter(e=>e.palette===p))})),
  previousCounts:counts(pool),freshCounts:counts(fresh),finalistCount:verified.length,final,
  // Compact exact candidate cohort allows ranking to be inspected/reproduced.
  cohort:all.map(e=>({id:e.id,palette:e.palette,origin:e.origin,recipe:e.recipe,globalFewest:e.audit.globalFewest,failures:e.audit.failures,
    styles:styles.map(s=>({style:s,metrics:measure(e,s)}))})),
  verified:verified.map(e=>({id:e.id,palette:e.palette,recipe:e.recipe,audit:e.audit})),
  caveats:['Review pairs informed policy: calibration, not independent validation.','Plausible bases are a heuristic union of closest perceptual and closest chromatic hue, not human-choice probabilities.',
    'All one/two orders are sampled with refinement; three-addition routes are generating-recipe witnesses.','Retained route groups may omit weaker same-trait doses; resistance means no retained supported bypass found.',
    'Finalists are dense-verified; this does not prove that every nonfinalist stays below them at higher resolution.','No live holes, scoring, par, palettes, animation or tolerance changed.']};
writeFileSync('docs/play-selection-calibration.json',JSON.stringify(result,null,2)+'\n');
console.log('COUNTS',JSON.stringify({previous:result.previousCounts,fresh:result.freshCounts,finalists:verified.length}));
for(const w of final)console.log('FINAL',w.style,JSON.stringify({old:w.oldShowcase[0]?.id,closest:w.closest[0]?.id,plausible:w.plausible[0]?.id,all:w.all[0]?.id}));
console.log(`DONE ${result.seconds.toFixed(1)}s`);
