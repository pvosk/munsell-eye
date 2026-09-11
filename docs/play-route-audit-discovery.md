# Route audit and reopened palette search

Offline routes-3-dose-competition. Runtime 536.2 s. No live bank, par, tolerance, paint definition, animation or deployment changed.

## Fixed-target regression

The eight v52 targets were reexamined unchanged with a 257-sample one-pour / 49×49 two-pour atlas. Dose variants are retained within each paint order. Available coverage means a supported efficient style route exists. Robust coverage means no supported equally shot-efficient non-style variant was found from that base. These are sampled findings, not proofs.

| Palette / hole | Intended style | Available starts | Robust starts | Featured / fewest additions |
|---|---|---:|---:|---:|
| Cobalt Tide 0 | chromatic-ride | 3/4 | 1/4 | 2 / 1 |
| Cobalt Tide 1 | chromatic-ride | 3/4 | 1/4 | 2 / 1 |
| Crimson Current 0 | opposing-colors | 4/4 | 0/4 | 2 / 2 |
| Crimson Current 1 | opposing-colors | 4/4 | 3/4 | 2 / 2 |
| Orange Echo 0 | opposing-colors | 3/4 | 1/4 | 2 / 2 |
| Orange Echo 1 | opposing-colors | 4/4 | 0/4 | 2 / 2 |
| Violet Circuit 0 | opposing-colors | 4/4 | 0/4 | 2 / 2 |
| Violet Circuit 1 | chromatic-ride | 3/4 | 1/4 | 2 / 1 |

The observed Orange Echo shortcut replays at 0.536 scoring tolerances, with 1 meaningful addition, a 169 ms finishing window, and no opposing-color trait. It is the same paint order as the featured example but different doses. The independent search now retains non-style bypass evidence instead of suppressing it.

## Same training targets, corrected competition

All 16 previously inspected palettes were rerun on the exact same 24 recipe targets (seed 20260925). The entries below are old accepted counts → new robust counts. Policies differ intentionally; this is not a randomized comparison of palette quality.

| Palette | Ride | Value–color balance | Opposing colors |
|---|---:|---:|---:|
| Cadmium Lemon / Cadmium Orange / Cobalt Blue / Cerulean Blue | 7 → 1 | 1 → 0 | 1 → 0 |
| Cadmium Lemon / Cadmium Orange / Dioxazine Purple / Cobalt Teal | 6 → 0 | 1 → 0 | 5 → 3 |
| Cadmium Lemon / Cadmium Red Light / Dioxazine Purple / Cobalt Blue | 5 → 0 | 4 → 0 | 6 → 0 |
| Yellow Ochre / Cadmium Orange / Cobalt Blue / Cobalt Teal | 7 → 0 | 0 → 0 | 0 → 0 |
| Cadmium Lemon / Cadmium Orange / Dioxazine Purple / Cobalt Blue | 5 → 1 | 1 → 0 | 4 → 0 |
| Cadmium Lemon / Cadmium Orange / Cerulean Blue / Phthalo Blue (Green Shade) | 5 → 0 | 0 → 0 | 0 → 0 |
| Cadmium Lemon / Cadmium Orange / Ultramarine Blue / Phthalo Green (Yellow Shade) | 1 → 0 | 0 → 0 | 0 → 0 |
| Cadmium Lemon / Quinacridone Magenta / Alizarin Crimson / Cerulean Blue | 8 → 0 | 2 → 0 | 8 → 2 |
| Cadmium Orange / Cadmium Red Light / Ultramarine Blue / Cobalt Blue | 5 → 0 | 1 → 0 | 1 → 0 |
| Cadmium Orange / Transparent Orange / Ultramarine Blue / Permanent Green Light | 0 → 0 | 2 → 0 | 3 → 0 |
| Transparent Orange / Cadmium Red Light / Cobalt Blue / Permanent Green Light | 0 → 0 | 0 → 0 | 1 → 0 |
| Cadmium Lemon / Cadmium Red Light / Ultramarine Blue / Cerulean Blue | 3 → 0 | 1 → 0 | 3 → 1 |
| Zorny | 0 → 0 | 0 → 0 | 0 → 0 |
| Secondaries | 3 → 0 | 2 → 0 | 3 → 0 |
| Cobalt Ember | 2 → 0 | 3 → 0 | 3 → 1 |
| Viridian Rust | 1 → 0 | 0 → 0 | 2 → 0 |

