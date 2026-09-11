import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_LEVELS,LANDING_TOLERANCE} from '../app/play-engine';
import {rideModes} from './search-rides-muted';
import {experienceSupported} from '../app/play-experience-audit';
import type {JourneyAudit} from '../app/play-journey-analysis';
import type {PaintColor} from '../app/paint-mixing';
type Item={id:string;method:string;seed:number;recipe:number[];audit:JourneyAudit};
type Results={sourceHash:string;cache:string;seconds:number;evaluations:number;protocol:{seeds:number[];methods:string[]};rows:{palette:{id:string;name:string;family:string;paints:PaintColor[]};items:Omit<Item,'audit'>[];finalists:Item[];portfolio:{selected:string[]}}[]};
const data=JSON.parse(readFileSync('docs/play-rides-muted-results.json','utf8')) as Results;
const screen=(p:PaintColor[],q:number[])=>{const key=createHash('sha256').update(JSON.stringify([p,q,'128/24',undefined])).digest('hex');return JSON.parse(readFileSync(data.cache+'/'+key+'.json','utf8')) as JourneyAudit;};
const lines=['# Dedicated rides and dark/light/muted palettes','',
 '## Main findings from this run','',
 '- Direct-ride proposals yielded 20/90 screening hits versus 4/90 for broad sampling; on the fresh seed, 9/45 versus 4/45. This is useful evidence for proposal selection, not a statistical guarantee.',
 '- Setup→ride proposals yielded 7/90 screening ride hits; fresh-seed yield was 4/45, exactly the broad baseline. Only 33 of their 2,880 cheap proposals met the intended structural setup/finish condition before competition. This first setup sampler needs work; it is not a solved generator.',
 '- Stronger checks retained seven ride and eight value-shift finalists. None was an every-base-resistant ride. One CMY value-shift candidate was every-base-resistant under the retained supported-route search.',
 '- Most promising new four-paint ride candidate: Perylene Maroon / Hansa Yellow Light / Raw Sienna / Cobalt Blue. Ride opportunities from 3/4 starts; minimum supported travel across all starts about 28 display units. Non-ride alternatives remain.',
 '- Most directly relevant muted triad: Burnt Sienna / Nickel Titanate Yellow / Cobalt Green. One target offers value shifts from 3/3 starts, with minimum supported travel about 19 units. Non-shift alternatives exist from all three bases.',
 '- Dioxazine Purple / Cadmium Yellow Deep / Sap Green supplied separate ride and shift candidates. Its ride has an approximately 11-unit shortest supported approach, so it is less aligned with the preference for consistently substantial travel.',
 '- The current targeted pass found no eligible dense ride/shift finalist for Magenta Grove or Secondaries. This does not invalidate their archived interior holes or rule out better ride/shift targets: only two selected targets per palette were densely rechecked, and interiors were not the objective.',
 '- No palette or hole is player-approved by these calculations. The conservative portfolio selector retains nine distinct candidates across the cohort, but only two finalists were checked per palette; this is not a five-hole course search.',
 '',
 '## Scope','',
 `Completed ${data.evaluations} audits across 15 fixed palettes: 360 screening evaluations and 30 denser rechecks with extra three-addition exploration. Runtime: ${(data.seconds/60).toFixed(1)} minutes.`,
 'Eight independent dark/light/muted triads, two explicitly constructed four-paint Zorn-adjacent combinations, and five controls. The new combinations exclude separate white/black paints AND catalogue formulas containing PW or PBk pigments. Standard palettes are unchanged.',
 'Muted means lower chroma in the existing modeled masstone, not a guarantee that its mixtures stay muted. The first four triads restrict that role to earth/oxide paints. These are modeled paint definitions, not newly measured spectral reflectance.',
 'Each palette receives 96 proposals per method and seed, with three shortlisted targets audited. Methods: direct ride, setup→ride, bidirectional value shift, and broad recipe sampling. Total: 11,520 cheap proposals. The same four methods repeat on a fresh seed; palettes and thresholds are fixed before any results.',
 'The broad baseline audits its first three separated targets. Directed methods rank all 96 first. This is equal competing-route audit budget, NOT equal total compute or an unbiased rate over all possible targets. Fresh targets test proposal repeatability on the same palettes, not independent palette selection.',
 '', '## Uniform screening results','',
 'These counts use the original 128/24 screening audits, recovered from the cache. They are not final acceptance rates. Later dense failures are retained separately rather than blended into this comparison. Styles overlap.',
 '', '| Seed | Proposal method | Audited | General checks pass | Ride eligible | Value shift eligible |', '|---|---|---:|---:|---:|---:|'];
