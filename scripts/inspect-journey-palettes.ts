import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,rgbToLab} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeJourney,rankJourney,compareRank,selectPortfolio,JOURNEY_POLICY,type JourneyAudit,type JourneyStyle} from '../app/play-journey-analysis';

const protocol={version:'palette-journeys-1',seed:20261119,holdoutSeed:20281119,
 independentFamilies:['random','secondary','value-span','chromatic-triad','opposed-pairs','dark-and-light'],perFamily:4,
 controls:[0,1,2,4,5,10,16,17],training:24,gapCandidates:96,gapShortlist:2,adaptivePerStyle:4,
 holdoutPalettes:8,holdoutTargets:36,densePerStyle:3,threeDoseChecks:8,
 note:'Protocol fixed before results. Training comparisons calibrate search; fresh recipes do not independently validate enjoyment. No par, physics, live bank or UI changes.',policy:JOURNEY_POLICY};
const styles:JourneyStyle[]=['interior','ride','value-shift','balance'];
const randomFor=(seed:number)=>{let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};
const rng=randomFor(protocol.seed),catalogue=[...new Map([...PAINTS,...PLAY_LEVELS.flatMap(l=>l.paints)].map(p=>[p.id,p])).values()];
const lab=(p:PaintColor)=>rgbToLab(p.rgb),chroma=(p:PaintColor)=>Math.hypot(...lab(p).slice(1));
const pick=(items:PaintColor[])=>items[Math.floor(rng()*items.length)];
type Palette={id:string;name:string;family:string;paints:PaintColor[];control:number|null};
const roster:Palette[]=protocol.controls.map(i=>({id:`control-${i}`,name:PLAY_LEVELS[i].name,family:'control',paints:PLAY_LEVELS[i].paints,control:i}));
const signatures=new Set(roster.map(p=>p.paints.map(p=>p.id).sort().join()));
for(const family of protocol.independentFamilies)for(let index=0;index<protocol.perFamily;index++){
 let paints:PaintColor[]=[];
 for(let retry=0;retry<100;retry++){
  paints=[];const add=(pool:PaintColor[])=>{paints.push(pick(pool.filter(p=>!paints.some(q=>q.id===p.id))));};
  if(family==='secondary'){for(const c of ['Orange','Violet','Green'])add(catalogue.filter(p=>p.category===c));add(catalogue.filter(p=>p.category===(index%2?'Yellow':'White')));}
  else if(family==='value-span'){add(catalogue.filter(p=>lab(p)[0]<.45));add(catalogue.filter(p=>lab(p)[0]>.78));add(catalogue);add(catalogue);}
  else if(family==='dark-and-light'){for(let i=0;i<3;i++)add(catalogue.filter(p=>lab(p)[0]<.6&&chroma(p)>.06));add(catalogue.filter(p=>lab(p)[0]>.8));}
  else if(family==='opposed-pairs'){
   for(let pair=0;pair<2;pair++){add(catalogue.filter(p=>chroma(p)>.08));const a=lab(paints.at(-1)!).slice(1);add(catalogue.filter(p=>{const b=lab(p).slice(1);return chroma(p)>.08&&(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b))<-.5;}));}
  }else if(family==='chromatic-triad'){for(let i=0;i<3;i++)add(catalogue.filter(p=>chroma(p)>.1));}
  else for(let i=0;i<4;i++)add(catalogue);
  const key=paints.map(p=>p.id).sort().join();if(!signatures.has(key)){signatures.add(key);break;}
  if(retry===99)throw new Error('Failed unique palette sampling');
 }
 roster.push({id:`${family}-${index}`,name:paints.map(p=>p.name).join(' / '),family,paints,control:null});
}
const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Offline journey inspection',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
const normalize=(q:number[])=>q.map(v=>v/q.reduce((a,b)=>a+b,0));
function recipes(paints:PaintColor[],seed:number,count:number){
 const random=randomFor(seed),out:number[][]=[];
 for(let n=0;n<count;n++){
  const order=paints.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const q=paints.map(()=>0),group=n%4,active=group===1?2:group===2?Math.min(3,paints.length):paints.length;
  for(const i of order.slice(0,active))q[i]=Math.exp((random()-.5)*(group===0?2:4))/(group===0?paints[i].strength:1);
  if(group===3){for(const i of order)q[i]=.006+random()*.12;q[order[0]]=1;}
  out.push(normalize(q));
 }return out;
}
const sources=['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-journey-analysis.ts','scripts/inspect-journey-palettes.ts'];
const sourceHash=createHash('sha256').update(sources.map(p=>readFileSync(p,'utf8')).join('\n')).digest('hex');
const cache='/tmp/chroma-journeys-1';mkdirSync(cache,{recursive:true});
writeFileSync(`${cache}/frozen-protocol.json`,JSON.stringify({protocol,sourceHash,roster},null,2));
type Candidate={id:string;recipe:number[];audit:JourneyAudit;phase:string};
const started=performance.now();let calls=0,hits=0;
function evaluate(palette:Palette,recipe:number[],id:string,phase:string,atlas:ReturnType<typeof makeAtlas>,resolution:string,threeSeed?:number):Candidate{
 const key=createHash('sha256').update(JSON.stringify([sourceHash,palette.paints,recipe,resolution,threeSeed])).digest('hex'),path=`${cache}/${key}.json`;
 let audit:JourneyAudit;
 if(existsSync(path)){audit=JSON.parse(readFileSync(path,'utf8'));hits++;}else{audit=analyzeJourney(scratch,recipe,atlas,threeSeed);writeFileSync(path,JSON.stringify(audit));}
 calls++;return {id,recipe,audit,phase};
}
function summary(items:Candidate[]){const portfolio=selectPortfolio(items);return {checked:items.length,safe:items.filter(c=>!c.audit.failures.length).length,
 styles:Object.fromEntries(styles.map(s=>[s,{eligible:items.filter(c=>c.audit.styles[s].eligible).length,allAvailable:items.filter(c=>c.audit.styles[s].allAvailable).length,allResistant:items.filter(c=>c.audit.styles[s].allResistant).length}])),
 distinct:portfolio.selected.map(c=>c.id),repeated:portfolio.excluded,
 valueZones:[...new Set(portfolio.selected.map(c=>c.audit.target.lab[0]<.45?'low':c.audit.target.lab[0]>.7?'high':'middle'))],
 chromaZones:[...new Set(portfolio.selected.map(c=>Math.hypot(...c.audit.target.lab.slice(1))<.05?'quiet':Math.hypot(...c.audit.target.lab.slice(1))>.12?'chromatic':'moderate'))]};}
