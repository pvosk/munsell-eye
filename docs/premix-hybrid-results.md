# Hybrid premix search: first broad results

September 12, 2026. Offline engine research; live gameplay and the playable lab are unchanged.

## Bottom line

Jointly moving the prepared mixture, destination, and demonstration doses produced
two new three-addition candidates whose original two-addition shortcuts no longer
land in a denser independent numerical search. This is measurable design progress,
not evidence that our style labels or player-enjoyment model are solved.

The new system uses finite-difference gradients through the actual forward mixing
function, discrete palette sampling/substitution, and a separate derivative-free
challenger. It is not an ML model. Pigment strengths and landing tolerance are
unchanged; every premix uses normalized mass.

## Breadth and selection

Two deterministic runs covered **3,027 distinct palette snapshots** from an
87-entry paint-snapshot catalog. Established palettes were included, with random
novel combinations of 3–6 paints; established wider palettes were retained too.
The runs overlap, so 1,024 + 2,048 must not be reported as distinct palettes.

| Measurement | Calibration run 1 | Balanced-depth run 2 |
|---|---:|---:|
| Palettes evaluated | 1,024 | 2,048 |
| Start/target proposals attempted | 32,768 | 65,536 |
| Legal witnesses generated | 31,294 | 62,541 |
| Proposals surviving cheap screening | 2,895 | 5,607 |
| Continuous refinement parents | 96 | 128 |
| Additional pigment-substitution children | 30 | 43 |
| New finalists independently audited | 36 | 48 |

The first run's combined ranking mostly selected two-addition candidates. The
second deliberately audited 24 two-addition and 24 three-addition candidates,
without requiring any number to pass. **23/24 two-addition candidates passed;
only 2/24 three-addition candidates passed.** This depth allocation is an experiment,
not a live-lab quota. We have not promoted the remaining candidates to fill holes.

Across the runs, screening evaluated about 20 million endpoints; the denser audit
and baseline comparisons evaluated another 20 million. A further fresh challenge
used 1.11 million evaluations. These counters exclude some continuous objective
and region-measurement calls, so they are not total compute or a complexity bound.
Recorded elapsed times were about 87 and 191 seconds on this machine, not a
portable performance benchmark. We are sampling the combinatorial space, not
exhausting it or claiming an optimum among all pigment combinations.

## The two new three-pour candidates

Errors below are measured relative to the unchanged landing tolerance: **≤1 lands**.
The table reports the best two-pour error found, not the error of the intended
three-pour route. Bigger values therefore mean stronger measured shortcut resistance.

| Paint set | Before refinement | After refinement | Featured finishing window | Local setup coverage |
|---|---:|---:|---:|---:|
| Radiant Turquoise · Radiant Lemon · Quinacridone Red · Radiant White | 0.746× | 2.200× | 84 ms | 32.1% |
| Transparent Orange · Permanent Orange · Titanium White · Radiant Turquoise | 0.767× | 1.548× | 116 ms | 18.5% |

Both original puzzles admitted a two-pour solution. Both refined puzzles retained
a supported, meaningful three-pour witness. The stronger fresh challenger used
two new seeds, 768 low-discrepancy samples and 32 coordinate-search restarts for
every one-/two-paint order, including repetitions, across the full legal rising
charge interval. A denser small-cleanup attack also found no winning cleanup.
These are numerical results, **not proofs that no shortcut exists**.

### Turquoise/red/lemon/white candidate

ID: `hybrid-751927-1809-6-1`.

The prepared recipe is approximately 67.8% Radiant Turquoise, 1.1% Radiant Lemon,
3.0% Quinacridone Red, 28.1% Radiant White. The target is a light warm pink
(display RGB approximately 241, 167, 171). The witness adds Quinacridone Red,
then Radiant Lemon, then Radiant White: approximately 0.679, 0.620, 0.569 seconds.
Seven outer refinement steps were accepted.

This is a credible candidate for a setup followed by a rising finish, but **not
a certified value-lift hole**: the existing strict rise classifier is false.
Its initial best one-pour miss was already large (6.34×); the useful change was
removing the two-pour bypass, not simply placing the target farther away.

### Two oranges/turquoise/white candidate

ID: `hybrid-751927-865-0-3-sub`.

The prepared recipe is approximately 3.1% Transparent Orange, 3.5% Permanent Orange,
69.6% Titanium White and 23.8% Radiant Turquoise. The target is a muted warm brown
(display RGB approximately 139, 102, 68). The witness adds Radiant Turquoise,
then Transparent Orange, then Permanent Orange: about 0.846, 0.467, 0.443 seconds.
Eight outer refinement steps were accepted.

