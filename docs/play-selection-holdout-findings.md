# Fresh-target selection comparison — 12 September 2026

## Outcome

The revised offline measurements change selection in a small, interpretable way. They uncover one eligible ordinary-play value-shift candidate in Zorny and flag a formerly eligible Cobalt Ember ride for a token-pour alternative. They do not increase the overall number of approved style assignments. This is evidence of more explicit selection, NOT evidence that player enjoyment has improved or that the generator has reached its limit.

The public game, existing bank, par, timing controls, tolerance, pigment strengths, and mass are unchanged. All historical evaluator modules and prior result archives remain unchanged. The experiment lives in separate scripts.

## Controlled comparison

Two previously unused seeds generated four fixed targets each in UltraOx Dual, Zorny, CMY, Secondaries, Maroon Arc, and Cobalt Ember: 24 targets total. Each seed produces a two-ingredient and an all-ingredient target. This is a small, declared recipe-stratified cohort, not a representative estimate of all possible holes or a palette ranking.

Every target uses the same retained route evidence in all three views:

1. **Legacy:** existing measurement and raw shortest-found addition count.
2. **Stable/raw:** revised chromatic integration, still using raw shortest-found count.
3. **Stable/supported:** revised integration and the shortest timing-supported count for ordinary-play eligibility, with shorter raw routes retained as expert warnings.

The existing route search uses 129 one-pour samples and a 25-by-25 two-pour grid with refinement, analytical witnesses, and seeded numerical three-pour exploration. Historical retention still affects the available evidence; rescoring cannot recover a route that was never retained. This is a selection ablation, NOT a complete new-generator comparison or a test of global inverse optimization.

## Stabilizing chromatic path measurement

The experimental integrator finds chroma-circle crossings within each linearized path segment, including segments whose endpoints are both chromatic but cross a neutral region. It doubles path resolution until length and colored length converge within declared numerical tolerances, up to 2048 samples. It retains length, colored length, fractions, resolution, and numerical margins. Close or non-converged classifications can remain unresolved rather than silently pass.

The chroma cutoff (0.06), per-stroke chromatic fraction (80%), route chromatic fraction (80%), and ride length (36 world units) are unchanged. These remain design thresholds. The convergence margin is diagnostic, not a mathematically certified error bound.

Among 3,033 supported route records, 45 previously negative ride labels become positive; none change in the other direction. No records remain numerically unresolved in this cohort. Every changed label was independently restarted at 512 samples and agreed. These records are correlated dose variants, not 3,033 independent player experiences. Correcting endpoint-only undercounting is expected to increase measured chromatic length.

Despite those route-level corrections, **stable measurement alone changes no hole-level eligibility counts** in this cohort. The known earlier counterexample is also fixed by regression test without erasing genuinely below-length-cutoff non-rides.

## Selection results

| Eligible style assignments across 24 targets | Legacy | Stable/raw | Stable/supported |
| --- | ---: | ---: | ---: |
| Ride | 1 | 1 | 0 |
| Value shift | 0 | 0 | 1 |
| Interior | 1 | 1 | 1 |
| Balance | 2 | 2 | 2 |

Assignments overlap: one target may qualify for multiple styles. Eligibility means the current general checks and at least two-thirds style availability, not that every base forces the style.

Eight starting positions across the cohort have a shorter raw solution than their shortest retained timing-supported solution. Those warnings remain explicit. The supported interior view asks for three meaningful additions from every supported minimum; unlike the raw view it does not require proof-like exclusion by a raw two-pour error margin. It must not be called mathematically shortcut-resistant.

### Zorny: newly admitted value shift

`sh-1-91226031-1` is a warm peach target, RGB approximately (228, 167, 129). Raw minimum additions by base are [2, 2, 3, 2], while supported minima are [3, 2, 3, 2]. Recognizing the first base's supported three-pour route increases value-shift availability from two to three of the four bases.

It is **not a protected value-shift hole**: supported non-value-shift alternatives exist from every base. It is a candidate for a palette course offering value-shift opportunities, not a promise to force that finish. The independent challenger corroborates minimum counts, finds the value-shift experience from some bases, but does not independently recover every style witness. The original witnesses remain replayable.

### Cobalt Ember: ride warning becomes visible

`sh-10-91226031-1` had one base whose raw minimum is one addition but whose supported minimum is two. Including those ordinary-play two-pour alternatives exposes a token-pour route and triggers the existing token-bypass guard. The ride itself still exists; this experiment does not delete it. It changes the claim that it is a strong all-base ordinary-play candidate. Whether such a hole is desirable for expert scoring remains a separate course-design choice.

### Cobalt Ember interior and CMY balance persist

`sh-10-91226079-1` retains three-addition interior solutions from all four bases in the original audit. Its target is a muted yellow/olive, approximately RGB (158, 152, 110). This is useful fresh evidence that interior structure is not confined to repeatedly testing Secondaries. It is not a new advantage created by the revised selection: the legacy view already selected it.

`sh-4-91226031-1`, a dark, subdued blue-gray CMY target, remains the top balance selection. It offers balance from all three starts, but one start admits a supported non-balance alternative. It is not universally style-resistant.

## Independent challenge

The union of the old and new top selections contains four specimens and 15 starting positions. Two recipe-blind searches per specimen use different seeds, 144 initial samples per order, eight restarts, and up to three additions. They receive only palette and target color; neither generating recipe nor proposed witness is supplied. Support and style measurement remain shared code.

- Raw minimum addition counts agree for all 15 positions.
- Supported minimum counts agree for 13; two Cobalt Ember interior positions have no supported witness recovered by the challenger, though the original auditor has replayable supported routes.
- No shorter raw or supported route was discovered.

Non-discovery is not an optimality certificate. In particular, keep the two unresolved support reproductions visible. The study took approximately 69 seconds locally; this is one runtime observation, not a general performance benchmark.

## Assessment for the project

This pass supports a modest conclusion: better measurements prevent numerical artifacts and distinguish ordinary-play choices from expert shortcuts. It does not show a large expansion in candidate yield, and it has no new human ratings.

The next higher-upside test is **better proposals**, not another layer of thresholds: backward setup-region search with meaningful color-changing setup and attached timing support, followed by joint pigment/destination exploration. Compare that against exact-recipe proposals with matched compute and new seeds. Continue to preserve raw shortcuts and independently replayable disagreements. A future palette search should retain multi-hole portfolios and robust single-hole exceptions separately.

The present experiment neither proves an asymptote nor promises a breakthrough. It narrows the uncertainty: correcting labels alone is unlikely to unlock a large reservoir of rides, whereas supported-minimum selection can recover specific plausible value-shift opportunities.

## Reproduction

- [Full frozen comparison and witnesses](play-selection-holdout-results.json)
- Runner: `node --import tsx scripts/inspect-selection-holdout.ts`
- Measurement: `scripts/stable-route-measurement.ts`
- Selection views: `scripts/supported-selection.ts`
- Regression tests: `scripts/test-stable-route-measurement.ts` and `scripts/test-selection-holdout.ts`
- Recorded source hash covers the listed source files, not every dependency or runtime input.

The full validation suite for this pass also replays earlier inverse, blind-search, journey, finish-profile, audit, and campaign evidence. No browser or player test was performed because nothing user-facing changed.
