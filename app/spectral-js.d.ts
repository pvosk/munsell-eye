declare module 'spectral.js' {
  export class Color {
    constructor(value: string | number[]);
    readonly sRGB: number[];
    readonly lRGB: number[];
    readonly OKLab: number[];
    tintingStrength: number;
    toString(options?: { format?: 'hex' | 'rgb'; method?: 'map' | 'clip' }): string;
  }

  export function mix(...colors: Array<[Color, number]>): Color;
}
