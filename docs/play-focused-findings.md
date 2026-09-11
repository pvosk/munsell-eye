# Focused palette search: findings and next lab selection

## Outcome

Completed the three searches: chromatic rides, value–color tradeoffs, and opposing-color interactions. Screened 3,057 new-to-the-game four-paint combinations using modeled pair curves; route-tested 12 novel candidates and four existing controls on 24 targets each. Three novel finalists and all four controls received 48 fresh targets each. An additional representative from the explicit two-pair shortlist received a separate 48-target check, selected by its training results rather than its holdout outcome.

The main search took 221 seconds. The supplemental search and denser verification were additional. No published palette, lab round, paint model, landing tolerance, par, animation, or user record was changed.

## The three leading directions

| Paint combination | Why test it | Fresh target results |
|---|---|---|
| Yellow Ochre / Cadmium Orange / Cobalt Blue / Cobalt Teal | Strongest ride candidate in this search | 18/48 rides; 2/48 value–color tradeoffs; 2/48 opposing-color holes |
| Cadmium Lemon / Quinacridone Magenta / Alizarin Crimson / Cerulean Blue | Multiple approaches and useful opposing adjustments | 9/48 rides; 4/48 value–color tradeoffs; 9/48 opposing-color holes |
| Cadmium Orange / Transparent Orange / Ultramarine Blue / Permanent Green Light | An unusual warm/cool interaction candidate, including two different oranges | 0/48 rides; 4/48 value–color tradeoffs; 5/48 opposing-color holes |

These are small-sample model yields, not player ratings or probabilities of enjoying a hole. Styles can overlap, so the columns must not be added as counts of distinct holes. The supplemental third palette was selected separately to preserve a representative of the explicit opposing-pair family, not because it beat the generalist finalists.

Cadmium Lemon / Cadmium Red Light / Dioxazine Purple / Cobalt Blue is another viable alternate: 8/48 rides, 4/48 value–color tradeoffs, 6/48 opposing-color holes. It has not received the additional dense finalist checks in this pass.

All shortlisted novel combinations in this particular pass omit white. This is partly a consequence of the shortlist heuristics, which favor chromatic value changes and opposing colored pairs; it is not evidence that white weakens a palette. Existing white-containing controls were retained. A future matched white/no-white comparison would be needed to isolate that effect.

## What survived the stronger check

Selected eight style-target examples, representing **seven distinct targets across three palettes**, then roughly quadrupled the two-addition grid density. All eight style checks retained eligibility. There were no newly found disqualifying shortcuts in that check; this remains a sampled search, not a mathematical proof.

- **Ochre/orange/cobalt/teal:** two targets. Both have qualifying ride routes from three bases. Shortest-found addition counts are 2 / 1 / 1 / 2 in paint-list order. The fourth base has a worthwhile shorter route, not a forced long ride. Minimum competing whole-route travel is about 25.5 and 25.8 world units. This explicitly keeps substantial one-shot finishes rather than treating every one-shot hole as broken.
- **Lemon/magenta/crimson/cerulean:** three distinct targets covering four style checks. All bases have two-addition solutions. The selected opposing-color checks qualify from all four bases; the stricter value–color tradeoff qualifies from just one base per checked target. Consequently this is a strong opposing-interaction candidate, but not yet a demonstrated every-start replacement for the secondaries experience.
- **Orange/transparent orange/ultramarine/permanent green:** two targets. All bases have two-addition solutions; opposing interactions qualify from three bases. The fourth retains a supported alternative. These are balancing candidates, not chromatic rides.

The result is a small replay shortlist, not a published new round. These examples predominantly test two-addition play; they do not establish new three-addition-from-every-base challenges or calibrated player par.

## What changed in the search

The previous ride test required all efficient starting routes to travel at least 30 world units. That was stronger than the agreed design goal. The focused policy instead requires:

- one supported efficient route with a chromatic pour at least 36 world units long;
- at least 80% chromatic travel on that pour and its complete route;
- worthwhile supported efficient routes from every base, retaining the shared 14-unit minimum competing-route floor and pure-paint separation check;
- no requirement that all alternative routes have the same style or length.

