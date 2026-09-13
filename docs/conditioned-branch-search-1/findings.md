# Target-conditioned branching: comprehensive first run

Research-only. Current lab remains v80. Pigment strengths, normalized mass, tolerance (0.0294), input controls and par are unchanged.

## Scope

87 existing paint snapshots; 1024 four/five-paint palettes; 34,472 backward proposals; 2859 palette/target requests not supported by the feasibility search; 225 shorter-route screens; 50 deep audits; 19 fixed/joint refinement results.

This is broad, stratified sampling, not exhaustive enumeration of palettes or continuous recipes. Four-paint palettes propose three distinct pigment legs; five-paint palettes propose four. n−1 is the proposed recipe depth, not a certified gameplay minimum.

## Destination requests

Four range objectives use OKLab lightness/chroma: light rise (.72–.90 / .035–.13), dark drop (.27–.44 / .025–.10), middle balancing (.46–.68 / .035–.14), and vivid ride (.50–.82 / .12–.24). These are research proposal constraints, not new classification thresholds. Three fixed RGB targets are copied exactly from the successful Hansa, Earth Orange/Cobalt Green and RYB branch lab. An unreached target is not silently replaced with a nearest palette color.

Range goals permit the destination recipe to move within the stated range in the joint arm; fixed-target arms preserve the destination. Exact RGB requests run fixed-target only. Both branches and a common start can change. The extra finish-shape objective is weak relative to endpoint/shortcut penalties and does not certify the requested style.

## Finite-search results

19 baseline audits have a shortest-found three-leg solution; 0 have a shortest-found four-leg solution. After refinement: 10 three-leg and 0 four-leg results. Repeated parents/arms are not independent discoveries or unique palettes.

19 refinement results accepted at least one optimization step. Improvements in the objective are not evidence of better player experience. No global absence-of-shortcut proof is claimed.

## Diverse replayable candidates

| Request | Paints | Shortest found legs | Shorter miss / tolerance | Style evidence |
|---|---|---:|---:|---|
| light-rise | Radiant Violet / Cadmium Yellow Medium / Chromium Oxide Green / Warm White | 3 | 2.14 | Available on efficient routes |
| dark-drop | Alizarin Crimson / Cobalt Turquoise Light / Transparent Earth Yellow / Cadmium Lemon | 3 | 1.03 | Requested style not found on efficient routes |
| mid-balance | Phthalo Blue / Cadmium Red Deep / Cadmium Yellow Deep / Indian Yellow Deep | 3 | 2.12 | Available on efficient routes |
| vivid-ride | Radiant Lemon / Yellow Ochre / Alizarin Crimson / Cobalt Teal | 3 | 2.40 | Available on efficient routes |
| fixed-hansa | Perylene Maroon / Cadmium Lemon / Titanium White / Permanent Green Light | 3 | 2.41 | Available on efficient routes |
| fixed-ryb | Hansa Yellow Deep / Manganese Blue Hue / Titanium White / Cobalt Violet | 3 | 1.34 | Available on efficient routes |

The miss margin measures the closest shorter endpoint found, divided by tolerance; >1 missed. It is not difficulty. The archive includes full starting recipes, target, legs, alternative routes, counterexamples and provenance. Current-control endpoint replay is checked, but this is not yet a new playable lab release.

## Branch and recovery measurements

Each refined pair is probed with first-leg fraction offsets ±0.06 and substitution of each other pigment at the nominal first-leg share. Search covers up to three recovery legs. Raw endpoint recovery and local-region-supported recovery are separate. Cases with easy one-leg recovery, narrower recovery and no found recovery are retained. These observations do not yet score the optimizer and are not a player-error model. Missing recovery is not proof of an irreversible state.

The branch optimizer still tracks two witness routes, not a complete reachability graph. It does not enforce intermediate checkpoints. Longer witness branches remain archived when shorter alternatives exist. Equal ingredient contributions can be reordered; separate ingredient-set counts prevent interpreting every ordering as a new decision problem.

## Validation and limits

Deep audits enumerate shorter pigment subsets using multistart simplex optimization; a different ordered-fraction solver challenges found minima on fresh seeds. Refinements use 256 samples / 12 restarts in the endpoint audit and fresh ordered checks. Local setup coverage remains sampled and capped route measurement leaves unmeasured alternatives explicit. Final trait geometry is recalculated at 192 samples; 0 requested-trait classifications changed from the ordinary sampling resolution across assessed efficient routes. All flips remain visible.

Reachability searches and pigment substitutions are finite. Targets initially estimated infeasible are “not found within this budget,” not impossible. Repeated use of one pigment counts as one leg when consecutive, regardless of releases. No pigment-strength changes, trained model or display-space shortcut were introduced.

## Reproduction / archive

Run scripts/search-conditioned-branches.ts with a fresh CONDITION_OUTPUT; defaults: seed 929831, palettes 1024, eight inverse starts per feasible target, five audits per paint-count/target group. Then run scripts/assess-conditioned-branches.ts. The manifest retains palette snapshots and target specifications. Large exact banks use verified gzip parts through scripts/research-bank-io.ts.
