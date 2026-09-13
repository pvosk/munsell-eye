# Start-only, target-only and joint premix refinement

September 12, 2026. Research comparison completed; live lab and gameplay unchanged.

## Direct answers

An intended **dose** is the amount in one demonstration shot, represented by hold
time. It is not the number of pours required. A three-pour **witness** shows one
winning route; only the shorter-route challenge provides evidence about necessity.

Start/target **proportions** are pigment recipes. They determine the start/target
colors through the unchanged mixing model. They are not distances along a fixed
curve. Moving a recipe can change both visible color and future shot curves.
Scoring requires matching the target color within tolerance, not its exact recipe.

The previous 224 parent candidates **already received joint refinement attempts**,
plus 73 substitution children. The 84 audit count was a later selection stage,
not the number that received refinement. Not every attempted refinement moved or
improved its candidate. This experiment isolates the effects we previously combined.

## Controlled experiment

We used **all 128 original parents from hybrid-2** (64 two-pour, 64 three-pour),
including failures, plus the successful substitution child as a separately labeled
anchor. The parent pool was already screened/selected in the earlier search: it
is not a random sample of all possible palettes or starts.

Each of 129 cases received five conditions, for **645 audited comparisons**:

1. Baseline: no refinement.
2. Dose-only: change demonstration amounts; keep start/target recipes fixed.
3. Start-only: change start recipe and demonstration amounts; fix target recipe.
4. Target-only: change target recipe and demonstration amounts; fix start recipe.
5. Joint: change both recipes and demonstration amounts.

Paints, strengths, witness order, tolerance, normalized mass, eight outer rounds,
and per-case seeds/settings were held fixed. Same-start/same-target challenges
were reused: changing only the demonstration doses cannot change the actual
reachable set or remove an alternative shortcut. Equal iteration counts are not
equal total compute, because the arms have different numbers of free variables.

Every arm received independent shorter-route search (192 samples, 10 restarts per
order), small-cleanup checking, and the existing meaningful-action/timing/setup
tests. Algebraic exact-recipe routes were added as a separate shortcut attack.
Every passing three-pour result, regardless of arm, received two fresh denser
checks (768 samples, 32 restarts per order) and a stronger cleanup challenge.

Recorded runtime: 217 seconds. Counted challenger evaluations: 21.18 million;
this is not a total count of all objective/region evaluations.

## Results across the 128 parents

| Condition | Two-pour passes / 64 | Three-pour passes / 64 |
|---|---:|---:|
| Baseline | 52 | 0 |
| Dose-only | 52 | 0 |
| Start-only | 51 | 1 |
| Target-only | 49 | 1 |
| Joint | 50 | 1 |

The start-only three-pour success is **a different candidate** from the target-only
and joint success. All three arm results survived the fresh checks. The selected
substitution anchor, excluded from these denominators, also passed target-only
and joint refinement and their fresh checks.

The fewer two-pour passes after refinement are important: improving the soft
objective does not guarantee passing hard support criteria. The original proposals
already supplied many usable two-stage routes. We must keep passing baselines and
not blindly replace them with a higher-scoring but unsupported refined witness.

### Which variable helped the earlier winners?

Best two-pour endpoint error below is divided by landing tolerance; **≤1 wins**.

| Candidate | Baseline | Start-only | Target-only | Joint |
|---|---:|---:|---:|---:|
| Radiant Turquoise / Radiant Lemon / Quinacridone Red / Radiant White | 0.746 | 0.746 | **2.202** | **2.200** |
| Transparent Orange / Permanent Orange / Titanium White / Radiant Turquoise | 0.767 | 0.770 | **1.428** | **1.548** |

For the first, joint refinement moved the start only **0.022 tolerances** in color
and the target **2.035 tolerances**. Target-only refinement achieved effectively
the same resistance. It would be inaccurate to imply that moving its starting
mixture was an important contributor.

For the orange/turquoise substitution, target-only was sufficient to pass, while
joint refinement improved both the one-pour and two-pour margins further. Joint
movement was **2.514 tolerances for the start** and **2.711 for the target**.
This demonstrates a useful extra effect, not a globally optimal joint solution.

