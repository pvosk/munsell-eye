// Offline selection policy layered over the saved dose-competition audit.
// Keep availability, majority resistance and closest-start resistance separate.
import {mixtureColor,colorDistance} from './play-engine';
import type {PaintColor} from './paint-mixing';
import {AUDIT_STYLES,timingSupported,type AuditedHole,type AuditStyle} from './play-route-audit';

export function assessStartBias(paints:PaintColor[],audit:AuditedHole){
  const distances=paints.map((_,i)=>colorDistance(mixtureColor(paints,paints.map((_,j)=>+(i===j))),audit.target));
  const closest= Math.min(...distances);
  const closestBases=distances.flatMap((d,i)=>d<=closest+1e-8?[i]:[]);
  const globallyEfficientBases=audit.bases.filter(b=>b.fewest===audit.globalFewest).map(b=>b.base);
  const styles=Object.fromEntries(AUDIT_STYLES.map(style=>{
    const s=audit.styles[style];
    const closestStartResistsBypass=closestBases.every(b=>s.robustBases.includes(b));
    const globalStyleCoverage=globallyEfficientBases.length?globallyEfficientBases.filter(b=>s.robustBases.includes(b)).length/globallyEfficientBases.length:0;
    const minimumClosestRide=Math.min(...closestBases.flatMap(b=>audit.bases[b].routes.filter(timingSupported).map(r=>r.longestChromaticPour)));
    return [style,{majorityEligible:s.eligible,closestStartResistsBypass,globalStyleCoverage,
      freeStartEligible:s.eligible&&closestStartResistsBypass,minimumClosestRide:Number.isFinite(minimumClosestRide)?minimumClosestRide:null}];
  })) as Record<AuditStyle,{majorityEligible:boolean;closestStartResistsBypass:boolean;globalStyleCoverage:number;freeStartEligible:boolean;minimumClosestRide:number|null}>;
  return {version:'starts-1-closest-paint',closestBases,distances,globallyEfficientBases,styles};
}
