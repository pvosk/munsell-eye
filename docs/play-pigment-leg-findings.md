# Pigment-leg engine: palette-first versus route-first

13 September 2026. Offline research and bank update; the playable lab, physical pigments, normalized-premix policy, landing tolerance, controls, sound and visuals are unchanged.

## Bottom line

Both approaches produced useful specimens. **Palette-first was stronger at discovering three-leg structure in this experiment. Route-first did not reliably make its proposed finishing style unavoidable.** Keep both, with palette-first as the broad discovery backbone and inverse proposals as a complementary source, not a certificate of intentional play.

The most important validation result was not another high-scoring hole: searching alternative successful proportions overturned **42 of 82 provisional unopposed-style claims with region-supported counterexamples**, plus one with a raw counterexample. Optimizing endpoint error alone is insufficient for evaluating route style. The final bank incorporates these disagreements explicitly.

The two independent deeper endpoint checks found no shorter route for any of the 88 three-leg historical/new/variant survivors. This supports their structural distinction under the tested model; it is not a global proof or a promise that they will feel challenging.

## 1. What changed mathematically

Let `p` be the normalized vector of ORIGINAL pigment quantities. Adding pigment `i` with final-mixture fraction `a` gives:

`p' = (1-a) p + a e_i`.

The color still comes from `mixtureColor`: original pigment spectra approximated by spectral.js, including the existing tinting strengths. We do not repeatedly mix an RGB approximation of the previous mixture. Endpoints are scored by Euclidean **OKLab**, with the unchanged tolerance `T = 0.0294`. Search coordinates are continuous recipes; Munsell labels do not quantize them.

Two consecutive additions of the same pigment combine to `a = 1-(1-a1)(1-a2)`. They are **one pigment leg even when today's shot cap requires several releases**. A nonadjacent return, such as red → white → red, remains three path legs. However, its endpoint contributions can be consolidated into a different, at-most-two-distinct-pigment route when abstract fractions are unrestricted. The paths need not look alike.

Any endpoint recipe reached by additions can be written:

`q = lambda p_start + sum(w_i e_i)`.

This allows an endpoint search over pigment subsets and their contributions, rather than redundantly searching every release order. Then we permute the contributions to examine different trajectories to the same endpoint. Fractions generally change when their order changes; this is not simply swapping identical doses.

For a full-support start and an interior target recipe, the construction `lambda = min(q_i / p_i)` leaves at most `n-1` positive residual additions in an `n`-pigment palette. This is a constructive exact-recipe upper bound, **not a color-space minimum**. Boundary recipes with zero retained start may require a pure-replacement limit, rather than a finite pour. The numerical search uses retained-start weight at least `1e-9`.

Thus a triad's interior recipe does not require three distinct added pigments under these abstract controls. A five-pigment exact recipe can use four, but a visually accepted alternative recipe may still take fewer. The absence of a four-leg survivor below does not prove four-leg color minima impossible.

### Three separate questions

1. **Reachability:** shortest accepted pigment-leg route found, including narrow ones.
2. **Proportion-region support:** shortest measured route with a sufficiently broad local accepted fraction region.
3. **Execution today:** releases/hold times needed to execute a leg with the current dose limits.

The third question no longer inflates the first. Changing hold/release mapping can require rebuilding execution/timing views without rerunning the structural search, provided it does not change the reachable fraction domain or physical color model. Changing tolerance or pigment definitions still requires validation again.

## 2. New implementation and scope

- `app/play-pigment-legs.ts`: shared composition algebra, canonical legs, contribution conversion and current-control adapter.
- `scripts/pigment-leg-search.ts`: recipe-blind subset/simplex endpoint solver and a separate ordered-fraction challenger.
- `scripts/pigment-leg-metrics.ts`: fraction intervals, local setup coverage, geometry and provisional style measurements.
- `scripts/pigment-leg-audit.ts`: competing routes, raw versus region-supported minima, measured/unmeasured alternatives and fresh checks.
- `scripts/pigment-leg-proposals.ts`: forward palette-first proposals, backward route-first proposals and independently movable start/target refinement.
- The audit, method comparison, holdout, style challenge and index scripts make a reproducible offline pipeline. The final index—not an individual endpoint audit—is the appropriate entry point for promotion work.

This is **not a claim that every legacy/live generator was migrated**. Old archives remain historical; current lab content and its old labels are unchanged. The new primitive and offline pipeline establish the replacement research foundation. No new ML model was trained.

## 3. Experiment scale and fairness

Two seeds: `113291` and `319171`.

- 512 palettes per run; **979 distinct palette definitions** across runs, drawn from 87 existing pigment snapshots.
- Palette sizes: 3, 4, 5 and 6. Existing definitions were preserved; novel combinations were unpromoted.
- 20 emitted proposals per palette per method: **40,960 total proposals**, all retained, including failures.
- Every selected candidate faced shorter-leg endpoint search. Cheap screening did not substitute for the final audit.
- **192 baseline deep audits**, balanced at 16 cases per method × requested depth 2/3/4 × seed.
- **72 refinements**: 24 matched parents × start-only, target-only and joint.
- **566 historical case re-audits**, after exact case deduplication. These are conditions/variants, not 566 distinct holes or palettes.
- **88 denser endpoint holdouts**, covering every three-leg survivor from those audits, not just the attractive examples.
- **77 additional style challenges**, covering 82 provisional claims and 2,133,300 endpoint probes.

