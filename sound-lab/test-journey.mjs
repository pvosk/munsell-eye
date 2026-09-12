import assert from "node:assert/strict";
import {
  sampleProbe,
  signalPath,
  gamutChroma,
  linearRGB,
  mapSignals,
  sanitizeJourney,
  sanitizeMappings,
  PROBES,
  DEFAULT_MAPPINGS,
} from "../app/sound-lab/journey.ts";
import {
  DEFAULT_SETUP,
  STARTERS,
  sanitizeSetup,
  applyPreset,
  readLibrary,
  exportLibrary,
} from "../app/sound-lab/presets.ts";
const path = (p) =>
  Array.from({ length: 193 }, (_, i) => sampleProbe(p, i / 192));
for (const l of [0.1, 0.4, 0.7, 0.9])
  for (let h = 0; h < 360; h += 20) {
    const c = gamutChroma(l, h),
      r = (h * Math.PI) / 180;
    assert(
      linearRGB(l, c * Math.cos(r), c * Math.sin(r)).every(
        (x) => x >= -1e-6 && x <= 1 + 1e-6,
      ),
    );
    assert(
      linearRGB(l, (c + 0.001) * Math.cos(r), (c + 0.001) * Math.sin(r)).some(
        (x) => x < 0 || x > 1,
      ),
    );
  }
const edge = signalPath(path(PROBES[1].probe), 3.2),
  neutral = signalPath(path(PROBES[2].probe), 2.8),
  stationary = signalPath(path({ ...PROBES[1].probe, hueTravel: 0 }), 3.2);
assert(edge.at(-1).edgeRun > 0.9);
assert.equal(neutral.at(-1).edgeRun, 0);
assert(neutral.at(-1).neutralLift > 0.7);
assert.equal(stationary.at(-1).edgeRun, 0);
assert(edge.every((s, i) => i === 0 || s.edgeRun >= edge[i - 1].edgeRun));
for (const samples of [edge, neutral, stationary])
  for (const sample of samples)
    assert(
      Object.values(sample).every(
        (x) => Number.isFinite(x) && x >= 0 && x <= 1,
      ),
    );
const row = { ...DEFAULT_MAPPINGS[1], low: 3, high: 18, smooth: 0 };
assert.equal(mapSignals([row], edge[0], {}, 0.1).voices, 3);
assert(mapSignals([row], edge.at(-1), {}, 0.1).voices > 17);
assert.deepEqual(
  mapSignals([{ ...row, enabled: false }], edge.at(-1), {}, 0.1),
  {},
);
assert.equal(sanitizeMappings([row, { ...row, id: "duplicate" }]).length, 1);
assert.equal(
  sanitizeJourney({
    duration: Infinity,
    paint: { hold: NaN },
    probe: { hue: NaN },
  }).duration,
  2.8,
);
for (const starter of STARTERS) {
  const roundtrip = readLibrary(JSON.parse(exportLibrary([starter])))[0];
  assert.deepEqual(roundtrip.setup, sanitizeSetup(starter.setup));
}
const changed = sanitizeSetup({
  ...DEFAULT_SETUP,
  parameters: {
    ...DEFAULT_SETUP.parameters,
    music: { ...DEFAULT_SETUP.parameters.music, tonic: 2 },
    volume: 0.23,
  },
});
const sound = applyPreset(changed, { ...STARTERS[0], scope: "sound" });
assert.deepEqual(sound.parameters.music, changed.parameters.music);
assert.equal(sound.parameters.volume, 0.23);
assert.deepEqual(sound.mappings, changed.mappings);
const music = applyPreset(changed, { ...STARTERS[0], scope: "journey" });
assert.equal(music.parameters.instrument, changed.parameters.instrument);
assert.deepEqual(music.parameters.music, STARTERS[0].setup.parameters.music);
const legacy = readLibrary({
  version: 1,
  name: "legacy",
  parameters: { root: 123, intervals: [0, 200, 400, 500, 700, 900] },
})[0];
assert.equal(legacy.setup.parameters.music.source, "custom");
assert.throws(() => readLibrary({ format: "bad", version: 2, presets: [] }));
console.log(
  "Passed gamut boundary, edge-travel vs neutral ascent, stationary edge, mapping curves/bypass/bounds, preset scope, legacy migration and library round-trips.",
);
