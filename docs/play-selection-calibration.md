# Free-start hole selection: calibration and proposal test

## Outcome

Selection alone improves the ranking of known examples, but does not recover a missing class from the old candidate pool. A targeted proposal objective finds new, numerically supported demanding interior holes without fixing the starting paint. Natural-start prediction is useful as a diagnostic, not established as the main selection solution.

This is an offline experiment. The public v54 lab, paints, controls, tolerance, par, scoring and animation are unchanged. The new policy is not wired into the live course builder. Exact recipes, measurements and witnesses are saved in the accompanying JSON reports; no private notes or attempt records are copied into them.

## 1. Test known examples before generating a replacement lab

Twelve archived targets were re-audited unchanged with the live tolerance, 0.0294. The audit uses 257 one-addition samples and 49×49 two-addition samples per order, local refinement and dose-region variants. Three-addition solutions are legal generating-recipe permutations, not an exhaustive three-control search.

Three declared calibration comparisons all favor the player-preferred example under closest-start, plausible-start and all-base floor ranking:

- The strongly reviewed Secondaries balancing hole beats the too-close round-six RYB interior.
- The other positively reviewed Secondaries interior beats that RYB interior.
- The neutral Crimson target beats the rejected bright Crimson target for general multi-step quality. This does not label the neutral target a finishing lift.

The Secondaries benchmarks have three-addition witnesses from every base, with minimum found travel of roughly 37–47 and 32–43 world units across bases. The RYB interior has a roughly 19-unit two-addition route from Red. Neutral Crimson has roughly 31–49 units across bases versus 15–64 for bright Crimson.

These comparisons were used to motivate the policy. Passing them is calibration, not independent evidence that the selector predicts enjoyment. The older Cobalt benchmark still fails the provisional every-base support test at one base; it remains a known search/support-calibration discrepancy, not an automatically rejected player favorite.

## 2. What the ranking experiment changes

`app/play-route-selection.ts` provides an offline lexicographic comparison rather than one weighted “fun score.” Early weak-start criteria cannot be compensated by a spectacular featured route.

- Preserve existing safety/support failures separately.
- For non-rides, prioritize resistance to one-addition shortcuts and meaningful additions.
- For the demanding interior brief, prefer the explicit three-from-every-base profile.
- Compare the minimum route travel over the selected starting scenarios, then all-base travel, style resistance/availability and the showcase route.
- For rides, compare the minimum chromatic-pour length first, capped by the minimum total-travel evidence to avoid overstating retained route groups.

The three scenario sets are: perceptually closest pure paint; the union of that and the closest chromatic hue; every base. Near-neutral targets do not use unstable hue angles. Observed starts can be supplied separately, but were not injected into this run. None of these sets is a probability model for player behavior.

Adding hue correctly includes Lemon alongside Orange for the reviewed Violet Estuary target. However, on the broader pool, plausible-start ranking can still favor a hole with a long route from the anticipated base and a short route elsewhere. The all-base variant is more faithful to the stated priority of good options from any starting choice. Use natural-start information for presentation and diagnostics, not permission to neglect other bases.

## 3. Re-ranking does not create missing candidates

The old round-six search audited only five proposals per palette/style after ranking them by featured-route strength. Its 67 surviving candidates contain zero supported three-from-every-base holes.

We re-audited those 67 and tested 216 new targets without the showcase prefilter: 24 per palette across Zorny, RYB, CMY, Secondaries, Chromatic Dark, Cobalt Ember, Crimson Current, Cerulean Arc and Violet Estuary. Four-paint palettes use the same pair/triple/full-mixture cohort; three-paint CMY uses a separate balanced pair/triple distribution of the same size. This is not a statistically controlled palette league table.

Only 33 of the 216 pass all existing base-validity checks. One offers supported three-addition routes from every base, but its best found two-addition miss is too close to the boundary to meet the additional 1.1-tolerance safety margin. None meets the buffered demanding-interior profile.

