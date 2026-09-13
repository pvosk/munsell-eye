import assert from "node:assert/strict";
import {
  SOLO_KINDS,
  soloDefault,
  soloNotes,
  sanitizeSolo,
} from "../app/sound-lab/solo-settings.ts";
import {
  sanitizeSetup,
  exportLibrary,
  readLibrary,
  applyPreset,
  DEFAULT_SETUP,
} from "../app/sound-lab/presets.ts";
for (const { id } of SOLO_KINDS) {
  const s = soloDefault(id);
  assert.equal(s.parameters.music.progression, "still");
  assert.deepEqual(s.mappings, []);
  const preset = {
    id: `test-${id}`,
    name: id,
    notes: "Solo",
    scope: "all",
    updatedAt: new Date().toISOString(),
    setup: s,
  };
  assert.deepEqual(
    readLibrary(JSON.parse(exportLibrary([preset])))[0].setup,
    sanitizeSetup(s),
  );
  const notes = soloNotes(s.solo, s.parameters);
  assert.equal(
    notes.length,
    id === "convergence" ? 0 : id === "pop" ? 1 : s.solo.count,
  );
  assert(
    notes.every(
      (n, i) =>
        Number.isFinite(n.hz) &&
        n.hz > 0 &&
        (!i || n.time >= notes[i - 1].time),
    ),
  );
  if (notes.length) assert.equal(notes[0].time, 0);
  const journeySound = applyPreset(DEFAULT_SETUP, {
    ...preset,
    scope: "sound",
  });
  assert.deepEqual(
    journeySound.parameters.music,
    DEFAULT_SETUP.parameters.music,
  );
  assert.deepEqual(journeySound.journey, DEFAULT_SETUP.journey);
  assert.equal(journeySound.solo, undefined);
}
const harp = soloDefault("harp");
for (const direction of ["up", "down", "arch"]) {
  const notes = soloNotes({ ...harp.solo, direction }, harp.parameters);
  if (direction === "up")
    assert(notes.every((n, i) => !i || n.hz >= notes[i - 1].hz));
  if (direction === "down")
    assert(notes.every((n, i) => !i || n.hz <= notes[i - 1].hz));
  if (direction === "arch") assert.equal(notes[0].hz, notes.at(-1).hz);
}
assert.equal(sanitizeSolo({ count: Infinity }).count, 6);
assert.equal(sanitizeSolo({ duration: -5 }).duration, 0.15);
console.log(
  "Passed five solo defaults, finite fixed-reference patterns, glissando direction, portable solo presets and isolated sound transfer.",
);
