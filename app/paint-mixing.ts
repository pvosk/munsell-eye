import { Color, mix } from 'spectral.js';
import { HUE_ORDER, MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';

export type PaintCategory = 'White' | 'Yellow' | 'Orange' | 'Earth' | 'Red' | 'Violet' | 'Blue' | 'Green' | 'Black';

type PaintSpec = {
  id: string;
  name: string;
  pigment: string;
  category: PaintCategory;
  h?: string;
  v: number;
  c?: number;
  strength: number;
  opacity: 'opaque' | 'semi-opaque' | 'semi-transparent' | 'transparent';
};

export type PaintColor = PaintSpec & {
  rgb: [number, number, number];
  notation: string;
};

export type PaintRecipeIngredient = {
  paint: PaintColor;
  parts: number;
};

export type PaintRecipe = {
  ingredients: PaintRecipeIngredient[];
  rgb: [number, number, number];
  distance: number;
  quality: 'Very close' | 'Close' | 'Usable approximation' | 'Outside palette gamut';
};

const SPECS: PaintSpec[] = [
  { id: 'titanium-white', name: 'Titanium White', pigment: 'PW6', category: 'White', v: 10, strength: 1.2, opacity: 'opaque' },
  { id: 'hansa-yellow-light', name: 'Hansa Yellow Light', pigment: 'PY3', category: 'Yellow', h: '7.5Y', v: 8.5, c: 12, strength: .92, opacity: 'semi-transparent' },
  { id: 'hansa-yellow-medium', name: 'Hansa Yellow Medium', pigment: 'PY74', category: 'Yellow', h: '3.75Y', v: 8.5, c: 14, strength: .95, opacity: 'semi-transparent' },
  { id: 'hansa-yellow-deep', name: 'Hansa Yellow Deep', pigment: 'PY75', category: 'Yellow', h: '8.75YR', v: 8, c: 14, strength: .95, opacity: 'semi-transparent' },
  { id: 'cadmium-yellow-light', name: 'Cadmium Yellow Light', pigment: 'PY35', category: 'Yellow', h: '7.5Y', v: 8.5, c: 10, strength: .78, opacity: 'opaque' },
  { id: 'yellow-ochre', name: 'Yellow Ochre', pigment: 'PY43', category: 'Earth', h: '10YR', v: 5, c: 10, strength: .62, opacity: 'opaque' },
  { id: 'india-yellow', name: 'India Yellow', pigment: 'PY83', category: 'Yellow', h: '5YR', v: 5, c: 12, strength: 1.02, opacity: 'transparent' },
  { id: 'cadmium-orange', name: 'Cadmium Orange', pigment: 'PO20', category: 'Orange', h: '5YR', v: 7, c: 16, strength: .82, opacity: 'opaque' },
  { id: 'transparent-orange', name: 'Transparent Orange', pigment: 'PO62', category: 'Orange', h: '8.75R', v: 4, c: 14, strength: 1.02, opacity: 'transparent' },
  { id: 'transparent-earth-yellow', name: 'Transparent Earth Yellow', pigment: 'PY42', category: 'Earth', h: '10YR', v: 3, c: 4, strength: .72, opacity: 'transparent' },
  { id: 'burnt-sienna', name: 'Burnt Sienna', pigment: 'PBr7', category: 'Earth', h: '10R', v: 3, c: 4, strength: .68, opacity: 'semi-transparent' },
  { id: 'transparent-earth-red', name: 'Transparent Earth Red', pigment: 'PR101', category: 'Earth', h: '10R', v: 2, c: 4, strength: .82, opacity: 'transparent' },
  { id: 'burnt-umber', name: 'Burnt Umber', pigment: 'PBr7', category: 'Earth', h: '5YR', v: 2, c: 2, strength: .78, opacity: 'semi-transparent' },
  { id: 'cadmium-red-light', name: 'Cadmium Red Light', pigment: 'PR108', category: 'Red', h: '7.5R', v: 5, c: 16, strength: .86, opacity: 'opaque' },
  { id: 'naphthol-scarlet', name: 'Naphthol Scarlet', pigment: 'PR188', category: 'Red', h: '7.5R', v: 4, c: 16, strength: 1.05, opacity: 'semi-transparent' },
  { id: 'perylene-red', name: 'Perylene Red', pigment: 'PR149', category: 'Red', h: '5R', v: 3, c: 14, strength: 1.08, opacity: 'transparent' },
  { id: 'alizarin-permanent', name: 'Alizarin Permanent', pigment: 'PR177', category: 'Red', h: '10RP', v: 2, c: 6, strength: 1.08, opacity: 'transparent' },
  { id: 'quinacridone-magenta', name: 'Quinacridone Magenta', pigment: 'PR122', category: 'Red', h: '5RP', v: 3, c: 10, strength: 1.12, opacity: 'transparent' },
  { id: 'dioxazine-purple', name: 'Dioxazine Purple', pigment: 'PV23', category: 'Violet', h: '2.5P', v: 2, c: 10, strength: 1.25, opacity: 'transparent' },
  { id: 'ultramarine-violet', name: 'Ultramarine Violet', pigment: 'PV15', category: 'Violet', h: '5P', v: 2, c: 8, strength: .78, opacity: 'transparent' },
  { id: 'ultramarine-blue', name: 'Ultramarine Blue', pigment: 'PB29', category: 'Blue', h: '7.5PB', v: 2, c: 10, strength: .92, opacity: 'transparent' },
  { id: 'cobalt-blue', name: 'Cobalt Blue', pigment: 'PB28', category: 'Blue', h: '6.25PB', v: 3, c: 12, strength: .65, opacity: 'semi-transparent' },
  { id: 'cerulean-blue', name: 'Cerulean Blue', pigment: 'PB35', category: 'Blue', h: '2.5PB', v: 4, c: 12, strength: .55, opacity: 'opaque' },
  { id: 'phthalo-blue', name: 'Phthalo Blue', pigment: 'PB15:2', category: 'Blue', h: '5PB', v: 2, c: 10, strength: 1.35, opacity: 'transparent' },
  { id: 'indanthrone-blue', name: 'Indanthrone Blue', pigment: 'PB60', category: 'Blue', h: '5PB', v: 2, c: 4, strength: 1.12, opacity: 'transparent' },
  { id: 'cobalt-teal', name: 'Cobalt Teal', pigment: 'PG50', category: 'Green', h: '10BG', v: 5, c: 10, strength: .62, opacity: 'opaque' },
  { id: 'phthalo-green', name: 'Phthalo Green', pigment: 'PG7', category: 'Green', h: '5BG', v: 2, c: 6, strength: 1.38, opacity: 'transparent' },
  { id: 'viridian', name: 'Viridian', pigment: 'PG18', category: 'Green', h: '7.5BG', v: 2, c: 4, strength: .78, opacity: 'transparent' },
  { id: 'chromium-oxide-green', name: 'Chromium Oxide Green', pigment: 'PG17', category: 'Green', h: '2.5G', v: 4, c: 4, strength: .58, opacity: 'opaque' },
  { id: 'ivory-black', name: 'Ivory Black', pigment: 'PBk9', category: 'Black', v: 1, strength: 1.08, opacity: 'semi-transparent' },
];

function supportedHue(hue: string) {
  const compact = hue.replace(/\s/g, '');
  if (HUE_ORDER.includes(compact as (typeof HUE_ORDER)[number])) return compact;
  const family = compact.replace(/[\d.]/g, '');
  const number = Number(compact.match(/[\d.]+/)?.[0] ?? 5);
  const options = HUE_ORDER.filter((entry) => entry.replace(/[\d.]/g, '') === family);
  return options.sort((a, b) => Math.abs(Number(a.replace(family, '')) - number) - Math.abs(Number(b.replace(family, '')) - number))[0] ?? '5YR';
}

function displayChip(spec: PaintSpec): MunsellColor | { rgb: [number, number, number] } {
  if (!spec.h) {
    if (spec.category === 'White') return { rgb: [249, 248, 242] };
    if (spec.category === 'Black') return { rgb: [24, 24, 22] };
    return NEUTRALS[Math.min(8, Math.max(0, Math.round(spec.v) - 1))];
  }
  const hue = supportedHue(spec.h);
  const candidates = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...candidates].sort((a, b) => (
    Math.abs(a.v - spec.v) * 3 + Math.abs(a.c - (spec.c ?? 0))
    - (Math.abs(b.v - spec.v) * 3 + Math.abs(b.c - (spec.c ?? 0)))
  ))[0] ?? MUNSELL_COLORS[0];
}

