// Follow-up diagnostic: can a proposal objective target the demonstrated
// three-addition structure? This does not assert perceptual enjoyment.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeAudit,type AuditedHole} from '../app/play-route-audit';
import {assessSelection} from '../app/play-route-selection';

const seed=20261009,palettes=[1,2,5,7,10,16],cache='/tmp/chroma-interior-probe-1';mkdirSync(cache,{recursive:true});
const hash=createHash('sha256');for(const p of ['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','scripts/probe-interior-proposals.ts'])hash.update(readFileSync(p));
const sourceHash=hash.digest('hex'),results=[],start=performance.now();
for(const palette of palettes){
  const paints=PLAY_LEVELS[palette].paints,atlas=makeAtlas(palette,128,24),points=atlas.flatMap(e=>e.samples.map(s=>s.lab));
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const proposals=Array.from({length:160},(_,i)=>{
    // Half broad log doses, half central/tint-compensated proposals. Tint
    // compensation is only a sampling heuristic; exact spectra score targets.
    const q=paints.map(p=>Math.exp((random()-.5)*(i%2?1.6:4))/(i%2?p.strength:1));
    const sum=q.reduce((a,b)=>a+b,0),recipe=q.map(x=>x/sum),target=mixtureColor(paints,recipe);
    let squared=Infinity;
    for(const p of points){const d=(p[0]-target.lab[0])**2+(p[1]-target.lab[1])**2+(p[2]-target.lab[2])**2;if(d<squared)squared=d;}
    return {recipe,target,coarseGap:Math.sqrt(squared)/LIVE_LANDING_TOLERANCE};
  }).sort((a,b)=>b.coarseGap-a.coarseGap);
  const selected:typeof proposals=[];
  for(const p of proposals){if(selected.every(e=>colorDistance(e.target,p.target)>=LIVE_LANDING_TOLERANCE))selected.push(p);if(selected.length===8)break;}
  const checked=[];
  const dense=makeAtlas(palette,256,48);
  for(const [i,p] of selected.entries()){
    const key=createHash('sha256').update(sourceHash+JSON.stringify([palette,p.recipe])).digest('hex'),path=`${cache}/${key}.json`;
    const audit:AuditedHole=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):analyzeAudit(palette,p.recipe,dense);
    if(!existsSync(path))writeFileSync(path,JSON.stringify(audit));
    checked.push({id:`gap-${palette}-${i}`,recipe:p.recipe,coarseGap:p.coarseGap,audit,metrics:assessSelection(paints,audit,'interior-weave','all')});
  }
  results.push({palette,name:PLAY_LEVELS[palette].name,proposed:proposals.length,checked,
    threeAll:checked.filter(c=>c.metrics.profileThree).length,baseValid:checked.filter(c=>!c.audit.failures.length).length});
  console.log(`${PLAY_LEVELS[palette].name}: ${checked.length}/160 gap-selected checked; ${results.at(-1)!.threeAll} supported three-from-every-base.`);
}
writeFileSync('docs/play-interior-proposal-probe.json',JSON.stringify({seed,sourceHash,seconds:(performance.now()-start)/1000,results,
  caveats:['Coarse distance from one/two-addition samples is an upper estimate of the true minimum error; dense refinement verifies candidates.',
    'No user-reviewed target recipes were injected. The objective was motivated by the positive Secondaries examples.',
    'The search is bounded and three-addition witnesses follow recipe permutations. No proof of no continuous shortcut.',
    'This targets a demanding interior brief only, not all hole styles or overall palette quality. No live bank changed.']},null,2)+'\n');
