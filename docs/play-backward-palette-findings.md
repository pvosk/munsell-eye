# Backward setup-region and palette search — 12 September 2026

## Result in brief

This pass actually performs fixed-destination inverse proposal and palette comparison, followed by targeted pigment substitutions. It is not another rescoring-only exercise.

The strongest novel result is a **white / lemon / violet / blue family** that supports two distinct destinations with value-shift options. In the parent and ultramarine variant, the lavender destination has a supported value-shift route available from every base and three additions found from each base. Supported alternative styles also exist from every base: this is broad availability, not forced value-shift play.

Rides remain less reliable. CMY and Cobalt Ember examples survive deeper checks; attractive novel warm-palette rides expose token or other competing routes. All are archived, including failed neighbors and single-hole exceptions. No live game, lab bank, palette definition, pigment strength, mass, tolerance, controls, par, or sound integration changed.

## What the search did

### Fixed destinations, then inverse mixtures and predecessors

Twelve requested RGB destinations span warm light, peach, warm middle, olive, lavender, sea, cyan, orange, green, magenta, middle neutral, and dark violet. The destination is fixed before fitting each palette. It is never re-centered on a convenient recipe.

For each palette/destination pair, a bounded simplex search fits normalized ORIGINAL-pigment proportions to that color. It keeps multiple accepted fits and expands sampled connected recipe regions within a 0.92-tolerance safety margin. A missing fit means not found at this budget or margin, not proof of physical impossibility.

For each acceptable endpoint p and finishing pigment i, the planner varies the added fraction a and reconstructs the predecessor (p - a e_i)/(1-a). It searches legal prefix orders from the pure bases and converts the required absolute amounts back through the unchanged charge law. Every witness is replayed against the original requested destination.

This produces a sampled cloud of endpoint/predecessor combinations, not merely a single target recipe. Prefix construction is still bounded: at most three additions, exact recipe-order prefixes, selected finishing fractions, and first connected ray segments. It is not an exhaustive inverse-reachability solution or a proof that other setups do not exist.

### Palette search and budgets

- 32 existing catalog pigments, with their properties unchanged.
- 40,906 non-existing three/four-paint combinations enumerated by cheap pure-color geometry proxies. **These were not all fully searched.**
- Twelve novel shortlists plus six existing controls received the full inverse search against all twelve goals: 216 palette/goal pairs.
- 55 pairs produced accepted inverse proposals: 4,245 sampled endpoint recipes and 116,275 candidate routes. These are correlated samples, not independent holes.
- 35 selected palette/goal pairs received the numerical competitor/support audit. Six initially met the majority-style and every-base-support criteria.
- A stronger numerical check and reclassification left three of those six eligible.
- Six fixed neighboring destinations around two initially promising novel palettes tested local repeatability; none added an eligible hole.
- Six explicit pigment substitutions/removals around the successful novel value-shift parent were then compared with that parent on three identical fixed goals.

Main search took about 121 seconds, deeper/neighbor verification about 47 seconds, and targeted refinement about 88 seconds in the recorded runs. These are local timing observations. The shortlist includes random-like deterministic strata and existing controls, but is not an unbiased sample of palette quality. One achromatic three-paint shortlist failed meaningfully; the geometry proxy is not itself a quality claim.

## Most useful palette family

All rows below preserve the catalog properties of the named paints. Substitution means changing the available pigment, not editing its tinting strength.

| Palette | Supported value-shift opportunities on tested goals |
| --- | --- |
| Titanium White / Cadmium Lemon / Dioxazine Purple / Phthalo Blue (Green Shade) | Warm cream from 3/4 bases; lavender from 4/4 |
| Titanium White / Cadmium Lemon / Dioxazine Purple / Ultramarine Blue | Warm cream from 3/4; lavender from 4/4 |
| Titanium White / Cadmium Lemon / Dioxazine Purple / Cobalt Blue | Warm cream from 3/4; lavender from 3/4 |
| Titanium White / Hansa Yellow Light / Dioxazine Purple / Phthalo Blue (Green Shade) | Peach from 3/4; lavender from 3/4 |
| Titanium White / Cadmium Lemon / Dioxazine Purple | Warm cream from 2/3; useful single-hole triad candidate |

These fractions describe style availability among shortest-found timing-supported routes, not the fraction of bases that can finish the hole. Eligible examples also pass the every-base support check. Both rises and drops occur in the successful family; a white start does not automatically count as a value finish.

The lavender target is RGB (156,145,182). For the parent and ultramarine variant, raw and supported minima are [3,3,3,3]. No one/two-addition shortcut was found in the searches used here. That is not a global absence proof, nor does three additions automatically mean three meaningful decisions on every route. The target is about 10.4–12.6 scoring tolerances from the parent's pure paints, so it is not a near-base tap target.

