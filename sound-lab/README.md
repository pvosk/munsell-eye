# Chroma Glider sound lab

Updated 12 September 2026. The existing `/sound-lab` route now uses a shared shot audition with Journey, Sound, and Mapping views. It is still separate from live gameplay. No existing pigment definitions, mixing/scoring math, campaign data, or gameplay hooks were changed.

## Audition flow

Enable audio, choose a complete starting setup, and Play shot or Hold & release. Repeat shot is explicit and initially off. The three tabs retain the same setup. Record output captures generated stereo audio only, up to 60 seconds; no microphone or reference recording is used.

- **Journey:** all earlier modes/scales, interval stacks, arpeggios, progressions, fifths controls, custom cents, voicing, pedal, seed, and variation remain. Choose manual, per-shot, shot-progress, or accumulated-hue harmonic advancement. Shot rhythm can use independent note density or the motif's tempo, spacing, and rests. Motif playback is a separate repeating audition.
- **Sound:** generated piano-like struck strings, soft synth, glass resonators, and an original growing/converging voice bank. Model buttons load sound settings while retaining music and mappings; complete starting setups load all three sections. No acoustic piano sample, THX transcription, or verified Glass Eyes production chain is claimed.
- **Mapping:** editable source/destination connections with range, response curve, smoothing, enable, and live readout. At most one connection owns a destination, up to 12 connections. Base parameter values are never overwritten by transient mapping outputs.

A visible activity strip distinguishes shot, motif, ambient, sustain, echo, grains, and mappings. Old recorded echoes keep their original pitches; they are not automatically reharmonized.

## Transport semantics

- Pause journey freezes its timeline and new emissions; existing notes/effect tails continue. Resume continues from that position.
- Stop journey cancels its schedulers and ends its sources. Ambient sources and shared effect tails can remain. Sustained harmony is re-armed for the next shot.
- Motif and ambient have separate pause/stop controls. A paused motif retains scheduled-note timing; ambient pause stops new stochastic emissions. Ambient stop also frees its sources.
- Pause audio / Pause sound suspends the AudioContext and all musical clocks. Resume retains buffer contents and positions.
- Stop all sources / Stop sound ends source activity, clears effect memory, and mutes the output. A subsequent explicit audition wakes it. Escape does the same.
- Effects can be bypassed and their memory cleared without changing the musical settings. Free sweep oscillators can be paused independently in Sound.
- Pause mappings holds the last mapped outputs. Stop mappings returns to base parameters without deleting connections.
- Reset audio destroys the engine, context, scheduled activity, and buffers. All parameter preferences and preset records remain; audio stays off until enabled again.
- Restore all defaults resets the current controls, not saved presets. An Undo settings change action retains the prior setup.

Leaving the route or hiding the document stops audio. Voices use the audio clock for lifetime accounting so a long pause cannot defeat the voice budget. Discrete voices are capped at 36; the oldest is replaced when dense patterns need a new voice. The convergence bank has at most 18 oscillator voices with normalized gain. Browser audio limits output; actual listening and mobile performance still need review.

## Movement measurements

Sources include shot progress, color speed, cyclic hue, accumulated hue travel, absolute chroma, signed chroma development, lightness, signed lightness development, boundary proximity, accumulated boundary travel, neutral ascent, and arc envelope. Signed developments use 0.5 for no change. Hue influence fades near neutral.

Boundary proximity is **sRGB boundary chroma at the current OKLab lightness and hue**. A binary search uses the public-domain inverse OKLab conversion from https://bottosson.github.io/posts/oklab/. This is not the current palette's reachable mixture hull and not the game's Munsell display boundary. Edge travel accumulates tangential hue or lightness motion while chromatic and near that boundary. Merely standing at the boundary, or approaching it radially, does not count as a run. Neutral ascent instead accumulates upward motion at low absolute chroma.

The convergence starter maps accumulated edge travel to increasing voice count and shot progress to gathering those voices. The mappings, ranges, and curves are editable. These are experimental defaults, not a universal hue-to-harmony law.

Two trajectory sources are available:

1. Controlled color probes: gentle correction, chromatic edge travel, neutral ascent, interior crossing, and editable endpoints/curve.
2. Existing game paint mixing: lazy imports from `play-engine.ts` reuse the real palette pigments, original quantities, strength, chargeAmount, addPaint, mixtureColor, and pourPath. Zero mass uses the free one-part base and existing baseLaunchPath presentation. Save an endpoint as a target, change the starting recipe, and compare approaches; scoring uses the existing OKLab tolerance. Continue from the endpoint accumulates the original quantities.

