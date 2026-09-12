import assert from "node:assert/strict";
import {
  JOURNEY_STUDIES,
  STUDY_FAMILIES,
} from "../app/sound-lab/journey-studies.ts";
import {
  applyPreset,
  exportLibrary,
  readLibrary,
  sanitizeSetup,
  validPreset,
} from "../app/sound-lab/presets.ts";
import {
  sampleProbe,
  signalPath,
  journeyTarget,
  mapSignals,
  OUTPUTS,
} from "../app/sound-lab/journey.ts";
import { harmonicFrame, motif, midiHz } from "../app/sound-lab/music.ts";

assert.equal(STUDY_FAMILIES.length, 10);
assert(STUDY_FAMILIES.every((f) => f.presets.length === 3));
assert.equal(new Set(JOURNEY_STUDIES.map((s) => s.id)).size, 30);
assert.equal(
  new Set(JOURNEY_STUDIES.map((s) => JSON.stringify(s.setup))).size,
  30,
);
const library = readLibrary(JSON.parse(exportLibrary(JOURNEY_STUDIES)));
let mappings = 0;
for (const [i, study] of JOURNEY_STUDIES.entries()) {
  const s = study.setup,
    p = s.parameters,
    j = s.journey;
  assert(validPreset(study), study.name);
  assert.deepEqual(library[i].setup, s);
  assert.deepEqual(sanitizeSetup(s), s);
  assert.equal(study.scope, "all");
  assert.equal(j.path, "probe");
  assert.equal(p.freeze, 0);
  assert.equal(j.repeat, false);
  assert(s.mappings.length >= 3, study.name);
  assert.equal(
    new Set(s.mappings.map((m) => m.target)).size,
    s.mappings.length,
  );
  if (p.instrument === "convergence") assert.equal(p.shotArps, 0);
  if (j.rhythm === "motif")
    assert(
      !s.mappings.some((m) => m.target === "density"),
      "Ineffective density mapping on a motif clock",
    );
  if (p.music.melody === "grid") assert.equal(j.rhythm, "motif");
  if (j.outcome === "miss")
    assert(j.target, "Miss should have an explicit audition target");
  const samples = Array.from({ length: 193 }, (_, n) =>
    sampleProbe(j.probe, n / 192),
  );
  const signals = signalPath(samples, j.duration, journeyTarget(j, samples));
  const values = [];
  let previous = {};
  for (const signal of signals) {
    previous = mapSignals(s.mappings, signal, previous, j.duration / 192);
    values.push(previous);
  }
  for (const m of s.mappings) {
    const [, , lo, hi] = OUTPUTS.find((o) => o[0] === m.target);
    const ys = values.map((v) => v[m.target]);
    assert(ys.every((v) => Number.isFinite(v) && v >= lo && v <= hi));
    assert(
      Math.max(...ys) - Math.min(...ys) > Math.abs(m.high - m.low) * 0.015,
      `${study.name}: ${m.source} → ${m.target} barely changes`,
    );
    mappings++;
  }
  for (const step of [0, 1, 2, 3, p.music.destinationStep]) {
    const frame = harmonicFrame(p.music, step);
    const tones =
      p.music.source === "custom"
        ? p.intervals.map((c) => 69 + 12 * Math.log2(p.root / 440) + c / 100)
        : frame.tones;
    const notes = motif(
      p.music,
      tones,
      p.music.source === "custom" ? tones : frame.scale,
      0,
      frame.degree,
    );
    assert(
      notes.some((n) => !n.skip),
      `${study.name}: empty phrase`,
    );
    assert(
      notes.every((n) => Number.isFinite(n.midi) && Number.isFinite(n.beat)),
    );
    assert(
      notes
        .filter((n) => !n.skip)
        .some((n) => midiHz(n.midi) >= 35 && midiHz(n.midi) <= 2200),
    );
  }
}
// Cross-family composition: musical scope changes clocks, never the user's geometry/outcome.
const current = structuredClone(
  JOURNEY_STUDIES.find((s) => s.id === "journey-call-across").setup,
);
current.parameters.volume = 0.17;
current.journey.repeat = true;
for (const study of JOURNEY_STUDIES) {
  const music = applyPreset(current, { ...study, scope: "harmony" });
  assert.deepEqual(music.parameters.music, study.setup.parameters.music);
  assert.equal(music.journey.rhythm, study.setup.journey.rhythm);
  assert.equal(music.journey.advance, study.setup.journey.advance);
  for (const key of [
    "probe",
    "path",
    "paint",
    "target",
    "outcome",
    "duration",
    "arrival",
    "gap",
    "repeat",
  ])
    assert.deepEqual(music.journey[key], current.journey[key]);
  for (const key of Object.keys(current.parameters).filter(
    (k) => !["music", "root", "intervals"].includes(k),
  ))
    assert.deepEqual(music.parameters[key], current.parameters[key]);
  assert.deepEqual(music.mappings, current.mappings);
  const sound = applyPreset(current, { ...study, scope: "sound" });
  assert.deepEqual(sound.parameters.music, current.parameters.music);
  assert.deepEqual(sound.journey, current.journey);
  assert.deepEqual(sound.mappings, current.mappings);
  assert.equal(sound.parameters.volume, 0.17);
  const map = applyPreset(current, { ...study, scope: "mapping" });
  assert.deepEqual(map.parameters, current.parameters);
  assert.deepEqual(map.journey, current.journey);
  assert.deepEqual(map.mappings, study.setup.mappings);
  const scoped = { ...study, scope: "harmony" };
  assert(validPreset(scoped));
  assert.equal(
    readLibrary(JSON.parse(exportLibrary([scoped])))[0].scope,
    "harmony",
  );
}
console.log(
  `Passed 30 full journeys, ${mappings} active route mappings, harmonic phrases, portable libraries and 90 cross-family partial recalls.`,
);