The value–color test now looks for an actual addition after base selection that improves value closeness while worsening hue/chroma closeness, followed by a later repair. Starting with a light paint does not count as that event. The test measures distance in Oklab a/b, not hue angle alone.

Opposing-color behavior is measured from actual consecutive modeled mixing displacements, not a color-wheel naming convention. The shortlist searches for two distinct chroma-reducing paint pairs, but a passing hole need only feature one opposing interaction. Therefore “two-pair palette” does not mean every accepted route uses both pairs.

Every-base eligibility remains mandatory. At least one base must support the requested style; the others may provide different good approaches. Finishing-window and setup-region thresholds are still provisional playability proxies, not a substitute for player feedback.

## Which existing palette should be benched?

**Viridian Rust is the clearest provisional bench candidate from the available human feedback.** The latest supplied export contains three rejected attempt reviews on two distinct Viridian Rust targets, with repeated comments about shortcuts, closeness, and repetitiveness. Those reviews span earlier engine versions; they are not a controlled comparison of current palettes.

Crucially, the new search still finds 7/48 ride, 2/48 tradeoff, and 6/48 opposing-color targets on Viridian Rust. That does not override the reviews. It shows why eligibility and human enjoyment must remain separate. Do not remove the palette automatically, and do not equate a high numerical yield with a strong campaign identity.

Zorny has low yield under these particular strict all-base style tests (0/48 rides, 0/48 tradeoffs, 1/48 opposing colors), but that is not a reason to delete its distinctive black-as-blue teaching role. The familiar palette should remain intact. Similarly, preserve plain CMY and Secondaries rather than silently replacing them with search winners.

## French Light, starting-paint puzzles, and paint budgets

French Light was not included in this four-paint search. Its eight paints create a different challenge: choosing an efficient subset and starting paint from a larger set of plausible alternatives. Apply a larger-palette search before comparing its route counts to these candidates. The four-paint, up-to-three-addition witness method is not an adequate ranking tool for it.

A future **best-start / best-par puzzle** can intentionally reward finding a particularly efficient starting paint. That is a different design brief from an **all-start exploration hole**, which must avoid a disappointing base choice. Keep the two briefs explicit rather than weakening the shared exploration filter invisibly.

Keep par as the main feedback system while calibrating these routes. A limited-paint mode is worth testing separately, but raw parts are not comparable across palettes: tinting behavior, base mass, and legal charge capacity affect the amount required. Any budget should be calibrated against valid modeled solutions per hole, and should not be presented as a fair difficulty score until tested. No budget or scoring changes were made here.

## Next experiment

Use the seven saved targets for a small lab round rather than adding all discovered palettes to the main menu. Label intended style and whether it applies to one, several, or all starts. Ask for one natural-start attempt and one contrasted-start replay. Record separately:

1. Was there a worthwhile route from the chosen base?
2. Did the promised interaction actually occur?
3. Did the flight feel substantial and the finish satisfying?
4. Did the second base offer a genuinely different approach, or merely the same last two paints?

This will distinguish a good eligibility filter from a good palette identity. Keep the originals available as controls; do not grow the permanent palette list until the candidates earn a place.

## Verification and artifacts

Seventeen automated checks passed. Independently replayed 450 main-search saved routes and 76 dense-check route witnesses; all endpoints met the unchanged live scoring tolerance. Existing lab signatures and old design tests still pass. Type checking and targeted lint checks pass.

- `play-focused-discovery.json`: complete training and holdout summaries, saved recipes, and route witnesses.
- `play-focused-discovery.md`: thresholds and methodology.
- `play-focused-finalists.json`: supplemental two-pair evaluation and the denser checks on the proposed holes.

The search uses the game's existing modeled spectral mixing and tinting strengths, not measured brand-specific pigment reflectance. One- and two-addition searches cover all orders on sampled grids with local refinement; three-addition routes remain recipe witnesses. Unfound routes and traits can be solver misses. Temporary palette indices must not be reused as live indices; reconstruct candidates from their saved paint definitions.
