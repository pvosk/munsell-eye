import {
  DEFAULTS,
  SOUND_MODELS,
  type Instrument,
  type Parameters,
} from "./parameters";
import {
  JOURNEY_DEFAULTS,
  type Journey,
  type Mapping,
  type Probe,
} from "./journey";
import { type MusicSettings } from "./music";
import { sanitizeSetup, type Preset } from "./presets";

// Original listening studies, not transcriptions or certified campaign routes.
// All three layers are explicit. No random preset generation at page load.
type Connection = [
  Mapping["source"],
  Mapping["target"],
  number,
  number,
  Mapping["curve"]?,
  number?,
];
type Recipe = {
  id: string;
  name: string;
  ride: string;
  listen: string;
  tweak: string;
  model?: Instrument;
  sound?: Partial<Parameters>;
  music?: Partial<MusicSettings>;
  journey?: Partial<Omit<Journey, "probe">>;
  probe: Probe;
  connections: Connection[];
};
type FamilyRecipe = {
  id: string;
  name: string;
  description: string;
  model: Instrument;
  sound: Partial<Parameters>;
  music: Partial<MusicSettings>;
  journey: Partial<Journey>;
  variations: Recipe[];
};
const route = (
  hue: number,
  hueTravel: number,
  lightness: number,
  lift: number,
  edge: number,
  edgeEnd: number,
  bow = 0,
): Probe => ({ hue, hueTravel, lightness, lift, edge, edgeEnd, bow });
const melody = (
  steps: (number | null)[],
  offspring = 0,
): Partial<MusicSettings> => ({
  melody: "grid",
  melodySteps: [...steps, ...Array(16 - steps.length).fill(null)],
  melodyLength: steps.length,
  offspring,
  melodyFollow: true,
});

