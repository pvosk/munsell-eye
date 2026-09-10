# Hole Lab v1

Enter through Hole Lab in Play, or `?mode=play&lab=1`. The game remains public; lab records require ChatGPT sign-in and are scoped server-side to that site's authenticated user ID. Use the same account on phone and desktop. Refresh/retry also fetches remote records; focus refreshes them. This is not realtime collaborative editing.

## Repeatable play

The twelve starter specimens are fixed selections (stages 0, 2, 4 with seed 190926) from CMY, Secondaries, Zorny and Violet Shift. They are not claimed to be human-curated favorites. The current regular-course hole can also be taken into the lab. Replay uses the saved seed, stage and target snapshot and starts a separate attempt with no paint. It preserves earlier attempts. Lab success does not auto-advance.

Snapshots include engine version, full hole settings, palette RGB and tinting strengths, base choice, hold seconds, absolute before/after quantities, and cancellation. Free base selections are not counted as pours. Cancelled flights are retained in the action history but excluded from route plots and pour counts. An attempt still marked `playing` may be unfinished, including a closed browser session.

Par is hidden until analysis is revealed. Looking at analysis marks the current attempt as revealed, even if reviewing another attempt. This flag is not proof that a returning player has never seen the hole; repeated attempts must be interpreted as learned play.

## Review

Top and side projections plot the same sampled paths as gameplay, without its decorative deflection. The path scrubber shows distance as a multiple of the fixed OKLab tolerance. The optional example has a wide outlined, mixture-colored path and a labeled pure-paint starting point; it omits the empty-mix launch. Step swatches show the mixture after each addition. The example is the bank's best-found witness, not a required starting paint, global minimum, or every possible alternative. Review compares attempts on the same target, and feedback can reference an individual action.

Current engine snapshots alone are replayable/importable. A future mixing-engine change must version the format or add migration/read-only compatibility; it must not silently reinterpret old shots.

## Persistence

An append-only D1 event table stores attempt snapshots and feedback events per account. A unique owner/event-ID key makes network retries idempotent. Feedback does not replace other attempts. Writes are authenticated, same-origin JSON with bounded validation; GET is authenticated, private/no-store and paginated. Failed writes remain in a transient retry queue and the UI warns not to leave before retrying or exporting. Browser storage is not the authoritative store. Export/import provides a backup; imported records are revalidated and deduplicated.

The first migration creates only the table and its two query/uniqueness indexes. It contains no player data. Anonymous game play is not recorded in the lab.

## Not in v1

No new hole search, joint setup/finish feasibility solver, automated palette quality score, or empirical par changes were added. Use this first workbench to gather repeatable evidence before expanding those systems. No audio or new intro design was added.

## Mobile corrections

Touch no longer orbits the scene. Stable small-viewport height prevents browser-toolbar scrolling from resizing the canvas repeatedly; resize also skips unchanged dimensions. A stationary short tap now pours instead of disappearing inside the 150 ms intent delay. Both long and short touch holds measure from initial contact. A drag or native scroll cancels the hold. Wide palettes use narrower, word-wrapped single-row cards on mobile.
