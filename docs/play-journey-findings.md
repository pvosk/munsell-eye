# Palette and hole inspection: journeys-1

## What changed, and what did not

This is an offline design-engine pass. Public v55, the lab bank, free base choice, paint physics, scoring tolerance, par, and presentation are unchanged. The new evaluator is `app/play-journey-analysis.ts`; archived evaluators remain intact so earlier results stay interpretable.

There are four separate decisions, not a weighted “fun score”:

1. **General playability:** each base needs a supported meaningful route; a pure paint already inside the cup, an easy short direct approach, or an efficient token-pour bypass can reject a candidate.
2. **Competing approaches:** inspect alternative orders/doses and retain longer alternatives too. Addition count, timing support, travel, and detour are different measurements. The engine does not label a close starting color a shortcut merely because it is close.
3. **Style opportunities:** interiors retain the every-base three-meaningful-addition requirement and the two-pour exclusion margin. Rides, bidirectional value finishes, and balancing need an opportunity from at least two thirds of bases. Availability and resistance to non-style alternatives are reported separately.
4. **Course variety:** separated target colors are insufficient. Compare efficient route shapes from shared bases as well. A conservative portfolio is retained separately from an archive of qualifying individual holes.

“Supported” retains the existing 55 ms finishing-window and 4% local setup-region criteria. These are provisional usability cutoffs, not proof that another successful route is unplayable. Raw narrower successes are retained in the evidence.

## Inspection size and results

The frozen main inspection made **1,570 evaluations**: 1,216 discovery candidates, 288 fresh broad targets, 58 denser rechecks, and eight additional three-dose competitor checks. These are evaluation counts, not 1,570 unique holes. It covered eight existing controls and 24 independently constructed palettes, not local mutations of the previous favorites. The pool contains 87 modeled paints; 61 appeared in these sampled three- and four-paint palettes. No pigments or historical palettes were edited. Eight-paint/French Light course design was not part of this sample.

The main calculation took approximately 29 minutes locally. Pretty-printing its complete evidence exceeded the JavaScript string limit. All 1,570 evaluations were recovered from the content-addressed cache in about 30 seconds, with no recalculation or criterion changes; the recorded `seconds` field describes that cached recovery, not the original calculation. Output now uses compact JSON to prevent recurrence. The calculation's original source fingerprint corresponds to the frozen implementation in commit `8eee39e`; the subsequent runner change only removes pretty-printing.

The filter is not passing everything. Among the 1,216 discovery candidates, 542 triggered a short-direct shortcut, 510 a token bypass, 218 had a pure paint already in the cup, and 200 had an unsupported base. These failure counts overlap. Stronger checks removed the ride qualification from `value-span-1-fresh-22`; it remains visible as a failed style candidate rather than being silently dropped.

### Broad fresh-target yield

Each row below has **36 fresh targets**, sampled without adaptive target tuning. Counts overlap between styles and are not additive. They are provisional classifications, not user-approved experiences.

| Palette | Interior | Ride | Value shift | Balance |
|---|---:|---:|---:|---:|
| Secondaries | 0 | 0 | 5 | 3 |
| Cobalt Ember | 3 | 2 | 4 | 5 |
| Permanent Orange / Manganese Violet / Olive Green / Zinc White | 0 | 0 | 3 | 0 |
| Transparent Orange / Ultramarine Violet / Sap Green / Titanium White | 0 | 0 | 4 | 0 |
| Quinacridone Magenta / Cadmium Yellow Deep / Flake White Replacement / Phthalo Green | 2 | 1 | 2 | 3 |
| Cerulean Blue / Alizarin Crimson / Pyrrole Orange | 0 | 0 | 8 | 8 |
| Quinacridone Magenta / Ultramarine Blue / Bismuth Yellow | 0 | 3 | 11 | 11 |
| Venetian Red / Radiant Turquoise / Quinacridone Red | 0 | 2 | 3 | 7 |

The 58 selected finalists retained 19 protected interior classifications, 10 ride opportunities, 30 value-shift opportunities, and 36 balance opportunities after their applicable stronger checks. **None of those ride finalists offers the classified ride from every base.** Seventeen value-shift finalists offer a shift from every base, but none resists all sampled non-shift alternatives. Three balance finalists have every-base resistance under the current balance measurement. These are materially different claims and should remain different UI labels.

Fifty-seven finalists retain at least one qualifying style and are archived individually. The conservative final route-diversity filter retains only 1–3 of those selected candidates per palette, not complete five-hole courses. Secondaries retains three; Cobalt Ember two. The new palettes retain one or two. This does not establish the maximum possible portfolio for any palette.

