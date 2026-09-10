import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAY_LEVELS, HOLES_PER_PALETTE, CHARGE_SECONDS, SPACE_NODES, baseLaunchPath, neutralStart, recipeTimingWindow, labPosition, landingBoundary, munsellPosition, addPaint, chargeAmount, chargePower, chargeRatio, colorDistance, generateHole, mixtureColor, pourPath, totalMass } from '../app/play-engine';
import courseBank from '../app/generated/play-courses.json';
import { paletteSignature, PROFILES, replayRoute, playerPar } from '../app/play-course-analysis';
import {LAB_STARTERS,newLabAttempt,validLabEvent,labEntries,type LabEvent} from '../app/play-lab-model';

test('lab starter snapshots survive serialization and replay the exact hole',()=>{
  assert.equal(LAB_STARTERS.length,12);
  for(const specimen of LAB_STARTERS){
    const attempt=newLabAttempt(specimen,'test-attempt');
    const event=JSON.parse(JSON.stringify({id:'test-event',attemptId:attempt.id,type:'attempt',attempt}));
    assert.ok(validLabEvent(event));
    assert.equal(event.type,'attempt');if(event.type!=='attempt')throw new Error('Expected attempt');
    assert.deepEqual(generateHole(specimen.levelIndex,specimen.hole.seed,specimen.hole.stage),specimen.hole);
    event.attempt.specimen.hole.tolerance+=.01;assert.equal(validLabEvent(event),false);
  }
});
test('lab replays retain earlier attempts and notes',()=>{
  const first=newLabAttempt(LAB_STARTERS[0],'first'),second=newLabAttempt(LAB_STARTERS[0],'second');
  const events:LabEvent[]=[{id:'one',attemptId:'first',type:'attempt',attempt:first},{id:'two',attemptId:'first',type:'review',review:{verdict:'keep',challenge:'setup',issue:'',note:'Great second pour',shot:null}},{id:'three',attemptId:'second',type:'attempt',attempt:second}];
  const entries=labEntries(events);assert.equal(entries.length,2);assert.equal(entries[1].review?.note,'Great second pour');
  assert.ok(validLabEvent(events[1]));assert.equal(validLabEvent({...events[1],review:{note:'bad'}}),false);
});

test('every palette shares one perceptual landing tolerance', () => {
  PLAY_LEVELS.forEach(level=>assert.equal(level.tolerance,.028));
});

test('the ten palettes have the requested pigments and names', () => {
  assert.deepEqual(PLAY_LEVELS.map(level => level.name), ['UltraOx Dual', 'Zorny', 'RYB', 'EarthPop', 'CMY', 'Secondaries', 'French Light', 'Chromatic Dark', 'Violet Shift', 'Double Cross']);
  assert.deepEqual(PLAY_LEVELS.map((level) => level.paints.map((p) => p.pigment)), [
    ['PR101', 'PB29', 'PW6'], ['PY43', 'PR108', 'PBk9', 'PW6'], ['PW1', 'PY35', 'PR108', 'PB15:3'], ['PY35', 'PR122', 'PB15:3', 'PR101'],
    ['PB15:3', 'PR122', 'PY3'], ['PO20', 'PV23', 'PG36', 'PW6'], ['PW1', 'PY35', 'PY43', 'PR108', 'PR83', 'PB28', 'PB29', 'PG18'],
    ['PV19', 'PG36', 'PB29', 'PW1'], ['PB28', 'PR108', 'PY3/PG36', 'PV23'],
    ['PO20', 'PB28', 'PR108', 'PG7/PY74'],
  ]);
});

test('mixtures retain absolute mass, independent of pour order or splitting', () => {
  const paints = PLAY_LEVELS[2].paints;
  const direct = [12, 3, 2, .4];
  let split = [0, 0, 0, 0];
  for (const [i, amount] of [[3, .2], [0, 5], [1, 3], [0, 7], [3, .2], [2, 2]]) split = addPaint(split, i, amount);
  assert.deepEqual(split, direct);
  assert.equal(totalMass(split), 17.4);
  assert.ok(colorDistance(mixtureColor(paints, direct), mixtureColor(paints, split)) < 1e-12);
  assert.ok(colorDistance(mixtureColor(paints, direct), mixtureColor(paints, direct.map((q) => q * 1e6))) < 1e-9);
});

