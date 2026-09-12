import {
  MUSIC_DEFAULTS,
  harmonicFrame,
  midiHz,
  sanitizeMusic,
  type MusicSettings,
} from "./music";
export type Instrument = "glass" | "piano" | "synth" | "convergence";
export type Parameters = {
  instrument: Instrument;
  filterFollow: "chord" | "manual";
  grainRoute: "parallel" | "before";
  hardness: number;
  harmonics: number;
  detune: number;
  voices: number;
  spread: number;
  converge: number;
  drive: number;
  resonance: number;
  sweepDepth: number;
  sweepOffset: number;
  sweepDirection: number;
  bandSpread: number;
  phaseSpread: number;
  modulation: number;
  filterRoot: number;
  dry: number;
  volume: number;
  activity: number;
  attack: number;
  decay: number;
  material: number;
  brightness: number;
  root: number;
  tension: number;
  home: number;
  settle: number;
  ribbon: number;
  motion: number;
  echo: number;
  delay: number;
  tail: number;
  reverse: number;
  grain: number;
  shift: number;
  room: number;
  width: number;
  intervals: number[];
  music: MusicSettings;
  grains: number;
  grainDensity: number;
  grainLookback: number;
  grainSpread: number;
  freeze: number;
};

export const DEFAULTS: Parameters = {
  instrument: "glass",
  filterFollow: "chord",
  grainRoute: "parallel",
  hardness: 0.3,
  harmonics: 0.35,
  detune: 0.06,
  voices: 6,
  spread: 0.6,
  converge: 0,
  drive: 0.25,
  resonance: 0.075,
  sweepDepth: 0.4,
  sweepOffset: 0,
  sweepDirection: 1,
  bandSpread: 1,
  phaseSpread: 1,
  modulation: 1,
  filterRoot: 220,
  dry: 1,
  volume: 0.48,
  activity: 0.36,
  attack: 0.009,
  decay: 3.7,
  material: 0,
  brightness: 3500,
  root: 110,
  tension: 0,
  home: 0.28,
  settle: 2.8,
  ribbon: 0.23,
  motion: 0.19,
  echo: 0.24,
  delay: 0.44,
  tail: 3.6,
  reverse: 0.14,
  grain: 0.38,
  shift: 0,
  room: 0.55,
  width: 0.72,
  music: MUSIC_DEFAULTS,
  grains: 0.15,
  grainDensity: 7,
  grainLookback: 0.6,
  grainSpread: 0.2,
  freeze: 0,
  intervals: [0, 702, 1200, 1404, 1902, 2400],
};

export type SliderKey = Exclude<
  keyof Parameters,
  "intervals" | "music" | "instrument" | "filterFollow" | "grainRoute"
