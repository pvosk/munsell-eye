import {
  DEFAULTS,
  SOUND_MODELS,
  sanitizeParameters,
  type Parameters,
} from "./parameters";
import {
  JOURNEY_DEFAULTS,
  DEFAULT_MAPPINGS,
  sanitizeJourney,
  sanitizeMappings,
  type Journey,
  type Mapping,
} from "./journey";
export type Setup = {
  parameters: Parameters;
  journey: Journey;
  mappings: Mapping[];
};
export type Scope = "all" | "journey" | "sound" | "mapping";
export type Preset = {
  id: string;
  name: string;
  notes: string;
  scope: Scope;
  updatedAt: string;
  setup: Setup;
};
export const DEFAULT_SETUP: Setup = {
  parameters: DEFAULTS,
  journey: JOURNEY_DEFAULTS,
  mappings: DEFAULT_MAPPINGS,
};
export function sanitizeSetup(value: unknown): Setup {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Setup>;
  return {
    parameters: sanitizeParameters(v.parameters),
    journey: sanitizeJourney(v.journey),
    mappings: sanitizeMappings(v.mappings),
  };
}
export function applyPreset(current: Setup, preset: Preset): Setup {
  const p = preset.setup;
  switch (preset.scope) {
    case "journey":
      return sanitizeSetup({
        ...current,
        journey: p.journey,
        parameters: {
          ...current.parameters,
          glideTime: p.parameters.glideTime,
          glideStart: p.parameters.glideStart,
          glideCurve: p.parameters.glideCurve,
          music: p.parameters.music,
          root: p.parameters.root,
          intervals: p.parameters.intervals,
        },
      });
    case "sound":
      return sanitizeSetup({
        ...current,
        parameters: {
          ...p.parameters,
          volume: current.parameters.volume,
          glideTime: current.parameters.glideTime,
          glideStart: current.parameters.glideStart,
          glideCurve: current.parameters.glideCurve,
          music: current.parameters.music,
          root: current.parameters.root,
          intervals: current.parameters.intervals,
        },
      });
    case "mapping":
      return sanitizeSetup({ ...current, mappings: p.mappings });
    default:
      return sanitizeSetup(p);
  }
}
export function validPreset(v: unknown): v is Preset {
  if (!v || typeof v !== "object") return false;
  const p = v as Preset;
  return (
    typeof p.id === "string" &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(p.id) &&
    typeof p.name === "string" &&
    p.name.length > 0 &&
    p.name.length <= 80 &&
    typeof p.notes === "string" &&
    p.notes.length <= 2000 &&
    ["all", "journey", "sound", "mapping"].includes(p.scope) &&
    typeof p.updatedAt === "string" &&
    Number.isFinite(Date.parse(p.updatedAt)) &&
    !!p.setup &&
    typeof p.setup === "object" &&
    !!p.setup.parameters
  );
}
export function normalizePreset(v: Preset): Preset {
  return {
    id: v.id,
    name: v.name,
    notes: v.notes,
    scope: v.scope,
    updatedAt: v.updatedAt,
    setup: sanitizeSetup(v.setup),
  };
}
export function readLibrary(value: unknown): Preset[] {
  const v = value as {
    format?: string;
    version?: number;
    presets?: unknown[];
    parameters?: unknown;
    name?: string;
  };
  if (v?.version === 1 && v.parameters)
    return [
      {
        id: crypto.randomUUID(),
        name:
          typeof v.name === "string"
            ? v.name.slice(0, 80)
            : "Imported legacy sound",
        notes: "Imported from the original sound lab.",
        scope: "all",
        updatedAt: new Date().toISOString(),
        setup: sanitizeSetup({ parameters: v.parameters }),
      },
    ];
  if (
    v?.format !== "chroma-sound-library" ||
    v.version !== 2 ||
    !Array.isArray(v.presets) ||
    v.presets.length > 100 ||
    !v.presets.every(validPreset)
  )
    throw new Error(
      "Choose a Chroma sound library JSON file (up to 100 presets).",
    );
  return v.presets.map(normalizePreset);
}
export const exportLibrary = (presets: Preset[]) =>
  JSON.stringify(
    { format: "chroma-sound-library", version: 2, presets },
    null,
    2,
  );
export const STARTERS: Preset[] = SOUND_MODELS.slice(0, 3).map((model, i) => ({
  id: `starter-${model.id}`,
  name: model.name,
  notes: model.description,
  scope: "all",
  updatedAt: "2026-09-12T00:00:00Z",
  setup: sanitizeSetup({
    parameters: {
      ...DEFAULTS,
      ...model.values,
      music: {
        ...DEFAULTS.music,
        stack: i === 1 ? "triad" : DEFAULTS.music.stack,
        arp: i === 0 ? "weave" : "ripple",
        spacing: i === 0 ? 0.25 : 0.5,
        rest: 0,
        octaves: i === 0 ? 3 : 2,
        progression: i === 0 ? "modal" : "still",
      },
    },
    journey: {
      ...JOURNEY_DEFAULTS,
      density: i === 0 ? 18 : i === 2 ? 3 : 6,
      duration: i === 1 ? 5 : 2.8,
      probe:
        i === 1
          ? {
              ...JOURNEY_DEFAULTS.probe,
              hue: 320,
              hueTravel: 170,
              edge: 0.95,
              edgeEnd: 0.95,
              bow: 0,
            }
          : JOURNEY_DEFAULTS.probe,
    },
    mappings: i === 1 ? [] : DEFAULT_MAPPINGS,
  }),
}));

