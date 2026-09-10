# Competing routes: palette × hole-type audit

Bank: courses-3. Ten unchanged palettes. 960 analyzed, nontrivial, typed candidates. Four five-hole rounds selected per palette.

## Candidate yield by type

Cells are eligible / proposed candidates. Types overlap; do not add columns. A dash means this sample produced none, not that the type is impossible. Types are computed from candidate routes, not seven independent recipe generators. Only chromatic rides receive a new hard rejection here; the other types receive route-aware ranking in addition to their existing tests.

| Palette | Ride | Value finish | Quiet cool | Interior | Ingredient choice | Precision | Muted |
|---|---:|---:|---:|---:|---:|---:|---:|
| UltraOx Dual | — | 29/29 | — | 23/23 | — | 19/19 | 22/22 |
| Zorny | 10/13 | 60/60 | 34/34 | 30/30 | 9/9 | 26/26 | 11/11 |
| RYB | 20/33 | 32/32 | — | 50/50 | 1/1 | 43/43 | 23/23 |
| EarthPop | 34/67 | — | — | 34/34 | 32/32 | 28/28 | 14/14 |
| CMY | 24/44 | — | — | 60/60 | — | 54/54 | 37/37 |
| Secondaries | 18/29 | 19/19 | — | 48/48 | 4/4 | 45/45 | 33/33 |
| French Light | 14/44 | 15/15 | — | 16/16 | 102/102 | 11/11 | 7/7 |
| Chromatic Dark | 7/17 | 38/38 | — | 39/39 | 62/62 | 37/37 | 19/19 |
| Violet Shift | 40/61 | — | — | 21/21 | 49/49 | 19/19 | 9/9 |
| Double Cross | 15/39 | — | — | 19/19 | 59/59 | 16/16 | 12/12 |

## What the routes reveal

Medians below use proposed candidates, before the new ride filter. Efficient coverage is the share of palette paints admitting the globally fewest additions found. Minimum travel is the shortest found route among each base’s fewest-addition routes, in display-world units. Travel balance compares those per-base lengths only among equally shot-efficient bases; a longer rescue from another start does not invalidate a good ride. Timing is a local one-coordinate margin, not the width of the full setup/finish region.

| Palette | Interior efficient starts | Interior minimum travel | Ride travel balance | Precision timing margin (ms) |
|---|---:|---:|---:|---:|
| UltraOx Dual | 100% | 18.7 | — | 45.7 |
| Zorny | 75% | 19.3 | 73% | 46.1 |
| RYB | 75% | 22.3 | 47% | 43.1 |
| EarthPop | 100% | 20.6 | 51% | 35.9 |
| CMY | 100% | 26.7 | 51% | 40.7 |
| Secondaries | 75% | 21.7 | 63% | 39.0 |
| French Light | 81% | 15.2 | 42% | 39.8 |
| Chromatic Dark | 100% | 20.1 | 42% | 41.0 |
| Violet Shift | 100% | 25.6 | 58% | 39.0 |
| Double Cross | 100% | 24.1 | 39% | 47.6 |

## Selection rules now using this evidence

- Rides must retain at least 14 units of minimum found travel and a shortest/longest travel ratio of at least 0.40 among equally shot-efficient starts. These are tunable design thresholds, not perceptual laws.
- Interior, ingredient-choice and muted candidates gain preference for efficient starting-base coverage, multi-addition starts and minimum competing travel.
- Value finishes are ranked partly by the smallest competing final leg, rather than only the attractive example’s final leg. The tag still means a white/black finish exists; it does not claim every route requires one.
- Precision retains the separate no-one-addition-shortcut test and the most forgiving found minimum-shot route’s timing margin. Shortness alone is not a rejection.
- Palette-specific quotas, common tolerance, free base selection, pigment strengths and the charge/parts model are unchanged.

## Limits and reproduction

Every base and every distinct first paint is searched. Each ordered one-addition path has 65 samples; each ordered two-addition surface has a 17×17 grid. Three separated sample seeds per order receive local refinement. Feasible permutations of the generating recipe provide additional witnesses, sometimes with three additions. Other three-addition routes are not exhaustively searched. The algorithm minimizes endpoint error, not travel: “minimum found travel” is a comparison of successful candidates, not a certified travel minimum. Failure to find a route does not prove it impossible.

Candidate yield depends on the deterministic recipe sample and current paint approximations. This is evidence about available route structure, not a numerical proof of fun or a full palette ranking. The complete per-target/per-base results are in play-candidate-audit.json; all 70 palette/type cells are in play-competition-matrix.json.

Run build-play-courses.ts, then report-play-competition.ts with the existing TypeScript bundling workflow. Archived courses-2 holes remain valid for saved lab replays. New attempts use courses-3; compare the versions explicitly.
