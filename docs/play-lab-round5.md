# Round 5 · Novel palettes and style coverage

Eight immutable holes, two for each of the four proposed palettes. The candidate ingredients are unchanged from discovery; these names identify lab experiments, not replacements for historical palettes.

| Palette | Paints | Hole styles | Style coverage |
|---|---|---|---|
| Cobalt Tide | Yellow Ochre, Cadmium Orange, Cobalt Blue, Cobalt Teal | Ride / ride | 3/4, 3/4 |
| Crimson Current | Cadmium Lemon, Quinacridone Magenta, Alizarin Crimson, Cerulean Blue | Opposing colors / opposing colors | 4/4, 4/4 |
| Orange Echo | Cadmium Orange, Transparent Orange, Ultramarine Blue, Permanent Green Light | Opposing colors / opposing colors | 3/4, 3/4 |
| Violet Circuit | Cadmium Lemon, Cadmium Red Light, Dioxazine Purple, Cobalt Blue | Opposing colors / ride | 4/4, 3/4 |

## What the coverage number means

For each starting paint, ask whether the search found at least one **supported, efficient route** exhibiting the intended style. Count the paints, not the number of alternative routes. Three qualifying paints out of four gives 3/4 or 75% style coverage. This is not a player success rate, a guarantee about every possible route, or a proof about undiscovered solutions.

The every-base viability check remains separate and mandatory. All four starts must have a supported route, even when one start offers a different style.

The reusable selection policy can require a minimum style share. This round uses a 50% hard minimum, then ranks by higher style coverage, followed by the share whose widest-window retained route also has the style, then weakest-base finishing support. All selected holes reach at least 75% without lowering any shared validity check. A longer flight cannot compensate for an unsupported base or lower style share.

The second coverage number is shown in review only. It checks the supported retained route with the widest measured finishing window from each base. A hole can have high available-style coverage while its more forgiving alternatives differ. This is a useful competing-route warning, not a prediction of human choices or a globally easiest-route proof.

## Scope and checks

- Selection uses saved discovery candidates, rechecked with 257 one-pour samples and 49×49 two-pour samples per order plus local refinement. Three-pour solutions remain recipe witnesses. No search runs on the player's device.
- Two targets within each palette are separated by at least two scoring tolerances.
- Featured routes meet the displayed style and support checks. Value–color tradeoff holes with only one qualifying start were not relabeled as broadly supported balancing tests.
- Existing player-par calculation, shot controls, paint quantities, tinting strengths, landing tolerance, camera, animation, and sound are unchanged.
- Viridian Rust is removed from fresh palette and lab-test selection, and normal course cycling skips it. Its stable definition and bank records remain only to validate and replay historical attempts. No attempts or notes were deleted.
- The four new palettes are lab-only; they do not expand the normal course menu.
- Replay, suggested-base comparison, private cross-device saving, and earlier rounds remain available. All 517 supplied historical events still validate.

## What to test now

Make one natural-start attempt and one different-start replay. The main question is whether both feel worthwhile **and** whether the promised style actually describes the route you naturally took. Use the existing route verdict and notes for this distinction. No additional scoring system or campaign sequencing is needed before this evidence comes back.

The next engine refinement should follow the mismatch: improve coverage criteria if a supposedly supported start feels wrong, or improve palette-specific selection if technically valid holes feel repetitive. Keep those issues separate from par calibration.
