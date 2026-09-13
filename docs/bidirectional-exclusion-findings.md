# Bidirectional joining, shorter-route exclusion, and the latest review

Research pass: September 13, 2026. Playable game, lab, pigments, strength, controls, tolerance, par and sound are unchanged.

## What the review actually contains

The export contains 2,438 events, not 2,438 attempts: attempt snapshots are repeatedly updated. We deduplicated by attempt ID and retained the latest review. The relevant comparison is the previous four branching setups against the first **12 of 16** destination-conditioned holes. There are no new attempts on the last four conditioned holes in this export. Revealed routes and unfinished attempts are retained and distinguished, not treated as blind completions.

The previous four are not merely vaguely remembered successes:

- **Hansa / Scarlet / Violet:** “ONE OF THE BEST ROUTES.”
- **Earth Orange / Cobalt Green:** valued rebalancing at low values, without white.
- **Emerald / Yellow / Scarlet:** described as one of the hardest in a good way; 21 releases, collapsing to 18 consecutive pigment legs in that attempt.
- **RYB:** liked the corrections that sent the mixture into darker values. This is the older branching RYB, not the new two-leg RYB contrast.

The newer set was mixed, not a wholesale rejection. **Violet / Chromium** was a pretty, unfamiliar pastel challenge; **Cobalt Ember** was a good dark interior; **Deep Red / Blue / Yellows** and **Chartreuse / Rose / Black** were positive. Rose / Chartreuse / Cerulean had an easy setup but meaningful misses. The shorter RYB contrast was rejected as very easy, and the pale Hansa / Manganese / Violet example received “eh” despite being a three-leg problem.

Two especially useful design requests were to require an actual yellow addition in the rose palette and an actual Burnt Sienna addition in the earth palette. Existing pigment in a premix does not satisfy either request. The Sienna hole starts with about 78.6% Burnt Sienna, yet both the player and the independent solver reached the target without adding any more of it.

### Why the older lab may feel better

The four older holes were curated around viable alternative corrections; two were jointly refined around two branches. The newer sixteen emphasized destination and palette coverage and deliberately included four shorter contrasts. They were not a stricter “best four, but more” selection.

Your notes support **consequential corrections, unusual value/hue interactions, and recovery** as useful dimensions. They do not support simply maximizing leg count, excursion, or a single finishing label. Counterexamples:

- The new Hansa / Manganese / Violet hole has three legs, a strong measured value/chroma tradeoff, and an approximately 98 ms featured finishing window, but did not feel special.
- The rejected two-leg RYB demonstration has a large excursion. A dramatic demonstration therefore does not establish an interesting puzzle.
- The older RYB demonstration has zero tradeoff under the current endpoint-residual metric, although the player's actual correction sequence was interesting. This metric does not describe the whole recovery experience.

These are hypotheses grounded in a small, nonrandomized playtest, not evidence that one numerical feature causes enjoyment. We did not retune thresholds to make the ratings agree.

## Experiment A: algebraic bidirectional search

We froze all 20 lab starts, targets, and palettes. Neither method received an intended route or target recipe.

The existing solver searches contribution simplices: retained start plus one, two or three added pigments. The new prototype independently recovers accepted landing recipes, then joins them to the forward reachable recipe sets.

For this mixing model, a recipe transition is affine:

`q_next = (1 - share) * q + share * pure_pigment`

Consequently, a forward prefix and backward suffix can be matched using a small constrained recipe-space projection instead of a general-purpose nearest-node tree. We exhaust the faces of each small recipe simplex to solve the quadratic projection. This is the **algebraic meet-in-the-middle variant**, not a new general continuous bidirectional tree planner.

An exact join matches the root recipe. An approximate projection does not; it is only retained after replay through the actual pigment model lands inside the original target tolerance. We archive this distinction. There were 1,020 exact root/subset joins and 637 accepted approximate root/subset proposals across the fixed cases. These are not counts of independent holes.

