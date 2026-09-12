import assert from "node:assert/strict";
import {
  sampleProbe,
  moveProbePoint,
  journeyTarget,
  arrivalShape,
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
  MAPPING_STUDIES,
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

const vocal = STARTERS.find((p) => p.setup.parameters.instrument === "vocal");
assert(vocal);
const glideEdit = sanitizeSetup({
  ...DEFAULT_SETUP,
  parameters: {
    ...DEFAULT_SETUP.parameters,
    glideStart: 12,
    shred: 0.7,
    inside: 0.3,
  },
});
assert.equal(
  applyPreset(glideEdit, { ...vocal, scope: "sound" }).parameters.glideStart,
  12,
);
assert.equal(
  applyPreset(glideEdit, { ...vocal, scope: "journey" }).parameters.glideStart,
  vocal.setup.parameters.glideStart,
);
assert.deepEqual(
  readLibrary(JSON.parse(exportLibrary([{ ...vocal, setup: glideEdit }])))[0]
    .setup,
  glideEdit,
);
const gridPreset={...STARTERS[0],setup:sanitizeSetup({...STARTERS[0].setup,parameters:{...STARTERS[0].setup.parameters,music:{...STARTERS[0].setup.parameters.music,melody:'grid',melodySteps:[4,null,1,2,null,0,7,5],offspring:3,melodyFollow:true}}})};
assert.deepEqual(readLibrary(JSON.parse(exportLibrary([gridPreset])))[0].setup,gridPreset.setup);
assert.equal(applyPreset(DEFAULT_SETUP,{...gridPreset,scope:'journey'}).parameters.music.melody,'grid');
assert.equal(applyPreset(DEFAULT_SETUP,{...gridPreset,scope:'sound'}).parameters.music.melody,'procedural');

assert.equal(arrivalShape(.4,true,true).convergence,1);
assert(arrivalShape(.4,true,true).gain>.3);
assert.equal(arrivalShape(1,true,true).gain,0);
assert.equal(arrivalShape(.4,false,true).convergence,0);
assert.equal(arrivalShape(.4,false,true).gain,.6);
const destinationPreset={...STARTERS[1],setup:sanitizeSetup({...STARTERS[1].setup,parameters:{...STARTERS[1].setup.parameters,music:{...STARTERS[1].setup.parameters.music,destinationStep:2,motifAdvance:'manual'}}})};
assert.deepEqual(readLibrary(JSON.parse(exportLibrary([destinationPreset])))[0].setup,destinationPreset.setup);

const sketch=sanitizeSetup({...DEFAULT_SETUP,journey:{...DEFAULT_SETUP.journey,probe:{...DEFAULT_SETUP.journey.probe,hue:350,hueTravel:40}}});
const dragged=moveProbePoint(sketch.journey,'land',35,.7);
assert.equal(dragged.probe.hueTravel,45);
const movedStart=moveProbePoint(sketch.journey,'start',5,.6);
assert.equal(movedStart.probe.hueTravel,25);
assert.equal(movedStart.probe.hue,5);
const missSketch=sanitizeSetup({...sketch,journey:{...sketch.journey,outcome:'miss',target:{hue:90,lightness:.8,edge:.3}}});
const missPath=path(missSketch.journey.probe);
assert(signalPath(missPath,3,journeyTarget(missSketch.journey,missPath)).at(-1).targetNear<.99);
assert.equal(signalPath(missPath,3,journeyTarget(sketch.journey,missPath)).at(-1).targetNear,1);
assert.deepEqual(readLibrary(JSON.parse(exportLibrary(MAPPING_STUDIES))),MAPPING_STUDIES);
assert.equal(MAPPING_STUDIES.length,6);