### A new start-only result

Palette: **Cadmium Lemon, Naples Yellow Hue, Transparent Orange, Cadmium Red Light,
Cobalt Teal**. Candidate `hybrid-751927-36-4-1`.

The target stays the same muted brown (approximately RGB 132, 101, 85). The start
moves **5.702 tolerances**, becoming approximately 98.4% Cadmium Lemon. The witness
adds Transparent Orange → Cobalt Teal → Naples Yellow Hue.

The best two-pour error increases from **1.150× to 1.367× tolerance**. The original
already resisted an actual two-pour landing in this search, but lacked the 1.3×
safety margin; this is margin strengthening, not removal of a previously winning
shortcut. Joint refinement stayed at 1.125× and failed our margin criterion.

The new witness has **55.3 ms** finishing support and **17.3%** local setup
coverage. It only barely clears the 55 ms threshold, so it is a **borderline
research candidate**, not a confidently comfortable/challenging player experience.
This palette's warm cluster plus a cool paint is interesting structurally, but
we have not established a whole course for it or given it a promoted name.

## How narrow is the problem?

For this selected pool, usable two-pour witnesses were common. Stronger three-pour
resistance was uncommon: **62/64 joint-refined three-pour parents still had a
winning two-pour route**, one had an inadequate miss margin, and one passed.
That is a real low yield for the current proposer/refiner. It is not evidence that
only one robust hole exists per 64 palettes, nor that the entire space is exhausted.

There are two contributors:

- **Structural constraints:** many endpoints really do have fewer-pour recipes.
- **Search limitations:** fixed witness orders, short local optimization, a
  comparatively weak inner challenger, and screened proposals biased toward
  particular regions. Start-only finding a result joint missed is direct evidence
  that the current joint search is not exhaustive or globally optimal.

The next optimizer should retain a portfolio of constrained and joint attempts,
with the baseline as an option, and select using independent validation. Merely
giving all variables freedom is not sufficient. The comparison itself does not
change the production default or automatically select a new lab.

## Three, four, five paints and a four-pour minimum

An algebraic check now constructs exact target recipes from full-support starts
using at most `n-1` distinct additions, when those doses are legal. In this run,
**11/12 joint-refined triad candidates had a legal exact two-addition construction**.
The remaining triad also failed our numerical three-pour criteria. We should not
spend most triad search effort demanding three independent ingredient decisions.

| Paint count | Three-pour parents tested | Passing arms in this experiment |
|---|---:|---|
| 3 | 12 | None |
| 4 | 24 | Target-only / joint on the same candidate |
| 5 | 10 | Start-only on one candidate |
| 6 | 18 | None |

These small, unequally selected groups cannot establish that four-paint palettes
are generally best. More paints expand both possible experiences and possible
shortcuts. Recipe dimension also exceeds color dimension above four paints.

A four-pour witness is representable, but **we have not conducted or validated a
four-pour-minimum search**. Such a test must attack all one-/two-/three-pour orders
and legal doses, and distinguish an additional meaningful ingredient decision
from extra shots required only by the dose cap. The constructive recipe bound is
two additions for three paints, three for four paints, four for five paints—but
it is conditional on dose legality and is not a minimum on color scoring.

See [the terminology and algebra explanation](premix-search-terms.md) for the
derivation and caveats. No claim of mathematical impossibility is inferred from
failure of numerical searches.

## Reproducible archive

[premix-ablation-1/summary.json](premix-ablation-1/summary.json) summarizes the run.
The directory also contains every initial recipe, paint snapshot, condition,
optimization history, measured witness, shortcut controls, algebraic construction,
fresh-check result, settings and source hash. The additional substitution anchor
is explicitly labeled and excluded from parent-cohort yield figures.

To repeat, use a new output directory:
`COMPARISON_OUTPUT=docs/premix-ablation-2 node --import tsx scripts/compare-premix-hybrid.ts`.
The current run refuses to overwrite its archive. Twenty-one automated tests,
TypeScript checking and the deployment build passed. No live gameplay, palette,
pigment, tolerance, sound or lab contents were changed.
