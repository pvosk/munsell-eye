import {readFileSync,writeFileSync} from 'node:fs';
import {PLAY_LEVELS,mixtureColor,colorPoint,colorDistance,LIVE_LANDING_TOLERANCE} from '../app/play-engine';
import {premixReplay} from '../app/play-premix';
const draft=JSON.parse(readFileSync('docs/premix-campaign-draft-1.json','utf8'));
const signature=(paints:any[])=>JSON.stringify(paints.map(p=>[p.id,p.rgb,p.strength]));
const known=PLAY_LEVELS.map(p=>signature(p.paints)),palettes:any[]=[],holes:any[]=[],chapters:any[]=[];
for(const c of draft.chapters){
 let level=known.indexOf(signature(c.paints));
 if(level<0){level=known.length;known.push(signature(c.paints));palettes.push({name:c.name,subtitle:'Prepared mixtures',labOnly:true,tolerance:LIVE_LANDING_TOLERANCE,paints:c.paints});}
 const ids:string[]=[];
 for(const [stage,s] of c.slots.entries()){
  const order:number[]=[],times:number[]=[];
  for(const leg of s.exampleExecution)for(const t of leg.times){order.push(leg.paint);times.push(t);}
  const error=colorDistance(mixtureColor(c.paints,premixReplay(s.start,order,times,'normalized')),colorPoint(s.target.rgb));
  if(error>LIVE_LANDING_TOLERANCE||Math.abs(s.start.reduce((a:number,b:number)=>a+b,0)-1)>1e-8)throw Error('Invalid specimen '+s.id);
  const id=s.id.replace('draft-1','1');ids.push(id);
  // Provisional player allowance, based on executable releases, NOT pigment legs.
  const par=Math.max(3,times.length+1);
  const measurement={order,times,error,finishWindowMs:0,setupCoverage:0,supported:true,label:'Proportion-supported research example; live timing not calibrated'};
  holes.push({id,level,stage,title:s.title,style:s.title,initial:s.start,targetRGB:s.target.rgb,paints:c.paints.map((p:any)=>[p.id,p.rgb,p.strength]),collection:'public',par,source:s.source,sourceId:s.sourceId,foundLegs:s.foundMinimum,modes:{normalized:{order,times,error,minimum:times.length,measurement,rivals:[]}}});
 }
 chapters.push({name:c.name,level,ids});
}
writeFileSync('app/generated/play-public-campaign.json',JSON.stringify({version:'premix-campaign-1',seed:190915,tolerance:LIVE_LANDING_TOLERANCE,palettes,chapters,holes},null,2)+'\n');
console.log({chapters:chapters.length,holes:holes.length,addedPalettes:palettes.length});
