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

## Texture and vocal follow-up — 12 September 2026

Sound now contains **Parallel texture**, **Buffer shredder**, and **Vocal glide** controls. Texture branches mix into the clean input before the ribbon/delay stage with summed-weight normalization. Saturation uses two serial x/(1+abs(x)) stages; wavefolding uses the core Fold UGen. Crossover is a controllable dead-zone transfer; inside-out uses a smoothed sign transfer that maps zero input to zero output. These are original core-UGen approximations, not the CrossoverDistortion or InsideOut extension binaries. They do not create intrinsic stereo widening. All four blends default to zero.

The shredder uses a regular slice clock, adjustable window duration, randomized lookback offsets, and per-slice reverse probability. It reads the existing six-second live buffer and is independent from stochastic grains and motif playback. Clear effect memory clears its audio; audio pause suspends the clock; Stop all still clears and mutes. Shred blend defaults to zero. Slice randomness is not currently controlled by the musical seed.

The Vocal glide sound model adds a saw/noise source through three interpolated vowel formants to the continuous shot bank. Its emitted arpeggios remain soft synth. It is a synthetic vowel candidate, not sampled singing or a realistic voice claim. Sound controls vowel, formant transposition, breath and vibrato. Journey controls launch semitone offset, shot glide curve, and note-transition lag. Launch offset follows shot progress toward zero; harmonic destination frequencies follow the existing harmonic engine. Capture invokes the existing resolution voice-leading; a miss retains its current harmony. The glide's semitone offset is separate from frequency lag between destination changes.

A complete Vocal glide starter maps progress to oo→ah opening. Movement mapping exposes texture amounts, shredding, vowel/formants, breath/vibrato and glide time/start. Scoped Journey presets own glide settings; scoped Sound recall preserves those Journey choices. Complete presets and JSON exports retain everything; old presets get zero texture blends automatically.

Validation: production build, TypeScript, targeted lint, journey/mapping/preset round-trip checks, and real browser SC rendering passed. All four starting models and five texture branches produced finite audio; combined stress peak stayed below the output ceiling; pause/capture behavior passed and Stop all measured digital silence. This verifies operation, not subjective sound quality or combined game/mobile performance. No new schema, gameplay source, or hosting configuration changed in this follow-up.

## Optional main melody grid

Journey → Main melody → Custom melody grid enables an 8/16-step monophonic foreground phrase. Rows are 15 scale degrees, labeled with note names from the current key/tuning; click a selected note again for a rest. Grid contents survive the procedural/grid toggle, and the hidden second half survives switching to 8 steps. Clear affects visible steps; copy duplicates the first eight. The global Undo settings change remains available.

Each main note anchors zero to three quieter offspring, generated using the existing arpeggio, stack, octave and variation settings in the same scale. Rests suppress the entire step including offspring. Main notes are never randomly skipped. The optional progression-degree follow shifts the anchors by the active progression degree; key changes (including fifths progressions) still affect the scale in both modes. This is a scale-relative editor, not fixed absolute MIDI notes. The continuous body/pedal remains the harmonic background; the grid defines the foreground phrase. Existing frequency limits and sound/tension processing still apply.

Use grid timing explicitly selects the existing motif-tempo clock. Density timing remains available and advances the same sequence at the mapped emission rate. Phrase-once audition stops the current Journey sources, wakes muted output, and schedules only the phrase; shared effect tails may continue. Repeating motif playback and shot playback use the same generator. Grid trailing rests and offspring subdivisions are included in phrase duration. The existing journey/complete preset and account/JSON formats retain the new fields through MusicSettings; legacy presets default to procedural.

Validation includes actual browser engine note events matching the drawn four-note/rest test shot, phrase audition after master stop, pure motif timing/offspring/alternative-tuning tests, existing preset round-trips, TypeScript/lint/build and transport/audio checks. No game math, schema, runtime binary or SynthDef changes for this feature. Physical touch use and subjective listening are still unverified.

## Resolution and harmonic readout

Journey's Harmony & resolution panel displays current, next, and destination chord notes and progression position. Resolve to chooses a position in the selected progression (including 12 positions for fifths/fourths); position zero preserves the previous return-to-start default. Custom cents tuning remains fixed and resolves tension rather than changing progression chords. Both destination and the motif automatic/manual clock save through MusicSettings.

Resolve now during a shot enters the same successful arrival path as capture, holds the selected destination against hue/progress updates, and leaves the saved arrival outcome and repeat configuration unchanged. During motif/idle audition it plays a destination chord and holds further automatic progression. Leave resolution releases that hold; Next harmony resumes development. Idle Next harmony audibly previews the new chord, and during a motif it starts a new phrase with the new harmony. Automatic shot advancement disables the manual Next button while moving. Starting a motif now ends prior Journey source nodes, preventing an abandoned flight drone.