const training:{palette:Palette;items:Candidate[];summary:ReturnType<typeof summary>}[]=[];
for(const palette of roster){
 PLAY_LEVELS[scratch].paints=palette.paints;const atlas=makeAtlas(scratch,128,24);
 const items=recipes(palette.paints,protocol.seed+1,protocol.training).map((q,i)=>evaluate(palette,q,`${palette.id}-train-${i}`,'broad-training',atlas,'128/24'));
 // Structure-directed interior proposals use distance to the complete sampled
 // one/two-addition atlas, not distance to pure paints or a featured route.
 const proposals=recipes(palette.paints,protocol.seed+17,protocol.gapCandidates*4).filter((_,i)=>i%4===0);
 const allSamples=atlas.flatMap(a=>a.samples);
 const gap=proposals.map(q=>{const target=mixtureColor(palette.paints,q);return {q,target,gap:Math.min(...allSamples.map(s=>Math.hypot(...s.lab.map((v,i)=>v-target.lab[i]))))};}).sort((a,b)=>b.gap-a.gap);
 const selected:typeof gap=[];
 for(const c of gap){if(selected.some(p=>colorDistance(p.target,c.target)<LIVE_LANDING_TOLERANCE))continue;selected.push(c);if(selected.length===protocol.gapShortlist)break;}
 for(const [i,c] of selected.entries())items.push(evaluate(palette,c.q,`${palette.id}-gap-${i}`,'interior-gap',atlas,'128/24'));
 // Target search is directed by audited competition, separately for each style.
 for(const style of styles.slice(1))for(let i=0;i<protocol.adaptivePerStyle;i++){
  const parent=[...items].sort((a,b)=>compareRank(rankJourney(a.audit,style),rankJourney(b.audit,style)))[0];
  const q=[...parent.recipe],slot=Math.floor(rng()*q.length);q[slot]=Math.max(.008,q[slot])*Math.exp((rng()-.5)*2);
  items.push(evaluate(palette,normalize(q),`${palette.id}-${style}-${i}`,`adaptive-${style}`,atlas,'128/24'));
 }
 const result={palette,items,summary:summary(items)};training.push(result);
 console.log('TRAIN',palette.id,'safe',result.summary.safe,'distinct',result.summary.distinct.length,'styles',JSON.stringify(result.summary.styles));
 writeFileSync(`${cache}/progress.json`,JSON.stringify({sourceHash,phase:'training',done:training.map(t=>({palette:t.palette,summary:t.summary}))}));
}
// Freeze selected PALETTES before looking at independent target seeds. Preserve
// specialists as well as multi-hole candidates and untouched controls.
const chosen:typeof training=[];
const add=(p:typeof training[number])=>{if(!chosen.includes(p)&&chosen.length<protocol.holdoutPalettes)chosen.push(p);};
for(const style of styles){const ranked=[...training].filter(t=>t.palette.control===null).sort((a,b)=>b.summary.styles[style].eligible-a.summary.styles[style].eligible||b.summary.distinct.length-a.summary.distinct.length);add(ranked[0]);}
for(const control of [5,10])add(training.find(t=>t.palette.control===control)!);
for(const t of [...training].filter(t=>t.palette.control===null).sort((a,b)=>b.summary.distinct.length-a.summary.distinct.length||b.summary.safe-a.summary.safe))add(t);
const frozen=chosen.map(t=>t.palette.id);writeFileSync(`${cache}/holdout-roster.json`,JSON.stringify(frozen));
const holdouts=[];
for(const t of chosen){
 PLAY_LEVELS[scratch].paints=t.palette.paints;const atlas=makeAtlas(scratch,128,24);
 const items=recipes(t.palette.paints,protocol.holdoutSeed,protocol.holdoutTargets).map((q,i)=>evaluate(t.palette,q,`${t.palette.id}-fresh-${i}`,'fresh',atlas,'128/24'));
 const record={palette:t.palette,items,summary:summary(items)};holdouts.push(record);console.log('FRESH',t.palette.id,JSON.stringify(record.summary));
}
const dense=[];
for(const t of chosen){
 PLAY_LEVELS[scratch].paints=t.palette.paints;const atlas=makeAtlas(scratch,256,48),fresh=holdouts.find(h=>h.palette.id===t.palette.id)!;
 const candidates=[...t.items,...fresh.items],selected=new Map<string,Candidate>();
 for(const style of styles)for(const c of [...candidates].filter(c=>c.audit.styles[style].eligible).sort((a,b)=>compareRank(rankJourney(a.audit,style),rankJourney(b.audit,style))).slice(0,protocol.densePerStyle))selected.set(c.id,c);
 const items=[...selected.values()].map(c=>evaluate(t.palette,c.recipe,c.id,c.phase,atlas,'256/48'));
 dense.push({palette:t.palette,items,summary:summary(items)});console.log('DENSE',t.palette.id,items.length,'safe',dense.at(-1)!.summary.safe,'distinct',dense.at(-1)!.summary.distinct.length);
}
const deeper=[];
for(const t of dense){
 PLAY_LEVELS[scratch].paints=t.palette.paints;const atlas=makeAtlas(scratch,512,96);
 const c=[...t.items].filter(c=>!c.audit.failures.length).sort((a,b)=>Number(Object.values(b.audit.styles).some(s=>s.allResistant))-Number(Object.values(a.audit.styles).some(s=>s.allResistant))||b.audit.minTravel-a.audit.minTravel)[0];
 if(c){const item=evaluate(t.palette,c.recipe,c.id,c.phase,atlas,'512/96/three',protocol.seed);deeper.push({palette:t.palette,item});console.log('THREE',t.palette.id,JSON.stringify(item.audit.styles),item.audit.failures);}
}
// Stronger checks supersede earlier claims for the SAME target, including failures.
for(const checked of deeper){const row=dense.find(t=>t.palette.id===checked.palette.id)!;row.items=row.items.map(c=>c.id===checked.item.id?checked.item:c);row.summary=summary(row.items);}
// Exemplar archives never disappear because their palette lacks a course.
const singleHoles=dense.flatMap(t=>t.items.filter(c=>Object.values(c.audit.styles).some(s=>s.eligible)).map(c=>({palette:t.palette.id,id:c.id,phase:c.phase,recipe:c.recipe,styles:c.audit.styles,source:c.audit.threeExplored?'dense-plus-three':'dense'})));
const result={protocol,sourceHash,seconds:(performance.now()-started)/1000,calls,cacheHits:hits,poolSize:catalogue.length,roster,
 training,holdoutRoster:frozen,holdouts,dense,deeper,singleHoles,
 limitations:['24 independent palette constructions, not exhaustive coverage of 87 paints. Families are stratified, not uniform random over all combinations.',
 'The 24 broad training targets and 36 fresh targets share a fixed pair/triple/full/near-base sampling distribution. Adaptive and gap targets are selected, not unbiased yield estimates.',
 'Three-dose multistart checks only apply to deeper finalists. Numerical search and retained timing-supported representatives are not global proofs.',
 'Style and portfolio thresholds are provisional, frozen before this run; feedback calibrates them but does not independently validate enjoyment.',
 'Portfolio separation includes easiest routes, but is a conservative greedy subset, not optimal packing. Single-hole archive is not a human-approved collection.',
 'General safety replaces the old blanket 1.8-tolerance pure-distance exclusion with actual inside-cup and supported short-direct checks. Old warnings remain derivable; no live scoring changed.']};
// Full route evidence is large; pretty-printing can exceed V8's string limit.
// Presentation-only: leave every evaluation and candidate unchanged.
writeFileSync('docs/play-journey-inspection.json',JSON.stringify(result)+'\n');
PLAY_LEVELS.pop();console.log('DONE',calls,'calls',hits,'cached',((performance.now()-started)/1000).toFixed(1),'seconds');
