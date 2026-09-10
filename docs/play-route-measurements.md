# Shared route measurements · routes-1

This is an offline lab evaluator, not a replacement pigment model or a proof of enjoyable play. Normal courses, old lab banks, tolerance, camera, and charge mechanics are unchanged. Six style evaluators reuse one route search. A hole needs at least two supported starting bases and at least one playable featured-style route; alternative bases need not produce the same style.

## Search and limits

Every base and different first paint is searched with 129 one-addition samples. Every second paint (including repeats and returns) is searched on a 25×25 time grid. Six spatially separated starting samples per order receive local coordinate refinement. This improves on the earlier 65 / 17×17 / three-start search. It is not exhaustive, excludes spending the first addition on the already pure base, and does not prove a global minimum.

Three-addition routes are witnessed by permutations of the target's original recipe, not an exhaustive search over arbitrary three-pour recipes. Up to three representative orders per base are retained, prioritizing the requested style and then the existing minimum timing margin. Travel minima are measured over the successful shortest-addition candidates before truncating representatives. They are not continuous geometric minima. One successful route from a base does not mean that every approach is good.

## Shared measurements

- Individual-pour and total travel: 48 samples per pour, in display-world coordinates. Neutral launch is excluded.
- Meaningful addition: travels at least 3 world units and omitting it, while replaying subsequent release times, misses tolerance. This is a local ablation, not proof that another re-optimized shorter recipe cannot work.
- Finish window: full contiguous successful interval containing that route's last release, in milliseconds on the rising meter leg. This is different from the old minimum **one-sided** margin over all releases. Entire leg is sampled, local minima refined, and boundaries bisected; disconnected intervals are kept separately. A sampled interval can still miss a very narrow island.
- Setup region: all earlier times varied jointly over a clipped ±0.18-second neighborhood, seven samples per dimension. For every cell the final paint's dose is re-searched across the rising leg. Coverage is successful cells / tested cells; median and minimum successful finishing widths are retained. A 7×7 local grid is not a global basin-volume calculation or a player success probability. It is expressed in control-time coordinates, not mixture ratios.
- Anticipatory setup: the penultimate pour increases a/b distance from target by >0.01, its a/b motion opposes the final a/b motion, and the final pour changes lightness by >0.06 and a/b by >0.025. These are OKLab components, not literal Munsell value or hue angle. It is a narrow measurable example of compensation, not proof of intention. Other forms of useful preparation may not receive the tag. Overall distance need not increase.

## Provisional style evidence

| Style | Evidence |
|---|---|
| Chromatic ride | An individual pour travels ≥24; route minimum OKLab chroma >0.05. Every base's shortest-found route must also travel ≥24. Not exact gamut-boundary verification. |
| Setup lift | At least two meaningful additions; final ΔL >0.10 and travel ≥9. Final paint need not be white. |
| Chromatic correction | At least two additions; colored finish changes absolute L >0.07 and a/b >0.03. |
| Interior weave | At least two additions, all locally meaningful. Robust-three is a stricter, separately reported constraint. |
| Complementary balance | At least two additions; sampled stop chroma decreases >0.065 from its maximum to the endpoint. This detects neutralizing behavior, not a certified pigment-complement relation. |
| Precision approach | Nonzero local setup coverage <0.65, with a full finish window ≥45 ms. |

A supported base has a retained route with full finish width ≥40 ms, at least two meaningful pours (one for a one-pour route), and local setup coverage ≥0.04 where applicable. These are hypotheses for this test batch, not universal quality gates. Every candidate needs at least two supported bases. Robust-three means three additions found from every base, best two-addition error >1.1 tolerances from every base, and meaningful three-addition routes with finish width ≥40 ms at every base. It does not assert broad setup regions at every base.

## Shortcut checks

Pure paints within 1.8 tolerances fail. One- or two-addition routes with travel <14 fail, as do one-addition black/white-only bypasses. Equally addition-efficient starts with shortest-travel ratio <0.60 fail outside the precision brief. This last cutoff was motivated by the reviewed Viridian Rust discrepancy and requires independent testing. It must not be reported as a discovered law or a validated 100% classifier. A deliberately simple lift is not automatically a failed setup-lift; the archive remains intact.

## Paired testing and feedback

Round 3 uses five fresh targets plus a known positive Secondaries reference. First play is free and unrevealed. A replay recommendation chooses a different supported base with greatest shortest-found travel. It is advisory, not forced. Its source attempt and suggested base are saved; actual selected paint remains in the shot log. Route verdict and overall-hole verdict are separate. Comparison feedback can say both worthwhile, first better, second better, or neither.

Existing courses-2, courses-3, lab-2 snapshots still reconstruct against their immutable banks. Lab-3 has a new engine identifier and fixed bank; no old records are rewritten. New optional feedback fields use the existing event sync/storage mechanism. Heavy analysis is absent from browser runtime imports; only precomputed results and routes are displayed.

## Feedback check before publication

All 380 records in the supplied second export validated without migration. The exact-target analysis now flags the rejected Viridian two-addition imbalance and the revised pale Zorn shortcut. The liked interior targets in Secondaries, Zorny, and Cobalt Ember retain robust-three coverage in the denser search. Some previously liked simple rides and an older Violet Shift hole fail the new extended-travel / balance criteria. These are counterexamples to treating the criteria as universal approval: the original banks remain unchanged. The revised narrow Cobalt ride still admits measured alternatives and is not automatically rejected. This evaluator does not diagnose camera/cup visibility. The feedback shaped thresholds; these observations are calibration, not held-out validation. Raw notes and account identifiers are not included here or in the generated bank.
