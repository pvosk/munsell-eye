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
        arp: i === 0 ? "weave" : "ripple",
        spacing: i === 0 ? 0.25 : 0.5,
        rest: 0,
        octaves: i === 0 ? 3 : 2,
        progression: i === 0 ? "modal" : "still",
      },
    },
    journey: {
      ...JOURNEY_DEFAULTS,
      density: i === 0 ? 18 : 6,
      duration: i === 1 ? 3.2 : 2.8,
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
    mappings:
      i === 1
        ? [
            {
              id: "grow",
              enabled: true,
              source: "edgeRun",
              target: "voices",
              low: 3,
              high: 18,
              curve: "ease",
              smooth: 0.25,
            },
            {
              id: "gather",
              enabled: true,
              source: "progress",
              target: "converge",
              low: 0,
              high: 0.85,
              curve: "grow",
              smooth: 0.1,
            },
          ]
        : DEFAULT_MAPPINGS,
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