export const PAINTS: PaintColor[] = SPECS.map((spec) => {
  const chip = displayChip(spec);
  return {
    ...spec,
    rgb: chip.rgb,
    notation: spec.h ? `${spec.h.replace(/\s/g, '')} ${spec.v}/${spec.c}` : `N${spec.v}`,
  };
});

export const PAINT_CATEGORIES: PaintCategory[] = ['White', 'Yellow', 'Orange', 'Earth', 'Red', 'Violet', 'Blue', 'Green', 'Black'];

export const PALETTE_PRESETS = {
  'Basic 8': ['titanium-white', 'hansa-yellow-medium', 'yellow-ochre', 'cadmium-red-light', 'transparent-earth-red', 'quinacridone-magenta', 'ultramarine-blue', 'phthalo-green'],
  'Figure 10': ['titanium-white', 'hansa-yellow-light', 'yellow-ochre', 'burnt-sienna', 'transparent-earth-red', 'cadmium-red-light', 'quinacridone-magenta', 'ultramarine-blue', 'cobalt-blue', 'viridian'],
  'Full 30': SPECS.map((paint) => paint.id),
} as const;

export const DEFAULT_PALETTE_IDS = [...PALETTE_PRESETS['Basic 8']];

type Candidate = {
  ids: string[];
  parts: number[];
  rgb: [number, number, number];
  distance: number;
};