### Does the directed interior generator reproduce Secondaries?

The broad sampler is not the same experiment as asking the engine to generate an interior. In particular, pair/triple/near-base proposals often do not test the four-ingredient interior region well. After seeing this mismatch, a **separately reported supplemental check** used a new seed and the existing short-route-gap proposal method. It proposed 96 full mixtures per selected four-paint palette, selected three separated gap candidates, and checked all 15 at the stronger one-/two-/three-dose setting. Neither scoring nor style thresholds changed.

| Palette | Protected interiors / 3 proposals | Conservative distinct qualifying candidates |
|---|---:|---:|
| Secondaries | 3/3 | 2 |
| Cobalt Ember | 2/3 | 2 |
| Permanent Orange / Manganese Violet / Olive Green / Zinc White | 2/3 | 1 |
| Transparent Orange / Ultramarine Violet / Sap Green / Titanium White | 2/3 | 1 |
| Quinacridone Magenta / Cadmium Yellow Deep / Flake White Replacement / Phthalo Green | 3/3 | 1 |

**Twelve of fifteen passed the protected-interior criterion.** The failure cases remain recorded. This supports a reproducible *directed proposal method* across multiple palettes, including a non-secondary color combination. It does not turn 12/15 into an unbiased random-hole success rate, and three proposals per palette are too few to rank palette quality confidently. Several passes still have similar routes.

The final column counts the conservative portfolio across all qualifying styles, not only interiors. One Cobalt candidate failed general support; one candidate in each new secondary palette failed the protected-interior classification while remaining eligible for another style. These distinctions are preserved in the data.

### Individual exceptions are retained, not lost behind the portfolio shortlist

A second supplemental check selected one highest-minimum-travel training candidate from each of nine palettes outside the frozen eight-palette fresh cohort, provided it previously had an every-base-resistant style. All nine retained a qualifying style under the stronger check. This is candidate-specific evidence, **not fresh evidence of palette repeatability**.

Notable unfamiliar combinations now preserved with exact recipes and routes:

- **Quinacridone Magenta / Cobalt Teal / Permanent Orange / King’s Blue:** protected interior; minimum supported travel across bases about 37.8 world units.
- **Transparent Orange / Cobalt Teal / Mars Orange / Flake White Replacement:** protected interior; minimum supported travel about 40.4 units.
- **Perylene Maroon / Ultramarine Blue / Raw Sienna / Winsor Yellow Deep:** every-base-resistant balance classification, without white; value-shift opportunities from three bases, but shift bypasses from all bases.
- **India Yellow / King’s Blue / Radiant Lemon / Ultramarine Violet:** protected interior despite not being a conventional secondary palette.

Zorny, RYB, CMY, Crimson Current, and the Ultramarine Blue / Radiant White / Transparent Orange / Permanent Orange combination also have retained exceptions. This is a candidate shelf for future review or shuffle use, not an instruction to replace existing palettes.

## Close starts can genuinely be indirect

The user's proposed case appeared in Zorny. Two training targets were selected **after inspection** for an additional diagnostic; they are not an independent validation cohort. Both were checked with a denser 513-point one-dose / 97×97 two-dose search and bounded three-dose multistart search across paint orders, including repeats.

| Yellow Ochre start | Target A | Target B |
|---|---:|---:|
| Starting scoring distance, in landing tolerances | 1.815 | 1.658 |
| Minimum supported travel, world units | 31.37 | 30.82 |
| Minimum supported excess over endpoint chord | 22.59 | 23.20 |
| Minimum supported maximum excursion beyond initial distance, in tolerances | 3.22 | 2.58 |
| Fewest additions found from every base | 3 | 3 |

The closer target has slightly **more excess travel**, though slightly less total travel. That distinction matters. Neither target yielded a one- or two-addition shortcut in the stronger check; all bases retained meaningful three-addition routes. The old blanket 1.8-tolerance pure-distance exclusion would reject B despite this evidence.

This supports retaining a *close-but-indirect* diagnostic. It does not establish that moving any target closer causes a harder hole, nor prove that a shortcut cannot exist. The minima in separate rows may come from different retained routes; they are not one synthesized witness. Exact recipes, all retained witnesses and check details are in `play-close-start-check.json`.

The measurements are:

- **Excess travel:** sampled world-space arc length minus the straight chord between the actual start and actual final mixture. It measures curvature/detour without dividing by a nearly zero distance.
- **Excursion:** the largest scoring-distance increase above the initial distance to the target. A path can have excess travel while getting continuously closer, so this is separate.
- **Backtracking:** accumulated positive changes in scoring distance along the path. It can distinguish one broad excursion from repeated reversals.

