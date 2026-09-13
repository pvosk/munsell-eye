# Chroma planning workstream

Requested 13 September 2026. Status: **all three bounded deliverables complete and published**. Do not launch more search batches for this completed request. Overnight continuation is paused.

The user authorized three substantial deliverables and unattended continuation while asleep. The same-thread heartbeat named `chroma-planning-atlas-and-branching-research` has been paused after completion. Do not restart completed research. The user has a standing request to push validated work to both GitHub and Sites; preserve current gameplay/lab and add the explorer separately.

## Constraints

- Preserve pigment strengths, normalized premix, scoring tolerance, par, input behavior and sound work. No mass/physics redesign or enforced intermediate checkpoints.
- Use actual mixture recipes underneath the 3D appearance view. Never merge states solely because their visible colors match.
- A sampled point cloud is not a verified continuous region. Distinguish witness points, supported local neighborhoods, unknown gaps and connected components. Do not draw a filled envelope implying all interior controls work without checking.
- Keep raw minimum, region-supported minimum, timing/release execution and desired style separate. Requested style does not enter independent shortcut validation. Availability is not necessity.
- Cache recipe geometry separately from destination/tolerance queries and timing adapters. Exact target stays exact. Invalidation includes full paint snapshots and mixing implementation version, not just a palette name.
- Use local compute only; no paid compute, external model/API costs, new services, destructive Git operations or unrelated changes.
- No subagents unless the user or applicable instructions explicitly authorize them. Numerical batches may run concurrently when safe; only one owner edits/publishes the app.
- Read Sites skills before website implementation/publication. No browser interaction testing unless explicitly authorized; use unit/integration/build validation and report any untested visual interaction honestly.

## 1. Region-based branching planner

Build reusable implementation, not a fresh bespoke script for each destination. Begin from successful branch cases and conditioned-search records, then include contrasting palettes.

Required behavior:

- Represent recipe-state samples and first-/second-/third-stage predecessor witnesses with their pigment, share, destination and provenance.
- Validate inverse edges by forward replay through the real engine.
- Expand from accepted landing recipes into finish/setup layers. Refine locally near acceptance boundaries and promising region links rather than uniform full-simplex enumeration.
- Retain different ingredient sets versus different orders, region width/sensitivity and recovery evidence. Preserve failed and counterexample checks.
- Cache deterministic inputs/results and prove cache invalidation with tests. Reusing the atlas must reproduce prior query results; a new destination may require more samples rather than pretending the atlas is complete.
- Benchmark at least several contrasting palettes, including Secondaries and a fixed-destination cross-palette pair. Compare against known audited routes and shortcut examples. Use a fresh seed for independent validation.

Done when a tested query/build interface, reusable bank, benchmark and honest coverage report exist. Full continuous reachability is not the completion criterion.

## 2. Destination-centered explorer

Create a separate research entry in the existing site, not a replacement for the current play/lab.

- Main surface: 3D computed color positions, selectable destination, palette comparison and incremental finish/setup layers.
- Select a region/sample to inspect recipe, stage, pigment, share interval/evidence, and representative colored trajectory. A compact linked branch view may clarify connectivity.
- Do not render thousands of arbitrary arcs or fake region volumes. Retain recipe distinctions and show sampled/unknown status.
- Include real precomputed results, useful initial selection, responsive controls and accessible text alternatives. Keep heavy research computation offline; load a compact derived dataset in the browser.
- Test data contracts, selected-route forward replay and page/build integration. Follow the Sites workflow to publish the complete validated separate explorer. Preserve live game/lab content and sound.

Done when the user can inspect real destination/setup relationships and compare palettes, with a clear explanation of what is computed versus approximate. A diagram mockup alone is insufficient.

## 3. Four/five/six-leg mathematical investigation

First inspect the actual mixing implementation and its dependency, not merely the 3D output. The initial inspection confirms `app/paint-mixing.ts` uses spectral Color/mix with tinting strength; do not assume affine RGB or a three-dimensional latent mixture just because scoring has three coordinates.

- Derive conditional recipe-level bounds and distinguish them from color-equivalent accepted-region bounds. Read `app/play-pigment-legs.ts`, actual `mixtureColor` path and the installed spectral implementation.
- For full-support starts, the existing n−1 recipe construction is known. Investigate whether stronger color-level bounds follow; prove assumptions or label them unproven.
- Only if justified, search for four/five/six-leg requirements with five/six/seven-paint palettes. Optimize the closest shorter-subset miss, not demonstration length. Check meaningful motion and local support separately.
- Use staged cheap attacks before costly enumeration, deterministic banks/checkpoints, independent parameterizations/seeds and replayable counterexamples. Benchmark cost before escalating factorial order tests; equivalent endpoint contributions do not require every ordering for raw endpoint discovery.
- Preserve longer interesting witnesses even if shortcuts exist, but never call them necessary. Do not spend unlimited compute trying to overturn a structural bound.

