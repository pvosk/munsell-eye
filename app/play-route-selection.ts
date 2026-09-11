// Offline ranking experiment. Not imported by the live course generator.
// Plausible starts are an explicit scenario set, NOT a probability model.
import {mixtureColor,colorDistance} from './play-engine';
import type {PaintColor} from './paint-mixing';
import {timingSupported,type AuditRoute,type AuditStyle,type AuditedHole} from './play-route-audit';

export const SELECTION_VERSION='selection-1-start-floor';
export type StartScope='closest'|'plausible'|'all';
const min=(a:number[])=>a.length?Math.min(...a):0;
const max=(a:number[])=>a.length?Math.max(...a):0;
export function plausibleStarts(paints:PaintColor[],audit:AuditedHole,observed:number[]=[]){
  const pure=paints.map((_,i)=>mixtureColor(paints,paints.map((_,j)=>+(i===j))));
  const distances=pure.map(p=>colorDistance(p,audit.target));
  const closest=distances.flatMap((d,i)=>d<=min(distances)+1e-8?[i]:[]);
  const c=Math.hypot(...audit.target.lab.slice(1));
  const hues=pure.map(p=>{
    const pc=Math.hypot(...p.lab.slice(1));
    return c>=.03&&pc>=.03?Math.acos(Math.max(-1,Math.min(1,(p.lab[1]*audit.target.lab[1]+p.lab[2]*audit.target.lab[2])/(pc*c)))):Infinity;
  });
  // Near neutrals have no stable hue; include only the nearest angular hue(s),
  // with ties, rather than inventing a human-choice likelihood threshold.
  const hue=hues.flatMap((d,i)=>Number.isFinite(d)&&d<=Math.min(...hues)+1e-8?[i]:[]);
  const actual=[...new Set(observed)].filter(i=>Number.isInteger(i)&&i>=0&&i<paints.length);
  return {closest,hue,observed:actual,plausible:[...new Set([...closest,...hue,...actual])].sort((a,b)=>a-b),distances};
}

export function featuredStrength(r:AuditRoute,style:AuditStyle):number{
  if(style==='chromatic-ride')return r.longestChromaticPour*r.chromaticFraction;
  if(style==='setup-lift')return r.finishValue*80+Math.min(30,r.setupTravel)*.4+Math.min(40,r.lastLength)*.4;
  if(style==='opposing-colors'||style==='value-hue-balance')return r.opposedPairs*12+r.coupledPairs*10+Math.min(60,r.length)*.3+r.meaningfulPours*5;
  return r.meaningfulPours*16+Math.min(70,r.length)*.25+(r.setup?Math.max(0,.8-r.setup.coverage)*12:0);
}

export function assessSelection(paints:PaintColor[],audit:AuditedHole,style:AuditStyle,scope:StartScope='plausible',observed:number[]=[]){
  const starts=plausibleStarts(paints,audit,observed);
  const selected=scope==='all'?audit.bases.map(b=>b.base):scope==='closest'?starts.closest:starts.plausible;
  const rows=audit.bases.map(b=>{
    const routes=b.routes.filter(timingSupported),styled=routes.filter(r=>r.traits.includes(style));
    return {base:b.base,fewest:b.fewest,supported:routes.length>0&&b.viable,
      minimumTravel:b.minimumTravel??0,meaningfulFloor:min(routes.map(r=>r.meaningfulPours)),
      // A total-travel lower envelope also caps the retained ride estimate:
      // route grouping can otherwise discard shorter same-trait witnesses.
      rideFloor:Math.min(b.minimumTravel??0,min(routes.map(r=>r.longestChromaticPour))),
      styleAvailable:styled.length>0,styleResistant:styled.length>0&&styled.length===routes.length,
      bestFinishMs:max(routes.map(r=>r.finishWindowMs)),bestTwoError:b.bestTwoError};
  });
  const chosen=rows.filter(b=>selected.includes(b.base));
  const fraction=(f:(b:typeof rows[number])=>boolean,bs=chosen)=>bs.length?bs.filter(f).length/bs.length:0;
  const supportedFraction=fraction(b=>b.supported,rows);
  const profileThree=rows.length>0&&rows.every(b=>b.fewest===3&&b.bestTwoError>1.1&&b.supported&&b.meaningfulFloor===3);
  const travelFloor=min(chosen.map(b=>b.minimumTravel)),allTravelFloor=min(rows.map(b=>b.minimumTravel));
  const meaningfulFloor=min(chosen.map(b=>b.meaningfulFloor)),rideFloor=min(chosen.map(b=>b.rideFloor));
  const styleAvailable=fraction(b=>b.styleAvailable),styleResistant=fraction(b=>b.styleResistant);
  const showcase=max(audit.bases.flatMap(b=>b.routes).filter(r=>timingSupported(r)&&r.traits.includes(style)).map(r=>featuredStrength(r,style)));
  // These are declared priorities, not a fitted scalar "fun score". A huge
  // featured route cannot offset a weak earlier component. No weights fitted
  // to individual reviews. Existing support thresholds remain unchanged.
  const safety=[Number(audit.failures.length===0),supportedFraction];
  const rank=style==='chromatic-ride'
    ?[...safety,rideFloor,min(rows.map(b=>b.rideFloor)),styleResistant,styleAvailable,travelFloor,showcase]
    :[...safety,Number((audit.globalFewest??0)>=2),
      ...(style==='interior-weave'?[Number(profileThree)]:[]),
      meaningfulFloor,travelFloor,allTravelFloor,styleResistant,styleAvailable,showcase];
  return {version:SELECTION_VERSION,scope,starts,selected,rows,rank,profileThree,supportedFraction,
    travelFloor,allTravelFloor,meaningfulFloor,rideFloor,styleAvailable,styleResistant,showcase,
    // Eligibility for a demanded style is stricter than general hole quality.
    // The ranking may find enjoyable alternatives without proving the brief.
    requestedStyleSupported:audit.failures.length===0&&styleAvailable===1,
    requestedStyleResistant:audit.failures.length===0&&styleResistant===1};
}
export function compareSelection(a:{rank:number[]},b:{rank:number[]}):number{
  for(let i=0;i<Math.max(a.rank.length,b.rank.length);i++){
    const d=(b.rank[i]??0)-(a.rank[i]??0);if(Math.abs(d)>1e-8)return d;
  }return 0;
}
