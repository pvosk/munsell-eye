# Chroma Glider: engine, gameplay, course design, and sonic handoff

Snapshot date: 11 September 2026. Source baseline: 2beedca736d53450f195d75ef040a6a20ffa5329. Public application baseline: v63, source 433eec7fd79a54ee09d96b3cf9f61909caa4dc54. The reconciliation commit changes history, not the application tree.

This is an archival account of the implementation at this date, not a promise that every old lab specimen satisfies the newest evaluator. Follow [the current entry point](../chroma-glider-current.md) for later revisions. The companion [machine-readable campaign snapshot](2026-09-11-chroma-glider-campaign-snapshot.json) preserves exact pigment IDs, RGB inputs, strengths, target recipes, route witnesses, stored tolerances, pars, and alternate specimen IDs. It contains configuration, not private attempt exports.

## 1. The essential distinction

Chroma Glider is an additive paint-mixture game with a flight presentation. It is not a free-steering flight simulator, a ballistic golf simulation, or a game where proximity to a visible object alone decides success.

The player selects a free initial paint, then chooses another pigment and holds/releases to determine its added quantity. The accumulated recipe determines color. The game maps that color into a three-dimensional display, animates travel along sampled mixtures, and scores the final mixture against the target in OKLab.

The most important separation for sound is:

| Layer | What it means | What must not be inferred |
|---|---|---|
| Mixture | Absolute amounts of original pigments, their modeled strengths, and the resulting color | The visual trail is not material being consumed |
| Legal action | Pigment selection and a dose produced by the hold curve | Camera direction does not aim the pour |
| Score | Final OKLab color difference within tolerance | Passing through the target on screen is not a win |
| Presentation | Camera, displayed path, capture bend, recoil, fins, gates, cube motion | Decorative displacement does not alter the recipe |
| Course analysis | Searches for routes and competing shortcuts under a stated protocol | A found route is not a proof that no shorter route exists |
| Intended style | The experience a selected hole is meant to offer | Every player, base, or successful route need not express that style |

A sound system should observe these layers separately. In particular, musical resolution should correspond to a valid arrival, not merely an attractive near pass.

## 2. The player loop and current controls

The runtime phases are intro, seed, rest, flight, and landed.

1. Reveal the palette and fly into the starting view.
2. Choose a base paint. The mixture was previously blank; the neutral starting position was not gray paint.
3. Hold a paint to charge its dose; release to commit it.
4. Fly through the changing mixture, then settle or capture.
5. If unsuccessful, choose the next addition from the accumulated mixture.
6. If successful, show the result. Normal play advances after approximately 5.2 seconds; the lab supports deliberate review and replay.

The free base is one part of paint, but does not count as a pour. Holding longer on this first choice does not create a larger base. Thus three additions means the free base plus three scored actions, not three total paint selections.

There is no evaporation, paint-removal action, fuel budget, physical wall interaction, or manual steering of a committed shot. Replaying a hole resets it; that is different from correcting a mixture in place.

### Charging and cancellation after the tablet correction

On desktop, moving a held pointer outside its paint button does not cancel the pour. Pointer capture keeps the interaction attached. Escape cancels a charge, not a released shot. Losing page focus or hiding the page also cancels charging.

Touch input has an approximately 150 ms intent period, with charge time measured from the original contact. A movement exceeding 20 pixels during that early period becomes a scroll gesture; once charging has engaged, small thumb drift does not cancel it. A quick tap still produces a small pour. The paint rail can be scrolled horizontally.

Abandoning a hole or changing specimens can still terminate its visual flight internally. That is not an undo available after release within the same attempt.

The compact lab layout and stable small-viewport-height sizing reduce browser-toolbar resizing. Rendering after a size change now occurs in the animation frame rather than clearing the canvas between frames. Responsive browser checks passed; this is not a claim of exhaustive physical iPad/Safari validation.

## 3. Mixing: what is physically modeled

The state is a vector q of nonnegative absolute pigment amounts. Its mass M is the sum of those amounts. The engine normalizes q to proportions and mixes the original pigment definitions with spectral.js on every evaluation.

Each original pigment carries a tintingStrength value. Those values remain active. Equal physical parts do not necessarily produce equal perceived movement. Phthalo and weaker earth paints are not normalized to identical mixing influence.

The library uses a spectral/Kubelka–Munk-style approximation reconstructed from RGB inputs, with its own concentration weighting. This is not a database of measured reflectance spectra for these exact paint brands, film thicknesses, substrates, and lighting conditions. It is more appropriate to describe the result as modeled subtractive paint mixing than laboratory-accurate tube behavior.

The project keeps floating-point color through evaluation; display CSS rounds only at the presentation boundary. A pure pigment retains its supplied color.

