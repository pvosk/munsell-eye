import {readFileSync,writeFileSync} from 'node:fs';
type Hole={id:string;palette:string;notation:string;verdict:string;currentTags:string[];failures:string[];fewestAdditions:number;minTravel:number;travelBalance:number};
type Pool={palette:string;candidates:number;previousEligible:number;qualityEligible:number};
const [beforePath,afterPath,poolPath,output]=process.argv.slice(2);
if(!output)throw new Error('Provide baseline, calibrated, pool and output paths');
const before=JSON.parse(readFileSync(beforePath,'utf8')) as {holes:Hole[]};
const after=JSON.parse(readFileSync(afterPath,'utf8')) as {holes:Hole[]};
const pool=JSON.parse(readFileSync(poolPath,'utf8')) as {palettes:Pool[]};
const lines=['# Calibration against your reviewed holes','',
  '15 reviews grouped into 13 distinct holes: 6 keep, 4 revise, 3 reject. Repeated attempts do not count as independent evidence. “Revise” is not treated as “bad forever.” The public course bank has not been replaced.',
  '',
  '| Your judgment | Holes | Passed before | Pass provisional checks |',
  '|---|---:|---:|---:|',
  ...['keep','revise','reject'].map(v=>`| ${v} | ${after.holes.filter(h=>h.verdict===v).length} | ${before.holes.filter(h=>h.verdict===v&&h.currentTags.length).length} | ${after.holes.filter(h=>h.verdict===v&&h.currentTags.length).length} |`),
  '',
  '## What changed',
  '',
  'The former ride test removed a label, not necessarily the hole. The rejected Violet Shift hole could re-enter as ingredient choice. Short/asymmetric one-pour bypasses now fail across labels. A separate white/black-only one-pour bypass test catches the near-neutral Zorn routes. The successful easy Secondaries purple lift remains eligible; easy is not automatically inadequate.',
  '',
  '| Exact reviewed hole | Your judgment | Minimum additions found | Minimum efficient-route travel | Result |',
  '|---|---|---:|---:|---|',
  ...after.holes.map(h=>`| ${h.palette} · ${h.notation} | ${h.verdict} | ${h.fewestAdditions} | ${h.minTravel.toFixed(1)} | ${h.currentTags.length?'Retain':h.failures.join(', ')} |`),
  '',
  'Travel is in display-world units. The denser diagnostic checks 129 one-pour samples and a 25×25 two-pour grid with five separated refinement starts per order; the course evaluator uses 65 / 17×17 / three starts. Both use the original target recipe and real mixing/charge controls. Searches are sampled, not proofs of optimality.',
  '',
  '## Candidate-pool check',
  '',
  'These are the same 960 previously generated candidates, re-evaluated without player labels. This tests rule selectivity and supply, not whether new holes are enjoyable. Counts are whole-hole acceptance across all labels, not individual tag counts.',
  '',
  '| Palette | Candidates | Previously eligible | Provisionally eligible |',
  '|---|---:|---:|---:|',
  ...pool.palettes.map(p=>`| ${p.palette} | ${p.candidates} | ${p.previousEligible} | ${p.qualityEligible} |`),
  '',
  '## Confidence and limits',
  '',
  'All six keeps survive and all three rejects are flagged, but the same feedback informed these rules. This is calibration, not held-out accuracy. The existing 14-unit / 0.40 travel thresholds were extended across labels rather than finely fitted. A sensitivity check over travel floors 12, 14, 16, 18 and balance floors 0.30, 0.40, 0.50 retains the same verdict-level separation in this small reviewed set.',
  '',
  'Multi-pour candidates are not newly rejected by these single-pour rules. That is an unresolved coverage limit, not proof they are good: all five reviewed multi-pour targets were keeps, so this export supplies no rejected multi-pour examples to calibrate that distinction. Repetition needs round-level comparison; complete joint setup/finish timing regions remain unmeasured. A straightness threshold was not added: the kept easy purple lift is also nearly straight.',
  '',
  'Next: keep these rules provisional, assess palette-specific supply and round repetition, then compare a small new batch in the lab. Do not silently lower thresholds to fill five slots. No new player session is needed to reproduce this report.',
  '',
];
writeFileSync(output,lines.join('\n'));
