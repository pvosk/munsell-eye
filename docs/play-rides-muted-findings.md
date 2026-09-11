# Dedicated rides and dark/light/muted palettes

## Main findings from this run

- Direct-ride proposals yielded 20/90 screening hits versus 4/90 for broad sampling; on the fresh seed, 9/45 versus 4/45. This is useful evidence for proposal selection, not a statistical guarantee.
- Setup→ride proposals yielded 7/90 screening ride hits; fresh-seed yield was 4/45, exactly the broad baseline. Only 33 of their 2,880 cheap proposals met the intended structural setup/finish condition before competition. This first setup sampler needs work; it is not a solved generator.
- Stronger checks retained seven ride and eight value-shift finalists. None was an every-base-resistant ride. One CMY value-shift candidate was every-base-resistant under the retained supported-route search.
- Most promising new four-paint ride candidate: Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue. Ride opportunities from 3/4 starts; minimum supported travel across all starts about 28 display units. Non-ride alternatives remain.
- Most directly relevant muted triad: Burnt Sienna / Nickel Titanate Yellow / Cobalt Green. One target offers value shifts from 3/3 starts, with minimum supported travel about 19 units. Non-shift alternatives exist from all three bases.
- Dioxazine Purple / Cadmium Yellow Deep / Sap Green supplied separate ride and shift candidates. Its ride has an approximately 11-unit shortest supported approach, so it is less aligned with the preference for consistently substantial travel.
- The current targeted pass found no eligible dense ride/shift finalist for Magenta Grove or Secondaries. This does not invalidate their archived interior holes or rule out better ride/shift targets: only two selected targets per palette were densely rechecked, and interiors were not the objective.
- No palette or hole is player-approved by these calculations. The conservative portfolio selector retains nine distinct candidates across the cohort, but only two finalists were checked per palette; this is not a five-hole course search.

## Scope

Completed 390 audits across 15 fixed palettes: 360 screening evaluations and 30 denser rechecks with extra three-addition exploration. Runtime: 5.2 minutes.
Eight independent dark/light/muted triads, two explicitly constructed four-paint Zorn-adjacent combinations, and five controls. The new combinations exclude separate white/black paints AND catalogue formulas containing PW or PBk pigments. Standard palettes are unchanged.
Muted means lower chroma in the existing modeled masstone, not a guarantee that its mixtures stay muted. The first four triads restrict that role to earth/oxide paints. These are modeled paint definitions, not newly measured spectral reflectance.
Each palette receives 96 proposals per method and seed, with three shortlisted targets audited. Methods: direct ride, setup→ride, bidirectional value shift, and broad recipe sampling. Total: 11,520 cheap proposals. The same four methods repeat on a fresh seed; palettes and thresholds are fixed before any results.
The broad baseline audits its first three separated targets. Directed methods rank all 96 first. This is equal competing-route audit budget, NOT equal total compute or an unbiased rate over all possible targets. Fresh targets test proposal repeatability on the same palettes, not independent palette selection.

## Uniform screening results

These counts use the original 128/24 screening audits, recovered from the cache. They are not final acceptance rates. Later dense failures are retained separately rather than blended into this comparison. Styles overlap.

| Seed | Proposal method | Audited | General checks pass | Ride eligible | Value shift eligible |
|---|---|---:|---:|---:|---:|
| First | direct-ride | 45 | 21 | 11 | 0 |
| First | setup-ride | 45 | 21 | 3 | 1 |
| First | value-shift | 45 | 24 | 4 | 5 |
| First | broad | 45 | 6 | 0 | 0 |
| Fresh | direct-ride | 45 | 19 | 9 | 0 |
| Fresh | setup-ride | 45 | 23 | 4 | 1 |
| Fresh | value-shift | 45 | 23 | 2 | 8 |
| Fresh | broad | 45 | 19 | 4 | 5 |

## Stronger checks: all palettes

Two targets per palette are selected by the existing lexicographic ranking, first for rides and then for value shifts, without selecting the same target twice. A selected target can serve both styles. This selection is NOT an exhaustive test of every promising screening hit.

