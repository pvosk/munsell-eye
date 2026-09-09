import { Color, mix } from 'spectral.js';
import { PAINTS, type PaintColor } from './paint-mixing';
import { NEUTRALS, type MunsellColor } from './munsell-data';
import { PRACTICAL_MUNSELL_COLORS } from './munsell-gamut';

export type RGB = [number, number, number];
export type XYZ = [number, number, number];
export type Mixture = number[];
export type ColorPoint = { rgb: RGB; lab: XYZ; position: XYZ };
export type PlayLevel = { name: string; subtitle: string; paints: PaintColor[]; tolerance: number };
export type Hole = { seed: number; target: ColorPoint; notation: string; par: number; recipe: Mixture; tolerance: number };
export const WORLD_SCALE = 22;
export const CHARGE_SECONDS = 3.6;

const paint = (id: string) => {
  const found = PAINTS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing game paint: ${id}`);
  return found;
};
// Preserve the existing catalogue. These game entries are approximations, not
// measured brand-specific reflectance data; PW1 is not PW6/PW4 replacement white.
const flake: PaintColor = { ...paint('titanium-white'), id: 'play-flake-white', name: 'Flake White', pigment: 'PW1', rgb: [246, 243, 233], strength: .65, v: 9.5, notation: 'N9.5' };
const oxide: PaintColor = { ...paint('transparent-earth-red'), name: 'Transparent Oxide Red' };
export const PLAY_LEVELS: PlayLevel[] = [
  { name: 'Earth & Air', subtitle: 'The Classic Triad', paints: [oxide, paint('ultramarine-blue'), paint('titanium-white')], tolerance: .038 },
  { name: 'Zorn', subtitle: 'Four Quiet Colors', paints: [paint('yellow-ochre'), paint('cadmium-red-light'), paint('ivory-black'), paint('titanium-white')], tolerance: .032 },
  { name: 'Full Bloom', subtitle: 'The Chromatic Palette', paints: [flake, paint('cadmium-lemon'), paint('cadmium-red-medium'), paint('phthalo-blue-green')], tolerance: .028 },
];

export function rgbToLab(rgb: readonly number[]): XYZ {
  const [r, g, b] = rgb.map((n) => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}

export function colorPoint(rgb: RGB): ColorPoint {
  const lab = rgbToLab(rgb);
  // Uniform scale makes the visible spherical landing zone match scoring exactly.
  return { rgb, lab, position: [lab[1] * WORLD_SCALE, (lab[0] - .6) * WORLD_SCALE, lab[2] * WORLD_SCALE] };
}
export const SEED_POINT = colorPoint([145, 145, 139]);
export const colorDistance = (a: ColorPoint, b: ColorPoint) => Math.hypot(...a.lab.map((v, i) => v - b.lab[i]));
export const totalMass = (mixture: Mixture) => mixture.reduce((sum, value) => sum + value, 0);
export const rgbStyle = (rgb: RGB) => `rgb(${rgb.map(Math.round).join(' ')})`;

const spectralCache = new Map<string, Color>();
function pigmentColor(p: PaintColor) {
  const key = `${p.id}:${p.rgb}:${p.strength}`;
  let c = spectralCache.get(key);
  if (!c) { c = new Color(p.rgb); c.tintingStrength = p.strength; spectralCache.set(key, c); }
  return c;
}
export function mixtureColor(paints: PaintColor[], quantities: Mixture): ColorPoint {
  const mass = totalMass(quantities);
  if (!Number.isFinite(mass) || quantities.some((q) => !Number.isFinite(q) || q < 0)) throw new Error('Invalid paint quantities');
  if (!mass) return SEED_POINT;
  // Always remix the ORIGINAL pigments. Recycling the previous RGB would lose
  // composition and introduce order-dependent drift after successive pours.
  const active = paints.map((p, i) => [pigmentColor(p), (quantities[i] ?? 0) / mass] as [Color, number]).filter(([, q]) => q > 0);
  const result = active.length === 1 ? active[0][0] : mix(...active);
  return colorPoint(result.sRGB.map((v) => Math.max(0, Math.min(255, v))) as RGB);
}

export function chargeRatio(seconds: number) {
  const t = Math.max(0, Math.min(1, seconds / CHARGE_SECONDS));
  // A generous fine-control interval, then an explicitly visible power pour.
  return Math.min(8, .005 + .995 * Math.min(1, t / .7) ** 2.4 + 7 * Math.max(0, (t - .7) / .3) ** 2);
}
export function addPaint(mixture: Mixture, index: number, amount: number): Mixture {
  if (!Number.isInteger(index) || index < 0 || index >= mixture.length || !Number.isFinite(amount) || amount < 0) throw new Error('Invalid pour');
  return mixture.map((q, i) => q + (i === index ? amount : 0));
}
export function pourPath(paints: PaintColor[], before: Mixture, index: number, amount: number, samples = 96): ColorPoint[] {
  if (!totalMass(before)) return [mixtureColor(paints, addPaint(before, index, 1))];
  // Sample more densely near the beginning of large corrective pours.
  return Array.from({ length: samples + 1 }, (_, n) => mixtureColor(paints, addPaint(before, index, amount * (n / samples) ** 2)));
}

const chips = [...PRACTICAL_MUNSELL_COLORS, ...NEUTRALS].map((chip) => ({ chip, point: colorPoint(chip.rgb) }));
export const SPACE_NODES = chips.filter(({ chip }) => chip.h === 'N' || (chip.h.startsWith('5') && chip.c % 4 === 0));
export function nearestNotation(point: ColorPoint) {
  const nearest = chips.reduce((best, item) => colorDistance(item.point, point) < colorDistance(best.point, point) ? item : best);
  return chipNotation(nearest.chip);
}
function chipNotation(chip: MunsellColor) { return chip.h === 'N' ? `N${chip.v}` : `${chip.h} ${chip.v}/${chip.c}`; }

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

// A sampled search gives a constructive guide par, not a claim of a global
// optimum. The retained witness recipe can actually land within the target.
export function simplestRecipe(level: PlayLevel, target: ColorPoint, witness: Mixture): Mixture {
  const count = level.paints.length;
  const best = witness;
  const support = (q: Mixture) => q.filter((v) => v > 0).length;
  for (let size = 1; size < support(best); size++) {
    let found: Mixture | undefined;
    let closest = level.tolerance * .8;
    const search = (start: number, ids: number[]) => {
      if (ids.length !== size) { for (let i = start; i < count; i++) search(i + 1, [...ids, i]); return; }
      const distribute = (remaining: number, weights: number[]) => {
        if (weights.length === size - 1) {
          const q = Array(count).fill(0) as number[];
          [...weights, remaining].forEach((v, i) => { q[ids[i]] = v; });
          const distance = colorDistance(mixtureColor(level.paints, q), target);
          if (distance < closest) { closest = distance; found = q; }
          return;
        }
        for (let n = 1; n <= remaining - (size - weights.length - 1); n++) distribute(remaining - n, [...weights, n]);
      };
      distribute(16, []);
    };
    search(0, []);
    if (found) return found;
  }
  return best;
}

export function generateHole(levelIndex: number, seed: number): Hole {
  const level = PLAY_LEVELS[levelIndex];
  const rng = seededRandom(seed);
  let recipe: Mixture = [];
  let target = SEED_POINT;
  for (let attempt = 0; attempt < 24; attempt++) {
    const count = levelIndex === 0 ? (rng() < .55 ? 2 : 3) : (rng() < .3 ? 2 : rng() < .75 ? 3 : 4);
    const ids = level.paints.map((_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    recipe = level.paints.map(() => 0);
    ids.slice(0, count).forEach((i) => { recipe[i] = 2 + Math.floor(rng() * 9); });
    // The introductory dark triad needs some white for a readable first hole.
    if (levelIndex === 0) recipe[2] = 3 + Math.floor(rng() * 8);
    target = mixtureColor(level.paints, recipe);
    if (level.paints.every((p) => colorDistance(colorPoint(p.rgb), target) > level.tolerance * 1.7)) break;
  }
  const simple = simplestRecipe(level, target, recipe);
  return { seed, target, notation: nearestNotation(target), par: simple.filter((q) => q > 0).length, recipe: simple, tolerance: level.tolerance };
}
