import raw from './generated/play-campaign-lab.json';
import extra from './generated/play-campaign-additions.json';
import type {Hole} from './play-engine';
import type {HoleAnalysis} from './play-route-analysis';
type Specimen={levelIndex:number;hole:Hole};
export type CampaignOption={id:string;sourceId:string;note:string;specimen:Specimen};
export type CampaignSlot={id:string;title:string;sourceId:string|null;note:string;specimen:Specimen|null;alternatives?:CampaignOption[]};
export const CAMPAIGN_CHAPTERS=raw.chapters.map(chapter=>({...chapter,slots:chapter.slots.map(slot=>{
 const added=extra.additions.find(g=>g.slotId===slot.id);
 return added&&!slot.specimen?{...slot,...added.primary,alternatives:added.alternatives}:slot;
})})) as {id:string;name:string;levelIndex:number;slots:CampaignSlot[]}[];
// Presentation order only: specimen IDs and saved reviews remain unchanged.
const zornIndex = CAMPAIGN_CHAPTERS.findIndex(chapter => chapter.name === 'Zorny');
if (zornIndex > 1) CAMPAIGN_CHAPTERS.splice(1, 0, ...CAMPAIGN_CHAPTERS.splice(zornIndex, 1));
export function campaignForHole(id:string){
 for(const chapter of CAMPAIGN_CHAPTERS)for(const slot of chapter.slots){
  if(slot.id===id&&slot.specimen)return{chapter,slot};
  const alternate=slot.alternatives?.find(s=>s.id===id);if(alternate)return{chapter,slot:{...slot,...alternate}};
 }
 return null;
}
export function campaignAnalysis(id:string){
 const source=campaignSourceId(id);
 return extra.additions.flatMap(g=>[g.primary,...g.alternatives]).find(c=>c.sourceId===source)?.analysis as (HoleAnalysis&{tolerance:number})|undefined;
}
export function campaignSourceId(id:string){return campaignForHole(id)?.slot.sourceId??id;}
export function campaignSnapshot(id:string,levelIndex:number,stage:number,seed:number){
 const s=campaignForHole(id)?.slot.specimen;
 if(!s||s.levelIndex!==levelIndex||s.hole.stage!==stage||s.hole.seed!==seed)throw Error('Unknown campaign specimen');
 return structuredClone(s.hole);
}
export function nextCampaignSpecimen(id:string){
 const row=campaignForHole(id);if(!row)return null;
 const slots=row.chapter.slots.filter(s=>s.specimen),i=slots.findIndex(s=>s.id===id||s.alternatives?.some(a=>a.id===id));
 return slots[(i+1)%slots.length].specimen;
}
