import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { flightProgress, ribbonEdges, planArrival, wrapAngle, closestHeading, targetFlightPath, splitTargetResponse, captureProgress, finWidth, easeQuint, WAKE_SECONDS, wakeEnvelope } from './play-motion';
import { FIELD_POINTS, baseLaunchPath, colorDistance, landingBoundary, type ColorPoint, type Hole, type RGB } from './play-engine';

type Flight = { path: ColorPoint[]; recoil: THREE.Vector3[]; endpoint: ColorPoint; qualifies: boolean; distances: number[]; length: number; elapsed: number; duration: number; fromMass: number; toMass: number; done: () => void; ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> };
type SceneCallbacks = { targetPosition: (x: number, y: number, offscreen: boolean, angle: number) => void; onIntroEnd: () => void; onError: () => void };
const v3 = (point: ColorPoint) => new THREE.Vector3(...point.position);
const color = (rgb: RGB) => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
const smooth = (t: number) => t * t * (3 - 2 * t);

export function createPlayScene(host: HTMLDivElement, hole: Hole, callbacks: SceneCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#353e44');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional paint space. Hold a paint below, then release to pour toward the target.');
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#353e44', .005);
  const camera = new THREE.PerspectiveCamera(58, 1, .06, 240);
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
  const tendrils = Array.from({ length: 5 }, (_, strand) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(26 * 6), 3));
    const indices: number[] = [];
    for (let i = 0; i < 25; i++) { const n = i * 2; indices.push(n,n+1,n+2,n+1,n+3,n+2); }
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#dbd8ca', side: THREE.DoubleSide }));
    mesh.userData.phase = strand * Math.PI * 2 / 5;
    mesh.frustumCulled = false; blob.add(mesh); return mesh;
  });
  const outline = new THREE.Mesh(blobGeometry, new THREE.MeshBasicMaterial({ color: '#fff5d9', side: THREE.BackSide, transparent: true, opacity: .9, depthWrite: false }));
  outline.scale.setScalar(1.025); blob.add(outline);
  const darkOutline = new THREE.Mesh(blobGeometry,new THREE.MeshBasicMaterial({color:'#17242d',side:THREE.BackSide}));
  const rimBrightness = {value:0};
  darkOutline.material.onBeforeCompile = shader => {
    shader.uniforms.uBrightness=rimBrightness;
    shader.vertexShader='varying vec3 vRimPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRimPosition=position;');
    shader.fragmentShader='uniform float uBrightness; varying vec3 vRimPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 prism=.58+.13*cos(vec3(0.0,2.1,4.2)+vRimPosition.y*5.0+vRimPosition.x*4.0);
      diffuseColor.rgb=mix(prism,prism*.12,uBrightness);`);
  };
  blob.add(darkOutline);
  // Soft geometric shells, not a bloom/post-processing pass.
  const halos=[1.29,1.4].map((scale,i)=>{
    const mesh=new THREE.Mesh(blobGeometry,new THREE.MeshBasicMaterial({color:'#e4dce5',side:THREE.BackSide,transparent:true,opacity:i?.055:.12,depthWrite:false}));
    mesh.userData.factor=scale; mesh.renderOrder=0; blob.add(mesh); return mesh;
  });
  darkOutline.renderOrder = 1; outline.renderOrder = 2; body.renderOrder = 3;
  scene.add(blob);

  const chargeRing = new THREE.Mesh(new THREE.TorusGeometry(.45, .012, 6, 90), new THREE.MeshBasicMaterial({ color: '#f3e6bf', transparent: true, opacity: 0 }));
  scene.add(chargeRing);
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  satellite.visible = false; scene.add(satellite);

  // One instanced draw: crisp matte cells throughout the color volume. No
  // ring scaffolding, point-sprite blur, lighting glare, or empty neutral grid.
  const nodesGeometry = new THREE.BoxGeometry(.64, .64, .64);
  const wakeSamples=Array.from({length:24},()=>new THREE.Vector4(0,0,0,-100));
  const wakeGains=new Float32Array(24);
  let wakeCursor=0, lastWake=-10;
  const nodeUniforms = { uTime: { value: 0 }, uMotion: {value:1}, uWakes:{value:wakeSamples}, uWakeGain:{value:wakeGains}, uFlight: { value: 0 }, uSpeed: {value:0}, uTarget: { value: new THREE.Vector3() }, uPlayer: { value: new THREE.Vector3() } };
  const nodeMaterial = new THREE.MeshBasicMaterial({ depthWrite: true });
  nodeMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, nodeUniforms);
    shader.vertexShader = `uniform float uTime; uniform float uMotion; uniform vec4 uWakes[24]; uniform float uWakeGain[24]; uniform float uFlight; uniform float uSpeed; uniform vec3 uPlayer; uniform vec3 uTarget; varying float vFieldAlpha;
      vec3 corridor(vec3 p, vec3 endPoint) {
        vec3 axis=endPoint-cameraPosition;
        float t=clamp(dot(p-cameraPosition,axis)/max(.01,dot(axis,axis)),0.0,1.0);
        vec3 delta=p-(cameraPosition+axis*t);
        float radius=mix(1.2,1.5,t);
        return delta/max(.01,length(delta))*(1.0-smoothstep(radius,radius+1.8,length(delta)))*2.8;
      }\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      vec3 base=instanceMatrix[3].xyz;
      vec3 delta=base-uPlayer;
      float d=length(delta);
      float nearby=1.0-smoothstep(3.0,26.0,d);
      vec3 targetDelta=base-uTarget;
      float targetEnergy=1.0-smoothstep(2.0,20.0,length(targetDelta));
      float energy=1.0-(1.0-nearby)*(1.0-targetEnergy);
      float region=sin(atan(base.z,base.x)*2.0+base.y*.11);
      float wave=sin(uTime*(.6+region*.12)+base.y*.25+sin(base.z*.2));
      vec3 outward=delta/max(.01,d);
      vec3 swirl=vec3(-outward.z,0.0,outward.x);
      float wake=(.45+uFlight*.55)*exp(-d*d/(40.0+uSpeed*24.0));
      vec3 displacement=outward*wake*(3.5+uSpeed*.9)+swirl*wake*(1.0+region*.35+uSpeed*.4);
      vec3 breath=vec3(wave,sin(uTime*.48+base.x*.13+base.z*.11),cos(uTime*.57+base.x*.17));
      displacement+=breath*(.08+energy*.36)*uMotion;
      vec3 ripplePush=vec3(0.0); float rippleScale=0.0;
      for(int i=0;i<24;i++) {
        float age=uTime-uWakes[i].w;
        if(uWakeGain[i]>.001 && uMotion>0.0) {
          vec3 radial=base-uWakes[i].xyz; float rd=length(radial);
          float front=rd-age*1.8;
          float ring=exp(-front*front/7.0)*sin(front*1.05)*uWakeGain[i];
          ripplePush+=radial/max(.01,rd)*ring*.28;
          rippleScale+=ring*.045;
        }
      }
      displacement+=ripplePush/(1.0+length(ripplePush)/1.1);
      displacement+=corridor(base,uPlayer)+corridor(base,uTarget);
      displacement+=normalize(targetDelta+vec3(.001))*exp(-dot(targetDelta,targetDelta)/12.0)*(1.1+.2*wave*uMotion);
      float size=mix(.6,1.35,energy)*(1.0+wave*(.025+energy*.085)*uMotion+clamp(rippleScale,-.12,.12));
      vec3 moved=base+displacement;
      vec4 eyeCell=modelViewMatrix*vec4(moved,1.0);
      vec4 playerClip=projectionMatrix*modelViewMatrix*vec4(uPlayer,1.0);
      vec4 movedClip=projectionMatrix*eyeCell;
      float playerGap=length(movedClip.xy/max(.01,movedClip.w)-playerClip.xy/max(.01,playerClip.w));
      float foreground=smoothstep(1.8,3.2,-eyeCell.z);
      float playerClear=mix(smoothstep(.10,.24,playerGap),1.0,step(playerClip.w+1.0,movedClip.w));
      vec3 transformed=position*size*foreground*playerClear+displacement;
      vec4 cell=projectionMatrix*modelViewMatrix*vec4(base+displacement,1.0);
      vec4 goal=projectionMatrix*modelViewMatrix*vec4(uTarget,1.0);
      float clearGoal=smoothstep(.05,.18,length(cell.xy/max(.01,cell.w)-goal.xy/max(.01,goal.w)));
      float depth=-(modelViewMatrix*vec4(base,1.0)).z;
      vFieldAlpha=foreground*playerClear*smoothstep(.8,1.8,d)*mix(clearGoal,1.0,step(goal.w+1.0,cell.w));
    `);
    shader.fragmentShader = 'varying float vFieldAlpha;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'if(vFieldAlpha < .15) discard;\n#include <opaque_fragment>');
  };
  const field = new THREE.InstancedMesh(nodesGeometry, nodeMaterial, FIELD_POINTS.length);
  const transform = new THREE.Matrix4();
  FIELD_POINTS.forEach((point, i) => { field.setMatrixAt(i, transform.makeTranslation(...point.position)); field.setColorAt(i, color(point.rgb)); });
  field.instanceMatrix.needsUpdate = true;
  field.frustumCulled = false;
  scene.add(field);

  const target = new THREE.Group(); scene.add(target);
  const targetAnchor=new THREE.Vector3(...hole.target.position);
  const targetRecoil=new THREE.Vector3();
  const targetMaterial = new THREE.MeshBasicMaterial({ color: color(hole.target.rgb) });
  const targetCore = new THREE.Mesh(new THREE.SphereGeometry(.62, 28, 20), targetMaterial); target.add(targetCore);
  const targetRim = new THREE.Mesh(targetCore.geometry,new THREE.MeshBasicMaterial({color:'#fff5dc',side:THREE.BackSide}));
  target.add(targetRim);
  const targetBoundary = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#e9dfc9', transparent: true, opacity: .35 }));
  target.add(targetBoundary);
  const targetGlow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: color(hole.target.rgb) }, strength: { value: .2 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 tint; uniform float strength; varying vec2 vUv; void main(){float r=length(vUv-.5)*2.0;gl_FragColor=vec4(tint,exp(-r*r*7.0)*strength*(1.0-smoothstep(.7,1.0,r)));\n#include <colorspace_fragment>\n}',
  }));
  target.add(targetGlow);
  const targetRings = Array.from({ length: 1 }, (_, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .009, 5, 100), new THREE.MeshBasicMaterial({ color: '#e9dfc9', transparent: true, opacity: i === 0 ? .7 : .24 }));
    target.add(ring); return ring;
  });
  const pulses: { mesh: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>; born: number }[] = [];
  const trails: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  let current = hole.start;
  let mass = 0;
  let activeHole = hole;
  let flight: Flight | null = null;
  let captureAmount = 0;
  let cameraYaw = 0; let yawGoal = 0; let cameraPitch = 0;
  let charge: { rgb: RGB; ratio: number; power: number; tangent?: THREE.Vector3 } | null = null;
  let time = 0; let last = performance.now(); let landing = -10; let releaseTime = -10;
  let previousHue: number | null = null;
  let lastGate = -10;
  let introElapsed = 0; let introducing = true;
  const introSeconds=4.8;
  const background=new THREE.Color('#353e44');
  const darkBackground=new THREE.Color('#202b2e'), lightBackground=new THREE.Color('#b5b9b3');
  let introPose: ReturnType<typeof planArrival>;
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
    orbitYaw = wrapAngle(orbitYaw - (event.clientX - drag.x) * .005);
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
    cameraYaw = yawGoal = Math.atan2(cameraDirection.x, cameraDirection.z);
    cameraPitch = Math.asin(THREE.MathUtils.clamp(cameraDirection.y,-.94,.94)); captureAmount = 0;
    cameraDirection.set(Math.sin(cameraYaw)*Math.cos(cameraPitch),Math.sin(cameraPitch),Math.cos(cameraYaw)*Math.cos(cameraPitch));
    wakeSamples.forEach(sample=>sample.w=-100); wakeCursor=0; lastWake=-10;
    lookAt.copy(blob.position).addScaledVector(cameraDirection, 2.5);
    target.position.copy(v3(next.target));
    targetAnchor.copy(target.position); targetRecoil.set(0,0,0);
    targetMaterial.color.copy(color(next.target.rgb));
    // A readable spherical marker, sized from the local perceptual tolerance.
    // It is an approximate cue; settlement is still scored in OKLab.
    let radius = 0;
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const direction: [number, number, number] = [0, 0, 0]; direction[axis] = sign;
      radius += new THREE.Vector3(...landingBoundary(next.target, next.tolerance, direction)).distanceTo(target.position) / 6;
    }
    radius = Math.max(.9, radius);
    const boundaryLines: THREE.Vector3[] = [];
    for (let axis = 0; axis < 3; axis++) for (let segment = 0; segment < 80; segment++) for (const t of [segment, segment + 1]) {
      const angle = t / 80 * Math.PI * 2;
      const direction: [number, number, number] = [0, 0, 0]; direction[(axis + 1) % 3] = Math.cos(angle); direction[(axis + 2) % 3] = Math.sin(angle);
      boundaryLines.push(new THREE.Vector3(...direction).multiplyScalar(radius));
    }
    targetBoundary.geometry.dispose(); targetBoundary.geometry = new THREE.BufferGeometry().setFromPoints(boundaryLines);
    targetGlow.material.uniforms.tint.value.copy(targetMaterial.color);
    targetRings.forEach((ring) => ring.scale.setScalar(Math.min(2.2, radius * .55)));
    nodeUniforms.uTarget.value.copy(target.position);
    trails.splice(0).forEach((mesh) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    pulses.splice(0).forEach(({ mesh }) => { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); });
    const side = cameraDirection.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const separation = target.position.distanceTo(blob.position);
    const nearGoal = 1 - smooth(Math.min(1, separation / 12));
    const restPosition = blob.position.clone().addScaledVector(cameraDirection, -((camera.aspect < .85 ? 6.3 : 5.4) + nearGoal * 2.5)).addScaledVector(side, 2.8 + nearGoal * 2).add(new THREE.Vector3(0, 1.8, 0));
    introFinishLook.copy(blob.position).lerp(target.position, Math.min(.5, 4 / Math.max(1, separation)));
    introPose = planArrival(target.position,restPosition,introFinishLook,next.seed+Math.imul(next.stage+1,7919));
    introElapsed = 0; introducing = true;
    camera.position.copy(reduced ? restPosition : introPose(0).position);
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
      // Flatten two decorative strands along the local radial tangent plane
      // on chromatic runs, without changing the sampled mixture trajectory.
      const radial = new THREE.Vector3(point.position[0],0,point.position[2]).normalize();
      const railSide = tangent.clone().cross(radial).normalize();
      const envelope = Math.sin(Math.PI * i / Math.max(1, path.length - 1)) ** .6;
      for (let strand = 0; strand < 4; strand++) {
        const phase = strand * Math.PI / 2;
        const wave = traveled * (.16 + strand * .025) + phase;
        const offset = across.clone().multiplyScalar(Math.cos(wave) * (.22 + strand * .08) * envelope)
          .addScaledVector(binormal, (Math.sin(wave) * .3 + noise.noise(traveled * .12, strand * 2, 0) * .1) * envelope);
        const edgeRide = Math.hypot(point.lab[1],point.lab[2]) > .10 && strand < 2 && railSide.lengthSq() > .5;
        if (edgeRide) offset.copy(railSide).multiplyScalar((strand ? 1 : -1) * .4 * envelope);
        const center = v3(point).add(offset);
        const halfWidth = (.048 + strand * .014) * (.8 + .2 * Math.sin(traveled * 1.1 + phase));
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
    mesh.userData.settledAt = null;
    const taper = path.flatMap((_, i) => Array(8).fill(Math.sin(Math.PI * i / Math.max(1, path.length - 1))));
    geometry.setAttribute('aTaper', new THREE.Float32BufferAttribute(taper, 1));
    mesh.material.onBeforeCompile = shader => {
      shader.uniforms.uFlutter = flutter;
      shader.vertexShader = 'uniform float uFlutter; attribute float aTaper;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += aTaper * .045 * vec3(sin(position.z*2.0+uFlutter),sin(position.x*1.7+uFlutter*.8),sin(position.y*2.4-uFlutter*.7));');
    };
    mesh.frustumCulled = false; scene.add(mesh); trails.push(mesh);
    if (trails.length > 4) { const old = trails.shift()!; scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
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
      const distance = (f.qualifies ? captureProgress(progress) : flightProgress(progress)) * f.length;
      let index = 1;
      while (index < f.distances.length - 1 && f.distances[index] < distance) index++;
      const fraction = (distance - f.distances[index - 1]) / Math.max(.000001, f.distances[index] - f.distances[index - 1]);
      const a = f.path[index - 1]; const b = f.path[index];
      const p = v3(a).lerp(v3(b), fraction);
      targetRecoil.copy(f.recoil[index-1]).lerp(f.recoil[index],fraction);
      target.position.copy(targetAnchor).add(targetRecoil);
      const old = blob.position.clone(); blob.position.copy(p);
      captureAmount=f.qualifies ? easeQuint((progress-.78)/.22) : 0;
      if(!reduced && time-lastWake>.42) {
        wakeSamples[wakeCursor].set(p.x,p.y,p.z,time); wakeCursor=(wakeCursor+1)%wakeSamples.length; lastWake=time;
      }
      speed = old.distanceTo(p) / Math.max(dt, .001);
      const tangent = v3(b).sub(v3(a));
      if (tangent.lengthSq() > .000001) travelDirection.lerp(tangent.normalize(), 1 - Math.exp(-dt * 12)).normalize();
      movingPoint = { rgb: a.rgb.map((n, i) => n + (b.rgb[i] - n) * fraction) as RGB, lab: a.lab, position: p.toArray() as [number, number, number] };
      mass = f.fromMass + (f.toMass - f.fromMass) * smooth(progress);
      f.ribbon.geometry.setDrawRange(0, Math.max(0, (index - 1) * 24));
      const chroma = Math.hypot(a.lab[1], a.lab[2]);
      const hueSector = Math.floor((Math.atan2(a.lab[2], a.lab[1]) + Math.PI) / (Math.PI / 5));
      if (f.length > 7 && progress > .1 && progress < .9 && time - lastGate > .5 && !reduced &&
        ((chroma > .035 && previousHue !== null && hueSector !== previousHue) || speed > 6)) {
        lastGate = time;
        for (let ring = 0; ring < 3; ring++) {
          pulse(f.path[Math.min(f.path.length - 1, index + ring * 5)].rgb, p.clone().addScaledVector(travelDirection, ring * .55), travelDirection);
        }
      }
      if (chroma > .035) previousHue = hueSector;
      if (progress === 1) {
        current = f.endpoint; mass = f.toMass; movingPoint = current;
        blob.position.copy(f.qualifies ? target.position : v3(current)); f.ribbon.geometry.setDrawRange(0, Infinity);
        f.ribbon.userData.settledAt=time;
        flight = null; landing = time; pulse(current.rgb, blob.position, travelDirection);
        won=f.qualifies; f.done();
      }
    } else { blob.position.copy(v3(current));targetRecoil.multiplyScalar(Math.exp(-dt*5));target.position.copy(targetAnchor).add(targetRecoil); }
    if (won) blob.position.copy(target.position);
    const scale = (1 - activeHole.stage * .035) * (1 + Math.min(.35, Math.log1p(mass) * .05)) * (won ? .25 : 1-.7*captureAmount);
    const launchAge = time - releaseTime;
    const kick = reduced ? 0 : Math.exp(-launchAge * 7) * .65;
    const settle = reduced ? 0 : Math.exp(-(time - landing) * 5) * Math.sin((time - landing) * 7) * .075;
    const tension = reduced ? 0 : charge?.power ?? 0;
    const stretch = reduced ? 0 : Math.min(.38, speed * .025) + kick;
    body.scale.set(1 - tension * .14 - stretch * .2 + settle, 1 - tension * .14 - stretch * .15 + settle, 1 + tension * .38 + stretch - settle);
    blob.scale.setScalar(scale);
    const shapeTime = reduced ? 0 : time * .28;
    for (let i = 0; i < positions.count; i++) {
      const x = directions[i * 3] / .24, y = directions[i * 3 + 1] / .24, z = directions[i * 3 + 2] / .24;
      const low = noise.noise(x * 1.35 + shapeTime, y * 1.35, z * 1.35 - shapeTime * .6);
      const fine = noise.noise(x * 2.6, y * 2.6 + shapeTime * .5, z * 2.6);
      const radius = .24 * (1 + low * (.08 + tension * .025) + fine * .012);
      const bell = 1 + .12 * Math.sin(z * 2 + shapeTime * 2);
      const taper=1-tension*(.12+.34*Math.max(0,z));
      positions.setXYZ(i, x * radius * bell*taper, y * radius * bell*taper, z * radius * (.8+tension*.22));
    }
    positions.needsUpdate = true;
    const idleFacing = targetAnchor.clone().sub(blob.position).normalize();
    const facing = charge?.tangent ?? (flight || won ? travelDirection : idleFacing);
    if (facing.lengthSq() > .001) body.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing), 1 - Math.exp(-dt * 7));
    outline.quaternion.copy(body.quaternion); outline.scale.copy(body.scale).multiplyScalar(1.13);
    darkOutline.quaternion.copy(body.quaternion); darkOutline.scale.copy(body.scale).multiplyScalar(1.22);
    halos.forEach(mesh=>{mesh.quaternion.copy(body.quaternion);mesh.scale.copy(body.scale).multiplyScalar(mesh.userData.factor);});
    blobMaterial.color.copy(mass ? color(movingPoint.rgb) : new THREE.Color('#d8d5c7'));
    tendrils.forEach(mesh => {
      mesh.quaternion.copy(body.quaternion);
      mesh.scale.copy(body.scale);
      mesh.material.color.copy(blobMaterial.color);
      const attribute = mesh.geometry.getAttribute('position');
      const phase = mesh.userData.phase as number;
      const length = .7 + Math.min(.8, speed * .035);
      for (let j = 0; j < 26; j++) {
        const t = j / 25;
        const ripple = reduced ? 0 : Math.sin(t * (6+tension*3) - time * (2+tension*7) + phase) * (.1+tension*.07) * t;
        const spread = .17 + t * .12 + ripple;
        const x = Math.cos(phase) * spread, y = Math.sin(phase) * spread;
        const w = finWidth(t);
        const wx=-Math.sin(phase)*w, wy=Math.cos(phase)*w;
        attribute.setXYZ(j*2,x-wx,y-wy,-.10-t*length);
        attribute.setXYZ(j*2+1,x+wx,y+wy,-.10-t*length);
      }
      attribute.needsUpdate = true;
    });
    outline.material.opacity = reduced ? .85 : .83 + .09*Math.sin(time*1.7);

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
    targetRim.scale.copy(targetCore.scale).multiplyScalar(1.055);
    targetBoundary.material.opacity = won ? .8 : .5;
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
      if (trail.userData.settledAt !== null) trail.material.opacity = .95*(1-easeQuint((time-trail.userData.settledAt)/WAKE_SECONDS));
    });
    for(let i=trails.length-1;i>=0;i--) if(trails[i].material.opacity<=.001) {
      const old=trails.splice(i,1)[0];scene.remove(old);old.geometry.dispose();old.material.dispose();
    }
    targetGlow.quaternion.copy(camera.quaternion);
    targetGlow.material.uniforms.strength.value = reduced ? .18 : .2 + Math.sin(time * 1.8) * .06;
    nodeUniforms.uTime.value = reduced ? 0 : time;
    nodeUniforms.uPlayer.value.copy(blob.position);
    nodeUniforms.uTarget.value.copy(target.position);
    nodeUniforms.uMotion.value = reduced ? 0 : 1;
    wakeSamples.forEach((sample,i)=>{wakeGains[i]=reduced?0:wakeEnvelope(time-sample.w);});
    nodeUniforms.uFlight.value += ((flight && !reduced ? 1 : 0) - nodeUniforms.uFlight.value) * (1 - Math.exp(-dt * 3));
    nodeUniforms.uSpeed.value += ((reduced ? 0 : Math.min(1.5,speed/16))-nodeUniforms.uSpeed.value)*(1-Math.exp(-dt*3));

    // Remain inside the lattice. Follow behind the glider, never zoom out to
    // fit the whole system. At rest, turn toward the destination from here.
    const toTarget = targetAnchor.clone().sub(blob.position);
    const separation = toTarget.length();
    const heading = flight ? travelDirection.clone() : separation > .25 ? toTarget.clone().normalize() : travelDirection.clone();
    if (flight) { orbitYaw *= Math.exp(-dt * 1.2); orbitPitch *= Math.exp(-dt * 1.2); }
    heading.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitYaw);
    const orbitSide = heading.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    if (orbitSide.lengthSq() > .01) heading.applyAxisAngle(orbitSide, orbitPitch);
    // Quaternion interpolation handles opposite headings without a sudden flip.
    if (Math.hypot(heading.x, heading.z) > .12) {
      const raw = Math.atan2(heading.x, heading.z);
      // Unwrap against the previous goal, not the camera: a chosen turn cannot
      // reverse merely because its shortest route crosses the +/- pi seam.
      yawGoal += Math.atan2(Math.sin(raw-yawGoal), Math.cos(raw-yawGoal));
    }
    const turnRate = 1 - Math.exp(-dt * (reduced ? 8 : .75));
    cameraYaw += (yawGoal-cameraYaw)*turnRate;
    cameraPitch += (Math.asin(THREE.MathUtils.clamp(heading.y,-.94,.94))-cameraPitch)*turnRate;
    cameraDirection.set(Math.sin(cameraYaw)*Math.cos(cameraPitch),Math.sin(cameraPitch),Math.cos(cameraYaw)*Math.cos(cameraPitch));
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
      const progress = reduced ? 1 : Math.min(1, introElapsed / introSeconds);
      const pose = introPose(progress);
      camera.position.copy(pose.position);
      lookAt.copy(camera.position).add(new THREE.Vector3(0,0,-1).applyQuaternion(pose.quaternion));
      blob.visible = progress > .55;
      if (progress === 1) { introducing = false; blob.visible = true; lookAt.copy(introFinishLook); callbacks.onIntroEnd(); }
    }
    // The intro samples its current altitude, settling to the empty start's
    // value near arrival. After base selection, only the mixture drives light.
    const mixtureValue=mass ? movingPoint.position[1] : activeHole.start.position[1];
    const introBlend=introducing ? 1-easeQuint((introElapsed/introSeconds-.65)/.35) : 0;
    const valueHeight=THREE.MathUtils.lerp(mixtureValue,camera.position.y,introBlend);
    const brightness=smooth(THREE.MathUtils.clamp((valueHeight+2)/20,0,1));
    const desiredBackground=darkBackground.clone().lerp(lightBackground,brightness);
    if(introducing && introElapsed<=dt*1.01) background.copy(desiredBackground);
    else background.lerp(desiredBackground,1-Math.exp(-dt*1.6));
    renderer.setClearColor(background); (scene.fog as THREE.FogExp2).color.copy(background);
    rimBrightness.value+=(brightness-rimBrightness.value)*(1-Math.exp(-dt*2));
    outline.material.color.set('#fff5e3').lerp(new THREE.Color('#34434a'),rimBrightness.value);
    halos.forEach(mesh=>mesh.material.color.copy(outline.material.color));
    const desiredFov = reduced ? 58 : 58 + Math.min(3, speed * .06);
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
      if (path.length === 1) path = baseLaunchPath(activeHole.start, path[0]);
      const endpoint=path[path.length-1];
      const qualifies=fromMass>0 && colorDistance(endpoint,activeHole.target)<=activeHole.tolerance;
      const diverted=targetFlightPath(path,activeHole.target,qualifies);
      const response=splitTargetResponse(path,diverted,qualifies);
      path=response.path;const recoil=response.recoil;
      const distances = [0];
      for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + v3(path[i]).distanceTo(v3(path[i - 1])));
      const length = distances[distances.length - 1];
      const initialTangent = v3(path[Math.min(6, path.length - 1)]).sub(v3(path[0]));
      if (initialTangent.lengthSq() > .000001) travelDirection.copy(initialTangent.normalize());
      // Discard turn history, not the visible camera pose. Resume toward the
      // shot using the nearest equivalent heading, even after many full orbits.
      cameraYaw = wrapAngle(cameraYaw);
      yawGoal = closestHeading(cameraYaw,Math.atan2(travelDirection.x,travelDirection.z));
      orbitYaw = 0; orbitPitch = 0;
      pulse(path[0].rgb, blob.position, travelDirection);
      flight = { path, recoil, endpoint, qualifies, distances, length, elapsed: 0, duration: reduced ? .4 : Math.max(.7, Math.min(3.2, .5 + Math.sqrt(length) * .35 + Math.log1p(toMass) * .018)), fromMass, toMass, done, ribbon: makeRibbon(path, toMass) };
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
