# Fresh branching discovery: paired comparison

The playable v83 lab is **sixteen earlier banked candidates**, not a selection from this experiment. This research is archived separately. No changes to pigments, normalized mass, tolerance, control timing, par, game visuals, sound or Atlas persistence.

## Design

Both runs use the same 256 exact palettes: 64 each with 3, 4, 5 and 6 paints; twelve familiar palettes and 244 freshly sampled combinations from the modeled pigment catalog. They are 256 distinct palettes studied twice, not 512 independent palettes. Four target requests per palette; two methods per feasible request. Proposed depths are 2, 3, 4, 4 respectively, not proof of necessary leg counts.

The region method expands accepted landing seeds through shared predecessor states, using the newest sampled-region machinery. The chain baseline constructs independent distinct-pigment inverse chains. Both use the same accepted roots and at most 64 retained paths per target, plus the same nomination and audit budgets. Region paths can revisit a pigment nonconsecutively; chain paths cannot. All retained starts, recipes and paths are archived, including failed nominations. Intermediate graph candidates discarded during capped thinning are not an exhaustive archive of continuous possibilities.

The first run chooses palette-relative light/dark/vivid/middle targets from 96 sampled recipes. The second uses the older value/chroma-constrained destination proposer; infeasible requests remain unavailable. This separates a target-selection sensitivity check from the method comparison. It is not a pure test of branching alone across the two runs.

## Relative destination coverage

256 palettes; 1024 palette/destination requests; 0 unavailable requests; 131,072 retained proposals. 152.5 seconds for proposal/screen/audit execution on this machine, before this final holdout.

| Method | Eligible nominees screened | Deep audits | Raw 2 legs | Raw 3 legs | Raw 4+ legs | Multiple executable efficient first pigments |
|---|---:|---:|---:|---:|---:|---:|
| region | 159 | 14 | 14 | 0 | 0 | 14 |
| chain | 88 | 8 | 8 | 0 | 0 | 8 |

Region expansion took 28.15 seconds; independent chain generation took 0.18 seconds (both use the graph's accepted roots). Common geometry/scoring and screening add cost. These numbers do not establish equal-CPU superiority.

## Conditioned destination coverage

256 palettes; 1024 palette/destination requests; 162 unavailable requests; 110,336 retained proposals. 161.2 seconds for proposal/screen/audit execution on this machine, before this final holdout.

| Method | Eligible nominees screened | Deep audits | Raw 2 legs | Raw 3 legs | Raw 4+ legs | Multiple executable efficient first pigments |
|---|---:|---:|---:|---:|---:|---:|
| region | 271 | 16 | 14 | 2 | 0 | 16 |
| chain | 168 | 11 | 8 | 3 | 0 | 11 |

Region expansion took 23.80 seconds; independent chain generation took 0.14 seconds (both use the graph's accepted roots). Common geometry/scoring and screening add cost. These numbers do not establish equal-CPU superiority.

## Audited multi-leg leads

| Method | Paints | Target request (not style claim) | Raw minimum | Efficient first pigments | Fine measured styles |
|---|---|---|---:|---:|---|
| chain | Flake White / Cadmium Lemon / Cadmium Red Medium / Phthalo Blue (Green Shade) | light | 3 | 3 | rise: 6/19; drop: 6/19; chromatic-ride: 6/19; coupled-balance: 19/19; interior-assembly: 19/19 |
| chain | Cobalt Blue / Cadmium Orange / Quinacridone Magenta / Flake White | dark | 3 | 3 | chromatic-ride: 6/19; setup-glide: 3/19; coupled-balance: 13/19; interior-assembly: 19/19 |
| chain | Radiant Lemon / Radiant Green / Quinacridone Rose / Flake White Replacement | middle | 3 | 3 | setup-glide: 6/19; coupled-balance: 16/19; interior-assembly: 19/19 |
| region | Flake White / Cadmium Lemon / Cadmium Red Medium / Phthalo Blue (Green Shade) | light | 3 | 3 | rise: 6/19; drop: 6/19; chromatic-ride: 6/19; coupled-balance: 13/19; interior-assembly: 19/19 |
| region | Cobalt Blue / Cadmium Orange / Quinacridone Magenta / Flake White | dark | 3 | 3 | chromatic-ride: 6/19; setup-glide: 3/19; interior-assembly: 19/19 |

## Interpretation and safeguards

- Eligible-nominee counts measure proposal yield under the chosen filters, not player quality. Each method nominates at most one candidate per palette/target cell; that funnel can overlook candidates with lower initial separation but better later resistance.
- Four target types and four palette sizes compete for audit slots independently. Audit results are selected maxima, not population success rates. Missing slots are left missing.
- Raw minimum and proportion-supported minimum remain separate. Every finalist receives a fresh ordered-fraction holdout at 384 samples and 20 restarts per order, through one fewer than the prior raw minimum. Counterexamples stay in the assessment files. Finite searches are not impossibility proofs.
- Final route geometry uses 192 samples per leg. Executable efficient counts reject early capture at a prior release and preserve physical pigment strength. Available rise/drop/ride/balance traits do not make a style required.
- There is no trained model or fabricated target color. No new playable holes are automatically accepted from this experiment.
- Region expansion has greater proposal cost. More eligible starts alone would not justify replacing independent chains. Compare verified yield, target coverage, control support and ultimately player reviews.

## Archive / reproduction

Run `REGION_OUTPUT=docs/<fresh-directory> REGION_TARGETS=relative node --import tsx scripts/search-region-comparison.ts`; repeat with `REGION_TARGETS=conditioned` using the same seed for paired palettes. Then `node --import tsx scripts/assess-region-comparison.ts`. Each run's manifest stores paint snapshots, target policy, seed and source hash. Because candidate IDs are run-local, the globally unique archive key is **directory plus candidate ID**. Do not merge bare IDs across target-policy runs. Verified compressed shards load through `readBankJson`; original local raw files are caches.
