import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,contrastLabBank} from '../app/play-engine';
import {sampleJourney,finishEpisode,type JourneyAudit} from '../app/play-journey-analysis';
import {finishProfile,FINISH_PROFILE_POLICY} from '../app/play-finish-profile';
import {experienceSupported} from '../app/play-experience-audit';
const sources=JSON.parse(readFileSync('docs/play-rides-muted-results.json','utf8')) as {rows:{finalists:{id:string;audit:JourneyAudit}[]}[]};
const references=JSON.parse(readFileSync('docs/play-journey-exceptions.json','utf8')) as {checked:{id:string;audit:JourneyAudit}[]};
const raw=JSON.parse(readFileSync('app/generated/play-lab-round9.json','utf8')) as {holes:{sourceId:string}[]};
const holes=contrastLabBank.holes.map((h,i)=>{
 const source=[...sources.rows.flatMap(r=>r.finalists),...references.checked].find(c=>c.id===raw.holes[i].sourceId);
 if(!source)throw Error('Missing full retained evidence');
 const profile=(r:Parameters<typeof sampleJourney>[1]&{meaningfulPours:number})=>{const {strokes}=sampleJourney(h.levelIndex,r);return finishProfile(strokes,finishEpisode(strokes,source.audit.target),r.meaningfulPours);};
 const bases=source.audit.bases.map(b=>{
  const supported=b.routes.filter(r=>r.efficient&&experienceSupported(r));
  const routes=supported.map(r=>({order:r.order,times:r.times,finish:profile(r)}));
  const led=routes.filter(r=>r.finish.valueLed).length;
  return {base:b.base,name:PLAY_LEVELS[h.levelIndex].paints[b.base].name,retained:routes.length,
   valueLed:led>0,valueLedResistant:routes.length>0&&led===routes.length,
   movement:routes.some(r=>r.finish.valueMovement),routes};
 });
 return {id:h.record.id,palette:PLAY_LEVELS[h.levelIndex].name,intent:h.label,
  featured:profile(h.roles.intended),bases};
});
// Keep detailed evidence offline; the browser loads only compact precomputed rows.
writeFileSync('docs/play-finish-profile-audit.json',JSON.stringify({policy:FINISH_PROFILE_POLICY,holes},null,2)+'\n');
writeFileSync('app/generated/play-finish-profiles.json',JSON.stringify({policy:FINISH_PROFILE_POLICY,holes:holes.map(h=>({...h,bases:h.bases.map(({routes,...b})=>({...b,routeCount:routes.length}))}))})+'\n');
for(const h of holes)console.log(h.palette,h.featured.kind,h.bases.map(b=>`${b.name}: ${b.valueLed?'available':'not found'}${b.valueLedResistant?' / resistant':''}`).join('; '));
