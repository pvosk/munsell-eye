# What this pass actually established

The palette search is open again. The four recently played palettes are benchmarks, not a locked roster. But the most important result is a better diagnosis of the selection problem—not a declaration that we have found the final palettes.

## The classification fix

The new offline evaluator retains different doses along the same paint sequence. It separates:

1. **Available style:** an efficient route of that style exists from a starting paint.
2. **Style resistance:** no supported, equally shot-efficient route avoiding that style was found from that start.
3. **Closest-start resistance:** the intended style also survives starting with the pure paint closest to the target in scoring space.

All-base viability is checked separately. A palette cannot hide an unsupported starting paint behind a good average. Global fewest additions are recorded separately from the fewest additions available from each base. A featured two-addition route is not presented by this analysis as the global optimum when another base has a one-addition route. The existing public lab presentation is unchanged in this offline pass.

Orange Echo provides the concrete regression: orange → ultramarine → transparent orange can be either an opposing-color route or a large adjustment followed by a small correction, depending on doses. Your observed shortcut lands at **0.536 tolerances**, with a **169 ms finishing window**. It has only one meaningful addition under the existing measurement. The independent search now finds that kind of bypass without being supplied your shot timings.

Seven of the eight saved lab targets fail the new *majority-of-starts style-resistance* requirement. This does not mean seven were unenjoyable: it means their intended style was more optional than the old labels implied. Crimson Current’s second target retains opposing-color resistance from three of four starts.

## What was run

- All eight saved v52 targets, unchanged, with a denser one-/two-addition search.
- All 16 previously inspected palettes on their original 24 training targets.
- A cheap screen of **4,845 four-paint combinations** from 20 modeled paints, followed by full route analysis of **12 new combinations**. The shortlist explicitly includes white, black and all-colored groups.
- **48 fresh targets each for nine palettes:** frozen finalists plus the current favorites and historical controls.
- A denser recheck of **all 27 accepted fresh targets**. None lost their initially accepted style under that resolution increase.

That is 1,112 target evaluations before the final 27 resolution rechecks. Three-addition search remains limited to generating-recipe permutations; one-/two-addition orders are sampled and locally refined, not proven exhaustively over continuous controls.

## The decisive follow-up: majority coverage still is not enough

The first results made lemon / orange / cobalt / cerulean look promising: **8 of 48 targets** passed majority ride resistance. The new lemon / orange / dioxazine / cerulean combination produced **3 of 48**.

But **all 11 still have a supported non-ride alternative from the closest starting paint**. In those alternatives the longest chromatic pour is roughly **16–28 world units**, versus the advertised ride threshold of 36. This is not just a rounding issue at the threshold.

So those are *ride opportunities*, not yet reliable free-start ride holes. The added closest-start policy prevents promoting them as the latter. It is a post-hoc diagnostic based on your explicitly described behavior, not proof that all players choose the nearest color. Its results are saved separately rather than silently rewriting the original experiment.

## Palette implications

**Lemon / orange / dioxazine purple / cerulean blue is worth further investigation for a mixed course.** On the fresh cohort it has three interior passes and one opposing-color pass; those labels overlap across three targets, and each survives the closest-start check. The broader accepted sample reaches lower/middle lightness and quieter colors. It is a genuine newly shortlisted alternative—not one of the four palettes we had committed to testing previously.

**Cobalt Ember remains a useful comparison for opposing-color decisions.** One fresh opposing-color target survives the closest-start check. That is evidence for a candidate hole, not enough evidence to promise an entire course of that style.

**The cobalt/cerulean palette remains a ride experiment, not a recommended replacement course yet.** Its attractive long arcs do not solve the natural-start shortcut problem.

**Do not remove Zorn, Secondaries, Orange Echo or Crimson Current on these counts.** These are small recipe cohorts and stricter style definitions, not ratings of the palettes’ enjoyment. For example, Crimson Current’s training performance was much stronger than its fresh-cohort result. Zero accepted targets does not establish that a palette cannot produce good ones.

## Best next step

Keep this corrected competition audit as the gate, and change target proposal next:

- For **rides**, optimize the weakest/closest starting paint’s best short-route travel, then require a genuinely long chromatic pour. Do not maximize the prettiest demonstration arc.
- For **lift**, search explicitly for post-base setup-and-lift structure that survives competing orders. No robust lift target survived this pass; the engine should report that honestly instead of filling a lift slot with an optional white finish.
- For **balancing**, preserve the demonstrated opposing-color cases and seek more diverse nearby targets while rechecking the same dose-dependent bypasses.
- Rank course possibilities by distinct targets, coverage and value/chroma range—not repeated near-identical passes or the sum of overlapping style labels.

The current engine can now reject or expose the misleading examples identified here. It is **not yet a solved procedural generator for every desired style**, and this pass does not justify designing a fixed roster around the latest winners. Par, scoring, the public lab, animations and sound were not changed.

## Reproduction

Run `node --import tsx scripts/audit-and-reopen-palettes.ts`, then `node --import tsx scripts/verify-route-audit.ts`, then `node --import tsx scripts/audit-start-bias.ts` from the project. Cached experiments are fingerprinted by source and paint definitions. The core report, fixed-target audit, dense verification and closest-start diagnostic are the adjacent `play-route-audit-*.json` files. The detailed tables are in `play-route-audit-discovery.md`.
