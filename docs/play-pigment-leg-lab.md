# Ten contrasting pigment-leg puzzles

13 September 2026. Playable collection built from the [pigment-leg research bank](play-pigment-leg-findings.md), not a new search or physics revision.

Select **New · 10 contrasting pigment-leg puzzles** in the lab. All have normalized mass, fixed prepared starts, unchanged pigment strengths and tolerance `0.0294`. Par remains 3 as a constant comparison setting, not a difficulty estimate. Any hole can be selected or replayed; next cycles within this collection. Older collections and synced reviews remain intact.

## Selection

| # | Palette | Candidate experience | Featured legs / releases | Shortest legs found |
|---|---|---|---:|---:|
| 1 | Ultramarine Gold | Close start, outward setup, value drop | 2 / 3 | 2 |
| 2 | RYB | Stronger three-leg assembly | 3 / 3 | 3 |
| 3 | Ochre · Emerald · Prussian | Chromatic finishing arc | 2 / 4 | 2 |
| 4 | Umber · Violet · Blue | Wider-palette value rise | 2 / 2 | 2 |
| 5 | Rose · Mars · Green | Chromatic counterweights, without white/black tubes | 3 / 3 | 3 |
| 6 | Cobalt Ember | Competing efficient three-leg orders | 3 / 3 | 3 |
| 7 | Lemon · Violet · Earth | Value rise supplied by Radiant Lemon | 2 / 2 | 2 |
| 8 | Zorny | Previously liked interior reference | 3 / 3 | 3 |
| 9 | Manganese · Viridian · Orange | Longer route into light, known shortcut | 4 / 4 | 2 |
| 10 | Violet · Blue · Gold | Longer blue-family excursion, known shortcut | 4 / 4 | 2 |

Six came from palette-first proposals, three from route-first (#4, #6, #9), and one is a familiar reference. This is deliberately varied curation, **not a matched statistical comparison of the two methods**. The method describes how the puzzle was proposed, not a guarantee that its featured route retains the original proposal intent. Source intent and IDs remain attached to each row.

The six new lab-only palette names are working labels, not replacements for established palettes:

- **Ochre · Emerald · Prussian:** Yellow Ochre, Phthalo Emerald, Prussian Blue, Bismuth Yellow, Cadmium Red Medium.
- **Umber · Violet · Blue:** Cadmium Yellow Deep, Raw Umber, Manganese Violet, Cerulean Blue, Cobalt Blue, Radiant White.
- **Rose · Mars · Green:** Quinacridone Rose, Mars Red, Prussian Blue, Permanent Green Light.
- **Lemon · Violet · Earth:** Permanent Red, Dioxazine Purple, Viridian, Radiant Lemon, Terre Verte.
- **Manganese · Viridian · Orange:** Cadmium Yellow Medium, Manganese Blue Hue, Viridian, Titanium White, Cadmium Orange.
- **Violet · Blue · Gold:** Radiant Violet, Cerulean Blue Hue, Phthalo Blue (Green Shade), Winsor Yellow Deep, Ultramarine Violet.

These are the exact existing modeled paint snapshots from the research bank. Names such as Radiant Lemon can represent lightened paint formulations; “no white tube” is not a claim that every tube contains no white pigment.

## What to evaluate

Try your own approach first, then reveal the colored route comparison. The lab does not lock analysis away if you want it earlier. Intended labels remain visible. Consider:

1. What approach did you naturally take?
2. Where did you reconsider which pigment to add?
3. Was the finish satisfying, or merely an obvious cleanup?
4. Did an alternative route improve the puzzle or deflate it?
5. For #9–10, did the longer route offer an experience worth preserving even though it was unnecessary?

The featured examples and shortest-found alternatives are explicitly separate. Same-order, different-proportion counterexamples are retained when present, not removed by pigment-order deduplication. Current-control release count and the final-release timing window are separated from pigment-leg count and structural fraction-region support. The feature windows range from roughly 47 to 181 ms; this is not a new input or tolerance calibration.

Every featured example and retained alternative is replayed through the current normalized mechanics. We reject sequences that would trigger capture before their last listed release. New lab attempts pass the existing export/import/sync event validator; old specimen indices and definitions are preserved by appending palette identities.

## Could backward planning extend beyond the finish?

Yes, but the useful object is a **setup region**, not an arbitrary extra vertex or redundant leg.

At any recipe `p`, each available pigment already supplies an outgoing curve `F_i(p,a) = (1-a)p + a e_i`. For the accepted destination region `G` in recipe space, collect setups whose `i`-curve reaches `G` over a usable fraction interval. Then work backward through a second pigment to find starts that can enter those setups. Repeat while checking all competing shorter routes.

This can search for branches with different consequences: more than one viable setup, or one branch that trades value against hue and needs a meaningful correction. It must evaluate the whole sequence, not assume that adding a leg improves it. The relevant “vertex” is generally a region of nearby recipes with similar options; a single exact point would be brittle.

This lab does **not** implement that expanded branch-region optimizer, add checkpoints, or constrain the player to a route. It supplies contrasting evidence for that next design decision while retaining the endpoint-only game.

## Implementation and validation

- Immutable generated collection: `app/generated/play-pigment-leg-lab.json`.
- Reproduction: `node --import tsx scripts/build-pigment-leg-lab.ts`. The explicit unpublished-rebuild escape hatch is for development before release, not for mutating a published lab.
- Ten focused tests cover new and historical premix replay, navigation, graphs, leg/release counts, export validation and append-only palette identities.
- TypeScript, production build and the existing local server's HTTP response were checked. Browser interaction, touch and listening were not tested in this pass.