Both methods used the same palette pool within each run and equal emitted slots. They did **not** have equal proposal CPU: route-first tried 272,640 internal finishing options across both runs, versus 20,480 forward proposals. The two broad runs took about 288 and 306 seconds respectively on this machine, excluding historical re-audit and later challenges. This is practical offline work, not live frame-loop computation.

**Route-first here means backward construction within a shared palette pool**, followed by competition across that pool. It is not unrestricted invention of arbitrary physical pigments or a global optimizer of palette identity. Its finishing surrogate is better suited to value/long-finish geometry than to an entire multi-step balancing sequence. The independent validator never sees its intended style or target recipe.

Candidate selection also imposed per-palette and coarse destination-bin caps. This is a selected-sample comparison, not an unbiased estimate of the fraction of all possible holes that are good. The second seed is a method replication, not a rigorously disjoint held-out pigment family.

## 4. Results: structural complexity

| Selected three-leg cohort | Palette-first | Route-first |
|---|---:|---:|
| Seed 1: shortest found remains 3 | 10/16 | 10/16 |
| Seed 2: shortest found remains 3 | 15/16 | 5/16 |
| Both seeds: also region-supported, no near-one/tiny-leg flag | 20/32 | 12/32 |

One additional route-first candidate from the requested-four-leg cohort resolved to a structurally acceptable three-leg case. Thus there are **33 baseline structural three-leg candidates: 20 palette-first and 13 route-first**. An additional 33 qualifying refined variants are indexed, but these are not 33 independent discoveries. None has new human play feedback yet.

All 64 selected two-leg examples retained two-leg endpoints and proportion support. Among 64 selected four-leg examples, **63 had a two-leg shortcut and one had a three-leg route**. Four proposed legs were not four necessary pigment decisions. We bank them at their measured complexity instead of rewarding the demonstration's length.

The new baseline three-leg cases span familiar palettes and novel sets. Examples include RYB and Cobalt Ember, as well as Quinacridone Rose / Mars Red / Prussian Blue / Permanent Green Light. Exact starts, targets, physical paint snapshots and counterexample controls are in the index. This is evidence for promising specimens, not enough evidence to call each palette a strong complete course.

### Start-only versus target-only versus joint

Across 24 matched parents per condition, improvements of more than `0.01T` in the best found one/two-leg exclusion margin occurred in:

- Start-only: **5/24**.
- Target-only: **13/24**.
- Joint: **15/24**.

No refinement converted a two-leg parent into a three-leg survivor in this selected batch. Twelve three-leg parents remained three-leg in every condition. Joint and target-only often produced similar gains. These were five adversarial refinement rounds with a fixed pigment order and variable fractions; this does not establish that changing starts is generally unhelpful, or that longer/global joint searches cannot escape different basins.

The historical audit found 555 two-leg and 11 three-leg cases. The latter include the previously liked Zorny and Cobalt Ember interior specimens. They also include neighboring variants of older candidates; count variants separately from discoveries. Some old “three-pour” results collapse now that a same-pigment leg may exceed one release's capacity.

## 5. The key result: test successful regions, not just best-fit endpoints

An endpoint optimizer tends to return controls near a best-fitting color. A player only needs to land anywhere inside the accepted region. Those other proportions can change whether the last leg is long, whether a setup is meaningful, or whether the route displays the proposed balancing behavior.

The extra style challenger sampled global fractions and neighborhoods around accepted routes across all distinct-pigment orders at the measured efficient depth. It found:

| Provisional unopposed label | Claims | Raw bypasses | Region-supported bypasses |
|---|---:|---:|---:|
| Chromatic ride | 18 | 7 | 7 |
| Coupled balance | 32 | 12 | 12 |
| Interior assembly | 32 | 24 | 23 |
| Total | 82 | 43 | 42 |

There were no initially unopposed rise, drop or setup-glide claims in this selected bank: different efficient orders already provided alternatives.

These are **claims, not distinct holes**; some cases had multiple claims. “Interior assembly” here is a provisional proxy requiring meaningful legs and target chroma below `.12`, not proof of topological interior. Small legal changes can defeat its meaningful-leg condition while preserving a successful three-leg endpoint. This illustrates why a structural minimum and an experiential label must remain separate.

The final index downgrades claims when bypasses are found, links the replayable controls, flags refined cases whose styles have not received this extra challenge, and never calls a style mathematically required. Even an unopposed result after this challenge means only **unopposed in the finite tests performed**.

The holdout endpoint checks used 1,024 seeds/samples and 32 local restarts per subset/order in two different parameterizations, with fresh seeds `819173` and `991337`. All 88 prior three-leg survivors remained without a discovered one/two-leg shortcut. Both solvers share the physical mixing model; agreement is not an independent laboratory validation of real pigment behavior.

## 6. Region measurements: useful, but still provisional