Done when a mathematical report states exactly what is proven/conditional, and reproducible experiments establish either credible survivors or the tested limits across requested depths. Nonexistence in finite search is not a proof.

## Sequence and progress

1. **Complete:** inspected actual 38-band spectral model and reconstructed it numerically. Exact positive-recipe n−1 bound distinguished from accepted-color bounds; no three-leg impossibility theorem asserted.
2. **Complete:** deterministic recipe-region queries, forward replay, accepted endpoint rays, layered predecessors, local first-share intervals and cache identity. Field/query reuse demonstrated across all ten cases.
3. **Complete:** ten exported cases with 1,041 nodes each and twelve audited examples each. Forty independently searched points include twelve shorter-than-layer counterexamples; retained rather than hidden.
4. **Complete:** separate `/chroma-atlas` page, lazy-loaded data, selected colored arcs, recipe inspector and cross-palette fixed-destination comparison. No game/sound behavior changed.
5. **Implementation validation complete:** 22 focused tests, TypeScript, focused lint and production build. Public delivery still requires the exact validated source pushed to both repositories and successful Sites publication, then heartbeat pause.

Latest completed research: `58dae47` with 60,007 conditioned proposals, 96 audits, 36 refinements, 17 fresh holdout checks; see `docs/play-conditioned-branch-findings.md`. Those are already complete: reuse them rather than rerunning wholesale. Current public lab is v80.

The previously requested larger playable selection (12–16 candidates) remains a follow-on deliverable; these three projects should not erase that request or silently replace the lab. Prefer a straightforward collection from the verified bank once the core planner/explorer work is safe, without letting another broad search block it.

## Checkpoint discipline

At the end of each working segment, record changed files, tests/results, numerical session IDs if still running, reproducible commands and exact next action below. Do not claim background work is running unless a process or scheduled follow-up actually exists. Preserve existing servers. Respect rate limits/permissions; record blockers and work on independent scope where possible.

### Initial checkpoint

- Heartbeat creation confirmed active in this thread, every 30 minutes.
- No new live release or gameplay change.
- Read Sites building/hosting instructions and official scheduled-task guidance. Local runs require the computer powered on and desktop app running; usage limits and approvals may still interrupt progress.
- Added `scripts/setup-region-atlas.ts`: exact one-edge predecessor replay, explicit sampled-witness region types, deterministic full-paint/physics cache identity and separate destination/tolerance/depth query identity. Added two passing tests in `scripts/test-setup-region-atlas.ts`. These are foundations, not a completed atlas.
- No numerical process launched for these three projects yet. Next action: inspect installed spectral mixing internals, then implement layered region expansion/query and benchmark against existing branch cases. Run `npx tsc --noEmit` after further changes.

### Completed research and implementation checkpoint

- Read [Chroma Atlas](chroma-atlas.md) and [long-leg findings](play-leg-limits-findings.md) for full architecture, mathematics, coverage and reproducible commands.
- Two completed long-leg runs: 7,680 proposals, 673 subset-screened cases, 36 jointly refined finalists. Every screened case has a three-or-fewer-leg solution; every finalist has a separately reproduced, replayable shorter counterexample. Five/six/seven paints were tested. No numerical process remains running.
- Preserved all proposal bytes in lossless verified archive parts, with local raw files ignored by exact paths. No destructive history changes or source overwrites.
- `scripts/test-leg-limits-bank.ts` replays both forms of all 36 shorter witnesses and their longer demonstrations, and validates all six portable proposal archives.
- `node --import tsx --test scripts/test-setup-region-atlas.ts scripts/test-atlas-data.ts scripts/test-conditioned-branches.ts scripts/test-pigment-legs.ts scripts/test-branching-regions.ts scripts/test-branching-results.ts scripts/test-leg-limits-bank.ts`: 22 tests pass.
- `npx tsc --noEmit`, focused ESLint and `npm run build` pass. Existing sound WASM/runtime and chunk-size build warnings remain; no sound implementation changes.
- Existing user-owned localhost:3020 server preserved. Local `/chroma-atlas` HTTP 200; preview handoff queued. No visual browser or physical touch QA in this pass.
- Final action: push validated source to GitHub and Sites, package successful build, publish under existing public access, verify public Atlas/index response, show Atlas, and pause the heartbeat. Do not rerun completed searches or replace the playable lab.

### Delivery receipt

- Implementation/source `99daef66c9e04d72890544cc64415f3d87340f94` pushed successfully to GitHub and Sites.
- Sites version 81; deployment `appgdep_6aa6626cea008191a3f4adbb0238547f` succeeded on 13 September 2026.
- Public explorer: https://munsell-eye-color-training.pet-ty.chatgpt.site/chroma-atlas
- HTTP 200 verified for the explorer, index and first case. Index contains ten cases; first case contains 1,041 nodes. Browser handoff queued. Visual browser/touch QA remains unperformed.
- No research process left running; existing localhost:3020 server preserved. Heartbeat paused after completion. This receipt is documentation-only; it does not change the deployed application.
