import { Vector3, Quaternion, Matrix4, CubicBezierCurve3 } from 'three';
import type { ColorPoint } from './play-engine';

export const flightProgress = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;
export const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle),Math.cos(angle));
export const closestHeading = (current: number, target: number) => current + wrapAngle(target-current);

// A single arc-length-parameterized flight, with no stops or segment handoffs.
// Both control points are derived from the final playing composition.
export function planArrival(target: Vector3, rest: Vector3, restLook: Vector3) {
  const up = new Vector3(0,1,0);
  const backward = rest.clone().sub(restLook).normalize();
  const openingDirection = backward.clone().applyAxisAngle(up,.45);
  const near = target.clone().addScaledVector(openingDirection,3.8);
  const distance = Math.max(12,target.distanceTo(rest)*.85);
  const side = backward.clone().cross(up).normalize();
  const far = near.clone().addScaledVector(openingDirection,distance).addScaledVector(side,distance*.4).addScaledVector(up,3);
  const approach = rest.clone().addScaledVector(backward,distance*.7).addScaledVector(side,distance*.25);
  const orbit = new CubicBezierCurve3(near,far,approach,rest);
  orbit.arcLengthDivisions = 400;
  const initial = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(near,target,up));
  const final = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(rest,restLook,up));
  const ease = (x: number) => { const t=Math.max(0,Math.min(1,x)); return t*t*t*(t*(t*6-15)+10); };
  return (progress: number) => {
    const t = ease(progress);
    return {position:orbit.getPointAt(t),quaternion:initial.clone().slerp(final,t)};
  };
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