for(const seed of data.protocol.seeds)for(const method of data.protocol.methods){const all=data.rows.flatMap(r=>r.items.filter(c=>c.seed===seed&&c.method===method).map(c=>screen(r.palette.paints,c.recipe)));lines.push(`| ${seed===data.protocol.seeds[0]?'First':'Fresh'} | ${method} | ${all.length} | ${all.filter(a=>!a.failures.length).length} | ${all.filter(a=>a.styles.ride.eligible).length} | ${all.filter(a=>a.styles['value-shift'].eligible).length} |`);}
lines.push('', '## Stronger checks: all palettes','',
 'Two targets per palette are selected by the existing lexicographic ranking, first for rides and then for value shifts, without selecting the same target twice. A selected target can serve both styles. This selection is NOT an exhaustive test of every promising screening hit.',
 '', '| Palette | Family | Ride finalists | Shift finalists | Distinct retained holes |', '|---|---|---:|---:|---:|');
for(const r of data.rows)lines.push(`| ${r.palette.name} | ${r.palette.family} | ${r.finalists.filter(c=>c.audit.styles.ride.eligible).length} | ${r.finalists.filter(c=>c.audit.styles['value-shift'].eligible).length} | ${r.portfolio.selected.length} |`);
lines.push('', '## Individually archived candidates','',
 'Every finalist, including failed stronger checks, is stored with exact paint definitions, target recipe and per-base route witnesses in `play-rides-muted-results.json`. Qualifying one-offs are retained even when the palette offers only one candidate. A two-candidate portfolio is not evidence of a complete five-hole course.', '');
const scratch=PLAY_LEVELS.length;PLAY_LEVELS.push({name:'Report only',subtitle:'',paints:[],tolerance:LANDING_TOLERANCE});
for(const row of data.rows){PLAY_LEVELS[scratch].paints=row.palette.paints;
 for(const c of row.finalists){const a=c.audit,modes=rideModes({...a,palette:scratch});
  lines.push(`### ${c.id}`,'',row.palette.name,'',`Proposed by **${c.method}**. General failures: ${a.failures.join(', ')||'none'}.`,
   `Ride: ${a.styles.ride.available.length}/${a.bases.length} starts available, ${a.styles.ride.resistant.length}/${a.bases.length} resistant, eligible=${a.styles.ride.eligible}. Direct-ride starts: ${modes.direct.join(', ')||'none'}; setup→chromatic-finish starts: ${modes.setup.join(', ')||'none'}.`,
   `Value shift: ${a.styles['value-shift'].available.length}/${a.bases.length} starts available, ${a.styles['value-shift'].resistant.length}/${a.bases.length} resistant, eligible=${a.styles['value-shift'].eligible}.`,
   `Minimum supported travel across starts: ${a.minTravel.toFixed(1)} display units.`, '', '| Base | Fewest additions found | Start distance / tolerance | Supported minimum travel | Shift directions |', '|---|---:|---:|---:|---|');
  for(const b of a.bases){const directions=[...new Set(b.routes.filter(r=>r.efficient&&experienceSupported(r)&&r.traits['value-shift']).map(r=>r.finish!.signedValue>0?'up':'down'))];lines.push(`| ${row.palette.paints[b.base].name} | ${b.fewest??'unresolved'} | ${b.startDistance.toFixed(2)} | ${b.approach.minTravel?.toFixed(1)??'unresolved'} | ${directions.join(', ')||'none'} |`);}lines.push('');
 }
}PLAY_LEVELS.pop();
lines.push('## Interpretation limits','',
 '- “Eligible” keeps the existing every-base general checks and at least two-thirds efficient style availability. It does not mean every route or every base delivers that style.',
 '- “Resistant” means no supported non-style competitor was retained from that base, not a proof that no shortcut exists. Narrower successful routes remain in the raw evidence.',
 '- Ride classification requires a long chromatic stroke and high chromatic fraction, not a literal gamut-boundary proof. Setup→ride additionally requires prior setup travel and a long final chromatic stroke.',
 '- Value shifts can go up or down, must follow setup, and cannot be supplied by the free base selection. Chromatic value shifts can overlap with balancing.',
 '- Route support still uses 55 ms finishing windows and 4% local setup coverage. Neither control settings nor these filters changed.',
 '- No par, tolerance, paint strength, live lab, animation or course sequence changed. Browser testing is not relevant to this offline search. Player testing is still needed.',
 '',`Source fingerprint: ${data.sourceHash}. Full screening evidence archive: outputs/play-rides-muted-evidence-${data.sourceHash.slice(0,12)}.tar.gz. The compact results and this report are stored alongside the search scripts.`,'');
writeFileSync('docs/play-rides-muted-findings.md',lines.join('\n'));
console.log(lines.slice(0,42).join('\n'));
