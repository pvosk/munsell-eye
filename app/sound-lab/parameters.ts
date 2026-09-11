import { MUSIC_DEFAULTS, harmonicFrame, midiHz, sanitizeMusic, type MusicSettings } from './music';
export type Parameters = {
  volume: number; activity: number; attack: number; decay: number; material: number;
  brightness: number; root: number; tension: number; home: number; settle: number;
  ribbon: number; motion: number; echo: number; delay: number; tail: number;
  reverse: number; grain: number; shift: number; room: number; width: number;
  intervals: number[]; music: MusicSettings; grains: number; grainDensity: number; grainLookback: number; grainSpread: number; freeze: number;
};

export const DEFAULTS: Parameters = {
  volume: .48, activity: .36, attack: .009, decay: 3.7, material: 0,
  brightness: 3500, root: 110, tension: 0, home: .28, settle: 2.8,
  ribbon: .23, motion: .19, echo: .24, delay: .44, tail: 3.6,
  reverse: .14, grain: .38, shift: 0, room: .55, width: .72,
  music: MUSIC_DEFAULTS, grains: .15, grainDensity: 7, grainLookback: .6, grainSpread: .2, freeze: 0,
  intervals: [0, 702, 1200, 1404, 1902, 2400],
};

export type SliderKey = Exclude<keyof Parameters, 'intervals' | 'music'>;
export type SliderSpec = { key: SliderKey; label: string; min: number; max: number; step: number; unit?: string; log?: boolean; hint: string };
export const GROUPS: { name: string; subtitle: string; sliders: SliderSpec[] }[] = [
  { name: 'Body & excitation', subtitle: 'The character of each new note', sliders: [
    { key: 'attack', label: 'Softness', min: .002, max: .15, step: .001, unit: 's', hint: 'How softly a chime begins.' },
    { key: 'decay', label: 'Ring time', min: .4, max: 9, step: .1, unit: 's', hint: 'How long the resonating body sings.' },
    { key: 'material', label: 'Inharmonicity', min: 0, max: 1, step: .01, hint: 'From aligned partials to glassier, irregular overtones.' },
    { key: 'brightness', label: 'Brightness', min: 300, max: 10000, step: 10, unit: 'Hz', log: true, hint: 'The upper-frequency ceiling; changes the whole space live.' },
    { key: 'activity', label: 'Ambient activity', min: 0, max: 1, step: .01, hint: 'The frequency of irregular, related note clusters.' },
  ] },
  { name: 'Harmony & ribbon', subtitle: 'The destination and its moving resonances', sliders: [
    { key: 'root', label: 'Custom foundation', min: 45, max: 220, step: .1, unit: 'Hz', log: true, hint: 'Used only by the custom-cents editor; named systems use Key and Register above.' },
    { key: 'tension', label: 'Microtonal lean', min: 0, max: 1, step: .01, hint: 'Optional pitch bending away from the scale. Zero keeps the notes tuned.' },
    { key: 'home', label: 'Sustained layer level', min: 0, max: .65, step: .01, hint: 'Level of the optional Sustained harmony layer above. Off by default.' },
    { key: 'ribbon', label: 'Resonant ribbon', min: 0, max: 1, step: .01, hint: 'Blends in independently moving resonant filter bands.' },
    { key: 'motion', label: 'Ribbon motion', min: .01, max: .8, step: .01, unit: 'Hz', hint: 'How quickly the resonant bands move past one another.' },
    { key: 'settle', label: 'Resolution time', min: .3, max: 7, step: .1, unit: 's', hint: 'Time for the sustained voices to settle when you press Resolve.' },
  ] },
  { name: 'Wake & space', subtitle: 'What the gesture leaves behind', sliders: [
    { key: 'echo', label: 'Echo amount', min: 0, max: .8, step: .01, hint: 'The level of the repeating trail.' },
    { key: 'delay', label: 'Echo spacing', min: .12, max: 1.1, step: .01, unit: 's', hint: 'Two offset delay lengths keep the wake from marching in lockstep.' },
    { key: 'tail', label: 'Echo decay', min: .4, max: 9, step: .1, unit: 's', hint: 'How long the echoes take to dissolve.' },
    { key: 'grains', label: 'Granular cloud', min: 0, max: 1, step: .01, hint: 'Forward grains cut from recent sound, with soft overlapping edges.' },
    { key: 'grainDensity', label: 'Grains per second', min: 1, max: 30, step: 1, hint: 'From isolated flecks to a continuous cloud.' },
    { key: 'grainLookback', label: 'Grain memory', min: .1, max: 4, step: .1, unit: 's', hint: 'How far back into recent sound the grains begin.' },
    { key: 'grainSpread', label: 'Grain scatter', min: 0, max: 1, step: .01, unit: 's', hint: 'Variation in where fragments are picked from the buffer.' },
    { key: 'freeze', label: 'Freeze memory', min: 0, max: 1, step: 1, hint: 'One holds the recorded buffer; zero records new sound. Reset audio clears both.' },
    { key: 'reverse', label: 'Reverse fragments', min: 0, max: 1, step: .01, hint: 'Backwards grains drawn from the sound you just made.' },
    { key: 'grain', label: 'Fragment length', min: .08, max: .9, step: .01, unit: 's', hint: 'The duration of each softly enveloped backward fragment.' },
    { key: 'shift', label: 'Fragment pitch', min: -12, max: 12, step: .1, unit: 'st', hint: 'Transposition of the forward and reversed fragments.' },
    { key: 'room', label: 'Room amount', min: 0, max: .9, step: .01, hint: 'How much of the sound dissolves into reverberation.' },
    { key: 'width', label: 'Stereo spread', min: 0, max: 1, step: .01, hint: 'The lateral spread of notes and backward fragments.' },
  ] },
];

