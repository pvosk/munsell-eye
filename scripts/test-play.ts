import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAY_LEVELS, CHARGE_SECONDS, WORLD_SCALE, addPaint, chargeRatio, colorDistance, generateHole, mixtureColor, pourPath, totalMass } from '../app/play-engine';

test('the three requested palettes have the correct pigments, including actual PW1', () => {
  assert.deepEqual(PLAY_LEVELS.map((level) => level.paints.map((p) => p.pigment)), [
    ['PR101', 'PB29', 'PW6'], ['PY43', 'PR108', 'PBk9', 'PW6'], ['PW1', 'PY35', 'PR108', 'PB15:3'],
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

test('charging is monotonic, starts with a tiny dab, and reaches eight times current mass', () => {
  assert.equal(chargeRatio(0), .005);
  assert.equal(chargeRatio(CHARGE_SECONDS), 8);
  assert.equal(chargeRatio(CHARGE_SECONDS * 2), 8);
  let last = 0;
  for (let i = 0; i <= 360; i++) { const value = chargeRatio(i / 100); assert.ok(value >= last); last = value; }
  assert.ok(chargeRatio(.3) < .02);
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
  const began = performance.now(); const pars: number[][] = [[], [], []];
  for (let index = 0; index < 3; index++) for (let seed = 1; seed <= 16; seed++) {
    const level = PLAY_LEVELS[index]; const hole = generateHole(index, seed * 7919);
    const recipe = hole.recipe;
    const order = recipe.map((amount, i) => ({ i, amount })).filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
    assert.equal(order.length, hole.par);
    assert.ok(hole.par >= 2 && hole.par <= level.paints.length);
    let state = level.paints.map(() => 0);
    const base = order[0].amount;
    for (const { i, amount } of order) {
      const dose = amount / base;
      if (totalMass(state)) { assert.ok(dose / totalMass(state) <= 8); assert.ok(dose / totalMass(state) >= .005); }
      state = addPaint(state, i, dose);
    }
    const result = mixtureColor(level.paints, state);
    assert.ok(colorDistance(result, hole.target) <= hole.tolerance, `Level ${index}, seed ${seed} is unreachable`);
    assert.ok(level.paints.every((_, i) => colorDistance(mixtureColor(level.paints, level.paints.map((_, j) => i === j ? 1 : 0)), hole.target) > hole.tolerance));
    pars[index].push(hole.par);
  }
  console.log(`48 target routes checked in ${Math.round(performance.now() - began)}ms. Guide pars: ${pars.map((values) => [...new Set(values)].join('/')).join(', ')}.`);
});

test('spherical landing boundaries match the exact scored color distance', () => {
  const a = mixtureColor(PLAY_LEVELS[0].paints, [3, 1, 4]);
  const b = mixtureColor(PLAY_LEVELS[0].paints, [3, 2, 4]);
  const worldDistance = Math.hypot(...a.position.map((value, i) => value - b.position[i]));
  assert.ok(Math.abs(worldDistance / WORLD_SCALE - colorDistance(a, b)) < 1e-12);
});

test('targets are reproducible for restart and invalid paint amounts are rejected', () => {
  assert.deepEqual(generateHole(1, 12345), generateHole(1, 12345));
  assert.throws(() => addPaint([1, 0, 0], -1, 1));
  assert.throws(() => addPaint([1, 0, 0], 2, -1));
  assert.throws(() => mixtureColor(PLAY_LEVELS[0].paints, [Infinity, 0, 0]));
});
