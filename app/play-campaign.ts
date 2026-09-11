import raw from './generated/play-campaign-lab.json';
import type {Hole} from './play-engine';
type Specimen={levelIndex:number;hole:Hole};
export type CampaignSlot={id:string;title:string;sourceId:string|null;note:string;specimen:Specimen|null};
export const CAMPAIGN_CHAPTERS=raw.chapters as {id:string;name:string;levelIndex:number;slots:CampaignSlot[]}[];
export function campaignForHole(id:string){
 for(const chapter of CAMPAIGN_CHAPTERS){const slot=chapter.slots.find(s=>s.id===id);if(slot?.specimen)return{chapter,slot};}
 return null;
}
export function campaignSourceId(id:string){return campaignForHole(id)?.slot.sourceId??id;}
export function campaignSnapshot(id:string,levelIndex:number,stage:number,seed:number){
 const s=campaignForHole(id)?.slot.specimen;
 if(!s||s.levelIndex!==levelIndex||s.hole.stage!==stage||s.hole.seed!==seed)throw Error('Unknown campaign specimen');
 return structuredClone(s.hole);
}
export function nextCampaignSpecimen(id:string){
 const row=campaignForHole(id);if(!row)return null;
 const slots=row.chapter.slots.filter(s=>s.specimen),i=slots.findIndex(s=>s.id===id);
 return slots[(i+1)%slots.length].specimen;
}