## Fresh-target course potential

A 20-paint pool supplied 4845 combinations for cheap pair screening. 12 new combinations received full route analysis, explicitly including white, black and all-colored groups. Previous finalists were not locked in. New and old candidates shared the training recipe cohort; finalists were frozen before 48 fresh targets (seed 20270317). Current favorites and historical controls also received those fresh targets.

| Palette | Ride | Lift | Value–color balance | Opposing | Interior | Distinct useful targets | Value / chroma zones |
|---|---:|---:|---:|---:|---:|---:|---|
| Cadmium Lemon / Cadmium Orange / Cobalt Blue / Cerulean Blue | 8 | 0 | 0 | 0 | 1 | 5/48 | middle, high / moderate, chromatic |
| Cadmium Lemon / Cadmium Red Light / Dioxazine Purple / Cobalt Blue | 0 | 0 | 0 | 0 | 3 | 2/48 | middle, high / chromatic |
| Yellow Ochre / Cadmium Orange / Cobalt Blue / Cobalt Teal | 0 | 0 | 0 | 0 | 0 | 0/48 |  /  |
| Cadmium Lemon / Quinacridone Magenta / Alizarin Crimson / Cerulean Blue | 0 | 0 | 0 | 0 | 1 | 1/48 | high / chromatic |
| Cadmium Orange / Transparent Orange / Ultramarine Blue / Permanent Green Light | 0 | 0 | 0 | 0 | 2 | 1/48 | middle / chromatic, moderate |
| Zorny | 0 | 0 | 0 | 0 | 2 | 2/48 | middle / moderate, quiet |
| Secondaries | 0 | 0 | 0 | 0 | 2 | 2/48 | high, middle / quiet |
| Cobalt Ember | 0 | 0 | 0 | 1 | 3 | 3/48 | high, middle / moderate, chromatic |
| Cadmium Lemon / Cadmium Orange / Dioxazine Purple / Cerulean Blue | 3 | 0 | 0 | 1 | 3 | 4/48 | middle, low / moderate, quiet |

## Interpretation and limitations

- All-base viability is separate from style. A hole must offer a supported meaningful route from every base; at least half the starts must resist sampled non-style shortcuts for a style to pass. Non-ride styles also reject any found one-addition solution. Substantial one-addition rides remain valid.
- Every equally short successful route is eligible to expose a bypass, even if its correction is too small to count as a meaningful decision. Style support requires 55 ms finishing width and at least 4% sampled local setup coverage. These are provisional filters, not validated player difficulty thresholds. Robust does not mean mathematically unavoidable.
- The audit samples successful dose regions, not only closest-to-center solutions. It does not exhaust continuous times. One/two-pour search covers all orders; three-pour solutions still come from legal generating-recipe permutations, so missing three-pour alternatives remain a limitation.
- Distinct targets are a deterministic greedy subset separated by two scoring tolerances. Style totals overlap: never sum columns as independent holes. Value bins use Oklab L < .45 / .45–.70 / ≥ .70; chroma bins use < .05 / .05–.12 / ≥ .12. These are analysis bins, not Munsell labels.
- More accepted targets do not establish a better course. The table separately shows style yield, target separation, value/chroma breadth and all-base addition counts in the JSON. It does not measure emotional quality, camera quality or actual difficulty. A specialist can be excellent with a narrow range.
- This is a bounded 20-paint, four-paint-palette search, not an optimum over every pigment or palette size. French Light’s eight-paint problem is outside this comparison. Pigment behavior remains the existing spectral approximation from stored colors and tinting strengths, not measured brand spectra.
- Exact targets, paint definitions, route witnesses, seeds and a source hash are saved alongside this report. The saved public lab is unchanged. A future course builder must explicitly consume the new audit; historical bank labels are not silently rewritten.
