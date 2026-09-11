import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance,type Mixture} from '../app/play-engine';
import {makeAtlas,paletteSignature,playerPar} from '../app/play-course-analysis';
import {analyzeDesign,type DesignAnalysis} from '../app/play-route-design';
import {measureStyleCoverage,coverageEligible,compareStyleCoverage,routeSupported,type StyleCoverage,type FocusStyle} from '../app/play-style-coverage';
import {focusMatches,rideFailures,type evaluateFocused} from './discover-focused-palettes';

type Evaluation=ReturnType<typeof evaluateFocused>;
const main=JSON.parse(readFileSync('docs/play-focused-discovery.json','utf8')) as {holdout:Evaluation[]};
const extra=JSON.parse(readFileSync('docs/play-focused-finalists.json','utf8')) as {supplemental:Evaluation};
const sources=[...main.holdout,extra.supplemental];
const plans:{index:number;id:string;focuses:FocusStyle[]}[]=[
  {index:15,id:'focused-2-3-10-12',focuses:['chromatic-ride','chromatic-ride']},
  {index:16,id:'focused-1-6-7-11',focuses:['opposing-colors','opposing-colors']},
  {index:17,id:'focused-3-4-9-16',focuses:['opposing-colors','opposing-colors']},
  {index:18,id:'focused-1-5-8-10',focuses:['opposing-colors','chromatic-ride']},
];
const minimumCoverage=.5;
const brief=(focus:FocusStyle)=>focus==='chromatic-ride'?'A sustained chromatic pour, with worthwhile alternatives from other bases.':focus==='value-hue-balance'?'Improve value with a colored paint, then repair the resulting hue/chroma cost.':'Balance colored additions that pull in opposing hue/chroma directions.';
type Candidate={recipe:Mixture;analysis:DesignAnalysis;coverage:StyleCoverage;worstWindow:number};
const holes=[];
for(const plan of plans){
  const source=sources.find(e=>e.trial.id===plan.id);if(!source)throw new Error(`Missing ${plan.id}`);
  const paints=PLAY_LEVELS[plan.index].paints;
  if(JSON.stringify(paints)!==JSON.stringify(source.trial.paints))throw new Error('Paint definition mismatch');
  const atlas=makeAtlas(plan.index,256,48),chosen:Mixture[]=[];
  for(const [stage,focus] of plan.focuses.entries()){
    const pool:Candidate[]=[];
    for(const e of source.results.find(r=>r.focus===focus)!.examples){
      if(chosen.some(q=>colorDistance(mixtureColor(paints,q),mixtureColor(paints,e.recipe))<2*LIVE_LANDING_TOLERANCE))continue;
      const a=analyzeDesign(plan.index,e.recipe,focus==='chromatic-ride'?'chromatic-ride':'coupled-balance',atlas,true);
      const t=mixtureColor(paints,e.recipe);
      if(focus==='chromatic-ride')a.failures=rideFailures(a,Math.hypot(t.lab[1],t.lab[2]));
      const coverage=measureStyleCoverage(a,r=>focusMatches(plan.index,r,e.recipe,focus));
      if(!coverageEligible(a,coverage,minimumCoverage))continue;
      pool.push({recipe:e.recipe,analysis:a,coverage,worstWindow:Math.min(...a.bases.map(b=>Math.max(...b.routes.filter(routeSupported).map(r=>r.finishWindowMs))))});
    }
    pool.sort((a,b)=>compareStyleCoverage(a.coverage,b.coverage)||b.worstWindow-a.worstWindow);
    const c=pool[0];if(!c)throw new Error(`No qualifying ${focus} hole ${stage+1} for ${plan.id}; do not silently lower the floor`);
    chosen.push(c.recipe);
    const route=c.analysis.bases.flatMap(b=>b.routes).filter(r=>routeSupported(r)&&focusMatches(plan.index,r,c.recipe,focus)).sort((a,b)=>b.finishWindowMs-a.finishWindowMs)[0];
    const shots=Math.min(...c.analysis.bases.map(b=>b.fewestFound??Infinity));
    const hash=createHash('sha256').update(JSON.stringify([plan.id,focus,c.recipe])).digest('hex').slice(0,12);
    const analysis={...c.analysis,version:'focused-coverage-1',styleBases:c.coverage.styleBases,
      search:'Every base: 257 one-pour and 49×49 two-pour samples per order, six refinements; three-pour recipe witnesses. Sampled, not proof.'};
    holes.push({levelIndex:plan.index,stage,focus,coverage:c.coverage,analysis,brief:brief(focus),
      record:{id:`lab-5-${plan.index}-${stage}-${hash}`,target:c.recipe,recipe:route.recipe,order:route.order,times:route.times,
        par:playerPar(shots,route.window,focus==='chromatic-ride'?.4:.8),timingWindow:route.window,solutionShots:shots,kind:focus}});
    console.log(`${PLAY_LEVELS[plan.index].name} ${stage+1}: ${focus}, style ${c.coverage.styleBases.length}/${c.coverage.total}, widest-window style ${c.coverage.easiestStyleBases.length}/${c.coverage.total}, par ${holes.at(-1)!.record.par}`);
  }
}
const bank={version:'lab-5',signature:paletteSignature(19),minimumCoverage,selection:'Every-base support mandatory; rank style-base share, then widest-window style share, then weakest-base finishing window. Targets separated by two scoring tolerances. Existing playerPar formula and calibration unchanged.',holes};
const path='app/generated/play-lab-round5.json';
if(existsSync(path)){const old=JSON.parse(readFileSync(path,'utf8'));if(old.holes.length&&JSON.stringify(old)!==JSON.stringify(bank))throw new Error('Immutable round 5 exists; create a new version');}
writeFileSync(path,JSON.stringify(bank));
console.log(`Saved ${holes.length} immutable lab tests.`);
