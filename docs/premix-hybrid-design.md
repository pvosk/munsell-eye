# Premix hybrid designer–challenger search

## Scope and invariants

Offline search only. Campaign, live lab, landing tolerance, charge controls and
pigment strengths are not changed. All actions replay through the same normalized
premix implementation as gameplay. Palette candidates use catalog/established
play-palette paint snapshots; no RGB or strength is optimized into a fictional
pigment. Existing historical palettes are preserved, not overwritten by variants.

The user review motivating this change is the September 12 normalized-region lab:
UltraOx rise had an enjoyable red→white route but an uninteresting white-first
alternative; UltraOx drop, both rides, setup glide and both balance tests were
unconvincing. Zorny and Cobalt Ember three-addition interiors were positive cases.
The two historical references were also rejected in this playthrough. These are
calibration examples, not held-out human validation or universal palette verdicts.

## Continuous and discrete optimization

`scripts/premix-hybrid.ts` uses central finite differences through the exact color
function (one-sided at constrained boundaries). No trained predictor, automatic
differentiation library or substitute pigment model is introduced.

Start and destination are independently parameterized on the composition simplex
using log ratios. Doses are bounded to legal charge controls. A fixed-order
demonstration must remain inside the unchanged accepted landing region. Moving
the target away from the exact demonstration endpoint is allowed, with an error
penalty and a final exact landing check. The whole inverse image is not exhausted.

Each outer update ascends a continuous resistance objective with backtracking.
The inner gradient challenger enumerates discrete one-/two-action orders and
optimizes doses from low-discrepancy starts. After the designer moves, these attacks
are re-solved before accepting the move. Attacks discovered on rejected moves are
retained as further competing controls. This is approximate bilevel optimization,
not a proof of a minimax solution. Final validation uses fresh-seed, denser,
derivative-free coordinate search rather than trusting the gradient optimizer.

The broad proposal bank combines forward witnesses and backward composition
predecessors, across thousands of sampled palette/start/target configurations.
Reusable one-shot fields screen multiple destinations from the same start.
Palette substitutions are a discrete mutation layer followed by continuous
refinement. The parent is retained even if the mutation succeeds.

## Structural evidence before style

- Formal shortest-found and timing-supported shortest-found remain separate.
- Distance to the best simpler endpoint is continuous evidence: 1.08 tolerances
  is not strong resistance merely because 1.00 is the landing boundary.
- Explicit cleanup attacks search a large first move followed by a correction
  constrained in perceptual color displacement, not small paint mass.
- Existing deletion, adjacent-repeat merge, minimum movement, local connected
  finish-window and all-setup-axis coverage tests remain in final validation.
- Finalists must have a replayable supported witness, not only a distant target.
- Close starts are not universally forbidden; only already-landed/trivial cases
  are screened. Distance is capped as a secondary objective, never maximized alone.
- Legacy family classifiers are reported after structural selection. There is no
  family admission quota, and these tags are NOT certified player experiences.

Version 1's explicit provisional policy uses 1.5 tolerances for near-one-shot
resistance and small-cleanup displacement, 1.3 for the best shorter-route margin,
55 ms for finishing support and 4% local setup coverage. These are transparent
calibration choices, not psychophysical constants. Raw numbers, counterexamples
and failed candidates remain in the archive so the policy can be re-evaluated
without erasing inconvenient evidence. A large local setup region is reported,
not itself a rejection: breadth can be forgiving without making the route trivial.

## Archive and reproducibility

Run `node --import tsx scripts/search-premix-hybrid.ts`. The default output is
`docs/premix-hybrid-1`; existing output directories cannot be overwritten.
Use `HYBRID_OUTPUT` and `HYBRID_SEED` for independent runs. Optional
`HYBRID_PALETTES`, `HYBRID_REFINE`, `HYBRID_VALIDATE` control breadth/depth.

Each bank stores pigment snapshots, palette provenance, sampled candidates,
refinement trajectories, independent accepted routes, explicit cleanup attacks,
failed finalists, historical regressions, exact controls, seeds, policy and source
hash. Both a strong single hole and a palette with several holes can be retained.
No automatic campaign replacement or unreviewed naming promotion occurs.

## Remaining limits

No global reachability proof. Gradients are local and the active best shortcut can
switch discontinuously. Screening can miss candidates; palette sampling is not
exhaustive and larger paint counts receive less depth per possible combination.
Two measured controls per accepted order do not cover the full accepted region;
unmeasured counts are disclosed. Cleanup checks cover one correction, not a full
adaptive recovery tree. Finishing support is local, not a player success rate.
The score cannot certify enjoyment. In particular, the old chromatic-ride label
can still include tinting paths: raw style tags are descriptive only until refined
and re-tested with humans.
