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
- These public version references are the archived baseline, not a fresh deployment verification. See the sound checkpoint for the shared-journey implementation and integration status; these changes have not been independently published by the sound task.

## Non-negotiable distinctions

Preserve pigment strength. Separate dose timing from flight animation. Score the original mixture endpoint, not target overlap or capture geometry. The visible global field is not the palette’s exclusively reachable gamut. Free base is one unscored part, not neutral paint. Style availability is not style resistance. Stored witness routes are not globally proven optimal routes.

## Current sonic direction

Music originates in discrete shots: hold, release and propulsion, travel with arpeggiated wakes, settle, and confirmed capture. Ambient sound connects those gestures. Palette-specific tuning, instruments, density, motifs, and resolution can vary widely while that structure stays consistent. Paints need not each be an instrument.

Global color context, palette reachability, individual pigment additions, and musical memory are distinct possible inputs; their mapping is still being designed. Near passes do not authorize full resolution. The glass ribbon effect remains an audible reference to investigate, not an established production recipe. The addendum records current filter/granular limitations and proposed comparisons. The shared Journey / Sound / Mapping lab is implemented on the sound branch; no live gameplay audio hooks or independent sound publication accompany it.

The [shot-led lab design proposal](sound/shot-lab-design.md) records the design discussion about multiple approaches to resolution, shared harmonic control of dense arpeggios, and the proposed Shot Studio, Color & Motion, and Instrument & Ribbon surfaces. The [sound checkpoint](sound/checkpoint.md) and [current sound-lab README](../sound-lab/README.md) record implemented behavior, validation, and handoff status.

## Two-task working agreement

Confirmed 12 September: sound work uses `/Users/atg_la02_macstudio/.codex/worktrees/10be/Munsell Eye` on `codex/sound-design`; main game work uses `/Users/atg_la02_macstudio/Documents/ChatGPT/Munsell Eye` on `main`. The main game chat owns integration and publication. Sound changes receive separate checkpoints and an explicit handoff with validation; do not edit or publish from the other checkout. Game work owns mixing, course analysis, campaign data, and game UI; sound work owns its instrument until shared event hooks are agreed. Coordinate shared dependencies, navigation, and styles. Main explicitly approved sound ownership of the narrow Sound Lab navigation repair.

## How to keep this current

For a material change:

1. Record the source commit, live version, affected engine/analysis versions, and validation actually performed.
2. Update this entry point; add a dated archival brief or change note without silently rewriting past findings.
3. Refresh the campaign snapshot when specimens or pigment definitions change.
4. Recheck the appropriate measurements: timing edits affect windows; tolerance affects success and shortcuts; pigment edits affect geometry; display mapping affects world-distance metrics.
5. Keep private lab exports out of the repository.
6. Clearly mark proposed sound mappings and unimplemented course modes.

A future task can begin with: “Read docs/chroma-glider-current.md and its linked debrief before changing the game or integrating audio.”