Two routes ending at exactly the same absolute ingredient proportions have the same modeled color regardless of addition order. However, the same sequence of hold times in a different order can produce different quantities because each subsequent dose depends on existing mass. Do not confuse recipe commutativity with timed-action commutativity.

Opacity metadata is not a separately simulated layered paint-film interaction here. Nor does a glowing outline indicate a pigment becoming more reflective.

### The actual hold-to-dose curve

Let t be seconds held, and let u be the triangular repeating charge phase:

- cycle = (t / 2.2) modulo 2
- u = cycle when cycle is at most 1; otherwise u = 2 − cycle
- power = 1 − (1 − u)³
- ratio = 0.005 + 7.995 × power⁴
- added amount = max(1, M)^0.8 × ratio for an existing mixture
- added amount = 1 for the free base

The meter rises for 2.2 seconds and falls for 2.2 seconds. The complete cycle is 4.4 seconds. “Power” is a dose control, not an independent force calculation.

For M at least 1, added amount divided by existing mass is ratio × M^−0.2. Accumulating paint therefore reduces the relative influence of the same charge. The paint is not spent; it makes later correction more demanding.

For a one-part mixture, the available addition spans approximately 0.005–8 parts on the rising leg. The dose is continuous rather than a fixed menu of ratios.

### What can be tuned independently

| Change | Consequence |
|---|---|
| Fin flutter, camera damping, glow, flight playback duration | Does not change endpoint reachability; may substantially change perceived difficulty |
| A timing curve with the same attainable dose range | Recipes can remain reachable, but successful hold windows and stored timings require conversion/rechecking |
| Minimum/maximum dose or mass exponent | Can change legal shortcuts, number of pours, and feasible routes |
| Landing tolerance | Changes successful endpoints, finishing windows, and shortcut classifications |
| Pigment RGB or strength | Changes mixing geometry and requires palette-specific reinspection |
| Display-space mapping | Leaves OKLab score unchanged, but invalidates world-distance-based style measurements |
| Sound mappings | Should not change any mixing, dose, or scoring calculation |

User constraint: do not rebalance pigment strength to make play feel faster or easier.

## 4. Color space, visible world, and landing

The function named rgbToLab computes OKLab, not CIELAB. Color difference is unweighted Euclidean distance in OKLab:

distance = sqrt((ΔL)² + (Δa)² + (Δb)²).

There is no separate explicit multiplier that makes value more important than hue in the scoring function. Equal-looking distances in the displayed world are nevertheless not equal scoring distances.

The historical tolerance constant is 0.028. The live tolerance is 0.0294, a 5% increase. New live attempts use the live calibration, while exact historical replay can preserve an older specimen’s calibration. Stored palette or specimen numbers should not be mistaken for the final effective tolerance without checking the replay path.

The world is a fitted Munsell-like geometry. Reference positions use hue as angle, chroma as radius scaled by 2.6, and value as height scaled by 4 around value 5. Actual mixture positions come from a polynomial fit from OKLab to that display. This fit is not distance-preserving.

The approximate Munsell notation is a nearest-reference description, not the quantity the scoring function compares.

The target outline is a symmetric visual sphere based on an average mapped radius. It is not the exact projected OKLab acceptance region. Therefore being apparently inside the outline is not sufficient evidence of a successful mixture. This remains an important clarity issue, even after returning to a more symmetric marker.

### Two different meanings of gamut

The surrounding field uses practical Munsell reference colors plus interpolated reference points. It is a global navigational color field, not exclusively colors reachable by the current palette.

The palette reveal separately samples actual palette mixtures and pairwise mixing curves. Those curves are informative about the palette, but pairwise edges are not a complete mathematical boundary of its multi-pigment gamut.

Consequently:

- A visible cube does not promise that the current palette can reach its color.
- Space between two reference cubes is not necessarily a measured paint mixture.
- A flattened decorative ribbon near high chroma is not a certified boundary trace.
- Sound should not label every visible field color as an available paint destination.

## 5. Flight, capture, and visual energy

For a normal pour, the engine samples 193 mixture states along the added dose, with a quadratic sampling distribution. The scene interpolates between samples. The central mixing trajectory comes from these mixtures; ribbon turbulence is layered around it.

The free-base launch is a special relocation: it carries the selected pure paint to its position. It does not simulate mixing that paint with neutral gray.

### Capture and misses

At release, the original endpoint is known. A successful endpoint qualifies for a visual capture bend in the final portion of flight. The scene can bend toward the target and shrink the body into it without changing the recipe or awarding a different score.

An unsuccessful shot can receive a presentation-only avoidance displacement around the target. For more distant misses, the target takes most of the visible recoil; near misses do not share that larger target recoil. These effects are not physical pigment forces.

The final score always uses the original endpoint. A shot that passes through the visible target but ends outside tolerance remains a miss. Sound should preserve that distinction without making a miss sound like an error alarm.

Flight duration is approximately:

