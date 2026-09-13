// Package existing inverse-planning evidence; no new search or physics changes.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LIVE_LANDING_TOLERANCE as T,type PlayLevel} from '../app/play-engine';
import {paletteSignature,routeDetails,playerPar} from '../app/play-course-analysis';
import {measureDesignRoute} from '../app/play-route-design';
import {measureJourney} from '../app/play-journey-analysis';
import type {AuditRoute,AuditStyle} from '../app/play-route-audit';
const inputs=['docs/play-new-palette-hardness.json','docs/play-new-palette-hardness-challenge.json'];
const run=JSON.parse(readFileSync(inputs[0],'utf8')), challenge=JSON.parse(readFileSync(inputs[1],'utf8'));
const namesByIndex:Record<number,string>={6:'Secondaries · Green Shade',12:'Magenta Yellow Green',14:'Five-Paint Field'};
const rows=run.results.map((r:any,i:number)=>({...r,trial:{...r.trial,name:namesByIndex[i]},core:true,file:inputs[0],deep:r.deep.filter((h:any)=>challenge.results.some((c:any)=>c.id===h.proposal.id&&c.threeMeaningfulAll))})).filter((r:any)=>r.deep.length);
const names=rows.map((r:any)=>r.trial.name);
const path='app/generated/play-lab-round12.json';
const old=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
const offset=old?.paletteOffset??PLAY_LEVELS.length;
PLAY_LEVELS.length=offset;
const palettes:PlayLevel[]=[],holes:any[]=[];
for(const [i,row] of rows.entries()){
 const survivors=row.deep.filter((h:any)=>!h.checked.failures.length);if(!survivors.length)continue;
 const levelIndex=PLAY_LEVELS.length,p={name:names[i],subtitle:row.trial.paints.map((p:any)=>p.name).join(' · '),paints:row.trial.paints,tolerance:T,labOnly:true};
 PLAY_LEVELS.push(p);palettes.push(p);
 for(const [stage,h] of survivors.entries()){
  const c=h.checked,all=c.bases.flatMap((b:any)=>b.routes),rawMinimum=Math.min(...c.bases.map((b:any)=>b.rawFewest)),supportedMinimum=Math.min(...c.bases.map((b:any)=>b.supportedFewest));
  const allSetup=c.bases.every((b:any)=>b.rawFewest>=2&&b.supportedFewest>=2);
  const preferred=['ride','value-shift','balance'][stage%3];
  const has=(r:any,s:string)=>s==='ride'?r.stable.ride===true:r.witness.traits[s]===true;
  const style=row.value&&all.some((r:any)=>has(r,'value-shift'))?'value-shift':allSetup?'interior':all.some((r:any)=>has(r,preferred))?preferred:all.some((r:any)=>r.glide)?'glide':all.some((r:any)=>has(r,'balance'))?'balance':'direct';
  const offered=all.filter((r:any)=>style==='interior'?r.witness.times.length>=2:style==='glide'?r.glide:style==='direct'?true:has(r,style)).sort((a:any,b:any)=>b.witness.finishWindowMs-a.witness.finishWindowMs);
  const cache=new Map<string,AuditRoute>();
  const typed=(w:any):AuditRoute=>{const key=JSON.stringify([w.order,w.times]);const old=cache.get(key);if(old)return old;
   const r=measureJourney(levelIndex,measureDesignRoute(levelIndex,routeDetails(levelIndex,w.order,w.times,h.proposal.target,T),h.proposal.target),h.proposal.target);
   const out={...r,setup:w.setup??r.setup,traits:Object.entries(w.traits??r.traits).filter(([,v])=>v).map(([s])=>({interior:'interior-weave',ride:'chromatic-ride','value-shift':'setup-lift',balance:'value-hue-balance'}[s])).filter(Boolean) as AuditStyle[]};cache.set(key,out);return out;
  };
  const raw=c.bases.flatMap((b:any)=>b.rawWitnesses),known=[...all.map((r:any)=>r.witness),...raw];
  const shortest=[...known].sort((a:any,b:any)=>a.times.length-b.times.length||a.error-b.error)[0];
  const close=[...c.bases].sort((a:any,b:any)=>a.startDistance-b.startDistance)[0];
  const roles={intended:typed(offered[0].witness),shortest:typed(shortest),closest:typed(close.routes[0].witness)};
  const available=c.bases.filter((b:any)=>b.routes.some((r:any)=>style==='interior'?r.witness.times.length>=2:style==='glide'?r.glide:style==='direct'?true:has(r,style))).map((b:any)=>b.base);
  const bypass=c.bases.filter((b:any)=>b.routes.some((r:any)=>style==='interior'?r.witness.times.length<2:style==='glide'?!r.glide:style==='direct'?false:!has(r,style))).map((b:any)=>b.base);
  const robust=available.filter((b:number)=>!bypass.includes(b));
  const label={interior:c.bases.every((b:any)=>b.rawFewest>=3)?'Three-plus addition setup':'Multi-start setup',ride:'Chromatic ride opportunity','value-shift':'Value-shift finish',balance:'Hue/value balancing',glide:'Setup + long finish',direct:'Direct mixing contrast'}[style]!;
  const focus:AuditStyle=style==='ride'?'chromatic-ride':style==='value-shift'?'setup-lift':style==='balance'?'value-hue-balance':'interior-weave';
  const brief=`${row.core?'Fresh harder candidate · no one/two-addition shortcut found in two numerical passes. ':'Lighter contrast · one-addition alternatives remain. '}${allSetup?'Supported routes require three or more additions from every base.':'Some bases have a one-addition approach.'} ${available.length}/${p.paints.length} starts offer this experience among retained timing-supported routes; ${robust.length}/${p.paints.length} have no retained supported alternative without it. Raw / timing-supported minima by base: ${c.bases.map((b:any)=>`${b.rawFewest}/${b.supportedFewest}`).join(', ')}. Sampled evidence, not proven minima. Labels describe the featured route, not a required play style.`;
  const analysis={version:'inverse-portfolios-1',style:focus==='value-hue-balance'?'coupled-balance':focus,tolerance:T,nearestBase:Math.min(...c.bases.map((b:any)=>b.startDistance)),failures:[],qualifyingBases:c.bases.map((b:any)=>b.base),styleBases:available,minTravel:Math.min(...all.map((r:any)=>r.witness.length)),travelBalance:0,robustThree:c.bases.every((b:any)=>b.rawFewest>=3&&b.supportedFewest>=3),search:'Archived backward proposals + independent bounded shortcut search; raw rivals retained.',bases:c.bases.map((b:any)=>({base:b.base,fewestFound:b.rawFewest,bestOneError:null,bestTwoError:null,minimumTravel:Math.min(...b.routes.map((r:any)=>r.witness.length)),qualifies:b.viable,routes:[...new Map([...b.rawWitnesses,...b.routes.slice(0,4).map((r:any)=>r.witness),...Object.values(roles).filter(r=>r.order[0]===b.base)].map((w:any)=>[JSON.stringify([w.order,w.times]),typed(w)])).values()]}))};
  const r=roles.intended;
  holes.push({sourceId:h.proposal.id,sourceRound:'inverse-portfolios-1',levelIndex,stage,focus,label,emphasis:allSetup?'flexibility':'experience',brief,analysis,roles,coverage:{availableBases:available,robustBases:robust,bypassBases:bypass,availableRatio:available.length/p.paints.length,robustRatio:robust.length/p.paints.length,eligible:robust.length===p.paints.length,failures:bypass.length?['style-bypass-remains']:[]},evidence:{core:row.core,rawMinimum,supportedMinimum,bases:c.bases.map((b:any)=>({paint:b.paint,raw:b.rawFewest,supported:b.supportedFewest})),sourceFile:row.file},record:{id:`lab-12-${levelIndex}-${stage}-${h.proposal.id}`,target:h.proposal.recipe,targetRGB:h.proposal.target.rgb,recipe:r.recipe,order:r.order,times:r.times,par:playerPar(supportedMinimum,r.window,allSetup?.8:.4),timingWindow:r.window,solutionShots:rawMinimum,kind:style}});
 }
}
const out={version:'lab-12',seed:20260914,paletteOffset:offset,signature:paletteSignature(PLAY_LEVELS.length),palettes,selection:'Six fresh harder targets across three newer palettes; bounded every-base shortcut checks; unchanged controls, pigments and tolerance.',sources:inputs.map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})),holes};
if(old&&JSON.stringify(old)!==JSON.stringify(out))throw Error('Preserve immutable lab');
writeFileSync(path,JSON.stringify(out));console.log({holes:holes.length,palettes:palettes.length,offset});
