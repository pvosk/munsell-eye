import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { flightProgress, ribbonEdges } from './play-motion';
import { SPACE_NODES, SEED_POINT, WORLD_SCALE, type ColorPoint, type Hole, type RGB } from './play-engine';

type Flight = { path: ColorPoint[]; distances: number[]; length: number; elapsed: number; duration: number; fromMass: number; toMass: number; done: () => void; ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> };
type SceneCallbacks = { targetPosition: (x: number, y: number, offscreen: boolean, angle: number) => void; onError: () => void };
const v3 = (point: ColorPoint) => new THREE.Vector3(...point.position);
const color = (rgb: RGB) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
const smooth = (t: number) => t * t * (3 - 2 * t);

export function createPlayScene(host: HTMLDivElement, hole: Hole, callbacks: SceneCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor('#2b3233');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional paint space. Hold a paint below, then release to pour toward the target.');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#2b3233', .019);
  const camera = new THREE.PerspectiveCamera(59, 1, .06, 150);
  camera.position.set(12, 9, 20);
  const blob = new THREE.Group();
  const noise = new ImprovedNoise();
  const blobGeometry = new THREE.SphereGeometry(.24, 40, 28);
  const positions = blobGeometry.getAttribute('position');
  const directions = new Float32Array(positions.array);
  const shading: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const shade = .92 + .08 * Math.max(0, positions.getY(i) / .24);
    shading.push(shade, shade, shade);
  }
  blobGeometry.setAttribute('color', new THREE.Float32BufferAttribute(shading, 3));
  // Bounded, matte shading keeps pigment color legible without specular glare.
  const blobMaterial = new THREE.MeshBasicMaterial({ color: '#dbd8ca', vertexColors: true });
  const body = new THREE.Mesh(blobGeometry, blobMaterial);
  blob.add(body);
  const outline = new THREE.Mesh(blobGeometry, new THREE.MeshBasicMaterial({ color: '#f9f4dd', side: THREE.BackSide, transparent: true, opacity: .08 }));
  outline.scale.setScalar(1.025); blob.add(outline);
  scene.add(blob);

  const chargeRing = new THREE.Mesh(new THREE.TorusGeometry(.45, .012, 6, 90), new THREE.MeshBasicMaterial({ color: '#f3e6bf', transparent: true, opacity: 0 }));
  scene.add(chargeRing);
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  satellite.visible = false; scene.add(satellite);

  // Each colored node is an actual Munsell chip, embedded in continuous OKLab.
  const nodesGeometry = new THREE.BufferGeometry();
  const nodePositions: number[] = []; const nodeColors: number[] = [];
  SPACE_NODES.forEach(({ point }) => { nodePositions.push(...point.position); const c = color(point.rgb); nodeColors.push(c.r, c.g, c.b); });
  nodesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  nodesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nodeColors, 3));
  const nodeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uTime; uniform float uPixelRatio; uniform vec3 uPlayer; varying vec3 vTint; varying float vAlpha;
      void main(){ float d=distance(position,uPlayer); float nearby=1.0-smoothstep(1.0,9.0,d); float breath=.85+.15*sin(uTime*1.1+position.y+position.x*.6);
      vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((90.0+nearby*150.0)*uPixelRatio/max(1.2,-mv.z),3.0,26.0)*(.35+.65*smoothstep(.2,.85,d))*breath;
      vTint=mix(vec3(.45,.51,.50),color,.7+nearby*.3); vAlpha=(.35+nearby*.5)*exp(-.018*max(0.0,-mv.z)); }`,
    fragmentShader: `varying vec3 vTint; varying float vAlpha; void main(){float d=length(gl_PointCoord-.5); if(d>.5)discard; gl_FragColor=vec4(vTint,vAlpha*(1.0-smoothstep(.2,.5,d))); #include <colorspace_fragment> }`.replace(' #include', '\n#include').replace('> }', '>\n}'),
  });
  scene.add(new THREE.Points(nodesGeometry, nodeMaterial));

  // Quiet value strata and a neutral spine give the camera a stable vertical.
  [2, 5, 8].forEach((value) => {
    const row = SPACE_NODES.filter(({ chip }) => chip.v === value && chip.c === 4);
    if (row.length < 3) return;
    const points = row.map(({ point }) => v3(point));
    points.push(points[0]);
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)), new THREE.LineBasicMaterial({ color: '#c4c6b9', transparent: true, opacity: .07 })));
  });
  const spine = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, 10, 0)]);
  scene.add(new THREE.Line(spine, new THREE.LineBasicMaterial({ color: '#dfded0', transparent: true, opacity: .075 })));

  // A second, very sparse neutral lattice supplies distant parallax.
  const dust: number[] = [];
  for (let x = -20; x <= 20; x += 4) for (let y = -16; y <= 16; y += 4) for (let z = -20; z <= 20; z += 4) dust.push(x, y, z);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#b7c3bb', size: .038, transparent: true, opacity: .22, sizeAttenuation: true })));

  const target = new THREE.Group(); scene.add(target);
  const targetMaterial = new THREE.MeshBasicMaterial({ color: color(hole.target.rgb) });
  const targetCore = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 16), targetMaterial); target.add(targetCore);
  const targetMist = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: color(hole.target.rgb), transparent: true, opacity: .065, depthWrite: false }));
  target.add(targetMist);
  const targetRings = Array.from({ length: 3 }, (_, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .009, 5, 100), new THREE.MeshBasicMaterial({ color: '#e9dfc9', transparent: true, opacity: i === 0 ? .7 : .24 }));
    target.add(ring); return ring;
  });
  const pulses: { mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; born: number }[] = [];
  const trails: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  let current = SEED_POINT;
  let mass = 0;
  let activeHole = hole;
  let flight: Flight | null = null;
  let charge: { rgb: RGB; ratio: number; power: number; tangent?: THREE.Vector3 } | null = null;
  let time = 0; let last = performance.now(); let landing = -10; let releaseTime = -10;
  let previousHue: number | null = null;
  let won = false; let disposed = false;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const changeMotion = () => { reduced = motionQuery.matches; };
  motionQuery.addEventListener('change', changeMotion);
  const lookAt = v3(SEED_POINT);
  const cameraDirection = new THREE.Vector3(0, 0, -1);
  const travelDirection = new THREE.Vector3(0, 0, -1);
  let width = 1; let height = 1;

  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const onContextLost = (event: Event) => { event.preventDefault(); callbacks.onError(); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function setHole(next: Hole) {
    activeHole = next; current = SEED_POINT; mass = 0; flight = null; charge = null; won = false; previousHue = null;
    blob.position.copy(v3(current));
    cameraDirection.copy(v3(next.target).sub(blob.position).normalize());
    if (cameraDirection.lengthSq() < .001) cameraDirection.set(0, 0, -1);
    travelDirection.copy(cameraDirection);
    lookAt.copy(blob.position).addScaledVector(cameraDirection, 2.5);
    target.position.copy(v3(next.target));
    targetMaterial.color.copy(color(next.target.rgb)); targetMist.material.color.copy(targetMaterial.color);
    const radius = next.tolerance * WORLD_SCALE;
    targetMist.scale.setScalar(radius); targetRings.forEach((ring) => ring.scale.setScalar(radius));
    trails.splice(0).forEach((mesh) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    pulses.splice(0).forEach(({ mesh }) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    camera.position.copy(blob.position).addScaledVector(cameraDirection, -5).add(new THREE.Vector3(0, 1.1, 0));
    camera.lookAt(lookAt);
  }
  setHole(hole);

  function makeRibbon(path: ColorPoint[], weight: number) {
    const vertices: number[] = []; const colors: number[] = []; const indices: number[] = [];
    const edges = ribbonEdges(path, weight);
    path.forEach((point, i) => {
      vertices.push(...edges[i][0].toArray(), ...edges[i][1].toArray());
      const c = color(point.rgb); colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < path.length - 1) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false }));
    mesh.frustumCulled = false; scene.add(mesh); trails.push(mesh);
    if (trails.length > 16) { const old = trails.shift()!; scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
    return mesh;
  }

  function pulse(rgb: RGB, position: THREE.Vector3, direction: THREE.Vector3) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.5, .012, 5, 80), new THREE.MeshBasicMaterial({ color: color(rgb), transparent: true, opacity: .6, depthWrite: false }));
    mesh.position.copy(position); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    scene.add(mesh); pulses.push({ mesh, born: time });
  }

  function render(now: number) {
    if (disposed) return;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (document.hidden) return;
    time += dt;
    let speed = 0;
    let movingPoint = current;
    if (flight) {
      const f = flight; f.elapsed += dt;
      const progress = Math.min(1, f.elapsed / f.duration);
      const distance = flightProgress(progress) * f.length;
      let index = 1;
      while (index < f.distances.length - 1 && f.distances[index] < distance) index++;
      const fraction = (distance - f.distances[index - 1]) / Math.max(.000001, f.distances[index] - f.distances[index - 1]);
      const a = f.path[index - 1]; const b = f.path[index];
      const p = v3(a).lerp(v3(b), fraction);
      const old = blob.position.clone(); blob.position.copy(p);
      speed = old.distanceTo(p) / Math.max(dt, .001);
      const tangent = v3(b).sub(v3(a));
      if (tangent.lengthSq() > .000001) travelDirection.lerp(tangent.normalize(), 1 - Math.exp(-dt * 12)).normalize();
      movingPoint = { rgb: a.rgb.map((n, i) => n + (b.rgb[i] - n) * fraction) as RGB, lab: a.lab, position: p.toArray() as [number, number, number] };
      mass = f.fromMass + (f.toMass - f.fromMass) * smooth(progress);
      f.ribbon.geometry.setDrawRange(0, Math.max(0, (index - 1) * 6));
      const chroma = Math.hypot(a.lab[1], a.lab[2]);
      const hueSector = Math.floor((Math.atan2(a.lab[2], a.lab[1]) + Math.PI) / (Math.PI / 5));
      if (chroma > .035 && previousHue !== null && hueSector !== previousHue && !reduced) pulse(a.rgb, p, travelDirection);
      if (chroma > .035) previousHue = hueSector;
      if (progress === 1) {
        current = f.path[f.path.length - 1]; mass = f.toMass; movingPoint = current;
        blob.position.copy(v3(current)); f.ribbon.geometry.setDrawRange(0, Infinity);
        flight = null; landing = time; pulse(current.rgb, blob.position, travelDirection); f.done();
      }
    } else blob.position.copy(v3(current));
    const scale = 1 + Math.min(.48, Math.log1p(mass) * .065);
    const launchAge = time - releaseTime;
    const kick = reduced ? 0 : Math.exp(-launchAge * 7) * .65;
    const settle = reduced ? 0 : Math.exp(-(time - landing) * 5) * Math.sin((time - landing) * 7) * .075;
    const tension = charge?.power ?? 0;
    const stretch = reduced ? 0 : Math.min(.38, speed * .025) + kick;
    body.scale.set(1 + tension * .22 - stretch * .2 + settle, 1 + tension * .1 - stretch * .15 + settle, 1 - tension * .3 + stretch - settle);
    blob.scale.setScalar(scale);
    const shapeTime = reduced ? 0 : time * .28;
    for (let i = 0; i < positions.count; i++) {
      const x = directions[i * 3] / .24, y = directions[i * 3 + 1] / .24, z = directions[i * 3 + 2] / .24;
      const low = noise.noise(x * 1.35 + shapeTime, y * 1.35, z * 1.35 - shapeTime * .6);
      const fine = noise.noise(x * 2.6, y * 2.6 + shapeTime * .5, z * 2.6);
      const radius = .24 * (1 + low * (.42 + tension * .15) + fine * .09);
      positions.setXYZ(i, x * radius + .025 * Math.sin(y * 3 + shapeTime), y * radius, z * radius);
    }
    positions.needsUpdate = true;
    const facing = charge?.tangent ?? travelDirection;
    if (facing.lengthSq() > .001) body.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing), 1 - Math.exp(-dt * 7));
    outline.quaternion.copy(body.quaternion); outline.scale.copy(body.scale).multiplyScalar(1.025);
    blobMaterial.color.copy(mass ? color(movingPoint.rgb) : new THREE.Color('#d8d5c7'));
    outline.material.opacity = mass ? .06 : .15;

    chargeRing.visible = !!charge;
    satellite.visible = !!charge;
    if (charge) {
      chargeRing.position.copy(blob.position); chargeRing.quaternion.copy(camera.quaternion);
      chargeRing.material.color.copy(color(charge.rgb)); chargeRing.material.opacity = .65;
      chargeRing.scale.setScalar(scale * (1.6 - charge.power * .65));
      const orbit = reduced ? .8 : time * .9;
      satellite.position.copy(blob.position).add(new THREE.Vector3(Math.cos(orbit), Math.sin(orbit) * .4, Math.sin(orbit)).multiplyScalar((.65 - charge.power * .3) * scale));
      satellite.scale.setScalar(.35 + charge.power * .7);
      satellite.material.color.copy(color(charge.rgb));
    }

    targetRings.forEach((ring, i) => {
      if (i === 0) ring.quaternion.copy(camera.quaternion);
      else if (!reduced) ring.rotation.set(time * .1 + i * .8, time * .08 + i, i * .6);
      ring.material.opacity = (i === 0 ? .65 : .21) + (won ? .15 : 0);
    });
    targetCore.scale.setScalar(1 + (reduced ? 0 : Math.sin(time * 2.2) * .12));
    targetMist.material.opacity = won ? .2 : .045 + (reduced ? 0 : Math.sin(time * 1.8) * .015);
    pulses.forEach(({ mesh, born }) => { const age = time - born; mesh.scale.setScalar(1 + age * 3); mesh.material.opacity = Math.max(0, .5 - age * .18); });
    while (pulses.length && time - pulses[0].born > 3) { const old = pulses.shift()!; scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
    trails.forEach((trail) => { if (trail !== flight?.ribbon) trail.material.opacity = Math.max(.12, trail.material.opacity - dt * .018); });
    nodeMaterial.uniforms.uTime.value = reduced ? 0 : time;
    nodeMaterial.uniforms.uPlayer.value.copy(blob.position);

    // Remain inside the lattice. Follow behind the glider, never zoom out to
    // fit the whole system. At rest, turn toward the destination from here.
    const toTarget = target.position.clone().sub(blob.position);
    const heading = flight ? travelDirection.clone() : toTarget.length() > .25 ? toTarget.normalize() : travelDirection.clone();
    if (charge?.tangent && !reduced) heading.lerp(charge.tangent, .65).normalize();
    cameraDirection.lerp(heading, 1 - Math.exp(-dt * (flight ? 5 : 2))).normalize();
    const side = cameraDirection.clone().cross(new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < .01) side.set(1, 0, 0); else side.normalize();
    const distanceBehind = (camera.aspect < .85 ? 5.6 : 4.6) + scale * .2;
    const desiredPosition = blob.position.clone().addScaledVector(cameraDirection, -distanceBehind).addScaledVector(side, .85).add(new THREE.Vector3(0, 1.05, 0));
    const desiredLook = blob.position.clone().addScaledVector(cameraDirection, 2.2).add(new THREE.Vector3(0, .28, 0));
    const damping = reduced ? 12 : 5.5 / (1 + Math.log1p(mass) * .035);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * damping));
    lookAt.lerp(desiredLook, 1 - Math.exp(-dt * 9));
    const desiredFov = reduced ? 59 : 59 + Math.min(7, speed * .6);
    camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-dt * 5));
    camera.updateProjectionMatrix();
    camera.lookAt(lookAt);
    const projected = target.position.clone().project(camera);
    const offscreen = projected.z > 1 || Math.abs(projected.x) > .87 || Math.abs(projected.y) > .77;
    let px = projected.x; let py = -projected.y;
    if (projected.z > 1) { px = -px; py = -py; }
    const angle = Math.atan2(py, px);
    if (offscreen) { const f = Math.max(Math.abs(px) / .84, Math.abs(py) / .72, 1); px /= f; py /= f; }
    callbacks.targetPosition((px * .5 + .5) * width, (py * .5 + .5) * height, offscreen, angle);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(render);

  return {
    reset: setHole,
    charge(rgb: RGB, ratio: number, power: number, tangent?: ColorPoint) { charge = { rgb, ratio, power, tangent: tangent ? v3(tangent).sub(blob.position).normalize() : undefined }; },
    cancelCharge() { charge = null; },
    launch(path: ColorPoint[], fromMass: number, toMass: number, done: () => void) {
      charge = null; releaseTime = time;
      if (path.length === 1) { current = path[0]; mass = toMass; blob.position.copy(v3(current)); landing = time; pulse(current.rgb, blob.position, new THREE.Vector3(0, 1, 0)); done(); return; }
      const distances = [0];
      for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + v3(path[i]).distanceTo(v3(path[i - 1])));
      const length = distances[distances.length - 1];
      const initialTangent = v3(path[Math.min(6, path.length - 1)]).sub(v3(path[0]));
      if (initialTangent.lengthSq() > .000001) travelDirection.copy(initialTangent.normalize());
      pulse(path[0].rgb, blob.position, travelDirection);
      flight = { path, distances, length, elapsed: 0, duration: reduced ? .4 : Math.max(.65, Math.min(2.8, .48 + length * .15 + Math.log1p(toMass) * .018)), fromMass, toMass, done, ribbon: makeRibbon(path, toMass) };
    },
    celebrate() { won = true; pulse(activeHole.target.rgb, target.position, new THREE.Vector3(0, 0, 1)); },
    dispose() {
      disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); motionQuery.removeEventListener('change', changeMotion);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
        if ('material' in object) { const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach((m) => { if (m instanceof THREE.Material) materials.add(m); }); }
      });
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
export type PlayScene = ReturnType<typeof createPlayScene>;