clamp(0.5 + 0.35 × sqrt(displayed path length) + 0.018 × log(1 + final mass), 0.7, 3.2) seconds.

Reduced-motion flight uses approximately 0.4 seconds. Long shots cover more space but do not grow in duration linearly. Sound texture can convey length without stretching a note or phrase directly in proportion to distance.

Miss flights use a fast-release/ease-out progression. Successful flights use a separate smooth progression and a late capture envelope. Arrival should be one continuous sonic gesture, not a settled miss followed by a second “success” effect.

### The creature and field

The mixture has a matte, deforming body, a subtle shell/outline, and five attached tapered fins. Four main trail strands follow sampled path colors; two can flatten in higher-chroma areas. Up to four recent trails remain, fading over roughly ten seconds after settling.

Fin motion is not a direct measure of physical tinting strength. A visual charge-energy term combines strength, meter position, and relative dose. Current attached-ribbon rates are approximately 2 radians/second at idle and 2.2–7 while charging, with integrated phase to avoid jumps.

The cube field has proximity falloffs around the mixture and target, camera sightline clearing, speed-sensitive displacement, and lingering wavefronts. Trail wakes have a roughly ten-second lifetime and expand through space. These are GPU visual deformations, not thousands of individual collision events.

Radial gates occur only under conditions such as sufficient flight length, progress, cooldown, and hue-sector change or speed. A gate is an occasional accent opportunity, not a scoring checkpoint or a requirement to cross a certain hue.

### Camera and background

The ordinary camera blends target framing with travel direction, uses shortest-angle rotation, stabilizes direction near vertical travel, and damps position and look direction. Longer shots add room and lateral offset; close framing backs away.

The background blends from approximately #202b2e to #b5b9b3 with height. During the intro, camera height contributes; afterward mixture height drives it. This is a visual contrast strategy, not evidence of a separate light source or an audio pitch.

Use actual color and motion state for sonic mapping. Do not use camera speed, changing field of view, or target recoil as substitutes for the mixture’s color progress.

## 6. Palette reveal and opening phrase

The first palette reveal lasts about 7.2 seconds within an approximately 11.2-second intro. Later hole intros are about 4.8 seconds. Reduced-motion behavior is different and needs its own audio timing.

The reveal uses:

- the palette’s pure paints;
- 49 samples for each pairwise mixing connection;
- roughly 800 sampled multi-paint compositions;
- deterministic palette-dependent unfolding parameters;
- staggered growth from one or two roots through the connection graph.

The quaternion reference informs its unfolding appearance. It is not a quaternion Julia set, and the decorative unfold is not a legal gameplay mixing path.

The camera is designed as a continuous wide-to-playing-view movement, with target framing along the way, rather than a destination stop followed by a second cut. This is still a tuning surface, not a guarantee that every close-target composition feels equally good.

For sound, the intro naturally supports a sparse palette “voicing” whose voices propagate into relationships, then join the playable atmosphere. Do not play one note for every sample or every edge. An eight-paint reveal has 28 pairwise connections; a three-paint reveal has three. Unbounded sonification would make the wider palette disproportionately noisy.

The intro has no actual mixture value until the base is selected. If sound brightness follows value during the intro, use a separate declared presentation signal, then smoothly hand over to mixture value. Do not invent a gray pigment state.

## 7. How holes are actually selected

The live browser primarily loads stored course and lab specimens. It does not run the full deep search while the player waits. Seeded selection from a bank is not equivalent to synthesizing and proving a fresh hole on every request.

Several generations of analysis coexist:

| Component | Role and limitation |
|---|---|
| courses-3 / play-course-analysis | Older general course analysis and stored bank; still relevant to live records |
| play-route-analysis | Historical style heuristics; labels are not automatically current certificates |
| play-route-design | Route measurements and adjacent split-pour consolidation |
| play-route-audit | Keeps dose variants and examines competing approaches |
| play-experience-audit | Broader experiential checks including bidirectional value movement |
| play-journey-analysis | Current journeys-2-value-led qualification and base-by-base competition |
| play-finish-profile | Current finish-profile-1 value-led finish measurements |

Changing the newest classifier does not retroactively relabel every archived attempt or campaign anchor. The current campaign deliberately includes older player-reviewed holes and newer candidates.

### Search coverage, not mathematical omniscience

The route search examines every base, ordered pigment additions, dose grids, and numerical refinements. A commonly used atlas samples 129 single-addition times and 25 × 25 two-addition combinations for each relevant order, then refines candidates. Denser checks and additional three-addition searches are used on finalists.

Three-addition exploration includes recipe witnesses and bounded numerical starts. It is not an exhaustive proof over all continuous dose combinations. Very narrow feasible routes can be missed. A two-addition near miss at 1.09 tolerances is therefore important evidence against calling a hole strongly protected when the desired safety margin is 1.10.