>;
export type SliderSpec = {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  log?: boolean;
  hint: string;
};
export const GROUPS: {
  name: string;
  subtitle: string;
  sliders: SliderSpec[];
}[] = [
  {
    name: "Instrument detail",
    subtitle: "Each sound model uses its own excitation",
    sliders: [
      {
        key: "hardness",
        label: "Hammer / transient",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Attack energy in the generated piano and synth.",
      },
      {
        key: "harmonics",
        label: "Overtone body",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Upper partial strength in piano, synth and convergence.",
      },
      {
        key: "detune",
        label: "Unison drift",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Small differences between paired voices.",
      },
      {
        key: "voices",
        label: "Convergence voices",
        min: 1,
        max: 18,
        step: 1,
        hint: "Smoothly reveals more voices in the convergence model.",
      },
      {
        key: "spread",
        label: "Initial pitch spread",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "How far convergence voices begin from their harmonic destinations.",
      },
      {
        key: "converge",
        label: "Gather into harmony",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Zero is spread; one gathers every voice to the current harmony.",
      },
      {
        key: "drive",
        label: "Propulsion body",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Level of the continuous shot body, separate from arpeggiated notes.",
      },
    ],
  },
  {
    name: "Ribbon workbench",
    subtitle: "A separate, explicitly tuned resonator path",
    sliders: [
      {
        key: "filterRoot",
        label: "Manual filter anchor",
        min: 55,
        max: 880,
        step: 1,
        unit: "Hz",
        log: true,
        hint: "Used when filter tuning is Manual. Does not change musical tuning.",
      },
      {
        key: "resonance",
        label: "Filter bandwidth (RQ)",
        min: 0.015,
        max: 0.5,
        step: 0.005,
        hint: "Lower values produce narrower resonant bands.",
      },
      {
        key: "bandSpread",
        label: "Band spacing",
        min: 0.25,
        max: 2,
        step: 0.01,
        hint: "Spreads the independently moving filter bands.",
      },
      {
        key: "sweepDepth",
        label: "Sweep depth",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Range of the moving resonances.",
      },
      {
        key: "sweepOffset",
        label: "Sweep position",
        min: -1,
        max: 1,
        step: 0.01,
        hint: "Static offset; can also be modulated by the shot.",
      },
      {
        key: "sweepDirection",
        label: "Sweep direction",
        min: -1,
        max: 1,
        step: 2,
        hint: "Forward or reversed oscillator direction.",
      },
      {
        key: "phaseSpread",
        label: "Band phase spread",
        min: 0,
        max: 2,
        step: 0.01,
        hint: "Together at zero; progressively offset above zero.",
      },
      {
        key: "modulation",
        label: "Free sweep movement",
        min: 0,
        max: 1,
        step: 1,
        hint: "Pause the sweep oscillators without changing their tuning.",
      },
      {
        key: "dry",
        label: "Direct source level",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Turn down to isolate the processed ribbon and grains.",
      },
    ],
  },
  {
    name: "Body & excitation",
    subtitle: "The character of each new note",
    sliders: [
      {
        key: "attack",
        label: "Softness",
        min: 0.002,
        max: 0.15,
        step: 0.001,
        unit: "s",
        hint: "How softly a chime begins.",
      },
      {
        key: "decay",
        label: "Ring time",
        min: 0.4,
        max: 9,
        step: 0.1,
        unit: "s",
        hint: "How long the resonating body sings.",
      },
      {
        key: "material",
        label: "Inharmonicity",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "From aligned partials to glassier, irregular overtones.",
      },
      {
        key: "brightness",
        label: "Brightness",
        min: 300,
        max: 10000,
        step: 10,
        unit: "Hz",
        log: true,
        hint: "The upper-frequency ceiling; changes the whole space live.",
      },
      {
        key: "activity",
        label: "Ambient activity",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "The frequency of irregular, related note clusters.",
      },
    ],
  },
  {
    name: "Harmony & ribbon",
    subtitle: "The destination and its moving resonances",
    sliders: [
      {
        key: "root",
        label: "Custom foundation",
        min: 45,
        max: 220,
        step: 0.1,
        unit: "Hz",
        log: true,
        hint: "Musical foundation for custom cents. Select Custom tuning explicitly in Journey.",
      },
      {
        key: "tension",
        label: "Microtonal lean",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Optional pitch bending away from the scale. Zero keeps the notes tuned.",
      },
      {
        key: "home",
        label: "Sustained layer level",
        min: 0,
        max: 0.65,
        step: 0.01,
        hint: "Level of the optional Sustained harmony layer above. Off by default.",
      },
      {
        key: "ribbon",
        label: "Resonant ribbon",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Blends in independently moving resonant filter bands.",
      },
      {
        key: "motion",
        label: "Ribbon motion",
        min: 0.01,
        max: 0.8,
        step: 0.01,
        unit: "Hz",
        hint: "How quickly the resonant bands move past one another.",
      },
      {
        key: "settle",
        label: "Resolution time",
        min: 0.3,
        max: 7,
        step: 0.1,
        unit: "s",
        hint: "Time for the sustained voices to settle when you press Resolve.",
      },
    ],
  },
  {
    name: "Wake & space",
    subtitle: "What the gesture leaves behind",
    sliders: [
      {
        key: "echo",
        label: "Echo amount",
        min: 0,
        max: 0.8,
        step: 0.01,
        hint: "The level of the repeating trail.",
      },
      {
        key: "delay",
        label: "Echo spacing",
        min: 0.12,
        max: 1.1,
        step: 0.01,
        unit: "s",
        hint: "Two offset delay lengths keep the wake from marching in lockstep.",
      },
      {
        key: "tail",
        label: "Echo decay",
        min: 0.4,
        max: 9,
        step: 0.1,
        unit: "s",
        hint: "How long the echoes take to dissolve.",
      },
      {
        key: "grains",
        label: "Granular cloud",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Forward grains cut from recent sound, with soft overlapping edges.",
      },
      {
        key: "grainDensity",
        label: "Grains per second",
        min: 1,
        max: 30,
        step: 1,
        hint: "From isolated flecks to a continuous cloud.",
      },
      {
        key: "grainLookback",
        label: "Grain memory",
        min: 0.1,
        max: 4,
        step: 0.1,
        unit: "s",
        hint: "How far back into recent sound the grains begin.",
      },
      {
        key: "grainSpread",
        label: "Grain scatter",
        min: 0,
        max: 1,
        step: 0.01,
        unit: "s",
        hint: "Variation in where fragments are picked from the buffer.",
      },
      {
        key: "freeze",
        label: "Freeze memory",
        min: 0,
        max: 1,
        step: 1,
        hint: "One holds the recorded buffer; zero records new sound. Reset audio clears both.",
      },
      {
        key: "reverse",
        label: "Reverse fragments",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Backwards grains drawn from the sound you just made.",
      },
      {
        key: "grain",
        label: "Fragment length",
        min: 0.08,
        max: 0.9,
        step: 0.01,
        unit: "s",
        hint: "The duration of each softly enveloped backward fragment.",
      },
      {
        key: "shift",
        label: "Fragment pitch",
        min: -12,
        max: 12,
        step: 0.1,
        unit: "st",
        hint: "Transposition of the forward and reversed fragments.",
      },
      {
        key: "room",
        label: "Room amount",
        min: 0,
        max: 0.9,
        step: 0.01,
        hint: "How much of the sound dissolves into reverberation.",
      },
      {
        key: "width",
        label: "Stereo spread",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "The lateral spread of notes and backward fragments.",
      },
    ],
  },
];

