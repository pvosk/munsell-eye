import {
  DEFAULTS,
  SOUND_MODELS,
  sanitizeParameters,
  type Parameters,
} from "./parameters";
import { JOURNEY_DEFAULTS } from "./journey";
import { harmonicFrame, midiHz, motif } from "./music";
import type { Setup } from "./presets";

export const SOLO_KINDS = [
  {
    id: "glass",
    name: "Glass ribbon",
    description: "A fixed input through ringing bands and reversed fragments.",
  },
  {
    id: "convergence",
    name: "Convergence",
    description:
      "One continuous gathering curve, followed by a held destination.",
  },
  {
    id: "pop",
    name: "Release pop",
    description:
      "A short pitched pulse with an airy transient and a trailing halo.",
  },
  {
    id: "piano",
    name: "Piano tunnel",
    description: "An overlapping stream from one fixed harmonic field.",
  },
  {
    id: "harp",
    name: "Harp flourish",
    description:
      "A plucked, scale-based glissando with adjustable direction and spacing.",
  },
] as const;
export type SoloKind = (typeof SOLO_KINDS)[number]["id"];
export type SoloGesture = {
  kind: SoloKind;
  duration: number;
  hold: number;
  gap: number;
  count: number;
  octaves: number;
  direction: "up" | "down" | "arch";
  spacingCurve: number;
  loop: boolean;
  cleanLoop: boolean;
  autoRetrigger: boolean;
};
export function sanitizeSolo(value: unknown): SoloGesture {
  const v = (
    value && typeof value === "object" ? value : {}
  ) as Partial<SoloGesture>;
  const n = (x: unknown, d: number, lo: number, hi: number) =>
    typeof x === "number" && Number.isFinite(x)
      ? Math.max(lo, Math.min(hi, x))
      : d;
  return {
    kind: SOLO_KINDS.some((k) => k.id === v.kind) ? v.kind! : "glass",
    duration: n(v.duration, 3, 0.15, 12),
    hold: n(v.hold, 1.5, 0, 6),
    gap: n(v.gap, 3, 0.3, 12),
    count: Math.round(n(v.count, 6, 1, 96)),
    octaves: Math.round(n(v.octaves, 2, 1, 3)),
    direction:
      v.direction === "down" || v.direction === "arch" ? v.direction : "up",
    spacingCurve: n(v.spacingCurve, 1, 0.3, 3),
    loop: v.loop === true,
    cleanLoop: v.cleanLoop !== false,
    autoRetrigger: v.autoRetrigger !== false,
  };
}
export function soloDefault(kind: SoloKind): Setup {
  const model = SOUND_MODELS.find((m) => m.id === kind)!;
  const parameters = sanitizeParameters({
    ...DEFAULTS,
    ...model.values,
    volume: 0.42,
    music: {
      ...DEFAULTS.music,
      tonic: 2,
      octave: 3,
      progression: "still",
      mode: "lydian",
      stack: "six-nine",
      sustain: false,
      pedal: false,
      voicing: "close",
      variation: 0,
      rest: 0,
      arp: "weave",
    },
    ...(kind === "glass"
      ? {
          dry: 0.7,
          ribbon: 0.7,
          reverse: 0.2,
          grain: 0.4,
          material: 0,
          modulation: 0,
          sweepDepth: 0.35,
          sweepOffset: 0,
          echo: 0.08,
          room: 0.35,
        }
      : {}),
    ...(kind === "convergence"
      ? {
          gatherStart: 0.12,
          gatherCurve: 0.8,
          wander: 1.6,
          wanderRate: 0.15,
          spread: 0.45,
          echo: 0.03,
          music: {
            ...DEFAULTS.music,
            tonic: 2,
            octave: 2,
            mode: "ionian",
            stack: "triad",
            progression: "still",
            sustain: false,
            voicing: "close",
            destinationStep: 0,
            pedal: false,
          },
        }
      : {}),
  });
  return {
    parameters,
    journey: {
      ...JOURNEY_DEFAULTS,
      advance: "manual",
      changes: 0,
      repeat: false,
    },
    mappings: [],
    solo: sanitizeSolo({
      kind,
      duration:
        kind === "convergence"
          ? 5
          : kind === "pop"
            ? 0.6
            : kind === "harp"
              ? 1.3
              : 3,
      count:
        kind === "pop" ? 1 : kind === "glass" ? 4 : kind === "harp" ? 22 : 40,
      hold: kind === "convergence" ? 2 : 0.5,
    }),
  };
}
/** Fixed-reference scheduler. No progression clock, game capture or movement mappings. */
export function soloNotes(s: SoloGesture, p: Parameters) {
  const frame = harmonicFrame(
    { ...p.music, progression: "still", destinationStep: 0 },
    0,
  );
  const custom = p.intervals.map(
    (c) => 69 + 12 * Math.log2(p.root / 440) + c / 100,
  );
  const tones = p.music.source === "custom" ? custom : frame.tones;
  const scale = p.music.source === "custom" ? custom : frame.scale;
  const pattern = motif(
    {
      ...p.music,
      melody: "procedural",
      variation: 0,
      rest: 0,
      octaves: s.octaves,
    },
    tones,
    scale,
  );
  if (s.kind === "convergence") return [];
  const count = s.kind === "pop" ? 1 : s.count;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const position =
      s.direction === "down"
        ? 1 - t
        : s.direction === "arch"
          ? 1 - Math.abs(2 * t - 1)
          : t;
    const step = Math.round(position * (scale.length * s.octaves - 1));
    const midi =
      s.kind === "harp"
        ? scale[step % scale.length] + 12 * Math.floor(step / scale.length)
        : s.kind === "pop"
          ? frame.root
          : pattern[i % pattern.length].midi;
    return {
      time: Math.pow(t, s.spacingCurve) * s.duration,
      hz: midiHz(midi),
      strength: s.kind === "pop" ? 1 : 0.7,
      pan: count === 1 ? 0 : (t * 2 - 1) * 0.8,
    };
  });
}