const spectralPaintCache = new Map<string, Color>();

function spectralPaint(paint: PaintColor) {
  const cached = spectralPaintCache.get(paint.id);
  if (cached) return cached;
  const color = new Color(paint.rgb);
  color.tintingStrength = paint.strength;
  spectralPaintCache.set(paint.id, color);
  return color;
}

function perceptualDistance(first: number[], second: number[]) {
  return Math.sqrt(
    (first[0] - second[0]) ** 2 * 1.15
    + (first[1] - second[1]) ** 2
    + (first[2] - second[2]) ** 2,
  );
}

function compositions(total: number, count: number, prefix: number[] = []): number[][] {
  if (count === 1) return [[...prefix, total]];
  const rows: number[][] = [];
  for (let value = 1; value <= total - count + 1; value++) rows.push(...compositions(total - value, count - 1, [...prefix, value]));
  return rows;
}

function combinations<T>(items: T[], size: number, start = 0, prefix: T[] = []): T[][] {
  if (prefix.length === size) return [prefix];
  const rows: T[][] = [];
  for (let index = start; index <= items.length - (size - prefix.length); index++) rows.push(...combinations(items, size, index + 1, [...prefix, items[index]]));
  return rows;
}

function simplifyParts(parts: number[]) {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = parts.reduce((current, part) => gcd(current, part));
  return parts.map((part) => part / Math.max(1, divisor));
}

function evaluate(paints: PaintColor[], parts: number[], targetLab: number[]): Candidate {
  const result = paints.length === 1
    ? spectralPaint(paints[0])
    : mix(...paints.map((paint, index) => [spectralPaint(paint), parts[index]] as [Color, number]));
  const rgb = result.sRGB.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))) as [number, number, number];
  return { ids: paints.map((paint) => paint.id), parts: simplifyParts(parts), rgb, distance: perceptualDistance(result.OKLab, targetLab) };
}

function recipeQuality(distance: number): PaintRecipe['quality'] {
  if (distance <= .035) return 'Very close';
  if (distance <= .065) return 'Close';
  if (distance <= .115) return 'Usable approximation';
  return 'Outside palette gamut';
}

export function suggestPaintRecipe(target: MunsellColor, selectedIds: string[]): PaintRecipe | null {
  const palette = selectedIds.map((id) => PAINTS.find((paint) => paint.id === id)).filter((paint): paint is PaintColor => Boolean(paint));
  if (!palette.length) return null;

  const targetLab = new Color(target.rgb).OKLab;
  const singles = palette.map((paint) => evaluate([paint], [1], targetLab)).sort((a, b) => a.distance - b.distance);
  const candidates: Candidate[] = [...singles];

  if (palette.length > 1) {
    const pairParts = compositions(6, 2);
    for (const pair of combinations(palette, 2)) {
      for (const parts of pairParts) candidates.push(evaluate(pair, parts, targetLab));
    }
  }

  const additiveIds = new Set(singles.slice(0, 8).flatMap((candidate) => candidate.ids));
  ['titanium-white', 'ivory-black'].forEach((id) => { if (selectedIds.includes(id)) additiveIds.add(id); });
  const additives = palette.filter((paint) => additiveIds.has(paint.id));
  const bestPairs = candidates.filter((candidate) => candidate.ids.length === 2).sort((a, b) => a.distance - b.distance).slice(0, 12);
  for (const pair of bestPairs) {
    const pairPaints = pair.ids.map((id) => palette.find((paint) => paint.id === id)!);
    for (const additive of additives.filter((paint) => !pair.ids.includes(paint.id))) {
      for (const amount of [1, 2]) candidates.push(evaluate([...pairPaints, additive], [...pair.parts, amount], targetLab));
    }
  }

  const bestTriples = candidates.filter((candidate) => candidate.ids.length === 3).sort((a, b) => a.distance - b.distance).slice(0, 10);
  for (const triple of bestTriples) {
    const triplePaints = triple.ids.map((id) => palette.find((paint) => paint.id === id)!);
    for (const additive of additives.slice(0, 6).filter((paint) => !triple.ids.includes(paint.id))) {
      candidates.push(evaluate([...triplePaints, additive], [...triple.parts, 1], targetLab));
    }
  }

  const closest = [...candidates].sort((a, b) => a.distance - b.distance)[0];
  const tolerance = Math.max(.012, closest.distance * .18);
  const practical = candidates
    .filter((candidate) => candidate.distance <= closest.distance + tolerance)
    .sort((a, b) => a.ids.length - b.ids.length || a.distance - b.distance)[0] ?? closest;

  return {
    ingredients: practical.ids.map((id, index) => ({ paint: PAINTS.find((paint) => paint.id === id)!, parts: practical.parts[index] })),
    rgb: practical.rgb,
    distance: practical.distance,
    quality: recipeQuality(practical.distance),
  };
}
