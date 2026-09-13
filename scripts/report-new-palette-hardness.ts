import {readFileSync,writeFileSync} from 'node:fs';
const run=JSON.parse(readFileSync('docs/play-new-palette-hardness.json','utf8'));
const check=JSON.parse(readFileSync('docs/play-new-palette-hardness-challenge.json','utf8'));
const names=['Chromium Crossing','Greenlight Warmth','Nickel Orange','Crimson Greenlight','Naples Violet Green','Hansa Violet Teal','Secondaries · Green Shade','Warm Teal Cluster','Ochre Maroon Cerulean','Nickel Sienna','Naples Terre Violet','Chromatic Three','Magenta Yellow Green','Umber Quartet','Five-Paint Field','Naples Sienna Spectrum'];
const lines=['# New-palette harder-target search','',
'## Outcome and scope','',
`Fresh proposals: ${run.results.length*run.policy.targetsPerPalette} across ${run.results.length} existing newer palettes. Short-route numerical screens: ${run.results.reduce((s:number,r:any)=>s+r.screened.length,0)}. Deeper checks: ${run.results.reduce((s:number,r:any)=>s+r.deep.length,0)}. Fresh-seed rechecks: ${check.results.length}. Endpoint replays passed: ${check.replayed}.`,
'',
`Retained without a found one-addition shortcut: ${check.results.filter((r:any)=>r.retained).length}. Of those, ${check.results.filter((r:any)=>r.threeMeaningfulAll).length} also retain a minimum of at least three additions across every base, with at least three meaningful additions in the retained supported witnesses.`,
'',
'These are fresh recipe proposals, not a re-ranking of the previous 30 finalists. The pigment combinations themselves are the 16 recent portfolio palettes, not newly invented palettes. No live lab, scoring, par, pigment strength, sound, or controls changed.',
'',
'## Per-palette results','',
'Raw/support arrays follow pigment order below. Numbers are additions AFTER the free starting paint. A 3/4 supported minimum does not mean a raw three-addition endpoint is impossible; timing/setup support is a separate qualification.','',
'| Palette | Pigments | Retained IDs: raw → supported | At least three from every base |','|---|---|---|---|'];
for(const [i,r] of run.results.entries()){
 const kept=r.deep.filter((h:any)=>check.results.find((c:any)=>c.id===h.proposal.id)?.retained);
 lines.push(`| ${names[i]} | ${r.trial.paints.map((p:any)=>p.name).join(' / ')} | ${kept.map((h:any)=>`${h.proposal.id}: [${h.checked.bases.map((b:any,i:number)=>Math.min(b.rawFewest??Infinity,check.results.find((c:any)=>c.id===h.proposal.id).raw[i]??Infinity))}] → [${h.checked.bases.map((b:any)=>b.supportedFewest)}]`).join('; ')||'None in this bounded shortlist'} | ${kept.filter((h:any)=>check.results.find((c:any)=>c.id===h.proposal.id)?.threeMeaningfulAll).length} |`);
}
lines.push('','## Search disagreements retained','');
for(const row of run.results)for(const h of row.deep){const c=check.results.find((c:any)=>c.id===h.proposal.id);if(!c)continue;
 for(const [i,b] of h.checked.bases.entries())if(c.raw[i]!==null&&c.raw[i]<(b.rawFewest??Infinity))lines.push(`- ${h.proposal.id}, ${b.paint}: first raw minimum ${b.rawFewest}, fresh-seed challenger ${c.raw[i]}. The table uses the shorter witness; timing support for the new witness is not established by this second pass.`);
}
lines.push('','## Interpretation and limits','',
'- Proposal ranking seeks separation from sampled one/two-addition routes, with a second lane targeting robust two-addition setups. Each palette received 512 proposals; only four diverse candidates were screened and two deeply checked. This is not exhaustive palette optimization.',
'- The coarse atlas is a proposal heuristic: its shortcut distance can overestimate the true minimum. It never proves shortcut absence. Independent target-only coordinate searches challenge all ordered one/two/three additions, including repeated pigments; a fresh seed additionally challenges all one/two orders with 384 samples, 14 restarts and up to 200 refinement iterations.',
'- Deep verification uses raw endpoint minima separately from finishing-window/setup support (existing 55 ms / 4% policy). Timing-supported route minima remain search-dependent. For five-paint targets, exact-recipe witnesses can contain four additions; the target-only search stops at three. No exhaustive four-addition optimality claim.',
'- All stored raw and retained supported endpoints were replayed. Rejected candidates and shortcut witnesses remain in the JSON archives. The fresh-seed challenge is a numerical robustness check, not a different physical model or a proof over continuous controls.',
'- No candidate was required to match a ride or lift label. Harder interior structure is the objective here. This does not establish long-ride quality, enjoyment, whole-course variety, or robustness after a future control/tolerance change.',
'- Many strongest targets are still mixed interior colors. Do not build an entire course from this difficulty objective or equate every passing two-addition target with a demanding hole.',
'',
'## Clear next steps','',
'1. Current live v66 lab remains unchanged: it is a familiar harder-reference set, not this new search.',
'2. Next lab should use a small selection of freshly qualified newer-palette targets, led by the every-base three-addition finalists; include a few clearly labeled two-addition/shortcut-bearing contrasts rather than publishing every survivor.',
'3. Player review should test different free bases and distinguish interesting setup decisions from mere extra pours. Then select campaign/bank candidates; do not tighten tolerance to manufacture difficulty.',
'',
'Archives: `docs/play-new-palette-hardness.json` and `docs/play-new-palette-hardness-challenge.json`. Reproduce with the three matching search/check/report scripts, using new archive paths for future runs.');
writeFileSync('docs/play-new-palette-hardness.md',lines.join('\n')+'\n');
