import { Color, mix } from 'spectral.js';
import { HUE_ORDER, MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';

export type PaintCategory = 'White' | 'Yellow' | 'Orange' | 'Earth' | 'Red' | 'Violet' | 'Blue' | 'Green' | 'Black';

type PaintSpec = {
  id: string;
  name: string;
  pigment: string;
  category: PaintCategory;
  brands?: string;
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
  { id: 'flake-white-replacement', name: 'Flake White Replacement', pigment: 'PW6/PW4', category: 'White', brands: 'Gamblin', v: 9.5, strength: .86, opacity: 'opaque' },
  { id: 'radiant-white', name: 'Radiant White', pigment: 'PW6', category: 'White', brands: 'Gamblin', v: 9.5, strength: .72, opacity: 'opaque' },
  { id: 'zinc-white', name: 'Zinc White', pigment: 'PW4', category: 'White', brands: 'Gamblin · Winsor & Newton', v: 9.5, strength: .48, opacity: 'transparent' },
  { id: 'warm-white', name: 'Warm White', pigment: 'PW6/PY42', category: 'White', brands: 'Gamblin', v: 9, strength: .8, opacity: 'opaque' },
  { id: 'transparent-white', name: 'Transparent White', pigment: 'PW4', category: 'White', brands: 'Winsor & Newton', v: 9.5, strength: .42, opacity: 'transparent' },
  { id: 'cadmium-yellow-medium', name: 'Cadmium Yellow Medium', pigment: 'PY35', category: 'Yellow', brands: 'Gamblin · Winsor & Newton', h: '2.5Y', v: 8.5, c: 12, strength: .8, opacity: 'opaque' },
  { id: 'cadmium-yellow-deep', name: 'Cadmium Yellow Deep', pigment: 'PY35', category: 'Yellow', brands: 'Gamblin · Winsor & Newton', h: '10YR', v: 8, c: 14, strength: .82, opacity: 'opaque' },
  { id: 'cadmium-lemon', name: 'Cadmium Lemon', pigment: 'PY35', category: 'Yellow', brands: 'Winsor & Newton', h: '10Y', v: 9, c: 12, strength: .76, opacity: 'opaque' },
  { id: 'bismuth-yellow', name: 'Bismuth Yellow', pigment: 'PY184', category: 'Yellow', brands: 'Gamblin', h: '10Y', v: 9, c: 12, strength: .72, opacity: 'opaque' },
  { id: 'nickel-titanate-yellow', name: 'Nickel Titanate Yellow', pigment: 'PY53', category: 'Yellow', brands: 'Gamblin', h: '7.5Y', v: 8, c: 6, strength: .58, opacity: 'opaque' },
  { id: 'naples-yellow', name: 'Naples Yellow Hue', pigment: 'PW6/PY42/PY83', category: 'Yellow', brands: 'Gamblin · Winsor & Newton', h: '5Y', v: 8, c: 6, strength: .65, opacity: 'opaque' },
  { id: 'radiant-lemon', name: 'Radiant Lemon', pigment: 'PW6/PY3', category: 'Yellow', brands: 'Gamblin', h: '10Y', v: 9, c: 8, strength: .6, opacity: 'opaque' },
  { id: 'indian-yellow-deep', name: 'Indian Yellow Deep', pigment: 'PY110/PY139', category: 'Yellow', brands: 'Winsor & Newton', h: '5YR', v: 6, c: 12, strength: 1.02, opacity: 'transparent' },
  { id: 'winsor-yellow-deep', name: 'Winsor Yellow Deep', pigment: 'PY65', category: 'Yellow', brands: 'Winsor & Newton', h: '10YR', v: 8, c: 14, strength: .94, opacity: 'semi-transparent' },
  { id: 'permanent-orange', name: 'Permanent Orange', pigment: 'PO62', category: 'Orange', brands: 'Gamblin', h: '10R', v: 6, c: 16, strength: 1, opacity: 'semi-transparent' },
  { id: 'pyrrole-orange', name: 'Pyrrole Orange', pigment: 'PO73', category: 'Orange', brands: 'Gamblin', h: '7.5R', v: 6, c: 16, strength: 1.05, opacity: 'semi-opaque' },
  { id: 'mars-orange', name: 'Mars Orange', pigment: 'PR101', category: 'Orange', brands: 'Winsor & Newton', h: '5YR', v: 5, c: 10, strength: .7, opacity: 'opaque' },
  { id: 'chrome-titanate-yellow', name: 'Chrome Titanate Yellow', pigment: 'PBr24', category: 'Orange', brands: 'Gamblin', h: '2.5Y', v: 7, c: 8, strength: .62, opacity: 'opaque' },
  { id: 'raw-sienna', name: 'Raw Sienna', pigment: 'PBr7', category: 'Earth', brands: 'Gamblin · Winsor & Newton', h: '10YR', v: 5, c: 6, strength: .58, opacity: 'semi-transparent' },
  { id: 'raw-umber', name: 'Raw Umber', pigment: 'PBr7', category: 'Earth', brands: 'Gamblin · Winsor & Newton', h: '2.5Y', v: 2, c: 2, strength: .7, opacity: 'semi-transparent' },
  { id: 'venetian-red', name: 'Venetian Red', pigment: 'PR101', category: 'Earth', brands: 'Gamblin · Winsor & Newton', h: '10R', v: 4, c: 8, strength: .72, opacity: 'opaque' },
  { id: 'indian-red', name: 'Indian Red', pigment: 'PR101', category: 'Earth', brands: 'Gamblin · Winsor & Newton', h: '5R', v: 3, c: 6, strength: .76, opacity: 'opaque' },
  { id: 'mars-yellow', name: 'Mars Yellow', pigment: 'PY42', category: 'Earth', brands: 'Gamblin', h: '10YR', v: 5, c: 8, strength: .68, opacity: 'opaque' },
  { id: 'mars-red', name: 'Mars Red', pigment: 'PR101', category: 'Earth', brands: 'Gamblin', h: '7.5R', v: 3, c: 8, strength: .78, opacity: 'opaque' },
  { id: 'green-earth', name: 'Terre Verte', pigment: 'PG23', category: 'Earth', brands: 'Gamblin · Winsor & Newton', h: '5G', v: 4, c: 2, strength: .46, opacity: 'semi-transparent' },
  { id: 'transparent-earth-orange', name: 'Transparent Earth Orange', pigment: 'PY42/PR101', category: 'Earth', brands: 'Gamblin', h: '5YR', v: 3, c: 6, strength: .82, opacity: 'transparent' },
  { id: 'cadmium-red-medium', name: 'Cadmium Red Medium', pigment: 'PR108', category: 'Red', brands: 'Gamblin · Winsor & Newton', h: '5R', v: 4, c: 16, strength: .88, opacity: 'opaque' },
  { id: 'cadmium-red-deep', name: 'Cadmium Red Deep', pigment: 'PR108', category: 'Red', brands: 'Gamblin · Winsor & Newton', h: '2.5R', v: 3, c: 12, strength: .9, opacity: 'opaque' },
  { id: 'permanent-red', name: 'Permanent Red', pigment: 'PR254', category: 'Red', brands: 'Winsor & Newton', h: '7.5R', v: 4, c: 16, strength: 1.04, opacity: 'semi-opaque' },
  { id: 'quinacridone-red', name: 'Quinacridone Red', pigment: 'PV19', category: 'Red', brands: 'Gamblin', h: '10RP', v: 4, c: 14, strength: 1.08, opacity: 'transparent' },
  { id: 'quinacridone-rose', name: 'Quinacridone Rose', pigment: 'PV19', category: 'Red', brands: 'Winsor & Newton', h: '2.5RP', v: 4, c: 12, strength: 1.08, opacity: 'transparent' },
  { id: 'permanent-rose', name: 'Permanent Rose', pigment: 'PV19', category: 'Red', brands: 'Winsor & Newton', h: '5RP', v: 4, c: 12, strength: 1.05, opacity: 'transparent' },
  { id: 'perylene-maroon', name: 'Perylene Maroon', pigment: 'PR179', category: 'Red', brands: 'Gamblin · Winsor & Newton', h: '10RP', v: 2, c: 6, strength: 1.12, opacity: 'transparent' },
  { id: 'alizarin-crimson', name: 'Alizarin Crimson', pigment: 'PR83', category: 'Red', brands: 'Winsor & Newton', h: '10RP', v: 2, c: 8, strength: 1.04, opacity: 'transparent' },
  { id: 'winsor-red', name: 'Winsor Red', pigment: 'PR255', category: 'Red', brands: 'Winsor & Newton', h: '7.5R', v: 4, c: 16, strength: 1.08, opacity: 'semi-transparent' },
  { id: 'cobalt-violet', name: 'Cobalt Violet', pigment: 'PV14', category: 'Violet', brands: 'Gamblin · Winsor & Newton', h: '7.5P', v: 3, c: 10, strength: .58, opacity: 'semi-opaque' },
  { id: 'manganese-violet', name: 'Manganese Violet', pigment: 'PV16', category: 'Violet', brands: 'Gamblin · Winsor & Newton', h: '10P', v: 3, c: 8, strength: .66, opacity: 'semi-opaque' },
  { id: 'quinacridone-violet', name: 'Quinacridone Violet', pigment: 'PV19', category: 'Violet', brands: 'Gamblin', h: '10P', v: 3, c: 10, strength: 1.1, opacity: 'transparent' },
  { id: 'radiant-violet', name: 'Radiant Violet', pigment: 'PW6/PV23', category: 'Violet', brands: 'Gamblin', h: '7.5P', v: 6, c: 8, strength: .62, opacity: 'opaque' },
  { id: 'phthalo-blue-green', name: 'Phthalo Blue (Green Shade)', pigment: 'PB15:3', category: 'Blue', brands: 'Gamblin · Winsor & Newton', h: '10B', v: 2, c: 10, strength: 1.4, opacity: 'transparent' },
  { id: 'prussian-blue', name: 'Prussian Blue', pigment: 'PB27', category: 'Blue', brands: 'Winsor & Newton', h: '5PB', v: 2, c: 6, strength: 1.22, opacity: 'transparent' },
  { id: 'cerulean-blue-hue', name: 'Cerulean Blue Hue', pigment: 'PB15:3/PW6', category: 'Blue', brands: 'Gamblin · Winsor & Newton', h: '2.5PB', v: 5, c: 10, strength: .68, opacity: 'semi-opaque' },
  { id: 'manganese-blue-hue', name: 'Manganese Blue Hue', pigment: 'PB15:3/PW6', category: 'Blue', brands: 'Gamblin', h: '7.5B', v: 5, c: 10, strength: .7, opacity: 'semi-transparent' },
  { id: 'radiant-turquoise', name: 'Radiant Turquoise', pigment: 'PW6/PB15:3/PG7', category: 'Blue', brands: 'Gamblin', h: '5B', v: 7, c: 8, strength: .62, opacity: 'opaque' },
  { id: 'kings-blue', name: 'King’s Blue', pigment: 'PW6/PB29', category: 'Blue', brands: 'Winsor & Newton', h: '5PB', v: 6, c: 8, strength: .58, opacity: 'opaque' },
  { id: 'cobalt-turquoise', name: 'Cobalt Turquoise Light', pigment: 'PG50', category: 'Blue', brands: 'Winsor & Newton', h: '10BG', v: 6, c: 10, strength: .58, opacity: 'opaque' },
  { id: 'indigo', name: 'Indigo', pigment: 'PB66/PBk6', category: 'Blue', brands: 'Winsor & Newton', h: '7.5PB', v: 1, c: 4, strength: 1.16, opacity: 'semi-transparent' },
  { id: 'phthalo-green-yellow', name: 'Phthalo Green (Yellow Shade)', pigment: 'PG36', category: 'Green', brands: 'Gamblin · Winsor & Newton', h: '10G', v: 3, c: 10, strength: 1.34, opacity: 'transparent' },
  { id: 'permanent-green-light', name: 'Permanent Green Light', pigment: 'PG7/PY74', category: 'Green', brands: 'Gamblin · Winsor & Newton', h: '5G', v: 6, c: 12, strength: .94, opacity: 'semi-transparent' },
  { id: 'sap-green', name: 'Sap Green', pigment: 'PG36/PY110', category: 'Green', brands: 'Gamblin · Winsor & Newton', h: '5G', v: 3, c: 6, strength: .9, opacity: 'transparent' },
  { id: 'olive-green', name: 'Olive Green', pigment: 'PBk6/PY42', category: 'Green', brands: 'Winsor & Newton', h: '10GY', v: 3, c: 4, strength: .78, opacity: 'semi-transparent' },
  { id: 'cobalt-green', name: 'Cobalt Green', pigment: 'PG19', category: 'Green', brands: 'Winsor & Newton', h: '10G', v: 5, c: 8, strength: .58, opacity: 'semi-opaque' },
  { id: 'radiant-green', name: 'Radiant Green', pigment: 'PW6/PG7/PY3', category: 'Green', brands: 'Gamblin', h: '5G', v: 7, c: 8, strength: .62, opacity: 'opaque' },
  { id: 'terre-verte', name: 'Terre Verte', pigment: 'PG23', category: 'Green', brands: 'Winsor & Newton', h: '5G', v: 4, c: 2, strength: .46, opacity: 'semi-transparent' },
  { id: 'phthalo-emerald', name: 'Phthalo Emerald', pigment: 'PG36', category: 'Green', brands: 'Gamblin', h: '7.5G', v: 3, c: 10, strength: 1.3, opacity: 'transparent' },
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
  'Zorn 4': ['titanium-white', 'yellow-ochre', 'cadmium-red-light', 'ivory-black'],
  'Iron Triad 4': ['titanium-white', 'prussian-blue', 'yellow-ochre', 'venetian-red'],
  'UB + TRO + White': ['titanium-white', 'transparent-earth-red', 'ultramarine-blue'],
  'French Impressionist 9': ['flake-white-replacement', 'cadmium-yellow-light', 'cadmium-yellow-medium', 'cadmium-red-light', 'alizarin-permanent', 'ultramarine-blue', 'cerulean-blue-hue', 'viridian', 'ivory-black'],
  'Modern Chromatic 12': ['hansa-yellow-light', 'hansa-yellow-medium', 'hansa-yellow-deep', 'permanent-orange', 'naphthol-scarlet', 'quinacridone-red', 'quinacridone-violet', 'dioxazine-purple', 'phthalo-blue', 'manganese-blue-hue', 'phthalo-green', 'phthalo-emerald'],
  'Rembrandt-inspired 9': ['titanium-white', 'yellow-ochre', 'raw-umber', 'burnt-sienna', 'venetian-red', 'indian-red', 'ultramarine-blue', 'green-earth', 'ivory-black'],
  'CMY + B/W': ['titanium-white', 'ivory-black', 'hansa-yellow-medium', 'quinacridone-magenta', 'phthalo-blue-green'],
  'RGB + B/W': ['titanium-white', 'ivory-black', 'cadmium-red-light', 'phthalo-green', 'ultramarine-blue'],
  'Core 30': SPECS.slice(0, 30).map((paint) => paint.id),
  'Full catalogue': SPECS.map((paint) => paint.id),
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
  const firstChroma = Math.hypot(first[1], first[2]);
  const secondChroma = Math.hypot(second[1], second[2]);
  return Math.sqrt(
    (first[0] - second[0]) ** 2 * 1.3
    + (first[1] - second[1]) ** 2
    + (first[2] - second[2]) ** 2
    + (firstChroma - secondChroma) ** 2 * .35,
  );
}

function combinations<T>(items: T[], size: number, start = 0, prefix: T[] = []): T[][] {
  if (prefix.length === size) return [prefix];
  const rows: T[][] = [];
  for (let index = start; index <= items.length - (size - prefix.length); index++) rows.push(...combinations(items, size, index + 1, [...prefix, items[index]]));
  return rows;
}

function simplifyParts(parts: number[]) {
  const rounded = parts.map((part) => Math.max(.5, Math.round(part * 2) / 2));
  if (!rounded.every(Number.isInteger)) return rounded;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = rounded.reduce((current, part) => gcd(current, part));
  return rounded.map((part) => part / Math.max(1, divisor));
}

function evaluate(paints: PaintColor[], parts: number[], targetLab: number[]): Candidate {
  const practicalParts = simplifyParts(parts);
  const result = paints.length === 1
    ? spectralPaint(paints[0])
    : mix(...paints.map((paint, index) => [spectralPaint(paint), practicalParts[index]] as [Color, number]));
  const rgb = result.sRGB.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))) as [number, number, number];
  return { ids: paints.map((paint) => paint.id), parts: practicalParts, rgb, distance: perceptualDistance(result.OKLab, targetLab) };
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
  // Product names stay distinct in the catalogue, while visually equivalent
  // records share one search profile. This keeps an all-paints palette fast.
  const uniquePalette = [...new Map(palette.map((paint) => [
    `${paint.rgb.join(',')}:${paint.strength.toFixed(2)}:${paint.opacity}`,
    paint,
  ])).values()];
  const singles = uniquePalette.map((paint) => evaluate([paint], [1], targetLab)).sort((a, b) => a.distance - b.distance);
  const candidates: Candidate[] = [...singles];

  const hueIndex = (hue?: string) => hue ? HUE_ORDER.indexOf(supportedHue(hue) as (typeof HUE_ORDER)[number]) : -1;
  const circularDistance = (first: number, second: number) => {
    if (first < 0 || second < 0) return HUE_ORDER.length;
    const distance = Math.abs(first - second);
    return Math.min(distance, HUE_ORDER.length - distance);
  };
  const targetHueIndex = hueIndex(target.h);
  const complementIndex = targetHueIndex < 0 ? -1 : (targetHueIndex + HUE_ORDER.length / 2) % HUE_ORDER.length;
  const paintFor = (candidate: Candidate) => uniquePalette.find((paint) => paint.id === candidate.ids[0]);
  const orderedWorking: PaintColor[] = [];
  const addWorking = (paint?: PaintColor) => {
    if (paint && !orderedWorking.some((entry) => entry.id === paint.id)) orderedWorking.push(paint);
  };

  let workingPalette: PaintColor[];
  if (uniquePalette.length <= 30) {
    // A normal studio palette is small enough to search as a whole. This avoids
    // losing an unintuitive but useful neutralizer before recipe evaluation.
    workingPalette = uniquePalette;
  } else {
    singles.slice(0, 10).forEach((candidate) => addWorking(paintFor(candidate)));
    const versatileCore = new Set<string>([
      ...PALETTE_PRESETS['Basic 8'],
      ...PALETTE_PRESETS['Figure 10'],
    ]);
    uniquePalette.filter((paint) => versatileCore.has(paint.id)).forEach(addWorking);
    uniquePalette
      .filter((paint) => paint.h && circularDistance(hueIndex(paint.h), targetHueIndex) <= 3)
      .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
      .slice(0, 4)
      .forEach(addWorking);
    uniquePalette
      .filter((paint) => paint.h && circularDistance(hueIndex(paint.h), complementIndex) <= 2)
      .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
      .slice(0, 3)
      .forEach(addWorking);
    singles
      .map((candidate) => paintFor(candidate))
      .filter((paint): paint is PaintColor => Boolean(paint && (paint.category === 'White' || paint.category === 'Black')))
      .slice(0, 3)
      .forEach(addWorking);
    workingPalette = orderedWorking.slice(0, 30);
  }

  const searchMixtures = (mixPalette: PaintColor[], mixAdditives: PaintColor[]) => {
    const pairCandidates: Candidate[] = [];
    const pairParts = Array.from({ length: 11 }, (_, index) => [(index + 1) / 2, (11 - index) / 2]);
    for (const pair of combinations(mixPalette, 2)) {
      for (const parts of pairParts) {
        const candidate = evaluate(pair, parts, targetLab);
        pairCandidates.push(candidate);
        candidates.push(candidate);
      }
    }

    const tripleCandidates: Candidate[] = [];
    const bestPairs = pairCandidates.sort((a, b) => a.distance - b.distance).slice(0, 96);
    for (const pair of bestPairs) {
      const pairPaints = pair.ids.map((id) => mixPalette.find((paint) => paint.id === id)!);
      for (const additive of mixAdditives.filter((paint) => !pair.ids.includes(paint.id))) {
        for (const amount of [.5, 1, 2]) {
          const candidate = evaluate([...pairPaints, additive], [...pair.parts, amount], targetLab);
          tripleCandidates.push(candidate);
          candidates.push(candidate);
        }
      }
    }

    for (const triple of tripleCandidates.sort((a, b) => a.distance - b.distance).slice(0, 12)) {
      const triplePaints = triple.ids.map((id) => mixPalette.find((paint) => paint.id === id)!);
      for (const additive of mixAdditives.slice(0, 8).filter((paint) => !triple.ids.includes(paint.id))) {
        candidates.push(evaluate([...triplePaints, additive], [...triple.parts, 1], targetLab));
      }
    }
  };

  const additiveIds = new Set(singles.slice(0, 10).flatMap((candidate) => candidate.ids));
  workingPalette
    .filter((paint) => paint.h && (
      circularDistance(hueIndex(paint.h), targetHueIndex) <= 3
      || circularDistance(hueIndex(paint.h), complementIndex) <= 2
    ))
    .forEach((paint) => additiveIds.add(paint.id));
  ['titanium-white', 'ivory-black'].forEach((id) => { if (selectedIds.includes(id)) additiveIds.add(id); });
  const additives = uniquePalette.length <= 30 ? workingPalette : workingPalette.filter((paint) => additiveIds.has(paint.id));
  if (workingPalette.length > 1) searchMixtures(workingPalette, additives);

  if (uniquePalette.length > 30) {
    // Keep the large catalogue monotonic with the established core: adding
    // paints should never make the best available route worse.
    const coreIds = new Set(PALETTE_PRESETS['Core 30']);
    const corePalette = uniquePalette.filter((paint) => coreIds.has(paint.id));
    if (corePalette.length > 1) searchMixtures(corePalette, corePalette);
  }

  const closest = [...candidates].sort((a, b) => a.distance - b.distance)[0];
  // Prefer a simpler recipe only when its perceptual loss is small enough to be
  // practically invisible. The previous, wider band could hide a better
  // yellow/green/white route behind a visibly poorer two-paint result.
  const tolerance = Math.min(.0045, Math.max(.0015, closest.distance * .07));
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

