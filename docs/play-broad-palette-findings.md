# Broad palette discovery bank — 12 September 2026

## What changed

An offline broad-to-deep search now samples actual original-pigment mixtures across the entire three/four-paint combination space of the existing 32-pigment research pool, plus larger-palette samples. It saves every proposal before applying any style or near-base selection. The previous backward fixed-goal study remains intact; this pass deliberately uses reachable forward-generated destinations to explore territory outside that study's twelve requested colors.

No live rules, strengths, mass, timing, tolerance, par, palettes, campaign, lab, sound, or public deployment changed. This is a discovery bank, not a bank of certified or player-approved holes.

## Coverage: distinguish breadth from depth

| Paint count | Palettes sampled | Legal sequences per palette | Proposals saved |
| --- | ---: | ---: | ---: |
| 3 | 4,960 (all combinations in pool) | 12 | 59,520 |
| 4 | 35,960 (all combinations in pool) | 12 | 431,520 |
| 5 | 512 | 12 | 6,144 |
| 6 | 512 | 12 | 6,144 |
| 8 | 512 | 12 | 6,144 |
| Total | 42,456 | | 509,472 |

The 40,920 small combinations include existing combinations; the previous 40,906 enumeration excluded fourteen existing combinations. They describe the same 32-pigment pool, not an expansion of the pigment catalog. Larger sets are deterministic samples, not complete enumeration.

There are 152 palette/destination two-addition competitor audits (40 initial, 112 additional), and 30 of these receive three-addition competitor audits (20 initial, 10 additional). Every base and discrete paint order is considered within those depth caps; continuous dose optimization remains bounded. These are not 42,456 fully validated palettes. The first pass reaches 100% combination coverage for triads/quartets at a shallow level; only 80 of those small palettes receive numerical competition checks.

Proposals are correlated. The same active-pigment subset can appear inside different larger palettes. That is retained because the unused paints can introduce different competing routes; it must not be described as half a million distinct enjoyable holes.

## How the inexpensive pass works

For each palette, twelve deterministic legal sequences use one, two, or three additions, preserve the actual charge law and original-pigment mixing, and record the resulting target without rounding its RGB. Screening descriptors use stop-to-stop chords, not fully integrated paths. They record nearest-base separation, setup travel, finish travel, a/b movement, value movement, inward chroma change, and departure from the initial distance to target.

Every record is banked, including pure-in-cup cases, close starts, value-only routes, apparent detours, and unlabeled cases. Shortlist cells span paint count, destination region (dark/light/middle-neutral/middle-color), and far/glide/ride/value/inward/close/variation/control criteria. These cells retain a few representatives and include random-score controls. Additional checking alternates distance-ranked and randomly ordered representatives from those cells.

This is diversity-aware sampling, **not unbiased sampling or an optimizer over the full space**. The cell extrema can overrepresent duplicate whites and extreme colors. Its "variation" score is only a proxy, not an assertion of a new style. The underlying bank allows different future selection without regenerating all proposals.

The generated target distribution itself is not uniform: 244,105 dark, 106,392 light, 148,758 middle-color, and 10,217 middle-neutral proposals. The dark/light categories do not distinguish chroma. A fixed charge distribution and limited route depth bias what can be discovered.

## Glide is not just black to white

The experimental glide diagnostic requires a meaningful setup, substantial final travel, and material a/b color-plane travel. A final path whose maximum chroma is below .03, or whose a/b travel is below .015, is marked value-only. The glide diagnostic additionally requires at least .04 a/b travel, setup length 6, final length 30, and at least two meaningful pours. These are provisional descriptive cutoffs; they do not replace the established classifier or live rules.

This excludes a neutral axial black-to-white path from automatically qualifying. It still permits a chromatic-to-neutral inward finish and some tinted value changes. It cannot decide whether the result feels like a satisfying glide. Full finish paths are measured during audits; cheap proposal chords are not treated as verified path measurements. Stable chromatic integration is retained separately for the existing ride definition.

## What a checked record means

The numerical challenger sees palette and fixed target, not the generating recipe. Its candidates are combined with the generating witness so known reachability is not erased. Consecutive splittable pours are merged, and existing timing support (55 ms) and local setup support (.04) are unchanged. Both raw and supported shortest-found counts remain visible.

Availability describes style-bearing shortest-found supported routes. It does not mean the style is required, or available from every base. Flags record pure-in-cup, unresolved support, short direct approaches, and token bypasses. A flag-free record is not automatically robust or worthy of a course: it may have a one-addition route from several bases and an interesting setup only from one.

Initial numerical checking uses 32 samples, two restarts, 60 pattern-search iterations, and up to two additions. The deeper check uses up to three additions, 120 iterations, six restarts/144 samples for three/four paints and three restarts/72 samples for larger palettes. It retains two closest-center solutions per paint order in deeper measurement. This can miss viable outer-region doses and does not certify absence of shortcuts. Larger palettes receive less continuous search per order, so failure rates cannot be read as a controlled comparison of paint counts.

## Results: candidates, not a new robust-course claim

