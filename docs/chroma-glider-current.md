# Chroma Glider — current engineering and design brief

Updated 12 September 2026.

Read the [full engine, gameplay, course, and sonic handoff](archive/2026-09-11-chroma-glider-engine-gameplay-sound-brief.md). It remains the engine and course reference. Read the [updated sonic design addendum](archive/2026-09-11-chroma-glider-sonic-design-addendum.md) alongside it for the current sound direction; the addendum supersedes earlier sonic priorities without rewriting the archival snapshot.

The [campaign snapshot](archive/2026-09-11-chroma-glider-campaign-snapshot.json) preserves exact paint definitions and 34 primary / 14 alternate specimens across 12 chapters. Stored labels and calibrations are historical configuration, not blanket certification under the latest evaluator.

## Baseline

- Public application: v63; source 433eec7fd79a54ee09d96b3cf9f61909caa4dc54.
- Reconciled GitHub application tree: 2beedca736d53450f195d75ef040a6a20ffa5329, identical to the public source tree.
- Current journey policy: journeys-2-value-led; finish profile: finish-profile-1.
- Mixture scoring: Euclidean OKLab; current live tolerance 0.0294.
- Sound lab: separate /sound-lab instrument, not integrated with gameplay.
- Integrated sound release candidate: main 6f61a8d incorporates sound checkpoints 6b8fe7a, b8c4af7, and 008644c, preserving the offline research. Combined build, type/lint checks, 1,728 harmonic cases, Journey/mapping/paint-trace tests, owner isolation, and local D1 preset save/load checks pass. Includes the append-only sound_presets migration. Public release status is recorded separately after deployment; physical iPad/listening and hosted cross-device sign-in remain unverified.
- These public version references are the archived baseline, not a fresh deployment verification. See the sound checkpoint for the shared-journey implementation and integration status; these changes have not been independently published by the sound task.

## Non-negotiable distinctions

Preserve pigment strength. Separate dose timing from flight animation. Score the original mixture endpoint, not target overlap or capture geometry. The visible global field is not the palette’s exclusively reachable gamut. Free base is one unscored part, not neutral paint. Style availability is not style resistance. Stored witness routes are not globally proven optimal routes.

## Offline inverse-planning pilot

Read the [11 September inverse-planning findings](play-inverse-planning-findings.md) and its linked reproducible results. The pilot expands acceptable recipe endpoints and works backward through finishing pours, then independently audits competing routes. It found more supported witnesses but no all-base style-resistant finalists. This is research tooling, not a live generator replacement.

The [12 September recipe-blind validation study](play-blind-validation-findings.md) qualifies the pilot: shortest-found counts agree for 25/27 tested bases, with two known misses in the new checker. A ride classification changes with path sampling resolution, and raw minimum additions can differ from timing-supported minimum additions. Do not treat the unchanged live classifier as having incorporated these findings. Joint palette optimization is deferred pending measurement correction.

The subsequent [fresh-target selection comparison](play-selection-holdout-findings.md) implements those corrections in separate offline scripts. Across 24 targets, stable measurement alone changes no eligibility counts; supported-minimum selection adds a Zorn value-shift candidate and flags a Cobalt Ember ride. Interior/balance selections persist. The recipe-blind challenger agrees on all 15 finalist raw minima, but reproduces supported minima for only 13. Live classification remains unchanged. Next research is backward setup-region proposal expansion, not further threshold tuning.

That next step has now run: [backward setup-region and palette findings](play-backward-palette-findings.md). Fixed destination colors were inverse-fitted across 12 novel palettes and six controls, then a successful white/lemon/violet/blue family received six pigment variants. Parent and ultramarine variants support cream and lavender goals; lavender has value-shift availability from all four bases and three additions found from each. Alternatives remain, and rides are less robust. Read the deeper verification and substitution archives before promoting candidates. This is still offline research, with no live palette, controls, or bank change.

The subsequent [broad discovery bank](play-broad-palette-findings.md) samples all 40,920 three/four-paint combinations in the same 32-pigment pool plus 1,536 larger sets. All 509,472 proposals are retained in portable shards, including failures and unlabeled examples. Numerical audits cover 152 targets, with 30 deeper checks; twelve are general-flag-free, but none passes majority glide/ride/value availability plus the general checks. This is broad shallow reconnaissance, not half a million verified holes or a replacement for the stronger inverse-designed family. A provisional close-indirect result was overturned and retained as a counterexample. Live gameplay and public lab are unchanged. See the bank index and reader script before running another whole-space proposal sweep.

## Two-task working agreement

The game task now uses `/Users/atg_la02_macstudio/Documents/ChatGPT/Munsell Eye` on `main`. The sound task uses `/Users/atg_la02_macstudio/.codex/worktrees/10be/Munsell Eye` on `codex/sound-design`. The original repository remains intact at its previous Documents/Codex location, detached at efc2ede, with its pending sound notes preserved. Do not continue parallel edits or publish from that old checkout. The historical `candidate-search` archive is preserved and ignored in the game workspace.

Use one publisher for the integrated result. Game work owns physics, course analysis, campaign data, and game UI; sound work owns its instrument until shared event hooks are agreed. Coordinate shared dependencies, navigation, and styles. Worktrees isolate edits, not shared ports or deployment destinations. Sound notes copied during handoff remain on the sound branch pending integration.
## Current sonic direction

Music originates in discrete shots: hold, release and propulsion, travel with arpeggiated wakes, settle, and confirmed capture. Ambient sound connects those gestures. Palette-specific tuning, instruments, density, motifs, and resolution can vary widely while that structure stays consistent. Paints need not each be an instrument.

Global color context, palette reachability, individual pigment additions, and musical memory are distinct possible inputs; their mapping is still being designed. Near passes do not authorize full resolution. The glass ribbon effect remains an audible reference to investigate, not an established production recipe. The addendum records current filter/granular limitations and proposed comparisons. The shared Journey / Sound / Mapping lab is implemented on the sound branch; no live gameplay audio hooks or independent sound publication accompany it.

The [shot-led lab design proposal](sound/shot-lab-design.md) records the design discussion about multiple approaches to resolution, shared harmonic control of dense arpeggios, and the proposed Shot Studio, Color & Motion, and Instrument & Ribbon surfaces. The [sound checkpoint](sound/checkpoint.md) and [current sound-lab README](../sound-lab/README.md) record implemented behavior, validation, and handoff status.


## How to keep this current

For a material change:

1. Record the source commit, live version, affected engine/analysis versions, and validation actually performed.
2. Update this entry point; add a dated archival brief or change note without silently rewriting past findings.
3. Refresh the campaign snapshot when specimens or pigment definitions change.
4. Recheck the appropriate measurements: timing edits affect windows; tolerance affects success and shortcuts; pigment edits affect geometry; display mapping affects world-distance metrics.
5. Keep private lab exports out of the repository.
6. Clearly mark proposed sound mappings and unimplemented course modes.

A future task can begin with: “Read docs/chroma-glider-current.md and its linked debrief before changing the game or integrating audio.”
