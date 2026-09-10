import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { flightProgress, ribbonEdges } from './play-motion';
import { SPACE_NODES, baseLaunchPath, landingBoundary, type ColorPoint, type Hole, type RGB } from './play-engine';

type Flight = { path: ColorPoint[]; distances: number[]; length: number; elapsed: number; duration: number; fromMass: number; toMass: number; done: () => void; ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> };
type SceneCallbacks = { targetPosition: (x: number, y: number, offscreen: boolean, angle: number) => void; onIntroEnd: () => void; onError: () => void };
const v3 = (point: ColorPoint) => new THREE.Vector3(...point.position);
const color = (rgb: RGB) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
const smooth = (t: number) => t * t * (3 - 2 * t);

export function createPlayScene(host: HTMLDivElement, hole: Hole, callbacks: SceneCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#2b3233');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional paint space. Hold a paint below, then release to pour toward the target.');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#2b3233', .009);
  const camera = new THREE.PerspectiveCamera(62, 1, .06, 240);
  camera.position.set(12, 9, 20);
  const blob = new THREE.Group();
  const noise = new ImprovedNoise();
  const blobGeometry = new THREE.SphereGeometry(.24, 28, 20);
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

  // Actual renotation chips in a broad, absolute-chroma Munsell volume.
  const nodesGeometry = new THREE.BufferGeometry();
  const nodePositions: number[] = []; const nodeColors: number[] = [];
  SPACE_NODES.forEach(({ point }) => { nodePositions.push(...point.position); const c = color(point.rgb); nodeColors.push(c.r, c.g, c.b); });
  nodesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  nodesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nodeColors, 3));
  const nodeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uIntro: { value: 0 }, uFlight: { value: 0 }, uTarget: { value: new THREE.Vector3() }, uPlayer: { value: new THREE.Vector3() }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `uniform float uTime; uniform float uIntro; uniform float uFlight; uniform float uPixelRatio; uniform vec3 uPlayer; uniform vec3 uTarget; varying vec3 vTint; varying float vAlpha; varying float vWind; varying float vGrass;
      void main(){ float d=distance(position,uPlayer); float nearby=1.0-smoothstep(2.0,24.0,d); float breath=.8+.2*sin(uTime*.8+sin(position.y*.4)+position.x*.2);
      vWind=sin(uTime*.9+position.x*.18+sin(position.z*.15)); vGrass=uIntro;
      vec3 sway=vec3(vWind,0.,cos(uTime*.7+position.z*.13))*(.12+uIntro*.7)*nearby;
      vec4 mv=modelViewMatrix*vec4(position+sway,1.0); gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp((140.0+nearby*420.0*(1.0+uFlight*.6+uIntro*2.0))*uPixelRatio/max(1.2,-mv.z),1.0,44.0+uIntro*36.0)*smoothstep(.35,2.0,d)*breath;
      vec4 goal=projectionMatrix*modelViewMatrix*vec4(uTarget,1.0);
      float clearGoal=smoothstep(.06,.22,length(gl_Position.xy/max(.01,gl_Position.w)-goal.xy/max(.01,goal.w)));
      vTint=color; vAlpha=(.08+nearby*.7+uIntro*.15)*exp(-.025*max(0.0,-mv.z))*mix(.12,1.0,clearGoal); }`,
    fragmentShader: `varying vec3 vTint; varying float vAlpha; varying float vWind; varying float vGrass; void main(){vec2 p=gl_PointCoord-.5;p.x-=vWind*p.y*p.y*vGrass*.9;p.x*=1.0+vGrass*2.2;float d=length(p); if(d>.5)discard; gl_FragColor=vec4(vTint,vAlpha*(1.0-smoothstep(.12,.5,d))); #include <colorspace_fragment> }`.replace(' #include', '\n#include').replace('> }', '>\n}'),
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
  const spine = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -20, 0), new THREE.Vector3(0, 20, 0)]);
  scene.add(new THREE.Line(spine, new THREE.LineBasicMaterial({ color: '#dfded0', transparent: true, opacity: .075 })));

  // A second, very sparse neutral lattice supplies distant parallax.
  const dust: number[] = [];
  for (let x = -52; x <= 52; x += 8) for (let y = -28; y <= 28; y += 8) for (let z = -52; z <= 52; z += 8) dust.push(x, y, z);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
  scene.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#b7c3bb', size: .038, transparent: true, opacity: .22, sizeAttenuation: true })));

  const target = new THREE.Group(); scene.add(target);
  const targetMaterial = new THREE.MeshBasicMaterial({ color: color(hole.target.rgb) });
  const targetCore = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), targetMaterial); target.add(targetCore);
  const targetMist = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: color(hole.target.rgb), transparent: true, opacity: .065, depthWrite: false }));
  target.add(targetMist);
  const targetBoundary = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#e9dfc9', transparent: true, opacity: .35 }));
  target.add(targetBoundary);
  const targetGlow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: color(hole.target.rgb) }, strength: { value: .2 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 tint; uniform float strength; varying vec2 vUv; void main(){float r=length(vUv-.5)*2.0;gl_FragColor=vec4(tint,exp(-r*r*7.0)*strength*(1.0-smoothstep(.7,1.0,r)));\n#include <colorspace_fragment>\n}',
  }));
  target.add(targetGlow);
  const targetRings = Array.from({ length: 3 }, (_, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .009, 5, 100), new THREE.MeshBasicMaterial({ color: '#e9dfc9', transparent: true, opacity: i === 0 ? .7 : .24 }));
    target.add(ring); return ring;
  });
  const pulses: { mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; born: number }[] = [];
  const trails: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  let current = hole.start;
  let mass = 0;
  let activeHole = hole;
  let flight: Flight | null = null;
  let charge: { rgb: RGB; ratio: number; power: number; tangent?: THREE.Vector3 } | null = null;
  let time = 0; let last = performance.now(); let landing = -10; let releaseTime = -10;
  let previousHue: number | null = null;
  let lastGate = -10;
  let introElapsed = 0; let introducing = true;
  let introCurve: THREE.CatmullRomCurve3;
  const introFinishLook = new THREE.Vector3();
  let won = false; let disposed = false;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const changeMotion = () => { reduced = motionQuery.matches; };
  motionQuery.addEventListener('change', changeMotion);
  const lookAt = v3(hole.start);
  const cameraDirection = new THREE.Vector3(0, 0, -1);
  const travelDirection = new THREE.Vector3(0, 0, -1);
  let width = 1; let height = 1;
  let orbitYaw = 0; let orbitPitch = 0;
  let drag: { id: number; x: number; y: number } | null = null;
  const pointerDown = (event: PointerEvent) => {
    if (introducing || flight || charge || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    orbitYaw -= (event.clientX - drag.x) * .005;
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + (event.clientY - drag.y) * .003, -.6, .6);
    drag.x = event.clientX; drag.y = event.clientY;
  };
  const pointerEnd = () => { drag = null; };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerup', pointerEnd);
  renderer.domElement.addEventListener('pointercancel', pointerEnd);

  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const onContextLost = (event: Event) => { event.preventDefault(); callbacks.onError(); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  function setHole(next: Hole) {
    activeHole = next; current = next.start; mass = 0; flight = null; charge = null; won = false; previousHue = null;
    orbitYaw = 0; orbitPitch = 0; drag = null;
    blob.position.copy(v3(current));
    cameraDirection.copy(v3(next.target).sub(blob.position).normalize());
    if (cameraDirection.lengthSq() < .001) cameraDirection.set(0, 0, -1);
    travelDirection.copy(cameraDirection);
    lookAt.copy(blob.position).addScaledVector(cameraDirection, 2.5);
    target.position.copy(v3(next.target));
    targetMaterial.color.copy(color(next.target.rgb)); targetMist.material.color.copy(targetMaterial.color);
    // Warp the actual OKLab tolerance surface through the same display map.
    // Its visible boundary therefore follows scoring even in this wider world.
    const shell = new THREE.SphereGeometry(1, 32, 20);
    const shellPositions = shell.getAttribute('position');
    let radius = 0;
    for (let i = 0; i < shellPositions.count; i++) {
      const point = new THREE.Vector3(...landingBoundary(next.target, next.tolerance, [shellPositions.getX(i), shellPositions.getY(i), shellPositions.getZ(i)])).sub(target.position);
      radius = Math.max(radius, point.length()); shellPositions.setXYZ(i, point.x, point.y, point.z);
    }
    targetMist.geometry.dispose(); targetMist.geometry = shell;
    const boundaryLines: THREE.Vector3[] = [];
    for (let axis = 0; axis < 3; axis++) for (let segment = 0; segment < 80; segment++) for (const t of [segment, segment + 1]) {
      const angle = t / 80 * Math.PI * 2;
      const direction: [number, number, number] = [0, 0, 0]; direction[(axis + 1) % 3] = Math.cos(angle); direction[(axis + 2) % 3] = Math.sin(angle);
      boundaryLines.push(new THREE.Vector3(...landingBoundary(next.target, next.tolerance, direction)).sub(target.position));
    }
    targetBoundary.geometry.dispose(); targetBoundary.geometry = new THREE.BufferGeometry().setFromPoints(boundaryLines);
    targetGlow.material.uniforms.tint.value.copy(targetMaterial.color);
    targetRings.forEach((ring) => ring.scale.setScalar(Math.min(2.2, radius * .55)));
    nodeMaterial.uniforms.uTarget.value.copy(target.position);
    trails.splice(0).forEach((mesh) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    pulses.splice(0).forEach(({ mesh }) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    const side = cameraDirection.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const separation = target.position.distanceTo(blob.position);
    const nearGoal = 1 - smooth(Math.min(1, separation / 12));
    const restPosition = blob.position.clone().addScaledVector(cameraDirection, -((camera.aspect < .85 ? 6.3 : 5.4) + nearGoal * 2.5)).addScaledVector(side, 2.8 + nearGoal * 2).add(new THREE.Vector3(0, 1.8, 0));
    introFinishLook.copy(blob.position).lerp(target.position, Math.min(.5, 4 / Math.max(1, separation)));
    const startPosition = target.position.clone().addScaledVector(cameraDirection, -3.8).addScaledVector(side, .9);
    const passage = target.position.clone().lerp(blob.position, .35).addScaledVector(side, 20).add(new THREE.Vector3(0, 8, 0));
    introCurve = new THREE.CatmullRomCurve3([startPosition, passage, restPosition], false, 'centripetal');
    introElapsed = 0; introducing = true;
    camera.position.copy(reduced ? restPosition : startPosition);
    lookAt.copy(reduced ? introFinishLook : target.position);
    camera.lookAt(lookAt);
  }
  setHole(hole);

  function makeRibbon(path: ColorPoint[], weight: number) {
    const vertices: number[] = []; const colors: number[] = []; const indices: number[] = [];
    const edges = ribbonEdges(path, weight);
    let traveled = 0;
    path.forEach((point, i) => {
      if (i) traveled += v3(point).distanceTo(v3(path[i - 1]));
      const across = edges[i][1].clone().sub(edges[i][0]).normalize();
      const tangent = v3(path[Math.min(i + 1, path.length - 1)]).sub(v3(path[Math.max(0, i - 1)])).normalize();
      const binormal = tangent.clone().cross(across).normalize();
      const envelope = Math.sin(Math.PI * i / Math.max(1, path.length - 1)) ** .6;
      for (let strand = 0; strand < 4; strand++) {
        const phase = strand * Math.PI / 2;
        const wave = traveled * (.35 + strand * .06) + phase;
        const offset = across.clone().multiplyScalar(Math.cos(wave) * (.4 + strand * .12) * envelope)
          .addScaledVector(binormal, (Math.sin(wave) * .5 + noise.noise(traveled * .24, strand * 2, 0) * .35) * envelope);
        const center = v3(point).add(offset);
        const halfWidth = (.022 + strand * .008) * (.7 + .3 * Math.sin(traveled * 1.1 + phase));
        vertices.push(...center.clone().addScaledVector(across, -halfWidth).toArray(), ...center.clone().addScaledVector(across, halfWidth).toArray());
        const c = color(point.rgb); colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i < path.length - 1) { const n = i * 8 + strand * 2; indices.push(n, n + 1, n + 8, n + 1, n + 9, n + 8); }
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false }));
    const flutter = { value: time };
    mesh.userData.flutter = flutter;
    const taper = path.flatMap((_, i) => Array(8).fill(Math.sin(Math.PI * i / Math.max(1, path.length - 1))));
    geometry.setAttribute('aTaper', new THREE.Float32BufferAttribute(taper, 1));
    mesh.material.onBeforeCompile = shader => {
      shader.uniforms.uFlutter = flutter;
      shader.vertexShader = 'uniform float uFlutter; attribute float aTaper;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aTaper * .045 * vec3(sin(position.z*2.0+uFlutter),sin(position.x*1.7+uFlutter*.8),sin(position.y*2.4-uFlutter*.7));');
    };
    mesh.frustumCulled = false; scene.add(mesh); trails.push(mesh);
    if (trails.length > 8) { const old = trails.shift()!; scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
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
    if (introducing) introElapsed += dt;
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
      f.ribbon.geometry.setDrawRange(0, Math.max(0, (index - 1) * 24));
      const chroma = Math.hypot(a.lab[1], a.lab[2]);
      const hueSector = Math.floor((Math.atan2(a.lab[2], a.lab[1]) + Math.PI) / (Math.PI / 5));
      if (f.length > 12 && chroma > .035 && previousHue !== null && hueSector !== previousHue && time - lastGate > .7 && !reduced) {
        lastGate = time;
        for (let ring = 0; ring < 3; ring++) {
          pulse(f.path[Math.min(f.path.length - 1, index + ring * 5)].rgb, p.clone().addScaledVector(travelDirection, ring * .55), travelDirection);
        }
      }
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
    targetMist.material.opacity = won ? .2 : .055 + (reduced ? 0 : Math.sin(time * 1.8) * .025);
    targetRings.forEach((ring, i) => {
      ring.quaternion.copy(camera.quaternion);
      const pulsePhase = reduced ? .3 : (time * .4 + i / 3) % 1;
      ring.scale.setScalar(.65 + pulsePhase * 2.3);
      ring.material.color.copy(targetMaterial.color).lerp(new THREE.Color('#f6efda'), .25);
      ring.material.opacity = (1 - pulsePhase) ** 2 * .7;
    });
    pulses.forEach(({ mesh, born }) => { const age = time - born; mesh.scale.setScalar(1 + age * 3); mesh.material.opacity = Math.max(0, .5 - age * .18); });
    while (pulses.length && time - pulses[0].born > 3) { const old = pulses.shift()!; scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
    trails.forEach((trail) => {
      trail.userData.flutter.value = reduced ? 0 : time;
      if (trail !== flight?.ribbon) trail.material.opacity = Math.max(.08, trail.material.opacity - dt * .045);
    });
    targetGlow.quaternion.copy(camera.quaternion);
    targetGlow.material.uniforms.strength.value = reduced ? .18 : .2 + Math.sin(time * 1.8) * .06;
    nodeMaterial.uniforms.uTime.value = reduced ? 0 : time;
    nodeMaterial.uniforms.uPlayer.value.copy(introducing ? camera.position : blob.position);
    nodeMaterial.uniforms.uIntro.value = introducing && !reduced ? Math.sin(Math.PI * Math.min(1, introElapsed / 3.6)) : 0;
    nodeMaterial.uniforms.uFlight.value += ((flight ? 1 : 0) - nodeMaterial.uniforms.uFlight.value) * (1 - Math.exp(-dt * 3));

    // Remain inside the lattice. Follow behind the glider, never zoom out to
    // fit the whole system. At rest, turn toward the destination from here.
    const toTarget = target.position.clone().sub(blob.position);
    const separation = toTarget.length();
    const heading = flight ? travelDirection.clone() : separation > .25 ? toTarget.clone().normalize() : travelDirection.clone();
    if (flight) { orbitYaw *= Math.exp(-dt * 1.2); orbitPitch *= Math.exp(-dt * 1.2); }
    heading.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitYaw);
    const orbitSide = heading.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    if (orbitSide.lengthSq() > .01) heading.applyAxisAngle(orbitSide, orbitPitch);
    // Quaternion interpolation handles opposite headings without a sudden flip.
    const turn = new THREE.Quaternion().setFromUnitVectors(cameraDirection, heading);
    const delayedTurn = new THREE.Quaternion().slerp(turn, 1 - Math.exp(-dt * (reduced ? 8 : flight ? .85 : .7)));
    cameraDirection.applyQuaternion(delayedTurn).normalize();
    const side = cameraDirection.clone().cross(new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < .01) side.set(1, 0, 0); else side.normalize();
    const longShot = flight ? smooth(Math.min(1, Math.max(0, (flight.length - 10) / 24))) : 0;
    const nearGoal = 1 - smooth(Math.min(1, separation / 12));
    const distanceBehind = (camera.aspect < .85 ? 6.3 : 5.4) + longShot * 3 + nearGoal * 2.5;
    const desiredPosition = blob.position.clone().addScaledVector(cameraDirection, -distanceBehind).addScaledVector(side, 2.8 + longShot * 3 + nearGoal * 2).add(new THREE.Vector3(0, 1.8 + longShot, 0));
    const desiredLook = flight ? blob.position.clone().addScaledVector(cameraDirection, 2.5) : blob.position.clone().addScaledVector(toTarget, Math.min(.5, 4 / Math.max(1, separation)));
    const damping = reduced ? 12 : (flight ? 2.5 : 2) / (1 + Math.log1p(mass) * .035);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * damping));
    lookAt.lerp(desiredLook, 1 - Math.exp(-dt * (reduced ? 12 : 2.8)));
    if (introducing) {
      const progress = reduced ? 1 : Math.min(1, introElapsed / 3.6);
      camera.position.copy(introCurve.getPoint(smooth(progress)));
      lookAt.copy(target.position).lerp(introFinishLook, smooth(Math.max(0, (progress - .2) / .8)));
      blob.visible = progress > .55;
      if (progress === 1) { introducing = false; blob.visible = true; callbacks.onIntroEnd(); }
    }
    const desiredFov = reduced ? 62 : 62 + Math.min(8, speed * .2);
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
    skipIntro() { introElapsed = 3.6; },
    charge(rgb: RGB, ratio: number, power: number, tangent?: ColorPoint) { charge = { rgb, ratio, power, tangent: tangent ? v3(tangent).sub(blob.position).normalize() : undefined }; },
    cancelCharge() { charge = null; },
    launch(path: ColorPoint[], fromMass: number, toMass: number, done: () => void) {
      charge = null; releaseTime = time;
      if (path.length === 1) path = baseLaunchPath(activeHole.start, path[0]);
      const distances = [0];
      for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + v3(path[i]).distanceTo(v3(path[i - 1])));
      const length = distances[distances.length - 1];
      const initialTangent = v3(path[Math.min(6, path.length - 1)]).sub(v3(path[0]));
      if (initialTangent.lengthSq() > .000001) travelDirection.copy(initialTangent.normalize());
      pulse(path[0].rgb, blob.position, travelDirection);
      flight = { path, distances, length, elapsed: 0, duration: reduced ? .4 : Math.max(.7, Math.min(3.2, .5 + Math.sqrt(length) * .35 + Math.log1p(toMass) * .018)), fromMass, toMass, done, ribbon: makeRibbon(path, toMass) };
    },
    celebrate() { won = true; pulse(activeHole.target.rgb, target.position, new THREE.Vector3(0, 0, 1)); },
    dispose() {
      disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); motionQuery.removeEventListener('change', changeMotion);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerEnd); renderer.domElement.removeEventListener('pointercancel', pointerEnd);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) geometries.add(object.geometry);
        if ('material' in object) { const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach((m) => { if (m instanceof THREE.Material) materials.add(m); }); }
      });
      geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
export type PlayScene = ReturnType<typeof createPlayScene>;
