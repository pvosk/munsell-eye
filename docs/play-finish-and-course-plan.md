# Value-led finishes and course preparation

## Implemented measurement revision

`finish-profile-1` augments the existing structural finish episode. That episode still requires a meaningful setup, a substantial lightness move toward the target, and limited cleanup. Free base selection and the first addition alone do not constitute a setup/finish sequence.

The new profile reports raw signed OKLab lightness change, lateral a/b movement, the largest earlier per-stroke lightness change, and two provisional comparisons:

- Lightness alignment: |ΔL| / sqrt(ΔL² + Δa² + Δb²) ≥ 0.8. This is a direction cosine, not a percentage of perceived difference or difficulty.
- Finish |ΔL| ≥ 0.8 × the largest earlier stroke's |ΔL|. This allows a sizeable setup but rejects finishes overshadowed by earlier lightness movement. It is not a comparison against accumulated back-and-forth setup travel.

Both tests are design hypotheses prompted by Round 9, not established perceptual laws. Raw measurements are preserved so the cutoffs can be revisited without pigment or scoring changes. A coupled or earlier shift is not a bad route; it is simply not selected as a value-led finish. Rise and drop are symmetric. Interior, ride, and balance criteria are unchanged.

Future `analyzeJourney` calls emit `journeys-2-value-led`. Current value-shift ranking and contrast selection reject old audit versions rather than silently reusing old labels. Existing banks, seeds, exact replay records, par and archive validators remain unchanged. Historical builders are snapshots: a value-shift selection rebuild needs current-version audits rather than regenerating a historical round from stale labels.

## Targeted retained-evidence recheck

No broad palette search or new hole generation was run. `report-play-finish-profiles.ts` resamples all retained efficient, timing/setup-supported routes for the five Round 9 targets from their full tracked finalist evidence, rather than only the small set of browser examples. This does not recover routes discarded by the old search's grouping, and cannot prove global absence or resistance. Detailed route profiles are in `play-finish-profile-audit.json`; the browser uses a compact generated summary. Original lab intentions are explicitly historical; updated measurements appear separately.

| Target | Value-led finish available from bases | Resistant within retained efficient routes |
| --- | --- | --- |
| Teal Ember interior | 0/4 | 0/4 |
| CMY warm ride | 1/3 | 1/3 |
| Sienna Field | 3/3 | 0/3 |
| Maroon Arc | 1/4 | 0/4 |
| CMY darker target | 0/3 | 0/3 |

The CMY dark featured finish changes L by about -0.130 after a setup change of -0.303, with a/b movement about 0.124. It remains a useful correction/balancing route, not a convincing value-led finish by this new definition. Sienna's featured lift is real, but every base has an efficient non-value-led alternative. Maroon Arc's featured ride remains valid even though its larger preceding lightness shift prevents a value-led-finish label. No simple ride is rejected merely for lacking setup.

## Locked gameplay in this pass

No changes to pigment identities, tinting strengths, paint-mixing math, charge timing/dose, mass, par, success tolerance, capture animation, targets or palette contents. Pigment strength must not be used as a game-feel tuning control. Later hold/release or landing changes require new timing/reachability checks under a new rules revision; old attempts must keep their original settings. Visual-only animation changes can be tested independently when they do not affect mixing or input.

## Proposed course structure — not implemented yet

Use one versioned hole library, consumed by two modes:

1. Campaign: fixed ordered hole IDs, selected for palette identity, contrast, pacing and a satisfying ending. Do not force every palette into the same five-style rhythm.
2. Palette bank: approved holes for that exact pigment set, replayable individually or shuffled with repetition controls. One-off discoveries can remain outside campaign without being discarded.

Keep hole identity/target/recipe separate from evaluator revision, gameplay-control revision, intended experience, measured per-base opportunities, and player reviews. Course records reference hole revisions; they do not copy mutable targets or regenerate them on load. Preserve opportunity vs resistance and simple ride vs setup ride as tags rather than inflating one difficulty number.

Existing versioned lab banks already preserve exact replays and attempts. Search reports also retain dense finalist route evidence and selected one-off exceptions. They are not yet a unified player-facing campaign/bank system. Full raw search caches are local archives; tracked finalist records are the reproducible subset.

Start planning small courses now using Teal Ember and Maroon Arc as references, then vary targets within their palettes before replacing pigments. Keep occasional simple rides and contrast values/chromas instead of banning neutrals. Finalize difficulty and par only after the later control/landing pass; revalidate each approved hole against every starting base. This pass preserves these references but does not claim new nearby targets have been tested.
