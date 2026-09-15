# Campaign and touch release

The public Play entry now opens the fixed 32-hole, 17-chapter normalized-premix campaign selected in `premix-campaign-draft-1.json`. Zorn is second; Cobalt Ember ends the sequence. Original free-start courses and historical lab specimens remain available. New campaign specimens are also selectable in the lab for synced attempts and notes. Public scorecards are device-local latest completed scores, not synced lab history or a fresh competitive round. Skipping a chapter does not mark it complete.

Par is provisional: executable example releases plus one adjustment, minimum three. Pigment legs are not substituted for releases. Every example is replay-validated at its existing .0294 tolerance. No pigment strength, mixing rule, projection, or landing tolerance changed.

Live input is version `touch-2`. A small blend softens the bar's initial motion, the dose exponent changes from four to 3.85, and a smooth proximity coefficient makes ordinary holds finer near the target while slightly lifting the very low range. It reaches exactly the same .005–8 dose ratio endpoints. Full range remains available; no per-pigment distance normalization or auto-aim. The coefficient is frozen at charge start. The meter uses 17 cached actual-mixture color stops. A short faded prismatic curve is cached per charge, without an endpoint marker.

Archived `chargeAmount`, inverses and route seconds are unchanged. New shots store canonical legacy-equivalent `seconds` for compatibility, alongside actual `heldSeconds` and `controlsVersion`. The event validator checks this mapping. Timing-supported search measurements are not automatically evidence for the new player timing. Composition-space regions and reachability are unchanged.

Winning paths use a distance-based final approach, longer for longer shots. Absorption is proximity-driven instead of waiting until 78% of flight time. Original recipe endpoints still determine qualification. Misses keep their existing behavior.

Character prism rim now darkens only 15% in bright environments; the bright outline/halos no longer turn dark gray. Removed in-map Destination label and parts beside the charge bar. Shot/par numbers take priority; menu links share button typography, padding and hover/focus feedback.

Projection diagnostic: 128 directions around each of 32 campaign targets, at the existing OKLab tolerance, produced projected distances ranging from 0.331 to 1.770 times the displayed mean-axis radius. These are sampled extrema across all targets, not a universal value-vs-hue ratio. The spherical guide is not the exact accepted region; this release does not change it.

Checks: campaign example endpoints, new and archived event replay, monotone/symmetric controls with unchanged range, capture endpoint preservation, input cancellation and lab navigation. Browser checks cover campaign selection, menu links and scene rendering. Treat touch and provisional par as playtest material, not settled calibration.
