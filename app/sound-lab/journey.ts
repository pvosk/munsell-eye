/** Lab-only trajectory probes. Gamut boundary is sRGB at a given OKLab L/h,
 * NOT the palette's reachable hull or the game's Munsell display boundary.
 * Inverse conversion: Björn Ottosson, https://bottosson.github.io/posts/oklab/ (public domain). */
export const clamp = (x: number, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, x));
export type Probe = {
  hue: number;
  hueTravel: number;
  lightness: number;
  lift: number;
  edge: number;
  edgeEnd: number;
  bow: number;
};
export type PaintTrace = {
  level: number;
  before: number[];
  index: number;
  hold: number;
  target: number[] | null;
};
export type Journey = {
  rhythm: "density" | "motif";
  path: "probe" | "paint";
  paint: PaintTrace;
  duration: number;
  outcome: "capture" | "miss";
  advance: "manual" | "shot" | "progress" | "hue";
  changes: number;
  arrival: number;
  density: number;
  repeat: boolean;
  gap: number;
  probe: Probe;
};
export const JOURNEY_DEFAULTS: Journey = {
  rhythm: "density",
  path: "probe",
  paint: { level: 0, before: [1, 0, 0], index: 1, hold: 0.65, target: null },
  duration: 2.8,
  outcome: "capture",
  advance: "progress",
  changes: 2,
  arrival: 1.8,
  density: 7,
  repeat: false,
  gap: 4,
  probe: {
    hue: 270,
    hueTravel: 65,
    lightness: 0.6,
    lift: 0.05,
    edge: 0.55,
    edgeEnd: 0.65,
    bow: 0.08,
  },
};
export const PROBES = [
  {
    name: "Gentle correction",
    probe: {
      hue: 270,
      hueTravel: 14,
      lightness: 0.65,
      lift: 0.035,
      edge: 0.25,
      edgeEnd: 0.3,
      bow: 0,
    },
    duration: 1.2,
  },
  {
    name: "Chromatic edge travel",
    probe: {
      hue: 320,
      hueTravel: 170,
      lightness: 0.6,
      lift: 0,
      edge: 0.95,
      edgeEnd: 0.95,
      bow: 0,
    },
    duration: 3.2,
  },
  {
    name: "Neutral ascent",
    probe: {
      hue: 240,
      hueTravel: 0,
      lightness: 0.28,
      lift: 0.5,
      edge: 0.015,
      edgeEnd: 0.015,
      bow: 0,
    },
    duration: 2.8,
  },
  {
    name: "Across the interior",
    probe: {
      hue: 20,
      hueTravel: 145,
      lightness: 0.55,
      lift: 0.08,
      edge: 0.7,
      edgeEnd: 0.7,
      bow: -0.62,
    },
    duration: 3,
  },
];
export type ColorSample = {
  l: number;
  c: number;
  h: number;
  edge: number;
  rgb: number[];
};
export function linearRGB(l: number, a: number, b: number) {
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ];
}
export function gamutChroma(l: number, h: number) {
  let lo = 0,
    hi = 0.5;
  const r = (h * Math.PI) / 180;
  for (let i = 0; i < 20; i++) {
    const c = (lo + hi) / 2,
      rgb = linearRGB(l, c * Math.cos(r), c * Math.sin(r));
    if (rgb.every((x) => x >= 0 && x <= 1)) lo = c;
    else hi = c;
  }
  return lo;
}
export function sampleProbe(p: Probe, t: number): ColorSample {
  t = clamp(t);
  const l = clamp(p.lightness + p.lift * t, 0.03, 0.97),
    h = p.hue + p.hueTravel * t,
    edge = clamp(
      p.edge + (p.edgeEnd - p.edge) * t + p.bow * Math.sin(Math.PI * t),
    ),
    c = edge * gamutChroma(l, h),
    r = (h * Math.PI) / 180;
  return {
    l,
    c,
    h,
    edge,
    rgb: linearRGB(l, c * Math.cos(r), c * Math.sin(r)).map(
      (x) =>
        255 *
        clamp(x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055),
    ),
  };
}
export const INPUTS = [
  ["progress", "Shot progress"],
  ["speed", "Color travel speed"],
  ["hue", "Hue position (cyclic)"],
  ["hueTravel", "Accumulated hue travel"],
  ["chroma", "Absolute chroma"],
  ["chromaChange", "Chroma development"],
  ["value", "Lightness"],
  ["lift", "Lightness change"],
  ["edge", "Boundary proximity"],
  ["edgeRun", "Accumulated edge travel"],
  ["neutralLift", "Neutral ascent"],
  ["envelope", "Arc envelope"],
] as const;
export type Signal = (typeof INPUTS)[number][0];
export type Signals = Record<Signal, number>;
export const OUTPUTS = [
  ["density", "Arpeggio density", 0, 24],
  ["voices", "Convergence voices", 1, 18],
  ["spread", "Convergence spread", 0, 1],
  ["converge", "Voice convergence", 0, 1],
  ["brightness", "Brightness", 300, 10000],
  ["ribbon", "Ribbon blend", 0, 1],
  ["sweepDepth", "Sweep depth", 0, 1],
  ["grains", "Granular amount", 0, 1],
  ["register", "Register shift (octaves)", -1, 2],
  ["width", "Stereo width", 0, 1],
  ["motion", "Sweep speed", 0.01, 0.8],
  ["sweepOffset", "Sweep position", -1, 1],
  ["harmonics", "Overtone body", 0, 1],
  ["drive", "Propulsion level", 0, 1],
  ["tension", "Microtonal lean", 0, 1],
] as const;
export type Destination = (typeof OUTPUTS)[number][0];
export type Mapping = {
  id: string;
  enabled: boolean;
  source: Signal;
  target: Destination;
  low: number;
  high: number;
  curve: "linear" | "ease" | "grow" | "arch";
  smooth: number;
};
export const DEFAULT_MAPPINGS: Mapping[] = [
  {
    id: "motion",
    enabled: true,
    source: "envelope",
    target: "ribbon",
    low: 0.12,
    high: 0.55,
    curve: "ease",
    smooth: 0.15,
  },
  {
    id: "edge",
    enabled: true,
    source: "edgeRun",
    target: "voices",
    low: 3,
    high: 16,
    curve: "grow",
    smooth: 0.3,
  },
];
export function curve(x: number, kind: Mapping["curve"]) {
  x = clamp(x);
  return kind === "ease"
    ? x * x * (3 - 2 * x)
    : kind === "grow"
      ? x * x
      : kind === "arch"
        ? Math.sin(Math.PI * x)
        : x;
}
export function signalPath(
  samples: ColorSample[],
  duration: number,
): Signals[] {
  let edgeRun = 0,
    hueTravel = 0,
    neutralLift = 0;
  const first = samples[0];
  return samples.map((s, i) => {
    const prev = samples[Math.max(0, i - 1)],
      dt = duration / Math.max(1, samples.length - 1),
      dh = Math.abs(s.h - prev.h),
      chromatic = clamp(Math.min(s.c, prev.c) / 0.045),
      travel = dh * chromatic;
    hueTravel += travel;
    edgeRun +=
      (travel / 120 + Math.abs(s.l - prev.l) * 1.8 * chromatic) *
      clamp((Math.min(s.edge, prev.edge) - 0.65) / 0.3);
    neutralLift += Math.max(0, s.l - prev.l) * clamp(1 - s.c / 0.035) * 2;
    const dl = s.l - prev.l,
      dist = Math.hypot(
        dl,
        s.c - prev.c,
        (Math.min(s.c, prev.c) * dh * Math.PI) / 180,
      );
    return {
      progress: i / Math.max(1, samples.length - 1),
      speed: clamp((dist / Math.max(0.001, dt)) * 5),
      hue: chromatic * (0.5 + 0.5 * Math.sin((s.h * Math.PI) / 180)),
      hueTravel: clamp(hueTravel / 180),
      chroma: clamp(s.c / 0.32),
      chromaChange: clamp(0.5 + (s.c - first.c) / 0.4),
      value: s.l,
      lift: clamp(0.5 + (s.l - first.l)),
      edge: s.edge,
      edgeRun: clamp(edgeRun),
      neutralLift: clamp(neutralLift),
      envelope: Math.sin((Math.PI * i) / Math.max(1, samples.length - 1)),
    };
  });
}
export function mapSignals(
  rows: Mapping[],
  signals: Signals,
  previous: Partial<Record<Destination, number>>,
  dt: number,
) {
  const result: Partial<Record<Destination, number>> = {};
  for (const row of rows) {
    if (!row.enabled) continue;
    const raw =
      row.low + (row.high - row.low) * curve(signals[row.source], row.curve);
    const alpha = row.smooth === 0 ? 1 : 1 - Math.exp(-dt / row.smooth);
    result[row.target] =
      (previous[row.target] ?? raw) +
      (raw - (previous[row.target] ?? raw)) * alpha;
  }
  return result;
}
const num = (v: unknown, d: number, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : d;
export function sanitizeJourney(value: unknown): Journey {
  const d = JOURNEY_DEFAULTS,
    v = (value && typeof value === "object" ? value : {}) as Partial<Journey>,
    p = v.probe ?? d.probe;
  const paint = v.paint ?? d.paint;
  return {
    rhythm: v.rhythm === "motif" ? "motif" : "density",
    path: v.path === "paint" ? "paint" : "probe",
    paint: {
      level: Math.round(num(paint.level, 0, 0, 100)),
      before: Array.isArray(paint.before)
        ? paint.before.slice(0, 12).map((x) => num(x, 0, 0, 10000))
        : [1, 0, 0],
      index: Math.round(num(paint.index, 1, 0, 11)),
      hold: num(paint.hold, 0.65, 0, 4.4),
      target:
        Array.isArray(paint.target) &&
        paint.target.length === 3 &&
        paint.target.every((x) => typeof x === "number" && Number.isFinite(x))
          ? paint.target.map((x) => clamp(x, -1, 1))
          : null,
    },
    duration: num(v.duration, d.duration, 0.7, 12),
    outcome: v.outcome === "miss" ? "miss" : "capture",
    advance: ["manual", "shot", "progress", "hue"].includes(v.advance ?? "")
      ? v.advance!
      : d.advance,
    changes: Math.round(num(v.changes, 2, 0, 8)),
    arrival: num(v.arrival, 1.8, 0.2, 6),
    density: num(v.density, 7, 1, 24),
    repeat: v.repeat === true,
    gap: num(v.gap, 4, 1, 15),
    probe: {
      hue: num(p.hue, 270, 0, 360),
      hueTravel: num(p.hueTravel, 65, -360, 360),
      lightness: num(p.lightness, 0.6, 0.05, 0.95),
      lift: num(p.lift, 0.05, -0.8, 0.8),
      edge: num(p.edge, 0.55, 0, 1),
      edgeEnd: num(p.edgeEnd, 0.65, 0, 1),
      bow: num(p.bow, 0.08, -1, 1),
    },
  };
}
export function sanitizeMappings(value: unknown): Mapping[] {
  if (!Array.isArray(value)) return DEFAULT_MAPPINGS.map((x) => ({ ...x }));
  const targets = new Set<string>();
  return value.slice(0, 12).flatMap((v, i) => {
    if (!v || typeof v !== "object") return [];
    const out = OUTPUTS.find((x) => x[0] === v.target);
    if (!out || targets.has(v.target) || !INPUTS.some((x) => x[0] === v.source))
      return [];
    targets.add(v.target);
    return [
      {
        id: `map-${i}`,
        enabled: v.enabled !== false,
        source: v.source,
        target: v.target,
        low: num(v.low, out[2], out[2], out[3]),
        high: num(v.high, out[3], out[2], out[3]),
        curve: ["linear", "ease", "grow", "arch"].includes(v.curve)
          ? v.curve
          : "linear",
        smooth: num(v.smooth, 0.15, 0, 2),
      },
    ];
  });
}
