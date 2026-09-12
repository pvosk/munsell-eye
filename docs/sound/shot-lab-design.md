# Shot-led sound lab: design proposal

Updated 12 September 2026. Discussion proposal, not implemented behavior. Extends the [sonic addendum](../archive/2026-09-11-chroma-glider-sonic-design-addendum.md). Prioritize the shot, its musical development, and arrival before composing the ambient bed.

## A harmonic destination with multiple approaches

The same target should support successful musical arrival from different regions and different incoming harmonies. Give a hole a destination sonority or a family of equivalent settled voicings. Choose the transition from the voices actually sounding: retain common tones, move other voices by small allowed intervals, and preserve characteristic suspended extensions if the palette calls for them. Success does not require one prescribed route or a dominant-to-tonic cadence.

The path influences the approach; success determines completion. Near passes can preview stability but do not trigger the complete arrival. Since the scored endpoint is known at release, a future observer can prepare a suitable transition during flight, but completion must align with confirmed landing. Use the actual game outcome; do not infer success from camera position or displayed distance. Misses settle into an open, usable state. Repeated attempts should not continually replay a crescendo or sting.

Different holes and palettes can define different homes. The same absolute target color need not imply the same chord everywhere. Multiple valid approaches to one hole should sound related without requiring an identical final recording.

## Separate the harmony from its ornament

A harmonic state is the small set of underlying voices/intervals. A motif is a recognizable ordered/rhythmic shape played with those voices. An arpeggio distributes notes through time and register. These are separate decisions: movement may transform the harmony while retaining a motif, vary the motif over stable harmony, or change both at a deliberately chosen moment.

Proposed default: a palette defines a network of related harmonic states, and the trajectory selects a smooth passage through them. Region changes are filtered with hysteresis and minimum gesture spacing, avoiding rapid retriggers when hovering near boundaries. The color domain and thresholds remain to be auditioned; do not fix a universal hue-to-chord table.

An initial mapping comparison should offer:

- Modal field: move among related sonorities sharing a tonal center.
- Fifths relationships: selected region transitions move the tonal center by fifths, with controlled voice leading. This is an optional twelve-tone strategy, not a universal mapping for the hue circle or microtonal palettes.
- Voice morphing: selected voices move while others stay suspended, with either stepped notes or continuous tuning motion.
- Motif transformation: a motif changes contour, register, spacing, or note omissions as the shot moves, with independently chosen harmonic changes.

Use palette, current mixture, target relationship, actual change caused by the paint, and musical memory as distinct inputs. Pigment identity can bias the transformation without owning a fixed instrument. Small color adjustments can meaningfully change one voice without forcing a mode change. Long trajectories need not change harmony continuously.

## Dense arpeggios can express a clear progression

All emitted arpeggio streams should derive from a shared harmonic plan. An anchor voice or sparse chord tones make the structural change legible; higher streams supply density, inversions, and octave spread. Control harmonic-change rate separately from notes per second. Many notes can express a single transition.

Avoid allowing every branch to choose its own key. At a transition, common tones may ring while conflicting tails fade, remain as an intentional suspension, or are explicitly transformed. Ordinary audio delay preserves old pitches; it does not automatically follow a newly selected chord. Distinguish generated musical echoes, which can choose updated notes, from recorded audio echoes. Long chromatic rides can use broad voice convergence without implying successful capture before it happens.

## Proposed lab surfaces

### Shot Studio — main page

A repeatable shot audition is the center. Hold/release to launch; replay the same shot with the same random seed; compare A/B configurations. Offer soft corrective putt, medium arc, and broad chromatic ride as test scenarios, plus confirmed capture versus near miss. Test controls can override the outcome for auditioning but must clearly identify that override; production uses game scoring.

Show the current phase: hold, propulsion, travel, settle, or capture. Expose a compact set of musical choices: tonal center/tuning, harmonic vocabulary, motif, harmonic-change rate, emission density, register, and arrival behavior. Keep charge amount, trajectory sampling, and animation time separate and preserve the existing mixing math. A practice route should eventually use the existing engine, not a second mixing implementation.

Persistent transport: Enable audio, Play one shot, explicit Repeat shot toggle, Stop new notes, and Reset audio. Reset clears audio buffers and scheduled events, not saved presets. Repeat is off by default. Save/export a complete setup, with separate sound-only and music-only recall options so comparing an instrument does not silently replace the musical idea.

### Color & Motion — mapping experiments

Show the current palette, paints, mixture, target, and trajectory with the corresponding note/voicing changes along it. Distinguish a synthetic color probe from physically reachable paint-mixing trajectories. A value slice or projection needs a visible third-coordinate control rather than pretending two axes represent the entire gamut.

Allow the same target to be approached from several valid starting mixtures. Compare mapping strategies with a fixed instrument and fixed randomness. Show precisely what changed: one voice, chord/tonal center, motif, register, or timbre. Display relevant mapping inputs and permit their influence to be isolated. Palette and hole configurations inherit defaults with explicit overrides, not hidden coupling.

### Instrument & Ribbon — focused effect workbench

Use repeatable notes, chords, or the same shot gesture as the input. Source choices could include a generated piano-like struck voice (clearly labeled, not presented as sampled acoustic piano), a soft synth, and glass/chime excitation. A convincing sampled piano can be considered separately with appropriate licensing.

Show the signal path and bypass/solo controls: source → resonators/filter → optional grains → delay/reverb, with explicit alternative routing for parallel grains or grains before the filter. Preserve output headroom when increasing resonance or adding bands.

Expose source attack/decay and overtone balance; resonator band tuning/spread, resonance or ring time, and level; sweep depth/direction/speed and band phase relationships; reverse/forward grain blend, grain envelope and memory; and dry/wet balance. Let resonators follow current chord tones, fixed ratios, or a manual anchor. Band-pass Q and resonator decay are different controls and should be labeled according to the selected algorithm.

Modulation should show its source, destination, amount, range, and reset rule. Sources can include shot progress, an envelope, a free-running oscillator, or bounded random drift. Distinguish shot-synchronized modulation from movement continuing during rest. The ribbon reference is one research direction, not the entire sound system.

## Explain every source of repetition

The current engine has independently running ambient generation, motif scheduling, held harmony, audio echoes, and granular playback including frozen memory. Those are different mechanisms. Display an always-visible activity strip showing which are enabled and which are producing new notes versus replaying audio. Make each independently stoppable and audible in isolation.

Current confusing coupling verified in source: changing custom foundation or intervals switches `music.source` to custom; the ribbon bank also uses the foundation frequency. The UI describes foundation as custom-editor-only despite that filter dependency. Sound presets also carry broad parameter state. The redesign must remove silent musical mode changes from effect controls, give filters an explicit tuning source, and make preset scope visible.

## Build order for the next agreed implementation

1. Shot audition and transparent transport/repetition controls.
2. Shared harmonic plan, arpeggiated wakes, and multiple approaches to arrival.
3. Focused source/ribbon workbench and repeatable comparisons.
4. Color/pigment mapping using observed game trajectories and palette/hole configuration.
5. Ambient bed and smaller details that harmonize with the established shot system.

These are proposed priorities. No new gameplay observer or lab UI is implemented by this document.
