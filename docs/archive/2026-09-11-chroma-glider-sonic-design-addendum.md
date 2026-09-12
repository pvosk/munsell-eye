# Chroma Glider — sonic design addendum

11 September 2026. Read alongside the [complete engine, gameplay, and course handoff](2026-09-11-chroma-glider-engine-gameplay-sound-brief.md). This addendum updates the sonic priorities in that document; it does not change its engine findings or campaign snapshot.

## Status and evidence

This is a design handoff, not an implementation specification or a record of shipped gameplay audio. It incorporates the sound conversation and five supplied game screenshots, checked against the existing repository at efc2ede. The archived brief records public v63 and its reconciled application baseline; deployment was not reverified for this documentation update.

The existing application is in the munsell-eye repository. The sound lab is its separate `/sound-lab` area. Do not create another game. No game code, sound code, mixing calculations, or publication changes accompany this addendum. Lab redesign is the next discussion, not an approved interface specification here.

## Governing direction: music originates in shots

Chroma Glider should sound like a golf game with discrete, consequential shots. A release creates propulsion through space, a shaped arc, and an aftermath. Harmony and musical movement must grow from those actions. Overlapping ambient waves can connect shots, but a continuously advancing chord sequence must not impose the player's pace.

The screenshots make the contrast tangible: UltraOx Dual surrounds the player with pale, close surfaces near the destination; Chromatic Dark opens into a broad colored field and a pronounced magenta flight with ribbons. The sonic gesture needs to communicate both intimate adjustment and expansive travel. Screenshots establish visual context, not timing or audio behavior. In particular, the intro's “Arriving” label is not evidence of a successful putt.

Preserve these gameplay distinctions:

- Choosing a base places one unscored part of pure pigment. It is not a mixture with an invisible neutral paint.
- Subsequent releases add pigment to accumulated quantities. Strength and mass affect the result; a small dose is not necessarily a small color change.
- A miss normally leaves a new mixture from which the player continues. Replay or restart is a separate action, not the normal outcome of missing.
- Success is determined by the original mixture endpoint in OKLab. Passing visually near the destination, or entering its capture presentation, is not independently success.
- The global visible field is not the current palette's reachable mixture space. Decorative ribbons, cubes, camera movement, and reveal geometry are not additional pigment measurements.
- Stored solution routes demonstrate possibilities. They must not become a required musical script.

## Consistent structure, different musical worlds

Confirmed direction: everything musical may change between palettes—tuning, modes, interval relationships, instrumental character, register, density, pulse, motif vocabulary, resonator behavior, and the form of resolution. Holes can vary the harmonic setting within a palette. Conventional triads and twelve-tone tuning are not requirements.

Paints do not need to be separate instruments. Prefer exploring how each paint influences harmonic direction, voicing, register, resonance, or the notes emitted along an arc. Instrumental identity can live primarily at the palette or hole level. This is a preference, not a prohibition on differentiated paint voices.

The shared structure should remain recognizable:

1. **Rest and orientation:** a faint optional presence establishes the hole's world and sense of destination. Leave room for quiet.
2. **Hold:** gather energy or anticipation. Cancellation unwinds it without pretending a shot occurred.
3. **Release:** an immediate, legible onset communicates propulsion. Do not delay feedback until a musical beat.
4. **Travel:** a continuous sound shapes the arc; sparse arpeggiated emissions and granular traces create a wake. The gesture follows the actual shot.
5. **Miss and settle:** leave a musically inhabitable state. A near miss can bend or sweep past a possible resolution without becoming a repetitive failure sting.
6. **Capture:** complete or stabilize the gesture already in motion. Resolution belongs to the shot, rather than an unrelated success jingle.

A long chromatic ride may spread a dense collection of voices and draw them into a more coherent relationship. The structural inspiration is convergence; do not reproduce the THX theme or make every long shot sound like a win. A close putt may use soft, swirling glass chimes, a few hanging notes, and a small but meaningful change in voicing. These are starting archetypes to audition, not fixed categories or mandatory samples.

Resolution need not mean V–I, a major triad, or removing all dissonance. It could mean a suspended voice settling, beating becoming steadier, registers aligning, a motif completing, or the resonant space becoming still. Only confirmed capture should deliver the hole's full sense of completion. Proximity may suggest it repeatedly without exhausting its effect.

## Color-to-music mapping remains an open design question

Do not lock the whole gamut to a universal note grid. Equally, do not assume that every small paint adjustment should change key. The user wants to explore how location, trajectory, and ingredient choice can all matter.

A candidate system to audition—not yet an agreed mapping—combines:

- **Palette rules:** its available tuning, interval vocabulary, motifs, and allowable transitions.
- **Current color context:** the mixture's location and relationship to the target, interpreted in the palette's musical world.
- **Shot change:** the added pigment, effective contribution, direction and extent of color change, and curvature of the mixing trajectory.
- **Musical memory:** notes and tails already sounding, the current voicing, and which gestures recently occurred.

This can support recognizability without assigning one immutable chord to each color. A small corrective putt might retain most voices while introducing one hanging tone, changing an inversion, or releasing a short motif. A broad trajectory might expand the register, transform the motif, or move into a neighboring harmonic region. Those are examples to compare, not distance thresholds already selected.