## Interpretation limits that remain important

### The finishing classifier is not finished

It now looks for a substantial toward-target value movement following setup, allows a small correction tail, and treats upward/downward movement symmetrically. A free white start or the first addition alone does not qualify as a setup-and-finish shift. The added dominance criterion also stops one small value change in a much longer journey from automatically defining that journey.

However, comparison with the recent reviewed player traces exposes an unresolved issue: requiring the main finish to supply 25% of the **entire attempt's travel** misses some liked finishes after a long exploratory setup. The liked RYB white-start finish supplies only about 9% of that full attempt's travel; an UltraOx trace is missed because of its subsequent correction tail. The new rule rejects the reviewed weak Orange Echo finish, but that agreement does not validate the rule generally.

Do not automatically label a player's whole experience from this classifier. A next measurement refinement should distinguish the efficient design route from the player's final approach episode and earlier exploratory travel. The criteria were frozen before this run and were not loosened to improve its output.

### Balancing is a motion trait, not a guarantee of enjoyment

The evaluator adds target-relative value/hue coupling: a colored addition can improve value while introducing a lateral hue/chroma deviation that a later movement corrects, even if absolute hue/chroma error did not initially increase. Existing opposing-color motion remains a separate way to qualify. Such motion may occur during ordinary corrections as well as excellent intentional balance routes. A larger count of balance passes is not evidence of a better game.

### Palette portfolios are conservative candidates, not finished courses

The route-similarity filter rejects a pair if even one shared base has similar retained efficient approaches. This protects against the repeated Cobalt ride experience, but may discard two holes that differ meaningfully from other bases. The greedy retained set is not the mathematically largest portfolio. Keep the individual archive and use human sequencing review before deleting a palette.

### Search evidence is bounded

Fresh targets test repeatability within a fixed sampling distribution, not independent player enjoyment. Numerical dose grids, local refinement, retained route representatives, and multistart three-dose exploration can miss shortcuts. “No shortcut found” is the appropriate claim. Catalogue RGB-derived spectral approximations and modeled tint strengths also limit conclusions about real physical pigments.

## Recommended next engine step

1. **Keep the proposal method style-specific.** The interior gap method is now supported by fresh-seed results across several palettes. Broad random sampling is useful as a control, not the sole source of good interiors. Ride and value-shift proposal methods still need their own comparable generator-level repeatability tests.
2. **Keep close-but-indirect cases as a deliberate candidate category.** Thirty-two training candidates and four broad fresh candidates had a general-passing close-indirect base, but none reached the main dense shortlist. Ranking mainly by minimum travel can still bury them. The separately retained Zorn examples prevent those findings disappearing; a future shortlist should reserve such cases rather than assume more distance means more quality.
3. **Review a small matched set, not all the nominal passes:** the two close-start Zorn targets; original Secondaries against the two new secondary combinations; one magenta/yellow/green/white interior; and the no-white maroon/blue/sienna/yellow balance exception. Keep start-specific route evidence and the actual competing shortcut beside each candidate.
4. **Refine finish-episode interpretation before selecting a “best lift” campaign.** Distinguish the final approach from earlier exploration and a correction tail; do not adjust par or tolerance to compensate for a misclassified route.

These steps preserve free starts and standard palette identities. No live changes or new lab round were published in this pass.

## Evidence files

- `play-journey-protocol.md`: frozen main protocol and provisional cutoffs.
- `play-journey-inspection.json`: every discovery/fresh recipe and decision, base summaries, and complete dense/deeper route witnesses. Its `rawEvidence` field identifies the ignored local compressed archive containing all raw training routes and a SHA-256 checksum.
- `play-journey-targeted-holdout.json`: the separately declared 15-target directed fresh check, including failures.
- `play-journey-exceptions.json`: nine separately declared single-hole checks.
- `play-close-start-check.json`: two close-start Zorn diagnostics.

The three supplementary checks add 26 evaluations to the main 1,570, for **1,596 total evaluations**. They are reported separately to avoid presenting post-hoc selection as pre-registered validation. Raw player exports and private review notes were not copied into the repository.

## Verification

- 85 offline regression tests passed, including 2,875 saved main/supplemental route witnesses replayed against their exact saved paints, plus the separate close-start replay check.
- Type checks, targeted lint, and whitespace/diff checks passed.
- The separate local sync API test could not connect under the current local access restrictions; sync code was not changed. No browser/server or deployment verification was needed for this offline-only pass.
