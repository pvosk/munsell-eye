# Sound task checkpoint

Updated 12 September 2026, shared-journey implementation.

## Ownership

Sound worktree is `/Users/atg_la02_macstudio/.codex/worktrees/10be/Munsell Eye`, branch `codex/sound-design`. Main game worktree is `/Users/atg_la02_macstudio/Documents/ChatGPT/Munsell Eye`, branch `main`. Main owns integration and publication. No independent sound deployment or edits in the other checkout.

The prior navigation repair `062b756` was integrated by main as `003cea1`; sound documentation `6b8fe7a` was handed off separately. Do not infer a public release from integration alone.

## This implementation

User approved the shared Journey / Sound / Mapping build, diverse tunable sound models, preset sharing/cross-browser persistence, and separate section transports versus audio/preferences resets.

The existing `/sound-lab` now implements that surface. It retains the original musical system and adds generated piano, synth, glass ribbon, and convergence voices; editable smoothed mappings including boundary travel and neutral ascent; repeatable probes plus existing-engine paint traces; and owner-scoped D1 presets with portable JSON libraries and legacy migration. See [sound-lab README](../../sound-lab/README.md) for precise behavior and known limits.

New schema is isolated to `sound_presets`. Main confirmed no concurrent schema/migration edits. Keep the endpoint, schema addition, `0001_sound_presets.sql`, and generated journal/snapshot together. Existing tables and hosting bindings remain unchanged. Local test migrations were applied only to this worktree's test database. No hosted migration or publication by sound.

## Boundaries and remaining review

Mixing, charge, pigment strength, mass and endpoint scoring are imported from the existing game. Game source files are unchanged. The lab is an audition projection, not the full game camera/capture presentation, and no gameplay audio hooks have been added.

The edge reference is explicitly the sRGB boundary in OKLab, not the palette's reachable hull or Munsell field boundary. Palette-relative boundary estimation and live gameplay observation remain future coordinated work. Generated piano is not an acoustic sample. The three reference-inspired sound models are original candidates for user listening, not claimed reproductions.

Transport, math, preset/API, and browser synthesis checks are recorded in the sound README. Physical iPad/touch interaction, final visual QA, subjective listening, deployed sign-in, cross-browser cloud sync on the hosted site, and combined 3D/audio performance remain unverified. Main should run its integrated build and apply the generated migration as part of an authorized release.

Source/settings changes are reviewable independently from private audio reference files. No supplied recording has been added to the repository.

## Audio-only follow-up

After b8c4af7, user authorized adding parallel distortion, wavefolding, buffer shredding and vocal glides while main research continued, and pushing this sound branch to GitHub. GitHub permissions confirmed push access. This follow-up adds 19 saved parameters, 15 mapping destinations, a Vocal glide model and complete starter, and separate Journey glide controls. Details and validation are in the sound README. No additional schema/migration or game math changes.

Main reports offline research now archived as 83d2aa5 with a clean main checkout. Main remains the integration/publication owner. GitHub branch availability is not evidence of a public Sites release.

## Main integration and public release — 12 September 2026

Main integrated documentation 6b8fe7a and sound checkpoints b8c4af7 / 008644c as d243747 / cb98065 / 6f61a8d. Public v64 uses 06c5c5c10738e48c2f9b72374c15f9561cff2809. Sites deployment appgdep_6aa4f2e8cf24819194885cec18aae24c succeeded with the generated 0001_sound_presets migration included in the validated package.

Combined production build, TypeScript, targeted ESLint, Journey/mapping/preset round trips, paint trace, 1,728 music cases, owner isolation, and local D1 save/load/update/delete and origin checks passed. Public /sound-lab returns 200 and anonymous /api/sound-presets returns 401. The platform access-bypass credential did not establish a signed-in preset owner, so hosted authenticated sync remains unverified rather than claimed tested. Previous sound-branch real-audio tests remain documented; this integration did not repeat physical iPad/listening or the combined audio/game workload. Audio remains a separate audition lab, not game-playback hooks.
## Custom melody grid follow-up

User requested an optional editable main melody in Journey while retaining procedural systems. Added saved 8/16-step scale-relative grid, rests, optional progression-degree following, zero-to-three arpeggio offspring per main note, explicit grid-timing selection, phrase-once audition, and shared shot/motif generation. Fields live in MusicSettings and existing presets. No schema, game, or SynthDef changes. Base is sound 008644c; main reports that build was integrated and public as v64 (06c5c5c). Main still owns integration and release of this subsequent grid checkpoint.

## Resolution redesign and convergence fix

User requested prominent resolution, visible current/next/destination, clearer playback clocks, and a tonal convergence finish. Added Harmony & resolution panel, selectable destination progression position, saved motif auto/manual clock, manual shot-capture resolution without changing the saved outcome, and audible idle Next harmony. Convergence gathers before the fade, zeros residual detune on capture, and the fresh complete starter uses triad/lower echo/no grains. Existing saved presets remain intact. README records validation and limitations. No schema, gameplay, or SynthDef changes. Base is d23943d; main owns release integration alongside its independent premix-start branch.
