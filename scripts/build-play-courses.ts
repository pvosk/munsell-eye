// Generated artifacts only: edit the evaluator/profiles, then regenerate.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { PLAY_LEVELS, mixtureColor } from '../app/play-engine';
import { COURSE_VERSION, PROFILES, analyzeCandidate, makeAtlas, paletteSignature, selectRounds, type CourseRecord } from '../app/play-course-analysis';

const began=performance.now();
const previous=JSON.parse(readFileSync('app/generated/play-courses.json','utf8'));
if(previous.version==='courses-2'&&!existsSync('app/generated/play-courses-v2.json'))writeFileSync('app/generated/play-courses-v2.json',JSON.stringify(previous));
const palettes=[];
const reports=[];
const allCandidates=[];
for(let palette=0;palette<PLAY_LEVELS.length;palette++) {
  const level=PLAY_LEVELS[palette],atlas=makeAtlas(palette),candidates:CourseRecord[]=[];
  console.log(`Evaluating ${level.name}: ${atlas.length} ordered one/two-addition searches, every base.`);
  const add=(seed:number,recipe?:number[])=>{const c=analyzeCandidate(palette,seed,atlas,recipe);if(c)candidates.push(c);};
  for(let i=0;i<160;i++)add((43117+Math.imul(palette+1,73856093)+Math.imul(i+1,19349663))>>>0);
  // Quiet Zorn neutrals need targeted sampling, not just a promise in the label.
  // The catalogue black is slightly warm: these are low-chroma relative cools,
  // not a claim of measured blue undertone in real ivory-black paint.
  if(palette===1)for(let i=0;i<12;i++)add(700000+i,[i%3===0?.04:0,i%3===1?.02:0,1,.3*1.55**i]);
  let rounds:CourseRecord[][]|undefined;
  for(let batch=0;batch<5;batch++) {
    try { rounds=selectRounds(palette,candidates);break; }
    catch(error) {
      if(batch===4)throw error;
      console.log(`${level.name}: expanding candidate search (${candidates.length} eligible so far).`);
      for(let i=0;i<48;i++)add((93417+Math.imul(palette+1,73856093)+Math.imul(i+1+batch*48,19349663))>>>0);
    }
  }
  const selected=rounds!,flat=selected.flat();
  allCandidates.push({palette,name:level.name,candidates});
  const tags=Object.fromEntries([...new Set(candidates.flatMap(c=>c.tags))].map(tag=>[tag,candidates.filter(c=>c.tags.includes(tag)).length]));
  const interactions:Record<string,number>={};
  for(const h of flat)for(let i=1;i<h.order.length;i++) {
    const key=`${level.paints[h.order[i-1]].name} → ${level.paints[h.order[i]].name}`;
    interactions[key]=(interactions[key]??0)+1;
  }
  const lValues=flat.map(h=>mixtureColor(level.paints,h.target).lab[0]);
  palettes.push({name:level.name,profile:PROFILES[palette].name,rounds:selected});
  reports.push({name:level.name,eligible:candidates.length,tags,distinctSelected:new Set(flat.map(h=>h.id)).size,pars:selected.map(r=>r.map(h=>h.par)),bestFoundShots:selected.map(r=>r.map(h=>h.solutionShots)),selectedKinds:selected.map(r=>r.map(h=>h.kind)),lightnessRange:[Math.min(...lValues),Math.max(...lValues)],interactions});
  console.log(`${level.name}: ${candidates.length} eligible. Pars: ${selected.map(r=>r.map(h=>h.par).join('/')).join(' | ')}.`);
}
mkdirSync('app/generated',{recursive:true});mkdirSync('docs',{recursive:true});
writeFileSync('app/generated/play-courses.json',JSON.stringify({version:COURSE_VERSION,signature:paletteSignature(),palettes}));
writeFileSync('docs/play-candidate-audit.json',JSON.stringify({version:COURSE_VERSION,palettes:allCandidates}));
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2:null;};
const kinds=['chromatic-ride','value-finish','quiet-cool','interior','choice','precision','muted'] as const;
const matrix=allCandidates.flatMap(p=>kinds.map(kind=>{
  const proposed=p.candidates.filter(c=>c.proposedTags.includes(kind)),eligible=proposed.filter(c=>c.tags.includes(kind));
  return {palette:p.name,kind,proposed:proposed.length,eligible:eligible.length,
    medianBaseCoverage:median(proposed.map(c=>c.competition.coverage)),
    medianEfficientBaseCoverage:median(proposed.map(c=>c.competition.efficientCoverage)),
    medianTravelBalance:median(proposed.map(c=>c.competition.travelBalance)),
    medianMinimumTravel:median(proposed.map(c=>c.competition.minTravel)),
    medianMinimumFinish:median(proposed.map(c=>c.competition.minFinish)),
    medianTimingMarginMs:median(proposed.map(c=>c.timingWindow*1000)),
    oneAdditionShortcuts:proposed.filter(c=>c.solutionShots===1).length,
    threeOrMoreMultiShotBases:proposed.filter(c=>c.competition.multiShotBases>=3).length};
}));
writeFileSync('docs/play-competition-matrix.json',JSON.stringify({version:COURSE_VERSION,limits:'Deterministic candidate sample. Overlapping computed types, not independently forced generators. One/two-addition search from all bases; recipe witnesses may add longer routes. No proof of continuous optimality or of fun.',rows:matrix},null,2)+'\n');
writeFileSync('docs/play-course-report.json',JSON.stringify({version:COURSE_VERSION,search:{one:'65 charge samples per base/order, three separated local refinements',two:'17 × 17 charge samples per base/order, three separated local refinements',witness:'All permutations of the candidate recipe, up to three additions',limits:'Best found, not a proof of global minimum; three-addition alternatives are not exhaustively searched.',par:'Provisional player allowance: best-found additions + 1; +1 below 55ms timing margin; another +1 below 22ms; +1 on harder palettes for multi-addition routes. Clamped 2–6.',timing:'Most forgiving sampled minimum-shot route. Tightest single-time perturbation margin with later hold times replayed, capped at 300ms. Not the complete joint setup/finish region.',coolZorn:'Low-chroma black-containing relative cools. Current black is slightly warm; no measured blue undertone claim.',interactions:'Counts of consecutive additions along retained routes, not a score of historical or perceptual merit.'},palettes:reports},null,2)+'\n');
console.log(`Saved ${palettes.length*20} evaluated holes in ${Math.round((performance.now()-began)/1000)}s.`);
