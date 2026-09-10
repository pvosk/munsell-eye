import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAY_LEVELS, HOLES_PER_PALETTE, CHARGE_SECONDS, SPACE_NODES, baseLaunchPath, neutralStart, recipeTimingWindow, labPosition, landingBoundary, munsellPosition, addPaint, chargeAmount, chargePower, chargeRatio, colorDistance, generateHole, mixtureColor, pourPath, totalMass } from '../app/play-engine';

test('landing tolerances are ten percent tighter across every palette', () => {
  const previous = [.038,.032,.028,.032,.03,.032,.032,.032,.032];
  PLAY_LEVELS.forEach((level,i) => assert.ok(Math.abs(level.tolerance-previous[i]*.9)<1e-12));
});

test('the nine palettes have the requested pigments and names', () => {
  assert.deepEqual(PLAY_LEVELS.map(level => level.name), ['UltraOx Dual', 'Zorny', 'RYB', 'EarthPop', 'CMY', 'Secondaries', 'French Light', 'Chromatic Dark', 'Violet Shift']);
  assert.deepEqual(PLAY_LEVELS.map((level) => level.paints.map((p) => p.pigment)), [
    ['PR101', 'PB29', 'PW6'], ['PY43', 'PR108', 'PBk9', 'PW6'], ['PW1', 'PY35', 'PR108', 'PB15:3'], ['PY35', 'PR122', 'PB15:3', 'PR101'],
    ['PB15:3', 'PR122', 'PY3'], ['PO20', 'PV23', 'PG36', 'PW6'], ['PW1', 'PY35', 'PY43', 'PR108', 'PR83', 'PB28', 'PB29', 'PG18'],
    ['PV19', 'PG36', 'PB29', 'PW1'], ['PB28', 'PR108', 'PY3/PG36', 'PV23'],
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

test('every generated target has a constructive route at guide par within the hold limits', () => {
  const began = performance.now(); const pars: number[][] = PLAY_LEVELS.map(() => []);
  for (let index = 0; index < PLAY_LEVELS.length; index++) for (let seed = 1; seed <= 16; seed++) {
    const level = PLAY_LEVELS[index]; const hole = generateHole(index, seed * 7919);
    const recipe = hole.recipe;
    const order = recipe.map((amount, i) => ({ i, amount })).filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
    assert.equal(order.length - 1, hole.par);
    assert.ok(hole.par >= 1 && hole.par < level.paints.length);
    let state = level.paints.map(() => 0);
    const base = order[0].amount;
    for (const { i, amount } of order) {
      const dose = amount / base;
      if (totalMass(state)) { assert.ok(dose <= chargeAmount(totalMass(state), CHARGE_SECONDS)); assert.ok(dose >= chargeAmount(totalMass(state), 0)); }
      state = addPaint(state, i, dose);
    }
    const result = mixtureColor(level.paints, state);
    assert.ok(colorDistance(result, hole.target) <= hole.tolerance, `Level ${index}, seed ${seed} is unreachable`);
    assert.ok(level.paints.every((_, i) => colorDistance(mixtureColor(level.paints, level.paints.map((_, j) => i === j ? 1 : 0)), hole.target) > hole.tolerance));
    pars[index].push(hole.par);
  }
  console.log(`${PLAY_LEVELS.length * 16} target routes checked in ${Math.round(performance.now() - began)}ms. Guide pars: ${pars.map((values) => [...new Set(values)].join('/')).join(', ')}.`);
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

test('all five holes retain a constant landing tolerance and reachable recipes', () => {
  for (let palette = 0; palette < PLAY_LEVELS.length; palette++) for (const seed of [190926, 17, 391]) {
    const level = PLAY_LEVELS[palette];
    const round = Array.from({ length: HOLES_PER_PALETTE }, (_, stage) => generateHole(palette, seed, stage));
    for (const hole of round) {
      assert.equal(hole.tolerance, level.tolerance);
      assert.ok(hole.timingWindow > 0 && Number.isFinite(hole.timingWindow));
      assert.equal(hole.par, hole.recipe.filter(q => q > 0).length - 1);
      const base = Math.max(...hole.recipe);
      const recipe = hole.recipe.map(q => q / base);
      assert.ok(colorDistance(mixtureColor(level.paints, recipe), hole.target) <= hole.tolerance);
      let mass = 0;
      for (const amount of recipe.filter(q => q > 0).sort((a,b) => b-a)) {
        if (mass) assert.ok(amount >= chargeAmount(mass, 0) && amount <= chargeAmount(mass, CHARGE_SECONDS));
        mass += amount;
      }
    }
    assert.ok(round.at(-1)!.par >= round[0].par);
    round.slice(1).forEach((hole,i) => {
      assert.ok(hole.par >= round[i].par);
      if (hole.par === round[i].par) assert.ok(hole.timingWindow <= round[i].timingWindow);
      assert.equal(hole.stage,i+1);
    });
    assert.equal(round[0].par,1);
    const closest = Math.min(...round.flatMap((h,i)=>round.slice(i+1).map(other=>colorDistance(h.target,other.target))));
    assert.ok(closest > level.tolerance, `${level.name} repeated visually overlapping targets: ${closest}`);
    assert.ok(new Set(round.map(h=>h.recipe.map(q=>q>0?1:0).join(''))).size >= 2);
    console.log(`${level.name} seed ${seed}: pars ${round.map(h => h.par).join('/')}; estimated timing windows ${round.map(h => Math.round(h.timingWindow * 1000)).join('/')}ms`);
    const recipe = round.at(-1)!.recipe;
    assert.ok(recipeTimingWindow(level, recipe, .02) < recipeTimingWindow(level, recipe, .04));
  }
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
  }
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