All 30 deeper cases have a timing-supported route found from every base. Twelve have none of the recorded general failure flags. **None of the 30 simultaneously has no general flags and glide, ride, or value-shift availability from at least two-thirds of its bases.** All thirty have shortest-supported counts of one or two additions in this sample, not uniform three-addition interior play. This broad discovery sweep has not displaced the more deliberately inverse-designed value-shift family.

Several flag-free cases are useful one-off captures or future setup-region seeds:

| Candidate | Palette | Approximate target RGB | Observed opportunity; caveat |
| --- | --- | --- | --- |
| `mine-11-19-27-8` | Cadmium Red Light / Cobalt Blue / Chromium Oxide Green | 67, 65, 65 | Inward glide/balance from green; one-addition alternatives from red and blue. White-free, dark neutral finish. |
| `mine-5-11-26-2` | Cadmium Yellow Deep / Cadmium Red Light / Permanent Green Light | 95, 112, 92 | Ride/glide/balance from yellow; simpler alternatives from the other two. |
| `mine-7-10-12-26-7` | Nickel Titanate Yellow / Transparent Orange / Cadmium Red Medium / Permanent Green Light | 98, 95, 104 | Balance available from two bases, glide/ride from one; not broad style coverage. |
| `mine-11-12-13-26-8` | Cadmium Red Light / Cadmium Red Medium / Quinacridone Magenta / Permanent Green Light | 100, 97, 82 | Glide/balance from two of four bases; substantial red/green interaction but simpler alternative starts. |
| `mine-4-8-10-11-23-2` | Cadmium Lemon / Naples Yellow Hue / Transparent Orange / Cadmium Red Light / Cobalt Teal | 87, 80, 70 | Ride from three of five bases, glide from two; below the two-thirds style criterion, still archived. |
| `mine-0-10-12-20-23-25-3` | Titanium White / Transparent Orange / Cadmium Red Medium / Cerulean Blue / Cobalt Teal / Viridian | 252, 153, 155 | Value-shift options from three of six bases; supported counts 1,1,2,2,2,2. Different starts carry different experiences. |

These numbers are availability, not resistance: non-style routes can remain on a listed base. Rounded RGB in this table is only a label; the archive retains precise targets. Large palettes often produced impressive style availability while also admitting token or short alternatives, so their impressive numerators must not be read independently of failure flags.

The initial mixing/banking phase took about 33 seconds. Its numerical follow-up brought the initial runner to about 443 seconds; the additional 112/10 audits took about 209 seconds in an overlapping process. These local observations show why shallow broad sampling is economical and complete continuous optimization is not.

## Close-start counterexample: explicitly preserved

Flake White Replacement / Ivory Black / Nickel Titanate Yellow / Cobalt Blue / Raw Sienna / Terre Verte, candidate `mine-1-2-7-19-29-31-6`, initially appeared close-indirect from Raw Sienna and Terre Verte. Their starting distances were about 2.28 and 2.84 scoring tolerances.

The deeper checker found less indirect alternatives from both and a token bypass. The close-indirect classification did not survive. The Terre Verte raw one-addition route was already visible in the smaller check, but did not meet timing support there; the stronger check still distinguishes raw and supported minima. This example supports keeping counterexamples and support distinctions visible, not claiming that close-indirect play has been established or is impossible.

## Archives and reproduction

- [Portable bank index](play-broad-bank-index.json): original pigment definitions, source fingerprint, seed/policy, shard hashes and row layout.
- `play-broad-bank-{3,4,5,6,8}.jsonl.gz`: **every** exact target, original-pigment quantity vector and shot controls, split by palette size. Rows are `[poolIndices, sample, order, timesSeconds, quantities, targetRGB]`.
- [Initial shortlist and two-addition audits](play-broad-palette-screen.json).
- [Initial deeper audits](play-broad-palette-audit.json).
- [Expanded shortlist audits](play-broad-expanded-audit.json).
- `scripts/broad-palette-mine.ts`, `scripts/expand-broad-audits.ts`, `scripts/pack-broad-bank.ts`: reproducible runs; refuse to overwrite existing run files.
- `node --import tsx scripts/read-broad-candidate.ts mine-11-19-27-8`: retrieves a saved candidate with its paint definitions without rerunning search.

The 132 MB verbose proposal cache is preserved locally and excluded from Git. Portable shards retain all exact witnesses in about 34 MB; full discovery descriptors can be reproduced with the recorded source/seed. The compact bank is not a top-k-only export. Nothing is silently discarded for failing a label.

## Assessment

This creates a substantially broader reusable starting bank. It does not demonstrate that we have maximized quality, exhausted setup regions, found a new style, or established robust multi-hole courses. Sampling one-to-three-addition targets especially favors palettes whose interesting behavior appears within that horizon; longer setup experiences and different game modes remain underexplored. Near-base distance alone would not protect against all trivial routes, and style filters could still exclude worthwhile experiences if used as hard discovery gates. That is why banking precedes filtering here.

Validation: 54 prior engine/research regressions plus five new bank tests passed (59 total), along with type checking and whitespace checks. New checks cover complete combination counts, deterministic legal proposals, neutral axial exclusion, every portable record's presence, shard hashes, sampled bank reconstruction, and all retained raw/efficient audit witness replays. Candidate retrieval was also exercised. No browser checks were needed for this offline-only pass.
