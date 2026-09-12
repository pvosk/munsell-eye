# Recipe-blind validation study — 12 September 2026

Offline diagnostic work following the [inverse-planning pilot](play-inverse-planning-findings.md). No live engine, labels, thresholds, pigment strengths, controls, palettes, mass, campaign, or lab changed. No new palette ranking is justified by this study.

## What was actually independent?

The existing auditor searches competing controls independently of a proposed witness, but `searchCompetingRoutes` ALSO seeds generating-recipe permutations. It therefore is not recipe-blind. This is useful evidence of reachability, not misconduct or inherently incorrect validation; the previous description needed qualification.

The new checker imports only forward game physics and scoring. It receives palette and target color, not the generating recipe, intended style, inverse witness, atlas, or existing optimizer. It enumerates one-, two-, and three-addition paint orders, including repeats and an initial addition of the starting paint. It uses low-discrepancy starting controls and a separate coordinate-pattern optimizer. It shares the real mixing model intentionally: this tests the search, not the physical accuracy of the pigment model.

Two seeds use 72 samples and five optimization restarts per order. Where counts disagree or seeds are unstable, a third pass uses 288 samples, 12 restarts, more iterations, and sampling biased toward shorter holds. This is bounded numerical search, NOT an absence proof. Timing support and style classification still use shared measurements; agreement does not independently validate those measurements.

## Cohort and shortest-route results

Seven diagnostic specimens cover 27 starting paints: three selected inverse-pilot specimens and four established control holes. They are not a random sample of palette quality. The completed run took about 38 seconds locally.

| Specimen | Starting positions whose shortest found count agrees |
| --- | ---: |
| Maroon Arc ride candidate | 4/4 |
| Maroon Arc value-shift proposal candidate | 4/4 |
| Secondaries value-shift proposal candidate | 3/4 |
| Established Secondaries interior control | 4/4 |
| Established Cobalt Ember control | 3/4 |
| Orange Echo control | 4/4 |
| UltraOx Dual control | 3/3 |

Combined agreement: 25/27. The blind checker found no shorter solution than the existing auditor. This does NOT establish optimality: the two searches can miss the same route.

The two remaining misses are genuine search misses, confirmed by replaying the auditor's controls. In the Secondaries proposal, the auditor's two-addition solutions have finishing windows around 29 and 45 ms, below our 55 ms support requirement. In the Cobalt Ember control, the missed three-addition witnesses include supported routes (approximately 59–95 ms finishing windows). The blind checker must not become the sole arbiter of feasibility.

## Concrete classification findings

### 1. A ride label depends on sample resolution

For Maroon Arc specimen `ip-30-1109262-1`, order `[3,2,1]`, one recorded route is classified as a ride at 48, 128, 256, 1024, and 2048 samples per stroke, but NOT at the production measurement's 64 samples. Its actual controls and endpoint are unchanged.

The measurement counts a segment as chromatic only if both ends clear the chroma threshold, then excludes an entire stroke from `longestChromaticPour` if its chromatic fraction falls below 80%. At 64 samples this makes the recorded qualifying length jump from roughly 46 to 10 world units. At 2048 samples the longer stroke qualifies again. This is a concrete numerical instability amplified by a hard classification threshold, not evidence of a radically shorter experience.

Other examined ride/non-ride pairs remain split at every tested resolution: e.g. approximately 36.37 versus 35.65 units. Those are genuine differences relative to the chosen cutoff, but whether they are meaningfully different experiences remains a design question. Same order alone must not excuse a shortcut: earlier Orange Echo evidence demonstrates materially different setup/finish behavior within the same order.

### 2. Raw minimum and supported minimum differ

The current auditor defines efficiency using the fewest successful additions BEFORE applying timing support. A narrow, unsupported shorter route can therefore prevent a supported longer route from counting toward intended-style availability. The archive now records both `auditedFewest` and `auditedSupportedFewest` so this distinction is visible. Neither should silently replace the other: a difficult shortcut can still matter for expert play, while a supported route matters for ordinary playability.

### 3. Local setup coverage is not a full setup region

Existing coverage measures a small timing neighborhood around a route and counts setups admitting any successful finish. It does not mean that the stated proportion of the whole control space works, or that every successful setup has a 55 ms finish window.

This study separately sweeps 49 penultimate setup times across the entire rising meter leg and 385 finishing times for one independently discovered order per specimen. For three-addition routes, earlier controls remain fixed: this is a two-dimensional slice, not the whole region. Sampling can miss narrow bands.

The Secondaries proposal has successful finishes at 2/49 sampled setup times; the established Secondaries control at 3/49; the Cobalt Ember control at 2/49; Orange Echo at 4/49; UltraOx at 11/49. These are descriptions of individual selected slices, not difficulty rankings or probabilities. The Maroon Arc ride's 49/49 slice begins by adding its starting pigment again: it changes mass but not color, and is NOT a compelling setup despite its broad coverage. This is another reason not to reward setup-area size alone.

## What backward planning already does—and does not

We already generate destinations from pigment recipes, reconstruct ingredient orders, and in the new pilot peel finishing additions backward from alternative acceptable endpoint recipes. We are NOT yet solving for arbitrary pigment combinations that optimally support an entire destination/setup region. The current endpoint-ray method remains tied to a fixed palette and samples only connected portions of the acceptance region.

The global setup slices are a useful next diagnostic, but not a completed global inverse-region optimizer. Deeper joint palette/destination optimization is deferred because the above classification instability would otherwise influence which palettes are rewarded or discarded.

## Recommended sequence before a new search or lab

1. Make chromatic-distance measurement converge reliably (adaptive integration or threshold-crossing interpolation), preserving raw length and chromatic fraction rather than discarding a whole stroke abruptly. First regression-test against the archived resolution counterexample; do not simply lower the style threshold.
2. Report mathematical shortest-found routes separately from shortest timing-supported routes. Preserve unsupported shortcuts as explicit expert-risk evidence.
3. Keep the existing search and the recipe-blind challenger together. A replayable counterexample beats a non-discovery; disagreements require further search, not automatic rejection or approval.
4. Expand backward setup regions with timing widths attached, distinguish color-changing setup from mass-only preparation, and test the same experience across neighboring successful controls.
5. Then search fresh destinations and pigment combinations. Keep both multi-hole palettes and robust single-hole exceptions. Do not promote this cohort into a new palette ranking.

These are proposed changes, not changes applied to live selection in this pass.

## Mass and tinting

The engine normalizes pigment quantities for spectral mixing and passes each pigment's strength separately. A regression check confirms that scaling every quantity equally leaves the color unchanged while changing a pigment's strength still changes a normalized mixture. A future mass-normalized control experiment can preserve those strengths. It would nevertheless change reachable doses and timing, not merely the flight animation. No such mode was implemented.

## Artifacts and reproduction

- [Search comparisons, replayable witnesses, and setup slices](play-blind-validation-results.json)
- [Ride resolution comparison](play-ride-resolution-results.json)
- Run `node --import tsx scripts/inspect-blind-validation.ts`, then `node --import tsx scripts/inspect-ride-resolution.ts`.
- Tests: `scripts/test-recipe-blind-search.ts` and `scripts/test-blind-validation-results.ts`, alongside existing inverse, journey, finish, audit, and campaign regressions.
- Source hashes identify the recorded analysis inputs; they are not complete runtime/dependency fingerprints. Known unresolved cases remain in the report rather than being filtered out.
