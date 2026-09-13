# Branching-region search: first controlled extension

13 September 2026. Research only. The ten-hole live lab is unchanged.

## What actually changed

The proposer now samples accepted **recipe endpoints around a target**, then inverts three different pigment legs to obtain fresh starts and setup states. It uses the actual mixing/color-distance function, not a spherical approximation in display coordinates. The original center-only approach runs on matched palette/target budgets as a control.

The second phase refines **one shared start and two complete branch control sequences together**, with the target and paint snapshots fixed. Shorter-route adversaries are refreshed between optimization steps. This is more than adding a demonstration leg: improvement must preserve two region-supported routes while resisting shorter alternatives.

It is still a sampled inverse-region search, **not optimization over the entire inverse image**, and not a general branching graph planner. Endpoint clouds sample 24 recipe directions; four endpoint variants per target enter this run. Connected acceptance along each ray is approximated with a 32-step scan and bisection; narrow unobserved/disconnected components can be missed. It does not optimize palette RGB/strengths, impose intermediate checkpoints, or guarantee a particular journey.

## Scope and results

| Run | Palettes | Proposals | Shortlisted endpoint challenges | Deep audits | Shortest-found three-leg cases |
|---|---:|---:|---:|---:|---:|
| Initial implementation check | 96 | 6,144 | 200 | 23 | 2 |
| Fresh larger run | 384 | 24,576 | 642 | 48 | 7 |

Each run includes five established palette controls (Zorny, Secondaries, Cobalt Ember, RYB and UltraOx Dual); the remainder are newly sampled 3–6-paint combinations from existing modeled paint snapshots. Palettes can overlap across seeds; counts must not be added and called unique palettes. Targets and starts are new, not replacements in a campaign.

In the larger run, the center arm produced three three-leg finalists, and the region arm four. **That is not strong evidence that region sampling is a better generator.** It is a selected finite sample with a small difference. Region proposals also often collapsed to two-leg solutions. The broader machinery remains useful because it gives us a way to improve two branches jointly, not because these counts demonstrate a breakthrough.

Twelve finalists entered joint branch refinement. All twelve accepted at least one improvement under the explicit optimization objective; seven remained shortest-found three-leg cases after denser independent checking, and five remained two-leg. None gained an extra necessary leg. The seven are start/target instances across five distinct palettes, not seven novel palette discoveries.

## Stronger three-leg candidates

The margin below is the best two-leg endpoint error found divided by the unchanged landing tolerance. A value above 1 means the tested two-leg alternatives missed. Higher is more separation from those tested shortcuts, **not a player difficulty score or a proof**. Final checks use denser search than baseline.

| Palette | Arm | Two-leg miss margin before → after |
|---|---|---:|
| Hansa Yellow Light / Cerulean Blue Hue / Naphthol Scarlet / Ultramarine Violet / Warm White | Region | 1.23 → 1.63 |
| Phthalo Green (Yellow Shade) / Cadmium Yellow Light / Viridian / Flake White Replacement / Naphthol Scarlet | Center | 1.58 → 1.68 |
| Same green/yellow/scarlet palette, different start | Region | 1.77 → 1.80 |
| Cadmium Red Deep / Indian Yellow Deep / Indanthrone Blue / Nickel Titanate Yellow | Region | 1.08 → 1.17 |
| Same dark red/yellow/blue palette, different start | Center | 1.03 → 1.16 |
| RYB | Center | 1.48 → 1.61 |
| Transparent Earth Orange / Cobalt Green / Perylene Maroon / Prussian Blue | Region | 1.11 → 1.46 |

The first and second rows retain two different ingredient sets among measured meaningful efficient routes. The other five retain one ingredient set with different ordering/proportions. Both can produce different paths, but they must not be conflated. The earth-orange/cobalt-green/maroon/Prussian combination is worth retaining: the refinement moved the start and enlarged the measured margin while keeping broad local branch support. The dark red/yellow/blue examples remain closer to the shortcut boundary and should not be oversold as robust.

## What a branch means here

- Same prepared start and same target, not free base selection.
- Different first pigments among **shortest region-supported, meaningful** routes.
- Intermediate separation is recorded, not used as proof of satisfying choices.
- Longer demonstrations cannot inflate the count.
- Raw shorter escapes remain visible even if their control region is narrow.
- Alternatives using the same ingredient set may just be reordered contributions. Distinct pigment sets are additional evidence, not automatically better play.
- The refined pair must retain the existing 0.025 connected finishing-share width and 4% local setup-coverage criteria. These are fraction-space measurements, not milliseconds, success probabilities or newly tuned thresholds.

The existing style classifier is still used only to describe routes. A rise, ride or balance opportunity in one branch does not become a required style. No new style classifier or mandatory vertex was introduced.

## Validation and caveats

Deep audits use subset/simplex endpoint search, then a separate ordered-fraction coordinate search for shorter routes. Refinements receive 256-seed/12-restart endpoint audits and fresh ordered checks; up to 96 routes receive region measurement. Accepted but unmeasured alternatives remain archived. These solvers share the physical forward model but differ in search coordinates/algorithm; neither proves global absence of a shortcut.

Tests cover accepted endpoints, exact inverse replay, distinct consecutive pigment legs, rejection of inflated branch counts, raw-vs-region minima, all refined branch replays and recomputed local support. Live hold timing/capture behavior has not been certified for a new playable release: these are structural research candidates, not added lab holes.

No pigment strength, mass rule, timing curve, par, tolerance, sound, UI or live lab data changed. No machine-learning model was trained. The refinement changes normalized start recipes and the proportions along two branches, holding destination and palette fixed. More general target/palette joint optimization remains a later extension.

## Archive and reproduction

- `branching-region-search-1`: seed 713903, implementation check.
- `branching-region-search-2`: seed 817913, larger fresh run.
- `branching-region-refinement-1`: twelve paired refinements, parent IDs, both witnesses, histories and fresh counterexamples.
- Large banks use SHA-256-verified compressed parts; `scripts/research-bank-io.ts` reconstructs the exact JSON bytes. Raw local caches are not required.

Run `scripts/search-branching-regions.ts` with Node/tsx. Larger-run settings: `BRANCH_PALETTES=384 BRANCH_AUDITS=24 BRANCH_SEED=817913 BRANCH_OUTPUT=<new archive directory>`. Then run `scripts/refine-branching-regions.ts` with `BRANCH_SOURCE` and `BRANCH_REFINE_OUTPUT` pointing at the selected bank and a new directory. Archives refuse overwrite.

## Next decision

Keep the current lab stable while it is being played. Once that feedback arrives, compare a small selection of these refined shared-start branches with their unrefined parents. Prioritize whether the first choice leads to a different correction problem—not just different colored arcs or more legs. Further computational work should compare branch consequences and ingredient-set alternatives before expanding counts again.
