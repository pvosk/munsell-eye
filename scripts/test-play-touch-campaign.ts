import assert from 'node:assert/strict';
import {test} from 'node:test';
import {touchPower,touchRatio,touchEquivalentSeconds,touchPrecision,TOUCH_VERSION} from '../app/play-touch';
import {CHARGE_SECONDS,chargeAmount,colorDistance,mixtureColor,PLAY_LEVELS,landingBoundary,targetDisplayRadius} from '../app/play-engine';
import {PUBLIC_SPECIMENS,publicCampaignBank} from '../app/play-premix-bank';
import {premixReplay,labMixtureStep} from '../app/play-premix';
import {newLabAttempt,validLabEvent,nextFixedLabSpecimen} from '../app/play-lab-model';
import {captureApproach,targetFlightPath} from '../app/play-motion';
test('live touch is monotone, symmetric and retains every legacy legal dose',()=>{
 for(const precision of [0,.25,.5,.75,1]){
  let last=0;
  for(let i=0;i<=2000;i++){
   const seconds=CHARGE_SECONDS*i/2000,p=touchPower(seconds),amount=chargeAmount(1,touchEquivalentSeconds(seconds,precision));
   assert.ok(amount>=last-1e-10);last=amount;
   assert.ok(Math.abs(amount-touchRatio(p,precision))<1e-8);
   assert.ok(Math.abs(touchPower(2*CHARGE_SECONDS-seconds)-p)<1e-12);
  }
  assert.ok(Math.abs(last-8)<1e-8);
 }
 assert.equal(touchRatio(0,1),.005);
 assert.ok(touchRatio(.08,1)>touchRatio(.08,0));
 assert.ok(touchRatio(.5,1)<touchRatio(.5,0));
});
test('all 32 campaign examples replay, import and advance without archive fallback',()=>{
 assert.equal(PUBLIC_SPECIMENS.length,32);assert.equal(publicCampaignBank.chapters.length,17);
 assert.equal(publicCampaignBank.chapters[1].name,'Zorny');assert.equal(publicCampaignBank.chapters.at(-1)!.name,'Cobalt Ember');
 for(const [i,s] of PUBLIC_SPECIMENS.entries()){
  const h=s.hole,p=PLAY_LEVELS[s.levelIndex].paints;
  assert.equal(h.premix!.massMode,'normalized');
  const q=premixReplay(h.premix!.initial,h.routeOrder,h.routeTimes,'normalized');
  assert.ok(colorDistance(mixtureColor(p,q),h.target)<=h.tolerance);
  assert.ok(h.par>=h.routeTimes.length);
  const a=newLabAttempt(s,`campaign-check-${i}`);
  const before=h.premix!.initial,heldSeconds=.45,precision=touchPrecision(colorDistance(mixtureColor(p,before),h.target),h.tolerance);
  const seconds=touchEquivalentSeconds(heldSeconds,precision),step=labMixtureStep(before,0,seconds,'normalized');
  a.shots.push({paint:0,seconds,heldSeconds,controlsVersion:TOUCH_VERSION,amount:step.amount,before:[...before],after:step.after,cancelled:false});
  assert.ok(validLabEvent({id:`event-${i}`,attemptId:a.id,type:'attempt',attempt:a}),`valid ${i}`);
  assert.equal(nextFixedLabSpecimen(s)!.hole.courseId,PUBLIC_SPECIMENS[(i+1)%32].hole.courseId);
 }
});
test('short captures begin immediately; long captures reserve a final approach',()=>{
 const point=(x:number)=>({rgb:[100,100,100] as [number,number,number],lab:[.5,0,0] as [number,number,number],position:[x,0,0] as [number,number,number]});
 for(const length of [.2,1,10,40]){
  const path=Array.from({length:101},(_,i)=>point(length*(1-i/100))),target=point(0),plan=captureApproach(path,target);
  if(length<=1)assert.equal(plan.start,0);else assert.ok(plan.start>0);
  const win=targetFlightPath(path,target,true);
  assert.deepEqual(win[0].position,path[0].position);assert.deepEqual(win.at(-1)!.position,target.position);
  assert.deepEqual(win.map(p=>p.lab),path.map(p=>p.lab));
 }
});
// Directional calibration report: no scoring or display changes.
const ratios=PUBLIC_SPECIMENS.map(s=>{
 const h=s.hole,r=targetDisplayRadius(h.target,h.tolerance),radii=[];
 for(let i=0;i<128;i++){const y=1-2*(i+.5)/128,a=i*2.3999632297,d:[number,number,number]=[Math.sqrt(1-y*y)*Math.cos(a),y,Math.sqrt(1-y*y)*Math.sin(a)];const p=landingBoundary(h.target,h.tolerance,d);radii.push(Math.hypot(...p.map((x,j)=>x-h.target.position[j]))/r);}
 return {hole:h.kind,min:Math.min(...radii),max:Math.max(...radii)};
});
console.log('Projected tolerance / displayed radius', {min:Math.min(...ratios.map(r=>r.min)),max:Math.max(...ratios.map(r=>r.max))});