test('tinting strength survives parts normalization and changes equal-dose mixtures', () => {
  const paints = PLAY_LEVELS[2].paints;
  const normal = mixtureColor(paints, [1,0,0,.1]);
  const weaker = paints.map(p => ({ ...p, strength: p.id === paints[3].id ? p.strength / 4 : p.strength }));
  const altered = mixtureColor(weaker, [1,0,0,.1]);
  assert.ok(colorDistance(normal, altered) > .02);
  assert.ok(colorDistance(normal, mixtureColor(paints, [100,0,0,10])) < 1e-9);
});

test('golf meter eases out, returns after peak, and mass reduces equal-charge influence', () => {
  assert.equal(chargePower(0), 0);
  assert.equal(chargePower(CHARGE_SECONDS), 1);
  assert.equal(chargePower(CHARGE_SECONDS * 2), 0);
  assert.equal(chargeRatio(CHARGE_SECONDS), 8);
  assert.ok(chargePower(CHARGE_SECONDS / 4) > .5);
  assert.ok(chargeAmount(100, 1) / 100 < chargeAmount(1, 1));
  assert.equal(chargeAmount(0, 1), 1);
  assert.ok(chargeRatio(.06) < .01);
  let previous = 0;
  for (let i = 0; i <= 100; i++) {
    const value = chargePower(CHARGE_SECONDS * i / 100);
    assert.ok(value >= previous); previous = value;
  }
});

test('pour endpoints are exactly the cumulative mixture, even after a large correction', () => {
  const paints = PLAY_LEVELS[2].paints;
  const before = [2, 1, 0, 4];
  const amount = totalMass(before) * 8;
  const path = pourPath(paints, before, 0, amount);
  assert.ok(colorDistance(path[0], mixtureColor(paints, before)) < 1e-12);
  assert.ok(colorDistance(path[path.length - 1], mixtureColor(paints, addPaint(before, 0, amount))) < 1e-12);
  assert.equal(totalMass(addPaint(before, 0, amount)), 63);
  for (const point of path) assert.ok([...point.lab, ...point.rgb, ...point.position].every(Number.isFinite));
});

test('every bank entry replays through the real charge controls and checks every base', () => {
  assert.equal(courseBank.signature,paletteSignature());
  let count=0;
  courseBank.palettes.forEach((palette,index)=>palette.rounds.flat().forEach(hole=>{
    const level=PLAY_LEVELS[index],target=mixtureColor(level.paints,hole.target);
    assert.equal(hole.solutionShots,hole.times.length);
    assert.equal(hole.order.length,hole.times.length+1);
    assert.ok(hole.times.every(t=>t>=0 && t<=CHARGE_SECONDS));
    const result=replayRoute(index,hole.order,hole.times);
    assert.deepEqual(result,hole.recipe);
    assert.ok(colorDistance(mixtureColor(level.paints,result),target)<level.tolerance,hole.id);
    assert.equal(hole.par,playerPar(hole.solutionShots,hole.timingWindow,PROFILES[index].challenge));
    assert.ok(hole.par>=2 && hole.par<=6 && hole.par>=hole.solutionShots);
    assert.deepEqual(hole.checks.map(c=>c.base),level.paints.map((_,i)=>i));
    assert.ok(hole.checks.every(c=>Number.isFinite(c.one)&&Number.isFinite(c.two)));
    // Never ignore a sampled easier route merely because it is off-center.
    if(hole.solutionShots>1)assert.ok(hole.checks.every(c=>c.one>=level.tolerance-1e-8));
    if(hole.solutionShots>2)assert.ok(hole.checks.every(c=>c.two>=level.tolerance-1e-8));
    assert.ok(hole.nearestBase>=level.tolerance*1.8);
    assert.ok(hole.nearestWorld>=6.5);
    assert.ok(hole.tapError>level.tolerance);
    assert.ok(hole.timingWindow>0);
    for(const direction of [-1,1])for(let i=0;i<hole.times.length;i++) {
      const times=[...hole.times];times[i]+=direction*hole.timingWindow*.5;
      if(times[i]<0||times[i]>CHARGE_SECONDS)continue;
      assert.ok(colorDistance(mixtureColor(level.paints,replayRoute(index,hole.order,times)),target)<=level.tolerance,hole.id+' timing margin');
    }
    count++;
  }));
  assert.equal(count,200);
  assert.equal(playerPar(3,.01,1),6,'difficult profiles support par six without equating it to six necessary shots');
  console.log(`${count} evaluated course routes replayed, including mass-dependent later doses.`);
});

