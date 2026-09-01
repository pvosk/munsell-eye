import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync(new URL('../data/real.dat', import.meta.url), 'utf8');
const hues = ['2.5R','5R','7.5R','10R','2.5YR','5YR','7.5YR','10YR','2.5Y','5Y','7.5Y','10Y','2.5GY','5GY','7.5GY','10GY','2.5G','5G','7.5G','10G','2.5BG','5BG','7.5BG','10BG','2.5B','5B','7.5B','10B','2.5PB','5PB','7.5PB','10PB','2.5P','5P','7.5P','10P','2.5RP','5RP','7.5RP','10RP'];
const hueIndex = new Map(hues.map((h, index) => [h, index]));

const bradford = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const bradfordInv = [
  [0.9869929, -0.1470543, 0.1599627],
  [0.4323053, 0.5183603, 0.0492912],
  [-0.0085287, 0.0400428, 0.9684867],
];
const mul = (matrix, vector) => matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
const whiteFromXy = (x, y) => [x / y, 1, (1 - x - y) / y];
const sourceWhite = whiteFromXy(0.31006, 0.31616);
const targetWhite = whiteFromXy(0.3127, 0.3290);
const sourceCone = mul(bradford, sourceWhite);
const targetCone = mul(bradford, targetWhite);

function adaptToD65(xyz) {
  const cone = mul(bradford, xyz).map((value, index) => value * targetCone[index] / sourceCone[index]);
  return mul(bradfordInv, cone);
}

function xyYToSrgb(x, y, reflectanceY) {
  const Y = reflectanceY / 100;
  const adapted = adaptToD65([x * Y / y, Y, (1 - x - y) * Y / y]);
  const [X, Ya, Z] = adapted;
  const linear = [
    3.2404542 * X - 1.5371385 * Ya - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Ya + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Ya + 1.0572252 * Z,
  ];
  const inGamut = linear.every((channel) => channel >= 0 && channel <= 1);
  const encoded = linear.map((channel) => {
    const clipped = Math.min(1, Math.max(0, channel));
    return clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055;
  });
  return { rgb: encoded.map((channel) => Math.round(channel * 255)), inGamut };
}

const rows = source.split(/\r?\n/).slice(1).map((line) => {
  const match = line.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/);
  if (!match) return null;
  const [, hue, value, chroma, x, y, Y] = match;
  return { hue, value: Number(value), chroma: Number(chroma), x: Number(x), y: Number(y), Y: Number(Y) };
}).filter(Boolean);

const colors = rows
  .filter((row) => hueIndex.has(row.hue) && Number.isInteger(row.value) && row.value >= 1 && row.value <= 9 && row.chroma >= 2 && row.chroma <= 24 && row.chroma % 2 === 0)
  .map((row) => ({ ...row, ...xyYToSrgb(row.x, row.y, row.Y) }))
  .filter((row) => row.inGamut)
  .map((row) => ({
    h: row.hue,
    v: row.value,
    c: row.chroma,
    rgb: row.rgb,
  }))
  .sort((a, b) => a.v - b.v || hueIndex.get(a.h) - hueIndex.get(b.h) || a.c - b.c);

const valueY = new Map();
for (const row of rows) if (!valueY.has(row.value)) valueY.set(row.value, row.Y);
const neutrals = Array.from({ length: 9 }, (_, index) => {
  const value = index + 1;
  const linear = valueY.get(value) / 100;
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const channel = Math.round(encoded * 255);
  return { h: 'N', v: value, c: 0, rgb: [channel, channel, channel] };
});

const file = `// Generated from RIT Munsell Renotation real.dat (Illuminant C), adapted to D65 sRGB.\n` +
  `export type MunsellColor = { h: string; v: number; c: number; rgb: [number, number, number] };\n` +
  `export const HUE_ORDER = ${JSON.stringify(hues)} as const;\n` +
  `export const NEUTRALS: MunsellColor[] = ${JSON.stringify(neutrals)};\n` +
  `export const MUNSELL_COLORS: MunsellColor[] = ${JSON.stringify(colors)};\n` +
  `export const MUNSELL_SOURCE = 'RIT Munsell Renotation data; display colors are sRGB approximations.';\n`;

writeFileSync(new URL('../app/munsell-data.ts', import.meta.url), file);
console.log(`Wrote ${colors.length} in-gamut chromatic colors and ${neutrals.length} neutrals.`);