export type PaintPathPoint = {
  rgb: [number, number, number];
  progress: number;
  label: string;
};

function pathColor(paints: PaintColor[], weights: number[]) {
  const active = paints
    .map((paint, index) => [paint, weights[index]] as const)
    .filter((entry) => entry[1] > 0);
  const result = active.length === 1
    ? spectralPaint(active[0][0])
    : mix(...active.map(([paint, weight]) => [spectralPaint(paint), weight] as [Color, number]));
  return result.sRGB.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))) as [number, number, number];
}

export function recipeMixPath(recipe: PaintRecipe, steps = 13): PaintPathPoint[] {
  const ingredients = [...recipe.ingredients].sort((a, b) => b.parts - a.parts);
  const paints = ingredients.map((entry) => entry.paint);
  return Array.from({ length: steps }, (_, index) => {
    const progress = steps <= 1 ? 1 : index / (steps - 1);
    const weights = ingredients.map((entry, ingredientIndex) => ingredientIndex === 0 ? entry.parts : entry.parts * progress);
    return {
      rgb: pathColor(paints, weights),
      progress,
      label: index === 0 ? paints[0].name : index === steps - 1 ? 'Recommended mix' : `${Math.round(progress * 100)}% additions`,
    };
  });
}

export function paintPairPath(firstId: string, secondId: string, steps = 13): PaintPathPoint[] {
  const first = PAINTS.find((paint) => paint.id === firstId) ?? PAINTS[0];
  const second = PAINTS.find((paint) => paint.id === secondId) ?? PAINTS[1];
  return Array.from({ length: steps }, (_, index) => {
    const progress = steps <= 1 ? 1 : index / (steps - 1);
    return {
      rgb: pathColor([first, second], [1 - progress, progress]),
      progress,
      label: `${Math.round((1 - progress) * 100)} / ${Math.round(progress * 100)}`,
    };
  });
}