export const PRESETS = [
  {
    name: "Submerged glass",
    description: "Soft strikes · drifting overtones",
    color: "#90d4c5",
    values: { ...DEFAULTS },
  },
  {
    name: "Ribbon memory",
    description: "Filtered tones · folded-back tails",
    color: "#c0b1ee",
    values: {
      ...DEFAULTS,
      attack: 0.025,
      decay: 5.5,
      material: 0.045,
      ribbon: 0.67,
      motion: 0.13,
      reverse: 0.57,
      grain: 0.62,
      room: 0.47,
      activity: 0.24,
      shift: -2,
      echo: 0.17,
    },
  },
  {
    name: "Open water",
    description: "Sparse notes · a wide, quiet field",
    color: "#9fc9ec",
    values: {
      ...DEFAULTS,
      activity: 0.14,
      attack: 0.07,
      decay: 6.4,
      brightness: 2200,
      home: 0.39,
      room: 0.76,
      echo: 0.15,
      reverse: 0.1,
      material: 0.08,
      tension: 0.2,
    },
  },
  {
    name: "Chromatic bloom",
    description: "Denser harmony · a long luminous wake",
    color: "#e8b48e",
    values: {
      ...DEFAULTS,
      activity: 0.59,
      decay: 5,
      root: 82.4,
      intervals: [0, 386, 702, 1088, 1404, 1902],
      echo: 0.39,
      tail: 6.1,
      reverse: 0.29,
      room: 0.62,
      tension: 0.65,
      width: 0.94,
    },
  },
];
export const TUNINGS = [
  { name: "Open fifths", intervals: [0, 702, 1200, 1404, 1902, 2400] },
  {
    name: "Luminous ratios",
    intervals: [0, 386.31, 701.96, 1088.27, 1403.91, 1901.96],
  },
  {
    name: "Seven equal steps",
    intervals: [0, 342.86, 685.71, 1200, 1542.86, 1885.71],
  },
];
export function sanitizeParameters(value: unknown): Parameters {
  const p = {
    ...DEFAULTS,
    intervals: [...DEFAULTS.intervals],
    music: { ...MUSIC_DEFAULTS },
  };
  if (!value || typeof value !== "object") return p;
  const data = value as Record<string, unknown>;
  for (const s of [
    ...GROUPS.flatMap((g) => g.sliders),
    { key: "volume" as const, min: 0, max: 0.8 },
  ]) {
    const v = data[s.key];
    if (typeof v === "number" && Number.isFinite(v))
      p[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  if (
    Array.isArray(data.intervals) &&
    data.intervals.length === 6 &&
    data.intervals.every((v) => typeof v === "number" && Number.isFinite(v))
  ) {
    p.intervals = data.intervals.map((v) => Math.min(3600, Math.max(-1200, v)));
  }
  if (
    ["glass", "piano", "synth", "convergence"].includes(String(data.instrument))
  )
    p.instrument = data.instrument as Instrument;
  p.filterFollow = data.filterFollow === "manual" ? "manual" : "chord";
  p.grainRoute = data.grainRoute === "before" ? "before" : "parallel";
  p.music = sanitizeMusic(data.music);
  if (!data.music && Array.isArray(data.intervals)) p.music.source = "custom";
  return p;
}
export function frequencies(p: Parameters, resolved: boolean) {
  const bends = [0, 115, -76, 180, -145, 85];
  const base =
    p.music.source === "custom"
      ? p.intervals.map((c) => p.root * 2 ** (c / 1200))
      : harmonicFrame(p.music).tones.map(midiHz);
  return base.map(
    (hz, i) => hz * 2 ** ((resolved ? 0 : bends[i] * p.tension) / 1200),
  );
}

export const SOUND_MODELS: {
  id: Instrument;
  name: string;
  description: string;
  values: Partial<Parameters>;
}[] = [
  {
    id: "piano",
    name: "Piano tunnel",
    description: "Generated struck strings · overlapping tonal ripples",
    values: {
      instrument: "piano",
      attack: 0.004,
      decay: 4.8,
      hardness: 0.42,
      harmonics: 0.3,
      detune: 0.09,
      drive: 0.12,
      ribbon: 0.12,
      reverse: 0.05,
      grains: 0.08,
      echo: 0.23,
      room: 0.42,
      tension: 0,
    },
  },
  {
    id: "convergence",
    name: "Chromatic convergence",
    description: "A growing stack of voices gathering into harmony",
    values: {
      instrument: "convergence",
      attack: 0.04,
      decay: 3,
      voices: 4,
      spread: 0.8,
      converge: 0,
      drive: 0.55,
      harmonics: 0.45,
      detune: 0.15,
      ribbon: 0.08,
      reverse: 0,
      grains: 0.05,
      echo: 0.16,
      room: 0.48,
      tension: 0,
    },
  },
  {
    id: "glass",
    name: "Glass ribbon",
    description: "Ringing partials · moving bands · reversed halo",
    values: {
      instrument: "glass",
      attack: 0.025,
      decay: 4.8,
      ribbon: 0.65,
      sweepDepth: 0.55,
      phaseSpread: 1.3,
      resonance: 0.045,
      reverse: 0.3,
      grains: 0.12,
      echo: 0.16,
      room: 0.48,
      drive: 0.18,
      tension: 0,
    },
  },
  {
    id: "synth",
    name: "Soft synth",
    description: "A rounded synthetic source for clear comparisons",
    values: {
      instrument: "synth",
      attack: 0.06,
      decay: 2.5,
      harmonics: 0.25,
      detune: 0.04,
      ribbon: 0.15,
      reverse: 0,
      grains: 0,
      echo: 0.2,
      room: 0.35,
      drive: 0.25,
      tension: 0,
    },
  },
];