A suggested route is a found witness under a search/version, not a guaranteed globally optimal answer. It should not become an authoritative musical “correct route.”

### Free-base protection

For each starting paint, distinguish:

- Supported: at least one route passes the relevant feasibility/playability checks.
- Efficient: fewest additions found from that particular base.
- Style available: an efficient supported route expresses the requested style.
- Style bypass: an efficient supported route avoids that style.
- Style resistant: style available without such an efficient bypass found.

A hole can have good routes from all bases but only offer a ride from two of three. It can also offer a style from every base while allowing a non-style solution from every base. These are materially different outcomes.

General protection rejects such problems as an already-in-tolerance pure base, an unsupported base, a short direct supported shortcut, or an efficient token-action bypass. Style-specific tests follow that base filter. The latest broad style eligibility asks for style availability from at least two thirds of bases; stronger all-base resistance is separately reported.

This supports free starting choice without pretending every base must feel identical.

## 8. The route styles: geometry versus experience

### Interior / multi-pour setup

The strongest current interior test targets exactly three meaningful additions, with no successful one- or two-addition solution found and a margin on the best two-addition miss. Every base must retain that multi-pour structure under the current test.

“Interior” here is more than a neutral target. The interest is making a setup that enables a finish and maintaining viable choices from different bases.

Two adjacent additions of the same pigment are merged when their combined dose is legal from the earlier state. Otherwise a single decision could masquerade as multiple meaningful pours. If the combined dose exceeds the legal range, repeated additions can be genuinely required by capacity. Nonadjacent repeats are not automatically redundant.

A meaningful-pour check also examines travel and whether omitting it makes the replayed route miss. This is a local test, not proof that the pigment is globally necessary.

### Value shift, upward or downward

A value-led episode must occur after setup, not merely as free base selection or the first unprepared addition. It must make substantial value movement and improve the approach to the target, with sufficient setup and finish travel. A little cleanup afterward can be allowed.

Current checks include absolute OKLab lightness change above 0.10, setup travel of at least 6 display units, episode length of at least 9, and a value-direction alignment of at least 0.8. Other relative-size and endpoint-improvement checks apply.

A drop counts as well as a lift. Starting with white is not forbidden. But a white start cannot automatically certify the value-led finishing experience that a darker start creates.

This is distinct from hue/value tradeoff. The intended sensation is “set up the mixture, then make a substantial value-directed move.”

### Chromatic ride

The current ride test looks for a long single addition—at least 36 display units—with at least 80% of that addition’s travel above OKLab chroma 0.06, and substantial chromatic travel across the route as a whole.

It does not require an exact gamut boundary. A visually beautiful curved flight can fail the formal ride threshold, and a formal ride can still be dull to play.

Free-base choice is the main structural difficulty. A long arc from one paint may be bypassed from a paint already near the destination. Selecting targets far from all bases helps but does not alone guarantee a long, interesting, efficient route.

A setup-then-ride is a valuable proposal family, not a solved universal template. Do not imply all rides are one-pour holes or that every base must use the same setup.

### Complementary / coupled balance

This is a mechanism of adjustment, not simply an interior location.

One form has appreciably opposing movements in the OKLab a/b plane. Another has a colored addition improving value while pulling hue/chroma away, followed by an addition that recovers that lateral error.

The second form captures the player’s early enjoyment of Secondaries: the adjustment needed in one dimension is tied to an unwanted movement in another. “Coupled balance” is the clearer description when literal pigment complements are not the point.

Interior and balance can overlap. Interior describes protected multi-pour structure; balance describes the tradeoff within a route. Treating them as mutually exclusive would lose useful information.

### Close-start detour

A close pure paint is not automatically a shortcut. It may require moving away before returning because no useful pigment points directly toward the target.

The current measurements distinguish initial distance, total path length, excess over the straight chord, maximum outward excursion in scoring error, and accumulated backtracking. This allows an occasional close-start puzzle without rewarding trivial taps.

It is a secondary candidate category. The design preference remains robust holes with meaningful travel, not a campaign dominated by near-target traps.

## 9. Precision, finishing windows, and par

Precision does not come only from par.

A hole can admit many setups or only a narrow setup region. At a valid setup, it can admit a wide or narrow finishing-dose interval. These are different dimensions of difficulty.

The local setup-region measurement perturbs prior hold times within about ±0.18 seconds, uses a small grid, and searches the finishing doses again at each setup. A 4% supported region means 4% of this sampled local timing neighborhood—not 4% of the color gamut or a measured player success probability.

The 55 ms finishing-window support threshold refers to a successful timing interval under a particular calibration. Historical route records also contain a different “window” measurement based on one-sided timing perturbations. They must not be compared as if they were the same statistic.

Current player par is a heuristic, clamped to 2–6, derived from found addition count, timing-window penalties, and palette challenge. It is not the proven minimum, an empirical percentile of player performance, or an enforced action budget.

