# Premix regions: measurement contract and evidence

New premix experiments use normalized mass. Pigment strengths, spectral mixing,
charge mapping, landing tolerance and free-start gameplay are unchanged. Old A/B
attempts and their exact rules remain replayable archives.

## Families and explicit non-claims

The six search lanes are five families: value finish (rise/drop), chromatic ride,
setup → glide, coupled balance, and interior assembly. They overlap. These are
operational candidate descriptors, not a proven model of enjoyment.

- **Value finish:** substantial value-led final adjustment, larger than earlier
  value adjustments, preceded by indispensable, meaningful setup. A first-shot
  lift, tiny white correction or light starting recipe does not establish it.
- **Chromatic ride:** substantial perceptual path length, arclength-weighted
  chromatic presence and hue/chroma displacement in the final shot. Exact gamut
  boundary membership is NOT claimed. World projection/camera cannot inflate it.
- **Setup → glide:** substantial final path after meaningful setup; nontrivial
  hue/chroma change excludes pure black/white travel. This remains a heuristic,
  not a judgment that all such glides feel different or satisfying.
- **Coupled balance:** an intermediate action improves value error while making
  hue/chroma error worse, or vice versa, followed by a repair. Complementary
  pigments alone do not qualify; a decorative curved path does not qualify.
- **Interior assembly:** at least three substantial, nondeletable actions toward
  a moderate/low-chroma target. This is a proxy: low chroma is NOT proof of being
  topologically interior to a palette gamut. Keep that uncertainty visible.

Implementation constants are in `scripts/premix-region-metrics.ts`, versioned.
55 ms / 4% are retained research support gates, not changes to gameplay. They are
not universal usability laws and are not used as human quality labels.

## Counterexamples retained

`play-premix-evidence-1.json` contains exact selected attempt snapshots and notes,
plus a hash of the supplied export (not account/authentication data).

Definition examples: Zorn first-shot rise and rejected easy Secondaries premix.
Held out from threshold tuning: pleasant Crimson Current, accumulated Zorn drop,
and two positive free-start cases, including GOOD CLOSE START. These are not a
blinded prospective holdout: their comments were previously discussed.

The pleasant Crimson Current *played* route fails the whole-route descriptors
because it includes small corrections/repeats. This is a live disagreement, not
evidence that the user's enjoyment was wrong. Whole-route intentionality and a
pleasant segment are different. Segment-level enjoyment prediction is unresolved.

No universal near-start exclusion: only a start already accepted by scoring is
excluded. Free-start close-start evidence is preserved, not mechanically relabeled
as normalized premix evidence. Camera/graphic appeal remains a human judgment.

## Region proposal and validation

For each recipe anchor, accepted ending recipes are sampled on three composition
rays at inner/middle/near-boundary fractions, plus the anchor. Each is replay-
checked inside the same OKLab landing ball. Backward subtraction happens in
pigment composition, then converts legal shares to normalized hold times.
Two- and three-addition predecessors generate fixed premix starts.

This explores MORE than target centers, but NOT the complete inverse image.
Composition rays can miss disconnected regions, and bisection assumes the first
connected accepted neighborhood along a ray. Every emitted endpoint is checked;
there is no claim that all accepted endpoints were sampled or optimized globally.

The target-only challenger enumerates paint orders with Halton seeds and local
optimization. A second seed uses denser one/two-action search. Surviving proposed
three-action routes also receive a same-depth challenger. All repeat orders are
allowed in the challenger. Style/recipe witnesses are never challenger inputs.

Metrics preserve raw versus timing-supported minima. Finish support is the
connected interval CONTAINING the demonstrated release, not the widest unrelated
interval. Setup support samples all setup controls on a distinct bounded tensor
grid, re-searching finishing controls. It is a LOCAL slice, not global region
volume or a probability of success. A separate fixed-control jitter measure is
not described as recovery planning.

Adjacent same-pigment additions are flagged when composable into one legal pour.
Deleting each action with other controls unchanged gives a counterexample test,
not proof that the action is indispensable under reoptimization. Independent
shorter-route search provides the stronger companion check.

Available / competitive / required-in-tested-routes are bounded observations.
No finite search establishes a global minimum or proves a style mandatory.
Rival sampling budgets and unmeasured counts are archived. Full palette course
variety and error-recovery trees are NOT solved by this pass.

## Working preference: reasoning effort

Flag higher effort before inverse-planning architecture, interpreting conflicting
evidence, and reviewing independent validation. Suggest lowering it for running
established searches, routine checks, lab wiring and publication. Do not silently
change model settings or imply higher model effort increases a script's numerical
search budget. User preference: conserve tokens; ask for increased effort only
when it materially helps. Official reference:
https://developers.openai.com/api/docs/guides/latest-model