test('smooth calibration retains a broad color volume; scoring is independent of its projection', () => {
  const a = mixtureColor(PLAY_LEVELS[0].paints, [3, 1, 4]);
  let error = 0;
  for (const { chip, point } of SPACE_NODES) {
    const reference = munsellPosition(chip);
    error += point.position.reduce((sum, n, i) => sum + (n - reference[i]) ** 2, 0);
    assert.ok(point.position.every(Number.isFinite));
  }
  const rms = Math.sqrt(error / SPACE_NODES.length);
  console.log(`Global Munsell display calibration RMS: ${rms.toFixed(2)} world units.`);
  assert.ok(rms < 5);
  for (const l of [.2, .4, .6, .8, 1]) {
    const p = labPosition([l, 0, 0]);
    assert.ok(Math.hypot(p[0], p[2]) < 1e-9);
  }
  for (const direction of [[1,0,0], [0,1,0], [0,0,1], [-1,2,-3]]) {
    const tolerance = .038;
    const length = Math.hypot(...direction);
    const lab = a.lab.map((n,i) => n + direction[i] / length * tolerance) as [number,number,number];
    assert.ok(Math.abs(colorDistance(a, {...a, lab}) - tolerance) < 1e-12);
    assert.deepEqual(landingBoundary(a, tolerance, direction as [number,number,number]), labPosition(lab));
    const shifted = labPosition(lab.map((n,i) => n + (i === 1 ? 1e-7 : 0)) as [number,number,number]);
    assert.ok(Math.hypot(...shifted.map((n,i) => n - labPosition(lab)[i])) < .001);
  }
});

test('straight color changes do not acquire sample-well jitter or reversals', () => {
  for (const [from, to] of [
    [[.45, .08, .07], [.75, .02, .02]],
    [[.5, .15, .06], [.4, -.07, -.15]],
    [[.3, 0, 0], [.9, 0, 0]],
  ]) {
    const path = Array.from({ length: 201 }, (_, i) => labPosition(from.map((n, axis) => n + (to[axis] - n) * i / 200) as [number, number, number]));
    const steps = path.slice(1).map((p, i) => p.map((n, axis) => n - path[i][axis]));
    for (let i = 1; i < steps.length; i++) {
      const cosine = steps[i].reduce((sum, n, axis) => sum + n * steps[i - 1][axis], 0) / (Math.hypot(...steps[i]) * Math.hypot(...steps[i - 1]));
      assert.ok(cosine > .999, `local color path abruptly turned: ${cosine}`);
    }
  }
});

test('targets are reproducible for restart and invalid paint amounts are rejected', () => {
  assert.deepEqual(generateHole(1, 12345), generateHole(1, 12345));
  assert.throws(() => addPaint([1, 0, 0], -1, 1));
  assert.throws(() => addPaint([1, 0, 0], 2, -1));
  assert.throws(() => mixtureColor(PLAY_LEVELS[0].paints, [Infinity, 0, 0]));
});

test('the empty neutral start launches straight to pure paint without adding gray', () => {
  for (const level of PLAY_LEVELS) {
    const start = neutralStart(level);
    assert.equal(start.position[0], 0); assert.equal(start.position[2], 0);
    assert.equal(start.rgb[0], start.rgb[1]); assert.equal(start.rgb[1], start.rgb[2]);
    for (let i = 0; i < level.paints.length; i++) {
      const quantities = addPaint(level.paints.map(() => 0), i, 1);
      const pure = mixtureColor(level.paints, quantities);
      const path = baseLaunchPath(start, pure);
      assert.deepEqual(path[0].position, start.position);
      for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(path.at(-1)!.position[axis] - pure.position[axis]) < 1e-10);
      assert.equal(totalMass(quantities), 1);
      for (const [j, point] of path.entries()) {
        assert.equal(colorDistance(point, pure), 0);
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(point.position[axis] - (start.position[axis] + (pure.position[axis] - start.position[axis]) * j / (path.length - 1))) < 1e-10);
      }
    }
  }
});

