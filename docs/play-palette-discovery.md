# Novel palette discovery · first bounded search

Runtime: 275.2 seconds. 3057 novel four-paint combinations screened with pair geometry; 12 shortlisted novel palettes plus three controls received full route searches. Four novel finalists and the controls received 48 fresh targets each.

## Held-out results

Each count is the number of targets whose requested style qualified AND had supported efficient routes from all four bases. These are model predictions, not human approval.

| Palette | Ride / 48 | Lift / 48 | Balance / 48 |
|---|---:|---:|---:|
| Cadmium Orange / Cadmium Red Light / Ultramarine Blue / Cobalt Blue | 1 | 1 | 3 |
| Titanium White / Cadmium Lemon / Alizarin Crimson / Dioxazine Purple | 0 | 3 | 4 |
| Yellow Ochre / Cadmium Red Light / Cobalt Blue / Cerulean Blue | 0 | 0 | 5 |
| Titanium White / Cadmium Orange / Alizarin Crimson / Cerulean Blue | 0 | 0 | 3 |
| control-Zorny | 0 | 1 | 2 |
| control-Secondaries | 0 | 2 | 3 |
| control-Cobalt Ember | 0 | 2 | 5 |

## How to interpret this

Every-base coverage is mandatory for a counted hole. Routes may differ in style across bases. A successful route from every base does not mean every possible decision sequence is good. The minimum finishing window is 55 ms; local setup coverage must be at least 4%. These are provisional playability proxies, not measured human success rates.

Training used 24 seeded recipes per palette; holdout used 48 independently seeded recipes with the same pair/triple/full-mixture distribution. All palettes have four paints. Finalists were chosen before holdout evaluation. Counts are conditional on this sampling distribution and have substantial small-sample uncertainty. Training/holdout targets are not manually selected successes.

The cheap shortlist favors the weakest paint’s useful pair interactions, with diversity between selected combinations. It is not exhaustive route optimization over every screened palette. Search covers every base and all one-/two-pour orders at 129 and 25×25 samples with six local refinements; three-pour routes are recipe witnesses, not an exhaustive search. Unfound routes can be real solver misses.

Paints use the existing modeled spectral behavior and tinting strengths, not measured brand reflectance. No physical mixing parameters, existing palettes, published holes, calibration, or user records were changed. This report and its saved recipe/route witnesses are for a subsequent lab selection, not a published new round.
