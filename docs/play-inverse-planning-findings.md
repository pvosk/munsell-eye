# Inverse-planning pilot — 11 September 2026

Offline research; no public gameplay change. Prepared starts and massless mixing remain proposals, not implementations.

## Question and method

Can working backward from an acceptable mixture find more useful routes without relaxing independent shortcut validation?

The existing engine already reconstructs exact recipe permutations analytically. This pilot compares that baseline with an augmentation, not with the entire existing hole generator. Both methods receive the same 24 targets: two fresh seeds, two targets per seed, across UltraOx Dual, Zorny, CMY, Secondaries, Maroon Arc, and Cobalt Ember. One target per seed uses two ingredients; the other uses all palette ingredients. This is a small feasibility study, not a representative ranking of palettes.

For normalized composition p, adding a fraction a of pigment i gives p' = (1-a)p + a e_i. Given p' and a, the predecessor is (p' - a e_i)/(1-a), provided its components are nonnegative. The new planner searches alternative endpoint recipes inside the ORIGINAL target's landing region, peels possible finishing additions backward, constructs bounded prefixes, and converts the required amounts into legal charge times using the unchanged dose curve. Every proposed route is replayed through the actual mixing engine.

The endpoint search uses finite recipe-space rays and only their first connected accepted segment. Prefixes and total routes are limited to three additions. This is not a global inverse solver or a proof of shortest routes. It does not collapse recipes to visible RGB, alter pigment strength, or move targets to fit proposals.

Candidate witnesses must pass the existing finishing-window and setup-support measurements. Already verified exact witnesses are retained so a bounded shortlist cannot accidentally discard them. Selection favors more supported starting bases, then separation from the nearest base. An independent numerical auditor receives the fixed target recipe, not the proposed route, and searches for competing approaches.

## Results

| Measurement | Exact recipe | Inverse augmentation |
| --- | ---: | ---: |
| Targets with a supported ride witness | 8/24 | 18/24 |
| Targets with a supported value-shift witness | 7/24 | 22/24 |
| Targets with ride witnesses from every base | 0 | 0 |
| Targets with value-shift witnesses from every base | 2 | 3 |
| Selected ride candidates independently eligible | 0 | 1 |
| Selected value-shift candidates independently eligible | 0 | 0 |
| Selected candidates style-resistant from every base | 0 | 0 |

Eleven distinct selected targets received independent screening. Only one qualified for denser checking; it remained eligible. Screening used 129 one-addition samples and a 25-by-25 two-addition grid plus refinement; the dense check increased these to 513 and 97-by-97 and included additional seeded three-addition search. Numerical non-discovery is not proof of absence.

Total local runtime was approximately 24.6 seconds. Proposal and witness measurement took 0.53 seconds for the exact baseline and 11.42 seconds for the augmentation. The methods do not have equal compute budgets, so this is not evidence of superior computational efficiency. No new candidates have been player-tested.

## The Maroon Arc candidate

`ip-30-1109261-0` targets approximately 26.3% Hansa Yellow Light and 73.7% Cobalt Blue, with Perylene Maroon and Raw Sienna also available. It is a green destination, 4.84 current tolerance units from its nearest pure paint. All four bases have supported solutions; the auditor finds minimum addition counts of 2, 1, 2, and 1 respectively.

Ride availability covers three of four bases, satisfying the current specialist-coverage rule. It is NOT protected from non-ride alternatives. Do not promote this finding to an all-base robust ride or a proven best hole.

There is also an important classification caveat. In the screening audit, Hansa Yellow Light followed by Cobalt Blue is a ride at approximately 0.911 seconds (37.01 world units), but the SAME order at approximately 0.850 seconds (34.59 world units) is not. The latter lands almost exactly on target; the former lands nearer the tolerance boundary. Our 36-unit cutoff converts these nearby dose variants into different style labels. Thus some reported bypasses are a threshold crossing along the same curve, not a fundamentally different strategy. Other alternatives still exist; this does not certify resistance.

## Interpretation and next step

The planner expands useful possibilities, but independent validation rejects most as intentional, protected style experiences. That is a meaningful result: more attractive witness routes do not automatically mean better holes.

Before a deeper search, retain the continuous measurements behind style labels and distinguish same-order dose variants from genuinely different approaches. Measure how much ride or value-finish character survives across successful doses and efficient competing routes. Keep the all-base feasibility checks independent of intended style. Then repeat on fresh targets with a matched compute budget and validate finalists more densely. Do not adjust thresholds simply to make this pilot pass.

## Mass versus composition

Accumulated mass and pigment composition are different state variables. Removing the mass dependence while retaining normalized original-pigment proportions preserves the geometric mixing curve for any chosen fraction, but changes which fractions a hold can reach. Existing timing windows, shortcuts, and par assumptions would need checking. It would make control more repeatable and remove accumulated resistance, without eliminating free-base shortcuts or the need to track composition.

The current dose scales as mass to the power 0.8, so dose relative to existing mass scales as mass to the power -0.2. At 16 parts, an identical hold has approximately 57% of its one-part relative influence. A mass-normalized mode would remove that effect; it is not implemented here.

Removing composition as well would require a new transition rule based only on visible color. Visually identical mixtures can contain different pigments and respond differently to the next addition. A color-only rule can still produce curved paths, but generally cannot preserve all of the original mixture paths. It would be a different, more directly controllable color-navigation system, not merely the current engine without bookkeeping.

## Reproduction and archive

- Planner: `app/play-inverse-planning.ts`
- Runner: `node --import tsx scripts/inspect-inverse-planning.ts`
- Tests: `node --import tsx --test scripts/test-play-inverse.ts scripts/test-play-inverse-results.ts`
- [Frozen results and policy settings](play-inverse-planning-results.json), including a hash of the listed engine and analysis sources. The hash is not a complete dependency/runtime fingerprint.
- Scratch screening traces are in ignored `outputs/inverse-planning`; the tracked results contain final compact audits, including dense replacements.

No controls, scoring tolerance, mass, pigment strength, palettes, par, campaign bank, sound behavior, or public deployment changed.
