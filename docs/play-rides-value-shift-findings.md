# Rides and bidirectional value shifts: frozen feasibility search

## Result

The bidirectional definition finds a useful Orange Echo target: every base offers an efficient setup-and-value-shift route, but the finish can rise or drop depending on the route. A Cobalt Ember target similarly offers a qualifying ride from every base. Neither forces that experience: supported equally shot-efficient non-style alternatives remain.

No fully every-base-resistant ride or value-shift target was found in this bounded search. That is a negative search result, not proof of impossibility. No thresholds were loosened after seeing results. The public lab remains unchanged; subsequent lab labels should remain visible and distinguish opportunities from resistance.

## Frozen definitions

Protocol and implementation were committed before the search (commit c3c7766). Seeds 20261013 and 20271013 use the same twelve existing palettes and rules. No reviewed target recipes were supplied.

- General protection: every base has a supported route; minimum found route travel is at least 14 world units; the target is at least 1.8 scoring tolerances from every pure paint; retained supported efficient routes do not contain a token-pour bypass. This is a provisional numerical floor, not proof of enjoyable play.
- Ride: a continuous pour of at least 36 world units with at least 80% of that pour above Oklab chroma .06, plus at least 80% chromatic travel across the route. Curvature is measured separately, not used as a newly fitted pass threshold.
- Value shift: at least two meaningful additions, at least 6 units of setup travel, and a final pour of at least 9 units with absolute Oklab L change greater than .10. Positive is rise; negative is drop. Starting-paint selection and single adjustments do not qualify. Any found one-addition shortcut disqualifies the hole as a value-shift opportunity.
- Existing support thresholds remain 55 ms finishing width and 4% sampled local setup coverage. Scoring tolerance remains .0294.
- Opportunity: general protection passes and the style is available from at least half the bases.
- Every-base availability: each base has a qualifying efficient route.
- Every-base resistance: no retained supported equally shot-efficient non-style route was found from any base. Availability is not resistance.

The new audit groups routes using upward/downward/no-shift classifications rather than the historical upward-only label. It retains non-style groups and weaker ride/shift/travel variants alongside wide-window examples. Historical banks and their classifications are not rewritten.

## Search coverage and limitations

4,320 legal route-endpoint proposals were generated (180 per palette per seed). For each direction—ride, rise, drop—up to three separated proposals were selected for full audit, prioritizing minimum world distance from the pure paints before featured magnitude. There were 187 unique targets within their palette/seed groups checked in detail: 94 in the first seed and 93 in the second. Of these, 33 passed the general protection floor before dense finalist checks.

This is a bounded proposal heuristic, not direct maximization over all competing ride paths. Pure-paint separation is a lower bound on travel, not proof of a sustained ride. The finalist audit provides the actual competing-route check. A zero result may indicate a proposal-search limitation as well as a palette constraint. The second seed is fresh numerical replication, not independent player validation or evidence of preference.

Standard audits cover 129 one-addition samples and 25×25 two-addition samples per order with refinement and successful dose-region variants. Twelve finalist checks (ten distinct targets, with one target considered under multiple directions) use 257 one-addition and 49×49 two-addition samples. Three-addition alternatives are generating-recipe permutations; arbitrary three-control routes are not exhaustively searched. Retention is bounded. Claims of resistance remain conditional on sampled, retained, supported routes.

## Opportunities by palette

Cells are first-seed / second-seed counts among selected audited candidates, before dense finalist checking. The columns overlap. These are not percentages of the palette gamut or independent hole counts.

| Palette | Ride | Rise | Drop | Either-direction value shift |
|---|---:|---:|---:|---:|
| UltraOx Dual | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 |
| Zorny | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| RYB | 0 / 0 | 1 / 0 | 0 / 0 | 1 / 0 |
| CMY | 0 / 2 | 0 / 1 | 0 / 2 | 0 / 3 |
| Secondaries | 0 / 0 | 0 / 1 | 0 / 1 | 0 / 1 |
| Chromatic Dark | 0 / 0 | 1 / 0 | 0 / 0 | 1 / 0 |
| Violet Shift | 0 / 1 | 0 / 0 | 0 / 1 | 0 / 1 |
| Cobalt Ember | 3 / 3 | 0 / 0 | 0 / 0 | 0 / 0 |
| Crimson Current | 1 / 1 | 0 / 1 | 0 / 0 | 0 / 1 |
| Orange Echo | 0 / 0 | 0 / 1 | 0 / 1 | 0 / 1 |
| Cerulean Arc | 2 / 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| Violet Estuary | 2 / 2 | 0 / 0 | 0 / 0 | 0 / 0 |

