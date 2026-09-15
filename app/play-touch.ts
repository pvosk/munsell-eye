import {CHARGE_SECONDS,chargeAmount} from './play-engine';

// Live input only. Research routes and archived seconds retain controls-1.
export const TOUCH_VERSION='touch-2' as const;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function touchPrecision(error:number,tolerance:number){
  const x=clamp((error/tolerance-1)/5);
  return 1-x*x*(3-2*x);
}
export function touchPower(seconds:number){
  const cycle=(Math.max(0,seconds)/CHARGE_SECONDS)%2;
  const x=cycle<=1?cycle:2-cycle;
  // A little softness at contact, then a quicker build and compressed crest.
  return clamp(.92*(1-(1-x)**3)+.08*x*x*(3-2*x));
}
export function touchRatio(power:number,precision:number){
  const p=clamp(power),near=clamp(precision);
  const gain=1+near*(.12*(1-p)*Math.exp(-p/.12)-.32*Math.sin(Math.PI*p)**2);
  return .005+7.995*p**3.85*gain;
}
export function touchEquivalentSeconds(seconds:number,precision:number){
  const ratio=touchRatio(touchPower(seconds),precision);
  const power=clamp(((ratio-.005)/7.995)**.25);
  return CHARGE_SECONDS*(1-(1-power)**(1/3));
}
export function touchAmount(mass:number,seconds:number,precision:number){
  return chargeAmount(mass,touchEquivalentSeconds(seconds,precision));
}
