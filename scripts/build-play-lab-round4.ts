import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,type Mixture} from '../app/play-engine';
import {paletteSignature,makeAtlas,playerPar} from '../app/play-course-analysis';
import {analyzeDesign,matchesDesign,type DesignStyle,type DesignAnalysis} from '../app/play-route-design';
import prior from '../app/generated/play-lab-round3.json';

const styles:DesignStyle[]=['chromatic-ride','setup-lift','coupled-balance'];
const pairs=[{id:'ride',palettes:[4,12],style:'chromatic-ride' as DesignStyle,brief:'Does replacing phthalo with cobalt improve sustained chromatic travel from more than one base?'},
  {id:'lift',palettes:[1,13],style:'setup-lift' as DesignStyle,brief:'Does replacing black with ultramarine produce a meaningful colored setup before the lift, without a white-start shortcut?'},
  {id:'balance',palettes:[5,14],style:'coupled-balance' as DesignStyle,brief:'Does replacing white with lemon create worthwhile value–hue compensation rather than frustrating correction?'}];
// Identical seeded ratio cohort per paint count. Each substitution pair gets
// the SAME recipes, not identical target RGBs. No targeting around user notes.
export function cohort(count:number):Mixture[]{
  let seed=20260913;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
  return Array.from({length:96},(_,i)=>{
    const order=Array.from({length:count},(_,j)=>j);
    for(let j=count-1;j>0;j--){const k=Math.floor(rng()*(j+1));[order[j],order[k]]=[order[k],order[j]];}
    const active=2+i%(count-1),q=Array(count).fill(0);
    for(const j of order.slice(0,active))q[j]=Math.exp((rng()-.5)*4);
    const sum=q.reduce((a,b)=>a+b,0);return q.map(v=>v/sum);
  });
}
type Candidate={index:number;recipe:Mixture;analysis:DesignAnalysis};
const results=new Map<string,Candidate[]>(),report:{palette:string;style:DesignStyle;tested:number;screened:number;confirmed:number;rejections:Record<string,number>}[]=[];
const atlases=new Map<number,ReturnType<typeof makeAtlas>>();
for(const p of pairs.flatMap(x=>x.palettes)){
  const atlas=makeAtlas(p,128,24);atlases.set(p,atlas);
  const recipes=cohort(PLAY_LEVELS[p].paints.length);
  for(const style of styles){
    const cache=`/tmp/chroma-design-r2b-${p}-${style}.json`,sig=paletteSignature(15)+LIVE_LANDING_TOLERANCE;
    let data:{signature:string;candidates:Candidate[];row:typeof report[number]}|undefined;
    if(existsSync(cache)){const saved=JSON.parse(readFileSync(cache,'utf8'));if(saved.signature===sig)data=saved;}
    if(!data){
      const row={palette:PLAY_LEVELS[p].name,style,tested:recipes.length,screened:0,confirmed:0,rejections:{} as Record<string,number>},candidates:Candidate[]=[];
      for(let i=0;i<recipes.length;i++){
        const quick=analyzeDesign(p,recipes[i],style,atlas,false);
        if(!quick.failures.length){row.screened++;const analysis=analyzeDesign(p,recipes[i],style,atlas,true);
          if(!analysis.failures.length){row.confirmed++;candidates.push({index:i,recipe:recipes[i],analysis});}
          else for(const f of analysis.failures)row.rejections[f]=(row.rejections[f]??0)+1;
        }else for(const f of quick.failures)row.rejections[f]=(row.rejections[f]??0)+1;
      }
      data={signature:sig,candidates,row};writeFileSync(cache,JSON.stringify(data));
    }
    report.push(data.row);results.set(`${p}-${style}`,data.candidates);
    console.log(`${data.row.palette}: ${style} ${data.row.confirmed}/${data.row.tested} confirmed`);
  }
}
const selected:{levelIndex:number;stage:number;record:Record<string,unknown>;analysis:DesignAnalysis;brief:string;pair:string;reference:boolean}[]=[];
const merit=(c:Candidate)=>c.analysis.qualifyingBases.length*3+c.analysis.styleBases.length*2+Math.min(c.analysis.minTravel,55)/20;
function select(p:number,c:Candidate,pair:string,brief:string,reference=false){
  const a=c.analysis;
  const choices=a.bases.flatMap(b=>b.routes).filter(r=>r.efficient&&r.finishWindowMs>=55&&matchesDesign(r,a.style)&&(!r.setup||r.setup.coverage>=.04));
  const route=choices.sort((a,b)=>b.finishWindowMs-a.finishWindowMs)[0];
  if(!route)throw new Error('Missing efficient route');
  const shots=Math.min(...a.bases.map(b=>b.fewestFound??Infinity)),stage=selected.filter(x=>x.levelIndex===p).length;
  selected.push({levelIndex:p,stage,analysis:a,brief,pair,reference,record:{id:`lab-4-${p}-${c.index}-${reference?'ref':'test'}`,target:c.recipe,recipe:route.recipe,order:route.order,times:route.times,
    par:playerPar(shots,route.window,a.style==='coupled-balance'?.8:.4),timingWindow:route.window,solutionShots:shots,kind:a.style}});
}
const pairOutcomes:Record<string,string>={},focusedSearches:{pair:string;tested:number;matched:boolean}[]=[];
for(const pair of pairs){
  const [a,b]=pair.palettes,A=results.get(`${a}-${pair.style}`)!,B=results.get(`${b}-${pair.style}`)!;
  const changed=PLAY_LEVELS[a].paints.findIndex((p,i)=>p.id!==PLAY_LEVELS[b].paints[i].id);
  // The substituted paint must actually participate. Otherwise a matched
  // recipe can be identical in both palettes and tell us nothing about the swap.
  const shared=A.filter(x=>x.recipe[changed]>=.03).flatMap(x=>{const y=B.find(y=>y.index===x.index);
    return y&&colorDistance(mixtureColor(PLAY_LEVELS[a].paints,x.recipe),mixtureColor(PLAY_LEVELS[b].paints,y.recipe))>LIVE_LANDING_TOLERANCE*.5?[{x,y,score:merit(x)+merit(y)}]:[];
  }).sort((x,y)=>y.score-x.score);
  // A second, explicitly separate search nudges promising ratios. These
  // targeted candidates are not added to the unbiased fixed-cohort denominator.
  const focus={pair:pair.id,tested:0,matched:shared.length>0};
  if(!shared.length){
    const seeds=[...A,...B].filter(x=>x.recipe[changed]>=.03).sort((a,b)=>merit(b)-merit(a));
    outer:for(const seed of seeds.slice(0,8))for(let component=0;component<seed.recipe.length;component++)for(const factor of [.75,.9,1.1,1.25]){
      focus.tested++;let q=seed.recipe.map((v,i)=>v*(i===component?factor:1));const sum=q.reduce((a,b)=>a+b,0);q=q.map(v=>v/sum);
      if(q[changed]<.03)continue;
      const qa=analyzeDesign(a,q,pair.style,atlases.get(a),false);if(qa.failures.length)continue;
      const qb=analyzeDesign(b,q,pair.style,atlases.get(b),false);if(qb.failures.length)continue;
      const aa=analyzeDesign(a,q,pair.style,atlases.get(a),true),bb=analyzeDesign(b,q,pair.style,atlases.get(b),true);
      if(aa.failures.length||bb.failures.length||colorDistance(mixtureColor(PLAY_LEVELS[a].paints,q),mixtureColor(PLAY_LEVELS[b].paints,q))<=LIVE_LANDING_TOLERANCE*.5)continue;
      const x={index:1000+focus.tested,recipe:q,analysis:aa},y={index:x.index,recipe:q,analysis:bb};shared.push({x,y,score:merit(x)+merit(y)});focus.matched=true;break outer;
    }
  }
  focusedSearches.push(focus);console.log(`${pair.id}: focused candidates ${focus.tested}, matched=${focus.matched}`);
  if(shared.length){const {x,y}=shared[0];select(a,x,pair.id,pair.brief);select(b,y,pair.id,pair.brief);pairOutcomes[pair.id]='Same recipe ratios in both palettes; targets differ because one paint changed.';}
  else{pairOutcomes[pair.id]='No jointly qualifying recipe in this cohort. Best individual survivors are exploratory, not a matched A/B pair.';
    for(const p of pair.palettes){const pool=results.get(`${p}-${pair.style}`)!.sort((a,b)=>merit(b)-merit(a));if(pool[0])select(p,pool[0],pair.id,pair.brief+' No matched counterpart qualified; exploratory test.');}
  }
}
// Preserve two known-good targets as named references, remeasured at live
// tolerance. They are NOT included in the generated-cohort yield denominator.
for(const p of [10,5]){
  const old=prior.holes.find(h=>h.levelIndex===p&&h.analysis.style==='interior-weave')!;
  const a=analyzeDesign(p,old.record.target,'interior-weave',atlases.get(p),true);
  if(a.failures.length)throw new Error(`Reference ${p} no longer qualifies: ${a.failures}`);
  select(p,{index:999,recipe:old.record.target,analysis:a},'reference','Known-good interior target, remeasured at current tolerance. Compare the new routes against this reference.',true);
}
const bank={version:'lab-4',signature:paletteSignature(15),holes:selected};
const path='app/generated/play-lab-round4.json',old=JSON.parse(readFileSync(path,'utf8'));
if(old.holes.length&&JSON.stringify(old)!==JSON.stringify(bank))throw new Error('Immutable bank exists. Create a new version.');
writeFileSync(path,JSON.stringify(bank));
writeFileSync('docs/play-palette-experiment.json',JSON.stringify({version:'routes-2',tolerance:LIVE_LANDING_TOLERANCE,cohort:'96 seeded recipes per palette; identical ratios within each single-paint substitution pair',report,pairOutcomes,focusedSearches},null,2));
console.log(`Saved ${selected.length} tests`,pairOutcomes);