test('every palette round has its own verified requirements, separation and tougher finish', () => {
  courseBank.palettes.forEach((palette,index)=>palette.rounds.forEach(round=>{
    const level=PLAY_LEVELS[index];
    assert.equal(round.length,HOLES_PER_PALETTE);
    for(const [tag,n] of Object.entries(PROFILES[index].required??{}))assert.ok(round.filter(h=>h.tags.includes(tag)).length>=n,`${level.name}: ${tag}`);
    assert.ok(round.every(h=>h.par<=round.at(-1)!.par));
    if(index===4) {
      assert.equal(round.filter(h=>h.tags.includes('chromatic-ride')).length,2);
      assert.ok(round.slice(0,4).some(h=>h.tags.includes('muted')),'CMY must reach a quiet target before the last hole');
    }
    if(index===5)assert.ok(round.filter(h=>h.solutionShots>=2).length>=3);
    round.forEach((h,i)=>round.slice(i+1).forEach(other=>{
      assert.ok(colorDistance(mixtureColor(level.paints,h.target),mixtureColor(level.paints,other.target))>level.tolerance*1.8);
    }));
  }));
});

test('round lookup is reproducible and does not change tolerance or route metadata', () => {
  for (let palette = 0; palette < PLAY_LEVELS.length; palette++) for (const seed of [190926, 17, 391]) {
    const level = PLAY_LEVELS[palette];
    const round = Array.from({ length: HOLES_PER_PALETTE }, (_, stage) => generateHole(palette, seed, stage));
    for (const hole of round) {
      assert.equal(hole.tolerance, level.tolerance);
      assert.ok(hole.timingWindow > 0 && Number.isFinite(hole.timingWindow));
      assert.equal(hole.solutionShots,hole.routeTimes.length);
      assert.ok(colorDistance(mixtureColor(level.paints,replayRoute(palette,hole.routeOrder,hole.routeTimes)),hole.target)<hole.tolerance);
      assert.deepEqual(hole,generateHole(palette,seed,hole.stage));
    }
    assert.ok(round.every(h=>round.at(-1)!.par>=h.par));
    round.forEach((hole,i)=>assert.equal(hole.stage,i));
    const closest = Math.min(...round.flatMap((h,i)=>round.slice(i+1).map(other=>colorDistance(h.target,other.target))));
    assert.ok(closest > level.tolerance*1.4, `${level.name} repeated visually overlapping targets: ${closest}`);
  }
  const recipe=[1,.5,3];assert.ok(recipeTimingWindow(PLAY_LEVELS[0],recipe,.02)<recipeTimingWindow(PLAY_LEVELS[0],recipe,.04));
});

test('arrival follows one uninterrupted curve into its settled pose', async () => {
  const {planArrival} = await import('../app/play-motion');
  const {Vector3} = await import('three');
  for (const target of [new Vector3(20,8,-15),new Vector3(-20,-15,6),new Vector3(0,15,.1)]) {
    const rest=new Vector3(3,2,7), look=new Vector3(1,0,0);
    const pose=planArrival(target,rest,look);
    assert.ok(pose(.3).position.distanceTo(target)>pose(0).position.distanceTo(target));
    assert.ok(pose(1).position.distanceTo(rest)<1e-9);
    for (const t of [.36,.7]) {
      assert.ok(pose(t-1e-6).position.distanceTo(pose(t+1e-6).position)<.001);
      assert.ok(pose(t-1e-6).quaternion.angleTo(pose(t+1e-6).quaternion)<.001);
      assert.ok(pose(t-.001).position.distanceTo(pose(t+.001).position)>.001);
    }
    const forward = new Vector3(0,0,-1).applyQuaternion(pose(1).quaternion);
    assert.ok(forward.distanceTo(look.clone().sub(rest).normalize())<1e-9);
    const start=pose(0).position, axis=rest.clone().sub(start), length=axis.length(); axis.normalize();
    let previous=0, maxBow=0;
    for(let i=0;i<=100;i++) {
      const delta=pose(i/100).position.clone().sub(start), along=delta.dot(axis);
      assert.ok(along>=previous-1e-6 && along<=length+1e-6,'intro must not reverse/overshoot along sightline');
      maxBow=Math.max(maxBow,delta.clone().addScaledVector(axis,-along).length()); previous=along;
    }
    assert.ok(maxBow>2,'intro should expose the landscape laterally');
  }
});