| Fixed-case result | Existing contribution search | Algebraic bidirectional |
|---|---:|---:|
| Cases with a solution | 20/20 | 20/20 |
| Shortest-found counts | 16 three-leg, 4 two-leg | Same |
| Endpoint/root-search time, this run | 2.742 s | 0.995 s |
| Pigment-color evaluations | 766,362 | 224,610 |

Root recovery is charged to the bidirectional time. Geometry/support measurements are outside both timing totals. These are implementation-specific timings, not an equal-CPU tournament or a universal speedup claim. The direct solver uses 64 simplex samples and six restarts per subset; bidirectional root recovery uses 128 initial recipes, eight polished centers and 64 accepted roots per case. Both examine depths one through three.

Independent ordered-fraction checks found no shorter counterexample to any of the 20 published leg minima. Nineteen cases had the same number of measured supported first-pigment choices; one five-paint Hansa / Scarlet / Violet case gained an additional observed first-pigment choice. That is a finite measurement result, not proof of complete branch coverage.

**Design use:** bidirectional joining is useful for evaluating a specified start and destination and offering alternative approaches. It is not a demonstrated new source of intrinsically better holes. Sampled landing roots can miss reachable components, so retain the direct solver and independent shorter-route challenger.

## Experiment B: exclude shorter routes before selecting a start

We used **192 palette/target queries across 106 distinct four-, five- and six-paint combinations**, spanning 85 pigment definitions. These are archived palettes and dark/middle destination requests with freshly generated starts—not 106 newly discovered palettes or a fresh global survey.

Each query generated 64 inverse-chain proposals: **12,288 raw proposals**, all replayably archived. Of these, 197 passed the existing meaningful-movement and one-leg-separation pre-screen, spread across 42 queries. The other 150 queries provided no eligible nominee in this sample; they are not proved impossible.

The paired comparison kept the same pool and ranking:

1. **Baseline:** choose the top existing one-leg/separation score, then audit.
2. **Explicit exclusion:** first exclude proposals where the two-leg adversary finds a success; choose the highest original score among survivors, then independently audit.

| Result | Baseline | Exclusion before selection |
|---|---:|---:|
| Queries returning a nominee | 42 | 6 |
| Nominees with a shorter solution found by independent audit | 40 | 0 |
| No shorter route found, with local fraction support | 2 | 6 |

Four queries therefore yielded a different, surviving three-leg start from exactly the same candidate pools. The extra short-route gate work was about **4.8 seconds / 1.29 million color evaluations** across the 197 eligible proposals, excluding proposal generation and final validation.

This does not mean filtering generated four new mathematical possibilities. They already existed in the pool; the old ranking chose something else. It also does not mean the six are the most enjoyable candidates.

All six received a stronger fresh **1,024-sample / 32-restart ordered-fraction check**, a three-leg competing-route audit, and replay under current normalized hold/release controls. All six retained a shortest-found three-leg solution, local fraction support, several measured first-pigment alternatives, and an executable featured route without early capture.

### The six banked survivors

Margin is best-found shorter-route error divided by the landing tolerance; greater than one is a miss. It is not a certified lower bound or a difficulty score.

| Palette | Target request | Shorter margin | Supported first-pigment choices |
|---|---|---:|---:|
| Naphthol Scarlet / Cobalt Green / Warm White / Quinacridone Magenta | Dark | 1.296 | 3 |
| Same palette, different target/start | Middle | 1.333 | 3 |
| Warm White / Mars Orange / Quinacridone Rose / Raw Umber | Middle | 1.052 | 3 |
| Cobalt Violet / Radiant Lemon / Cadmium Yellow Medium / Phthalo Blue | Middle | 1.556 | 3 |
| Quinacridone Rose / Radiant White / Cadmium Yellow Light / Indigo / Winsor Yellow Deep | Middle | 1.035 | 4 |
| Cobalt Turquoise Light / Transparent Orange / India Yellow / Titanium White / Quinacridone Violet / Cadmium Red Deep | Middle | 1.112 | 5 |