const RECIPES: FamilyRecipe[] = [
  {
    id: "piano-rivers",
    name: "Piano rivers",
    description:
      "Active, tonal streams with long string overlap. The arc shapes density; common tones carry the harmony.",
    model: "piano",
    sound: {
      decay: 5.8,
      hardness: 0.32,
      harmonics: 0.24,
      detune: 0.025,
      drive: 0.06,
      dry: 0.9,
      echo: 0.2,
      delay: 0.31,
      tail: 3.8,
      grains: 0.04,
      reverse: 0,
      ribbon: 0.1,
      room: 0.4,
    },
    music: {
      mode: "lydian",
      stack: "six-nine",
      arp: "weave",
      sustain: true,
      pedal: true,
      voicing: "smooth",
      octaves: 3,
      variation: 0.04,
      rest: 0,
    },
    journey: { duration: 6, arrival: 2.6, gap: 3, advance: "hue", changes: 3 },
    variations: [
      {
        id: "sunlit-current",
        name: "Sunlit current",
        ride: "Long chromatic ride",
        listen:
          "Interwoven notes thicken across the arc; hue travel moves through a modal sequence before returning home.",
        tweak: "Arc envelope → density changes the tunnel thickness.",
        music: { tonic: 2, progression: "modal", arp: "weave" },
        probe: route(320, 175, 0.6, 0.04, 0.88, 0.9),
        connections: [
          ["envelope", "density", 7, 21],
          ["hueTravel", "width", 0.35, 0.9],
          ["chroma", "brightness", 2200, 5800],
        ],
      },
      {
        id: "braided-interior",
        name: "Braided interior",
        ride: "Interior crossing",
        listen:
          "A drawn eight-step melody sends off two smaller notes per step. Neighboring harmonies follow shot progress.",
        tweak: "Edit the melody grid; offspring adds the smaller branches.",
        music: {
          tonic: 7,
          mode: "ionian",
          progression: "neighbors",
          bpm: 84,
          spacing: 0.5,
          ...melody([0, 4, 2, 5, 1, 4, 3, 2], 2),
        },
        journey: { rhythm: "motif", advance: "progress", changes: 3 },
        probe: route(25, 145, 0.58, 0.08, 0.7, 0.62, -0.53),
        connections: [
          ["envelope", "drive", 0.025, 0.09],
          ["chromaChange", "ribbon", 0.06, 0.24],
          ["progress", "width", 0.45, 0.85],
        ],
      },
      {
        id: "downstream-bells",
        name: "Downstream bells",
        ride: "Value descent",
        listen:
          "Descending arpeggios remain tonal as the space darkens. A Dorian ninth keeps the landing open.",
        tweak:
          "Lightness → brightness controls the descent without a pitch slide.",
        sound: { decay: 4.5, hardness: 0.22, delay: 0.43 },
        music: {
          tonic: 9,
          mode: "dorian",
          stack: "ninth",
          arp: "down",
          progression: "descending",
          destinationStep: 3,
        },
        journey: { advance: "progress", changes: 3, duration: 5 },
        probe: route(60, -55, 0.81, -0.43, 0.42, 0.5),
        connections: [
          ["value", "brightness", 550, 5200],
          ["progress", "density", 17, 5],
          ["progress", "width", 0.85, 0.35],
        ],
      },
    ],
  },
  {
    id: "hanging-cells",
    name: "Hanging cells",
    description:
      "Small repeating ideas, rests and extended modal harmony. Motion opens the space without requiring a new key.",
    model: "piano",
    sound: {
      hardness: 0.18,
      decay: 6.2,
      drive: 0.025,
      echo: 0.16,
      delay: 0.68,
      tail: 4,
      dry: 0.85,
      ribbon: 0.12,
      grains: 0.06,
      reverse: 0.03,
      room: 0.52,
    },
    music: {
      mode: "lydian",
      stack: "ninth",
      progression: "still",
      bpm: 68,
      spacing: 0.5,
      rest: 0.5,
      sustain: true,
      octaves: 2,
      variation: 0,
      ...melody([0, 4, null, 2, 6, null, 1, null]),
    },
    journey: {
      rhythm: "motif",
      duration: 7,
      arrival: 3,
      gap: 5,
      advance: "manual",
      changes: 0,
    },
    variations: [
      {
        id: "held-light",
        name: "Held light",
        ride: "Neutral ascent",
        listen:
          "One original cell stays anchored while lightness opens filtering. The empty steps are part of the phrase.",
        tweak: "Try longer grid rests before adding more notes.",
        music: { tonic: 5 },
        probe: route(240, 8, 0.3, 0.43, 0.025, 0.04),
        connections: [
          ["value", "brightness", 900, 4200],
          ["neutralLift", "width", 0.3, 0.85],
          ["envelope", "ribbon", 0.08, 0.3],
        ],
      },
      {
        id: "minor-lantern",
        name: "Minor lantern",
        ride: "Interior setup · miss",
        listen:
          "A minor cell changes with each replayed shot and leaves its last harmony hanging. Resolve demo auditions the home finish.",
        tweak:
          "Next harmony auditions the next setup state; Loop advances one state per shot.",
        music: {
          tonic: 2,
          mode: "dorian",
          stack: "eleventh",
          progression: "neighbors",
          arp: "anchor",
          ...melody([0, null, 3, 4, null, 1, 5, null]),
        },
        journey: {
          advance: "shot",
          outcome: "miss",
          target: { hue: 200, lightness: 0.67, edge: 0.25 },
        },
        probe: route(35, 100, 0.59, -0.08, 0.65, 0.3, -0.18),
        connections: [
          ["chromaChange", "brightness", 1000, 3600],
          ["envelope", "grains", 0.03, 0.19],
          ["targetNear", "sweepOffset", -0.2, 0.2],
        ],
      },
      {
        id: "small-answer",
        name: "Small answer",
        ride: "Close putt",
        listen:
          "A brief pentatonic answer with a clear transient and a long, quiet tail. Harmony stays still during the correction.",
        tweak: "Shot duration determines how much of the cell is spoken.",
        sound: { decay: 3.8, room: 0.38, echo: 0.12 },
        music: {
          tonic: 10,
          mode: "major-pent",
          stack: "triad",
          bpm: 96,
          spacing: 0.25,
          ...melody([0, 2, 4, null, 1, null, 0, null]),
        },
        journey: { duration: 2, arrival: 1.8, gap: 4 },
        probe: route(270, 12, 0.66, 0.025, 0.26, 0.3),
        connections: [
          ["envelope", "drive", 0.015, 0.06],
          ["progress", "ribbon", 0.22, 0.06],
          ["progress", "width", 0.3, 0.6],
        ],
      },
    ],
  },
  {
    id: "glass-ribbons",
    name: "Glass ribbons",
    description:
      "Three excitations reveal different sides of the resonant sweep: ringing glass, struck strings and a softer synthetic body.",
    model: "glass",
    sound: {
      dry: 0.45,
      ribbon: 0.78,
      resonance: 0.035,
      phaseSpread: 1.5,
      bandSpread: 0.85,
      sweepDepth: 0.55,
      motion: 0.12,
      reverse: 0.35,
      grains: 0.15,
      grain: 0.48,
      grainRoute: "before",
      decay: 4.4,
      drive: 0.05,
      echo: 0.1,
      tail: 2.8,
      shift: 0,
    },
    music: {
      mode: "major-pent",
      stack: "sus2",
      progression: "still",
      arp: "inward",
      octave: 3,
      variation: 0.08,
      pedal: false,
    },
    journey: {
      advance: "manual",
      changes: 0,
      duration: 3.6,
      density: 3,
      arrival: 2.7,
      gap: 4,
    },
    variations: [
      {
        id: "glass-thread",
        name: "Glass thread",
        ride: "Close correction",
        listen:
          "Sparse tuned strikes pass through independently moving bands; backward fragments swell after the onset.",
        tweak:
          "Lower Direct source level to isolate the ribbon; then adjust bandwidth.",
        music: { tonic: 7 },
        probe: route(275, 18, 0.66, 0.04, 0.3, 0.36),
        connections: [
          ["progress", "sweepOffset", -0.45, 0.35],
          ["envelope", "ribbon", 0.35, 0.9],
          ["progress", "width", 0.3, 0.75],
        ],
      },
      {
        id: "string-reflection",
        name: "String reflection",
        ride: "Interior turn",
        model: "piano",
        sound: {
          dry: 0.36,
          hardness: 0.38,
          harmonics: 0.4,
          decay: 5.5,
          grain: 0.65,
          reverse: 0.48,
        },
        music: {
          tonic: 0,
          mode: "lydian",
          stack: "ninth",
          arp: "pendulum",
          progression: "neighbors",
          octave: 2,
        },
        journey: { advance: "progress", changes: 1, duration: 5, density: 5 },
        probe: route(15, 90, 0.58, 0.1, 0.65, 0.48, -0.32),
        listen:
          "A struck-string source exposes more overtones in the same ribbon idea. One neighboring harmony opens before capture returns home.",
        tweak: "Compare grain routing Before ribbon versus Parallel.",
        connections: [
          ["progress", "sweepOffset", 0.5, -0.4],
          ["envelope", "grains", 0.08, 0.35],
          ["chromaChange", "brightness", 1700, 4900],
        ],
      },
      {
        id: "passing-prism",
        name: "Passing prism",
        ride: "Near pass · miss",
        model: "synth",
        sound: {
          attack: 0.11,
          dry: 0.32,
          harmonics: 0.6,
          drive: 0.18,
          sweepDirection: -1,
          reverse: 0.22,
          grain: 0.7,
        },
        music: {
          tonic: 3,
          mode: "suspended-pent",
          stack: "quartal",
          arp: "outward",
        },
        journey: {
          outcome: "miss",
          duration: 3.2,
          density: 2,
          target: { hue: 306, lightness: 0.66, edge: 0.34 },
        },
        probe: route(270, 30, 0.6, 0.06, 0.4, 0.35, 0.06),
        listen:
          "The synth supplies a continuous surface for the filter. Nearness bends the bands without completing a success gesture.",
        tweak: "Target proximity → sweep position controls the passing effect.",
        connections: [
          ["targetNear", "sweepOffset", -0.6, 0.4],
          ["envelope", "ribbon", 0.4, 0.85],
          ["progress", "width", 0.8, 0.4],
        ],
      },
    ],
  },
  {
    id: "converging-skies",
    name: "Converging skies",
    description:
      "Body-only voice clouds. Each has a deliberately chosen destination, with different growth, wandering and gathering.",
    model: "convergence",
    sound: {
      shotArps: 0,
      dry: 0.9,
      drive: 0.44,
      spread: 0.55,
      wander: 1.5,
      wanderRate: 0.14,
      gatherStart: 0.12,
      gatherCurve: 0.8,
      harmonics: 0.2,
      detune: 0.015,
      echo: 0.04,
      tail: 1.2,
      reverse: 0,
      grains: 0,
      room: 0.4,
    },
    music: {
      octave: 2,
      mode: "ionian",
      stack: "triad",
      progression: "still",
      voicing: "close",
      pedal: false,
    },
    journey: {
      advance: "manual",
      changes: 0,
      duration: 7,
      arrival: 3.5,
      density: 1,
      gap: 3,
    },
    variations: [
      {
        id: "wide-horizon",
        name: "Wide horizon",
        ride: "Boundary run",
        listen:
          "Six voices grow to eighteen along the edge and gather toward a spread major destination. No piano motif sits on top.",
        tweak:
          "Begin gathering and Gathering curve shape the flight; Arrival seconds lengthens the finish.",
        music: { tonic: 2 },
        probe: route(305, 210, 0.6, 0.04, 0.97, 0.97),
        connections: [
          ["edgeRun", "voices", 6, 18, "ease"],
          ["progress", "width", 0.3, 0.95],
          ["envelope", "harmonics", 0.12, 0.4],
        ],
      },
      {
        id: "suspended-vault",
        name: "Suspended vault",
        ride: "Chromatic ride through the interior",
        listen:
          "A smaller cloud aligns into a suspended second instead of a major triad. This ride stays colorful without hugging the boundary.",
        tweak:
          "Initial pitch spread changes the starting cloud independently of wandering.",
        sound: {
          spread: 0.32,
          wander: 0.7,
          gatherStart: 0.05,
          gatherCurve: 0.6,
          drive: 0.4,
          room: 0.52,
        },
        music: { tonic: 9, mode: "mixolydian", stack: "sus2" },
        journey: { duration: 6, arrival: 4 },
        probe: route(350, 170, 0.62, -0.06, 0.76, 0.8, -0.08),
        connections: [
          ["hueTravel", "voices", 8, 14],
          ["progress", "width", 0.55, 0.85],
          ["value", "brightness", 1000, 4400],
        ],
      },
      {
        id: "dark-to-gold",
        name: "Dark to gold",
        ride: "Chromatic ascent",
        listen:
          "A darker, restless beginning gathers toward a Dorian seventh. Brightness and voice count open together while pitch wandering subsides.",
        tweak:
          "Cloud wandering controls the unrest; keep arpeggio layer at zero for the pure cloud.",
        sound: { spread: 0.72, wander: 3, gatherStart: 0.2, gatherCurve: 1.1 },
        music: { tonic: 5, mode: "dorian", stack: "seventh" },
        journey: { duration: 8, arrival: 4 },
        probe: route(35, 160, 0.3, 0.38, 0.9, 0.93),
        connections: [
          ["edgeRun", "voices", 5, 18],
          ["value", "brightness", 700, 6000],
          ["progress", "wander", 3, 0.15],
          ["progress", "width", 0.25, 1],
        ],
      },
    ],
  },
  {
    id: "breathing-voices",
    name: "Breathing voices",
    description:
      "Generated vowel bodies with independent pitch and formant movement. Soft emitted notes answer the sustained line.",
    model: "vocal",
    sound: {
      shotArps: 0.2,
      drive: 0.42,
      glideTime: 0.8,
      vibrato: 0.08,
      breath: 0.06,
      harmonics: 0.18,
      dry: 0.8,
      echo: 0.12,
      ribbon: 0.16,
      grains: 0.04,
      reverse: 0.04,
      decay: 3.6,
      room: 0.5,
    },
    music: {
      mode: "dorian",
      stack: "shell",
      arp: "anchor",
      progression: "still",
      octave: 2,
      pedal: true,
      sustain: true,
    },
    journey: {
      advance: "manual",
      changes: 0,
      duration: 5,
      density: 2,
      arrival: 3,
      gap: 4,
    },
    variations: [
      {
        id: "breath-rising",
        name: "Breath rising",
        ride: "Neutral ascent",
        listen:
          "A low vowel glides upward while its formants open. Lightness mainly expands space, keeping the harmony stable.",
        tweak:
          "Launch pitch offset changes the glide; vowel changes the mouth shape.",
        sound: { glideStart: -7, glideCurve: 0.8 },
        music: { tonic: 2 },
        probe: route(210, 8, 0.28, 0.48, 0.025, 0.04),
        connections: [
          ["progress", "vowel", 0.05, 0.75],
          ["neutralLift", "width", 0.25, 0.85],
          ["value", "brightness", 800, 3600],
        ],
      },
      {
        id: "low-exhale",
        name: "Low exhale",
        ride: "Value descent",
        listen:
          "A descending glide closes from ah toward oo. Occasional descending notes answer the body rather than filling every gap.",
        tweak:
          "Note glide time controls how gently a new harmonic pitch is approached.",
        sound: { glideStart: 5, glideCurve: 1.4, breath: 0.12, shotArps: 0.12 },
        music: { tonic: 7, mode: "aeolian", arp: "down", stack: "sus4" },
        probe: route(50, -12, 0.79, -0.44, 0.16, 0.18),
        connections: [
          ["progress", "vowel", 0.8, 0.12],
          ["value", "brightness", 600, 3600],
          ["envelope", "ribbon", 0.08, 0.35],
        ],
      },
      {
        id: "call-across",
        name: "Call across",
        ride: "Coupled adjustment · miss",
        listen:
          "A small drawn response moves through neighboring chords while the vowel changes in the opposite direction to lightness. The landing stays open.",
        tweak:
          "Compare the melody grid with the continuous vowel body by lowering Arpeggio layer.",
        sound: { glideStart: -2, shotArps: 0.38, glideTime: 1.1 },
        music: {
          tonic: 10,
          mode: "mixolydian",
          stack: "ninth",
          progression: "neighbors",
          bpm: 76,
          spacing: 0.5,
          ...melody([0, null, 4, 2, null, 5, 1, null]),
        },
        journey: {
          rhythm: "motif",
          advance: "progress",
          changes: 2,
          duration: 6,
          outcome: "miss",
          target: { hue: 240, lightness: 0.66, edge: 0.35 },
        },
        probe: route(30, 140, 0.43, 0.22, 0.7, 0.25, -0.08),
        connections: [
          ["value", "vowel", 0.9, 0.1],
          ["chromaChange", "formantShift", -2, 2],
          ["envelope", "width", 0.4, 0.9],
        ],
      },
    ],
  },
  {
    id: "grain-memory",
    name: "Grain memory",
    description:
      "Recognizable phrases leave fragments in a short live buffer. The past becomes texture without an endless frozen loop.",
    model: "piano",
    sound: {
      dry: 0.65,
      decay: 3,
      hardness: 0.22,
      drive: 0.04,
      grains: 0.3,
      grainDensity: 12,
      grainLookback: 1.1,
      grainSpread: 0.35,
      grain: 0.38,
      reverse: 0.22,
      echo: 0.12,
      tail: 3.2,
      room: 0.48,
      ribbon: 0.25,
      freeze: 0,
    },
    music: {
      mode: "major-pent",
      stack: "triad",
      arp: "anchor",
      progression: "still",
      bpm: 78,
      spacing: 0.5,
      rest: 1,
      variation: 0.06,
      ...melody([0, 2, 4, null, 1, null, 2, null]),
    },
    journey: {
      rhythm: "motif",
      advance: "manual",
      changes: 0,
      duration: 7,
      arrival: 3,
      gap: 5,
    },
    variations: [
      {
        id: "remembered-steps",
        name: "Remembered steps",
        ride: "Interior crossing",
        listen:
          "A clear piano cell writes the buffer first; its fragments become more prominent as the shot moves through the interior.",
        tweak: "Grain memory changes how far back the fragments reach.",
        music: { tonic: 4 },
        probe: route(10, 140, 0.58, 0.03, 0.65, 0.55, -0.45),
        connections: [
          ["progress", "grains", 0.03, 0.45],
          ["envelope", "ribbon", 0.12, 0.4],
          ["progress", "width", 0.3, 0.85],
        ],
      },
      {
        id: "reverse-estuary",
        name: "Reverse estuary",
        ride: "Chroma release",
        model: "glass",
        sound: {
          dry: 0.5,
          grainRoute: "before",
          reverse: 0.5,
          grain: 0.7,
          grainLookback: 0.8,
          grainDensity: 8,
          decay: 4.8,
        },
        music: {
          tonic: 9,
          mode: "suspended-pent",
          stack: "sus4",
          arp: "inward",
          ...melody([0, null, 3, 1, null, 4, null, 2]),
        },
        probe: route(300, 55, 0.61, 0.02, 0.93, 0.12, -0.05),
        listen:
          "Color drains toward the interior as the direct chimes leave a reversed halo. Suspended harmony avoids a mandatory major finish.",
        tweak: "Fragment length changes a reverse flicker into a longer swell.",
        connections: [
          ["chromaChange", "grains", 0.6, 0.05],
          ["progress", "sweepOffset", 0.4, -0.4],
          ["envelope", "width", 0.4, 0.95],
        ],
      },
      {
        id: "frayed-orbit",
        name: "Frayed orbit",
        ride: "Chromatic detour · miss",
        model: "synth",
        sound: {
          dry: 0.65,
          shred: 0.22,
          shredRate: 5,
          shredLength: 0.18,
          shredReverse: 0.4,
          grains: 0.16,
          reverse: 0.12,
          drive: 0.12,
        },
        music: {
          tonic: 0,
          mode: "dorian",
          stack: "seventh",
          progression: "thirds",
          arp: "walk",
          ...melody([0, 4, null, 2, 5, null, 3, null]),
        },
        journey: {
          advance: "hue",
          changes: 3,
          outcome: "miss",
          target: { hue: 335, lightness: 0.58, edge: 0.6 },
        },
        probe: route(330, -190, 0.6, -0.1, 0.8, 0.65, -0.3),
        listen:
          "A tonal cell drifts through thirds while reordered slices interrupt its wake. This is short-buffer erosion, not a self-decaying tape-loop simulation.",
        tweak:
          "Slices per second changes the fragment rhythm independently of the melody clock.",
        connections: [
          ["envelope", "shred", 0.02, 0.35],
          ["hueTravel", "shredScatter", 0.05, 0.8],
          ["progress", "width", 0.4, 0.9],
        ],
      },
    ],
  },
  {
    id: "interior-dialogues",
    name: "Interior dialogues",
    description:
      "Harmonic decisions for setup, tradeoff and return. Replay can mean another musical decision instead of starting the same chord.",
    model: "piano",
    sound: {
      decay: 3.8,
      hardness: 0.3,
      drive: 0.08,
      ribbon: 0.2,
      echo: 0.13,
      tail: 2.6,
      grains: 0.06,
      reverse: 0.04,
      dry: 0.85,
    },
    music: {
      voicing: "smooth",
      sustain: true,
      octaves: 2,
      pedal: false,
      variation: 0.04,
      mode: "dorian",
      stack: "ninth",
      arp: "skip",
      progression: "neighbors",
    },
    journey: {
      duration: 5,
      density: 7,
      arrival: 2.8,
      gap: 3,
      advance: "progress",
      changes: 2,
    },
    variations: [
      {
        id: "one-pour-later",
        name: "One pour later",
        ride: "Interior setup · miss",
        listen:
          "Each replay advances one harmony. The sound settles without a capture chord, suggesting a mixture that still has somewhere to go.",
        tweak:
          "Loop auditions successive decisions; Resolve demo auditions the destination.",
        music: { tonic: 2 },
        journey: {
          advance: "shot",
          outcome: "miss",
          target: { hue: 195, lightness: 0.63, edge: 0.28 },
        },
        probe: route(20, 110, 0.57, -0.05, 0.72, 0.28, -0.2),
        connections: [
          ["envelope", "density", 3, 10],
          ["chromaChange", "ribbon", 0.4, 0.1],
          ["progress", "width", 0.4, 0.7],
        ],
      },
      {
        id: "counterweight",
        name: "Counterweight",
        ride: "Coupled hue/value adjustment",
        listen:
          "Falling value closes the sound while chroma development increases activity. Smooth fourth-based harmony makes the two changes feel related.",
        tweak:
          "The density and brightness mappings pull in different directions.",
        model: "synth",
        sound: { attack: 0.065, decay: 3.2, harmonics: 0.32, drive: 0.2 },
        music: {
          tonic: 5,
          mode: "mixolydian",
          stack: "quartal",
          arp: "outward",
          progression: "modal",
          destinationStep: 2,
        },
        probe: route(50, 150, 0.77, -0.28, 0.2, 0.85),
        connections: [
          ["chromaChange", "density", 2, 13],
          ["value", "brightness", 700, 4800],
          ["envelope", "width", 0.35, 0.85],
        ],
      },
      {
        id: "returning-path",
        name: "Returning path",
        ride: "Close-start detour sketch",
        listen:
          "A long hue excursion makes room for a harmonic departure and return. This abstract sketch is not a certified game detour.",
        tweak: "Change harmony count to hear a shorter or longer departure.",
        music: {
          tonic: 7,
          mode: "ionian",
          stack: "six-nine",
          progression: "modal",
          arp: "pendulum",
          destinationStep: 3,
        },
        journey: { duration: 7, advance: "progress", changes: 3 },
        probe: route(280, 330, 0.6, 0.02, 0.6, 0.58, -0.45),
        connections: [
          ["envelope", "density", 3, 14],
          ["targetNear", "sweepOffset", -0.3, 0.25],
          ["progress", "grains", 0.12, 0.02],
        ],
      },
    ],
  },
  {
    id: "value-spaces",
    name: "Value spaces",
    description:
      "Three ways to move vertically without equating lightness with pitch. Filtering, width and note spacing carry the change.",
    model: "glass",
    sound: {
      decay: 5,
      dry: 0.8,
      ribbon: 0.3,
      drive: 0.05,
      reverse: 0.08,
      grains: 0.1,
      echo: 0.1,
      tail: 3,
      room: 0.58,
      material: 0,
    },
    music: {
      mode: "suspended-pent",
      stack: "sus2",
      progression: "still",
      arp: "outward",
      octave: 3,
      pedal: false,
      variation: 0.03,
    },
    journey: { advance: "manual", changes: 0, duration: 5, arrival: 3, gap: 4 },
    variations: [
      {
        id: "clear-column",
        name: "Clear column",
        ride: "Neutral ascent",
        listen:
          "A few chimes open into a larger space as a nearly neutral shot rises. Register remains fixed.",
        tweak:
          "Neutral ascent → width makes upward neutral travel distinct from an edge ride.",
        music: { tonic: 2 },
        probe: route(250, 0, 0.25, 0.52, 0.015, 0.015),
        connections: [
          ["neutralLift", "width", 0.2, 0.95],
          ["value", "brightness", 650, 6000],
          ["envelope", "density", 2, 6],
        ],
      },
      {
        id: "velvet-depth",
        name: "Velvet depth",
        ride: "Neutral descent",
        model: "synth",
        sound: {
          attack: 0.12,
          decay: 4.6,
          drive: 0.16,
          harmonics: 0.18,
          dry: 0.7,
        },
        music: {
          tonic: 9,
          mode: "aeolian",
          stack: "shell",
          arp: "inward",
          octave: 2,
        },
        probe: route(220, 0, 0.82, -0.53, 0.02, 0.025),
        listen:
          "Soft notes become fewer and darker during descent. The minor shell remains inhabitable at the bottom.",
        tweak:
          "Lightness → brightness and progress → density control two independent kinds of darkening.",
        connections: [
          ["value", "brightness", 450, 4300],
          ["progress", "density", 8, 2],
          ["progress", "width", 0.85, 0.3],
        ],
      },
      {
        id: "colored-lift",
        name: "Colored lift",
        ride: "Value shift with chroma retained",
        music: {
          tonic: 0,
          mode: "lydian",
          stack: "ninth",
          arp: "skip",
          progression: "neighbors",
          octave: 2,
        },
        journey: { advance: "progress", changes: 1, duration: 5.5 },
        probe: route(320, 28, 0.3, 0.43, 0.83, 0.87),
        listen:
          "A colorful lift retains more activity than the neutral column. One harmonic change marks the episode without tracing a circle of fifths.",
        tweak:
          "Absolute chroma → density distinguishes this from the neutral version.",
        connections: [
          ["chroma", "density", 3, 12],
          ["value", "brightness", 900, 5600],
          ["envelope", "ribbon", 0.1, 0.55],
        ],
      },
    ],
  },
  {
    id: "other-tunings",
    name: "Other tunings",
    description:
      "A small experimental corner: simple ratios, seven equal steps and a whole-tone field. Resolution means stability, not always a major chord.",
    model: "glass",
    sound: {
      material: 0,
      detune: 0,
      tension: 0,
      drive: 0.04,
      decay: 5.6,
      dry: 0.85,
      reverse: 0.08,
      grains: 0.1,
      ribbon: 0.22,
      echo: 0.12,
      tail: 3,
      room: 0.55,
    },
    music: {
      progression: "still",
      octave: 2,
      arp: "ripple",
      voicing: "close",
      pedal: false,
      variation: 0.03,
    },
    journey: {
      advance: "manual",
      changes: 0,
      duration: 6,
      density: 4,
      arrival: 3.5,
      gap: 5,
    },
    variations: [
      {
        id: "ratio-water",
        name: "Ratio water",
        ride: "Small interior arc",
        sound: {
          root: 110,
          intervals: [0, 386.31, 701.96, 1200, 1586.31, 1901.96],
        },
        music: { source: "custom", stack: "triad", arp: "anchor", octaves: 2 },
        probe: route(200, 55, 0.62, 0.05, 0.38, 0.5, -0.1),
        listen:
          "A six-note custom tuning approximates simple major ratios. Movement changes texture rather than modulating the fixed tuning.",
        tweak:
          "Custom cents edits the actual interval relationships; keep fragment pitch at zero for comparison.",
        connections: [
          ["envelope", "density", 2, 7],
          ["progress", "width", 0.3, 0.85],
          ["chromaChange", "sweepDepth", 0.12, 0.42],
        ],
      },
      {
        id: "sevenfold-garden",
        name: "Sevenfold garden",
        ride: "Chromatic arc · alternative tuning",
        music: {
          tonic: 2,
          mode: "seven-equal",
          stack: "quartal",
          arp: "walk",
          progression: "neighbors",
          pool: "scale",
        },
        journey: { advance: "hue", changes: 2, duration: 7 },
        probe: route(20, 190, 0.6, 0.04, 0.86, 0.88),
        listen:
          "Seven equal divisions replace familiar semitone spacing. Hue travel moves the harmonic field; the finish stays in that tuning.",
        tweak:
          "Switch stack between fourths and a triad to compare interval density.",
        connections: [
          ["hueTravel", "density", 3, 9],
          ["envelope", "grains", 0.03, 0.22],
          ["progress", "width", 0.4, 0.9],
        ],
      },
      {
        id: "weightless-steps",
        name: "Weightless steps",
        ride: "Interior drift · whole tone",
        model: "synth",
        sound: { harmonics: 0.2, drive: 0.12, attack: 0.09, decay: 4.2 },
        music: {
          tonic: 8,
          mode: "whole-tone",
          stack: "cluster",
          arp: "inward",
          progression: "thirds",
          pool: "scale",
        },
        journey: { advance: "progress", changes: 2 },
        probe: route(300, -120, 0.65, -0.1, 0.6, 0.35, -0.2),
        listen:
          "Equal whole steps remove a strong leading tone. Capture stabilizes the existing field rather than imposing a conventional cadence.",
        tweak: "Use wider voicing if the close intervals feel too dense.",
        connections: [
          ["envelope", "density", 2, 8],
          ["progress", "sweepOffset", -0.3, 0.25],
          ["chromaChange", "width", 0.85, 0.35],
        ],
      },
    ],
  },
  {
    id: "luminous-pressure",
    name: "Luminous pressure",
    description:
      "Denser synthetic rides with controlled distortion and fragment texture. Musical motion stays distinct from the effect rhythm.",
    model: "synth",
    sound: {
      hardness: 0.15,
      harmonics: 0.45,
      attack: 0.045,
      decay: 3.8,
      dry: 0.75,
      drive: 0.2,
      saturate: 0.16,
      textureDrive: 2.5,
      fold: 0.08,
      ribbon: 0.2,
      grains: 0.13,
      reverse: 0.06,
      echo: 0.12,
      tail: 3,
      room: 0.45,
    },
    music: {
      mode: "dorian",
      stack: "ninth",
      arp: "weave",
      voicing: "smooth",
      octaves: 2,
      sustain: true,
      variation: 0.07,
      pedal: false,
    },
    journey: { duration: 7, arrival: 3, gap: 4, advance: "hue", changes: 2 },
    variations: [
      {
        id: "fifths-in-mist",
        name: "Fifths in mist",
        ride: "Broad chromatic ride",
        listen:
          "Hue travel moves through two key regions on the circle of fifths. Modest note density leaves room for the old chord tails.",
        tweak:
          "Harmony changes sets the number of key regions; shorten ring time for a cleaner transition.",
        music: {
          tonic: 0,
          mode: "ionian",
          stack: "six-nine",
          progression: "fifths",
          arp: "anchor",
          destinationStep: 2,
        },
        sound: { decay: 2.5, tail: 2.2 },
        probe: route(310, 220, 0.58, 0.06, 0.87, 0.91),
        connections: [
          ["envelope", "density", 3, 9],
          ["edgeRun", "fold", 0, 0.16],
          ["progress", "width", 0.3, 0.9],
        ],
      },
      {
        id: "fourths-under-current",
        name: "Fourths under current",
        ride: "Coupled interior crossing",
        listen:
          "Counterclockwise key movement meets a fourth-based stack. Chroma loss reduces the note stream as lightness opens the filter.",
        tweak:
          "Compare harmony changes at one and two before increasing effect depth.",
        music: {
          tonic: 7,
          mode: "mixolydian",
          stack: "quartal",
          progression: "fourths",
          arp: "outward",
          destinationStep: 2,
        },
        journey: { advance: "progress", changes: 2 },
        probe: route(10, 150, 0.42, 0.25, 0.8, 0.28, -0.2),
        connections: [
          ["chromaChange", "density", 3, 12],
          ["value", "brightness", 800, 4800],
          ["envelope", "saturate", 0.04, 0.24],
          ["progress", "width", 0.4, 0.9],
        ],
      },
      {
        id: "fractured-halo",
        name: "Fractured halo",
        ride: "Dense chromatic ride · experimental",
        listen:
          "A Lydian-dominant field keeps a tonal anchor under restrained wavefolding and clocked fragments. The texture swells around the middle of the arc.",
        tweak:
          "Wavefold and shred blends can be lowered independently; the note stream remains intact.",
        music: {
          tonic: 3,
          mode: "lydian-dominant",
          stack: "thirteenth",
          progression: "modal",
          arp: "weave",
          destinationStep: 3,
        },
        sound: {
          shred: 0.12,
          shredRate: 7,
          shredLength: 0.13,
          shredScatter: 0.4,
          inside: 0.015,
          crossover: 0.04,
          crossGap: 0.035,
          detune: 0.035,
        },
        journey: { advance: "progress", changes: 3, duration: 8 },
        probe: route(325, 195, 0.58, 0.02, 0.96, 0.96),
        connections: [
          ["envelope", "density", 6, 16],
          ["envelope", "fold", 0.03, 0.24],
          ["edgeRun", "shred", 0.02, 0.2],
          ["progress", "width", 0.4, 0.95],
        ],
      },
    ],
  },
];