Some campaign records retain precomputed pars. No new par policy was applied in this documentation pass.

A strict par can make choosing a good base puzzle-like, but the current campaign lab does not implement unlock gates, limited paint supply, or chained destinations. Those remain design options, not present mechanics.

## 10. What the searches have established

Read the linked reports for exact protocols and denominators. The following are historical results, not a fresh rerun on this date.

The journey inspection covered 1,570 main evaluations, with supplementary directed and exception checks bringing that reported set to 1,596. It involved control palettes, independently sampled palettes, and targeted proposal families. Its approximately 58 main finalists included interior, ride, value-shift, and balance labels under that report’s version; those counts are not automatically certifications under later value-led rules.

A targeted interior holdout found protected interior candidates in several palettes beyond Secondaries. That is evidence the structure is reproducible. It is not an unbiased estimate that most arbitrary palettes will work.

The dedicated ride report found direct-ride proposals more productive than a broad recipe proposal in its equal-size screens: 20/90 versus 4/90, and 9/45 versus 4/45 in the fresh-seed comparison. Setup-to-ride proposals did not show the same clear advantage. No every-base-resistant ride was established in that reported set.

These findings support three conclusions:

1. Proposal design matters; the engine need not wait for rare structures to appear by random recipe sampling.
2. Secondaries-like multi-pour strength is not exclusive to one named palette.
3. Long rides remain more vulnerable to starting-base bypasses than robust interior play.

Palette quality should be judged as a portfolio: several distinct destinations and route experiences, not the single highest-ranked witness. The portfolio filter uses target separation and route-shape separation, but its greedy retained count is not the mathematical maximum course capacity.

The archive should retain excellent one-off holes even when their palette cannot support a long chapter. A campaign and a shuffle bank need not have identical admission rules.

## 11. Current palette identities and course sequence

The following are the actual campaign paint definitions, not proposed substitutions. Numbers after names are the game’s modeled tinting strengths, not measured physical tube-to-tube ratios.

| Palette | Paints · modeled strength |
|---|---|
| UltraOx Dual | Transparent Oxide Red · 0.82; Ultramarine Blue · 0.92; Titanium White · 1.2 |
| Zorny | Yellow Ochre · 0.62; Cadmium Red Light · 0.86; Ivory Black · 1.08; Titanium White · 1.2 |
| Maroon Drift | Perylene Maroon · 1.12; Ultramarine Blue · 0.92; Raw Sienna · 0.58; Winsor Yellow Deep · 0.94 |
| RYB | Flake White · 0.65; Cadmium Lemon · 0.76; Cadmium Red Medium · 0.88; Phthalo Blue (Green Shade) · 1.4 |
| Orange Echo | Cadmium Orange · 0.82; Transparent Orange · 1.02; Ultramarine Blue · 0.92; Permanent Green Light · 0.94 |
| CMY | Phthalo Blue (Green Shade) · 1.4; Quinacridone Magenta · 1.12; Hansa Yellow Light · 0.92 |
| Secondaries | Cadmium Orange · 0.82; Dioxazine Purple · 1.25; Phthalo Green (Yellow Shade) · 1.34; Titanium White · 1.2 |
| Sienna Field | Burnt Sienna · 0.68; Nickel Titanate Yellow · 0.58; Cobalt Green · 0.58 |
| Maroon Arc | Perylene Maroon · 1.12; Hansa Yellow Light · 0.92; Raw Sienna · 0.58; Cobalt Blue · 0.65 |
| Teal Ember | Quinacridone Magenta · 1.12; Cobalt Teal · 0.62; Permanent Orange · 1; King’s Blue · 0.58 |
| French Light | Flake White · 0.65; Cadmium Yellow Light · 0.78; Yellow Ochre · 0.62; Cadmium Red Light · 0.86; Alizarin Crimson · 1.04; Cobalt Blue · 0.65; Ultramarine Blue · 0.92; Viridian · 0.78 |
| Cobalt Ember | Cobalt Blue · 0.65; Cadmium Orange · 0.82; Quinacridone Magenta · 1.12; Flake White · 0.65 |

### Sequence and current stored player pars

Numbers in parentheses are stored pars, not counts of mandatory decisions or guarantees of difficulty. This is the current lab campaign draft: 12 chapters, 34 primary slots, and 14 alternatives. The companion JSON records exact specimens.