Value can influence filtering, brightness, and spatial character without being merely a pitch-height control. Chroma could affect available density or spectral spread; hue could influence harmonic relationships. These are hypotheses. Near neutral colors, unstable hue should not cause rapid musical jumps. A palette may use a different interpretation altogether.

The target can be faintly represented through selected tones or resonant relationships without continuously playing the completed arrival. Keep the distinction between a destination being perceptible and a destination being achieved.

## Existing lab versus the desired game system

The current lab runs compiled SuperCollider synthesis through SuperSonic's browser audio engine, with JavaScript controlling notes and musical settings. It is not a general browser installation of the SuperCollider language, nor does it automatically include external mi-UGens.

It already provides named musical settings, modes, interval stacks, arpeggio patterns, progression choices, sound presets, chime and sustained voices, delay/reverb, resonant filtering, and buffer-based granular layers. These are useful audition tools. Its timed motif progression, manual resolution action, and abstract movement pad are not yet the shot-driven musical system described above.

Current implementation details that matter for the next lab discussion:

- The chime is a noise-excited bank of ringing resonances; the sustained voice uses layered sinusoidal tones. There is no piano source in this signal chain.
- The ribbon effect uses four moving band-pass filters per channel, with fixed frequency ratios and bandwidth. Its frequency anchor currently follows the raw foundation-frequency parameter rather than automatically following the selected musical key, chord, or active voicing.
- Forward and reverse grains read a short rolling audio buffer. They are added alongside the filtered branch; they are not currently sent through that ribbon-filter bank.
- A fixed set of sweep relationships cannot expose all the behaviors implied by “twisting ribbon.” Source articulation, routing, resonator tuning, and buffer direction need to be distinguishable during listening comparisons.
- Saving an instrument configuration is distinct from recording an audio performance or preserving an evolving musical playhead. Future preset changes should explicitly preserve the musical rules as well as the sound parameters.

Do not infer from these capabilities that game audio is already integrated. In particular, the game computes the resulting quantities at release, while visible flight continues. Audio capture cannot simply be triggered by a recipe assignment. Flight completion and confirmed success must be observed separately.

## Investigating the glass ribbon effect

“Glass Eyes” describes the desired perceptual result, not a verified production recipe. The exact recording chain has not been established here. Keep three processes separate when experimenting:

1. **Ringing:** a resonator bank responds to an excitation and sustains selected partials. [DynKlank](https://doc.sccode.org/Classes/DynKlank.html) offers independently specified frequencies, amplitudes, and decay times that can change during playback.
2. **Spectral movement:** moving resonances highlight different parts of the source, producing bending, hollowing, or shimmering impressions. The [4ms Spectral Multiband Resonator](https://4mscompany.com/smr.php) provides a useful design reference: tuned bands, scale rotation, interval spread, frequency morphing, resonance, and smoothing.
3. **Temporal reversal:** reversed buffer playback or grains can make energy swell toward an apparent attack. A swept resonator alone does not reverse audio. [GrainBuf](https://doc.sccode.org/Classes/GrainBuf.html) provides buffer position, playback rate, duration, and envelope controls for granular experiments.

A promising comparison would hold the musical phrase constant while varying those processes independently. Candidate controls include source attack and decay; dry transient level; resonator tuning tied to chord versus a separate anchor; band spacing and level; resonance or ringing time; sweep range, direction, rate, phase spread, and smoothing; forward/reverse grain balance and envelope; pitch drift; and whether grains feed the resonators or sit beside them. These controls are proposed research needs, not an instruction to add every slider immediately.

Begin with generated material; user recordings are not required. Different excitations may expose the filter differently, so failure with the current chime does not by itself rule out a useful resonator structure. Existing third-party patches can inform prototypes, but require examination of their actual code, dependencies, and license before reuse; no particular Yota patch or external UGen has been selected here.

A timestamped reference passage and the user's description of the salient moment would help identify what to test. A short audio excerpt, when available, permits waveform and time-frequency analysis. A spectrogram with readable time/frequency scales can reveal moving bands, pitch trajectories, and reversed envelopes, but cannot uniquely identify an effect chain. User A/B listening remains essential; do not claim that a visual analysis establishes perceptual similarity or that the reference has been heard when it has not.

## Constraints for later integration and collaboration

Keep all existing mixing math, pigment strengths, charge calculations, scoring, and course definitions intact. Observe game events and mixture trajectories rather than steering them to fit a composition. Bound simultaneous voices and delay/granular tails; keep a true audio reset available. Do not emit a note for every rendered frame, cloud point, or decorative ribbon segment. Separate audio scheduling from rendering, and distinguish semantic shot events from visual presentation duration, including reduced motion.

The two-chat arrangement is still being organized. Separate worktrees and one agreed publisher remain a coordination recommendation; this document does not claim either task has been moved or assign publication ownership. Coordinate shared hooks before touching game files.

The next conversation should shape the sound lab around auditioning these musical gestures and isolating the ribbon effect. It should decide which controls and repeatable shot scenarios are most useful before further implementation.