| Palette | Family | Ride finalists | Shift finalists | Distinct retained holes |
|---|---|---:|---:|---:|
| CMY | control | 1 | 1 | 1 |
| Secondaries | control | 0 | 0 | 0 |
| Zorny | control | 0 | 1 | 1 |
| Magenta Grove | control | 0 | 0 | 0 |
| Ultramarine Gold | control | 1 | 1 | 1 |
| Mars Red / Bismuth Yellow / Indian Red | dark-light-muted | 0 | 0 | 0 |
| Dioxazine Purple / Winsor Yellow Deep / Raw Sienna | dark-light-muted | 1 | 0 | 1 |
| Quinacridone Violet / Winsor Yellow Deep / Indian Red | dark-light-muted | 0 | 0 | 0 |
| Cobalt Violet / Cadmium Yellow Light / Indian Red | dark-light-muted | 2 | 0 | 1 |
| Dioxazine Purple / Cadmium Yellow Deep / Sap Green | dark-light-muted | 1 | 1 | 1 |
| Transparent Earth Orange / Chartreuse / Burnt Sienna | dark-light-muted | 0 | 0 | 0 |
| Burnt Sienna / Nickel Titanate Yellow / Cobalt Green | dark-light-muted | 0 | 2 | 1 |
| Alizarin Permanent / Cadmium Yellow Deep / Burnt Sienna | dark-light-muted | 0 | 0 | 0 |
| Ultramarine Blue / Nickel Titanate Yellow / Terre Verte / Cadmium Red Light | chromatic-zorn-adjacent | 0 | 1 | 1 |
| Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue | chromatic-zorn-adjacent | 1 | 1 | 1 |

## Individually archived candidates

Every finalist, including failed stronger checks, is stored with exact paint definitions, target recipe and per-base route witnesses in `play-rides-muted-results.json`. Qualifying one-offs are retained even when the palette offers only one candidate. A two-candidate portfolio is not evidence of a complete five-hole course.

### control-cmy-direct-ride-20261215-46

CMY

Proposed by **direct-ride**. General failures: none.
Ride: 2/3 starts available, 2/3 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 0.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 18.3 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Phthalo Blue (Green Shade) | 2 | 16.44 | 65.6 | up |
| Quinacridone Magenta | 1 | 12.99 | 37.1 | none |
| Hansa Yellow Light | 1 | 6.64 | 18.3 | none |

### control-cmy-value-shift-20291215-89

CMY

Proposed by **value-shift**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/3 starts available, 3/3 resistant, eligible=true.
Minimum supported travel across starts: 43.5 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Phthalo Blue (Green Shade) | 2 | 6.62 | 45.4 | down |
| Quinacridone Magenta | 2 | 6.03 | 47.0 | down |
| Hansa Yellow Light | 2 | 15.60 | 43.5 | down |

### control-secondaries-direct-ride-20261215-20

Secondaries

Proposed by **direct-ride**. General failures: none.
Ride: 2/4 starts available, 1/4 resistant, eligible=false. Direct-ride starts: 1; setup→chromatic-finish starts: 3.
Value shift: 2/4 starts available, 1/4 resistant, eligible=false.
Minimum supported travel across starts: 10.8 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Cadmium Orange | 1 | 5.41 | 10.8 | none |
| Dioxazine Purple | 1 | 11.64 | 37.8 | none |
| Phthalo Green (Yellow Shade) | 2 | 9.07 | 43.5 | up |
| Titanium White | 2 | 12.72 | 45.0 | down, up |

### control-secondaries-value-shift-20261215-14

Secondaries

Proposed by **value-shift**. General failures: none.
Ride: 0/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 2/4 starts available, 2/4 resistant, eligible=false.
Minimum supported travel across starts: 8.9 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Cadmium Orange | 2 | 12.77 | 65.8 | down |
| Dioxazine Purple | 1 | 5.28 | 8.9 | none |
| Phthalo Green (Yellow Shade) | 2 | 6.94 | 39.0 | down |
| Titanium White | 1 | 17.54 | 42.3 | none |

### control-zorny-broad-20291215-0

Zorny

Proposed by **broad**. General failures: none.
Ride: 0/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/4 starts available, 1/4 resistant, eligible=true.
Minimum supported travel across starts: 21.1 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Yellow Ochre | 2 | 7.74 | 29.2 | up |
| Cadmium Red Light | 2 | 8.89 | 36.4 | up |
| Ivory Black | 3 | 20.61 | 43.7 | up |
| Titanium White | 2 | 6.17 | 21.1 | none |

### control-zorny-direct-ride-20291215-17

Zorny

Proposed by **direct-ride**. General failures: none.
Ride: 0/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 2/4 starts available, 2/4 resistant, eligible=false.
Minimum supported travel across starts: 15.8 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Yellow Ochre | 2 | 7.26 | 46.3 | up, down |
| Cadmium Red Light | 1 | 6.31 | 15.8 | none |
| Ivory Black | 2 | 19.73 | 53.8 | up, down |
| Titanium White | 1 | 8.30 | 23.4 | none |

