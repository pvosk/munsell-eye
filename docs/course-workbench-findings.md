# Course workbench: campaign continuity + new premix discoveries

2026-09-13. Research bank: `docs/course-workbench-1/`. Playable bank: `app/generated/play-course-workbench.json`.

## What changed

Twelve specimens, in two selectable tracks:

| Track | Palettes | Provenance |
| --- | --- | --- |
| Six normalized free-base holes | UltraOx Dual, Zorny, Secondaries: two each | Existing campaign targets, newly revalidated with normalized quantity and every pure starting paint |
| Six unplayed premix holes | RYB; Hansa · Scarlet · Violet; Earth Orange · Cobalt Green; Teal Earth; Scarlet · Cobalt Green; Violet · Lemon · Blue | Four fresh start/target outcomes; two earlier exclusion-bank finalists made playable for the first time |

The original campaign roster and all old lab collections remain available. Two genuinely new palette definitions are appended, never inserted into historical indices. Old recorded attempts retain their original targets, quantities, and mass mode. The earlier Hansa branching favorite has a direct replay button for comparison.

Normalized free-base is opt-in for these six specimens, **not a silent migration of the campaign**. The first paint selects a pure base, free of the pour count and independent of hold duration. Subsequent shots normalize the recipe to one part. Pigment RGB definitions, tinting strengths, mixing calculations, charge curve and landing tolerance are unchanged. Par remains the existing lab's constant three, not a new difficulty calibration.

## Search and validation

The roster contains all twelve requested campaign chapters, seven newer/reviewed-reserve palettes, and five distinct palette identities from the previous numerical exclusion search: 24 total. See the manifest for exact pigment identities.

For each palette, 160 sampled recipes supplied candidate colors. Up to eight separated, palette-relative target directions were selected: light, dark, chromatic, warm, cool, middle, neutral and colorful-middle. Existing campaign targets were also included. This yielded 226 examined targets, not a comprehensive gamut enumeration.

Every target was screened from **every pure base**, using an independent endpoint search for zero/one/two added pigment legs. The overview reports 52 nontrivial free-base candidates. This is only a screen: its `minimum: 3` sentinel means no <=2-leg endpoint was found at that effort, not that a three-leg solution was established. The overview's distance exclusion also is not an optimization of travel or fun.

For new target proposals on **4–6-paint palettes only**, the search sampled accepted recipe roots and inverse three-leg chains, rejecting negligible legs, insufficient start separation, and detected <=2-leg shortcuts before nomination. Three-paint palettes and eight-paint French Light were not subjected to this premix proposal sweep. Their zero nomination counts must not be interpreted as failures. Campaign targets were not passed into this inverse stage without recipe recovery.

Seven distinct target nominations survived the preliminary screen. All seven received a stronger audit: 192 samples, 12 restarts, up to 36 measured routes, maximum three legs, with a fresh check. All seven had shortest-found and proportion-supported three-leg solutions. Four were selected for target/palette contrast, alongside two unplayed previous-bank finalists.

Every selected premix received another independent <=2-leg search with 512 samples and 24 restarts. No shortcut was found. This remains bounded numerical evidence, not a global proof.

Each selected free-base target received the stronger audit separately from every base. Every base has at least one meaningful, executable, proportion-supported route and a final-release interval of at least 25 ms. The actual featured release, not an unrelated widest interval, lies in the reported window. This is a viability floor, not a claim of comfortable controls.

| Free-base pair | Shortest found after free selection | Comparison purpose |
| --- | --- | --- |
| UltraOx Dual | Two pigment legs from every base | Warm/cool balance, then a blue/lift alternative |
| Zorny | Three from every base | Warm nuance, then lighter muted correction |
| Secondaries | Three from every base | Violet-side balancing, then lighter multi-approach finish |

Do not describe the Zorn target as a true cool color: the lighter target is warm. Its counterweight opportunities and target hue are different facts. Likewise, a lift or ride label describes a measured available approach, not a style enforced across every efficient alternative.

All featured and retained alternative control sequences are replayed through the runtime transition; no intermediate accepted endpoint may precede completion. The six free-base reviews expose examples covering every base. Storage validators accept legitimate new sequences and reject altered after-recipes. Historical banks are unchanged.

## Palette/course interpretation

The board is deliberately not a total score or elimination list. The first campaign roster remains: UltraOx, Zorny, Maroon Drift, RYB, Orange Echo, CMY, Secondaries, Sienna Field, Maroon Arc, Teal Ember, French Light and Cobalt Ember. Zorn stays second.

RYB supplied two new nominated destinations, with the pale one playable now. Hansa and Earth Orange/Cobalt Green each supplied another target alongside their earlier branching specimen: that is a reason to compare chapter potential, not a reason to erase earlier favorable play feedback. Teal Earth adds a middle-green premix. Scarlet/Cobalt Green and Violet/Lemon/Blue retain the value of earlier numerical discoveries even when this bounded target sweep does not rediscover the same region.

French Light still needs its own wider-palette question. This run screened all its bases against the chosen targets but did not test a special multi-destination mode or exhaust its premix capacity. No palette is retired by this pass.

The hard three-leg exclusion continues to favor interior/balancing cases. Pale, dark and middle-value destinations broaden this set, but it is not evidence that chromatic rides or long finishes have now been solved. The Violet/Lemon example offers chromatic balancing/drop alternatives; a style claim is not a required route.

## Play feedback to collect next

Play naturally first, then replay another base or compare a measured alternative when useful. For the free-base pairs: do the two holes feel distinct, do natural starts remain worthwhile, and does normalizing quantity improve correction rather than merely reducing release count? For each premix: which actual decision or recovery made it interesting, and does it offer something different from the earlier Hansa favorite?

Keep strong one-offs even if a palette cannot supply a full chapter. Promote a palette toward a course only when multiple distinct target experiences survive play feedback. Do not infer chapter depth from a count of sampled orders at one destination.

## Verification

19 focused replay, persistence, graph and historical-navigation tests passed before release, plus TypeScript and a production build. Browser checks exercised track/palette/hole navigation at desktop and iPad-sized viewports. The local lab requires sign-in; signed-in shot interaction was not bypassed or claimed tested. Shot transitions and saved-event validation were exercised by automated tests using the actual runtime functions.

Reproduce with `scripts/search-course-workbench.ts` (requires a fresh output bank), then `scripts/build-course-workbench.ts`. The builder refuses to change a tracked bank. Raw candidates, audits, independent checks and selection provenance remain archived, including non-selected results.