export const PRESETS = [
  { name: 'Submerged glass', description: 'Soft strikes · drifting overtones', color: '#90d4c5', values: { ...DEFAULTS } },
  { name: 'Ribbon memory', description: 'Filtered tones · folded-back tails', color: '#c0b1ee', values: { ...DEFAULTS, attack: .025, decay: 5.5, material: .045, ribbon: .67, motion: .13, reverse: .57, grain: .62, room: .47, activity: .24, shift: -2, echo: .17 } },
  { name: 'Open water', description: 'Sparse notes · a wide, quiet field', color: '#9fc9ec', values: { ...DEFAULTS, activity: .14, attack: .07, decay: 6.4, brightness: 2200, home: .39, room: .76, echo: .15, reverse: .1, material: .08, tension: .2 } },
  { name: 'Chromatic bloom', description: 'Denser harmony · a long luminous wake', color: '#e8b48e', values: { ...DEFAULTS, activity: .59, decay: 5, root: 82.4, intervals: [0, 386, 702, 1088, 1404, 1902], echo: .39, tail: 6.1, reverse: .29, room: .62, tension: .65, width: .94 } },
];
export const TUNINGS = [
  { name: 'Open fifths', intervals: [0, 702, 1200, 1404, 1902, 2400] },
  { name: 'Luminous ratios', intervals: [0, 386.31, 701.96, 1088.27, 1403.91, 1901.96] },
  { name: 'Seven equal steps', intervals: [0, 342.86, 685.71, 1200, 1542.86, 1885.71] },
];
export function sanitizeParameters(value: unknown): Parameters {
  const p = { ...DEFAULTS, intervals: [...DEFAULTS.intervals], music: {...MUSIC_DEFAULTS} };
  if (!value || typeof value !== 'object') return p;
  const data = value as Record<string, unknown>;
  for (const s of [...GROUPS.flatMap(g => g.sliders), { key: 'volume' as const, min: 0, max: .8 }]) {
    const v = data[s.key];
    if (typeof v === 'number' && Number.isFinite(v)) p[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  if (Array.isArray(data.intervals) && data.intervals.length === 6 && data.intervals.every(v => typeof v === 'number' && Number.isFinite(v))) {
    p.intervals = data.intervals.map(v => Math.min(3600, Math.max(-1200, v)));
  }
  p.music = sanitizeMusic(data.music);
  if (!data.music && Array.isArray(data.intervals)) p.music.source = 'custom';
  return p;
}
export function frequencies(p: Parameters, resolved: boolean) {
  const bends = [0, 115, -76, 180, -145, 85];
  const base=p.music.source==='custom'?p.intervals.map(c=>p.root*2**(c/1200)):harmonicFrame(p.music).tones.map(midiHz);
  return base.map((hz,i)=>hz*2**((resolved?0:bends[i]*p.tension)/1200));
}
