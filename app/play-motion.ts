import { Vector3 } from 'three';
import type { ColorPoint } from './play-engine';

export const flightProgress = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;

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
    const twist = distance * 1.25;
    const width = (.13 + Math.min(.055, Math.log1p(weight) * .008)) * (.72 + .28 * Math.sin(Math.PI * i / Math.max(1, path.length - 1)));
    const across = normal.clone().applyAxisAngle(tangent, twist).multiplyScalar(width);
    return [center.clone().sub(across), center.clone().add(across)] as const;
  });
}
