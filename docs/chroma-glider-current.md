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

## Two-task working agreement to adopt

Use separate worktrees for concurrent code work and one publisher for the integrated result. Game work owns physics, course analysis, campaign data, and game UI; sound work owns its instrument until shared event hooks are agreed. Coordinate shared dependencies, navigation, and styles. This recommendation has not automatically moved either task.

## How to keep this current

For a material change:

1. Record the source commit, live version, affected engine/analysis versions, and validation actually performed.
2. Update this entry point; add a dated archival brief or change note without silently rewriting past findings.
3. Refresh the campaign snapshot when specimens or pigment definitions change.
4. Recheck the appropriate measurements: timing edits affect windows; tolerance affects success and shortcuts; pigment edits affect geometry; display mapping affects world-distance metrics.
5. Keep private lab exports out of the repository.
6. Clearly mark proposed sound mappings and unimplemented course modes.

A future task can begin with: “Read docs/chroma-glider-current.md and its linked debrief before changing the game or integrating audio.”
