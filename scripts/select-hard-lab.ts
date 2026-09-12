import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {verify} from './backward-verification';
const file='docs/play-hard-lab-selection.json';if(existsSync(file))throw Error('Keep immutable selection');
const probe=JSON.parse(readFileSync('docs/play-interior-proposal-probe.json','utf8'));
const refinements=JSON.parse(readFileSync('docs/play-backward-palette-refinement.json','utf8'));
const jobs:any[]=[];
for(const [name,limit] of [['Secondaries',2],['Zorny',1],['Cobalt Ember',1]] as const){
 const row=probe.results.find((r:any)=>r.name===name);
 for(const h of row.checked.filter((h:any)=>!h.audit.failures.length&&h.audit.bases.every((b:any)=>b.fewest===3)).slice(0,limit)){
  jobs.push({name:name+' · Setup tests',id:h.id,paints:PLAY_LEVELS[row.palette].paints,target:h.audit.target,recipe:h.recipe,known:h.audit.bases.flatMap((b:any)=>b.routes),core:true});
 }
}
const parent=refinements.results.find((r:any)=>r.variant.label==='parent');
for(const goal of ['light-warm','lavender']){const h=parent.holes.find((h:any)=>h.goal===goal),c=h.assessment;jobs.push({name:'Lemon Violet Blue',id:'backward-parent-'+goal,paints:parent.trial.paints,target:h.target,known:c.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)]),core:true,value:true});}
const old=JSON.parse(readFileSync('docs/play-expanded-portfolios.json','utf8'));
for(const id of ['mine-9-14-19-30-7','mine-6-15-20-31']){const row=old.results.find((r:any)=>r.deep.some((h:any)=>h.proposal.id===id)),h=row.deep.find((h:any)=>h.proposal.id===id);jobs.push({name:id.includes('9-14')?'Umber Quartet · Contrast':'Ochre Maroon Cerulean · Contrast',id,paints:row.trial.paints,target:h.proposal.target,recipe:h.proposal.recipe,known:[...h.known,...h.inverse.witnesses,...h.checked.bases.flatMap((b:any)=>[...b.rawWitnesses,...b.routes.map((r:any)=>r.witness)])],core:false});}
const results:any[]=[];
for(const j of jobs){console.log('Rechecking',j.name,j.id);const trial={id:j.id,name:j.name,paints:j.paints,control:!j.core,selection:'Hard setup lab',proxy:[]};
 const checked=verify(trial,j.id,j.target,j.known,null);
 const accepted=!checked.failures.length&&(!j.core||checked.bases.every(b=>b.rawFewest!==null&&b.rawFewest>=2&&b.supportedFewest!==null&&b.supportedFewest>=2));
 results.push({job:j,checked,accepted});console.log({accepted,fail:checked.failures,raw:checked.bases.map(b=>b.rawFewest),supported:checked.bases.map(b=>b.supportedFewest)});
 writeFileSync(file,JSON.stringify({version:'hard-lab-1',tolerance:T,results}));
}