### control-magenta-grove-direct-ride-20291215-77

Magenta Grove

Proposed by **direct-ride**. General failures: none.
Ride: 2/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: 0; setup→chromatic-finish starts: 1.
Value shift: 2/4 starts available, 1/4 resistant, eligible=false.
Minimum supported travel across starts: 13.9 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Magenta | 1 | 15.73 | 31.9 | none |
| Cadmium Yellow Deep | 2 | 5.19 | 32.5 | up, down |
| Flake White Replacement | 1 | 4.26 | 13.9 | none |
| Phthalo Green | 2 | 19.42 | 45.6 | up |

### control-magenta-grove-setup-ride-20261215-2

Magenta Grove

Proposed by **setup-ride**. General failures: none.
Ride: 0/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 2/4 starts available, 1/4 resistant, eligible=false.
Minimum supported travel across starts: 15.5 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Magenta | 1 | 7.93 | 15.5 | none |
| Cadmium Yellow Deep | 1 | 8.03 | 22.1 | none |
| Flake White Replacement | 2 | 12.23 | 45.2 | up, down |
| Phthalo Green | 2 | 12.45 | 45.1 | up, down |

### control-ultramarine-gold-direct-ride-20261215-41

Ultramarine Gold

Proposed by **direct-ride**. General failures: none.
Ride: 2/3 starts available, 1/3 resistant, eligible=true. Direct-ride starts: 0; setup→chromatic-finish starts: 1.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 21.5 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Magenta | 1 | 12.32 | 35.7 | none |
| Ultramarine Blue | 2 | 16.52 | 64.4 | up |
| Bismuth Yellow | 1 | 7.58 | 21.5 | none |

### control-ultramarine-gold-value-shift-20291215-91

Ultramarine Gold

Proposed by **value-shift**. General failures: none.
Ride: 1/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/3 starts available, 0/3 resistant, eligible=true.
Minimum supported travel across starts: 29.1 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Magenta | 2 | 8.51 | 41.8 | down |
| Ultramarine Blue | 2 | 11.92 | 59.1 | down |
| Bismuth Yellow | 2 | 11.50 | 29.1 | down |

### muted-0-value-shift-20291215-78

Mars Red / Bismuth Yellow / Indian Red

Proposed by **value-shift**. General failures: none.
Ride: 1/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: 1; setup→chromatic-finish starts: none.
Value shift: 0/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 9.0 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Mars Red | 1 | 5.57 | 9.0 | none |
| Bismuth Yellow | 1 | 13.18 | 30.1 | none |
| Indian Red | 1 | 5.84 | 12.1 | none |

### muted-0-setup-ride-20291215-39

Mars Red / Bismuth Yellow / Indian Red

Proposed by **setup-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 0/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 18.0 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Mars Red | 1 | 10.71 | 20.2 | none |
| Bismuth Yellow | 1 | 7.93 | 18.0 | none |
| Indian Red | 1 | 10.85 | 21.4 | none |

### muted-1-setup-ride-20291215-80

Dioxazine Purple / Winsor Yellow Deep / Raw Sienna

Proposed by **setup-ride**. General failures: none.
Ride: 2/3 starts available, 1/3 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 2.
Value shift: 1/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 8.3 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Dioxazine Purple | 1 | 3.86 | 8.3 | none |
| Winsor Yellow Deep | 1 | 15.24 | 36.3 | none |
| Raw Sienna | 2 | 7.28 | 40.0 | down |

### muted-1-value-shift-20261215-2

Dioxazine Purple / Winsor Yellow Deep / Raw Sienna

Proposed by **value-shift**. General failures: none.
Ride: 1/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 16.9 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Dioxazine Purple | 1 | 11.69 | 30.6 | none |
| Winsor Yellow Deep | 1 | 7.38 | 16.9 | none |
| Raw Sienna | 2 | 2.88 | 28.8 | up, down |

### muted-2-setup-ride-20291215-94

Quinacridone Violet / Winsor Yellow Deep / Indian Red

Proposed by **setup-ride**. General failures: token-bypass.
Ride: 1/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 9.0 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Violet | 2 | 7.86 | 26.6 | down, up |
| Winsor Yellow Deep | 1 | 8.43 | 16.0 | none |
| Indian Red | 1 | 6.68 | 9.0 | none |