The convergence ending previously reached full convergence only as amplitude reached zero. Capture now reaches full convergence in the first 30% of arrival, removes residual detune at convergence, allows the destination chord to sound, then fades in the final 35%. Misses keep their open fade. The fresh Chromatic convergence complete starter uses a spread triad, lower detune/echo, and no granular residue; existing saved presets are preserved. Load the complete starter to compare the retuned preset. Old echo/reverb audio is not retrospectively repitched.

Validation: actual browser SC commands reached convergence=1 and detune=0 while source gain stayed above 0.1, with nonzero measured output. Manual resolution from a hue-driven miss entered arrival and held destination position 2 through settling; motif resolve/release worked; prior automatic capture/miss, grid, transport and stress checks passed. Pure arrival-envelope and destination preset round-trip tests, 1728 harmony tests, build/TypeScript/lint pass. This verifies timing and engine behavior, not subjective reproduction of THX or listening quality.

## Shot-first refinement

The sticky transport sits beside Journey / Sound / Mapping: Play shot (P or Space outside text/edit controls), Pause/Resume, Stop, Loop, Resolve, and a starting-setup picker. Escape still stops sources and effect memory. Explicit Play can enable audio. Resolve acts on an active shot/motif; idle Resolve demo plays a complete capture audition, preserving the saved arrival outcome. A capture override survives live control edits. The map is in an expandable “Shape one journey” panel; Shape the music is first within Journey, with compact key/mode/stack/progression controls, Next beside Play motif, model-accented progression tiles, resolution controls, and advanced musical controls folded below. The melody grid and vocal controls follow. Tiles visualize progression positions, not a universal hue-to-key mapping.

The user chose a hue/value sketch with separate chroma controls. Drag Start, Landing, or Target; arrow keys also adjust focused handles. Made shot joins landing and target. Miss sketches preserve an independent target. Hue movement crosses the wrap without reversing the saved path. Chroma remains a boundary fraction, not absolute colorfulness. Target proximity adds a continuous normalized OKLab-distance audition signal (0.4-distance reference), independent from capture. Real paint traces continue using existing endpoint scoring. Probe geometry is a sketch, not a certified game route.

Live controls update the current engine, probe samples and movement signals. Duration edits preserve normalized in-flight progress. Loops restart with current parameters and freshly sampled probe paths; toggling Loop off prevents further repeats, and enabling it after settling restarts the clock. Paint recipe changes recalculate their trace asynchronously. Loading a setup retains the user's Loop toggle rather than silencing playback. Instrument changes release previous foreground notes and clear old effect memory for a cleaner source comparison; ordinary parameter edits retain tails. A struck note's original envelope is not retroactively rewritten.

Convergence now defaults to a standalone 18-voice cloud with no arpeggio layer. Voices begin in a compact register, wander on independent seeded curves, and interpolate in pitch space toward one destination harmony. Initial spread, wander amount/rate, gathering start/curve, voice count and optional arpeggio level are adjustable. Automatic flight gathering stops short of full resolution; capture gathers completely before fading. Manual Gather can override that for audition. The fresh complete starter uses this model without additional convergence mappings. The Boundary run study demonstrates optional voice growth instead. Glass chime excitation is three times its prior amplitude with the existing limiter retained; its starter reduces the generic body and note density. Vocal's optional arpeggio layer is quieter.

