// Render the reproducible offline audit as a readable report; no player data.
import {readFileSync,writeFileSync} from 'node:fs';
const matrix=JSON.parse(readFileSync('docs/play-competition-matrix.json','utf8')) as {version:string;rows:{palette:string;kind:string;proposed:number;eligible:number;medianEfficientBaseCoverage:number|null;medianTravelBalance:number|null;medianMinimumTravel:number|null;medianMinimumFinish:number|null;medianTimingMarginMs:number|null}[]};
const candidates=JSON.parse(readFileSync('docs/play-candidate-audit.json','utf8')) as {palettes:{name:string;candidates:unknown[]}[]};
const kinds=['chromatic-ride','value-finish','quiet-cool','interior','choice','precision','muted'];
const row=(palette:string,kind:string)=>matrix.rows.find(r=>r.palette===palette&&r.kind===kind)!;
const fmt=(n:number|null,percent=false)=>n===null?'—':percent?`${Math.round(n*100)}%`:n.toFixed(1);
const lines=[
  '# Competing routes: palette × hole-type audit',
  '',
  `Bank: ${matrix.version}. Ten unchanged palettes. ${candidates.palettes.reduce((n,p)=>n+p.candidates.length,0)} analyzed, nontrivial, typed candidates. Four five-hole rounds selected per palette.`,
  '',
  '## Candidate yield by type',
  '',
  'Cells are eligible / proposed candidates. Types overlap; do not add columns. A dash means this sample produced none, not that the type is impossible. Types are computed from candidate routes, not seven independent recipe generators. Only chromatic rides receive a new hard rejection here; the other types receive route-aware ranking in addition to their existing tests.',
  '',
  '| Palette | Ride | Value finish | Quiet cool | Interior | Ingredient choice | Precision | Muted |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...candidates.palettes.map(p=>`| ${p.name} | ${kinds.map(k=>{const r=row(p.name,k);return r.proposed?`${r.eligible}/${r.proposed}`:'—';}).join(' | ')} |`),
  '',
  '## What the routes reveal',
  '',
  'Medians below use proposed candidates, before the new ride filter. Efficient coverage is the share of palette paints admitting the globally fewest additions found. Minimum travel is the shortest found route among each base’s fewest-addition routes, in display-world units. Travel balance compares those per-base lengths only among equally shot-efficient bases; a longer rescue from another start does not invalidate a good ride. Timing is a local one-coordinate margin, not the width of the full setup/finish region.',
  '',
  '| Palette | Interior efficient starts | Interior minimum travel | Ride travel balance | Precision timing margin (ms) |',
  '|---|---:|---:|---:|---:|',
  ...candidates.palettes.map(p=>`| ${p.name} | ${fmt(row(p.name,'interior').medianEfficientBaseCoverage,true)} | ${fmt(row(p.name,'interior').medianMinimumTravel)} | ${fmt(row(p.name,'chromatic-ride').medianTravelBalance,true)} | ${fmt(row(p.name,'precision').medianTimingMarginMs)} |`),
  '',
  '## Selection rules now using this evidence',
  '',
  '- Rides must retain at least 14 units of minimum found travel and a shortest/longest travel ratio of at least 0.40 among equally shot-efficient starts. These are tunable design thresholds, not perceptual laws.',
  '- Interior, ingredient-choice and muted candidates gain preference for efficient starting-base coverage, multi-addition starts and minimum competing travel.',
  '- Value finishes are ranked partly by the smallest competing final leg, rather than only the attractive example’s final leg. The tag still means a white/black finish exists; it does not claim every route requires one.',
  '- Precision retains the separate no-one-addition-shortcut test and the most forgiving found minimum-shot route’s timing margin. Shortness alone is not a rejection.',
  '- Palette-specific quotas, common tolerance, free base selection, pigment strengths and the charge/parts model are unchanged.',
  '',
  '## Limits and reproduction',
  '',
  'Every base and every distinct first paint is searched. Each ordered one-addition path has 65 samples; each ordered two-addition surface has a 17×17 grid. Three separated sample seeds per order receive local refinement. Feasible permutations of the generating recipe provide additional witnesses, sometimes with three additions. Other three-addition routes are not exhaustively searched. The algorithm minimizes endpoint error, not travel: “minimum found travel” is a comparison of successful candidates, not a certified travel minimum. Failure to find a route does not prove it impossible.',
  '',
  'Candidate yield depends on the deterministic recipe sample and current paint approximations. This is evidence about available route structure, not a numerical proof of fun or a full palette ranking. The complete per-target/per-base results are in play-candidate-audit.json; all 70 palette/type cells are in play-competition-matrix.json.',
  '',
  'Run build-play-courses.ts, then report-play-competition.ts with the existing TypeScript bundling workflow. Archived courses-2 holes remain valid for saved lab replays. New attempts use courses-3; compare the versions explicitly.',
  '',
];
writeFileSync('docs/play-competition-report.md',lines.join('\n'));
