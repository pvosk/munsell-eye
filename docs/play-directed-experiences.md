# Directed target and palette search — first bounded run

This is an offline experimental optimizer, not a replacement for the public course generator. It searches value shifts in either direction and chromatic rides. The new public round 7 uses the earlier frozen candidates, not these new palette mutations.

## What changed in the search

Previously, a featured route and distance from pure paints selected a short list before the every-base audit. Here **every proposed target or paint substitution receives the competing-route audit before ranking**. The audit objective determines which candidates produce the next generation.

The search starts from eight known candidates (four per style), including some previously rejected ones. Four generations retain a beam of four targets. Each parent produces three target-only mutations and three catalogue-paint substitutions with a target adjustment. A substitution changes the actual modeled paint, its starting location, and its mixing behavior together. No historical palette or pigment definition is overwritten; the temporary palette exists only in the offline process.

Ranking is lexicographic:

1. Every-base general safety, then fewer safety failures.
2. Intended style available from every base.
3. Proportion of bases with no retained supported efficient non-style alternative.
4. Proportion of bases offering the style.
5. Weakest supported route's normalized style magnitude, then minimum competing travel.

Ride magnitude uses both longest chromatic pour / 36 and whole-route chromatic fraction / 0.8. Shift magnitude uses the minimum of absolute finishing value change / 0.10, setup travel / 6, and finish travel / 9; a one-addition or token route scores zero. Neither the free base choice nor upward direction gets special credit.

Safety and style thresholds are unchanged from the frozen experience protocol. Numerical refinement, not the target's label, finds the competing endpoints. This is adaptive discrete/continuous search, not a closed-form solution or an exhaustive search of palette combinations.

## Run size and verification

- 200 scored palette/target candidates, spanning 102 ordered paint configurations, including the starting configurations.
- Eight finalists independently re-audited at 257 one-pour samples and 49 × 49 two-pour samples per order, with existing refinement and dose-region checks.
- Three fresh target perturbations per finalist palette, also densely checked: 24 neighborhood checks.
- Approximately 121 seconds for the complete run on this machine.
- All candidates, failures, ancestry, scores, paint definitions, dense witnesses, and neighborhood outcomes are retained in `play-directed-experiences-results.json`.

The same evaluators are used at higher resolution. This is independent numerical verification of finalists, **not an independent validation of the style metric**. Three-addition search still uses recipe-derived order witnesses rather than a comprehensive three-dimensional dose search. Resistance always means no retained supported efficient bypass was found, not proof that one cannot exist.

## What it found

### Rides

Cobalt Blue / Cadmium Orange / Permanent Rose / Flake White retains ride opportunities from 4/4 bases. Its dense weakest chromatic-pour floor is about 30.45 world units, compared with about 29.87 for the selected unchanged Cobalt Ember target. The qualifying-ride threshold is 36, and all four bases still have retained efficient non-ride alternatives. This is a modest improvement under the metric, not a solved resistant ride.

A no-white substitution using Mars Orange also offers rides from every base, but its weakest chromatic-pour floor is lower, about 28.01. None of the dense ride finalists preserves rides against alternatives from every base. None of their three fresh neighborhood targets retains every-base ride availability. Local target quality is not evidence of a whole ride-rich course.

### Value shifts

A new no-white combination — **Cadmium Orange / Transparent Orange / Nickel Titanate Yellow / Indanthrone Blue** — has a verified target offering value shifts from all four bases, with one base resistant to retained non-shift alternatives. The other three still offer bypasses. Its weakest total travel is only about 14.05 world units, close to the 14-unit safety floor: playtesting may find it too compact.

One of its three fresh neighbor targets also offers shifts from all four bases, again with one resistant base. That neighbor is only about 1.53 landing tolerances from the finalist; this is encouraging local support, **not two clearly distinct course holes**. The other neighboring targets do not preserve every-base availability.

Orange Echo has another target with shifts available from 4/4 bases but no resistant bases. A promising unchanged Chromatic Dark candidate loses all-base availability in dense verification (3/4), and remains recorded as such. Failed or downgraded checks are not silently replaced with the original claims.

## Limits and next decision

This implements joint palette/target search driven by competing routes. It does **not yet optimize a whole palette's multi-hole portfolio**: the beam ranks individual targets; the fresh neighborhood checks assess whether a result extends beyond one target. Several independently separated holes should be required before promoting any experimental palette to a course.

The beam starts from known candidates and tests local catalogue substitutions. It can miss distant palette families or regions behind a temporary decrease in score. Its results should not be used to declare free-start-resistant rides impossible. Likewise, a candidate that exploits a timing or geometry threshold might still feel poor.

Physical accuracy remains limited by the game's RGB-derived spectral approximation and modeled tinting strengths. These are not measured brand-specific reflectance curves. No claim is made that the numerically favored substitutions would behave identically as physical paints.

The immediate player task is the mixed round 7. Keep the experimental palettes offline until these style measurements receive that feedback. No changes to par, landing tolerance, charge controls, camera, sound, or historical palette identities are part of this pass.
