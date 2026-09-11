import {readFileSync,writeFileSync} from 'node:fs';
import {evaluateFocused,focusMatches,rideFailures,type Focus} from './discover-focused-palettes';
import {allBaseEligible} from './discover-play-palettes';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeDesign,type DesignRoute} from '../app/play-route-design';

type Evaluation=ReturnType<typeof evaluateFocused>;
const original=JSON.parse(readFileSync('docs/play-focused-discovery.json','utf8')) as {sourceHash:string;training:Evaluation[];holdout:Evaluation[]};
// Keep a representative of the explicit two-pair shortlist family, selected
// from its TRAINING results. Generalists may otherwise win all three rankings.
const family=original.training.filter(e=>!e.trial.control).slice(8,12);
const opposing=(e:Evaluation)=>e.results.find(r=>r.focus==='opposing-colors')!;
family.sort((a,b)=>opposing(b).passes-opposing(a).passes||b.trial.proxy[2]-a.trial.proxy[2]);
const supplemental=evaluateFocused(family[0].trial,20270223,2,'supplemental-family-holdout');
console.log(`Two-pair representative: ${supplemental.trial.paints.map(p=>p.name).join(' / ')}: ${supplemental.results.map(r=>`${r.focus} ${r.passes}/${r.tested}`).join('; ')}`);

const novel=original.holdout.filter(e=>!e.trial.control),selected:{evaluation:Evaluation;focus:Focus}[]=[];
for(const focus of ['chromatic-ride','value-hue-balance','opposing-colors'] as Focus[]){
  const metric=(e:Evaluation)=>e.results.find(r=>r.focus===focus)!;
  const ranked=[...novel].sort((a,b)=>metric(b).passes-metric(a).passes||metric(b).medianWorstFinishMs-metric(a).medianWorstFinishMs);
  if(metric(ranked[0]).passes)selected.push({evaluation:ranked[0],focus});
}
if(opposing(supplemental).passes)selected.push({evaluation:supplemental,focus:'opposing-colors'});

const supported=(r:DesignRoute)=>r.finishWindowMs>=55&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04);
const audits=[];
for(const {evaluation:e,focus} of selected){
  const slot=PLAY_LEVELS.length;
  PLAY_LEVELS.push({name:e.trial.id,subtitle:'Offline dense check',paints:e.trial.paints,tolerance:LIVE_LANDING_TOLERANCE,labOnly:true});
  try{
    // About four times as many two-pour grid samples as the discovery pass.
    const atlas=makeAtlas(slot,256,48);
    for(const example of e.results.find(r=>r.focus===focus)!.examples.slice(0,2)){
      const style=focus==='chromatic-ride'?'chromatic-ride':'coupled-balance';
      const a=analyzeDesign(slot,example.recipe,style,atlas,true);
      const target=mixtureColor(e.trial.paints,example.recipe);
      const failures=focus==='chromatic-ride'?rideFailures(a,Math.hypot(target.lab[1],target.lab[2])):[...a.failures];
      const styleBases=a.bases.filter(b=>b.routes.some(r=>supported(r)&&focusMatches(slot,r,example.recipe,focus))).map(b=>b.base);
      if(!styleBases.length)failures.push('no-supported-focused-route');
      if(!a.bases.every(b=>b.qualifies))failures.push('not-supported-from-every-base');
      const accepted=allBaseEligible({...a,failures});
      audits.push({trial:e.trial,focus,recipe:example.recipe,accepted,failures,styleBases,analysis:{...a,version:'focused-discovery-2-dense-check',failures,
        search:'Every base, 257 one-pour and 49×49 two-pour samples/order, six local refinements; recipe three-pour witnesses. Still sampled, not a proof.'}});
      console.log(`${e.trial.id} ${focus}: ${accepted?'retained':'rejected'}; additions ${a.bases.map(b=>b.fewestFound).join('/')}; style bases ${styleBases.length}/4; minimum travel ${a.minTravel.toFixed(1)}; ${failures.join(', ')}`);
    }
  }finally{PLAY_LEVELS.splice(slot,1);}
}
writeFileSync('docs/play-focused-finalists.json',JSON.stringify({version:'focused-finalists-1',discoverySourceHash:original.sourceHash,
  note:'Supplemental two-pair family winner selected on training yield then pair proxy; evaluated separately. Lab proposals selected from observed holdout successes, not a new unbiased yield estimate.',
  supplemental,audits},null,2));
console.log(`Saved ${audits.filter(a=>a.accepted).length}/${audits.length} densely checked candidate holes; no live changes.`);
