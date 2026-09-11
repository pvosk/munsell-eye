import{readFileSync,writeFileSync}from'node:fs';
import{CAMPAIGN_PLAN}from'../app/play-campaign-plan';
import{PLAY_LEVELS,generateHole,withLiveLanding,mixtureColor,colorDistance}from'../app/play-engine';
import{labEntries,LAB_GROUPS,type LabSpecimen}from'../app/play-lab-model';
import{makeAtlas,replayRoute}from'../app/play-course-analysis';
import{analyzeJourney}from'../app/play-journey-analysis';
import{experienceSupported}from'../app/play-experience-audit';
const backup=process.argv[2];if(!backup)throw Error('Supply reviewed lab export (only public hole snapshots are retained).');
const entries=labEntries(JSON.parse(readFileSync(backup,'utf8')).events);
const sources:LabSpecimen[]=[...LAB_GROUPS.flatMap(g=>g.items),...entries.map(e=>e.attempt.specimen),{levelIndex:0,hole:generateHole(0,5,2)},{levelIndex:0,hole:generateHole(0,6,0)}];
const checks:{id:string;sourceId:string;audit:ReturnType<typeof analyzeJourney>}[]=[];
const chapters=CAMPAIGN_PLAN.map((chapter,index)=>({...chapter,id:`campaign-draft-1-${index}`,slots:chapter.slots.map((slot,stage)=>{
 const id=`campaign-draft-1-${index}-${stage}`;if(!slot.sourceId)return{...slot,id,specimen:null};
 const source=sources.find(s=>s.hole.courseId===slot.sourceId&&s.levelIndex===chapter.levelIndex);if(!source)throw Error('Missing '+slot.sourceId);
 let hole=withLiveLanding({...source.hole,courseId:id,stage});
 if(index===0&&stage<2){const audit=analyzeJourney(0,source.hole.recipe,makeAtlas(0,256,48));
  if(audit.failures.length)throw Error('Candidate failed '+audit.failures.join());
  checks.push({id,sourceId:slot.sourceId,audit});
  if(stage===1){const routes=audit.bases.flatMap(b=>b.routes).filter(r=>experienceSupported(r)&&r.valueFinish.valueLed&&r.valueFinish.direction==='rise').sort((a,b)=>a.times.length-b.times.length||b.finishWindowMs-a.finishWindowMs);
   if(!routes.length)throw Error('No lift witness');const r=routes[0];hole={...hole,routeOrder:r.order,routeTimes:r.times,recipe:r.recipe};}
 }
 const landed=mixtureColor(PLAY_LEVELS[chapter.levelIndex].paints,replayRoute(chapter.levelIndex,hole.routeOrder,hole.routeTimes));
 if(colorDistance(landed,hole.target)>hole.tolerance+1e-8)throw Error('Invalid witness '+id);
 return{...slot,id,specimen:{levelIndex:chapter.levelIndex,hole}};
})}));
writeFileSync('app/generated/play-campaign-lab.json',JSON.stringify({version:'campaign-draft-1',chapters})+'\n');
writeFileSync('docs/play-campaign-candidate-checks.json',JSON.stringify(checks)+'\n');
console.log(chapters.map(c=>`${c.name}: ${c.slots.filter(s=>s.specimen).length}/${c.slots.length} candidates`).join('\n'));
