# Expanded palette portfolios — 12 September 2026

## Scope and result

Expanded beyond the four green-focused palettes to **16 palettes total**, with 3, 4 and 5 paints. This is a deliberately varied panel, not an exhaustive or uniformly random palette sample.

- 960 reachable target proposals archived (60 per palette; first 12 repeat the original bank's deterministic samples, 48 extend them).
- 192 targets numerically screened (12 per palette).
- 48 finalists independently challenged and backward-witness enriched (3 per palette).
- **30 finalists survived the current general checks**, across 15 palettes. Five palettes retained all three finalists.
- All proposals, rejected finalists, competing witnesses and selection reasons are retained in the two JSON archives. No gameplay, pigment strength, timing, tolerance or public lab change.

## Portfolio inventory

Counts are survivors **out of three selected finalists**, not a palette quality score or total available holes.

| Pigments | Survivors |
| --- | ---: |
| Cadmium Red Light / Cobalt Blue / Chromium Oxide Green | 2/3 |
| Cadmium Yellow Deep / Cadmium Red Light / Permanent Green Light | 3/3 |
| Nickel Titanate Yellow / Transparent Orange / Cadmium Red Medium / Permanent Green Light | 1/3 |
| Cadmium Red Light / Cadmium Red Medium / Quinacridone Magenta / Permanent Green Light | 3/3 |
| Naples Yellow Hue / Ultramarine Violet / Permanent Green Light | 1/3 |
| Hansa Yellow Light / Dioxazine Purple / Cobalt Teal | 3/3 |
| Titanium White / Cadmium Orange / Dioxazine Purple / Phthalo Green (Yellow Shade) | 1/3 |
| Cadmium Lemon / Naples Yellow Hue / Transparent Orange / Cadmium Red Light / Cobalt Teal | 3/3 |
| Yellow Ochre / Perylene Maroon / Cerulean Blue | 2/3 |
| Nickel Titanate Yellow / Ultramarine Blue / Burnt Sienna | 0/3 |
| Naples Yellow Hue / Dioxazine Purple / Terre Verte | 1/3 |
| Cadmium Yellow Deep / Quinacridone Magenta / Phthalo Blue (Green Shade) | 2/3 |
| Flake White Replacement / Cadmium Yellow Deep / Quinacridone Magenta / Phthalo Green (Yellow Shade) | 2/3 |
| Cadmium Orange / Alizarin Crimson / Cobalt Blue / Raw Umber | 3/3 |
| Flake White Replacement / Yellow Ochre / Cadmium Red Light / Ultramarine Blue / Viridian | 2/3 |
| Naples Yellow Hue / Cadmium Red Medium / Dioxazine Purple / Cerulean Blue / Burnt Sienna | 1/3 |

## Particularly useful follow-ups

- **Hansa Yellow Light / Dioxazine Purple / Cobalt Teal**: mine-3-16-23-5 has a yellow-green target (RGB approximately 154,178,62), and a found raw and timing-supported minimum of two additions from each base. Value-shift options occur from two bases, but non-value-shift alternatives also exist from every base. This is an encouraging test candidate, not a proof of forced style.
- **Yellow Ochre / Perylene Maroon / Cerulean Blue**: two survivors provide a muted, white-free contrast to the chromatic groups.
- **Cadmium Orange / Alizarin Crimson / Cobalt Blue / Raw Umber**: three survivors merit playtesting as another non-green-centered portfolio.
- **Warm cluster / Cobalt Teal** and the two strong Permanent Green Light groups retain three targets each. Distinct endpoints do not establish distinct experiences; review the actual competing routes before making a course.
- **Nickel Titanate / Ultramarine / Burnt Sienna** has no survivors among these three finalists. This is a sampled gap, not evidence that no good hole exists.

## Method and limitations

Before route screening, retain light, dark, chromatic, muted, distant-from-base and deterministic-control targets, then fill by farthest-point color separation. Deeper finalists are prioritized by fewer general flags, measured glide/balance availability and nearest-base distance, with at least two landing tolerances between targets. This ranking has an explicit style bias; it is not an unbiased comparison of palette potential.

Deep checks combine backward-generated witnesses, earlier known rivals where present, and the independent numerical challenger (up to three additions, 288 samples, 12 restarts, 180 iterations under the existing policy). Successful controls are replay-tested. The numerical challenger is not given the target recipe; backward proposal construction is.

General failure checks: pure paint already within tolerance, unsupported base, short direct shortcut, token bypass. Passing does **not** require two additions from every base or the intended style from every base. Many survivors still have one-addition alternatives. Ride/value-shift availability, bypasses and resistance remain separately recorded. Bounded searches do not prove global minima.

The 55 ms timing support and existing setup measurement remain unchanged. Destination spacing does not guarantee hue/value-zone variety, and proposal diversity does not guarantee route diversity. A full course should be assembled only after route and player review. Single-hole successes stay banked even without a broad portfolio.

## Archives and verification

- [Initial eight portfolios](play-green-portfolios.json)
- [Additional eight portfolios](play-expanded-portfolios.json)
- Replay/source-fingerprint tests: `node --import tsx --test scripts/test-portfolios.ts` — both passed.
- `npx tsc --noEmit` — passed.
- Scripts refuse to overwrite existing reports. Source hashes and full pigment definitions are embedded.

## Sound release status

The sign-in link and owner-scoped preset-saving API were already published in v64. Local API/owner-isolation tests and anonymous hosted access were checked previously. Actual hosted signed-in save/load and cross-device synchronization remain unverified; this is a verification gap, not an unpushed feature. No redundant deployment was performed in this research pass.

