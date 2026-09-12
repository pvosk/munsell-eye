import {
  clamp,
  gamutChroma,
  type ColorSample,
  type PaintTrace,
} from "./journey";
export const loadGame = () => import("../play-engine");
export async function paintTrace(p: PaintTrace) {
  const game = await loadGame(),
    level = game.PLAY_LEVELS[p.level] ?? game.PLAY_LEVELS[0],
    before = level.paints.map((_, i) => p.before[i] ?? 0),
    index = Math.min(p.index, level.paints.length - 1),
    mass = game.totalMass(before),
    amount = game.chargeAmount(mass, p.hold),
    after = game.addPaint(before, index, amount),
    path = mass
      ? game.pourPath(level.paints, before, index, amount)
      : game.baseLaunchPath(
          game.SEED_POINT,
          game.mixtureColor(level.paints, after),
        );
  let hue = 0;
  const samples: ColorSample[] = path.map((point) => {
    const [l, a, b] = point.lab,
      c = Math.hypot(a, b);
    if (c > 0.003) {
      const raw = (Math.atan2(b, a) * 180) / Math.PI;
      hue += ((raw - hue + 540) % 360) - 180;
    }
    return {
      l,
      c,
      h: hue,
      edge: clamp(c / Math.max(0.001, gamutChroma(l, hue))),
      rgb: point.rgb,
    };
  });
  const endpoint = path.at(-1)!,
    distance = p.target
      ? Math.hypot(...endpoint.lab.map((x, i) => x - p.target![i]))
      : null;
  // Existing duration expression, using the existing displayed path positions.
  const length = path
    .slice(1)
    .reduce(
      (sum, x, i) =>
        sum + Math.hypot(...x.position.map((v, j) => v - path[i].position[j])),
      0,
    );
  const duration = clamp(
    0.5 + 0.35 * Math.sqrt(length) + 0.018 * Math.log1p(game.totalMass(after)),
    0.7,
    3.2,
  );
  return {
    samples,
    after,
    amount,
    endpoint: endpoint.lab,
    duration,
    distance,
    captured: distance !== null && distance <= game.LIVE_LANDING_TOLERANCE,
    freeBase: mass === 0,
  };
}