This is a substitution child; its before/after comparison uses the SAME substituted
pigment set, so the measured improvement is not a misleading comparison between
different palettes. Its best one-pour miss also improved from 1.04× to 4.69×.
The final move is smaller than the other two but passes the existing movement,
deletion and cleanup tests. Whether it feels like a meaningful choice rather than
orange-on-orange trimming is exactly what playtesting must decide.

## Independent validation and remaining disagreements

The final solver is independent of the proposal's gradient method, **not independent
of the shared physics implementation**. It searches controls without being handed
the demonstration order or target recipe. Stored accepted shortcut controls are
replayable. The archive retains pre-refinement puzzles and failed candidates.

On several rejected three-pour candidates, coordinate search found substantially
better two-pour controls than the faster gradient challenger. Most already had
evidence of a shortcut or inadequate margin in the fast pass: we must not describe
all these as false passes newly discovered by validation. The exact disagreements
are in each audit's `optimization.after.bestT` versus `bestT`. This still matters:
the inner solver can underestimate shortcut quality, so increasing only designer
iterations would risk optimizing weaknesses in that solver.

The historical Zorny and Cobalt Ember three-pour positives survived the fresh check:
best two-pour misses were 1.389× and 2.836× respectively. Four historical examples
were rejected by the near-one-shot/cleanup rules, including both nominal rides.
However, **five examples the player found too simple still pass structural checks**:
UltraOx drop, Cobalt glide, Secondaries balance, and the two old reference holes.
UltraOx rise is a qualified case: its enjoyed route does not protect it from the
uninteresting alternative. These are calibration data, not a held-out success rate.

Consequently, “passes” means supported structural resistance at its chosen depth,
not “challenging,” “beautiful,” or “the right style.” Two-pour success must not be
marketed as equivalent to a robust three-pour puzzle. Legacy ride/balance/glide
labels remain diagnostic and are not used to force admission into the bank.

## What did not change

- No pigment-strength changes or made-up optimized pigment RGBs.
- No landing-tolerance, charge-bar, propulsion, par or sound changes.
- No accumulated-mass premix mode; normalized premix is the invariant.
- No forced campaign order or automatic replacement of the live lab.
- No claim to have optimized the entire landing region's inverse image.

The local setup percentage counts sampled perturbations across all setup controls
that admit a finish; it is not a percentage of the whole gamut, and not a player
success probability. Finishing intervals are connected local accepted windows.
The 55 ms / 4% support rules remain provisional and explicit. Close starts are not
universally banned, although trivial near-landed states are screened and distance
has a capped secondary reward. A dedicated close-start-excursion search remains
different from this mostly resistance-driven run.

## Next useful test

Make a small **before/after** lab from these two candidates, alongside the liked
Zorny/Cobalt interiors and one structurally passing but previously disliked
two-pour control. This tests whether the measurable gain feels better, rather than
asking the player to accept another large collection of relabeled easy holes.

For the next engine iteration, feed independent shortcut counterexamples back into
the inner solver and periodically use the stronger challenger during refinement.
Then optimize style within the surviving structural regions. Keep rise/drop,
chromatic travel and coupled balance as separate measurements; don't declare a
style successful merely because three pours are necessary. Preserve both good
single holes and palettes with multiple good starts/targets. No new learned model
is warranted by these results alone; a learned ranking aid remains an option once
we have enough independently rated examples.

## Artifacts and reproduction

- Method and limitations: [premix-hybrid-design.md](premix-hybrid-design.md)
- First archive: [premix-hybrid-1/summary.json](premix-hybrid-1/summary.json)
- Second archive: [premix-hybrid-2/summary.json](premix-hybrid-2/summary.json)
- Fresh check: [premix-hybrid-2/fresh-validation.json](premix-hybrid-2/fresh-validation.json)
- Each archive includes full paint snapshots, proposals, refined witnesses,
  independent accepted routes, counterexamples, policy, seeds and source hash.

Run 2: `HYBRID_OUTPUT=docs/premix-hybrid-2 HYBRID_SEED=751927 HYBRID_PALETTES=2048 HYBRID_REFINE=128 HYBRID_VALIDATE=48 node --import tsx scripts/search-premix-hybrid.ts`.
Use a NEW output directory to rerun: existing archives cannot be overwritten.
Fresh check: `node --import tsx scripts/validate-premix-hybrid.ts <new-run-directory>`.