### muted-2-setup-ride-20261215-60

Quinacridone Violet / Winsor Yellow Deep / Indian Red

Proposed by **setup-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 17.6 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Quinacridone Violet | 1 | 8.18 | 21.8 | none |
| Winsor Yellow Deep | 1 | 8.01 | 17.6 | none |
| Indian Red | 2 | 7.53 | 24.9 | up, down |

### muted-3-direct-ride-20261215-85

Cobalt Violet / Cadmium Yellow Light / Indian Red

Proposed by **direct-ride**. General failures: none.
Ride: 2/3 starts available, 0/3 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 2.
Value shift: 1/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 10.6 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Cobalt Violet | 1 | 3.89 | 17.6 | none |
| Cadmium Yellow Light | 1 | 13.63 | 33.5 | none |
| Indian Red | 2 | 2.55 | 10.6 | down |

### muted-3-direct-ride-20291215-38

Cobalt Violet / Cadmium Yellow Light / Indian Red

Proposed by **direct-ride**. General failures: none.
Ride: 2/3 starts available, 0/3 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 2.
Value shift: 1/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 11.4 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Cobalt Violet | 1 | 3.77 | 17.6 | none |
| Cadmium Yellow Light | 1 | 13.75 | 33.9 | none |
| Indian Red | 2 | 2.48 | 11.4 | down |

### muted-4-direct-ride-20261215-62

Dioxazine Purple / Cadmium Yellow Deep / Sap Green

Proposed by **direct-ride**. General failures: none.
Ride: 2/3 starts available, 1/3 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 2.
Value shift: 1/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 11.1 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Dioxazine Purple | 1 | 4.30 | 11.1 | none |
| Cadmium Yellow Deep | 1 | 14.81 | 36.1 | none |
| Sap Green | 2 | 5.57 | 41.5 | up, down |

### muted-4-value-shift-20291215-39

Dioxazine Purple / Cadmium Yellow Deep / Sap Green

Proposed by **value-shift**. General failures: none.
Ride: 1/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 2/3 starts available, 1/3 resistant, eligible=true.
Minimum supported travel across starts: 24.4 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Dioxazine Purple | 2 | 10.86 | 35.7 | up |
| Cadmium Yellow Deep | 2 | 8.55 | 24.4 | none |
| Sap Green | 2 | 7.47 | 31.3 | up |

### muted-5-direct-ride-20291215-47

Transparent Earth Orange / Chartreuse / Burnt Sienna

Proposed by **direct-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 0/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 14.2 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Transparent Earth Orange | 1 | 10.28 | 16.3 | none |
| Chartreuse | 1 | 7.22 | 14.2 | none |
| Burnt Sienna | 1 | 10.59 | 20.8 | none |

### muted-5-setup-ride-20261215-54

Transparent Earth Orange / Chartreuse / Burnt Sienna

Proposed by **setup-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 0/3 starts available, 0/3 resistant, eligible=false.
Minimum supported travel across starts: 12.9 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Transparent Earth Orange | 1 | 8.03 | 12.9 | none |
| Chartreuse | 1 | 9.49 | 19.0 | none |
| Burnt Sienna | 1 | 8.35 | 16.7 | none |

### muted-6-value-shift-20291215-40

Burnt Sienna / Nickel Titanate Yellow / Cobalt Green

Proposed by **value-shift**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/3 starts available, 0/3 resistant, eligible=true.
Minimum supported travel across starts: 19.3 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Burnt Sienna | 2 | 8.85 | 21.7 | up |
| Nickel Titanate Yellow | 2 | 6.48 | 19.3 | down |
| Cobalt Green | 2 | 3.85 | 20.5 | up, down |

### muted-6-setup-ride-20291215-39

Burnt Sienna / Nickel Titanate Yellow / Cobalt Green

Proposed by **setup-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 2/3 starts available, 0/3 resistant, eligible=true.
Minimum supported travel across starts: 15.7 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Burnt Sienna | 2 | 9.91 | 26.5 | up |
| Nickel Titanate Yellow | 2 | 5.72 | 18.1 | none |
| Cobalt Green | 2 | 4.26 | 15.7 | up |

### muted-7-direct-ride-20261215-1

Alizarin Permanent / Cadmium Yellow Deep / Burnt Sienna

Proposed by **direct-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 15.2 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Alizarin Permanent | 1 | 9.93 | 15.2 | none |
| Cadmium Yellow Deep | 1 | 8.48 | 17.1 | none |
| Burnt Sienna | 2 | 7.06 | 21.9 | up, down |

