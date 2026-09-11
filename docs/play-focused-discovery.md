# Focused palette discovery

Completed in 221.4 seconds. 3057 combinations cheaply screened; 16 palettes route-tested. Finalists selected on 24 training targets before 48 fresh targets each.

| Palette | Ride | Value–color tradeoff | Opposing colors |
|---|---:|---:|---:|
| Cadmium Lemon / Quinacridone Magenta / Alizarin Crimson / Cerulean Blue | 9/48 | 4/48 | 9/48 |
| Yellow Ochre / Cadmium Orange / Cobalt Blue / Cobalt Teal | 18/48 | 2/48 | 2/48 |
| Cadmium Lemon / Cadmium Red Light / Dioxazine Purple / Cobalt Blue | 8/48 | 4/48 | 6/48 |
| control-Zorny | 0/48 | 0/48 | 1/48 |
| control-Secondaries | 6/48 | 2/48 | 3/48 |
| control-Cobalt Ember | 9/48 | 5/48 | 5/48 |
| control-Viridian Rust | 7/48 | 2/48 | 6/48 |

## What acceptance means

Every counted target has supported efficient routes from every starting paint; at least one supported efficient route has the requested trait. Other bases need not share its style. Minimum whole-route travel is 14 world units; target separation is 1.8 scoring tolerances; timing support is at least 55 ms and sampled setup support at least 4%. These thresholds are provisional, not validated human difficulty standards.

Ride: at least one efficient route has a pour at least 36 world units long, with at least 80% chromatic travel on that pour and on the whole route. Target chroma is at least 0.07 Oklab. Unlike the previous search, alternative efficient routes need not all exceed 30 world units. The shared 14-unit floor remains.

Value–color tradeoff: a colored addition AFTER the free base reduces absolute target lightness error by at least 0.035, increases target a/b error by at least 0.015, and a subsequent addition repairs at least 0.015 of that a/b error. This measures combined hue/chroma cost, not hue angle alone. A free white start is not a value-lift event.

Opposing colors: consecutive colored additions have substantial opposing a/b displacement (each greater than 0.025; cosine less than -0.25). This is measured modeled interaction, not a claim that paints are exact complements. The shortlist favors two distinct chroma-reducing pigment pairs, but a passing route need only use one opposing interaction. The two balance traits can overlap.

Balance searches reject any found one-addition shortcut. Rides allow a substantial one-addition route. Meaningful additions, legal merging of split doses, and competing shortest-count routes are inherited from routes-2. Only three retained efficient orders per base are inspected for focused traits: missing traits can be search/retention misses.

## Limits and reproducibility

Search covers every base and all one-/two-addition orders on sampled grids with local refinement. Three-addition solutions are generating-recipe witnesses, not an exhaustive search. Counts are lower-bound model findings conditional on the cohort distribution, not proof that other targets or routes are impossible. Small holdout samples do not establish a statistically reliable palette ranking.

Recipes and route witnesses are saved in play-focused-discovery.json. Finish-paint and order diversity are reported for replay selection; they are not proof of spatially different paths. Palette IDs refer to temporary offline slots; replay against the saved paint definitions, never a current live index.

No existing palette, physical mixing model, tolerance, published lab, or user data was changed. These are new-to-this-game candidates, not claims of historical originality.
