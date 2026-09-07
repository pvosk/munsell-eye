import { MUNSELL_COLORS, type MunsellColor } from './munsell-data';

// A single practical display/training gamut for the whole application.
// The renotation source contains sRGB-displayable coordinates through C24,
// especially in PB/P. Those coordinates are useful data, but they overstate
// the working range this painting trainer teaches. Hues whose sampled Munsell
// boundary falls below C16 still retain their naturally smaller maximum.
export const PRACTICAL_CHROMA_LIMIT = 16;

export const PRACTICAL_MUNSELL_COLORS = MUNSELL_COLORS.filter(
  (color) => color.c <= PRACTICAL_CHROMA_LIMIT,
);

export const PRACTICAL_CHROMAS = Array.from(
  { length: PRACTICAL_CHROMA_LIMIT / 2 + 1 },
  (_, index) => index * 2,
);

export function practicalColorsForHue(hue: string) {
  return PRACTICAL_MUNSELL_COLORS.filter((color) => color.h === hue);
}

export function practicalMaxChroma(hue: string, value?: number) {
  const colors = PRACTICAL_MUNSELL_COLORS.filter(
    (color) => color.h === hue && (value === undefined || color.v === value),
  );
  return Math.max(2, ...colors.map((color) => color.c));
}

function rgbColorfulness(color: MunsellColor) {
  return Math.max(...color.rgb) - Math.min(...color.rgb);
}

export function practicalEdgeColor(hue: string) {
  const colors = practicalColorsForHue(hue);
  return [...colors].sort((a, b) => (
    b.c - a.c
    || rgbColorfulness(b) - rgbColorfulness(a)
    || Math.abs(a.v - 5) - Math.abs(b.v - 5)
  ))[0];
}