export type JourneyStudy = Preset & {
  familyId: string;
  ride: string;
  listen: string;
  tweak: string;
};
export const STUDY_FAMILIES = RECIPES.map((family, familyIndex) => ({
  id: family.id,
  name: family.name,
  description: family.description,
  presets: family.variations.map(
    (v, i): JourneyStudy => ({
      id: `journey-${v.id}`,
      name: v.name,
      scope: "all",
      updatedAt: "2026-09-12T12:00:00Z",
      familyId: family.id,
      ride: v.ride,
      listen: v.listen,
      tweak: v.tweak,
      notes: `${family.name} · ${v.ride}. ${v.listen} Try: ${v.tweak}`,
      setup: sanitizeSetup({
        parameters: {
          ...DEFAULTS,
          ...SOUND_MODELS.find((m) => m.id === (v.model ?? family.model))!
            .values,
          ...family.sound,
          ...v.sound,
          instrument: v.model ?? family.model,
          volume: 0.42,
          freeze: 0,
          music: {
            ...DEFAULTS.music,
            motifAdvance: "manual",
            rest: 0,
            ...family.music,
            ...v.music,
            seed: 12001 + familyIndex * 101 + i * 17,
          },
        },
        journey: {
          ...JOURNEY_DEFAULTS,
          ...family.journey,
          ...v.journey,
          path: "probe",
          probe: v.probe,
          repeat: false,
        },
        mappings: v.connections.map(
          ([source, target, low, high, curve = "ease", smooth = 0.22], n) => ({
            id: `study-${n}`,
            enabled: true,
            source,
            target,
            low,
            high,
            curve,
            smooth,
          }),
        ),
      }),
    }),
  ),
}));
export const JOURNEY_STUDIES = STUDY_FAMILIES.flatMap((f) => f.presets);
