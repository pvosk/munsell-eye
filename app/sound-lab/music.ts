export const KEYS = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
export const MODES = [
  {
    id: "ionian",
    name: "Ionian / major",
    notes: [0, 2, 4, 5, 7, 9, 11],
    feel: "Clear, open major color.",
  },
  {
    id: "lydian",
    name: "Lydian",
    notes: [0, 2, 4, 6, 7, 9, 11],
    feel: "Major with a raised fourth: bright suspension.",
  },
  {
    id: "dorian",
    name: "Dorian",
    notes: [0, 2, 3, 5, 7, 9, 10],
    feel: "Minor with a warm major sixth.",
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    notes: [0, 2, 4, 5, 7, 9, 10],
    feel: "Major with a softened seventh.",
  },
  {
    id: "aeolian",
    name: "Aeolian / natural minor",
    notes: [0, 2, 3, 5, 7, 8, 10],
    feel: "A darker, familiar minor field.",
  },
  {
    id: "phrygian",
    name: "Phrygian",
    notes: [0, 1, 3, 5, 7, 8, 10],
    feel: "Close second against the root; deliberate friction.",
  },
  {
    id: "locrian",
    name: "Locrian",
    notes: [0, 1, 3, 5, 6, 8, 10],
    feel: "Unstable diminished fifth; an experimental edge.",
  },
  {
    id: "major-pent",
    name: "Major pentatonic",
    notes: [0, 2, 4, 7, 9],
    feel: "Five spacious notes, fewer close clashes.",
  },
  {
    id: "minor-pent",
    name: "Minor pentatonic",
    notes: [0, 3, 5, 7, 10],
    feel: "Five grounded notes with open gaps.",
  },
  {
    id: "suspended-pent",
    name: "Suspended pentatonic",
    notes: [0, 2, 5, 7, 10],
    feel: "No third: an open, suspended center.",
  },
  {
    id: "whole-tone",
    name: "Whole tone",
    notes: [0, 2, 4, 6, 8, 10],
    feel: "Evenly spaced, floating, without a strong center.",
  },
  {
    id: "harmonic-minor",
    name: "Harmonic minor",
    notes: [0, 2, 3, 5, 7, 8, 11],
    feel: "Minor with a strong leading tone.",
  },
  {
    id: "melodic-minor",
    name: "Melodic minor",
    notes: [0, 2, 3, 5, 7, 9, 11],
    feel: "Minor with a luminous upper half.",
  },
  {
    id: "lydian-dominant",
    name: "Lydian dominant",
    notes: [0, 2, 4, 6, 7, 9, 10],
    feel: "Raised fourth and lowered seventh.",
  },
  {
    id: "octatonic",
    name: "Octatonic / half–whole",
    notes: [0, 1, 3, 4, 6, 7, 9, 10],
    feel: "Alternating close and wide steps; rich tension.",
  },
  {
    id: "seven-equal",
    name: "Seven equal divisions",
    notes: Array.from({ length: 7 }, (_, i) => (i * 12) / 7),
    feel: "An alternative tuning: seven equal steps per octave.",
  },
];
export const STACKS = [
  {
    id: "triad",
    name: "Spread triad",
    degrees: (n: number) => [0, 2, 4, n, n + 2, n + 4],
  },
  {
    id: "seventh",
    name: "Seventh",
    degrees: (n: number) => [0, 2, 4, 6, n + 2, n + 4],
  },
  {
    id: "ninth",
    name: "Ninth",
    degrees: (n: number) => [0, 2, 4, 6, n + 1, n + 4],
  },
  {
    id: "eleventh",
    name: "Eleventh",
    degrees: (n: number) => [0, 2, 4, 6, n + 1, n + 3],
  },
  {
    id: "thirteenth",
    name: "Thirteenth",
    degrees: (n: number) => [0, 2, 4, 6, n + 1, n + 5],
  },
  {
    id: "sus2",
    name: "Suspended second",
    degrees: (n: number) => [0, 1, 4, n, n + 1, n + 4],
  },
  {
    id: "sus4",
    name: "Suspended fourth",
    degrees: (n: number) => [0, 3, 4, n, n + 3, n + 4],
  },
  {
    id: "quartal",
    name: "Stacked fourths",
    degrees: () => [0, 3, 6, 9, 12, 15],
  },
  {
    id: "quintal",
    name: "Stacked fifths",
    degrees: () => [0, 4, 8, 12, 16, 20],
  },
  {
    id: "cluster",
    name: "Open cluster",
    degrees: (n: number) => [0, 1, 2, n + 3, n + 4, n + 5],
  },
  {
    id: "six-nine",
    name: "Six / nine",
    degrees: (n: number) => [0, 2, 4, 5, n + 1, n + 4],
  },
  {
    id: "shell",
    name: "Sparse shell",
    degrees: (n: number) => [0, 4, 6, n, n + 4, n + 6],
  },
];
export const ARPS = [
  ["ripple", "Ripple"],
  ["up", "Ascending"],
  ["down", "Descending"],
  ["pendulum", "Up & down"],
  ["inward", "Outside → inside"],
  ["outward", "Inside → outside"],
  ["skip", "Skipping thirds"],
  ["anchor", "Anchor & answer"],
  ["weave", "Interwoven"],
  ["walk", "Seeded wandering"],
  ["chord", "Slow chord bloom"],
] as const;
export const PROGRESSIONS = [
  { id: "still", name: "Stay on one harmony", degrees: [0], fifths: 0 },
  {
    id: "neighbors",
    name: "Neighboring colors · 1–2–1–4",
    degrees: [0, 1, 0, 3],
    fifths: 0,
  },
  {
    id: "modal",
    name: "Modal drift · 1–4–2–1",
    degrees: [0, 3, 1, 0],
    fifths: 0,
  },
  {
    id: "thirds",
    name: "Drift through thirds · 1–3–6–4",
    degrees: [0, 2, 5, 3],
    fifths: 0,
  },
  {
    id: "descending",
    name: "Descending steps · 1–7–6–4",
    degrees: [0, 6, 5, 3],
    fifths: 0,
  },
  {
    id: "jazz",
    name: "Optional cadence · 2–5–1–1",
    degrees: [1, 4, 0, 0],
    fifths: 0,
  },
  {
    id: "fifths",
    name: "Circle of fifths · clockwise",
    degrees: [0],
    fifths: 1,
  },
  {
    id: "fourths",
    name: "Circle of fifths · counterclockwise",
    degrees: [0],
    fifths: -1,
  },
];
export type MusicSettings = {
  tonic: number;
  octave: number;
  mode: string;
  stack: string;
  arp: string;
  progression: string;
  bpm: number;
  spacing: number;
  rest: number;
  octaves: number;
  repeats: number;
  variation: number;
  seed: number;
  pool: "chord" | "scale";
  voicing: "close" | "spread" | "smooth";
  pedal: boolean;
  sustain: boolean;
  source: "system" | "custom";
  melody: "procedural" | "grid";
  melodySteps: (number | null)[];
  melodyLength: number;
  offspring: number;
  melodyFollow: boolean;
};
export const MUSIC_DEFAULTS: MusicSettings = {
  tonic: 8,
  octave: 2,
  mode: "lydian",
  stack: "ninth",
  arp: "ripple",
  progression: "still",
  bpm: 54,
  spacing: 0.5,
  rest: 3,
  octaves: 2,
  repeats: 4,
  variation: 0.08,
  seed: 7139,
  pool: "chord",
  voicing: "spread",
  pedal: true,
  sustain: false,
  source: "system",
  melody: "procedural",
  melodySteps: [0, 2, 4, null, 3, 2, 1, null, 0, 4, 6, null, 5, 3, 1, null],
  melodyLength: 8,
  offspring: 0,
  melodyFollow: false,
};
export const MUSIC_PRESETS = [
  {
    name: "Hanging light",
    detail: "Lydian ninth · repeating ripple",
    settings: { ...MUSIC_DEFAULTS },
  },
  {
    name: "Dorian water",
    detail: "Fourth stacks · slow modal drift",
    settings: {
      ...MUSIC_DEFAULTS,
      tonic: 2,
      mode: "dorian",
      stack: "quartal",
      arp: "weave",
      progression: "modal",
      bpm: 44,
      rest: 4,
    },
  },
  {
    name: "Open suspension",
    detail: "Pentatonic · anchor and answer",
    settings: {
      ...MUSIC_DEFAULTS,
      tonic: 0,
      mode: "suspended-pent",
      stack: "triad",
      arp: "anchor",
      octaves: 1,
    },
  },
  {
    name: "Fifth islands",
    detail: "Sparse shells · gentle key changes",
    settings: {
      ...MUSIC_DEFAULTS,
      mode: "ionian",
      stack: "shell",
      progression: "fifths",
      arp: "pendulum",
      repeats: 3,
      pedal: false,
      voicing: "smooth" as const,
    },
  },
  {
    name: "Minor lantern",
    detail: "Minor pentatonic · wandering notes",
    settings: {
      ...MUSIC_DEFAULTS,
      tonic: 9,
      mode: "minor-pent",
      stack: "six-nine",
      arp: "walk",
      rest: 5,
      variation: 0.25,
    },
  },
  {
    name: "Seven-step sea",
    detail: "Alternative tuning · expanding bloom",
    settings: {
      ...MUSIC_DEFAULTS,
      mode: "seven-equal",
      stack: "quintal",
      arp: "chord",
      octaves: 1,
      rest: 6,
    },
  },
];
const mod = (v: number, n: number) => ((v % n) + n) % n;
export function sanitizeMusic(value: unknown): MusicSettings {
  const m = { ...MUSIC_DEFAULTS };
  if (!value || typeof value !== "object") return m;
  const v = value as Record<string, unknown>;
  const limits = {
    tonic: [0, 11],
    octave: [1, 4],
    bpm: [24, 140],
    spacing: [0.25, 2],
    rest: [0, 12],
    octaves: [1, 3],
    repeats: [1, 16],
    variation: [0, 0.8],
    seed: [1, 999999],
  };
  for (const [key, [lo, hi]] of Object.entries(limits)) {
    const x = v[key];
    if (typeof x === "number" && Number.isFinite(x))
      (m as unknown as Record<string, unknown>)[key] = Math.min(
        hi,
        Math.max(lo, x),
      );
  }
  for (const key of ["tonic", "octave", "octaves", "repeats", "seed"] as const)
    m[key] = Math.round(m[key]);
  const choices = {
    mode: MODES.map((x) => x.id),
    stack: STACKS.map((x) => x.id),
    arp: ARPS.map((x) => x[0]),
    progression: PROGRESSIONS.map((x) => x.id),
    pool: ["chord", "scale"],
    voicing: ["close", "spread", "smooth"],
    source: ["system", "custom"],
  };
  for (const [key, options] of Object.entries(choices))
    if (typeof v[key] === "string" && options.includes(v[key] as never))
      (m as unknown as Record<string, unknown>)[key] = v[key];
  for (const key of ["pedal", "sustain"] as const)
    if (typeof v[key] === "boolean") m[key] = v[key];
  m.melody = v.melody === "grid" ? "grid" : "procedural";
  m.melodyLength = v.melodyLength === 16 ? 16 : 8;
  m.offspring =
    typeof v.offspring === "number" && Number.isFinite(v.offspring)
      ? Math.round(Math.max(0, Math.min(3, v.offspring)))
      : 0;
  m.melodyFollow = v.melodyFollow === true;
  m.melodySteps = Array.from({ length: 16 }, (_, i) => {
    if (!Array.isArray(v.melodySteps)) return MUSIC_DEFAULTS.melodySteps[i];
    const n = v.melodySteps[i];
    return typeof n === "number" && Number.isFinite(n)
      ? Math.round(Math.max(0, Math.min(14, n)))
      : null;
  });
  return m;
}
export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export function noteName(midi: number) {
  const nearest = Math.round(midi),
    cents = Math.round((midi - nearest) * 100);
  return `${KEYS[mod(nearest, 12)]}${Math.floor(nearest / 12) - 1}${cents ? ` ${cents > 0 ? "+" : ""}${cents}¢` : ""}`;
}
export function scaleDegree(notes: number[], degree: number) {
  return (
    notes[mod(degree, notes.length)] + 12 * Math.floor(degree / notes.length)
  );
}
export function harmonicFrame(m: MusicSettings, step = 0) {
  const mode = MODES.find((x) => x.id === m.mode)!;
  const progression = PROGRESSIONS.find((x) => x.id === m.progression)!;
  const tonic = mod(
    m.tonic + (progression.fifths ? step * 7 * progression.fifths : 0),
    12,
  );
  const root = tonic + 12 * (m.octave + 1),
    degree =
      progression.degrees[mod(step, progression.degrees.length)] %
      mode.notes.length;
  let tones = STACKS.find((x) => x.id === m.stack)!
    .degrees(mode.notes.length)
    .map((d) => root + scaleDegree(mode.notes, d + degree));
  if (m.voicing === "close") {
    const bass = tones[0];
    tones = tones.map((x) => bass + mod(x - bass, 12)).sort((a, b) => a - b);
  }
  if (m.voicing === "spread")
    tones = tones
      .map((x, i) => x + (i % 2 === 1 ? 12 : 0))
      .sort((a, b) => a - b);
  if (m.pedal) tones[0] = m.tonic + 12 * (m.octave + 1);
  return {
    tones,
    root,
    tonic,
    degree,
    mode,
    scale: mode.notes.map((x) => root + x),
    label: `${KEYS[tonic]} ${mode.name} · degree ${degree + 1}`,
  };
}
/** Preserve pitch classes and voice order while minimizing jumps between harmonies. */
export function leadVoices(next: number[], previous: number[]) {
  const result: number[] = [];
  for (let i = 0; i < next.length; i++) {
    const choices = [-24, -12, 0, 12, 24]
      .map((o) => next[i] + o)
      .filter((x) => x >= 24 && x <= 100 && (i === 0 || x >= result[i - 1]));
    result.push(
      choices.sort(
        (a, b) =>
          Math.abs(a - (previous[i] ?? next[i])) -
          Math.abs(b - (previous[i] ?? next[i])),
      )[0] ?? next[i],
    );
  }
  return result;
}
/** A custom cents stack may span octaves; grid rows use its ordered pitch classes. */
export function melodyPitchSet(scale: number[]) {
  const root = scale[0];
  const intervals = [
    ...new Set(scale.map((n) => Math.round(mod(n - root, 12) * 1e8) / 1e8)),
  ].sort((a, b) => a - b);
  return { root, intervals };
}
export function motif(
  m: MusicSettings,
  tones: number[],
  scale: number[],
  phrase = 0,
  harmonyDegree = 0,
): {
  midi: number;
  beat: number;
  strength: number;
  skip: boolean;
  pan: number;
}[] {
  if (m.melody === "grid") {
    const { root, intervals } = melodyPitchSet(scale);
    return m.melodySteps.slice(0, m.melodyLength).flatMap((degree, i) => {
      const anchor =
        root +
        scaleDegree(
          intervals,
          (degree ?? 0) + (m.melodyFollow ? harmonyDegree : 0),
        );
      const localScale = intervals.map(
        (_, j) =>
          root +
          scaleDegree(
            intervals,
            (degree ?? 0) + (m.melodyFollow ? harmonyDegree : 0) + j,
          ),
      );
      const localTones = STACKS.find((x) => x.id === m.stack)!
        .degrees(intervals.length)
        .map(
          (d) =>
            root +
            scaleDegree(
              intervals,
              (degree ?? 0) + (m.melodyFollow ? harmonyDegree : 0) + d,
            ),
        );
      const branches = motif(
        { ...m, melody: "procedural" },
        localTones,
        localScale,
        phrase + i,
      );
      return Array.from({ length: m.offspring + 1 }, (_, j) => ({
        midi: j === 0 ? anchor : branches[j % branches.length].midi,
        beat: (i + j / (m.offspring + 1)) * m.spacing,
        strength:
          j === 0 ? 0.72 : branches[j % branches.length].strength * 0.65,
        skip: degree === null || (j > 0 && branches[j % branches.length].skip),
        pan: j === 0 ? 0 : branches[j % branches.length].pan,
      }));
    });
  }
  let state = (m.seed + phrase * 7919) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const source = m.pool === "scale" ? scale : tones;
  const pool = [
    ...new Set(
      Array.from({ length: m.octaves }, (_, o) =>
        source.map((n) => n + 12 * o),
      ).flat(),
    ),
  ].sort((a, b) => a - b);
  const n = pool.length;
  const patterns: Record<string, number[]> = {
    up: Array.from({ length: n }, (_, i) => i),
    down: Array.from({ length: n }, (_, i) => n - 1 - i),
    pendulum: [
      ...Array.from({ length: n }, (_, i) => i),
      ...Array.from({ length: Math.max(0, n - 2) }, (_, i) => n - 2 - i),
    ],
    ripple: [0, 2, 1, 4, 3, 5, 2, 4],
    inward: Array.from({ length: n }, (_, i) =>
      i % 2 ? n - 1 - Math.floor(i / 2) : i / 2,
    ),
    outward: Array.from(
      { length: n },
      (_, i) =>
        Math.floor(n / 2) + (i % 2 ? Math.ceil(i / 2) : -Math.ceil(i / 2)),
    ),
    skip: Array.from({ length: n }, (_, i) => i * 2),
    anchor: [0, 2, 0, 4, 0, 3, 0, 5],
    weave: [0, 3, 1, 4, 2, 5, 1, 3],
    chord: Array.from({ length: n }, (_, i) => i),
  };
  let walk = 0;
  const indices =
    m.arp === "walk"
      ? Array.from({ length: 10 }, () => {
          walk = mod(walk + (random() < 0.5 ? -1 : 1), n);
          return walk;
        })
      : (patterns[m.arp] ?? patterns.ripple);
  return indices.slice(0, 24).map((index, i) => ({
    midi: pool[mod(index, n)],
    beat: i * m.spacing * (m.arp === "chord" ? 0.2 : 1),
    strength: 0.6 * (1 - m.variation * random()),
    skip: i > 0 && random() < m.variation * 0.45,
    pan: Math.sin(i * 0.83) * 0.8,
  }));
}