### muted-7-setup-ride-20261215-6

Alizarin Permanent / Cadmium Yellow Deep / Burnt Sienna

Proposed by **setup-ride**. General failures: none.
Ride: 0/3 starts available, 0/3 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/3 starts available, 1/3 resistant, eligible=false.
Minimum supported travel across starts: 14.8 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Alizarin Permanent | 1 | 9.77 | 14.8 | none |
| Cadmium Yellow Deep | 1 | 8.64 | 17.6 | none |
| Burnt Sienna | 2 | 6.91 | 24.0 | up, down |

### adjacent-0-broad-20261215-2

Ultramarine Blue / Nickel Titanate Yellow / Terre Verte / Cadmium Red Light

Proposed by **broad**. General failures: none.
Ride: 1/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 1/4 starts available, 0/4 resistant, eligible=false.
Minimum supported travel across starts: 17.6 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Ultramarine Blue | 1 | 7.96 | 38.9 | none |
| Nickel Titanate Yellow | 2 | 13.63 | 41.7 | up, down |
| Terre Verte | 1 | 4.56 | 17.6 | none |
| Cadmium Red Light | 1 | 6.22 | 20.3 | none |

### adjacent-0-setup-ride-20261215-30

Ultramarine Blue / Nickel Titanate Yellow / Terre Verte / Cadmium Red Light

Proposed by **setup-ride**. General failures: none.
Ride: 0/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/4 starts available, 1/4 resistant, eligible=true.
Minimum supported travel across starts: 14.3 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Ultramarine Blue | 2 | 14.08 | 46.1 | up |
| Nickel Titanate Yellow | 2 | 5.41 | 14.3 | none |
| Terre Verte | 2 | 7.38 | 27.2 | up |
| Cadmium Red Light | 2 | 6.33 | 30.8 | up |

### adjacent-1-value-shift-20291215-53

Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue

Proposed by **value-shift**. General failures: none.
Ride: 3/4 starts available, 1/4 resistant, eligible=true. Direct-ride starts: 1; setup→chromatic-finish starts: 0, 2.
Value shift: 2/4 starts available, 1/4 resistant, eligible=false.
Minimum supported travel across starts: 28.0 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Perylene Maroon | 2 | 8.64 | 52.4 | down |
| Hansa Yellow Light | 1 | 15.26 | 36.3 | none |
| Raw Sienna | 2 | 5.38 | 28.0 | down |
| Cobalt Blue | 1 | 6.10 | 29.2 | none |

### adjacent-1-broad-20291215-0

Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue

Proposed by **broad**. General failures: none.
Ride: 1/4 starts available, 0/4 resistant, eligible=false. Direct-ride starts: none; setup→chromatic-finish starts: none.
Value shift: 3/4 starts available, 0/4 resistant, eligible=true.
Minimum supported travel across starts: 21.4 display units.

| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |
|---|---:|---:|---:|---|
| Perylene Maroon | 2 | 5.18 | 25.0 | down, up |
| Hansa Yellow Light | 2 | 17.34 | 46.2 | down |
| Raw Sienna | 2 | 5.71 | 21.4 | none |
| Cobalt Blue | 2 | 4.48 | 26.3 | up, down |

## Interpretation limits

- “Eligible” keeps the existing every-base general checks and at least two-thirds efficient style availability. It does not mean every route or every base delivers that style.
- “Resistant” means no supported non-style competitor was retained from that base, not a proof that no shortcut exists. Narrower successful routes remain in the raw evidence.
- Ride classification requires a long chromatic stroke and high chromatic fraction, not a literal gamut-boundary proof. Setup→ride additionally requires prior setup travel and a long final chromatic stroke.
- Value shifts can go up or down, must follow setup, and cannot be supplied by the free base selection. Chromatic value shifts can overlap with balancing.
- Route support still uses 55 ms finishing windows and 4% local setup coverage. Neither control settings nor these filters changed.
- No par, tolerance, paint strength, live lab, animation or course sequence changed. Browser testing is not relevant to this offline search. Player testing is still needed.

Source fingerprint: 82c4ffd4bf1a46173a285b9cf35ce864c2353de6197b4e66dca44faf367856a1. Full screening evidence archive: outputs/play-rides-muted-evidence-82c4ffd4bf1a.tar.gz. The compact results and this report are stored alongside the search scripts.
