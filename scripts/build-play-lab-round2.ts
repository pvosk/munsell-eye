import {writeFileSync,readFileSync} from 'node:fs';
import {PLAY_LEVELS,generateHole,mixtureColor,colorDistance} from '../app/play-engine';
import {analyzeCandidate,makeAtlas,paletteSignature,qualityFailures,competitionMerit,type CourseRecord,type HoleKind} from '../app/play-course-analysis';
const plan:{levelIndex:number;kinds:HoleKind[]}[]=[
  {levelIndex:4,kinds:['chromatic-ride','muted']},
  {levelIndex:5,kinds:['interior','value-finish']},
  {levelIndex:1,kinds:['interior','precision']},
  {levelIndex:8,kinds:['choice','precision']},
  {levelIndex:10,kinds:['chromatic-ride','interior']},
  {levelIndex:11,kinds:['choice','interior']},
];
const palettes=[];
for(const {levelIndex,kinds} of plan){
  const level=PLAY_LEVELS[levelIndex],atlas=makeAtlas(levelIndex),pool:CourseRecord[]=[];
  const old=levelIndex<10?[0,2,4].flatMap(s=>[generateHole(levelIndex,190926,s).target,generateHole(levelIndex,190926,s,true).target]):[];
  let selected:CourseRecord[]=[];
  for(let batch=0;batch<5;batch++){
    for(let n=0;n<160;n++){
      const seed=(20260911+Math.imul(levelIndex+1,83492791)+Math.imul(n+batch*160+1,2971215073))>>>0;
      const c=analyzeCandidate(levelIndex,seed,atlas);
      if(c?.tags.length&&!qualityFailures(c.competition).length&&old.every(t=>colorDistance(t,mixtureColor(level.paints,c.target))>level.tolerance*2))pool.push(c);
    }
    selected=[];
    for(let slot=0;slot<(levelIndex>=10?5:2);slot++){
      const required=kinds[slot];
      const eligible=pool.filter(c=>(!required||c.tags.includes(required))&&selected.every(h=>h.id!==c.id&&colorDistance(mixtureColor(level.paints,h.target),mixtureColor(level.paints,c.target))>level.tolerance*2));
      if(!eligible.length)break;
      const score=(c:CourseRecord)=>competitionMerit(c,required??c.kind)+c.competition.efficientCoverage*.3;
      const best=eligible.reduce((a,b)=>score(a)>score(b)?a:b);
      selected.push({...best,id:best.id.replace('courses-3-','lab-2-'),kind:required??best.kind});
    }
    if(selected.length===(levelIndex>=10?5:2))break;
    console.log(`${level.name}: expanding search; ${pool.length} eligible, ${selected.length} slots filled.`);
  }
  if(selected.length!==(levelIndex>=10?5:2))throw new Error(`${level.name}: requirements could not be met; no relaxed fallback.`);
  palettes.push({levelIndex,name:level.name,holes:selected});
  console.log(`${level.name}: ${pool.length} eligible; lab ${selected.slice(0,2).map(h=>h.kind+' / '+h.solutionShots+' additions').join(' | ')}`);
}
const bank={version:'lab-2',signature:paletteSignature(),palettes};
const path='app/generated/play-lab-round2.json',prior=JSON.parse(readFileSync(path,'utf8'));
if(prior.palettes.length&&JSON.stringify(prior)!==JSON.stringify(bank))throw new Error('Lab round already exists: use a new version instead of changing saved holes.');
writeFileSync(path,JSON.stringify(bank));
writeFileSync('docs/play-lab-round2.md','# Lab round 2\n\nTwelve new targets: the first two stored holes per palette. All pass the calibrated cross-label shortcut checks. Familiar-palette targets are more than two tolerances from both prior starter batches. This is a test batch, not independently validated quality. The original ten normal courses and saved replays are unchanged. The two new palettes also have five-hole normal courses.\n\n| Palette | Test | Intent | Additions found | Efficient bases | Minimum competing travel |\n|---|---:|---|---:|---:|---:|\n'+palettes.flatMap((p,i)=>p.holes.slice(0,2).map((h,j)=>`| ${p.name} | ${i*2+j+1} | ${h.kind} | ${h.solutionShots} | ${h.competition.bases.filter(b=>b.shots===h.solutionShots).length}/${PLAY_LEVELS[p.levelIndex].paints.length} | ${h.competition.minTravel.toFixed(1)} |`)).join('\n')+'\n\nIntent names describe computed properties, not required play. A choice tag still denotes ingredient alternatives; it does not prove every approach is equally satisfying. Routes are sampled, not globally optimal. Pigment RGB and tinting strengths remain approximations.\n');
