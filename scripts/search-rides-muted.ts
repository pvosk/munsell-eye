// Offline, frozen-proposal comparison. Never modifies live palettes or controls.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,rgbToLab} from '../app/play-engine';
import {makeAtlas,replayRoute,routeDetails} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {analyzeJourney,measureJourney,sampleJourney,rankJourney,compareRank,selectPortfolio,JOURNEY_POLICY,type JourneyAudit} from '../app/play-journey-analysis';
import {experienceSupported} from '../app/play-experience-audit';

export const PROTOCOL={version:'rides-muted-1',paletteSeed:20261214,seeds:[20261215,20291215],pool:96,shortlist:3,
 methods:['direct-ride','setup-ride','value-shift','broad'] as const,screen:[128,24],dense:[512,96],densePerPalette:2,
 policy:JOURNEY_POLICY,note:'Same fixed palettes and proposal rules on both seeds. Second seed is fresh target generation, not independent palette selection or player validation. Criteria unchanged. No runtime changes.'};
export const rngFor=(seed:number)=>{let s=seed;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};
const normalize=(q:number[])=>q.map(x=>x/q.reduce((a,b)=>a+b,0));
const lab=(p:PaintColor)=>rgbToLab(p.rgb),chroma=(p:PaintColor)=>Math.hypot(...lab(p).slice(1));
export const noAchromaticPigment=(p:PaintColor)=>!['White','Black'].includes(p.category)&&!/(PW\d|PBk\d)/i.test(p.pigment??'');
type Palette={id:string;name:string;family:string;paints:PaintColor[]};
export function roster(){
 const catalogue=[...new Map([...PAINTS,...PLAY_LEVELS.flatMap(p=>p.paints)].map(p=>[p.id,p])).values()];
 const controls=['CMY','Secondaries','Zorny','Magenta Grove','Ultramarine Gold'].map(name=>{const p=PLAY_LEVELS.find(p=>p.name===name);if(!p)throw Error('Missing '+name);return {id:'control-'+name.toLowerCase().replaceAll(' ','-'),name,family:'control',paints:p.paints};});
 const eligible=catalogue.filter(noAchromaticPigment),dark=eligible.filter(p=>lab(p)[0]<.45&&chroma(p)>.065),light=eligible.filter(p=>lab(p)[0]>.78&&chroma(p)>.095),muted=eligible.filter(p=>lab(p)[0]>.35&&lab(p)[0]<.67&&chroma(p)<.095);
 const rng=rngFor(PROTOCOL.paletteSeed),pick=(ps:PaintColor[])=>ps[Math.floor(rng()*ps.length)],keys=new Set<string>();
 const out:Palette[]=[...controls];
 const earth=muted.filter(p=>['green-earth','terre-verte','raw-sienna','burnt-sienna','transparent-earth-yellow','chromium-oxide-green','indian-red'].includes(p.id));
 for(let i=0;i<8;){const paints=[pick(dark),pick(light),pick(i<4?earth:muted)],key=paints.map(p=>p.id).sort().join();if(new Set(paints.map(p=>p.id)).size<3||keys.has(key))continue;keys.add(key);out.push({id:'muted-'+i++,name:paints.map(p=>p.name).join(' / '),family:'dark-light-muted',paints});}
 for(const [i,ids] of [['ultramarine-blue','nickel-titanate-yellow','green-earth','cadmium-red-light'],['perylene-maroon','hansa-yellow-light','raw-sienna','cobalt-blue']].entries()){
  const paints=ids.map(id=>{const p=catalogue.find(p=>p.id===id);if(!p)throw Error(id);return p;});
  out.push({id:'adjacent-'+i,name:paints.map(p=>p.name).join(' / '),family:'chromatic-zorn-adjacent',paints});
 }
 return {catalogueSize:catalogue.length,pools:{dark:dark.map(p=>p.id),light:light.map(p=>p.id),muted:muted.map(p=>p.id)},palettes:out};
}
type Method=typeof PROTOCOL.methods[number];
export function propose(palette:number,method:Method,seed:number){
 const rng=rngFor(seed),paints=PLAY_LEVELS[palette].paints,n=paints.length;
 const pure=paints.map((_,i)=>mixtureColor(paints,paints.map((_,j)=>+(i===j))));
 const candidates=Array.from({length:PROTOCOL.pool},(_,i)=>{
  const order=[Math.floor(rng()*n)];while(order.length<(method==='direct-ride'?2:3)){const next=Math.floor(rng()*n);if(next!==order.at(-1))order.push(next);}
  const times=order.slice(1).map((_,j)=>j===0&&method!=='direct-ride'?.12+rng()*.52:.35+rng()*.95);
  const recipe=method==='broad'?normalize(paints.map(()=>Math.exp((rng()-.5)*4))):normalize(replayRoute(palette,order,times));
  const target=mixtureColor(paints,recipe),nearest=Math.min(...pure.map(p=>colorDistance(p,target)))/LIVE_LANDING_TOLERANCE;
  const route=method==='broad'?null:measureJourney(palette,measureDesignRoute(palette,routeDetails(palette,order,times,target,LIVE_LANDING_TOLERANCE),target,false,LIVE_LANDING_TOLERANCE),target);
  const structural=method==='direct-ride'?!!route?.traits.ride:method==='setup-ride'?!!route?.traits.ride&&route.meaningfulPours>=2&&route.setupTravel>=6&&sampleJourney(palette,route).strokes.at(-1)!.chromaticLength>=36:!!route?.traits['value-shift'];
  // Proposal heuristic only. Every shortlisted target gets the same independent
  // competing-route audit. Proposal witnesses never confer acceptance.
  const feature=method==='value-shift'?Math.abs(route?.finish?.signedValue??0):route?.longestChromaticPour??0;
  return {i,recipe,nearest,structural,feature,proposal:method==='broad'?null:{order,times},rank:[Number(structural),Math.min(nearest,6),feature]};
 });
 if(method!=='broad')candidates.sort((a,b)=>compareRank(a.rank,b.rank));
 const selected:typeof candidates=[];
 for(const c of candidates){if(selected.some(p=>colorDistance(mixtureColor(paints,p.recipe),mixtureColor(paints,c.recipe))<LIVE_LANDING_TOLERANCE))continue;selected.push(c);if(selected.length===PROTOCOL.shortlist)break;}
 return {selected,structuralProposals:candidates.filter(c=>c.structural).length,total:candidates.length};
}
export function rideModes(a:JourneyAudit){
 const count=(predicate:(r:JourneyAudit['bases'][number]['routes'][number])=>boolean)=>a.bases.filter(b=>b.routes.some(r=>r.efficient&&experienceSupported(r)&&r.traits.ride&&predicate(r))).map(b=>b.base);
 return {direct:count(r=>r.times.length===1),setup:count(r=>r.times.length>=2&&r.meaningfulPours>=2&&r.setupTravel>=6&&sampleJourney(a.palette,r).strokes.at(-1)!.chromaticLength>=36)};
}
type Item={id:string;method:Method;seed:number;recipe:number[];proposal:{order:number[];times:number[]}|null;structural:boolean;audit:JourneyAudit};
export async function run(){
 const started=performance.now(),design=roster(),scratch=PLAY_LEVELS.length;
 const files=['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-journey-analysis.ts','app/play-experience-audit.ts','scripts/search-rides-muted.ts'];
 const sourceHash=createHash('sha256').update(files.map(p=>readFileSync(p,'utf8')).join('\n')).digest('hex');
 const cache='/tmp/chroma-rides-muted-'+sourceHash.slice(0,12);mkdirSync(cache,{recursive:true});
 writeFileSync(cache+'/protocol.json',JSON.stringify({sourceHash,protocol:PROTOCOL,...design}));
 PLAY_LEVELS.push({name:'Offline rides and muted triads',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
 let evaluations=0,hits=0;
 const audit=(p:Palette,q:number[],atlas:ReturnType<typeof makeAtlas>,resolution:string,three?:number)=>{
  const key=createHash('sha256').update(JSON.stringify([p.paints,q,resolution,three])).digest('hex'),path=cache+'/'+key+'.json';evaluations++;
  if(existsSync(path)){hits++;return JSON.parse(readFileSync(path,'utf8')) as JourneyAudit;}
  const a=analyzeJourney(scratch,q,atlas,three);writeFileSync(path,JSON.stringify(a));return a;
 };
 const compact=(item:Item)=>{const {audit:a,...c}=item;return {...c,target:a.target,failures:a.failures,styles:a.styles,rideModes:rideModes(a),minTravel:a.minTravel,
  bases:a.bases.map(b=>({base:b.base,fewest:b.fewest,startDistance:b.startDistance,one:b.bestOneError,two:b.bestTwoError,approach:b.approach}))};};
 const rows=[];
 for(const palette of design.palettes){
  PLAY_LEVELS[scratch].paints=palette.paints;const atlas=makeAtlas(scratch,...PROTOCOL.screen as [number,number]),items:Item[]=[],proposals=[];
  for(const seed of PROTOCOL.seeds)for(const method of PROTOCOL.methods){
   const proposed=propose(scratch,method,seed);proposals.push({seed,method,total:proposed.total,structural:proposed.structuralProposals});
   for(const c of proposed.selected){const id=`${palette.id}-${method}-${seed}-${c.i}`;items.push({id,method,seed,recipe:c.recipe,proposal:c.proposal,structural:c.structural,audit:audit(palette,c.recipe,atlas,'128/24')});}
   console.log('SCREEN',palette.id,seed,method,items.slice(-3).map(c=>({safe:!c.audit.failures.length,ride:c.audit.styles.ride.eligible,shift:c.audit.styles['value-shift'].eligible})));
  }
  const selected:Item[]=[];
  for(const style of ['ride','value-shift'] as const){const c=[...items].sort((a,b)=>compareRank(rankJourney(a.audit,style),rankJourney(b.audit,style))).find(c=>!selected.some(s=>s.id===c.id));if(c)selected.push(c);}
  const denseAtlas=makeAtlas(scratch,...PROTOCOL.dense as [number,number]);
  const finalists=selected.map(c=>({...c,audit:audit(palette,c.recipe,denseAtlas,'512/96/three',PROTOCOL.paletteSeed)}));
  const finalById=new Map(finalists.map(c=>[c.id,c]));
  const corrected=items.map(c=>finalById.get(c.id)??c);
  const portfolio=selectPortfolio(finalists);
  rows.push({palette,proposals,items:corrected.map(compact),finalists,portfolio:{selected:portfolio.selected.map(c=>c.id),excluded:portfolio.excluded}});
  writeFileSync(cache+'/progress.json',JSON.stringify({sourceHash,evaluations,rows}));
  console.log('PALETTE DONE',palette.id,'verified',finalists.map(c=>({id:c.id,failures:c.audit.failures,ride:c.audit.styles.ride,shift:c.audit.styles['value-shift']})));
 }
 PLAY_LEVELS.pop();
 const results={sourceHash,protocol:PROTOCOL,catalogueSize:design.catalogueSize,pools:design.pools,evaluations,cacheHits:hits,seconds:(performance.now()-started)/1000,cache,rows,
  limitations:['15 stratified palettes, not exhaustive combination search. Palette selection fixed before these results.',
   'Broad comparator audits three of 96 generated targets; directed methods rank all 96 first. Equal audit counts, not equal total compute.',
   'Fresh seed repeats each proposal method on the same palettes, not an independently selected palette cohort.',
   'Two selected targets per palette receive denser and three-dose checks. Their outcomes supersede screening; other screening hits remain provisional.',
   'Numerical searches are bounded, not proofs. 55ms and 4% thresholds are unchanged. A successful proposal is not necessarily an efficient or style-resistant route.',
   'Paint appearances and tint strengths are existing modeled catalogue values, not new measured spectral data. No live lab or game changes.']};
 writeFileSync('docs/play-rides-muted-results.json',JSON.stringify(results)+'\n');
 console.log('DONE',evaluations,'evaluations',results.seconds.toFixed(1),'seconds',cache);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await run();