test('capture and solid-target deflection preserve mixture data and miss endpoints', async () => {
  const {targetFlightPath,captureProgress}=await import('../app/play-motion');
  const {Vector3}=await import('three');
  const rgb:[number,number,number]=[120,80,70];
  const goal={rgb,lab:[.5,0,0] as [number,number,number],position:[0,0,0] as [number,number,number]};
  const path=Array.from({length:401},(_,i)=>({...goal,position:[-5+i/40,0,0] as [number,number,number]}));
  const before=JSON.stringify(path);
  const miss=targetFlightPath(path,goal,false);
  assert.deepEqual(miss[0].position,path[0].position);assert.deepEqual(miss.at(-1)!.position,path.at(-1)!.position);
  miss.forEach((p,i)=>{assert.deepEqual(p.rgb,path[i].rgb);assert.deepEqual(p.lab,path[i].lab);assert.ok(new Vector3(...p.position).length()>=1.1499);});
  const win=targetFlightPath(path,goal,true);
  assert.deepEqual(win[0].position,path[0].position);assert.deepEqual(win.at(-1)!.position,goal.position);
  assert.equal(JSON.stringify(path),before,'presentation cannot mutate the scored path');
  let previous=0;for(let i=0;i<=100;i++){const p=captureProgress(i/100);assert.ok(p>=previous && p<=1);previous=p;}
  assert.ok((captureProgress(1)-captureProgress(.99))>(captureProgress(.65)-captureProgress(.64)),'arrival accelerates rather than stalls');
});

test('arrival varies its landscape reveal without axial overshoot or endpoint jumps', async()=>{
  const {planArrival}=await import('../app/play-motion');const {Vector3}=await import('three');
  const target=new Vector3(20,9,-15),rest=new Vector3(3,2,7),look=new Vector3(1,0,0);
  const poses=[1,2,3,4,5,6,7,8].map(seed=>planArrival(target,rest,look,seed));
  const bows=poses.map(p=>p(.5).position.clone().sub(poses[0](0).position.clone().lerp(rest,.5)));
  assert.ok(bows.some((a,i)=>bows.slice(i+1).some(b=>a.clone().normalize().dot(b.clone().normalize())<-.7)),'both sides of the gamut must be revealed');
  for(const pose of poses) {
    assert.ok(pose(1).position.distanceTo(rest)<1e-10);
    assert.ok(pose(1).quaternion.angleTo(poses[0](1).quaternion)<1e-7);
    assert.ok(pose(.9999).position.distanceTo(pose(1).position)<1e-6);
    const start=pose(0).position,axis=rest.clone().sub(start),length=axis.length();axis.normalize();let previous=0;
    for(let i=0;i<=100;i++) {
      const along=pose(i/100).position.clone().sub(start).dot(axis);
      assert.ok(along>=previous-1e-7&&along<=length+1e-7);previous=along;
      if(i)assert.ok(pose(i/100).quaternion.angleTo(pose((i-1)/100).quaternion)<.07,'no abrupt look-around');
    }
  }
});

test('near misses move the destination more than the glider, without changing color or endpoints',async()=>{
  const {targetFlightPath,splitTargetResponse}=await import('../app/play-motion');const {Vector3}=await import('three');
  const goal={rgb:[120,80,70] as [number,number,number],lab:[.5,0,0] as [number,number,number],position:[0,0,0] as [number,number,number]};
  const original=Array.from({length:401},(_,i)=>({...goal,position:[-5+i/40,0,0] as [number,number,number]}));
  const diverted=targetFlightPath(original,goal,false),response=splitTargetResponse(original,diverted,false);
  response.path.forEach((p,i)=>{
    const relative=new Vector3(...p.position).sub(response.recoil[i]);
    assert.ok(relative.distanceTo(new Vector3(...diverted[i].position))<1e-10);
    const gliderMove=new Vector3(...p.position).distanceTo(new Vector3(...original[i].position));
    assert.ok(response.recoil[i].length()>=gliderMove*5-1e-9);
    assert.deepEqual(p.lab,original[i].lab);assert.deepEqual(p.rgb,original[i].rgb);
  });
  assert.deepEqual(response.path.at(-1)!.position,original.at(-1)!.position);
  assert.equal(response.recoil.at(-1)!.length(),0);
  assert.ok(response.recoil[200].length()>.8);
  const win=splitTargetResponse(original,targetFlightPath(original,goal,true),true);
  assert.ok(win.recoil.every(p=>p.length()===0));assert.deepEqual(win.path.at(-1)!.position,goal.position);
  const close=splitTargetResponse(original,diverted,false,1.4);
  assert.ok(close.recoil.every(p=>p.length()===0),'close misses must not shove the target');
});

