# Destination-conditioned branching — 13 September 2026

## Outcome

The offline engine now accepts destination lightness/chroma ranges or an exact destination color, generates backward starts, and refines a shared start with two complete branch witnesses. It compares fixed-target refinement against joint start/target refinement and measures recovery from imperfect first choices.

**Four-paint, three-leg problems survived. Five-paint, four-leg requirements did not survive the tested shortcut checks.** We found useful destination-conditioned candidates without changing pigment strengths, normalized mass, tolerance, controls or par. This is not a guarantee of a desired journey: efficient routes can still offer different finishes.

Current public lab **v80 remains unchanged**. New routes are replayable research records, not yet added to the player-facing collection. The source checkpoint preceding this work is `c70262b1c505c1d47bcfb095c6719cf6f287b6d2`.

## Scope and search funnel

| Stage | Target-fit proposals | Interior-enriched proposals | Total |
|---|---:|---:|---:|
| Four/five-paint palette trials | 1,024 | 768 | 1,792 |
| Backward start/route proposals | 34,472 | 25,535 | 60,007 |
| Candidates reaching shorter-subset screening | 225 | 208 | 433 |
| Deep baseline audits | 50 | 46 | 96 |
| Fixed/joint refinement results | 19 | 17 | 36 |
| Baseline shortest-found three-leg cases | 19 | 23 | 42 |
| Refined shortest-found three-leg results | 10 | 8 | 18 |
| Shortest-found four-leg cases | 0 | 0 | 0 |

The trials contain **1,785 distinct palettes from 87 existing modeled paint snapshots**. Seven established controls repeat between runs. There are 898 four-paint and 894 five-paint trials; 63 four-paint and 33 five-paint baseline cases receive deep audits. Three-leg baseline survivors comprise 40 four-paint cases and two five-paint cases. Refinement arms share parents, so their results are not independent discoveries.

This is broad, stratified sampling—not exhaustive enumeration of pigments or continuous recipes. Most proposals do not reach deep evaluation. Screening requires initial separation, meaningful proposed legs, and a sampled one-leg miss; the deeper audit searches smaller pigment subsets. Local region support is required for audit selection. These priorities can exclude other enjoyable styles, so rejected proposals are retained too.

There are 4,970 palette/target requests for which initial feasibility search finds no eligible destination. This is a budget-limited failure, not an impossibility proof. Some five-paint dark/ride/earth groups have **no region-supported audit candidates**; they have not received thorough local optimization.

## New capabilities

1. **Destination conditioning.** Exact RGB targets remain unchanged even when a new palette cannot reproduce them. Range requests constrain OKLab lightness and chroma. Light: L .72–.90, C .035–.13; dark: L .27–.44, C .025–.10; middle: L .46–.68, C .035–.14; vivid: L .50–.82, C .12–.24. These are proposal objectives, not new scoring or style thresholds.
2. **Accepted-endpoint branching.** Sample recipe directions within the actual accepted target region, invert an n−1 chain, and obtain new premixed starts. Four paints propose three distinct pigment legs; five propose four. This samples part of the inverse image, not the entire accepted region.
3. **Shared-start refinement.** Optimize a common starting recipe and both branch fraction sequences, refreshing shorter-route attacks between rounds. The fixed arm preserves the destination; the joint arm may move it within its range. Exact-color requests run fixed-target only.
4. **Shape objective with separate verification.** A weak desired-finish reward sits behind endpoint, meaningful-motion, fraction-window and shortcut penalties. The requested label never enters the independent endpoint checker. Successful shaping does not automatically earn that label.
5. **Recovery observations.** Probe ±.06 changes to the first mixing fraction and substitutions of every other first pigment. Save recovery routes, raw and region-supported minima, and easy recoveries as well as harder ones.

The two initial branch witnesses reorder the same endpoint contributions. Refinement can change their fractions, and the audit examines additional ingredient sets/orders, but this is **not a complete branching decision graph**. It does not require two fundamentally different ingredient solutions. The shortlist often has one shortest ingredient set with several viable orders; those orders should not automatically be advertised as different puzzles.

## Routes worth playing

Every row has a shortest-found three-leg solution, sampled support at that minimum, and legal replay under current normalized controls. “Shorter miss” is the closest found one/two-leg endpoint distance divided by landing tolerance. Above 1 means it misses; this is not a difficulty score.

| Destination request | Paints | Shorter miss | Observed efficient-route evidence |
|---|---|---:|---|
| Light finish | Radiant Violet / Cadmium Yellow Medium / Chromium Oxide Green / Warm White | 2.14 | Rise on 4/13 routes; balancing on all 13. Four of ten first-choice perturbations need an extra recovery leg. |
| Vivid destination | Radiant Lemon / Yellow Ochre / Alizarin Crimson / Cobalt Teal | 2.40 | Ride on 7/19 routes; balancing on all 19. Ride available, not required. |
| Middle balancing | Phthalo Blue / Cadmium Red Deep / Cadmium Yellow Deep / Indian Yellow Deep | 2.12 | Balancing on 19/19 routes; six also qualify as rides. No white/black lift dependency. |
| Exact Hansa-lab target | Perylene Maroon / Cadmium Lemon / Titanium White / Permanent Green Light | 2.41 | Rise, drop and ride alternatives coexist. New start/palette; destination unchanged. |
| Exact Hansa-lab target | Cadmium Orange / Dioxazine Purple / Phthalo Green (Yellow Shade) / Titanium White | 2.03 | Secondaries provides a different approach to the identical target; four of ten perturbations need an extra recovery leg. |
| Middle balancing | Permanent Rose / Flake White Replacement / Chartreuse / Cerulean Blue | 2.79 | Balancing on 17/19 routes, with rising and falling finishes available. |
| Dark destination | Cobalt Blue / Cadmium Orange / Quinacridone Magenta / Flake White | 2.80 | Stronger three-leg dark/interior candidate, **not a measured drop-finisher**. |
| Exact RYB-lab target | Flake White Replacement / Cerulean Blue / Bismuth Yellow / Indian Red | 1.90 | Rise on 7/19 routes; a more restrained palette around a familiar light target. |

