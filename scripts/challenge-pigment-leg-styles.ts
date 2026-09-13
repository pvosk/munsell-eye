import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {mixtureColor,colorDistance,LIVE_LANDING_TOLERANCE as T} from '../app/play-engine';
import {legReplay} from '../app/play-pigment-legs';
import {subsets,permutations} from './pigment-leg-search';
import {legGeometry,measureLegRegion,type LegStyle} from './pigment-leg-metrics';
import {rng} from './premix-hybrid';
import {readBankJson} from './research-bank-io';
const output='docs/pigment-leg-style-challenge-1';
if(existsSync(output))throw Error('Archive exists');mkdirSync(output,{recursive:true});
const input=[1,2].flatMap(n=>readBankJson(`docs/pigment-leg-search-${n}/audits.json`)).filter(a=>a.origin==='selected-baseline'&&Object.values(a.summary.styles).some((s:any)=>s.status.startsWith('unopposed')));
const rows:any[]=[];let endpoints=0,geometryChecks=0;const begin=Date.now();
writeFileSync(output+'/manifest.json',JSON.stringify({seed:613919,ids:input.map(a=>a.p.id),policy:'Attack unopposed labels across alternate accepted controls, not just endpoint minima. Finite samples, no universal style proof.'}));
for(const [index,a] of input.entries()){
 const styles=Object.keys(a.summary.styles).filter(k=>a.summary.styles[k].status.startsWith('unopposed')) as LegStyle[],depth=a.summary.robustMinimum;
 const raw:Partial<Record<LegStyle,unknown>>={},supported:Partial<Record<LegStyle,unknown>>={};
 const random=rng(613919+index),p=a.p;
 let sampled=0,accepted=0;
 outer:for(const set of subsets(p.paints.length,depth))for(const order of permutations(set)){
  const anchors=a.measured.filter((r:any)=>r.legs.map((l:any)=>l.paint).join()===order.join());
  const count=depth<=2?2048:768;
  for(let i=0;i<count;i++){
   const anchor=anchors.length?anchors[i%anchors.length]:null;
   const legs=order.map((paint,j)=>({paint,share:Math.max(0,Math.min(1-1e-9,anchor&&i%2?anchor.legs[j].share+(random()-.5)*.5:random()))}));
   sampled++;endpoints++;if(colorDistance(mixtureColor(p.paints,legReplay(p.start,legs)),p.target)>T)continue;accepted++;
   const g=legGeometry(p.paints,p.start,p.target,legs);geometryChecks++;
   const violated=styles.filter(style=>!g.traits[style]&&!supported[style]);if(!violated.length)continue;
   const region=measureLegRegion(p.paints,p.start,p.target,legs);
   for(const style of violated){if(!raw[style])raw[style]=region;if(region.supported)supported[style]=region;}
   if(styles.every(style=>supported[style]))break outer;
  }
 }
 rows.push({id:p.id,method:a.method,depth,styles,sampled,accepted,rawBypasses:raw,supportedBypasses:supported});
 writeFileSync(output+'/checks.json',JSON.stringify(rows));
 if(index%12===0)console.log(JSON.stringify({done:index+1,total:input.length,seconds:(Date.now()-begin)/1000}));
}
const summary={cases:rows.length,claims:rows.reduce((n,r)=>n+r.styles.length,0),rawBypasses:rows.reduce((n,r)=>n+Object.keys(r.rawBypasses).length,0),supportedBypasses:rows.reduce((n,r)=>n+Object.keys(r.supportedBypasses).length,0),endpoints,geometryChecks,seconds:(Date.now()-begin)/1000};
writeFileSync(output+'/summary.json',JSON.stringify(summary));console.log(JSON.stringify(summary));
