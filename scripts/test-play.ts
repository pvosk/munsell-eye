import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAY_LEVELS, HOLES_PER_PALETTE, CHARGE_SECONDS, SPACE_NODES, baseLaunchPath, neutralStart, recipeTimingWindow, labPosition, landingBoundary, munsellPosition, addPaint, chargeAmount, chargePower, chargeRatio, colorDistance, generateHole, mixtureColor, pourPath, totalMass } from '../app/play-engine';

test('the four requested palettes have the correct pigments, including actual PW1', () => {
  assert.deepEqual(PLAY_LEVELS.map((level) => level.paints.map((p) => p.pigment)), [
    ['PR101', 'PB29', 'PW6'], ['PY43', 'PR108', 'PBk9', 'PW6'], ['PW1', 'PY35', 'PR108', 'PB15:3'], ['PY35', 'PR122', 'PB15:3', 'PR101'],
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
    assert.equal(order.length, hole.par);
    assert.ok(hole.par >= 2 && hole.par <= level.paints.length);
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
  console.log(`64 target routes checked in ${Math.round(performance.now() - began)}ms. Guide pars: ${pars.map((values) => [...new Set(values)].join('/')).join(', ')}.`);
});

test('Munsell nodes preserve absolute chroma and value; scoring survives the display warp', () => {
  const a = mixtureColor(PLAY_LEVELS[0].paints, [3, 1, 4]);
  for (const { chip, point } of SPACE_NODES) {
    assert.deepEqual(point.position, munsellPosition(chip));
    assert.ok(Math.abs(Math.hypot(point.position[0], point.position[2]) - chip.c * 2.6) < 1e-9);
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

test('all five holes in each palette remain reachable while precision tightens', () => {
  for (let palette = 0; palette < PLAY_LEVELS.length; palette++) for (const seed of [190926, 17, 391]) {
    const level = PLAY_LEVELS[palette];
    let previousTolerance = Infinity;
    const round = Array.from({ length: HOLES_PER_PALETTE }, (_, stage) => generateHole(palette, seed, stage));
    for (const hole of round) {
      assert.ok(hole.tolerance < previousTolerance); previousTolerance = hole.tolerance;
      assert.ok(hole.timingWindow > 0 && Number.isFinite(hole.timingWindow));
      assert.equal(hole.par, hole.recipe.filter(q => q > 0).length);
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
    console.log(`${level.name} seed ${seed}: pars ${round.map(h => h.par).join('/')}; estimated timing windows ${round.map(h => Math.round(h.timingWindow * 1000)).join('/')}ms`);
    const recipe = round.at(-1)!.recipe;
    assert.ok(recipeTimingWindow(level, recipe, .02) < recipeTimingWindow(level, recipe, .04));
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
