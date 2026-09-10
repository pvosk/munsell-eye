# Provisional quality checks — not yet a new course bank

The published courses-3 bank is unchanged. The offline evaluator now rejects three structural problems across labels: a successful single-pour route with minimum found travel below 14 display units; travel balance below 0.40 among equally shot-efficient starts when a one-pour solution exists; and a successful white/black-only single-pour shortcut. A candidate cannot evade rejection by changing from ride to ingredient-choice or value-finish.

These are course-design choices, not general claims that short, easy or neutral mixing is bad. The existing course identities do not promise dedicated neutral-axis exercises. A future such exercise would need an explicit exception/category, not a hidden fallback.

The travel thresholds were already in the ride evaluator. Calibration extended their scope and added the neutral-only bypass check, rather than fitting a finely tuned numerical boundary to every review. It preserves short multi-pour precision candidates. This does not certify them as good: setup/finish regions, route-shape variety and sequence repetition remain unmeasured.

`scripts/calibrate-play-feedback.ts INPUT OUTPUT` re-evaluates exact archived targets from a supplied export, grouping repeated reviews by hole. It uses original target recipes, not slightly off-center solution recipes. Raw feedback remains outside the site. `scripts/audit-play-quality.ts OUTPUT` measures the effect on the existing unreviewed candidate pool without changing courses. Both scripts use the existing bundling workflow.

The calibration report is a fit to the same feedback used to formulate the rules, not held-out validation. Do not call the resulting acceptance counts a quality score. A future course replacement must have a new version and preserve prior lab snapshots; the bank writer now refuses changed content under an existing version.