STARTERS.push({
  id: "starter-vocal",
  name: "Vocal glide",
  notes:
    "An oo-to-ah shot body, rising five semitones toward the current harmony, with soft synth arpeggios.",
  scope: "all",
  updatedAt: "2026-09-12T00:00:00Z",
  setup: sanitizeSetup({
    parameters: {
      ...DEFAULTS,
      ...SOUND_MODELS.find((m) => m.id === "vocal")!.values,
    },
    journey: { ...JOURNEY_DEFAULTS, duration: 4, density: 4 },
    mappings: [
      {
        id: "vowel-open",
        enabled: true,
        source: "progress",
        target: "vowel",
        low: 0.1,
        high: 0.85,
        curve: "ease",
        smooth: 0.2,
      },
    ],
  }),
});

/** Audition hypotheses from the engine handoff's route styles and sonic addendum. */
export const MAPPING_STUDIES: Preset[] = [
  {
    id: "close-glass",
    name: "Close putt · glass breath",
    model: "glass",
    notes:
      "Small correction: a few glass notes and a restrained ribbon sweep. Based on the sonic addendum’s close-putt gesture.",
    probe: {
      hue: 270,
      hueTravel: 12,
      lightness: 0.65,
      lift: 0.025,
      edge: 0.25,
      edgeEnd: 0.3,
      bow: 0,
    },
    duration: 1.6,
    advance: "manual",
    mappings: [
      ["progress", "sweepOffset", -0.2, 0.2],
      ["envelope", "density", 1, 3],
      ["envelope", "ribbon", 0.35, 0.7],
    ],
  },
  {
    id: "edge-cloud",
    name: "Boundary run · growing cloud",
    model: "convergence",
    notes:
      "Accumulated boundary travel grows 6→18 voices. sRGB boundary audition, not a certified palette hull or ride test.",
    probe: {
      hue: 300,
      hueTravel: 170,
      lightness: 0.6,
      lift: 0.05,
      edge: 0.96,
      edgeEnd: 0.96,
      bow: 0,
    },
    duration: 5,
    advance: "manual",
    mappings: [
      ["edgeRun", "voices", 6, 18],
      ["chroma", "wander", 0.5, 4],
      ["progress", "width", 0.4, 1],
    ],
  },
  {
    id: "value-up",
    name: "Value lift · opening space",
    model: "glass",
    notes:
      "A value-led episode opens filtering and space without forcing an octave rise. Inspired by value-shift routes.",
    probe: {
      hue: 220,
      hueTravel: 10,
      lightness: 0.25,
      lift: 0.5,
      edge: 0.08,
      edgeEnd: 0.12,
      bow: 0,
    },
    duration: 3.5,
    advance: "manual",
    mappings: [
      ["value", "brightness", 600, 6500],
      ["neutralLift", "width", 0.25, 0.95],
      ["progress", "sweepOffset", -0.4, 0.3],
    ],
  },
  {
    id: "value-down",
    name: "Value descent · closing space",
    model: "synth",
    notes:
      "Downward value movement is its own gesture, not a failed lift. Register stays stable as filtering closes.",
    probe: {
      hue: 40,
      hueTravel: -20,
      lightness: 0.82,
      lift: -0.48,
      edge: 0.25,
      edgeEnd: 0.3,
      bow: 0,
    },
    duration: 3.5,
    advance: "manual",
    mappings: [
      ["value", "brightness", 450, 5500],
      ["progress", "width", 0.9, 0.3],
      ["progress", "density", 8, 2],
    ],
  },
  {
    id: "interior",
    name: "Interior setup · hanging voices",
    model: "piano",
    notes:
      "A setup gesture through the interior: modest chord development and sustained notes. This sketch does not claim a real multi-pour route.",
    probe: {
      hue: 20,
      hueTravel: 150,
      lightness: 0.6,
      lift: -0.1,
      edge: 0.65,
      edgeEnd: 0.35,
      bow: -0.3,
    },
    duration: 4.5,
    advance: "progress",
    mappings: [
      ["chroma", "density", 2, 12],
      ["progress", "sweepOffset", -0.25, 0.3],
      ["envelope", "grains", 0, 0.2],
    ],
  },
  {
    id: "near-pass",
    name: "Near pass · ribbon suspension",
    model: "glass",
    notes:
      "Passes a separate target without a success gesture. A restrained sweep leaves the musical state open.",
    probe: {
      hue: 270,
      hueTravel: 30,
      lightness: 0.6,
      lift: 0.06,
      edge: 0.4,
      edgeEnd: 0.35,
      bow: 0.08,
    },
    duration: 2.6,
    advance: "manual",
    mappings: [
      ["targetNear", "sweepOffset", -0.25, 0.25],
      ["envelope", "ribbon", 0.35, 0.8],
      ["progress", "density", 4, 1],
    ],
  },
].map((study) => ({
  id: `study-${study.id}`,
  name: study.name,
  notes: study.notes,
  scope: "all",
  updatedAt: "2026-09-12T00:00:00Z",
  setup: sanitizeSetup({
    parameters: {
      ...DEFAULTS,
      ...SOUND_MODELS.find((m) => m.id === study.model)!.values,
      music: {
        ...DEFAULTS.music,
        progression: study.id === "interior" ? "neighbors" : "still",
        sustain: study.id === "interior",
        stack: study.model === "convergence" ? "triad" : DEFAULTS.music.stack,
      },
    },
    journey: {
      ...JOURNEY_DEFAULTS,
      probe: study.probe,
      duration: study.duration,
      advance: study.advance,
      outcome: study.id === "near-pass" ? "miss" : "capture",
      density: study.model === "glass" ? 3 : 7,
    },
    mappings: study.mappings.map(([source, target, low, high], i) => ({
      id: `study-${i}`,
      source,
      target,
      low,
      high,
      enabled: true,
      curve: "ease",
      smooth: 0.2,
    })),
  }),
}));
