import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {readBankJson} from './research-bank-io';
const output=process.env.LEG_INDEX_OUTPUT??'docs/pigment-leg-results-1';
if(existsSync(output))throw Error('Archive exists');mkdirSync(output,{recursive:true});
const sources=[1,2].map(n=>`docs/pigment-leg-search-${n}/audits.json`);
const audits=sources.flatMap(path=>readBankJson(path).map((a:any)=>({path,a})));
const holdout=readBankJson('docs/pigment-leg-holdout-1/checks.json');
const styleChecks=JSON.parse(readFileSync('docs/pigment-leg-style-challenge-1/checks.json','utf8'));
const resolutionPath='docs/pigment-leg-results-1/resolution.json';
const resolution=existsSync(resolutionPath)?JSON.parse(readFileSync(resolutionPath,'utf8')):null;
const candidates=audits.map(({path,a})=>{
 const h=holdout.find((x:any)=>x.id===a.p.id),s=styleChecks.find((x:any)=>x.id===a.p.id);
 const resolutionWarnings=resolution?.flips.filter((r:any)=>r.id===a.p.id)??[];
 const styles=Object.fromEntries(Object.entries(a.summary.styles).map(([key,value])=>{
  const v=value as any;
  // The endpoint audit alone is never a promotion-level style certificate.
  const status=s?.supportedBypasses[key]?'competitive-after-control-challenge':s?.rawBypasses[key]?'raw-bypass-window-unconfirmed':v.rawBypasses.length?'raw-alternative-observed':v.status.startsWith('unopposed')?(s?'unopposed-after-finite-control-challenge':'awaiting-control-challenge'):v.status;
  return[key,{status:resolutionWarnings.some((r:any)=>r.changed.includes(key))?'sampling-sensitive':status,available:a.measured.some((r:any)=>r.traits[key]),efficientMatches:v.matches,measuredEfficientRoutes:v.efficient,controlChallenge:s?{path:'docs/pigment-leg-style-challenge-1/checks.json',id:s.id}:null}];
 }));
 return{id:a.p.id,method:a.method,origin:a.origin,parent:a.parent??null,paletteName:a.p.paletteName,paints:a.p.paints,start:a.p.start,target:a.p.target,
  demonstration:a.p.demonstration,intent:a.intent??null,rawMinimum:a.summary.rawMinimum,regionSupportedMinimum:a.summary.robustMinimum,
  bestShorterErrorsT:h?h.bestT:a.bestByDepth.slice(0,Math.max(1,a.summary.rawMinimum-1)),
  structuralThreeLegCandidate:a.summary.rawMinimum===3&&a.summary.robustMinimum===3&&h?.survives===true&&!a.profile.nearOne&&!a.profile.tinyEfficientLeg,
  profile:a.profile,styles,source:{path,id:a.p.id},holdout:h?{path:'docs/pigment-leg-holdout-1/checks.json',id:h.id,survives:h.survives}:null,
  resolutionWarnings:resolutionWarnings.length?{path:resolutionPath,id:a.p.id,count:resolutionWarnings.length}:null,humanReview:null,livePromotion:false};
});
const paletteMap=new Map<string,any>();
for(const c of candidates){const key=JSON.stringify(c.paints.map((p:any)=>[p.id,p.rgb,p.strength]).sort());let row=paletteMap.get(key);if(!row){row={paints:c.paints,knownName:c.paletteName.startsWith('Unpromoted')?null:c.paletteName,cases:[],structuralCandidates:[],note:'Sampled cases, not a completed course or globally ranked palette'};paletteMap.set(key,row);}row.cases.push(c.id);if(c.structuralThreeLegCandidate)row.structuralCandidates.push(c.id);}
writeFileSync(output+'/index.json',JSON.stringify({version:'pigment-leg-bank-1',policy:'Keep every audited case, including shortcuts and weak examples. Separate intent, measured alternatives and human review. No required-style claim. No live promotion.',proposalArchives:[1,2].map(n=>({manifest:`docs/pigment-leg-search-${n}/manifest.json`,proposals:`docs/pigment-leg-search-${n}/proposal-bank.json`,screened:`docs/pigment-leg-search-${n}/screened-bank.json`})),candidates,palettes:[...paletteMap.values()]}));
console.log(JSON.stringify({cases:candidates.length,palettes:paletteMap.size,structuralThreeLegCandidates:candidates.filter(c=>c.structuralThreeLegCandidate).length}));