| Chapter | Current primary sequence (par) |
|---|---|
| 1. UltraOx Dual | Warm / cool introduction (4) → Setup into a lift (3) → Blue finish (5) |
| 2. Zorny | Warm nuance (5) → Cool direction using black (3) → Setup and value (4) → Demanding cool finish (5) |
| 3. Maroon Drift | Gentle mixing (5) → Simple chromatic contrast (3) |
| 4. RYB | Chromatic approach (4) → Cool-color contrast (3) → Darker mixture (4) → Broad mixing finish (6) |
| 5. Orange Echo | Warm mixing (5) → Dark contrast (4) → Best balancing finish (5) |
| 6. CMY | Chromatic ride (3) → Contrasting precise ride (3) |
| 7. Secondaries | Multi-approach setup (4) → Green setup (4) → Coupled balance (6) → Demanding multi-pour finish (5) |
| 8. Sienna Field | Restricted mixing (5) → Precise contrasting finish (4) |
| 9. Maroon Arc | Expansive green ride (4) → Warm or dark counterpart (5) → Precise ending (4) |
| 10. Teal Ember | Off-center introduction (4) → Inward setup (6) |
| 11. French Light | Broad-choice studio puzzle (4) |
| 12. Cobalt Ember | Readable introduction (3) → Accurate ride (4) → Rose-gray setup (5) → Demanding interior finale (6) |

### What each chapter is for—and what remains uncertain

- **UltraOx Dual:** restrained warm/cool mixing with white as a separate value lever. A lift is possible, but the selected lift opportunity does not force the same experience from a white base. Latest written feedback supports keeping the opener and seeking another lift candidate.
- **Zorny:** limited chromatic reach, warm nuance, relative cooling through black, and value control. It should be second. “Cool” means cooling within this palette, not saturated blue. The demanding finish includes a narrow shortcut-margin caveat.
- **Maroon Drift:** a no-white/no-black warm-dark quartet intended to offer satisfying simple mixing. Recent feedback finds one hole substantially more complex than the other; internal order and chapter placement remain review questions.
- **RYB:** broad chromatic and value navigation. Useful as a fuller mixing chapter, not a guarantee that each hue family receives equal coverage.
- **Orange Echo:** unequal orange paints, blue, and green create coupled adjustments. The balance finish is more distinctive than simply collecting warm destinations. One dark contrast is intentionally easier.
- **CMY:** compact, high-chroma, no-white identity. Good for precision and rides, but the current ride candidates do not equally protect all three bases. This should be visible in developer reporting, not hidden by the label.
- **Secondaries:** the strongest recurring player reference for coupled value/hue tradeoffs and multi-pour interiors. Keep it demanding, but avoid repeatedly selecting nearly identical neutral targets.
- **Sienna Field:** a quieter restricted gamut without white or black. The two primary destinations are relatively close in their quiet-green character; the chapter is a useful contrast, but its variety is limited.
- **Maroon Arc:** wider chromatic movement plus dark/interior contrast. Its green ride has been positively experienced, without implying identical cost from every base.
- **Teal Ember:** two off-center/interior experiences rather than a full course. Distinct starting-paint tendencies deserve continued testing.
- **French Light:** eight available paints create ingredient-choice complexity and more direct alternatives. The current primary has supported routes from all eight bases, with differing found addition counts. One hole is not a comprehensive test of what this palette can offer.
- **Cobalt Ember:** a mix of accessible chromatic opportunities and more demanding interiors. It is a strong reference for multi-base setup, but “cobalt” is not a general route-style category.

Reserves are not failures. Crimson Current, Teal Earth, Sienna Field, Maroon Arc, Orange Echo, and other experiments received different kinds of interest across reviews. Preserve their exact IDs and notes rather than merging similar names or treating a short portfolio as a reason to discard a strong one-off.

Course identity should arise from a biased variety of experiences, not the same five-hole rhythm under different colors. Restricted gamut also need not mean earth colors: restriction can be in hue, chroma, value, or available directions of correction.

## 12. Lab, replay, and archival integrity

The game lab stores attempts, actions, and reviews as events. Signed-in records sync through the app’s D1-backed endpoint, scoped to the authenticated owner. Export/import is a portable backup and analysis interchange.

Unsaved events are queued in memory. A failed save is not equivalent to durable offline storage. If the interface says “Not saved,” retry or export before leaving. Already synced events persist across holes and devices when signed in.

The standalone sound lab has a different persistence model: its presets use device-local browser storage and export/import. Do not promise cross-device sound-preset sync merely because game attempts sync.

Stable specimen IDs and historical calibrations matter. A review should be traceable to palette fingerprint, target, free base, ordered additions, dose/timing calibration, scoring tolerance, and analysis version. The current campaign reordering preserves specimen IDs rather than rewriting existing reviews.

Intended labels should remain visible in the lab as requested, but selection tests should not assume a label is true. For future audio experiments, store the sound preset/version separately from the hole so sonic changes are not mistaken for route changes.

Do not commit raw private lab exports or authentication data to the public repository. This brief summarizes relevant design feedback without reproducing the event log.

## 13. Existing sound implementation: available now, separate from the game

The /sound-lab route is already present. It is an audition instrument, not yet gameplay sound.

