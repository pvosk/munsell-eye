// Lightweight, reusable coverage policy; no search runs in the browser.
import type {DesignAnalysis,DesignRoute} from './play-route-design';

export type FocusStyle='chromatic-ride'|'value-hue-balance'|'opposing-colors';
export type StyleCoverage={total:number;styleBases:number[];ratio:number;easiestStyleBases:number[];easiestRatio:number};
export const routeSupported=(r:DesignRoute)=>r.efficient&&r.finishWindowMs>=55&&r.meaningfulPours>=Math.min(2,r.times.length)&&(!r.setup||r.setup.coverage>=.04);
export function measureStyleCoverage(a:DesignAnalysis,matches:(route:DesignRoute)=>boolean):StyleCoverage{
  const styleBases:number[]=[],easiestStyleBases:number[]=[];
  for(const b of a.bases){
    if(!b.qualifies)continue;
    const routes=b.routes.filter(routeSupported);
    if(routes.some(matches))styleBases.push(b.base);
    // Diagnostic only: widest measured finishing window among retained routes.
    // This is not a prediction of which route a human will choose.
    const easiest=[...routes].sort((a,b)=>b.finishWindowMs-a.finishWindowMs)[0];
    if(easiest&&matches(easiest))easiestStyleBases.push(b.base);
  }
  const total=a.bases.length;
  return {total,styleBases,ratio:total?styleBases.length/total:0,easiestStyleBases,easiestRatio:total?easiestStyleBases.length/total:0};
}
export function coverageEligible(a:DesignAnalysis,coverage:StyleCoverage,minRatio=.5):boolean{
  return a.failures.length===0&&a.bases.length>0&&a.bases.every(b=>b.qualifies)&&coverage.total===a.bases.length&&coverage.ratio>=minRatio;
}
// Coverage is a priority, not something a long route can compensate away.
export const compareStyleCoverage=(a:StyleCoverage,b:StyleCoverage)=>b.ratio-a.ratio||b.easiestRatio-a.easiestRatio;
