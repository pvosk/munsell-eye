// Supplement: test the EXISTING interior-gap proposal method on a new seed.
// Broad random yield and directed-generator yield must not be conflated.
import {readFileSync,writeFileSync} from 'node:fs';
import type {PaintColor} from '../app/paint-mixing';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeJourney,selectPortfolio} from '../app/play-journey-analysis';

const source=JSON.parse(readFileSync('docs/play-journey-inspection.json','utf8')) as {
 sourceHash:string;holdoutRoster:string[];roster:{id:string;name:string;paints:PaintColor[]}[]};
const protocol={seed:20291207,proposals:96,shortlist:3,
 note:'Supplement decided after broad fresh checks exposed a sampler mismatch. New seed, unchanged gap proposal and scoring criteria. Tests directed generator repeatability, not unbiased random yield or enjoyment.'};
const roster=source.roster.filter(p=>source.holdoutRoster.includes(p.id)&&p.paints.length===4);
const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Directed fresh check',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
const started=performance.now();
const checked=roster.map(palette=>{
 PLAY_LEVELS[scratch].paints=palette.paints;
 const proposalAtlas=makeAtlas(scratch,128,24),samples=proposalAtlas.flatMap(a=>a.samples);
 let state=protocol.seed;const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
 const candidates=Array.from({length:protocol.proposals},(_,i)=>{
  const amounts=palette.paints.map(p=>Math.exp((rng()-.5)*2)/p.strength),mass=amounts.reduce((a,b)=>a+b,0),recipe=amounts.map(v=>v/mass);
  const target=mixtureColor(palette.paints,recipe);
  return {id:`${palette.id}-directed-fresh-${i}`,recipe,target,
   gap:Math.min(...samples.map(s=>Math.hypot(...s.lab.map((v,j)=>v-target.lab[j]))))};
 }).sort((a,b)=>b.gap-a.gap);
 const selected:typeof candidates=[];
 for(const c of candidates){if(selected.some(p=>colorDistance(c.target,p.target)<LIVE_LANDING_TOLERANCE))continue;selected.push(c);if(selected.length===protocol.shortlist)break;}
 const atlas=makeAtlas(scratch,512,96);
 const items=selected.map(c=>({id:c.id,recipe:c.recipe,proposalGap:c.gap,audit:analyzeJourney(scratch,c.recipe,atlas,protocol.seed)}));
 const distinct=selectPortfolio(items).selected.map(c=>c.id);
 console.log('DIRECTED FRESH',palette.id,'interior',items.filter(c=>c.audit.styles.interior.allResistant).length,'distinct',distinct.length);
 return {palette,items,distinct};
});
PLAY_LEVELS.pop();
writeFileSync('docs/play-journey-targeted-holdout.json',JSON.stringify({sourceHash:source.sourceHash,protocol,seconds:(performance.now()-started)/1000,checked},null,2)+'\n');
