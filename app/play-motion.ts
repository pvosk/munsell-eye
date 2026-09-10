import { Vector3, Quaternion, Matrix4, CubicBezierCurve3 } from 'three';
import type { ColorPoint } from './play-engine';

export const flightProgress = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;
export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle),Math.cos(angle));
export const closestHeading = (current: number, target: number) => current + wrapAngle(target-current);
export const easeQuint = (x: number) => { const t=Math.max(0,Math.min(1,x)); return t*t*t*(t*(t*6-15)+10); };
export const WAKE_SECONDS = 10;
export const wakeEnvelope = (age: number) => age < 0 || age >= WAKE_SECONDS ? 0 : (1-Math.exp(-age*5))*(1-easeQuint(age/WAKE_SECONDS));
export const captureProgress = (t: number) => { const x=Math.max(0,Math.min(1,t)); return x+.065*Math.sin(2*Math.PI*x); };
export const finWidth = (t: number) => .095*(1-Math.max(0,Math.min(1,t)))**1.7+.002;

// A single arc-length-parameterized flight, with no stops or segment handoffs.
// Both control points are derived from the final playing composition.
export function planArrival(target: Vector3, rest: Vector3, restLook: Vector3) {
  const up = new Vector3(0,1,0);
  const backward = rest.clone().sub(restLook).normalize();
  const near = target.clone().addScaledVector(backward,3.8);
  const axis = rest.clone().sub(near).normalize();
  const side = axis.clone().cross(up);
  if(side.lengthSq()<.001) side.set(1,0,0); else side.normalize();
  const lift = side.clone().cross(axis).normalize();
  const bow = Math.min(18,Math.max(4,near.distanceTo(rest)*.48));
  // Control points stay between the endpoints on the sight-line axis.
  // All landscape reveal comes from the perpendicular bow, not overshoot.
  const far = near.clone().lerp(rest,.3).addScaledVector(side,bow).addScaledVector(lift,bow*.45);
  const approach = near.clone().lerp(rest,.76).addScaledVector(side,bow*.7).addScaledVector(lift,bow*.3);
  const orbit = new CubicBezierCurve3(near,far,approach,rest);
  orbit.arcLengthDivisions = 400;
  const initial = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(near,target,up));
  const final = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(rest,restLook,up));
  return (progress: number) => {
    const t = easeQuint(progress);
    return {position:orbit.getPointAt(t),quaternion:initial.clone().slerp(final,t)};
  };
}

// Presentation only. The caller retains the original recipe endpoint for
// scoring. Successful arrivals converge gently; misses skirt the solid core.
export function targetFlightPath(path: ColorPoint[], target: ColorPoint, qualifies: boolean): ColorPoint[] {
  const goal = new Vector3(...target.position);
  const distances=[0];
  for(let i=1;i<path.length;i++) distances.push(distances[i-1]+new Vector3(...path[i].position).distanceTo(new Vector3(...path[i-1].position)));
  const length=distances.at(-1) || 1;
  const tangent = new Vector3(...path.at(-1)!.position).sub(new Vector3(...path[0].position)).normalize();
  const side=tangent.clone().cross(new Vector3(0,1,0));
  if(side.lengthSq()<.001) side.set(1,0,0); else side.normalize();
  const endpointClearance=Math.min(goal.distanceTo(new Vector3(...path[0].position)),goal.distanceTo(new Vector3(...path.at(-1)!.position)));
  const radius=Math.min(1.15,endpointClearance*.95);
  return path.map((point,i)=>{
    const p=new Vector3(...point.position);
    const progress=distances[i]/length;
    if(qualifies) p.lerp(goal,easeQuint((progress-.7)/.3));
    else if(radius>.01 && i>0 && i<path.length-1) {
      const delta=p.clone().sub(goal), along=delta.dot(side);
      const perpendicularSq=Math.max(0,delta.lengthSq()-along*along);
      if(delta.length()<radius*3) {
        // Use a consistent side, avoiding axis flips as the path crosses center.
        // A Gaussian shoulder has a smooth tangent (unlike a semicircle's
        // vertical tangent at entry), while clearing the core at the center.
        const required=radius*Math.exp(-perpendicularSq/(2*radius*radius));
        const envelope=1-easeQuint((delta.length()-radius*2)/radius);
        const endpointEase=easeQuint(progress/.12)*easeQuint((1-progress)/.12);
        p.addScaledVector(side,Math.max(0,required-along)*envelope*endpointEase);
        const clear=p.clone().sub(goal);
        if(clear.lengthSq()<radius*radius) p.copy(goal).addScaledVector(clear.normalize(),radius);
      }
    }
    return {...point,position:p.toArray() as [number,number,number]};
  });
}

// Parallel transport prevents the abrupt flips caused by crossing every
// tangent with world-up. Ribbon centers remain on the sampled mixing curve.
export function ribbonEdges(path: ColorPoint[], weight: number) {
  const normal = new Vector3(0, 1, 0);
  let distance = 0;
  return path.map((point, i) => {
    const center = new Vector3(...point.position);
    const previous = new Vector3(...path[Math.max(0, i - 1)].position);
    const next = new Vector3(...path[Math.min(path.length - 1, i + 1)].position);
    const tangent = next.sub(previous).normalize();
    if (tangent.lengthSq() < .000001) tangent.set(0, 0, 1);
    if (i) distance += center.distanceTo(new Vector3(...path[i - 1].position));
    normal.addScaledVector(tangent, -normal.dot(tangent));
    if (normal.lengthSq() < .00001) normal.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
    if (normal.lengthSq() < .00001) normal.set(0, 0, 1);
    normal.normalize();
    const twist = distance * .22;
    const width = (.13 + Math.min(.055, Math.log1p(weight) * .008)) * (.72 + .28 * Math.sin(Math.PI * i / Math.max(1, path.length - 1)));
    const across = normal.clone().applyAxisAngle(tangent, twist).multiplyScalar(width);
    return [center.clone().sub(across), center.clone().add(across)] as const;
  });
}
