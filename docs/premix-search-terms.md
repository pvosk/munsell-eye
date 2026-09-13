# What the premix search variables mean

## Recipe, color, route, dose and minimum are different objects

- **Start recipe:** fractions of the original palette pigments in the prepared
  mixture. The forward mixing model turns this recipe into a displayed/scored
  color. We do not move an arbitrary RGB point and pretend it has a paint recipe.
- **Target recipe:** a realizable recipe used to propose a destination color.
  Landing is scored against that COLOR and its tolerance, not against exact pigment
  proportions. A different recipe that matches the color also wins.
- **Route order:** the sequence of paints added, such as red → yellow → white.
- **Dose:** the amount added by one action. The search parameter is hold duration;
  the existing charge curve converts that duration to parts. A dose is not a count
  of actions and not a fixed distance in the 3D view.
- **Witness / demonstration:** one known winning route and its doses. A three-pour
  witness does not establish that three pours are necessary.
- **Shortest found:** the smallest action count for which a challenger finds an
  accepted endpoint. “No shorter route found” remains a numerical search statement,
  unless a separate bound or proof establishes impossibility.
- **Timing-supported shortest found:** the smallest count with measured usable
  controls. A narrow raw shortcut still matters, even if it is hard to execute.

Moving the start or target recipe changes its color and the relationships between
the available shot curves. It is not simply sliding along the original witness
path. Different recipes can also have similar visible colors but different future
mixing responses, particularly when more pigments are available.

## A normalized shot has simple composition algebra

For a normalized recipe `p`, adding amount `a` of pigment `i` produces:

`p' = (p + a e_i) / (1 + a) = (1 - alpha) p + alpha e_i`, where `alpha = a/(1+a)`.

The composition change is linear along that simplex direction. Its image under
the spectral/color mapping is generally curved in the displayed color space.
Tinting strength remains inside that forward pigment model; it is not removed by
normalizing total mass.

In current controls, one normalized shot adds between 0.005 and 8 parts, giving
`alpha` between approximately 0.004975 and 0.888889. Thus a single shot cannot
replace all of the previous mixture. Repeated high-dose actions can be required
because of this cap rather than because of interesting ingredient choices.

## Why palette size matters—but does not dictate scored difficulty

For a full-support start recipe `p` and positive target recipe `q`, set:

`lambda = min_i(q_i / p_i)` and `d_i = q_i - lambda p_i`.

Then `q = lambda p + sum_i d_i e_i`, with nonnegative residuals and at least one
zero residual. Starting with the retained contribution `lambda p`, add the
nonzero residual pigments in any chosen order. Convert each cumulative addition
to a normalized share and then to its hold time.

There are at most `n - 1` distinct residual pigments for an `n`-paint palette.
Consequently, **if those per-action doses are legal**, this constructs an exact
recipe match using at most:

| Paints | Distinct additions in this exact-recipe construction |
|---|---:|
| 3 | 2 |
| 4 | 3 |
| 5 | 4 |

This is a conditional upper bound/construction, **not a lower bound on the game's
required pours**. A one-shot cap can require splitting an addition. Very small
required doses can also be below the control minimum. Exact pure targets cannot
be reached in finite shots from an impure start, but color tolerance can make them
reachable. Alternative recipes and accepted nearby colors can permit fewer pours.
The implemented algebraic attack records legal routes and failed dose constraints
instead of silently applying the unconstrained construction to gameplay.

The visible/scoring color has three coordinates; a five-paint recipe has four
independent proportions. More paints can supply additional routes to similar
colors, not automatically an extra required decision. At the same time, extra
paints change the possible gamut and value/chroma tradeoffs. These opposing
effects are why paint count alone is not a difficulty measure.

## What a four-pour finding would need

1. A legal, supported four-pour witness.
2. Independent search of all one-, two- and three-paint orders and their doses,
   including repeated paints and every accepted endpoint—not only the target
   recipe or witness order.
3. Tests for merged/split actions, deletion, small cleanup and meaningful movement.
4. Evidence that the extra action is interesting, not just repeated dilution forced
   by the maximum shot size.

The broad hybrid runs so far proposed two-/three-pour witnesses and attacked at
most two-pour shortcuts. They **did not conduct a four-pour-minimum search**.
We cannot infer four-pour scarcity or existence from those runs, or claim that
failure to find more three-pour finalists proves the design space is exhausted.
