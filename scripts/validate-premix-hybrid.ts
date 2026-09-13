import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { LIVE_LANDING_TOLERANCE as T, type ColorPoint } from '../app/play-engine';
import { searchPremix } from './premix-search';
import { cleanupAttack, POLICY, targetOf, type Puzzle } from './premix-hybrid';

// Fresh, recipe-blind challenge of survivors, not another optimization pass.
// Deliberately uses the coordinate-pattern solver rather than proposal gradients.
const directory = process.argv[2] ?? 'docs/premix-hybrid-2';
const output = `${directory}/fresh-validation.json`;
if (existsSync(output)) throw Error('Fresh validation archive already exists');
const audits = JSON.parse(readFileSync(`${directory}/audits.json`, 'utf8'));
const regressions = JSON.parse(readFileSync(`${directory}/regressions.json`, 'utf8'));
const rows = [...audits, ...regressions].filter(r => r.passes && r.p.control.order.length === 3);
const results = [];
for (const row of rows) {
  const { p, target } = row as {p: Puzzle; target: ColorPoint};
  const runs = [812719, 1928711].map(seed => {
    const search = searchPremix(0, p.start, target, 'normalized', 2, seed, 768, 32, p.paints);
    return { ...search, bestT: search.best.map(e => e / T) };
  });
  const cleanup = cleanupAttack(p, 7131921, 512, 64, target);
  const bestT = [0, 1].map(i => Math.min(...runs.map(r => r.bestT[i])));
  const initial = row.optimization?.initial;
  const baseline = initial ? searchPremix(0, initial.start, targetOf(initial), 'normalized', 2, 812719, 768, 32, initial.paints) : null;
  const result = {
    id: p.id, paints: p.paints.map(p => p.name), bestT, runs, cleanup,
    baseline: baseline ? { ...baseline, bestT: baseline.best.map(e => e / T) } : null,
    survives: bestT[0] >= POLICY.almostOne && bestT[1] >= POLICY.shorterMargin && (!cleanup.best || cleanup.best.error > T),
  };
  results.push(result);
  writeFileSync(output, JSON.stringify({
    policy: POLICY, note: 'Fresh seeds and denser numerical challenge; no global infeasibility certificate. Historical anchors are calibration, not held-out human evaluation.', results,
  }));
  console.log(JSON.stringify({ id: result.id, bestT, baselineT: result.baseline?.bestT, survives: result.survives }));
}
