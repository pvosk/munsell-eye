# Route design engine · routes-2

This pass changes the offline evaluator and adds a separate lab bank. Normal courses, pigment mixing, controls, camera, and old attempt snapshots are unchanged. The three substituted palettes appear only in the lab. All new measurements use the live 0.0294 Oklab tolerance, including shortcut searches, timing windows, setup regions, and example-route validation. Old banks retain their original calibration.

## Competition comes first

For each target, every pure base is searched with 129 one-pour samples and a 25×25 two-pour grid for every paint order, including returns and repeated additions. Six separated starting samples per order receive coordinate refinement. Three-pour solutions are witnesses from permutations of the generating recipe, not an exhaustive search over all three-pour mixtures. “Fewest found” is not a proof of a global minimum; a null base means no solution found, not unreachable.

Consecutive same-paint pours are combined when their summed absolute amount fits one legal charge. Later charge times are reconstructed to preserve their original absolute doses. If the combined dose exceeds capacity, the split remains an execution requirement. This does not merge additions separated by another paint; competing shorter orders are searched independently.

Only the fewest-found addition count **within each base** can qualify for a style. The widest-finishing route is retained first, then style alternatives at that same count. A longer attractive witness cannot hide a shorter competitor. Minimum travel considers every successful sampled shortest-count candidate before representative orders are truncated. Up to three orders per base are shown.

## Shared gates

- Target is at least 1.8 landing tolerances from every pure paint.
- Every solved base's shortest-count sampled travel is at least 14 world units.
- At least two bases have an efficient route with a full finishing interval of at least 55 ms, locally meaningful additions, and at least 4% successful setup cells where a setup exists.
- At least one of those bases has an efficient route meeting the requested style.

The previous 0.60 travel-ratio rejection is removed. Travel balance is reported, not enforced: two worthwhile starts may have unequal lengths. A palette can offer different experiences from different bases.

“Meaningful” still includes a local omission test: remove a pour and replay later controls. It is **not** a universal proof of necessity. Legal split merging and shorter-order competition address the known false positives without claiming exhaustive optimization.

## Style briefs

| Brief | Additional evidence |
|---|---|
| Chromatic ride | At least one individual pour travels 36 world units with at least 80% of its length above Oklab chroma 0.06; at least 80% of the entire route is above that chroma. Target chroma at least 0.07; every solved base's shortest-count travel at least 30. |
| Setup → lift | At least two meaningful additions, at least 6 units of pre-finish travel, final Oklab lightness increase over 0.10, final travel at least 9. No one-pour solution found from **any** base. White starts remain allowed but do not themselves supply the measured final lift. |
| Coupled balancing | At least two meaningful additions and a measured opposing movement pair. Both a/b movements exceed 0.025, with directional cosine below −0.25. Either both added paints are chromatic, or a chromatic addition in that pair changes absolute lightness by over 0.07. No one-pour solution found from any base. |
| Interior reference | At least two additions, all locally meaningful, with the shared competing-route and support checks. |

Balancing measures opposing **a/b movement**, which combines hue and chroma; it does not isolate hue angle or certify that two pigments are exact complements. It is narrower than simply losing chroma, but remains a provisional interaction tag inside interior play. Rides are not exact gamut-boundary proofs. World-unit thresholds are game-design parameters, not psychophysical constants.

Setup cells vary all earlier release times within ±0.18 seconds, seven samples per dimension, re-searching the final dose at each cell. Coverage and milliseconds are control-space measurements, not player-success probabilities. Par continues to use the existing heuristic with current-tolerance route timing; no new player-performance fit is claimed.

## Controlled palette search

Six palettes each receive the same seeded cohort of 96 ratio recipes for their paint count. All three briefs are evaluated on every palette, not just its intended favorite. The tested substitutions are:

- CMY: Phthalo Blue → Cobalt Blue.
- Zorny: Ivory Black → Ultramarine Blue.
- Secondaries: Titanium White → Cadmium Lemon.

The denominator includes failures. `screened` counts preliminary passes; `confirmed` means passing the deeper local setup measurements, **not** human confirmation. Rejection counts overlap. These yields apply to this explicit ratio-sampling distribution, not to all possible colors or an unbiased volume of the gamut. Paint definitions remain RGB-derived spectral approximations with modeled tinting strengths, not brand-specific measured reflectance.

Matched test pairs use identical recipe proportions, but different target colors. The changed paint must contribute at least 3% of the recipe, and the target change must exceed half a tolerance. This compares available experiences under a controlled recipe, not identical-target difficulty. Selection favors support across bases, style coverage, and travel. No fallback silently relaxes the gates. When the fixed cohort has no matched pair, a separately reported bounded search perturbs promising recipe components by factors of 0.75, 0.9, 1.1, and 1.25. Those targeted trials are excluded from the fixed-cohort yield denominator. This batch found matched rides after 28 targeted trials and matched lifts after 24; balancing already had a match. Two known-good interior targets are separate references and excluded from yield denominators.

The report is `play-palette-experiment.json`. Regeneration is deterministic; existing published banks must never be overwritten. The lab records test ID, palette, exact target, shots, engine calibration, notes, base-comparison feedback, and optional original-versus-variant preference. Earlier rounds remain selectable and exact history replay remains available.

## What the next playtest should answer

Play naturally first. Does the brief actually occur without deliberately choosing the featured route? Replay from another suggested base. Then try the paired palette and distinguish route enjoyment from overall palette preference. Preserve surprising shortcuts as feedback: the sampled solver can still miss them. Use the two references to judge whether a new target improves on already worthwhile interior play.