Light/dark/middle/vivid are requests, not player-tested quality claims. Fractions such as 7/19 describe capped retained witnesses, not player-choice probabilities or coverage of all successful controls. Target darkness and a dropping final leg are different facts.

Exact IDs, RGB targets, starting proportions, pigment snapshots, branches and competing routes are in each run's `assessment.json`, `audits.json` and `refinements.json`. The shortlist also retains a Chartreuse / Permanent Rose / Flake White Replacement / Ivory Black light candidate and a Hansa Yellow Deep / Manganese Blue Hue / Titanium White / Cobalt Violet solution. A weak dark candidate with only a 1.03T shorter-route miss stays archived, but is not a play priority.

## What fixed targets and joint refinement taught us

The exact Hansa-lab destination supports both the maroon/lemon/green/white palette and Secondaries. This demonstrates palette/start shaping around a fixed goal, **not** the ability to demand any finish from every approach. The exact Earth Orange/Cobalt Green target did not yield a shortlisted three-leg candidate here; it was not silently replaced with a neighboring target.

One dark joint refinement changed a shortest-found two-leg problem to three, but only with a 1.03T margin, and still failed the requested drop label. Some five-paint joint refinements exposed two-leg routes where fixed arms retained three. Optimization improvements are not automatically play improvements; disagreements remain visible.

The second run addressed a proposal bias: initial target fitting can choose sparse recipes near palette faces. It sampled 256 interior recipes per feasible palette/request and sought more interior accepted recipes for fixed targets. It found more four-paint three-leg baseline cases (22 versus 18), but still no five-paint four-leg minimum. Different samples/seeds mean this is not a controlled causal improvement estimate.

## Four-leg limits

The n−1 inverse construction successfully creates four-leg recipe paths for five paints. The issue is requiring four legs for **color-region arrival**, not constructing a long demonstration. Tested destinations have shorter color-equivalent solutions, or proposed longer paths fail the selected region/meaningful-motion checks before audit.

We should stop presenting four-leg demonstrations as evidence of four-leg puzzles. We should not claim four is mathematically impossible. Search is finite, uses a bounded proposal family, and imposes no intermediate checkpoints. Other palette/start/target combinations or intermediate constraints could differ. Five paints may improve optionality and correction without increasing minimum leg count.

## Recovery and validation

There are **388 first-choice perturbation cases**. Recovery within three legs was found in all; 43 allow zero/one-leg recovery. Neither statistic alone is impressive: with four paints and full-support starts, three-leg recipe constructions often make recovery expected. More useful is whether a perturbation needs more legs than the original shortest route had remaining. Shortlisted refined cases produce two to four such events among ten probes. This is promising correction structure, not calibrated frustration or a player-error model. Recovery is measured, not optimized, and supported-recovery searches are capped.

Baseline audits use 160 samples / 10 restarts per endpoint subset; refined audits use 256 / 12. A separate ordered-fraction solver challenges minima with fresh seeds. Post-selection holdout uses 384 / 20 on **17 records**: 11 diverse shortlist rows and six additional five-paint records. No further shorter counterexamples were found. Shared mixing physics and finite search remain common assumptions; this is independent parameterization, not an independent physical model or global proof.

Current-control replays reject premature capture and check actual final scoring. Geometry is recalculated at 192 samples. No requested-style flips occurred in assessed efficient witnesses or refined branch witnesses between ordinary and fine resolution. This does not establish universal classifier correctness.

## Recommended next move

Use a small comparative lab: a fixed-destination pair, the vivid candidate, one light finish, the dark Cobalt Ember case and one Chartreuse balancing case. Keep requested versus observed styles visible. Compare **where correction is needed and whether different first additions remain interesting**, rather than only completion count. Preserve the four well-liked branch holes as controls. Do not change strength/tolerance to manufacture a four-leg result.

## Reproduction and bank

- [First run and manifest](conditioned-branch-search-1/findings.md): seed 929831, 1,024 palettes, standard target fitting, 12 refinement parents requested.
- [Second run and manifest](conditioned-branch-search-2/findings.md): seed 1031931, 768 palettes, `CONDITION_INTERIOR=1`, 14 refinement parents requested.
- `scripts/search-conditioned-branches.ts`: use a fresh `CONDITION_OUTPUT`; existing archive directories are never overwritten.
- `scripts/assess-conditioned-branches.ts`: destination invariants, fine geometry, executable routes and shortlist.
- `scripts/validate-conditioned-branches.ts`: fresh post-selection counterexample checks.
- `scripts/pack-pigment-leg-bank.ts` / `scripts/research-bank-io.ts`: exact-byte SHA-256-verified compressed shards. Full local banks remain intact.

Both runs preserve proposals, failed feasibility requests, screened records, measured/accepted alternatives, refinement histories and recovery witnesses. Manifests preserve exact paint snapshots; summaries record source hashes. Current code retains the original default strategy and adds the interior strategy behind an explicit flag. No live generator or lab labels were silently replaced.
