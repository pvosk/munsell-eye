# Premix-start experimental fork — discussion boundary

The round-12 release does not enable premixed starts or normalize mass. These are proposed experiments, not implemented gameplay or validated puzzles.

## Preserve composition

Represent a starting mixture by original pigment quantities, not a displayed RGB swatch. `mixtureColor` remixes those original pigments using normalized quantities and the existing tinting strengths. Equal displayed colors can conceal different compositions and subsequent mixing behavior. A start outside the selectable palette's gamut requires additional fixed pigments in the state, not fabricated RGB paint.

## Current versus normalized transitions

For total mass M >= 1, `chargeAmount` adds M^0.8 times the hold ratio r. The added share is a/(M+a), so the relative dose is r M^-0.2. The same hold loses influence as accumulated mass increases. Color itself depends on proportions, not absolute mass.

Normalizing the recipe to total 1 between shots retains pigment proportions and strengths. With the existing mass-1 charge rule, a shot updates proportions as p'=(p+r e_i)/(1+r). Equivalently p'=(1-alpha)p+alpha e_i, where alpha=r/(1+r). The trajectory is still an original-pigment mixture path, but the attainable segment and timing response change. Do not recycle the previous RGB as a new pigment. Do not remove proportions.

For a proposed finishing composition p' and paint i, its predecessor is p=(p'-alpha e_i)/(1-alpha). Nonnegative components and legal charge bounds constrain alpha. This is a useful backward proposal equation in recipe space; the spectral color map, perceptual tolerance volume, and competing sequences still require search and validation. Fixing a starting recipe removes alternative free-base branches, not alternative routes from that state.

## Recommended experimental order

1. Separate premix mode, preserving current mass/charge behavior and actual recipes. Search explicit start/destination pairs, check shortest raw and supported alternatives, then assess intended style availability/bypasses.
2. Compare the same starts and targets with total-mass normalization. Preserve spectral pigment strengths. Recompute control witnesses and finishing/setup support: old timing and difficulty certificates do not carry over.
3. Evaluate clearer control response versus loss of accumulation/consequence. Only then decide a mode's final mechanics or launch campaign design.

Likely benefit: normalized composition is a smaller planning state than composition plus accumulated mass, making a given state and hold more repeatable. Likely tradeoff: corrections no longer become less influential because of accumulated quantity. Neither fixed starts nor normalization guarantees interesting or uniquely styled routes.