The top-three union from showcase, closest, plausible and all-base rankings produced 23 finalists, all rechecked at denser resolution before reranking. Natural-start ranking is not an independently demonstrated improvement over all-base ranking. It does not solve rides or lift identity: the better ride-floor candidate still has only about 30 units from its weaker starts, below the current 36-unit ride definition. Generic quality ranking also promotes the same good multi-step hole for several styles. That is evidence to keep style qualification separate from general quality—not rename one hole three ways.

## 4. Change the proposal objective for the demanding interior brief

The follow-up asks a different geometric question: which reachable target colors are farthest from the sampled endpoints attainable with one or two additions, considering every base and paint order?

For each of six four-paint palettes, 160 full-mixture recipes were proposed. Half use broad log-spread doses; half use more central, tint-compensated doses. Tint compensation is only a sampling heuristic; exact current mixing code evaluates every color. No reviewed target recipe is inserted.

The eight highest-gap, separated proposals per palette received dense route audits. Coarse nearest-sample distance overestimates distance to the full continuous reachable set, so it only proposes candidates; it never certifies them.

The demanding profile requires: a legal supported three-addition route from every base; no found one/two-addition solution; best two-addition error above 1.1 times scoring tolerance; and three meaningful additions in the retained supported routes from every base. Existing 55 ms finishing-width and 4% local setup-support thresholds remain unchanged. The extra 1.1 is a numerical selection buffer, not a changed landing tolerance or proof.

| Palette | Buffered profile among 8 checked | Greedy subset separated by 2 tolerances | Worst-base travel across passing candidates |
|---|---:|---:|---:|
| Secondaries | 8 | 3 | 28–39 |
| Zorny | 4 | 2 | 21–26 |
| Cobalt Ember | 4 | 3 | 32–42 |
| RYB | 1 | 1 | 35 |
| Chromatic Dark | 1 | 1 | 23 |
| Crimson Current | 0 | 0 | — |

There are 18 passing candidates, not 18 proven enjoyable or independent course holes. The two-tolerance column is a deterministic greedy subset ordered by worst-base travel, not a maximum packing. The initial proposal selection used one-tolerance separation.

Six representatives (one from each successful palette, plus a second Secondaries) were checked again with 513 one-addition and 97×97 two-addition samples per order and refinement. No shortcut was found, all saved three-addition witnesses replay, and minimum two-addition error stayed above the 1.1 buffer. Representative margins range from about 1.13 for Chromatic Dark to 2.08 for Cobalt Ember. Zorny's margins are narrower than Secondaries/Cobalt and should not be presented as equally robust.

This demonstrates candidate existence within the current numerical model. It does not prove global absence of a continuous shortcut, establish brand-specific physical pigment accuracy, or measure fun. Because both proposal sampling and the proposal objective changed, the yield difference cannot be attributed solely to the gap score. A new player comparison is still needed.

## 5. Implications

1. Keep free base selection. The demanding interior structure is demonstrably findable without forcing a start.
2. Generate toward the requested structure, then audit competing routes. Do not expect final sorting to recover candidates discarded by a showcase-first proposal stage.
3. Use all-base experience floors as the main protection. Keep likely-start diagnostics, but do not let them hide an inferior alternative base.
4. Do not generalize this interior proposal objective to every hole. It will tend toward interior, all-ingredient targets—not the desired variety of rides, lifts and balancing routes.
5. Rides and finishing lifts remain unverified as broadly start-resistant styles in this run. They need their own proposal objectives and can remain optional experiences when the evidence only supports availability.
6. Before another large lab, compare a small number of these exact candidates with the established favorites. The numerical signature is now better matched; the experience is not yet player-validated.

## Reproduction

- `scripts/calibrate-play-selection.ts` → `docs/play-selection-calibration.json`
- `scripts/probe-interior-proposals.ts` → `docs/play-interior-proposal-probe.json`
- `scripts/verify-play-selection.ts` → `docs/play-selection-verified.json`
- `scripts/test-play-selection.ts` tests the policy and replay evidence.

Audit caches are content-addressed under `/tmp`; reports retain source fingerprints, recipe cohorts and seeds. Report runtimes on a repeated run include cache reuse and must not be quoted as uncached compute costs.
