# Four-, five- and six-leg investigation

13 September 2026. This investigation changes no gameplay, pigment strength, tolerance, par or control mapping.

## Outcome

Two complementary searches banked **7,680 proposals** over **960 palette trials** using five, six and seven paints drawn from 87 modeled paint snapshots. These are trials, not a claim of 960 unique palettes or exhaustive palette coverage. Of the 673 cases selected for subset optimization, every case admitted a three-leg-or-shorter endpoint solution. Joint start/target refinement of 36 finalists still produced a shorter counterexample in every case, reproduced by the separate ordered-share solver.

We did **not** find a necessary four-, five- or six-leg hole. This is strong negative evidence within these searches, not a proof that such a hole is impossible. It does not invalidate interesting three-leg branching problems or longer optional journeys.

## What is actually being mixed

`app/play-engine.ts:mixtureColor` mixes the original pigment snapshots and their normalized recipe fractions through the installed `spectral.js`; it does not repeatedly mix the displayed RGB of the last state. The dependency lifts each pigment to 38 reflectance bands. Its concentration weights are proportional to `fraction² × tintingStrength² × luminance`. It averages the pigments' K/S spectra under these weights, applies the nonlinear inverse K/S transform, integrates the resulting reflectance to tristimulus values, and converts through display RGB to OKLab for scoring.

This is a nonlinear recipe-to-color function, F(q). Three displayed coordinates do not establish that three pigment additions suffice. Nor do 38 spectral bands establish that we need 38 additions. Both claims would require an additional argument about this particular function and its fibers.

The reconstruction check in `scripts/inspect-leg-dimensions.ts` reproduced the actual linear-RGB mixture to maximum error 2.87e−15 over 80 sampled palettes (20 each of four through seven paints). Sampled affine K/S ranks reached 3, 4, 5 and 6 respectively; finite-difference color Jacobians had rank 3 in these cases. Full spectrum geometry is not generally an affine three-dimensional mixing space. A rank-three local color map can have recipe-equivalent directions, but that alone does not prove its fibers reach a sparse-addition boundary globally. Clipping and singular points add further caveats.

## The exact recipe bound

For normalized state s, adding pigment i with final incoming fraction a gives

`q = (1 − a)s + a e_i`.

A sequence therefore ends at `t = λs + β`, where β is a nonnegative vector of added pigment contributions and its entries sum to 1−λ. Repeated additions of one pigment can be consolidated at the endpoint; different orders can still produce different intermediate paths.

For strictly positive s and t, choose `λ = min_i(t_i / s_i)` and `β_i = t_i − λs_i`. At least one β entry is zero. Thus **at most n−1 different pigment legs reach any exact positive target recipe from any positive start recipe**, under unrestricted incoming fractions below one. The existing contribution-to-leg construction implements this. If the minimum ratio is unique, an exact change to that particular recipe requires n−1 added pigments: a larger λ makes a contribution negative, and a smaller λ makes more contributions positive. Equal minimum ratios reduce the count. Identical recipes need no move. Zero fractions, exact replacement limits and finite release bounds require separate treatment.

Consequently, exact recipe candidates for four/five/six legs naturally use at least five/six/seven paints. But the game accepts **any recipe whose color lies inside the landing tolerance**, not only the demonstration recipe t. A different accepted recipe can admit fewer legs. The search attacks that weaker color requirement directly.

Recipe-level necessity is therefore not color-level necessity. Intermediate capture, release timing and meaningful motion are additional gameplay tests, not part of this endpoint bound.

## Search and independent checks

| Run | Proposal method | Proposals | Subset-screened | Jointly refined | Three-or-fewer solutions among screened |
| --- | --- | ---: | ---: | ---: | ---: |
| 611091 | Independent full-support start/target recipes | 3,840 | 430 | 18 | 430 |
| 711091 | Start built backward from a target through a longer chain | 3,840 | 243 | 18 | 243 |

For each requested depth, 160 palette trials generated eight proposals each. A 25-sample one-pigment sweep selected candidates with a sampled miss above 1.2 tolerances; this is a cheap proposal gate, not a certified one-leg exclusion. Each selected case then searched all pigment subsets through size three, using numerical optimization of endpoint contributions. Six candidates per requested depth and run received three rounds of joint start/target refinement against refreshed shortcut attacks.

Finalists received denser 256-sample/12-restart endpoint attacks and a separate 192-sample/10-restart ordered-share attack at the discovered shorter depth. All 36 finalists have stored, forward-replayable shorter witnesses. Only if the first three depths failed would the script enumerate all remaining shorter subsets; none required that escalation. Explicit success with three legs is enough to refute a four-, five- or six-leg requirement, so factorial enumeration of longer orders would add expense without changing that result.

Runs took about 218 and 169 seconds respectively on this machine. These times cover the search scripts, not preparation, analysis or publication. The seeds, paint snapshots, rejected proposals, attacks, refinements, witness orders and region measurements are archived in `long-leg-limits-1` and `long-leg-limits-2`. Oversized proposal files use lossless gzip parts with SHA-256 manifests; `readBankJson` reads either local raw files or the portable archive. No proposal was discarded from the bank merely for having a shortcut.

## Reproduction

Use fresh output paths; scripts intentionally refuse to overwrite prior runs:

```sh
node --import tsx scripts/inspect-leg-dimensions.ts
LEG_LIMIT_OUTPUT=/tmp/leg-limits-independent node --import tsx scripts/search-long-leg-limits.ts
LEG_LIMIT_MODE=inverse-chain LEG_LIMIT_SEED=711091 LEG_LIMIT_OUTPUT=/tmp/leg-limits-inverse node --import tsx scripts/search-long-leg-limits.ts
```

The first archived run predates the mode flag and omits `mode` in its summary; it used independent recipes and start-then-target random draws. The current script retains that draw order. Source hashes describe the exact script at each run, so later comments/mode support can change the hash without changing that run's proposal sequence.

## Design consequence

Continue using three-leg and branching-region strength as the productive baseline. Preserve longer demonstrations for sequence, choice and feel, but do not advertise their length as necessary difficulty. A future attempt to prove a stronger color-level bound would need analysis of F's accepted-region preimages, not another threshold change. A further empirical search should target a specific failure mechanism of the existing shortcut solver, not simply repeat larger random batches.