The lab projection and timeline do not reproduce the game's camera, distance easing, decorative capture deformation, or reduced-motion presentation. Flight duration uses the existing expression on the sampled path. A probe's capture/miss selector is an explicit audition override. Paint traces with a saved target derive their outcome from endpoint scoring. Do not treat this as installed live-game audio integration.

## Presets and cross-browser use

Version 2 JSON libraries preserve parameters, harmonies, shot/probe/paint configuration, mappings, random seed, scope, name, and listening notes. Export current, one saved preset, or the whole library. Importing never starts audio. Legacy version 1 settings and browser saves migrate, including custom cents. Files contain settings, not an audio recording, and can be attached to the sound chat for analysis/storage in project presets if requested.

Scopes are complete setup, Journey + music, Sound, and Mapping. Sound-only recall keeps musical tuning and output volume. Section recall applies only its section even though the export contains the full contextual snapshot.

`/api/sound-presets` stores up to 100 presets per account in D1 using the dispatcher-provided `oai-authenticated-user-id`. The API never accepts identity from JSON. Same-origin writes, bounded request sizes, validation, and prepared owner-scoped SQL are required. Missing sign-in returns 401; database unavailability returns 503. Status messages distinguish cloud success from local drafts.

The server-rendered Sign in with ChatGPT link uses the platform-owned top-level sign-in route. Load account library pulls presets in another browser. Save preset uploads that preset when authenticated. Upload local drafts explicitly saves local copies to the currently signed-in account. Local drafts and JSON exports remain usable during logout. There is no automatic background upload of every draft after an account change.

Local-copy removal and account-copy deletion are separate, labeled actions. The generated migration `drizzle/0001_sound_presets.sql` and matching metadata must deploy with the endpoint. Existing `lab_events` is unchanged. No hosted database has been migrated by this sound task.

## Synthesis and code

Real scsynth runs through pinned SuperSonic 0.80.0 in a browser AudioWorklet. JavaScript handles bounded note scheduling and mappings. There is no sclang interpreter, desktop SC requirement, or mi-UGens dependency.

The graph writer in `sound-lab/build-synthdefs.mjs` creates chime, piano, synth, field, flight, and space SynthDefs. The piano uses decaying partials with modest string stretch and a short hammer excitation. The flight bank reveals more voices and moves them toward shared harmonic destinations. Ribbon filtering exposes band tuning, spacing, bandwidth, sweep depth/offset/rate/direction/phase. Bands can follow chord voices or a separate manual anchor. Forward/reverse buffer grains can enter before the filter or run alongside it. Delay/reverb and the final limiter remain bounded.

Regenerate with `node sound-lab/build-synthdefs.mjs`; runtime binaries do not change. `npm run sound-lab:prepare` also recopies the pinned runtime if needed. All instrument implementations are original experiments. Existing upstream licenses remain in `public/sound-lab/runtime`.

## Verification

- TypeScript, targeted ESLint, and production build.
- `node --experimental-strip-types sound-lab/test-music.mjs`: original 1,728 harmonic combinations and arpeggio/voice-leading checks.
- Bundle `test-journey.mjs` with esbuild for Node and run it: gamut boundary, edge versus neutral motion, mapping bounds/bypass, scoped presets, migrations, and JSON round-trips.
- Bundle `test-paint-trace.mjs` as Node ESM and run it: actual mixing/dose reuse, capture, free base, finite traces, duration bounds.
- `node sound-lab/test-preset-isolation.mjs`: actual API handlers with generated SQLite schema, two-owner isolation and scoped delete. Requires Node with `node:sqlite`.
- Bundle `test-presets-api.mjs` as Node ESM and run against the local dev server after local Drizzle migrations: save/load/update, anonymous rejection, input validation, and origin checks. Uses only the documented local sign-in cookie and cleans up its records.
- `test-audio-runtime.mjs`: headless Chrome runtime measurements, finite/nonzero output for three starters, journey/audio pause, master-stop silence, capture versus miss, and maximum-effects output. Set `PLAYWRIGHT_MODULE` to an available Playwright module and optionally `CHROME_PATH` / `SOUND_TEST_ORIGIN`. No DOM interaction or subjective listening assertion.

The final browser test measured silence after master Stop and no browser/engine errors. This is not certification of musical taste, visual/touch behavior, or the combined 3D game and audio workload on iPad/Safari.