Its engine runs SuperCollider scsynth compiled to WebAssembly in an AudioWorklet through SuperSonic 0.80.0. Fixed SynthDefs are supplied by the project. This is not a general sclang interpreter, and it does not make every desktop SuperCollider extension available.

The current instrument includes:

- noise-excited resonant chimes;
- six breathing sustained voices;
- moving resonant filtering and stereo delay;
- a short internal audio-memory buffer with forward/reverse granular playback;
- room processing, DC filtering, and limiting;
- a voice cap of 24;
- four sound presets: Submerged Glass, Ribbon Memory, Open Water, and Chromatic Bloom;
- modal, interval-stack, arpeggio, progression, and custom-cent controls, including non-12-tone options;
- manual Explore and Resolve behavior;
- recording of generated stereo output, not the microphone.

The manual Resolve action creates a particular six-note gesture and resolved state. It is a prototype sonic operation, not the game’s scoring signal. The pad’s x/y-to-note mapping is similarly an audition control, not an established hue/value mapping.

Audio starts through an explicit user gesture. Stop, Escape, tab hiding, or leaving the route stops it. Reset Audio rebuilds the audio system; resetting controls is a different action.

This is a capable synthesis starting point. Combined game-plus-audio performance, mobile browser behavior, and the eventual event mapping still need testing. Existing stereo panning should not be described as full three-dimensional acoustic simulation.

## 14. Proposed sonic architecture—not implemented by this brief

The user’s direction is atmospheric, underwater, wind-chime-like, potentially granular, with palette-specific tuning or modes and a satisfying sense of harmonic arrival. Sound should help the world feel coherent without turning into a constant correctness meter.

### Four coordinated layers

| Layer | Driver | Suggested role |
|---|---|---|
| Palette identity | Stable pigment configuration and chosen sound preset | Tuning, resonator family, register, harmonic vocabulary |
| World atmosphere | Slowly varying color/value state and sparse activity | Breath, filtering, width, low-density harmonic field |
| Action gesture | Charge, release, dose influence, color motion, settling | Gather → pop/flow → decelerate or capture |
| Arrival | Confirmed successful flight/capture | A clear resolution that belongs to the same gesture |

These are design proposals. The code does not establish a canonical hue-to-pitch law, historical palette mode, or universal consonance scale.

### A narrow observer interface

Add observation hooks to the existing game rather than duplicating its simulation in the sound lab.

A useful contract would provide:

- Stable palette fingerprint, hole ID, attempt ID, and effective calibration.
- Intro start/progress/end, plus reduced-motion status.
- Base selected, charge started/updated/cancelled, and shot committed.
- Actual source and target color, accumulated mass, added amount, pigment strength, and expected endpoint error.
- True mixture-path progress separately from displayed capture/avoidance progress.
- Displayed speed, optional color-space speed, capture amount, gate events, and settled miss.
- Confirmed landing, hole exit/replay, visibility loss, and mute/stop.

At present, the scene interface mainly exposes target position, intro completion, and error callbacks alongside its control methods. The full proposed observation contract is not already available.

The game commits the recipe at release before the visual flight finishes. Audio must not infer “arrived” from a React state update alone. Similarly, the target’s recoil position is presentation; its color remains the harmonic destination.

### Mapping recommendations

**Value:** map continuously to some combination of spectral brightness, register, or openness, but audition these independently. Avoid making every pale mixture simply louder or every dark mixture inaudible.

**Hue and chroma:** hue is cyclic, and near-neutral hue is unstable. Interpolate around the wrap correctly and reduce hue-driven changes as chroma falls. Chroma can affect overtone clarity, modulation depth, or width without requiring more notes.

**Mass:** accumulated mass can darken or thicken the body of the sound, lengthen resonance, or affect attack resistance. It should not increase loudness without bound.

**Pigment strength and charge:** use their combined influence for excitation and fin-like modulation. This communicates why a small dose can be potent without altering the actual strength model.

**Travel:** use a continuous gesture with sparse accents. Color-space speed and displayed speed are different signals; choose intentionally. Do not let camera orbiting create false rushing sounds.

**Gates and ripples:** occasional chime or granular accents can echo the visual gates and ten-second wake. Do not allocate a voice per cube or per trail vertex. Lingering audio should have bounded tails and clear cleanup on replay.

**Target proximity:** a broad sense of convergence can be atmospheric. An exact pitch-lock or “hot/cold” signal could reveal more information than the visual game and become an aiming aid. Decide explicitly whether that assistance is wanted.

**Success:** soften or revoice the current tension into a cadence during capture; reserve the definite completion cue for the actual arrival. Avoid a second unrelated success jingle.

**Miss:** settle into an unresolved but playable state. A miss is the next mixture, not discarded work. Its sound should remain part of the phrase.

**Cancel:** unwind the charge without a launch or failure cue. Released shots are not cancellable by Escape, so audio must not imply they are.

