# Premix A/B lab — first backward-start experiment

## What is implemented

Four puzzles, each with two separately identified, replayable versions. A uses the existing accumulated-mass transition; B normalizes original pigment quantities to total 1 after each pour. Both start at the same one-part recipe and target the same RGB/OKLab endpoint, with tolerance 0.0294 and unchanged pigment definitions/strengths. All shots count. Par is fixed at 3 in both modes as an experimental comparison label, not a new calibration of campaign par.

The normal free-base game, its banks and saved attempts remain available and use the original transition. The experiment is opt-in through the lab collection picker. Its snapshots include starting quantities, mode and pair ID; validators replay its shot chain. Intended and competing paths are drawn from the actual premix, rather than treating the first added paint as a pure start. No new storage schema or auth mechanism.

## Search, not just relocated free-base holes

The proposer made 512 draws for each of four briefs: Zorny rise, Zorny drop, Secondaries coupled correction, Crimson Current long chromatic finish. It samples terminal recipe compositions and analytically removes two proposed paint shares backward. For normalized composition, p_previous = (p_next - alpha e_paint)/(1-alpha). Reject negative components and illegal hold doses. Retiming the same compositional shares gives valid forward witnesses under both mass rules. This is inverse planning in original-pigment recipe space, not inversion of a displayed RGB or drawing a decorative arc.

This first proposer works backward from target **centers** and measures surrounding accepted control regions forward. It does not yet enumerate the whole perceptual target volume's inverse image. Each brief selects up to 12 diverse high-scoring proposals, challenges them, and stops at the first passing pair. It is a bounded feasibility/controls lab, not a cream-of-crop search or broad palette optimization.

The target-only challenger is given the fixed recipe start, target and mode, not the target recipe or intended controls. It enumerates all one/two-action paint orders, including repeated paints, and optimizes holds with low-discrepancy seeds and coordinate refinement. First pass: 96 samples, 6 starts/order. Fresh challenge: 384 samples, 14 starts/order, different seed. All eight versions retained two-addition raw witnesses and no found one-addition shortcut. Continuous optimality is not proved; later corrections and longer paths are not exhausted.

## Results and style caveats

| Pair | Palette | Tested opportunity | Fresh-check supported orders / orders matching style, A and B |
|---|---|---|---|
| premix-0-399 | Zorny | Setup then value rise | 2 / 1 |
| premix-1-365 | Zorny | Setup then value drop | 1 / 1 |
| premix-2-81 | Secondaries | Coupled hue/value correction | 2 / 1 |
| premix-3-496 | Crimson Current | Setup then long chromatic finish | 2 / 1 |

Counts measure selected optimized examples per order, NOT all successful controls or a probability. The three 2/1 cases retain an alternate supported two-action order without the intended style. They must not be advertised as style-forced. Even the drop is only resistant within this bounded check. A fixed start improves our design leverage; it does not resolve alternate-route classification by itself.

Both additions in the planned route change endpoint color by at least one tolerance. The featured route must have a sampled finishing window >=55ms and >=4% accepted local setup slice. The slice tests 25 first-hold offsets over +/-10% of the charge leg, scanning 129 second holds. Finish width is the widest accepted interval on a 513-point rising-leg scan. These new local measurements are explicit and approximate; they are not success odds, a whole recipe-space volume, or identical implementations of the old free-base measurement.

Rise/drop tests require final |delta L|>=0.1, >=80% lightness alignment and a final change at least 80% of the setup lightness change. Coupling requires value and chromatic changes >=0.035 with opposing setup/finish a,b directions. Long finish requires projected length>=30, setup length>=6 and a,b displacement>=0.04. This does not certify boundary riding. These are provisional descriptors, not universal definitions of enjoyment.

## Geometry and feel

Color is still evaluated by the unchanged spectral mixer and scored with the same OKLab ball; the same Munsell-calibrated projection produces the visible arcs. The featured A/B recipes visit equal intermediate colors, but their holds differ. During arbitrary play the modes may have different endpoints for an equal hold, and accumulated mass continues to affect existing scene mass/scale/damping while B stays at one part. The A/B test therefore compares the complete mass behavior, not solely a cosmetic meter.

For M>=1 the existing relative added dose is r*M^-0.2. B keeps the dose at r by resetting mass, without changing tinting strength. Composition and its history remain; the engine never turns the previous RGB into a substitute pigment.

## Validation and next decisions

- Unit tests cover current-transition equality, scale-invariant normalization, predecessor/hold inversion, mode-specific endpoint and intermediate-color replay, first-pour accounting, snapshot round trips, mode tampering and shot-chain rejection.
- Previous lab collections' route replay/navigation/snapshot tests continue to pass. Physical iPad touch and authenticated cross-device round trips were not newly exercised for this pass.
- Preserve this lab as the initial controls comparison. Ask whether fixed starts feel intentional, whether A's accumulation adds worthwhile consequences, and whether B makes corrections too easy.
- Before designing mandatory styles, challenge all efficient orders over their accepted control regions, not one center optimum per order; broaden backward endpoint-region proposals and retain style bypasses.

Archives: `play-premix-search.json`, `play-premix-challenge.json`. Generated playable bank: `app/generated/play-premix-lab.json`. Research code: `scripts/build-premix-lab.ts`, `scripts/premix-search.ts`, `scripts/validate-premix-lab.ts`.
