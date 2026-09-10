import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,colorDistance} from '../app/play-engine';
import {makeAtlas,analyzeCandidate,paletteSignature,playerPar,PROFILES,type CourseRecord} from '../app/play-course-analysis';
import {analyzeRoutes,type RouteStyle,type HoleAnalysis,type MeasuredRoute} from '../app/play-route-analysis';
import old from '../app/generated/play-lab-round2.json';

const plan:{palette:number;style:RouteStyle;robust?:boolean;reference?:boolean}[]=[
  {palette:4,style:'chromatic-ride'}, {palette:5,style:'chromatic-correction'},
  {palette:1,style:'setup-lift'}, {palette:10,style:'interior-weave',robust:true},
  {palette:11,style:'complementary-balance'}, {palette:5,style:'interior-weave',robust:true,reference:true},
];
const banks=new Map<number,CourseRecord[]>(),atlases=new Map<number,ReturnType<typeof makeAtlas>>();
const selected:{levelIndex:number;stage:number;record:CourseRecord;analysis:HoleAnalysis}[]=[];
for(const brief of plan){
  const p=brief.palette,level=PLAY_LEVELS[p];
  if(!banks.has(p)){
    const atlas=makeAtlas(p),pool:CourseRecord[]=[];
    const cache=`/tmp/chroma-route-pool-3-${p}.json`;
    if(existsSync(cache))pool.push(...JSON.parse(readFileSync(cache,'utf8')));
    else for(let n=0;n<400;n++){
      const seed=(20260912+Math.imul(p+1,83492791)+Math.imul(n+1,2971215073))>>>0,c=analyzeCandidate(p,seed,atlas);
      if(c?.tags.length&&old.palettes.find(x=>x.levelIndex===p)!.holes.slice(0,2).every(h=>colorDistance(mixtureColor(level.paints,c.target),mixtureColor(level.paints,h.target))>level.tolerance*2))pool.push(c);
    }
    writeFileSync(cache,JSON.stringify(pool));
    banks.set(p,pool);atlases.set(p,makeAtlas(p,128,24));console.log(`${level.name}: screened ${pool.length} candidates`);
  }
  // One explicitly identified positive reference makes this a comparison
  // experiment, not six unrelated novel targets. Do not silently substitute.
  const source=brief.reference?[old.palettes.find(x=>x.levelIndex===5)!.holes[0] as CourseRecord]:banks.get(p)!;
  const pool=source.filter(c=>selected.filter(h=>h.levelIndex===p).every(h=>colorDistance(mixtureColor(level.paints,c.target),mixtureColor(level.paints,h.record.target))>level.tolerance*2)&&(!brief.robust||c.competition.bases.every(b=>b.shots===3)));
  const merit=(c:CourseRecord)=>{
    const style=brief.style==='chromatic-ride'?+(c.tags.includes('chromatic-ride'))*5:brief.style==='setup-lift'?+(c.tags.includes('value-finish'))*3:0;
    return style+c.competition.efficientCoverage*2+c.competition.travelBalance+Math.min(c.competition.minTravel,45)/30;
  };
  pool.sort((a,b)=>merit(b)-merit(a));
  const finalists:{c:CourseRecord;a:HoleAnalysis;score:number}[]=[];
  for(const c of pool.slice(0,40)){
    const quick=analyzeRoutes(p,c.target,brief.style,atlases.get(p),false);
    if(quick.failures.length||brief.robust&&!quick.robustThree)continue;
    const a=analyzeRoutes(p,c.target,brief.style,atlases.get(p),true);
    if(a.failures.length||brief.robust&&!a.robustThree)continue;
    const featured=a.bases.flatMap(b=>b.routes).filter(r=>r.styles.includes(brief.style));
    const score=a.qualifyingBases.length*3+a.travelBalance+Math.min(a.minTravel,45)/30+ +(featured.some(r=>r.anticipatory));
    finalists.push({c,a,score});if(finalists.length>=3)break;
  }
  finalists.sort((a,b)=>b.score-a.score);const best=finalists[0];
  if(!best)throw new Error(`${level.name}: no verified ${brief.style} candidate; requirements not relaxed.`);
  const choices=best.a.bases.flatMap(b=>b.routes).filter(r=>r.styles.includes(brief.style)&&r.finishWindowMs>=40);
  const route:MeasuredRoute=choices.sort((a,b)=>b.window-a.window)[0];
  const stage=selected.filter(h=>h.levelIndex===p).length;
  const record={...best.c,id:best.c.id.replace(/^(courses-3|lab-2)-/,'lab-3-'),recipe:route.recipe,order:route.order,times:route.times,timingWindow:route.window,
    // Par uses the fewest FOUND route; the displayed example may be longer.
    solutionShots:Math.min(...best.a.bases.map(b=>b.fewestFound??Infinity)),par:playerPar(Math.min(...best.a.bases.map(b=>b.fewestFound??Infinity)),route.window,PROFILES[p].challenge)};
  selected.push({levelIndex:p,stage,record,analysis:best.a});console.log(`${level.name}: ${brief.style}, ${best.a.qualifyingBases.length} supported starts, robust-three=${best.a.robustThree}`);
}
const bank={version:'lab-3',signature:paletteSignature(),holes:selected};
const path='app/generated/play-lab-round3.json',prior=JSON.parse(readFileSync(path,'utf8'));
if(prior.holes.length&&JSON.stringify(prior)!==JSON.stringify(bank))throw new Error('Immutable lab bank already exists; create a new version.');
writeFileSync(path,JSON.stringify(bank));
writeFileSync('docs/play-lab-round3.md','# Paired-start lab · Round 3\n\nFive fresh targets and one positive reference: test 06 repeats the previously liked Secondaries interior target. Play freely, then compare a different starting paint on the identical target. No palette or physics changes.\n\n| Palette | Route brief | Supported starts | Fewest additions found by base | Robust three |\n|---|---|---|---|---|\n'+selected.map(h=>`| ${PLAY_LEVELS[h.levelIndex].name} | ${h.analysis.style} | ${h.analysis.qualifyingBases.length}/${PLAY_LEVELS[h.levelIndex].paints.length} | ${h.analysis.bases.map(b=>b.fewestFound??'not found').join(', ')} | ${h.analysis.robustThree} |`).join('\n')+'\n\nSupported means passing provisional measured criteria, not independently verified enjoyment. See play-route-measurements.md for definitions and search limits.\n');
