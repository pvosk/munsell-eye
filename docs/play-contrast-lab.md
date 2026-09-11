# Round 9: five contrasting journeys

Selection-only revision `experience-selection-1`; archived evaluators and rounds remain unchanged.

## Changes

- Spatial extent is maximum modeled 3D distance from the starting paint along a sampled route. It is rotation-independent, unlike a bounding-box diagonal. Repeated loops cannot inflate it as they can cumulative travel. The candidate summary uses the minimum extent across retained supported routes from every base; unresolved bases contribute zero. This remains a sampled floor, not a proven global minimum.
- Ride timing preferences distinguish 55–125 ms focused, over 125–220 ms moderate, and over 220 ms gentle finishing windows. Below 55 ms remains unsupported under the existing policy. These are provisional selection labels, not new control or acceptance settings. Safety and style coverage still precede extent and timing preferences. The featured ride prioritizes an available focused finish, without hiding easier alternatives.
- Cross-palette set selection rejects targets closer than 1.5 scoring tolerances, caps low-chroma targets (OKLab C < .05) at two, requires two chromatic targets (C >= .09), and requires a lightness span of .20. These provisional lab-composition settings are not per-hole quality rules or universal palette-course quotas. The selector fails explicitly rather than silently relaxing them.

## Selected tests

1. Teal Ember — exact previous target, featured route and par retained as the reference.
2. CMY — warm chromatic ride; opportunity from 2/3 bases, featured finishing window about 77 ms.
3. Sienna Field — Burnt Sienna / Nickel Titanate Yellow / Cobalt Green; value-shift opportunity from 3/3 bases, with non-shift alternatives retained.
4. Maroon Arc — Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue; ride opportunity from 3/4 bases. Featured finish is gentle (about 258 ms), included as a spatial comparison rather than a hard timing test.
5. CMY — darker value-shift target; supported retained routes resist non-shift alternatives from all three bases in the bounded search.

The set spans OKLab lightness .486–.755, has two quiet and two chromatic targets under the stated bins, and minimum pair separation 1.72 tolerances. It is more varied than Round 8, not a full-gamut course. The reference and CMY shift are still both relatively quiet targets by design.

All paint definitions, actual tint strength, meter mapping, motion, live landing tolerance and par formula are unchanged. New palette entries append after the existing 29; historical indices and round signatures are preserved. Round 9 is separately versioned for replay and private syncing. Old rounds and notes remain available.

These tests reuse saved dense search evidence; the pass does not rerun the broad search or establish enjoyment. Player feedback should distinguish expansive travel, meaningful setup and finish timing.
