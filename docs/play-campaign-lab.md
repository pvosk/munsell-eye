# Campaign draft 1

This is a palette-by-palette review bank, not a completed campaign or a new engine search.

The agreed twelve-chapter sequence is in `app/play-campaign-plan.ts`. There are 21 playable candidates across 34 planned slots. Missing slots are disabled and explicitly marked **Still to find**. French Light deliberately has no placeholder hole. The next-candidate action loops inside the selected palette; replay preserves the exact target. Older lab rounds remain accessible separately.

Start with UltraOx Dual: warm/cool introduction, setup into a lift, then the established blue finish. The first two candidates were screened from existing generated course targets and checked again with the current journey evaluator (256-point atlas, 48 secondary samples). Full checks are retained in `play-campaign-candidate-checks.json`. The lift slot has a supported chromatic-start lift witness, but white and blue starts also offer shorter alternatives. It is a lift opportunity, not a forced lift from every base.

The other candidates are anchors from existing lab banks and reviewed exports. Their old measurements are not silently promoted to new certificates. Each displayed featured route was replayed and verified to land at the current 0.0294 tolerance. Pigment data, hold/release mapping, movement, par and unlock rules are unchanged. Historical replays retain their own tolerances.

Each campaign slot has a separate stable attempt identity and a source ID, preserving earlier evidence without merging different test contexts. Attempts use the existing private cross-device event store and export/import validation; no database schema change is needed.

## Review workflow

Choose Campaign, choose a palette, then play its ready candidates in sequence. Replay any candidate. Notes should say whether it belongs in that position, contrasts with the previous hole, and remains worthwhile from the chosen starting paint. Missing slots are a focused search queue, not an invitation to fill the course with weaker duplicates.

Revealing route analysis now immediately shows the colored example path and its start, without a second hidden toggle. Graph bounds always include that example, including legacy holes and attempts with no shots. Switching attempts remounts the graph so a previous example selection cannot hide or misframe a different hole.

## Checks

`scripts/test-play-campaign.ts` checks the chapter order, gaps, all 21 route endpoints, event validation, snapshot isolation, unchanged paints, chapter-local next/replay, source-analysis aliases and example-path bounds. Browser checks cover selecting candidates, revealing paths, replaying, empty chapters and responsive layout.