The structural reference was reviewed at [THX's official Deep Note score](https://www.thx.com/deepnote/) and [Ge Wang's explanatory excerpt](https://artful.design/stuff/samples/thx.pdf). The lab keeps an original 18-voice system, seed/trajectory logic, and user-selected destination; it does not transcribe the logo's score or timing.

Mapping includes six complete Route studies: Close putt / glass breath, Boundary run / growing cloud, Value lift / opening space, Value descent / closing space, Interior setup / hanging voices, and Near pass / ribbon suspension. These are musical hypotheses informed by sections 8 and 15 of the engine handoff and the sonic addendum. They are not palette assignments or certified multi-pour/ride specimens. They load Sound, Journey and Mapping together, including instrument and geometry, and use existing portable/account preset formats.

Validation includes build/TypeScript/lint, existing 1728 harmonic tests, handle seam/target/preset tests, and real browser SC checks: convergence emits zero foreground note events with its layer off, all 18 cloud voices reach the expected harmonic targets, live geometry and brightness edits preserve progress, the next loop uses the updated path, loop-off stops repeats, idle resolve demo retains capture during edits without mutating saved miss, and previous grid/resolution/transport/stress checks pass. Browser rendering produced no hydration/runtime errors. No visual interaction or physical touch/listening QA is claimed. Reset audio once after updating an already-running session to load the new SynthDefs; settings remain intact.


## Composed studies and modular recall — 12 September

The Preset workshop below the sticky transport contains ten families with three original, complete journeys each. Six featured buttons load a complete example immediately; the family/variation selectors only browse until a Load/Use button is pressed. The sticky complete-journey selector also contains all 30, grouped by family. The four simpler starters and six earlier mapping studies remain available.

| Family | Three studies | Main comparison |
| --- | --- | --- |
| Piano rivers | Sunlit current; Braided interior; Downstream bells | Sustained tonal density, grid offspring, descending value |
| Hanging cells | Held light; Minor lantern; Small answer | Modal cells with rests, shot-to-shot changes, close putt |
| Glass ribbons | Glass thread; String reflection; Passing prism | Glass, piano and synth excitations through moving bands |
| Converging skies | Wide horizon; Suspended vault; Dark to gold | Body-only major, suspended and Dorian destinations |
| Breathing voices | Breath rising; Low exhale; Call across | Up/down glides and coupled vowel/phrase movement |
| Grain memory | Remembered steps; Reverse estuary; Frayed orbit | Forward memory, reverse swells, clocked reordering |
| Interior dialogues | One pour later; Counterweight; Returning path | Setup miss, coupled adjustment, abstract detour |
| Value spaces | Clear column; Velvet depth; Colored lift | Neutral ascent/descent versus a colorful lift |
| Other tunings | Ratio water; Sevenfold garden; Weightless steps | Approximate simple ratios, seven equal divisions, whole tone |
| Luminous pressure | Fifths in mist; Fourths under current; Fractured halo | Key movement, denser stacks and moderate parallel textures |

These studies prioritize tonal/modal material with a small experimental corner. Each includes sound settings, MusicSettings, an explicit probe/landing outcome, timing, seeded phrase choices, and three or four active mappings. No fresh randomness generates presets at page load. Built-ins use zero frozen memory and start with repeat off, but loading retains the user's current Loop setting and listening volume. Full convergence studies use no foreground arpeggios. They choose gentler gathering and longer arrival times; **they do not fix the known final convergence handoff compression**. Capture/scoring and synthesis/engine behavior are unchanged.

Routes are audition hypotheses derived from section 8 of the engine brief and the sonic addendum. The boundary remains sRGB, not a palette hull. Interior/setup/detour names do not claim certified multi-pour geometry; each probe is one shot. A miss preserves an open musical state; it does not simulate a full evolving mixture across replays. The musical reference directions informed original settings and cells, not copied recordings, scores, patches or claims of matching an artist.

### Mix and match

- **Load complete journey:** replaces the complete setup. Current listening volume and Loop transport remain.
- **Use music / saved `harmony` scope:** loads MusicSettings, root/cents, and the rhythm, advance, changes and density fields. Retains sound design, mappings, path, paint recipe, target, outcome, duration, arrival time, gap and repeat. Bringing the phrase clock with the music makes drawn-grid rhythms usable when borrowing them.
- **Use sound:** existing sound scope, retains all MusicSettings, root/cents, journey, mappings, volume and glide timing/launch/curve. Glide belongs to the existing journey scope; use Journey + music or a complete setup for that part of a vocal study.
- **Use mappings:** replaces the mapping rows; does not silently change the current instrument or rhythm. Density targets require density timing; voice-cloud and vocal controls need their respective models. The workshop explains these limits.
- **Use journey + music:** existing journey scope, including path, target/outcome, timing, MusicSettings, root/cents and glide parameters. Preserves other sound settings and mappings. Loop remains the user's transport choice.

Music scope is supported by the existing library validator, import/export and payload API; no schema/migration changes are required. Older clients that do not recognize `harmony` will need a refresh to import such a preset. Built-in studies are available without sign-in or browser storage. Download all 30 or the current family as portable version-2 JSON; imports retain complete settings and listening notes. Built-ins are never inserted automatically into the user's account library. Save refinements with Complete setup to capture a mixed combination, or one of the individual scopes for a reusable ingredient.

Validation: `test-journey-studies.mjs` checks the 30 unique studies, all 93 varying mapping connections, harmonic phrases, JSON round trips and 90 cross-family partial recalls. The existing music suite checks 1,728 harmonic combinations; the journey suite and local preset API (including `harmony` scope) remain applicable. `test-studies-audio.mjs` runs each full study through the real browser engine, measuring finite/nonzero audio, peak bounds, capture/miss state, cloud note-layer isolation and silence after Stop. These checks do not establish subjective quality, perceived loudness matching, physical touch behavior or hosted account sync.