The 1.035 and 1.052 cases are especially fragile to tolerance changes. Do not label them equally secure as the 1.556 case. The Cobalt Violet / Lemon / Yellow / Blue demonstration also meets the current drop, ride and balance measurements, but those styles are **available**, not established as unavoidable.

**Design use:** make explicit shorter exclusion an opt-in structural requirement for a requested three-leg puzzle. Do not apply it to every course hole or erase shorter enjoyable routes. Keep the rejection witnesses, and examine surviving alternatives for value/hue coupling, recovery, palette identity and playable control support afterward.

## Does this transfer to non-premix play?

Yes at the recipe/path level, with an additional all-starts test. For free base choice, the shorter reachable set is the union over **every allowed pure base**. A check on only the intended or nearest base is insufficient. Zero-addition success at a pure base must also be checked.

A useful concrete result emerged from testing the existing destinations:

| Existing hole destination | Pure bases checked | Shortest found from each | Closest two-addition result across bases |
|---|---:|---|---:|
| Older Emerald / Yellow / Scarlet branching hole | 5 | 3 additions from all five | 1.666 tolerances |
| Older RYB branching hole | 4 | 3 additions from all four | 1.580 tolerances |
| New Rose / Chartreuse / Cerulean hole | 4 | 3 additions from all four | 1.122 tolerances |

These received independent 512-sample / 24-restart two-addition checks per base, plus a three-addition search. “Three additions” excludes the free choice of base. They are promising free-start candidates, not already calibrated free-start holes. Their initial distance, route feel and accumulated-mass timing need separate assessment.

The first older Hansa branching hole and Earth Orange / Cobalt Green do **not** transfer unchanged as universally three-addition puzzles: some pure bases admit two additions. Premix resistance is not automatically free-start resistance.

Accumulated mass does not change the abstract fractional arc: at current mass `M`, attaining share `a` requires adding `M*a/(1-a)` parts. It changes dose cost and the number/duration of bounded releases. The original mode therefore needs its own control adapter and timing validation; normalized premix timing evidence cannot be copied over.

## Recommended hybrid and next design test

1. Broad chain proposals plus a separate forward proposal stream for coverage.
2. Explicit shorter-route exclusion **when requested by the hole brief**, before top-candidate selection; retain raw and timing-supported minima separately.
3. Bidirectional joins to inspect alternatives for surviving start/target pairs.
4. Region branching and joint refinement around several meaningful alternatives, with refreshed adversarial checks.
5. Assess correction/recovery and pigment-omission questions, not just the demonstration's finishing style.
6. Independent validation and a small paired playtest before promoting a new default selection policy.

For the next playable comparison, use a few same-palette, same-destination pairs with baseline versus exclusion-selected starts, alongside an older favorite as an anchor. That tests whether the mathematical improvement produces the experience we want. Do not replace the remaining four unplayed conditioned holes silently.

For “requires a yellow addition” or “requires Burnt Sienna,” the appropriate next adversary is an **omission search**: can the target be reached without ever adding that pigment? Existing premix content is retained, so it cannot create a false positive. The current report checks omission among routes through three legs; it does not certify impossibility at unlimited depth.

## Reproducibility

- `scripts/bidirectional-leg-search.ts`: accepted-root recovery and exact small-simplex projections.
- `scripts/test-search-design.ts`: fixed-case comparison and paired selection ablation.
- `scripts/assess-search-design.ts`: stronger finalist checks, pure-base transfer and raw-proposal replay.
- `scripts/test-bidirectional-legs.ts`, `scripts/test-search-design-bank.ts`: geometry and bank integrity tests.
- `docs/bidirectional-exclusion-2/`: deduplicated relevant feedback, exact start/target recipes, all raw candidates, shorter-route counterexamples, timing/evaluation totals and validation results.

The incomplete initial pilot was retained outside the project, not pooled into these results. All reported results are from the completed second run. Added raw-archive instrumentation was verified by exact seed replay against every retained proposal. This remains finite numerical research, not a solved continuous reachability atlas.
