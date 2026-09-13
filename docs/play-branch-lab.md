# Four branching setups — player review and selection

13 September 2026. New four-hole collection, leaving all previous specimens and attempts intact. Normalized premix, unchanged pigment strengths, controls, tolerance 0.0294 and constant comparison par 3.

## Recent review

Source: supplied `1-chroma-lab-5-.json`, export format with 2,190 event snapshots. Snapshots are not distinct attempts. Latest per-attempt records and reviews were joined by attempt ID; the ten-hole pigment-leg collection was isolated rather than interpreting the entire historical export as this session.

| Previous hole | Latest written feedback | Implication for selection |
|---|---|---|
| Near, then away | Not really close; clear two-leg route; revise | The description overreached. Do not treat its title as validated experience. |
| RYB three-color assembly | “good route. great route.” Keep; paint choice | Retain multi-pigment setup emphasis; include a new RYB candidate. |
| Ochre to chroma | Natural route was a ride, but similar to others | Ride availability improved, but does not solve repetition. |
| Umber into light | First move encourages lifting first | Available finishing lift is not the naturally favored order. |
| Chromatic counterweights | Fine but obvious; setup goes straight underneath | Three-leg support alone is insufficient evidence of good decisions. |
| Ember alternatives | Enjoyable, not outstanding | Useful, but not the sole template. |
| Lemon-driven lift | Easy from many places because Radiant Lemon is near target | Avoid another obvious target-like bright-paint cleanup in this small selection. |
| Zorn reference | Still really good; difficult palette | Preserve as existing reference; no need to repeat it in every new collection. |
| Long way into light | Samey; route rejected | A longer example is not enough. |
| Blue-family excursion | Keep: long first shot plus rebalancing with difficult colors | The correction after displacement matters more than length alone. |

Four hole verdicts were keep, five revise, one unset but positively described. The evidence is subjective and sparse, not training labels proving a mathematical rule. No thresholds or pigment properties were adjusted from these notes. The two reported successes, RYB and Zorn, took six and nine releases respectively; this is observed touch/performance, not a necessary-leg claim.

## Small new collection

Select **New · 4 branching setups**. All four have a shortest-found three-leg route under the archived denser checks, not a global minimum proof. Each features refined branch A, refined branch B, and additional shortest-found alternatives. The two refined branches may use the same ingredient set; a separately labeled different-set witness is retained where available.

1. **Hansa · Scarlet · Violet — Different corrections.** Hansa Yellow Light, Cerulean Blue Hue, Naphthol Scarlet, Ultramarine Violet, Warm White. Different ingredient sets are available among the measured efficient alternatives.
2. **Earth Orange · Cobalt Green — Earth and cool counterweights.** Transparent Earth Orange, Cobalt Green, Perylene Maroon, Prussian Blue. A no-white-tube balancing case; branches primarily reorder the same ingredients.
3. **Emerald · Yellow · Scarlet — Choose a different set.** Phthalo Green (Yellow Shade), Cadmium Yellow Light, Viridian, Flake White Replacement, Naphthol Scarlet. A second alternative-set case.
4. **RYB — RYB branching setup.** Existing palette, new start/target. Primarily order alternatives; compare its decision quality with the previous liked RYB hole.

This is not a lift/ride demonstration set or a claim that every choice is equally interesting. It prioritizes correction problems after a setup, in response to the review. Interior assembly is the broad candidate label, not an instruction to take a particular path. The user can freely select/replay any hole and reveal the colored comparison.

The refined A/B branches execute in 4/4, 4/3, 3/3 and 3/3 releases respectively with the existing controls; consecutive additions of the same pigment remain one leg. Their local last-release windows are approximately 56/103, 158/199, 53/101 and 70/89 ms. No timing thresholds were changed; wider windows may feel easier. The research's structural minimum and local region support remain separate from touch difficulty.

## What to note

Try your natural approach first. If useful, replay with another first pigment. Did it create a different next problem, or merely the same task in another order? Was correction after the first move interesting, or an obvious final cleanup? Extra replays are optional.

## Reproduction and safeguards

`scripts/build-branch-lab.ts` consumes the archived paired refinements, preserves exact paint snapshots and maps fractional legs to current legal holds. It rejects premature endpoint captures and unsuccessful final endpoints for every supplied route. The generated bank is immutable on rerun; palettes are appended without changing older indices. Tests cover route execution, saved-event validation, collection cycling, enabled pickers and colored route rendering. Existing ten-hole and historical premix tests remain in place.

No sound or camera changes are part of this pass. Browser/touch interaction was not tested; server rendering, unit tests, type checking and the production build provide the technical checks.
