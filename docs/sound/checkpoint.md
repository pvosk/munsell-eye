# Sound task checkpoint

Updated 12 September 2026.

## Ownership

- Sound worktree: `/Users/atg_la02_macstudio/.codex/worktrees/10be/Munsell Eye`, branch `codex/sound-design`.
- Game worktree: `/Users/atg_la02_macstudio/Documents/ChatGPT/Munsell Eye`, branch `main`.
- Main game chat owns integration and publication. Sound task does not deploy independently or modify the main checkout.
- Shared hooks, dependencies, navigation, and global styles require a concrete handoff. Main confirmed no concurrent navigation edits and approved sound ownership of this repair.

## Ready navigation change

Commit `062b756` changes only `app/page.tsx`:

- Use ordinary page links for Sound Lab in both navigation locations.
- Do not dismiss the mobile menu on a blur with no next focus target; this can precede touch click dispatch.
- Dismiss on outside pointer, keyboard focus moving outside, or Escape. Use explicit close rather than toggling so overlapping dismissal events cannot reopen it.
- Return focus to the trigger on Escape.

Validation: production build, TypeScript check, and targeted ESLint passed. The built home and Sound Lab routes both returned HTTP 200. Build reports optional SuperSonic MIDI/gamepad WASM URL warnings and large chunks; these did not prevent the build. Live navigation and physical touch-device behavior were not verified. The final source edit after the build removed only unused lint-suppression comments; lint and whitespace checks were rerun.

Exact commit and evidence sent to the main game chat for integration/publication review. No deployment performed by the sound task. Do not describe the public menu as fixed until the publisher confirms it.

## Design and documentation

The [sonic addendum](../archive/2026-09-11-chroma-glider-sonic-design-addendum.md) preserves the shot-centered direction from 11 September. The [shot-led lab proposal](shot-lab-design.md) records the 12 September discussion: dense arpeggios under one harmonic plan; multiple approaches to arrival; and proposed Shot Studio, Color & Motion, and Instrument & Ribbon surfaces. These are proposals, not shipped controls.

The current engine independently schedules ambient clusters and motifs and separately runs held harmony, echo, and granular playback. Custom foundation changes also switch the music source to custom, and the filter uses that frequency anchor. The proposed redesign separates these behaviors explicitly.

The supplied Glass Eyes excerpt was analyzed as a private local reference. The audio file is not copied into this repository. Analysis did not identify a definitive production chain. Ringing glass, moving resonators, and reversed halos remain candidate comparisons.

## Next work

Discuss the proposed lab organization and musical mapping before implementing the broader redesign. Prioritize the shot and its harmonic journey, then the ambient bed. Use existing pigment/mixing/flight calculations unchanged when adding real trajectory auditions. No game audio observer contract is implemented yet.
