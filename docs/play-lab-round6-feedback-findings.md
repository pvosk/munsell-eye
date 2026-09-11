# Round 6 feedback: selection quality versus available style

Reviewed the supplied backup by retaining the latest attempt and review events per attempt ID: 12 round-6 attempts across all 8 holes, with 10 saved reviews. Historical positive reviews were also read. No hole, palette, par or scoring changes are made in this correction pass.

## Main regression

The directed search was an opportunity experiment, not a calibrated best-hole selector. It maximized the strength of a featured route (or the proportion of bases offering the style), after basic support and separation filters. That allows impressive demonstrations beside short, uninteresting routes from natural starts.

Every round-6 target has a sampled solution of one or two additions globally. The two featured interior routes use three additions starting from White, but other starts have two-addition routes. In a fresh standard-resolution audit, the earlier Secondaries target lab-3-5-2417069514 still has three-addition witnesses from every base and no found one/two-addition route; the shortest found travel is 37–47 world units across its four bases. The round-6 RYB interior permits two additions and roughly 19 units from Red. These are materially different challenges despite both having 4/4 interior-style availability. Sampled absence is not a proof of no shortcut.

Both featured ride demonstrations begin with the maximum 2.2-second setup charge and have successful finishes for all sampled local setup perturbations. The selector rewards large travel; it does not prove the large setup creates a valuable decision. This is a candidate-ranking weakness, not evidence that the new paint combinations should be discarded.

## Natural starts are not always the nearest color

The first Crimson Current lift has a roughly 68-unit intended route but a 15-unit minimum found from Lemon. Cerulean Arc has a roughly 17-unit closest-start witness versus a 51-unit one-addition ride from Cobalt. For Violet Estuary, Orange is nearest under the scoring metric, while the player's intuitive choice was Lemon. Likely hue-based starts need checking alongside perceptually closest starts and actual observed starts.

Pure-color separation alone does not explain quality: the successful neutral Crimson target is about 4.74 tolerances from its nearest pure paint, almost the same as the rejected bright Crimson target (4.75). Their minimum found route travel differs substantially: approximately 31–49 units across bases for the neutral versus 15–64 for the bright target. Route structure and plausible-start experience matter more than increasing one distance constant.

## What the ride attempts show

Cerulean Arc: Lemon start took 5 additions; Cerulean start took 3. Violet Estuary: Lemon took 6; Purple took 4. These are single observed attempts, not comparative skill estimates.

All use the same 0.0294 landing tolerance. There is no long-shot scoring bonus. Timing windows vary because charge-to-mixture-to-color sensitivity is nonlinear. Violet's saved Cerulean-to-Orange one-addition witness has a full finishing window of about 189 ms versus 82 ms for the Orange-to-Cerulean closest-start witness. That does not generalize to every long shot.

The player's Purple-to-Lemon opening traveled about 49 world units and ended at 1.28 times tolerance, outside the cup. Three further additions then landed. The search also reports no one-addition solution from Purple for that target. Length alone does not make a route finishable with one pour.

Lowering par would penalize additional pours on both routes; it cannot remove a short one-pour alternative when a long one-pour alternative exists. A scoring change is not a substitute for selecting better route geometry.

## Recommended next engine change, not implemented here

1. Preserve earlier positive Secondaries and Zorn holes as benchmarks; do not require every style to meet the same distance or shot-count rule.
2. Rank the weakest plausible-start experience before the best showcase route. Include hue-related and observed bases, not only the closest Oklab paint.
3. For demanding interior holes, explicitly request the established three-addition/no-found-one-or-two profile. Optional three-pour demos are a separate class.
4. For rides, compare one-pour branches by distance, curvature, chromatic retention and finish support. Do not assume moving the target far away in hue is sufficient.
5. Penalize showcase length produced by effectively replacing the initial base unless the setup has an independently useful constraint. Preserve purposeful large pours.
6. Retain the neutral Crimson target as a promising multi-start balancing benchmark. Its routes remain opportunities, not identical experiences.

Historical positive Zorn and Cobalt cases do not pass every current automated support check on this bounded re-audit. That is evidence to investigate search/threshold calibration against player benchmarks—not a reason to automatically discard known enjoyable holes.
