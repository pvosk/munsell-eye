import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,CHARGE_SECONDS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {makeAtlas,routeDetails,replayRoute} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {EXPERIENCE_POLICY,analyzeExperience,experienceMatches,experienceSupported,rideShape,type Experience} from '../app/play-experience-audit';
import protocol from '../docs/play-rides-value-shift-protocol.json';

type Audit=ReturnType<typeof analyzeExperience>;
const directions=['ride','rise','drop'] as const,started=performance.now();
const cache='/tmp/chroma-rides-shifts-1';mkdirSync(cache,{recursive:true});
const hash=createHash('sha256');
for(const p of ['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-experience-audit.ts'])hash.update(readFileSync(p));
const sourceHash=hash.digest('hex'),protocolHash=createHash('sha256').update(JSON.stringify(protocol)).digest('hex');
const results=[];
for(const seed of protocol.seeds)for(const palette of protocol.palettes){
  const paints=PLAY_LEVELS[palette].paints,pure=paints.map((_,i)=>mixtureColor(paints,paints.map((_,j)=>+(i===j))));
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
  const proposals=Array.from({length:protocol.proposalsPerPalettePerSeed},(_,i)=>{
    const count=1+i%Math.min(3,paints.length-1),order=[Math.floor(random()*paints.length)];
    while(order.length<=count){const p=Math.floor(random()*paints.length);if(!order.includes(p))order.push(p);}
    const times=order.slice(1).map(()=>CHARGE_SECONDS*(.06+.94*random()**2));
    const recipe=replayRoute(palette,order,times),target=mixtureColor(paints,recipe);
    const measured=measureDesignRoute(palette,routeDetails(palette,order,times,target,LIVE_LANDING_TOLERANCE),target,false,LIVE_LANDING_TOLERANCE);
    return {id:`rs-${seed}-${palette}-${i}`,recipe,target,order,times,measured,
      separation:Math.min(...pure.map(p=>Math.hypot(...p.position.map((v,j)=>v-target.position[j]))))};
  });
  const selected:{proposal:typeof proposals[number];direction:Experience}[]=[];
  for(const direction of directions){
    const ranked=proposals.filter(p=>experienceMatches(p.measured,direction)).sort((a,b)=>b.separation-a.separation||
      (direction==='ride'?b.measured.longestChromaticPour-a.measured.longestChromaticPour:Math.abs(b.measured.finishValue)-Math.abs(a.measured.finishValue)));
    const taken:typeof proposals=[];
    for(const p of ranked){if(taken.some(t=>colorDistance(t.target,p.target)<2*LIVE_LANDING_TOLERANCE))continue;taken.push(p);selected.push({proposal:p,direction});if(taken.length===protocol.shortlistPerDirection)break;}
  }
  const atlas=makeAtlas(palette,128,24),checked=[];
  for(const {proposal:p,direction} of selected){
    const key=createHash('sha256').update(sourceHash+JSON.stringify([paints,p.recipe])).digest('hex'),file=`${cache}/${key}.json`;
    const audit:Audit=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):analyzeExperience(palette,p.recipe,atlas);
    if(!existsSync(file))writeFileSync(file,JSON.stringify(audit));
    checked.push({id:p.id,direction,recipe:p.recipe,audit});
  }
  const unique=[...new Map(checked.map(c=>[c.id,c])).values()];
  const counts=Object.fromEntries((['ride','rise','drop','value-shift'] as const).map(s=>[s,{
    opportunity:unique.filter(c=>c.audit.styles[s].opportunity).length,
    allAvailable:unique.filter(c=>c.audit.styles[s].everyBaseAvailable).length,
    allResistant:unique.filter(c=>c.audit.styles[s].everyBaseResistant).length}]));
  results.push({seed,palette,name:PLAY_LEVELS[palette].name,proposed:proposals.length,
    matching:Object.fromEntries(directions.map(s=>[s,proposals.filter(p=>experienceMatches(p.measured,s)).length])),
    checked,uniqueChecked:unique.length,baseProtected:unique.filter(c=>!c.audit.failures.length).length,counts});
  console.log(seed,PLAY_LEVELS[palette].name,JSON.stringify({checked:unique.length,counts}));
  // Checkpoint results for a bounded interrupted run; not a published bank.
  writeFileSync(`${cache}/progress.json`,JSON.stringify({sourceHash,protocolHash,results}));
}
// Verify strongest protected opportunities plus strongest protected near-miss
// for each direction/seed. All-base ride floor is ranked before the showcase.
const finalists=[];
for(const seed of protocol.seeds)for(const direction of directions){
  const candidates=[...new Map(results.filter(r=>r.seed===seed).flatMap(r=>r.checked).map(c=>[c.id,c])).values()].filter(c=>!c.audit.failures.length);
  const score=(a:Audit)=>[Number(a.styles[direction].everyBaseResistant),Number(a.styles[direction].everyBaseAvailable),Number(a.styles[direction].opportunity),
    direction==='ride'?a.rideFloor:a.styles[direction].available.length/a.bases.length,a.minimumTravel];
  candidates.sort((a,b)=>{const av=score(a.audit),bv=score(b.audit);for(let i=0;i<av.length;i++)if(Math.abs(bv[i]-av[i])>1e-8)return bv[i]-av[i];return 0;});
  for(const c of candidates.slice(0,2)){
    const audit=analyzeExperience(c.audit.palette,c.recipe,makeAtlas(c.audit.palette,256,48));
    const routes=audit.bases.flatMap(b=>b.routes).filter(r=>experienceSupported(r)&&experienceMatches(r,direction));
    routes.sort((a,b)=>direction==='ride'?b.longestChromaticPour-a.longestChromaticPour:Math.abs(b.finishValue)-Math.abs(a.finishValue));
    const witness=routes[0]??null;
    finalists.push({id:c.id,seed,direction,audit,witness,shape:witness?rideShape(audit.palette,witness):null});
    console.log('DENSE',seed,direction,PLAY_LEVELS[audit.palette].name,JSON.stringify(audit.styles[direction]),'floor',audit.minimumTravel.toFixed(1));
  }
}
writeFileSync('docs/play-rides-value-shift-results.json',JSON.stringify({sourceHash,protocolHash,policy:EXPERIENCE_POLICY,protocol,seconds:(performance.now()-started)/1000,results,finalists,
  limitations:['Fresh-seed replication is not player validation. No reviewed target recipes used.',
    'Proposal separation is a lower-bound heuristic, not a guarantee of a long ride; full all-base audits decide acceptance.',
    'One/two additions are sampled across all orders with refinement; three-addition witnesses follow generating-recipe permutations.',
    'Resistance means no retained supported efficient bypass found, not an exhaustive proof.',
    'Curvature is reported separately and is not a pass threshold. Up/down are reported separately and together.',
    'No live lab, palette definitions, par or tolerance changed. Intended labels remain visible in a subsequent lab.']},null,2)+'\n');
console.log('DONE',((performance.now()-started)/1000).toFixed(1),'seconds');
