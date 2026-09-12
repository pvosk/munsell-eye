# Chroma Glider — current engineering and design brief

Updated 11 September 2026.

Read the [full engine, gameplay, course, and sonic handoff](archive/2026-09-11-chroma-glider-engine-gameplay-sound-brief.md). It is the current reference for the game and sound-design tasks.

The [campaign snapshot](archive/2026-09-11-chroma-glider-campaign-snapshot.json) preserves exact paint definitions and 34 primary / 14 alternate specimens across 12 chapters. Stored labels and calibrations are historical configuration, not blanket certification under the latest evaluator.

## Baseline

- Public application: v63; source 433eec7fd79a54ee09d96b3cf9f61909caa4dc54.
- Reconciled GitHub application tree: 2beedca736d53450f195d75ef040a6a20ffa5329, identical to the public source tree.
- Current journey policy: journeys-2-value-led; finish profile: finish-profile-1.
- Mixture scoring: Euclidean OKLab; current live tolerance 0.0294.
- Sound lab: separate /sound-lab instrument, not integrated with gameplay.
- This update changes documentation only, not the public game.

## Non-negotiable distinctions

Preserve pigment strength. Separate dose timing from flight animation. Score the original mixture endpoint, not target overlap or capture geometry. The visible global field is not the palette’s exclusively reachable gamut. Free base is one unscored part, not neutral paint. Style availability is not style resistance. Stored witness routes are not globally proven optimal routes.

## Offline inverse-planning pilot

Read the [11 September inverse-planning findings](play-inverse-planning-findings.md) and its linked reproducible results. The pilot expands acceptable recipe endpoints and works backward through finishing pours, then independently audits competing routes. It found more supported witnesses but no all-base style-resistant finalists. This is research tooling, not a live generator replacement.

The [12 September recipe-blind validation study](play-blind-validation-findings.md) qualifies the pilot: shortest-found counts agree for 25/27 tested bases, with two known misses in the new checker. A ride classification changes with path sampling resolution, and raw minimum additions can differ from timing-supported minimum additions. Do not treat the unchanged live classifier as having incorporated these findings. Joint palette optimization is deferred pending measurement correction.

## Two-task working agreement

The game task now uses `/Users/atg_la02_macstudio/Documents/ChatGPT/Munsell Eye` on `main`. The sound task uses `/Users/atg_la02_macstudio/.codex/worktrees/10be/Munsell Eye` on `codex/sound-design`. The original repository remains intact at its previous Documents/Codex location, detached at efc2ede, with its pending sound notes preserved. Do not continue parallel edits or publish from that old checkout. The historical `candidate-search` archive is preserved and ignored in the game workspace.

Use one publisher for the integrated result. Game work owns physics, course analysis, campaign data, and game UI; sound work owns its instrument until shared event hooks are agreed. Coordinate shared dependencies, navigation, and styles. Worktrees isolate edits, not shared ports or deployment destinations. Sound notes copied during handoff remain on the sound branch pending integration.

## How to keep this current

For a material change:

1. Record the source commit, live version, affected engine/analysis versions, and validation actually performed.
2. Update this entry point; add a dated archival brief or change note without silently rewriting past findings.
3. Refresh the campaign snapshot when specimens or pigment definitions change.
4. Recheck the appropriate measurements: timing edits affect windows; tolerance affects success and shortcuts; pigment edits affect geometry; display mapping affects world-distance metrics.
5. Keep private lab exports out of the repository.
6. Clearly mark proposed sound mappings and unimplemented course modes.

A future task can begin with: “Read docs/chroma-glider-current.md and its linked debrief before changing the game or integrating audio.”
