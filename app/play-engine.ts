import { Color, mix } from 'spectral.js';
import { PAINTS, type PaintColor } from './paint-mixing';
import { HUE_ORDER, NEUTRALS, type MunsellColor } from './munsell-data';
import { PRACTICAL_MUNSELL_COLORS } from './munsell-gamut';
import courseBank from './generated/play-courses.json';
import legacyCourseBank from './generated/play-courses-v2.json';
import labRoundBank from './generated/play-lab-round2.json';

export type RGB = [number, number, number];
export type XYZ = [number, number, number];
export type Mixture = number[];
export type ColorPoint = { rgb: RGB; lab: XYZ; position: XYZ };
export type PlayLevel = { name: string; subtitle: string; paints: PaintColor[]; tolerance: number };
export type Hole = { seed: number; stage: number; start: ColorPoint; target: ColorPoint; notation: string; par: number; recipe: Mixture; tolerance: number; timingWindow: number; courseId: string; kind: string; solutionShots: number; routeOrder: number[]; routeTimes: number[] };
export const HOLES_PER_PALETTE = 5;
export const CHARGE_SECONDS = 2.2;
export const LANDING_TOLERANCE = .028;

const paint = (id: string) => {
  const found = PAINTS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing game paint: ${id}`);
  return found;
};
// Preserve the existing catalogue. These game entries are approximations, not
// measured brand-specific reflectance data; PW1 is not PW6/PW4 replacement white.
const flake: PaintColor = { ...paint('titanium-white'), id: 'play-flake-white', name: 'Flake White', pigment: 'PW1', rgb: [246, 243, 233], strength: .65, v: 9.5, notation: 'N9.5' };
const oxide: PaintColor = { ...paint('transparent-earth-red'), name: 'Transparent Oxide Red' };
// A modeled yellow/green tube premix, not a measured commercial paint.
const chartreuseYellow = new Color(paint('hansa-yellow-light').rgb);
chartreuseYellow.tintingStrength = paint('hansa-yellow-light').strength;
const chartreuseGreen = new Color(paint('phthalo-green-yellow').rgb);
chartreuseGreen.tintingStrength = paint('phthalo-green-yellow').strength;
const chartreuse: PaintColor = { ...paint('hansa-yellow-light'), id: 'play-chartreuse', name: 'Chartreuse', pigment: 'PY3/PG36', rgb: mix([chartreuseYellow,1],[chartreuseGreen,.08]).sRGB as RGB, strength: .96, notation: 'Chartreuse premix' };
export const PLAY_LEVELS: PlayLevel[] = [
{ name: 'UltraOx Dual', subtitle: 'The Classic Triad', paints: [oxide, paint('ultramarine-blue'), paint('titanium-white')], tolerance: .0342 },
  { name: 'Zorny', subtitle: 'Four Quiet Colors', paints: [paint('yellow-ochre'), paint('cadmium-red-light'), paint('ivory-black'), paint('titanium-white')], tolerance: .0288 },
  { name: 'RYB', subtitle: 'The Chromatic Palette', paints: [flake, paint('cadmium-lemon'), paint('cadmium-red-medium'), paint('phthalo-blue-green')], tolerance: .0252 },
  { name: 'EarthPop', subtitle: 'Without White', paints: [paint('cadmium-lemon'), paint('quinacridone-magenta'), paint('phthalo-blue-green'), oxide], tolerance: .0288 },
  { name: 'CMY', subtitle: 'Three Vivid Primaries', paints: [paint('phthalo-blue-green'), paint('quinacridone-magenta'), paint('hansa-yellow-light')], tolerance: .027 },
  { name: 'Secondaries', subtitle: 'Orange, Violet & Green', paints: [paint('cadmium-orange'), paint('dioxazine-purple'), paint('phthalo-green-yellow'), paint('titanium-white')], tolerance: .0288 },
  { name: 'French Light', subtitle: 'An Impressionist Palette', paints: [flake, paint('cadmium-yellow-light'), paint('yellow-ochre'), paint('cadmium-red-light'), paint('alizarin-crimson'), paint('cobalt-blue'), paint('ultramarine-blue'), paint('viridian')], tolerance: .0288 },
  { name: 'Chromatic Dark', subtitle: 'Color Inside the Shadows', paints: [paint('quinacridone-red'),paint('phthalo-emerald'),paint('ultramarine-blue'),flake], tolerance: .0288 },
  { name: 'Violet Shift', subtitle: 'Purple Holds the Depth', paints: [paint('cobalt-blue'),paint('cadmium-red-light'),chartreuse,paint('dioxazine-purple')], tolerance: .0288 },
  { name: 'Double Cross', subtitle: 'Two Opposing Pairs', paints: [paint('cadmium-orange'),paint('cobalt-blue'),paint('cadmium-red-medium'),paint('permanent-green-light')], tolerance: .0288 },
  { name: 'Cobalt Ember', subtitle: 'Blue, Orange & Magenta', paints: [paint('cobalt-blue'),paint('cadmium-orange'),paint('quinacridone-magenta'),flake], tolerance: .028 },
  { name: 'Viridian Rust', subtitle: 'Green, Earth & Bright Color', paints: [paint('viridian'),oxide,paint('quinacridone-magenta'),paint('cadmium-lemon')], tolerance: .028 },
];
// Palette identity belongs in routes, not a different-sized perceptual cup.
PLAY_LEVELS.forEach(level=>{level.tolerance=LANDING_TOLERANCE;});

export function rgbToLab(rgb: readonly number[]): XYZ {
  const [r, g, b] = rgb.map((n) => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}

export function colorPoint(rgb: RGB): ColorPoint {
  const lab = rgbToLab(rgb);
  // Most recipe candidates only need a score. Defer the visual interpolation.
  let position: XYZ | undefined;
  return { rgb, lab, get position() { return position ??= labPosition(lab); } };
}
export function munsellPosition(chip: MunsellColor): XYZ {
  const angle = Math.max(0, HUE_ORDER.indexOf(chip.h as typeof HUE_ORDER[number])) * Math.PI / 20;
  return [Math.cos(angle) * chip.c * 2.6, (chip.v - 5) * 4, Math.sin(angle) * chip.c * 2.6];
}
const spatialReferences = [...PRACTICAL_MUNSELL_COLORS, ...NEUTRALS,
  { h: 'N', v: 0, c: 0, rgb: [0, 0, 0] as RGB }, { h: 'N', v: 10, c: 0, rgb: [255, 255, 255] as RGB },
].map(chip => ({ lab: rgbToLab(chip.rgb), position: munsellPosition(chip) }));
// A single smooth calibration replaces the sample-attracting interpolation.
// The old inverse-distance weights flattened motion near individual chips and
// bent paths between them. A low-order global fit cannot create those wells.
const features = ([l, a, b]: XYZ) => {
  const L = (l - .6) * 2, A = a * 4, B = b * 4;
  return [1, L, L * L, L * L * L, A, B, L * A, L * B, A * A, A * B, B * B];
};
function fitSpatialAxis(axis: number) {
  // Horizontal axes contain a/b in every term: true neutrals stay on the axis.
  const terms = axis === 1 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [4, 5, 6, 7, 8, 9, 10];
  const n = terms.length;
  const matrix = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (const sample of spatialReferences) {
    const f = features(sample.lab);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) matrix[row][col] += f[terms[row]] * f[terms[col]];
      matrix[row][n] += f[terms[row]] * sample.position[axis];
    }
  }
  for (let i = 0; i < n; i++) matrix[i][i] += .001;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const scale = matrix[col][col];
    for (let j = col; j <= n; j++) matrix[col][j] /= scale;
    for (let row = 0; row < n; row++) if (row !== col) {
      const factor = matrix[row][col];
      for (let j = col; j <= n; j++) matrix[row][j] -= factor * matrix[col][j];
    }
  }
  const coefficients = Array(11).fill(0);
  terms.forEach((term, i) => { coefficients[term] = matrix[i][n]; });
  return coefficients;
}
const spatialCalibration = [0, 1, 2].map(fitSpatialAxis);
export function labPosition(lab: XYZ): XYZ {
  const f = features(lab);
  return spatialCalibration.map(axis => axis.reduce((sum, c, i) => sum + c * f[i], 0)) as XYZ;
}
export function landingBoundary(target: ColorPoint, tolerance: number, direction: XYZ): XYZ {
  const length = Math.hypot(...direction) || 1;
  return labPosition(target.lab.map((n, i) => n + direction[i] / length * tolerance) as XYZ);
}
export const SEED_POINT = colorPoint([145, 145, 139]);
export const colorDistance = (a: ColorPoint, b: ColorPoint) => Math.hypot(...a.lab.map((v, i) => v - b.lab[i]));
export const totalMass = (mixture: Mixture) => mixture.reduce((sum, value) => sum + value, 0);
export const rgbStyle = (rgb: RGB) => `rgb(${rgb.map(Math.round).join(' ')})`;

export function neutralStart(level: PlayLevel): ColorPoint {
  const lightness = level.paints.reduce((sum, p) => sum + rgbToLab(p.rgb)[0], 0) / level.paints.length;
  const linear = lightness ** 3;
  const gray = 255 * (linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055);
  const point = colorPoint([gray, gray, gray]);
  // Empty launch point: neutral at the palette's mean lightness, zero paint.
  return { ...point, position: [0, point.position[1], 0] };
}

export function baseLaunchPath(start: ColorPoint, pure: ColorPoint, samples = 96): ColorPoint[] {
  // Travel before mixing starts. Every displayed paint color is already pure;
  // this straight relocation does not inject neutral paint into the recipe.
  return Array.from({ length: samples + 1 }, (_, i) => ({ ...pure,
    position: start.position.map((n, axis) => n + (pure.position[axis] - n) * i / samples) as XYZ,
  }));
}

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
  // spectral.sRGB rounds to integers. Preserve linear RGB precision for smooth
  // physical paths, only rounding the CSS label at the presentation boundary.
  return colorPoint(result.lRGB.map((v) => {
    const linear = Math.max(0, Math.min(1, v));
    return 255 * (linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055);
  }) as RGB);
}

export function chargePower(seconds: number) {
  const cycle = (Math.max(0, seconds) / CHARGE_SECONDS) % 2;
  const leg = cycle <= 1 ? cycle : 2 - cycle;
  return 1 - (1 - leg) ** 3;
}
export function chargeRatio(seconds: number) {
  return .005 + 7.995 * chargePower(seconds) ** 4;
}
export function chargeAmount(mass: number, seconds: number) {
  // Capacity grows with mass, but less quickly than the mixture itself: an
  // equally timed shot has less influence on a large accumulated pile.
  return mass ? Math.max(1, mass) ** .8 * chargeRatio(seconds) : 1;
}
export function addPaint(mixture: Mixture, index: number, amount: number): Mixture {
  if (!Number.isInteger(index) || index < 0 || index >= mixture.length || !Number.isFinite(amount) || amount < 0) throw new Error('Invalid pour');
  return mixture.map((q, i) => q + (i === index ? amount : 0));
}
export function pourPath(paints: PaintColor[], before: Mixture, index: number, amount: number, samples = 192): ColorPoint[] {
  if (!totalMass(before)) return [mixtureColor(paints, addPaint(before, index, 1))];
  // Sample more densely near the beginning of large corrective pours.
  return Array.from({ length: samples + 1 }, (_, n) => mixtureColor(paints, addPaint(before, index, amount * (n / samples) ** 2)));
}

const chips = [...PRACTICAL_MUNSELL_COLORS, ...NEUTRALS].map((chip) => ({ chip, point: colorPoint(chip.rgb) }));
export const SPACE_NODES = chips;
// Fill between adjacent reference samples, throughout the volume rather than
// only on hue rings. These are display colors, not additional paint recipes.
export const FIELD_POINTS = (() => {
  const lookup = new Map(chips.map(item => [`${item.chip.h}:${item.chip.v}:${item.chip.c}`, item.point]));
  const points = chips.map(item => item.point);
  for (const { chip, point } of chips) {
    for (const [v, c] of [[chip.v + 1, chip.c], [chip.v, chip.c + 2], [chip.v + 1, chip.c + 2]]) {
      const other = lookup.get(`${chip.h}:${v}:${c}`);
      if (other) points.push(colorPoint(point.rgb.map((n, i) => (n + other.rgb[i]) / 2) as RGB));
    }
  }
  return points;
})();
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
      // On a large palette, simplify within the witness's pigments to bound
      // startup cost. Guide par is constructive; players may find shortcuts
      // using any of the other paints, which remain fully available in play.
      if (ids.length !== size) { for (let i = start; i < count; i++) if (count <= 4 || witness[i] > 0) search(i + 1, [...ids, i]); return; }
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

export function generateCandidate(levelIndex: number, seed: number, simplify = true) {
  const level = PLAY_LEVELS[levelIndex];
  const rng = seededRandom(seed);
  let recipe: Mixture = [];
  let target = SEED_POINT;
  for (let attempt = 0; attempt < 24; attempt++) {
    const count = levelIndex === 0 ? (rng() < .55 ? 2 : 3) : (rng() < .3 ? 2 : rng() < .75 ? 3 : 4);
    const ids = level.paints.map((_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    recipe = level.paints.map(() => 0);
    // Log-spread doses sample edge runs, tints and muted interiors, rather than
    // concentrating almost every recipe near equal-parts mixtures.
    ids.slice(0, count).forEach((i) => { recipe[i] = Math.exp(Math.log(.3) + rng() * Math.log(40)); });
    target = mixtureColor(level.paints, recipe);
    if (level.paints.every((p) => colorDistance(colorPoint(p.rgb), target) > level.tolerance * 1.7)) break;
  }
  const simple = simplify ? simplestRecipe(level, target, recipe) : recipe;
  return { target, recipe, simple };
}

// Estimate the tightest timing window along the most forgiving valid ordering.
// Perturb one charge by 20ms, finish the remaining recipe, and measure the final
// color error. This is a local sensitivity estimate, not a solved global par.
export function recipeTimingWindow(level: PlayLevel, recipe: Mixture, tolerance: number): number {
  const ids = recipe.map((q, i) => q > 0 ? i : -1).filter(i => i >= 0);
  const target = mixtureColor(level.paints, recipe);
  let best = 0;
  function visit(order: number[]) {
    if (order.length < ids.length) {
      for (const id of ids) if (!order.includes(id)) visit([...order, id]);
      return;
    }
    const amounts = recipe.map(q => q / recipe[order[0]]);
    let mass = 1; let bottleneck = Infinity;
    for (const index of order.slice(1)) {
      const capacity = Math.max(1, mass) ** .8;
      const ratio = amounts[index] / capacity;
      if (ratio < .005 || ratio > 8) return;
      const power = ((ratio - .005) / 7.995) ** .25;
      const seconds = CHARGE_SECONDS * (1 - (1 - power) ** (1 / 3));
      let slope = 0;
      for (const sign of [-1, 1]) {
        const changedSeconds = Math.max(0, Math.min(CHARGE_SECONDS, seconds + sign * .02));
        if (Math.abs(changedSeconds - seconds) < 1e-8) continue;
        const changed = amounts.map((q, i) => i === index ? chargeAmount(mass, changedSeconds) : q);
        slope = Math.max(slope, colorDistance(mixtureColor(level.paints, changed), target) / Math.abs(changedSeconds - seconds));
      }
      bottleneck = Math.min(bottleneck, tolerance / Math.max(.00001, slope));
      mass += amounts[index];
    }
    best = Math.max(best, bottleneck);
  }
  visit([]);
  return best;
}

const courseSignature = (count=PLAY_LEVELS.length)=>JSON.stringify(PLAY_LEVELS.slice(0,count).map(l=>({name:l.name,tolerance:l.tolerance,paints:l.paints.map(p=>[p.id,p.rgb,p.strength])})));
type StoredLabRoute={id:string;target:Mixture;recipe:Mixture;par:number;timingWindow:number;kind:string;solutionShots:number;order:number[];times:number[]};
const labBank=labRoundBank as {version:string;signature:string;palettes:{levelIndex:number;holes:StoredLabRoute[]}[]};
export function generateLabHole(levelIndex:number,stage:number,seed=20260911):Hole {
  if(labBank.signature!==courseSignature())throw new Error('Lab palette model changed');
  const holes=labBank.palettes.find(p=>p.levelIndex===levelIndex)?.holes;
  if(!holes||!Number.isInteger(stage)||stage<0||stage>=holes.length)throw new Error('Unknown lab hole');
  // The fixed lab seed preserves the planned test order. Other seeds expose
  // an experimental course: vary the opening order, keep its toughest finish.
  let slot=stage;
  if(levelIndex>=10&&seed!==20260911){
    const finish=holes.reduce((a,b)=>b.par>a.par||(b.par===a.par&&b.timingWindow<a.timingWindow)?b:a);
    const opening=holes.filter(h=>h!==finish),offset=(seed>>>0)%opening.length;
    const ordered=[...opening.slice(offset),...opening.slice(0,offset),finish];
    slot=holes.indexOf(ordered[stage]);
  }
  const record=holes[slot];
  if(!record)throw new Error('Unknown lab hole');
  const level=PLAY_LEVELS[levelIndex],target=mixtureColor(level.paints,record.target);
  return {seed,stage,start:neutralStart(level),target,notation:nearestNotation(target),par:record.par,recipe:[...record.recipe],tolerance:level.tolerance,timingWindow:record.timingWindow,courseId:record.id,kind:record.kind,solutionShots:record.solutionShots,routeOrder:[...record.order],routeTimes:[...record.times]};
}
export function generateHole(levelIndex: number, seed: number, stage = 0, legacy = false): Hole {
  if (!PLAY_LEVELS[levelIndex] || !Number.isInteger(stage) || stage < 0 || stage >= HOLES_PER_PALETTE) throw new Error('Invalid hole');
  if(levelIndex>=courseBank.palettes.length&&!legacy)return generateLabHole(levelIndex,stage,seed);
  const bank=legacy?legacyCourseBank:courseBank;
  if(bank.signature!==courseSignature(bank.palettes.length))throw new Error('Archived paint model does not match');
  const level=PLAY_LEVELS[levelIndex],rounds=bank.palettes[levelIndex].rounds;
  // Stable course selection. No candidate search runs on the player's device.
  let hash=seed>>>0;hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);hash=(hash^(hash>>>16))>>>0;
  const record=rounds[hash%rounds.length][stage];
  const target=mixtureColor(level.paints,record.target);
  return {seed,stage,start:neutralStart(level),target,notation:nearestNotation(target),par:record.par,recipe:[...record.recipe],tolerance:level.tolerance,timingWindow:record.timingWindow,courseId:record.id,kind:record.kind,solutionShots:record.solutionShots,routeOrder:[...record.order],routeTimes:[...record.times]};
}