Current research support policy:

- A connected finishing-fraction interval at least `.025` wide, with `.01` and `.05` sensitivity views.
- At least `.04` local setup coverage in a box extending up to `±.12` in each setup fraction.
- A five-point grid per setup axis and a 65-point finishing grid for that local coverage.

These are dimensionless mixture fractions, **not 55 ms or player success probabilities**. Setup coverage asks whether a sampled setup admits a successful finishing sample; it does not require every such setup to have a wide finishing window. Interval scans retain disconnected components separately and include the known accepted anchor, but may miss another very narrow island between samples. The region is local, not the complete inverse image of the landing volume.

Accordingly, “region-supported” is a transparent provisional measurement, not an independently calibrated human-difficulty label. The bank keeps raw shortcuts even when they fail this support policy. Higher minimum, long travel, and high support must not be conflated with enjoyment.

## 7. Separate validator bug found

The older free-start `scripts/recipe-blind-search.ts` local search tried an increasing dose twice inside its nominal `[-1,+1]` loop. It now uses the direction correctly, and its policy version is incremented. A regression test plants a lower-dose solution and verifies that the solver moves down to it.

The new premix leg solvers do not use that local optimizer. This defect warrants caution and fresh checks before promoting older free-start validation results; it does not invalidate all prior physics, player reviews or the new endpoint holdout.

## 8. Banking and reproduction

Start with [the consolidated index](pigment-leg-results-2/index.json): 264 audited cases grouped into 150 sampled palettes, with intent, structural result, corrected style status and human review kept separate. `humanReview` is null for new cases; `livePromotion` is false. All broad proposals, screening evidence, failures, alternate controls and refinements are retained in the linked archives. Original historical documents are not overwritten. The first index is retained as the checkpoint before the resolution audit.

The [resolution audit](pigment-leg-results-1/resolution.json) replayed all 9,502 measured routes at 192 rather than 48 samples per leg. Eight route labels across six cases changed, all from non-ride to ride; those cases are explicitly marked `sampling-sensitive` in the final index. Maximum finishing path-length difference was about `0.0000365` OKLab, but thresholded hue travel differed by up to `0.0918` radians. This check supports path-length consistency, **not complete ride-classifier convergence**. Chromatic-threshold crossings still deserve adaptive integration before treating borderline ride labels as stable.

Run from the project root with Node and tsx:

```sh
node --import tsx scripts/audit-pigment-leg-bank.ts
node --import tsx scripts/search-pigment-leg-methods.ts
LEG_SEARCH_OUTPUT=docs/pigment-leg-search-2 LEG_SEARCH_SEED=319171 node --import tsx scripts/search-pigment-leg-methods.ts
node --import tsx scripts/validate-pigment-leg-finalists.ts
node --import tsx scripts/challenge-pigment-leg-styles.ts
node --import tsx scripts/index-pigment-leg-bank.ts
node --import tsx scripts/check-pigment-leg-resolution.ts
LEG_INDEX_OUTPUT=docs/pigment-leg-results-2 node --import tsx scripts/index-pigment-leg-bank.ts
```

These scripts refuse to overwrite an existing output directory. Use a fresh checkout/output configuration for reproduction. Archives include seeds, policies, exact pigment/start/target data and source hashes or input references. Do not merge related variants into independent train/test examples if a learned ranking layer is added later.

Large logical JSON paths in the index are stored as `.json.archive.json` manifests and `.json.parts/*.gz` chunks. `readBankJson` / `readBankBytes` in `scripts/research-bank-io.ts` transparently reconstruct them and verify their original SHA-256 and byte length. Local raw caches are ignored, not deleted. `scripts/pack-pigment-leg-bank.ts` performs a byte-for-byte roundtrip check; these storage changes do not alter the experimental data. This avoids the source host's per-object size limit.

Validation: 41 focused tests passed, including 300 repeated-route algebra trials, inverse proposal replay, fixed-coordinate ablations, disconnected intervals, planted solver counterexamples and existing premix tests. TypeScript and the production build passed. Build retained existing optional WASM-resolution and bundle-size warnings. No browser/mobile/listening test was performed for this offline-only update.

## 9. Recommendation

1. Use **palette-first discovery plus joint refinement**, while retaining route-first proposals for different finishing opportunities. This experiment does not justify discarding either method.
2. Make accepted-control style attacks mandatory before a specimen earns a strong style description. The first endpoint-audit label is not enough.
3. Next playable comparison should include a few well-separated three-leg survivors, a few two-leg rides/value shifts with explicitly available rather than required style, and the previously liked interior controls. Do not fill the lab with every refined variant or only neutral destinations.
4. Judge palette-level course strength from several distinct targets and route families, not the single best candidate or a count inflated by start/target variants.
5. Preserve all these cases before applying enjoyment rankings. A later learned preference model could rank them from human evidence; it must not replace reachability checks or manufacture certainty about required routes.

This is a substantial improvement in what the engine can distinguish and falsify. It is not evidence that an endpoint-only game can enforce every desired journey. The useful advance is finding structural candidates while exposing where freedom of approach defeats an intended style.
