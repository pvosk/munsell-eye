import {addPaint,chargeAmount,totalMass,mixtureColor,pourPath,CHARGE_SECONDS,type Mixture,type ColorPoint} from './play-engine';
import type {PaintColor} from './paint-mixing';

export type MassMode='accumulated'|'normalized';
export function normalizeRecipe(q:Mixture):Mixture {
  const mass=totalMass(q);
  if(!Number.isFinite(mass)||mass<=0||q.some(v=>!Number.isFinite(v)||v<0))throw Error('Invalid premix');
  return q.map(v=>v/mass);
}
export function premixStep(before:Mixture,paint:number,seconds:number,mode:MassMode){
  if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid hold');
  const q=mode==='normalized'?normalizeRecipe(before):before;
  const amount=chargeAmount(totalMass(q),seconds),added=addPaint(q,paint,amount);
  return{before:q,amount,after:mode==='normalized'?normalizeRecipe(added):added};
}
export function premixReplay(start:Mixture,order:number[],times:number[],mode:MassMode){
  if(order.length!==times.length)throw Error('Each premix action needs a hold');
  return order.reduce((q,p,i)=>premixStep(q,p,times[i],mode).after,[...start]);
}
export function premixRoute(paints:PaintColor[],start:Mixture,order:number[],times:number[],mode:MassMode){
  let q=[...start];const path:ColorPoint[]=[mixtureColor(paints,q)],stops=[path[0]],strokes:ColorPoint[][]=[];
  order.forEach((p,i)=>{const s=premixStep(q,p,times[i],mode),stroke=pourPath(paints,s.before,p,s.amount,64);strokes.push(stroke);path.push(...stroke);q=s.after;stops.push(mixtureColor(paints,q));});
  return{path,stops,strokes,after:q};
}
// Invert a finishing share in COMPOSITION space, never displayed RGB space.
export function predecessor(finish:Mixture,paint:number,alpha:number):Mixture|null {
  if(!Number.isInteger(paint)||paint<0||paint>=finish.length||!(alpha>0&&alpha<1))return null;
  const p=normalizeRecipe(finish).map((v,i)=>(v-(i===paint?alpha:0))/(1-alpha));
  return p.some(v=>v< -1e-12)?null:normalizeRecipe(p.map(v=>Math.max(0,v)));
}
// Map the same compositional action to this mode's legal rising-leg controls.
export function holdForShare(mass:number,alpha:number,mode:MassMode):number|null {
  if(!(mass>0&&alpha>0&&alpha<1))return null;
  const m=mode==='normalized'?1:mass,amount=m*alpha/(1-alpha);
  if(amount<chargeAmount(m,0)-1e-10||amount>chargeAmount(m,CHARGE_SECONDS)+1e-10)return null;
  let lo=0,hi=CHARGE_SECONDS;for(let k=0;k<50;k++){const mid=(lo+hi)/2;if(chargeAmount(m,mid)<amount)lo=mid;else hi=mid;}return(lo+hi)/2;
}
