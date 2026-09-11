import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE,mixtureColor,colorDistance} from '../app/play-engine';
import {routeDetails,replayRoute,makeAtlas,playerPar,paletteSignature} from '../app/play-course-analysis';
import {measureDesignRoute,type DesignAnalysis} from '../app/play-route-design';
import {analyzeAudit,auditTraits,timingSupported,type AuditStyle,type AuditRoute,type AuditedHole} from '../app/play-route-audit';
import {assessStartBias} from '../app/play-route-starts';

const STYLES=['setup-lift','chromatic-ride','interior-weave','opposing-colors'] as const;
const palettes=[0,1,2,4,5,7,8,10,16,17,19,20];
const seed=20260929;
let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
const strength=(r:AuditRoute,style:AuditStyle)=>{
  if(style==='chromatic-ride')return r.longestChromaticPour*r.chromaticFraction;
  if(style==='setup-lift')return r.finishValue*80+Math.min(30,r.setupTravel)*.4+Math.min(40,r.lastLength)*.4;
  if(style==='opposing-colors')return r.opposedPairs*12+r.coupledPairs*10+Math.min(60,r.length)*.3+r.meaningfulPours*5;
  return r.meaningfulPours*16+Math.min(70,r.length)*.25+(r.setup?Math.max(0,.8-r.setup.coverage)*12:0);
};
type Candidate={palette:number;recipe:number[];audit:AuditedHole;score:number;style:typeof STYLES[number];intended:AuditRoute};
const candidates:Candidate[]=[],proposalLog=[];
const started=performance.now();
for(const palette of palettes){
  const paints=PLAY_LEVELS[palette].paints,atlas=makeAtlas(palette,128,24);
  for(const style of STYLES){
    const proposals:{recipe:number[];score:number}[]=[];
    // Generate routes toward a brief, then audit the resulting targets. These
    // controls propose targets; they are never assumed to be optimal solutions.
    for(let n=0;n<180;n++){
      const base=Math.floor(random()*paints.length),order=[base];
      const additions=paints.length>=4&&n%3===0?3:2;
      while(order.length<=additions){const i=Math.floor(random()*paints.length);if(!order.includes(i))order.push(i);}
      if(style==='setup-lift'){
        const brightest=order.reduce((a,b)=>paints[a].v>paints[b].v?a:b);
        if(brightest===base)continue;
        order.splice(order.indexOf(brightest),1);order.push(brightest);
      }
      const times=order.slice(1).map((_,i)=>.22+random()*(style==='chromatic-ride'&&i===order.length-2?.95:.63));
      const recipe=replayRoute(palette,order,times),target=mixtureColor(paints,recipe);
      const m=measureDesignRoute(palette,routeDetails(palette,order,times,target,LIVE_LANDING_TOLERANCE),target,false,LIVE_LANDING_TOLERANCE);
      const traits=auditTraits(palette,m,target);if(!traits.includes(style)||m.finishWindowMs<55)continue;
      const nearest=Math.min(...paints.map((_,i)=>colorDistance(target,mixtureColor(paints,paints.map((_,j)=>+(i===j))))));
      if(nearest<1.8*LIVE_LANDING_TOLERANCE)continue;
      proposals.push({recipe,score:strength({...m,traits},style)});
    }
    proposals.sort((a,b)=>b.score-a.score);
    const selected:typeof proposals=[];
    for(const p of proposals){if(selected.some(s=>colorDistance(mixtureColor(paints,s.recipe),mixtureColor(paints,p.recipe))<2*LIVE_LANDING_TOLERANCE))continue;selected.push(p);if(selected.length===5)break;}
    let passed=0;
    for(const p of selected){
      const audit=analyzeAudit(palette,p.recipe,atlas);if(audit.failures.length)continue;
      if(style==='interior-weave'&&audit.globalFewest===1)continue;
      const routes=audit.bases.flatMap(b=>b.routes).filter(r=>timingSupported(r)&&r.traits.includes(style));
      routes.sort((a,b)=>strength(b,style)-strength(a,style));if(!routes.length)continue;
      passed++;candidates.push({palette,recipe:p.recipe,audit,style,score:strength(routes[0],style),intended:routes[0]});
    }
    proposalLog.push({palette,style,proposed:180,matching:proposals.length,audited:selected.length,passed});
    console.log(`${PLAY_LEVELS[palette].name} ${style}: ${proposals.length} matching proposals, ${selected.length} audited, ${passed} supported opportunities`);
  }
}
const chosen:Candidate[]=[],holes=[];
for(const style of STYLES){
  for(const emphasis of ['experience','flexibility'] as const){
    const ranked=candidates.filter(c=>c.style===style&&!chosen.some(s=>s.palette===c.palette&&colorDistance(s.audit.target,c.audit.target)<2*LIVE_LANDING_TOLERANCE));
    const flexibility=(c:Candidate)=>c.audit.styles[style].availableRatio*100+c.audit.styles[style].robustRatio*20+
      Number(assessStartBias(PLAY_LEVELS[c.palette].paints,c.audit).styles[style].closestStartResistsBypass)*10;
    ranked.sort((a,b)=>emphasis==='experience'?b.score-a.score:flexibility(b)-flexibility(a)||b.score-a.score);
    let winner:Candidate|undefined;
    // Dense verification can discover a competitor that changes the preferred
    // route. Re-select from verified efficient routes, never keep a stale demo.
    for(const c of ranked){
      if(chosen.filter(s=>s.palette===c.palette).length>=4)continue;
      const audit=analyzeAudit(c.palette,c.recipe,makeAtlas(c.palette,256,48));if(audit.failures.length)continue;
      const routes=audit.bases.flatMap(b=>b.routes).filter(r=>timingSupported(r)&&r.traits.includes(style)).sort((a,b)=>strength(b,style)-strength(a,style));
      if(!routes.length)continue;winner={...c,audit,intended:routes[0],score:strength(routes[0],style)};break;
    }
    if(!winner)throw new Error(`No supported ${style}/${emphasis} candidate. Do not substitute a different style.`);
    const c=winner,stage=chosen.filter(s=>s.palette===c.palette).length;chosen.push(c);
    const all=c.audit.bases.flatMap(b=>b.routes),supported=all.filter(timingSupported);
    const shortest=[...supported].sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
    const starts=assessStartBias(PLAY_LEVELS[c.palette].paints,c.audit);
    const closest=supported.filter(r=>starts.closestBases.includes(r.order[0])).sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs)[0];
    if(!closest)throw new Error('Missing closest-start comparison');
    const r=c.intended,id=`lab-6-${c.palette}-${stage}-${createHash('sha256').update(JSON.stringify([style,emphasis,c.recipe])).digest('hex').slice(0,12)}`;
    const roles={intended:r,shortest,closest};
    const analysis:DesignAnalysis={version:'directed-6',style:style==='opposing-colors'?'coupled-balance':style,tolerance:LIVE_LANDING_TOLERANCE,
      nearestBase:c.audit.nearestBase,failures:[],qualifyingBases:c.audit.bases.map(b=>b.base),styleBases:c.audit.styles[style].availableBases,
      minTravel:Math.min(...c.audit.bases.map(b=>b.minimumTravel!)),travelBalance:0,robustThree:c.audit.bases.every(b=>b.fewest===3&&b.bestTwoError>1.1),
      search:'257 one-pour / 49×49 two-pour samples per order with refinement and dose-region variants; three-pour recipe witnesses. Sampled, not a proof.',
      bases:c.audit.bases.map(b=>{
        const keep=[...Object.values(roles).filter(r=>r.order[0]===b.base),...b.routes.filter(timingSupported).sort((a,b)=>b.finishWindowMs-a.finishWindowMs).slice(0,2)];
        const unique=[...new Map(keep.map(r=>[r.order.join()+r.times.join(),r])).values()];
        return {base:b.base,fewestFound:b.fewest,bestOneError:b.bestOneError,bestTwoError:b.bestTwoError,minimumTravel:b.minimumTravel,qualifies:b.viable,routes:unique};
      })};
    const label={ 'setup-lift':'Value lift','chromatic-ride':'Chromatic ride','interior-weave':'Interior setup','opposing-colors':'Complementary balancing'}[style];
    holes.push({levelIndex:c.palette,stage,focus:style,emphasis,label,roles,analysis,starts,coverage:c.audit.styles[style],
      brief:`${label} · ${emphasis==='experience'?'stronger featured experience':'starting-choice flexibility'}. An opportunity, not a required route.`,
      record:{id,target:c.recipe,recipe:r.recipe,order:r.order,times:r.times,par:playerPar(c.audit.globalFewest!,r.window,style==='chromatic-ride'?.4:.8),
        timingWindow:r.window,solutionShots:c.audit.globalFewest!,kind:style}});
    console.log(`SELECT ${label}/${emphasis}: ${PLAY_LEVELS[c.palette].name}; style ${c.audit.styles[style].availableBases.length}/${c.audit.bases.length}, featured ${r.times.length}, fewest ${c.audit.globalFewest}`);
  }
}
const output={version:'lab-6',seed,signature:paletteSignature(21),selection:'Directed route proposals, independent competing-route audit; opportunities ranked for experience vs starting-choice flexibility, not mandatory style. Par and scoring unchanged.',holes};
const path='app/generated/play-lab-round6.json';
if(existsSync(path)&&JSON.stringify(JSON.parse(readFileSync(path,'utf8')))!==JSON.stringify(output))throw new Error('Round 6 already exists; do not overwrite immutable holes');
writeFileSync(path,JSON.stringify(output));
writeFileSync('docs/play-lab-round6-search.json',JSON.stringify({seconds:(performance.now()-started)/1000,seed,proposalLog,candidates},null,2));
console.log(`Saved 8 immutable directed tests in ${((performance.now()-started)/1000).toFixed(1)} seconds.`);
