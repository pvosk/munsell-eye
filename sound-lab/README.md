# Chroma Glider sound lab

A separate `/sound-lab` route in the existing Munsell Eye application. Includes a procedural music workbench. GitHub source and website deployment are separate steps. Game source, mixing math, campaign and live site are unchanged.

## Listening

Start the existing app with `npm run dev` and open `/sound-lab`. Press Enable sound. Pick a starting sound, drag through the audition field, compare Scatter an arc before and after Resolve, and adjust the sliders. The field is a sound audition surface, not simulated game physics.

Four starting sounds: Submerged glass, Ribbon memory, Open water, Chromatic bloom. Body controls affect new notes; effects and the sustained harmonic field respond live. Six destination intervals are editable in cents, including non-twelve-tone choices. The destination foundation stays anchored during exploration; the other sustained voices lean away from their destination intervals. Resolve moves them home. No proximity-driven cadence or game landing hook exists yet.

Saved presets use browser localStorage. Export/import JSON keeps a portable copy. Record a clip captures only the generated stereo output, never the microphone; recordings download after stopping, with a 60-second limit. Stop, Escape, hiding the tab, or leaving the route stops audio. Ambient currents can be switched off for isolated note comparisons.

## Musical systems

The main controls now expose 16 named modes/scales (including seven equal divisions), 12 scale-derived interval stacks, 11 arpeggio patterns, 8 progression choices, key/register, voicing, pedal, note pool, tempo, spacing, phrase rests, octave range, seeded variation and phrases per harmony. Circle-of-fifths controls transpose the musical center. Six original musical presets are starting points, not transcriptions of the reference recordings.

Play motif repeats a phrase; Scatter an arc auditions it once. Resolve returns to the initial harmonic frame and holds progression there. Pattern changes enter at the next phrase. Sustained harmony is a separate, initially disabled layer. The original Hz/cents editor remains available under Advanced and old saved settings migrate to that custom system. Sound-character presets keep the current musical settings.

Pitch bending now defaults to zero and the base chime partial ratios are harmonic. Optional microtonal lean, inharmonic material, fixed pedals across changing keys and pitch-shifted grains can intentionally produce tension. Existing echoes retain their pitches when the current key changes.

Reset audio destroys the audio engine and its AudioContext, clears voices, delay/reverb state and the grain buffer, stops the motif, disables sustain/freeze and leaves sound off. Other settings are kept. Reset controls instead restores default parameters.

Forward granular clouds now have amount, density, lookback, scatter and freeze controls, alongside backward grains and shared fragment length/transposition. No user recording is needed to feed them.

Run `node --experimental-strip-types sound-lab/test-music.mjs` to check scale membership, all arpeggio types, deterministic phrases, circle closure, voice-leading pitch classes and input limits. Browser checks confirmed motif playback, full reset, restart, movement around fifths and return-home resolution through the actual controls. These supplement the earlier audio measurements.

## Audio architecture

Real SuperCollider scsynth runs in a browser AudioWorklet through SuperSonic 0.80.0, in postMessage mode. No desktop SC installation, remote audio service or CDN is required. Assets are loaded only after Enable sound. This is the SC synthesis server, not an sclang interpreter; arbitrary SC scripts cannot be pasted into this lab.

- `app/sound-lab/engine.ts`: runtime lifetime, JS scheduling, bounded voice count, control updates and recording.
- `app/sound-lab/music.ts`: harmonic systems, pattern generation, progression and voice leading.
- `app/sound-lab/music-panel.tsx`: musical controls and current-note names.
- `app/sound-lab/parameters.ts`: ranges, presets, destination intervals and defensive import normalization.
- `sound-lab/build-synthdefs.mjs`: small binary SynthDef graph writer for three fixed original instruments. Writes standard SC SynthDef v2 files; not a general compiler.
- `chroma_chime`: noise-excited Ringz resonators, the building blocks into which DynKlank expands, with independently weighted partials and decay times.
- `chroma_field`: six gently breathing sustained voices, a fixed foundation and movable upper intervals.
- `chroma_space`: moving resonant filter bands, stereo delays, explicit backward GrainBuf playback of recent pre-effects audio, reverb, DC filtering and limiting.

The ribbon and reverse combination is an original experiment toward the described sound, not a verified Glass Eyes reconstruction. mi-UGens is not included or claimed to work in this build. Stereo placement is implemented; game-camera-relative 3D audio is future work.

Run `npm run sound-lab:prepare` after changing the graph writer or reinstalling/upgrading the audio packages. This regenerates SynthDefs and copies the pinned runtime files to `public/sound-lab`. Runtime assets are checked into this working change to keep normal app builds independent of a new preparation step.

## Musical direction and next work

Overlapping ambient waves remain open through misses, cancellation and resets. Palettes and holes can establish instrumental character; paints may steer harmonic relationships, register and arpeggio gestures. Later, shot arcs should leave a delayed wake and only the actual landing event should complete resolution. Preserve pigment strength and accumulated-mixture behavior.

Current irregular note scheduling uses original coupled evolving values and bounded note clusters. Yota Morimoto’s ambient processes are references, not copied source. Further listening should shape this behavior and tune the present patches before integrating shots or adding more complex synthesis.

Future game integration must reuse `app/play.tsx`, `app/play-scene.ts` and `app/play-engine.ts` through narrow observation hooks. No duplicate app or Sites project. The lab route itself is not access control; publication still requires separate user authorization.

## Verification (2026-09-11)

- TypeScript check, targeted ESLint and full app production build passed.
- Headless Chrome ran the actual local WASM engine and measured finite, nonzero dry, wet and resolution output.
- Isolated backward grains produced audio after the source group was freed, confirming the reverse path independently of the dry chime.
- Stop and stop-after-resolution measured digital silence. Cancelled startup did not leave the engine running.
- Dense maximum-effect test stayed below the output ceiling; note count stayed at the 24-voice cap.
- MediaRecorder output decoded to a nonempty stereo audio clip.
- The local runtime makes optional HEAD metadata requests which Chromium reports as aborted. Required GET asset loads and audio execution succeeded; those HEAD-only events were tracked separately from failures.

These are runtime checks, not subjective listening or mobile/Safari performance validation. The combined 3D game and audio workload has not yet been tested. Browser controls still need the user's listening feedback.

## Third-party runtime

Pinned npm packages: `supersonic-scsynth@0.80.0`, `supersonic-scsynth-core@0.80.0`. Source: https://github.com/samaaron/supersonic . The distributed package license is retained at `public/sound-lab/runtime/LICENSE`; core license is retained alongside it. Upstream SuperCollider: https://github.com/supercollider/supercollider . New lab graphs and scheduling are original; no Yota or mi-UGens code is incorporated.

## References

- https://github.com/yotamorimoto/asg
- https://github.com/yotamorimoto/sclab
- https://github.com/yotamorimoto/sc_grd
- https://github.com/v7b1/mi-UGens
- https://doc.sccode.org/Classes/DynKlank.html
- https://doc.sccode.org/Reference/Synth-Definition-File-Format.html
- https://github.com/samaaron/supersonic
- https://github.com/supercollider/supercollider/blob/develop/README_WASM.md
