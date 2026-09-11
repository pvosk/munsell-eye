// Pure measurement: no pigment, dose, scoring, or animation changes.
// Thresholds describe a provisional style, not success or player difficulty.
export const FINISH_PROFILE_POLICY={version:'finish-profile-1',valueAlignment:.8,relativeToSetup:.8} as const;
type Stroke={before:{lab:readonly number[]};after:{lab:readonly number[]}};
export function finishProfile(strokes:Stroke[],episode:{index:number;dominant:boolean}|null,meaningfulPours:number){
 if(!episode)return {kind:'no-setup-finish' as const,valueLed:false,valueMovement:false,direction:null,deltaL:0,hueChroma:0,valueAlignment:0,largestSetupShift:0,relativeToSetup:0,reasons:['No substantial value finish after setup.']};
 const s=strokes[episode.index],deltaL=s.after.lab[0]-s.before.lab[0];
 const hueChroma=Math.hypot(...s.after.lab.slice(1).map((v,i)=>v-s.before.lab[i+1]));
 const valueAlignment=Math.abs(deltaL)/Math.max(1e-12,Math.hypot(deltaL,hueChroma));
 const largestSetupShift=Math.max(0,...strokes.slice(0,episode.index).map(s=>Math.abs(s.after.lab[0]-s.before.lab[0])));
 const relativeToSetup=largestSetupShift>1e-12?Math.abs(deltaL)/largestSetupShift:null;
 const valueMovement=episode.dominant&&meaningfulPours>=2;
 const reasons:string[]=[];
 if(!valueMovement)reasons.push('Finish lacks a substantial setup or share of travel.');
 if(valueAlignment<FINISH_PROFILE_POLICY.valueAlignment)reasons.push('Finish couples lightness with substantial hue/chroma movement.');
 if(relativeToSetup!==null&&relativeToSetup<FINISH_PROFILE_POLICY.relativeToSetup)reasons.push('An earlier stroke carries the larger lightness change.');
 const valueLed=!reasons.length;
 return {kind:valueLed?'value-led-finish' as const:valueMovement?'coupled-or-earlier-shift' as const:'no-setup-finish' as const,
  valueLed,valueMovement,direction:deltaL>0?'rise' as const:'drop' as const,deltaL,hueChroma,valueAlignment,largestSetupShift,relativeToSetup,reasons};
}