The warm cream target is RGB (220,204,175). The parent has raw/supported minima [2,2,2,3], with value-shift availability from the three non-white bases. Its nearest pure paint is about 4.5 tolerances away. Unlike the lavender, this is not uniform three-addition play.

Replacing lemon with Hansa moves the qualifying warm opportunity from cream to peach. Replacing titanium with Flake White Replacement retains the cream opportunity but leaves the lavender unsupported from the white base at this search budget. Replacing violet with Perylene Maroon retains only the cream goal among the three tested. These are observed differences in complete pigment choices; do not attribute them solely to tinting strength, hue, or value without another controlled analysis.

**Recommendation:** retain the parent and ultramarine variant as leading two-hole family candidates, Hansa as a warmer alternative, and the three-paint version as a single-hole reserve. Do not add every small variation to the game. These two-goal portfolios vary destination color, but do not yet establish a varied full course.

## Rides and one-off captures

- **CMY → olive, RGB (139,144,72):** deeper search leaves ride availability from 2/3 bases, with one resistant base. A newly found two-addition route removes the earlier value-shift qualification, but the ride qualification survives.
- **Cobalt Ember → the same olive:** ride availability from 3/4 bases; only one base lacks a supported non-ride alternative. This survives the deeper check.
- **Cadmium Yellow Deep / Cadmium Red Light / Ultramarine Violet / Raw Sienna → peach:** ride available from 3/4 bases, but a supported token-pour alternative defeats the general eligibility claim. Keep it as an explicitly flagged one-off, not as a certified robust hole.
- **Hansa Yellow Light / Alizarin Crimson / Phthalo Blue (Green Shade) / Raw Umber → orange:** appealing initial ride/value routes, but the deeper check exposes token alternatives and lowers style coverage. Retained, not promoted.
- **Hansa Yellow Light / Dioxazine Purple / Ultramarine Violet / Phthalo Blue (Green Shade) → olive:** the deeper search removes the initial value-shift qualification. Its fixed neighboring goals did not produce a qualifying portfolio.

The six neighboring tests around the last two selected parent experiences did not add eligible holes: some had token alternatives or insufficient style coverage; others did not yield a seed inside the inverse safety margin. In one case the best fitted error lies within the full scoring tolerance but outside the 0.92 proposal margin. Calling all these targets unreachable would be incorrect.

## Setup-region evidence

Each selected meaningful witness retains its exact controls plus a sweep across 33 penultimate setup values and 257 final doses. For three-addition routes the earlier dose is fixed; this is a slice, not the entire global setup volume.

For the parent's cream example, the selected slice has successful finishes at 3/33 setup values, with sampled contiguous finish spans of at least 55 ms at two. The lavender example has one such sampled setup value; the exact supported witness is retained. Ultramarine's lavender slice has two successful setup values and one with a sampled 55 ms span. These counts describe individual slices and may miss narrow bands. They are not probabilities, whole-hole difficulty rankings, or proofs of disconnected regions.

The point is that the planner now returns both an intended finish and evidence about reachable setups around it. A large region is not automatically rewarded: mass-only preparation, short direct approaches, unsupported bases, and token alternatives remain visible.

## Independence and remaining uncertainty

The numerical challenger receives only palette and destination color, not a generating recipe. Final decisions combine its candidates with replayable inverse witnesses, and record independent counts separately. This avoids throwing away a known valid route merely because the challenger misses it, but does not independently reproduce every style witness.

Support and style measurements are shared. The deeper checker retains two closest-center dose variants per paint order, so it can still miss outer-acceptance-region bypasses. Initial witness retention is bounded and style-guided. No candidate here should be described as globally optimal or universally shortcut-resistant.

This is a meaningful step beyond improving filters: it generated destinations/setup relationships in novel palettes and used an actual successful result to guide pigment substitutions. It does not prove superior player enjoyment or broadly solve rides. The next useful player comparison is the two leading white/lemon/violet/blue palettes, their cream/lavender contrast, and one explicitly flagged ride—not another large undifferentiated lab.

## Archive and reproduction

- [Initial palette search, including all rejected cases](play-backward-palette-results.json)
- [Deeper finalist verification and failed neighbors](play-backward-finalists.json)
- [Paired pigment-substitution results](play-backward-palette-refinement.json)
- Runners: `scripts/search-backward-palettes.ts`, `scripts/verify-backward-finalists.ts`, `scripts/refine-backward-palette.ts` (run with `node --import tsx`).
- Cached per-palette discovery results are in ignored `outputs/backward-regions`; source-hash changes invalidate them.
- Every archive saves actual paint definitions, fixed target colors, replayable controls, search settings, limitations, and source fingerprints. Ephemeral offline palette indices are not required to reconstruct a specimen.
- 54 regression checks passed, including all retained witness replays, fixed-target preservation, predecessor reconstruction, and prior campaign/measurement regressions. Type checking passed. No player/browser validation was performed because this pass changes no UI.
