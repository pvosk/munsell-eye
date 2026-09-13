# Chroma Atlas

**Live update:** [Continuous controls, worker search and exact query caching](chroma-atlas-live.md) now extend this initial explorer. Starts, destinations and leg fractions can be edited live; the description below records the original precomputed bank and its evidence. In particular, banked-only destination selection below is superseded by the live controls.

13 September 2026. Separate research section at `/chroma-atlas`, linked from Play and Sound Lab. Existing playable lab and sound behavior are preserved.

## What is delivered

Ten banked destination/palette cases from the conditioned branching studies, including Secondaries and two different palettes queried against exactly the same fixed destination. Each case retains 33 accepted landing samples, 320 first-predecessor samples, 320 second-predecessor samples and 320 third-predecessor samples, plus twelve audited representative routes. There are 1,041 recipe nodes per displayed case, including the representative-route nodes. Different recipes are never merged merely because their RGB/OKLab coordinates coincide.

The explorer shows a translucent palette sample field, selectable destination and incremental predecessor layers. Click a point to inspect its starting recipe, pigment sequence, incoming fractions and locally tested first-addition interval. Audited examples can also be selected in the textual inspector. Only the selected chain receives colored physical mixing arcs: nine actual mixture samples per leg, not a straight RGB interpolation or thousands of decorative edges. Camera orbit/zoom is independent of the game camera.

Equal OKLab coordinate scaling is used here, so the wire sphere depicts the score tolerance in this research view. It is not the game's aesthetically stretched world projection. The inspector remains useful without WebGL. This first version selects **banked queries**, not arbitrary user-entered targets; the offline query implementation accepts other targets with a supplied accepted seed recipe.

## Reusable planner versus per-query computation

`scripts/setup-region-atlas.ts` implements the reusable recipe-state field, accepted-landing sampling, exact predecessor operation, layered inverse expansion, forward replay and local share-window checks. Installing this implementation is a one-time capability addition. Computing a previously unseen destination or different tolerance remains a query, and can require fresh work. We have not solved every state of every palette.

The inverse of `q=(1−a)p+a e_i` is `p=(q−a e_i)/(1−a)`. We only retain valid simplex predecessors and forward-check them with the real engine. Accepted landing recipes are sampled along 32 rays from the supplied successful recipe; an initial scan and bisection refine first-exit boundaries. Five fractions of the endpoint's pigment component propose predecessor edges. Consecutive same-pigment legs and negligible motion are rejected. Seeded round-robin retention by pigment limits each layer to 320 witnesses. This is useful bounded expansion, not a complete or unbiased measure of the preimage.

The palette-field cache key includes full ordered paint snapshots, strengths, a mixing-source hash and sampling configuration. A destination-query key adds target RGB, tolerance, depth and seed recipe. The source hash includes the real engine, pigment-leg implementation, installed spectral mixer and planner implementation. Query geometry is reused on a cache hit. Derived arcs and local windows are currently recomputed when exporting public data. Timing/control adapters are not baked into the recipe geometry; an incoming fraction is not a millisecond duration.

## Region evidence and limitations

Points are **sampled witnesses**, not filled verified volumes. Unknown gaps remain unknown. The first-addition interval varies that addition while holding later additions fixed; it rejects earlier target capture, scans outward from the witness and bisects the first detected boundary. Its endpoints express incoming-mixture fractions. It is not the volume of all valid setups, a globally certified connected component, a release-time window or the width of the entire branching region. A sufficiently narrow missed gap remains possible.

Layer count records inverse construction depth, not minimum necessary legs. Desired style is separate from efficient alternatives. Known audited minimum and style evidence apply to those audited start states, not to every point in their neighborhood.

The independent check (`scripts/validate-region-atlas.ts`) tested 40 points with a fresh endpoint search, including ten audited starts and one sample at each of three depths per case. There were no missed known witnesses/disagreements in this selection. **Twelve points had a solution shorter than their layer count**. Their full counterexamples remain in `chroma-atlas-1/independent-validation.json`. This is why Atlas does not label every third layer a three-leg problem.

## Performance and validation

Ten uncached region expansions took approximately 0.07–0.10 seconds each on this machine, excluding field generation, local-window export and app work. All 9,600 retained generated predecessor chains replayed with recipe errors at floating-point roundoff (maximum 3.34e−16). A repeated build reused all ten field and query caches; `benchmark-cached.json` records cache hits and original query timings, not a claim of measured fresh execution on cache hits.

Public data is lazy-loaded one case at a time (roughly 1 MB/case; about 10 MB total). No search runs in the browser. The Three.js scene renders on interaction/resize, without a continuous animation loop. It preserves camera position between point selections and limits device pixel ratio. Intermediate cache revisions remain archival artifacts; the current hash is recorded in the benchmark and exported data.

Tests cover inverse replay for three through seven paints, deterministic query results, cache invalidation, all exported path endpoints, arc/window contracts and fixed-destination equality. Type checking, focused lint, production build and HTTP publication checks are recorded in the release handoff. Visual/browser interaction QA and physical iPad testing have not been performed in this pass.

## Reproduction and extension

```sh
node --import tsx scripts/build-chroma-atlas.ts
node --import tsx scripts/validate-region-atlas.ts
node --import tsx --test scripts/test-setup-region-atlas.ts scripts/test-atlas-data.ts
```

Next useful extension is to select playable candidates from these audited states and collect feedback on branching choices. More elaborate connected-region computation should be added only where it changes selection or inspection—not to make sampled data look more complete. The previously requested larger playable lab is a separate follow-on; this release deliberately preserves the current collection.