**Replay and hole switch:** stop or crossfade bounded ambience deliberately. Do not let previous target harmony remain as an accidental memory unless that is an intentional mode.

### Styles should affect structure, not dictate a fake performance

A value-shift hole can suggest an arrangement with register headroom; an interior can support a longer evolving phrase; a ride can sustain a continuous melodic or timbral sweep; coupled balance can make contrary movements audible.

But the player can take a different route. The sound must follow the performed additions, not play the intended witness regardless of action.

The best organizing rule is: palette determines the instrument and harmonic vocabulary; the actual route determines the phrase; the target and confirmed arrival determine resolution.

## 15. Timing, performance, and tests for integration

Audio scheduling should use the audio clock with modest lookahead, not one note per animation frame. Continuous parameters need smoothing and rate limits. Device frame drops should not change pitch steps or create bursts of overdue notes.

Keep deterministic seeds for comparable auditions. Optional variation can be keyed to an attempt, but repeat testing needs a way to hold that variation fixed.

Test at least:

1. Free-base selection versus a real mixed pour.
2. A weak pigment and a strong pigment at comparable charges.
3. Long ride, short correction, value rise, and value drop.
4. Coupled balance through a low-chroma region.
5. An overshoot that passes the visible target but is not successful.
6. A qualifying endpoint captured visually before its exact displayed endpoint.
7. Charge cancellation, tab hiding, replay, and switching holes during flight.
8. Reduced motion, muted audio, and small-screen input.
9. Eight-paint reveal and dense field plus synthesis on an actual mobile device.
10. The same hole from multiple bases, including the most obvious shortcut.

Evaluation should ask separately: does it sound beautiful, does it describe the action, does it clarify arrival, does it bias starting choice, and does it become tiring after several holes? One overall “good” rating hides those distinctions.

No new audio hooks, synthesis changes, scoring changes, or course changes were implemented by this debrief.

## 16. Two-chat collaboration and maintenance

Two chats are workable. Two chats writing the same checkout at the same time are not isolated. They can overwrite shared files, include each other’s incomplete changes in a commit, compete over a local server, or publish an unintended combined state.

Recommended working arrangement:

- Keep this game/design task responsible for mixture physics, route analysis, campaign data, and game UI.
- Keep the sound task focused on sound-lab code and sound design until an integration contract is agreed.
- Use separate Git worktrees for concurrent implementation.
- Coordinate edits to shared navigation, dependencies, global styles, and gameplay event hooks.
- Use one designated publisher after integrating and checking the combined change.
- Do not stop the other task’s server merely because it is on the familiar local port.

Official Codex guidance describes worktrees as independent working directories for parallel tasks sharing a repository. Phone remote control still operates the connected computer; it does not move the worktree onto the phone. See [Codex worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees).

The GitHub reconciliation on this date preserved both the sound lab and the newer game/UI work. No task was moved to a worktree and no sound work was restarted as part of this debrief.

For future updates, revise the current entry point and add a dated archive when behavior materially changes. Preserve the old snapshot. Record separately the application commit, analysis policy, live publication, and what was actually tested.

## 17. Source map and evidence status

Primary implementation:

- [Mixing, dose curve, score, and stored-hole loading](../../app/play-engine.ts)
- [Game state, input, results, and lab integration](../../app/play.tsx)
- [Scene, flight, fins, trails, gates, and rendering](../../app/play-scene.ts)
- [Camera and target-path presentation](../../app/play-motion.ts)
- [Palette reveal](../../app/play-palette-reveal.ts)
- [Campaign assembly and presentation order](../../app/play-campaign.ts)
- [Current journey measurements](../../app/play-journey-analysis.ts)
- [Finish profile](../../app/play-finish-profile.ts)
- [Earlier course search and player-par heuristic](../../app/play-course-analysis.ts)
- [Route variants and competing-route audit](../../app/play-route-audit.ts)
- [Lab synchronization](../../app/play-lab-sync.ts) and [owner-scoped API](../../app/api/play-lab/route.ts)
- [Sound instrument](../../app/sound-lab/engine.ts), [music system](../../app/sound-lab/music.ts), and [sound-lab notes](../../sound-lab/README.md)

Search and design records:

- [Journey findings](../play-journey-findings.md)
- [Ride and muted-palette findings](../play-rides-muted-findings.md)
- [Finish and course plan](../play-finish-and-course-plan.md)
- [Campaign lab](../play-campaign-lab.md)
- [Campaign gap candidates and caveats](../play-campaign-gap-lab.md)

Evidence boundaries: implementation was inspected for this document; old numerical searches were not rerun. Recent UI checks belong to the preceding correction pass. No combined game/audio mobile performance certification is claimed. Palette character descriptions are design interpretations informed by code, search reports, and player feedback, not perceptual facts proven by the evaluator.
