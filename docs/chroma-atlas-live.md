# Live Chroma Atlas

13 September 2026. Adds continuous editing to the separate `/chroma-atlas` research page. No pigment strength, charge curve, scoring tolerance, game camera, sound or playable-lab changes.

## Interaction

- Starting-mixture fraction sliders rebalance the other pigments proportionally. These edit actual recipe coordinates, not just the visible RGB point.
- Destination lightness/chroma/hue sliders edit an exact OKLab target. A display-clipped chip is marked; the target is not silently snapped to the palette or sRGB gamut.
- Each selected leg has an incoming-fraction slider. Manual leg editing disables automatic fitting so the solver cannot undo the user's chosen dose.
- “Follow fitted solution” lets background continuation and shortcut search replace the displayed route as the start/target moves. It can change pigment order. Turning it off retains a manual route; “Use best found route” adopts an alternative explicitly.
- Live replay shows whether the final endpoint lands, or whether an earlier leg endpoint would already finish. Passing through the region mid-leg is not counted as landing. Consecutive additions of the same pigment count as one abstract leg.
- Banked approaches and reset remain available. Original minimum/region evidence is shown only at its original start and target; route-specific trait/window information additionally requires the original leg sequence and fractions. A new shorter route than the audit is explicitly a counterexample.

## Responsive computation

The lightweight original-pigment mixer is shared by `app/play-engine.ts` and Atlas in `app/pigment-color.ts`. It preserves the old calculation exactly while avoiding importing course banks and game rendering into the search worker. Every live trace uses that same spectral calculation and retains full recipe history.

The view keeps one WebGL renderer and camera for its lifetime. Geometry updates are coalesced to one animation frame; no continuous idle animation loop is added. Search does not run on the page's main thread.

`live.worker.ts` accepts the latest query immediately—there is no required slider-release debounce. Small solver steps yield to the event loop; superseded jobs cancel, and request IDs prevent late results replacing a newer problem. Current manual-route colors and endpoint checks are available even if the worker fails.

`LiveSolver` first tries the current route, nearest cached routes and banked examples, adjusting their fractions in ordered coordinates. It then fits a palette recipe to the exact target and builds sampled predecessor layers from an accepted landing neighborhood. Finally it separately searches all one-, two- and three-pigment subsets using endpoint-contribution coordinates and multiple numerical seeds. Successful suggestions are forward replayed, with earlier endpoint capture truncating unnecessary later legs.

The live subset search is a bounded interactive checker, **not** the deeper offline audit. Failure to find a route is not proof of unreachability; “shortest found” is not a guaranteed minimum. Timing support, multidimensional setup robustness and style resistance are not recomputed by this live checker.

## Cache semantics

Each active study holds up to 48 exact completed start/target queries in memory, plus 32 destination-only region results. Returning to identical controls reuses the result. Nearby results are warm starts only and must be checked again. Keys include the live implementation version, bank geometry identity, full ordered paint IDs/RGB/strengths, tolerance, exact start recipe and exact destination coordinates. Controls are not rounded into coarse cache buckets.

Results are session-local: changing study or refreshing starts a new visit; no cross-device or permanent solved-map guarantee is implied. No incomplete cancelled query is cached as completed. A changed destination hides old sampled points until current region witnesses arrive. An unchanged destination can retain its valid setup layers while the start moves. Old minimum/robustness claims are not copied across edits.

The bank is still a sampled witness collection, not a continuous filled reachable volume. Live layers are smaller bounded samples (up to 120 nodes per predecessor stage) to keep interactions responsive. Cache reuse is a performance feature, not proof that unsampled gaps are solved.

## Validation

- 29 focused tests pass, including the existing Atlas/branching/long-leg suites and seven new live-model tests.
- A direct reconstruction of the pre-refactor spectral arithmetic matched exactly for 240 mixtures over 20 palettes. Every exported node in the first study also retains its color to floating-point precision.
- Live tests cover proportional rebalancing at pure starts, exact cache invalidation, early capture, same-pigment consolidation, superseded jobs, full branch replay and preservation of impossible targets.
- `scripts/test-atlas-worker.mjs` tests the **actual production worker bundle** with a Node worker adapter: query supersession, completion and an exact cached revisit. The tested job sequence completed in approximately 206 ms. This is message-protocol validation, not browser UI QA.
- `scripts/benchmark-atlas-live.ts` checks all ten studies at their original inputs, a lightness-shifted target and a changed starting fraction: all 30 found accepted routes. Maximum compute-only time was about 95 ms; a 240-frame trace benchmark averaged about 0.16 ms per trace. Scheduler yielding, browser rendering, device load and network loading are excluded, so these are not frame-rate promises.
- Results are archived in `chroma-atlas-live-checks.json`. TypeScript, focused lint and production bundling are also checked. No new broad palette search or gameplay calibration was run.

Reproduce after building:

```sh
node --import tsx --test scripts/test-atlas-live.ts
node scripts/test-atlas-worker.mjs
node --import tsx scripts/benchmark-atlas-live.ts
```
