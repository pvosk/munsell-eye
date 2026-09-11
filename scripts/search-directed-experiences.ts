// Offline joint palette/target optimization; never edits a live palette.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LANDING_TOLERANCE,LIVE_LANDING_TOLERANCE,colorDistance} from '../app/play-engine';
import {PAINTS,type PaintColor} from '../app/paint-mixing';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeExperience,experienceSupported,EXPERIENCE_POLICY,type Experience} from '../app/play-experience-audit';

type Audit=ReturnType<typeof analyzeExperience>;
type Candidate={id:string;parent:string|null;generation:number;origin:number;paints:PaintColor[];recipe:number[];audit:Audit;score:number[]};
const protocol={version:'directed-experiences-1',seed:20261107,generations:4,beam:4,children:6,
  objective:'Lexicographic: every-base safety, fewer safety failures, style availability from every base, resistant-base fraction, available-base fraction, weakest supported route feature, minimum travel.',
  scope:'Fixed starting palettes plus discrete catalogue substitutions. No RGB/strength changes. Targets are positive recipe proportions; every candidate is audited before ranking.',
  validation:'257/49 dense checks on finalists; 3 fresh target perturbations per finalist palette, same criteria. No claim of global optimality.',policy:EXPERIENCE_POLICY};
let state=protocol.seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
const prior=JSON.parse(readFileSync('docs/play-rides-value-shift-results.json','utf8')) as {finalists:{id:string;audit:Audit}[]};
const sources=['app/play-engine.ts','app/paint-mixing.ts','app/play-course-analysis.ts','app/play-route-analysis.ts','app/play-route-design.ts','app/play-route-audit.ts','app/play-experience-audit.ts','scripts/search-directed-experiences.ts'];
const sourceHash=createHash('sha256').update(sources.map(p=>readFileSync(p,'utf8')).join('\n')).digest('hex');
const catalogue=[...new Map([...PAINTS,...PLAY_LEVELS.flatMap(l=>l.paints)].map(p=>[p.id,p])).values()];
const normalize=(q:number[])=>q.map(v=>v/q.reduce((a,b)=>a+b,0));
const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Offline experiment',subtitle:'Not a live palette',paints:[],tolerance:LANDING_TOLERANCE,labOnly:true});
const atlasCache=new Map<string,ReturnType<typeof makeAtlas>>();
function audit(paints:PaintColor[],recipe:number[],dense=false){
  PLAY_LEVELS[scratch].paints=paints;
  const key=JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]))+dense;
  let atlas=atlasCache.get(key);if(!atlas){atlas=makeAtlas(scratch,dense?256:128,dense?48:24);if(atlasCache.size>8)atlasCache.delete(atlasCache.keys().next().value!);atlasCache.set(key,atlas);}
  return analyzeExperience(scratch,recipe,atlas);
}
function objective(a:Audit,style:Experience){
  const s=a.styles[style],supported=a.bases.map(b=>b.routes.filter(experienceSupported));
  const floor=Math.min(...supported.map(rs=>rs.length?Math.min(...rs.map(r=>style==='ride'?
    Math.min(r.longestChromaticPour/36,r.chromaticFraction/.8):
    r.times.length>=2&&r.meaningfulPours>=2?Math.min(Math.abs(r.finishValue)/.1,r.setupTravel/6,r.lastLength/9):0)):0));
  return [Number(!a.failures.length),-a.failures.length,Number(s.everyBaseAvailable),s.resistant.length/a.bases.length,s.available.length/a.bases.length,Math.min(2,floor),Math.min(60,a.minimumTravel)];
}
const compare=(a:Candidate,b:Candidate)=>{for(let i=0;i<a.score.length;i++)if(Math.abs(a.score[i]-b.score[i])>1e-8)return b.score[i]-a.score[i];return a.id.localeCompare(b.id);};
let serial=0;const log:Candidate[]=[],runs=[];const started=performance.now();
for(const style of ['ride','value-shift'] as const){
  const ids=style==='ride'?['rs-20271013-10-130','rs-20261013-10-94','rs-20271013-20-38','rs-20271013-8-88']:
    ['rs-20271013-17-25','rs-20261013-0-107','rs-20271013-16-25','rs-20261013-7-17'];
  const evaluate=(paints:PaintColor[],recipe:number[],origin:number,generation:number,parent:string|null)=>{
    const a=audit(paints,recipe),c={id:`joint-${style}-${serial++}`,parent,generation,origin,paints,recipe,audit:a,score:objective(a,style)};log.push(c);return c;
  };
  let beam=ids.map(id=>{const a=prior.finalists.find(f=>f.id===id)!.audit;return evaluate(PLAY_LEVELS[a.palette].paints,normalize(a.recipe),a.palette,0,null);});
  const initial=beam.map(c=>({id:c.id,score:c.score,origin:c.origin}));
  for(let generation=1;generation<=protocol.generations;generation++){
    const pool=[...beam];
    for(const parent of beam)for(let child=0;child<protocol.children;child++){
      const paints=[...parent.paints],recipe=[...parent.recipe];
      // Half target-only, half paint substitutions. Re-evaluate all competing
      // bases after EVERY mutation; no featured-route prequalification.
      const slot=Math.floor(random()*paints.length);
      if(child>=3){
        const options=catalogue.filter(p=>!paints.some(q=>q.id===p.id));
        paints[slot]=options[Math.floor(random()*options.length)];
      }
      recipe[slot]=Math.max(.008,recipe[slot])*Math.exp((random()-.5)*(child===2?3:1.6));
      pool.push(evaluate(paints,normalize(recipe),parent.origin,generation,parent.id));
    }
    pool.sort(compare);const next:Candidate[]=[];
    for(const c of pool){
      const key=c.paints.map(p=>p.id).join();
      if(next.filter(p=>p.paints.map(q=>q.id).join()===key).length>=2)continue;
      if(next.some(p=>p.paints.map(q=>q.id).join()===key&&colorDistance(p.audit.target,c.audit.target)<LIVE_LANDING_TOLERANCE))continue;
      next.push(c);if(next.length===protocol.beam)break;
    }
    beam=next;console.log(style,'generation',generation,'best',JSON.stringify(beam[0].score),beam[0].paints.map(p=>p.name).join('/'));
  }
  const ranked=log.filter(c=>c.id.startsWith(`joint-${style}-`)).sort(compare),chosen:Candidate[]=[];
  // Keep fixed and altered palettes represented, not only the best mutation.
  for(const novel of [false,true])for(const c of ranked){
    const changed=c.paints.some((p,i)=>p.id!==PLAY_LEVELS[c.origin].paints[i].id);
    if(changed!==novel||chosen.some(p=>p.paints.map(q=>q.id).join()===c.paints.map(q=>q.id).join()))continue;
    chosen.push(c);if(chosen.filter(p=>p.paints.some((q,i)=>q.id!==PLAY_LEVELS[p.origin].paints[i].id)===novel).length===2)break;
  }
  const finalists=chosen.map(c=>{
    const verified=audit(c.paints,c.recipe,true),neighbors=[];
    for(let i=0;i<3;i++){
      const q=normalize(c.recipe.map(v=>Math.max(.008,v)*Math.exp((random()-.5)*1.6)));
      const a=audit(c.paints,q,true);neighbors.push({recipe:q,target:a.target,failures:a.failures,style:a.styles[style],minimumTravel:a.minimumTravel});
    }
    console.log('VERIFIED',style,c.id,JSON.stringify(verified.styles[style]),verified.failures);
    return {...c,audit:verified,score:objective(verified,style),neighbors};
  });
  runs.push({style,initial,finalists});
}
PLAY_LEVELS.pop();
writeFileSync('docs/play-directed-experiences-results.json',JSON.stringify({protocol,sourceHash,seconds:(performance.now()-started)/1000,
  evaluations:log.length,runs,history:log.map(({audit:a,...c})=>({...c,target:a.target,failures:a.failures,styles:a.styles,minimumTravel:a.minimumTravel})),
  limitations:['Bounded adaptive search, not exhaustive palette optimization or a mathematical proof.',
    'Known candidates seed this search; fresh neighbors are a local generalization check, not an independent test cohort.',
    'Fewest-addition competitors searched numerically; three-addition alternatives limited to recipe witnesses. Resistance means no retained supported efficient bypass found.',
    'Catalogue colors and tinting strengths are game approximations, not measured physical pigment reflectance.',
    'Neighbor targets may overlap and are reported separately; they are not automatically multiple distinct course holes.']},null,2)+'\n');
console.log('DONE',log.length,'audits',((performance.now()-started)/1000).toFixed(1),'seconds');
