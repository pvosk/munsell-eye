import assert from "node:assert/strict";
import { paintTrace, loadGame } from "../app/sound-lab/paint-trace.ts";
const game = await loadGame();
const spec = {
  level: 0,
  before: [1, 0.3, 0.1],
  index: 2,
  hold: 0.55,
  target: null,
};
const a = await paintTrace(spec),
  expected = game.addPaint(
    spec.before,
    spec.index,
    game.chargeAmount(game.totalMass(spec.before), spec.hold),
  );
assert.deepEqual(a.after, expected);
assert.deepEqual(
  a.endpoint,
  game.mixtureColor(game.PLAY_LEVELS[0].paints, expected).lab,
);
const b = await paintTrace({ ...spec, target: a.endpoint });
assert(b.captured);
assert.equal(b.distance, 0);
const free = await paintTrace({ ...spec, before: [0, 0, 0], hold: 3 });
assert.equal(free.amount, 1);
assert.equal(game.totalMass(free.after), 1);
assert(free.freeBase);
assert(free.samples.length > 1);
assert(
  a.samples.every((s) =>
    [s.l, s.c, s.h, s.edge, ...s.rgb].every(Number.isFinite),
  ),
);
assert(a.duration >= 0.7 && a.duration <= 3.2);
console.log(
  "Passed existing-engine mixture/strength/dose reuse, target capture, free base, finite traces and duration limits.",
);