Do not infer that Zorny is unsuitable for all value-oriented holes, or that Secondaries is weak overall. This experiment tests a particular final-value-shift structure with every-base protection and a small proposal shortlist. It does not negate the prior interior results or historical feedback.

## Dense finalist findings

### Cobalt Ember: ride availability from every base

Target `rs-20271013-10-130` retains ride availability from all four bases and passes general protection. Every base also has a supported non-ride alternative. Fewest found additions by base are 1, 1, 2, 2.

The weakest retained chromatic-pour evidence is approximately 29.8 units, below the 36-unit ride criterion. The strongest saved qualifying pour is about 37.0 units, with arc/chord ratio 1.026 and maximum bow about 3.14 units. It is not evidence of a spectacularly curved ride from every start.

A different first-seed Cobalt target (`rs-20261013-10-94`) offers a more pronounced 45.4-unit pour, arc/chord ratio 1.193, bow about 10.4 units, and a 168 ms finishing interval. But only three of four bases offer the ride, and its weakest ride evidence is about 25.1 units. This is a concrete tradeoff for a later visible-label comparison—not a solved universal ride.

### Orange Echo: either-direction value shift from every base

Target `rs-20271013-17-25` passes general protection, with two-addition routes from every base and minimum found travel about 25.7 units. Rise is available from bases 1, 2, 3; drop from bases 0, 1, 3. Their union covers all four bases.

Saved examples finish by approximately +.277 and −.142 Oklab L, with finishing intervals about 73 and 66 ms respectively. No single direction covers every base. Non-shift alternatives remain from every base, so the combined style is available everywhere but not resistant everywhere. This result specifically benefits from the user's bidirectional definition.

### Other useful opportunities

- UltraOx Dual produces a drop opportunity in both seeds. The first-seed dense target offers it from two of three bases, with two additions from every base, about 16.5 units minimum travel and a saved downward finish of −.292 L. It passes the numerical floor but may still feel compact.
- Crimson Current's second-seed rise target passes with two additions from every base and about 32.8 units minimum travel. Rise is available from three bases, not all four. Its saved large rise has a roughly 59 ms finishing interval, close to the support cutoff; that is not automatically desirable difficulty.
- Chromatic Dark and RYB have first-seed rise opportunities but not repeat positives in the second selected cohort.

### Dense checks rejected plausible-looking cases

Violet Estuary's second-seed candidate initially appeared to offer a protected ride from every base. The denser audit found a supported token-pour bypass, so it fails protection. A Violet Shift drop finalist also fails for this reason. These failed examples remain in the report and are not replaced with success labels. One Cobalt target inspected as a drop near-miss is rejected as a value-shift hole because other bases have one-addition routes.

## Next lab recommendation

A small comparison can now test the real distinction rather than claim the strongest route is the whole hole:

1. Cobalt Ember's every-base-available ride versus its more curved, less evenly available ride.
2. Orange Echo's bidirectional value-shift opportunity, replayed from contrasting bases.
3. UltraOx Dual downward setup/finish versus Crimson Current upward setup/finish.
4. A known strong Secondaries interior as a reference, not a required winner.

Keep intended labels visible. Also state whether they describe availability or resistance, and provide all-base route review. This would be a designed comparison, not a blinded preference test or a randomized matched-control experiment. The current search did not run such a player experiment.

No palette, par, tolerance or camera changes are warranted from these results alone. The next unresolved engine task is improving the ride/shift proposal objective beyond pure-paint distance while preserving this frozen round as evidence; do not modify its thresholds retroactively.

## Artifacts

- Frozen specification: `docs/play-rides-value-shift-protocol.json`
- Audit: `app/play-experience-audit.ts`
- Reproduction: `scripts/search-rides-value-shifts.ts`
- Exact recipes, witnesses, failures and source hashes: `docs/play-rides-value-shift-results.json`
- Regression tests: `scripts/test-play-experiences.ts`
