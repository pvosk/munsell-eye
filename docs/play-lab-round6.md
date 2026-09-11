# Directed lab round 6

This is an eight-hole experiment, not a new campaign or a claim of globally best holes. Free base selection, mixing, controls, player-par formula and live landing tolerance are unchanged. Existing saved rounds remain immutable.

## Selection

The deterministic search proposes 180 ordered routes for each of four styles across twelve palettes (8,640 proposals). It audits up to five separated matching targets per palette/style, using independent competing-route searches. Each chosen target receives a denser 256/48 search and its featured route is selected again from verified, timing-supported, per-base efficient routes.

The experience candidate ranks the measured strength of its intended route. The flexibility candidate prioritizes the proportion of bases offering the style, then resistance to competing non-style routes and closest-start bypasses. The second candidate excludes near-duplicate targets already selected. Scores are design heuristics, not player-success probabilities. Dense verification is a resolution check, not a proof of completeness or a globally optimal ranking.

All starts must have supported routes; targets must pass pure-paint separation and travel checks. This round deliberately does **not** require every target to pass the stricter style-resistance filter. A good optional experience may coexist with an enjoyable shortcut. The review discloses both availability and resistance.

| Test | Intent | Palette | Selection emphasis | Style available | Featured / fewest additions found |
| --- | --- | --- | --- | --- | --- |
| 1 | Value lift | Crimson Current | Experience | 3/4 bases | 2 / 2 |
| 2 | Value lift | Chromatic Dark | Flexibility | 3/4 | 2 / 2 |
| 3 | Chromatic ride | Cerulean Arc | Experience | 3/4 | 2 / 1 |
| 4 | Chromatic ride | Violet Estuary | Flexibility | 3/4 | 2 / 1 |
| 5 | Interior setup | RYB | Experience | 4/4 | 3 / 2 |
| 6 | Interior setup | Cobalt Ember | Flexibility | 4/4 | 3 / 2 |
| 7 | Complementary balancing | RYB | Experience | 2/4 | 3 / 2 |
| 8 | Complementary balancing | Crimson Current | Flexibility | 3/4 | 2 / 2 |

The free pure-paint deposit is excluded from additions. Three displayed route roles are independently replayed against the same target and tolerance: intended style, fewest additions found, and closest-paint start. Full search evidence remains in play-lab-round6-search.json; the shipped bank retains compact witnesses and aggregate coverage.

## Review protocol

Play naturally before revealing the analysis. Record whether the intended style actually occurred. Then inspect or replay an alternative base, especially the closest paint or a shorter solution. Report whether the shortcut is a worthwhile discovery or undermines the hole. Replay keeps the exact target, paints, tolerance and metadata, with a separate attempt. New style/shortcut feedback uses the existing authenticated private sync and backup mechanism.

Do not infer that different starting paints guarantee the same experience, that par equals an optimal route length, or that a value-lift label means adding white. A qualifying lift is measured after setup; choosing a light base alone does not count.

## Palette reveal

Entering a different palette adds a 4.6-second reveal before the existing 4.8-second target-to-start arrival. Pure paints appear first, pairwise modeled mixing curves grow between them, and a cloud of modeled mixtures unfolds with palette-seeded quaternion rotations. Decorative cloud positions converge to actual modeled positions before fading into the full reference field. The reference field is not a promise that every visible color is reachable by this palette.

This is quaternion-inspired unfolding, not a rendered quaternion Julia fractal. It never changes playable mixing paths or scoring. The reveal ends at the exact first pose of the existing arrival curve, with easing at the join. Replaying within the same palette retains only the shorter arrival; reduced-motion mode bypasses both. Structure varies deterministically with paint identity, color and strength.