test('vertical camera travel keeps its azimuth and tint strength drives charge energy',async()=>{
  const {stableCameraYaw,chargeEnergy}=await import('../app/play-motion');const {Vector3}=await import('three');
  for(const sign of [-1,1])for(let i=0;i<100;i++) {
    const direction=new Vector3(Math.cos(i)*.02,sign,Math.sin(i)*.02).normalize();
    assert.equal(stableCameraYaw(1.3,direction),1.3);
  }
  assert.ok(chargeEnergy(1.4,.8,.5)>chargeEnergy(.5,.8,.5));
  assert.ok(chargeEnergy(1,.8,2)>chargeEnergy(1,.2,.01));
});

test('charging fins stay just above idle with a bounded gentler maximum',async()=>{
  const {ribbonChargeSpeed}=await import('../app/play-motion');
  assert.equal(ribbonChargeSpeed(0,false),2);
  assert.equal(ribbonChargeSpeed(0,true),2.2);
  assert.equal(ribbonChargeSpeed(2.2,true),7);
  assert.equal(ribbonChargeSpeed(20,true),7);
  assert.ok(ribbonChargeSpeed(.5,true)<ribbonChargeSpeed(1,true));
});

test('wake decays to rest after ten seconds and fin attachments taper', async () => {
  const {wakeEnvelope,finWidth}=await import('../app/play-motion');
  assert.equal(wakeEnvelope(-1),0); assert.equal(wakeEnvelope(0),0);assert.equal(wakeEnvelope(10),0);assert.equal(wakeEnvelope(20),0);
  assert.ok(wakeEnvelope(1)>.8);assert.ok(wakeEnvelope(9)<.02);
  assert.ok(finWidth(0)>finWidth(1)*30);
  for(let i=1;i<=100;i++) assert.ok(finWidth(i/100)<=finWidth((i-1)/100));
});

test('camera chooses the closest equivalent heading after repeated manual orbits', async () => {
  const {wrapAngle,closestHeading} = await import('../app/play-motion');
  for (const turns of [-8,-4,0,4,8]) for (const heading of [-3,.2,3]) {
    const current = wrapAngle(turns*Math.PI*2+heading);
    assert.ok(Math.abs(wrapAngle(current-heading))<1e-12);
    for (const target of [-3.1,0,3.1]) {
      const goal = closestHeading(current,target);
      assert.ok(Math.abs(goal-current)<=Math.PI);
      assert.ok(Math.abs(wrapAngle(goal-target))<1e-12);
    }
  }
});

test('ribbons twist continuously around the accurate path without moving its center', async () => {
  const { ribbonEdges, flightProgress } = await import('../app/play-motion');
  const path = pourPath(PLAY_LEVELS[2].paints, [1, 2, .4, 0], 3, 4);
  const edges = ribbonEdges(path, 7.4);
  edges.forEach(([left, right], i) => {
    const center = left.clone().add(right).multiplyScalar(.5);
    path[i].position.forEach((v, axis) => assert.ok(Math.abs(v - center.getComponent(axis)) < 1e-10));
    assert.ok(left.distanceTo(right) >= .18);
    if (i) {
      const direction = right.clone().sub(left).normalize();
      const previous = edges[i - 1][1].clone().sub(edges[i - 1][0]).normalize();
      assert.ok(direction.dot(previous) > 0, 'ribbon unexpectedly flipped');
    }
  });
  assert.equal(flightProgress(0), 0);
  assert.equal(flightProgress(1), 1);
  assert.ok(flightProgress(.05) > .09, 'release should launch immediately');
});
