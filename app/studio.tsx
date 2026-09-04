'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';

const FAMILIES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'] as const;
type Family = (typeof FAMILIES)[number];
type Study = 'harmony' | 'albers' | 'klee' | 'ostwald' | 'vanderpoel' | 'gartside';

const STUDIES: { id: Study; name: string; eyebrow: string; description: string }[] = [
  { id: 'harmony', name: 'Munsell harmonies', eyebrow: 'Create and export', description: 'Build familiar harmony structures while keeping value and chroma visible. Every screen color resolves to a discrete Munsell chip that can be sent directly to Mix.' },
  { id: 'albers', name: 'Relativity', eyebrow: 'After Josef Albers', description: 'One identical square is nested inside two different grounds. The three-color study isolates how context changes appearance.' },
  { id: 'klee', name: 'Color movement', eyebrow: 'After Paul Klee', description: 'A field of stepped hue, value and chroma rhythms. Every transition is built from discrete Munsell chips.' },
  { id: 'ostwald', name: 'Complement field', eyebrow: 'After Wilhelm Ostwald', description: 'Diametrically opposed hues share a diamond field. White content rises, black content falls and chromatic strength moves toward either edge.' },
  { id: 'vanderpoel', name: 'Color problems', eyebrow: 'After Emily Noyes Vanderpoel', description: 'Cellular ten-by-ten arrangements explore proportion, borders, axes and connected masses using a limited palette.' },
  { id: 'gartside', name: 'Color field', eyebrow: 'After Mary Gartside', description: 'Opaque asymmetric masses evoke Gartside’s painted blots without pretending that screen transparency behaves like watercolor.' },
];

const rgb = (color: MunsellColor) => `rgb(${color.rgb.join(',')})`;
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;
const hex = (color: MunsellColor) => `#${color.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
const wrap = (index: number) => ((index % HUE_ORDER.length) + HUE_ORDER.length) % HUE_ORDER.length;

function randomFor(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result ^= result + Math.imul(result ^ result >>> 7, 61 | result);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function randomSeed(previous: number) {
  const array = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(array);
  const next = array[0] || Math.floor(Math.random() * 0xffffffff);
  return next === previous ? (next + 1) >>> 0 : next;
}

function closestChip(hue: string, value: number, chroma: number) {
  if (hue === 'N') return NEUTRALS[Math.max(0, Math.min(8, Math.round(value) - 1))];
  const candidates = MUNSELL_COLORS.filter((color) => color.h === hue);
  return [...candidates].sort((a, b) => (
    Math.abs(a.v - value) * 7 + Math.abs(a.c - chroma)
    - Math.abs(b.v - value) * 7 - Math.abs(b.c - chroma)
  ))[0];
}

function studyHues(family: Family | 'Any', seed: number) {
  const eligible = family === 'Any' ? [...HUE_ORDER] : HUE_ORDER.filter((hue) => hue.endsWith(family));
  const first = eligible[seed % eligible.length] ?? HUE_ORDER[0];
  const index = HUE_ORDER.indexOf(first);
  return [first, HUE_ORDER[wrap(index + 7)], HUE_ORDER[wrap(index + 16)], HUE_ORDER[wrap(index + 25)], HUE_ORDER[wrap(index + 33)]];
}

function paletteFor(family: Family | 'Any', seed: number) {
  const hues = studyHues(family, seed);
  const settings = [[6, 8], [4, 6], [7, 4], [5, 10], [3, 4]];
  return hues.map((hue, index) => closestChip(hue, settings[index][0], settings[index][1]));
}

function PaletteLegend({ colors }: { colors: MunsellColor[] }) {
  const unique = [...new Map(colors.map((color) => [notation(color), color])).values()];
  return (
    <div className="study-palette" aria-label="Munsell source chips">
      {unique.map((color) => (
        <span className="study-palette-chip" key={notation(color)}>
          <i style={{ background: rgb(color) }} />
          <small>{notation(color)}</small>
        </span>
      ))}
    </div>
  );
}

function AlbersStudy({ colors }: { colors: MunsellColor[] }) {
  const center = colors[0];
  return (
    <div className="study-canvas study-albers">
      {[colors[1], colors[3]].map((ground, index) => (
        <div className="albers-ground" key={notation(ground)} style={{ background: rgb(ground) }}>
          <span style={{ background: rgb(center) }} aria-label={index === 0 ? `Identical inner square ${notation(center)}` : undefined} />
        </div>
      ))}
    </div>
  );
}

function KleeStudy({ family, seed }: { family: Family | 'Any'; seed: number }) {
  const cells = useMemo(() => {
    const random = randomFor(seed * 41 + 5);
    const baseHue = studyHues(family, seed)[0];
    const base = HUE_ORDER.indexOf(baseHue);
    return Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8);
      const column = index % 8;
      const hue = HUE_ORDER[wrap(base + Math.round((column - row) * 1.3 + Math.sin(row * .9) * 3))];
      const value = Math.max(2, Math.min(8, Math.round(3 + column * .45 + Math.sin((row + column) * .8) * 1.2)));
      const chroma = Math.max(2, Math.min(12, 2 * Math.round(1 + row * .45 + random() * 2)));
      return closestChip(hue, value, chroma);
    });
  }, [family, seed]);
  return (
    <>
      <div className="study-canvas study-klee">
        {cells.map((color, index) => <span key={`${index}-${notation(color)}`} style={{ background: rgb(color) }} />)}
      </div>
      <PaletteLegend colors={[cells[0], cells[9], cells[27], cells[45], cells[63]]} />
    </>
  );
}

function OstwaldStudy({ family, seed }: { family: Family | 'Any'; seed: number }) {
  const baseHue = studyHues(family, seed)[0];
  const complementHue = HUE_ORDER[wrap(HUE_ORDER.indexOf(baseHue) + HUE_ORDER.length / 2)];
  const cells = useMemo(() => Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const horizontal = column - 4;
    const value = Math.max(1, Math.min(9, Math.round(9 - row)));
    if (horizontal === 0) return closestChip('N', value, 0);
    const distance = Math.abs(horizontal) / 4;
    const middleStrength = Math.max(.25, 1 - Math.abs(row - 4) / 7);
    const chroma = Math.max(2, Math.min(12, 2 * Math.round(distance * middleStrength * 6)));
    return closestChip(horizontal < 0 ? baseHue : complementHue, value, chroma);
  }), [baseHue, complementHue]);
  return (
    <>
      <div className="study-canvas study-ostwald">
        <span className="ostwald-axis white">More white</span>
        <span className="ostwald-axis black">More black</span>
        <span className="ostwald-axis left">{baseHue}</span>
        <span className="ostwald-axis right">{complementHue}</span>
        <div className="ostwald-diamond">
          {cells.map((color, index) => <span key={`${index}-${notation(color)}`} style={{ background: rgb(color) }} />)}
        </div>
      </div>
      <PaletteLegend colors={[cells[36], cells[40], cells[44], cells[4], cells[76]]} />
    </>
  );
}

function VanderpoelStudy({ colors, seed }: { colors: MunsellColor[]; seed: number }) {
  const result = useMemo(() => {
    const names = ['Cellular field', 'Framed field', 'Cross axis', 'Diagonal current', 'Nested blocks', 'Woven bands', 'Split rhythm', 'Stepped islands'];
    const random = randomFor(seed * 131 + 17);
    const pattern = seed % names.length;
    let indexes = Array.from({ length: 100 }, () => Math.min(colors.length - 1, Math.floor(Math.pow(random(), 1.35) * colors.length)));

    // A small cellular pass joins isolated chips into the connected masses seen in Vanderpoel's grids.
    for (let pass = 0; pass < 2; pass++) {
      indexes = indexes.map((current, index, source) => {
        const row = Math.floor(index / 10);
        const column = index % 10;
        const neighbors = [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
          .filter(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10)
          .map(([r, c]) => source[r * 10 + c]);
        const counts = neighbors.reduce<Record<number, number>>((all, value) => ({ ...all, [value]: (all[value] ?? 0) + 1 }), {});
        const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return majority && majority[1] >= 2 && random() < .76 ? Number(majority[0]) : current;
      });
    }

    indexes = indexes.map((current, index) => {
      const row = Math.floor(index / 10);
      const column = index % 10;
      if (pattern === 1 && (row === 0 || row === 9 || column === 0 || column === 9)) return 0;
      if (pattern === 1 && row >= 3 && row <= 6 && column >= 3 && column <= 6) return 2;
      if (pattern === 2 && (row === 4 || column === 5)) return row === 4 && column === 5 ? 4 : 1;
      if (pattern === 3 && Math.abs(column - row) <= 1) return 3;
      if (pattern === 4 && Math.min(row, column, 9 - row, 9 - column) % 2 === 0) return (Math.min(row, column, 9 - row, 9 - column) / 2) % colors.length;
      if (pattern === 5 && (row % 3 === 0 || column % 4 === 1)) return (row + column) % colors.length;
      if (pattern === 6 && column < 5) return (current + (row > 5 ? 1 : 0)) % colors.length;
      if (pattern === 7 && column >= row - 1 && column <= row + 2) return (Math.floor(row / 3) + 1) % colors.length;
      return current;
    });
    return { cells: indexes.map((index) => colors[index]), name: names[pattern] };
  }, [colors, seed]);
  return (
    <>
      <div className="study-canvas study-vanderpoel">
        {result.cells.map((color, index) => <span key={`${index}-${notation(color)}`} style={{ background: rgb(color) }} />)}
      </div>
      <span className="study-variation-name">Arrangement · {result.name}</span>
    </>
  );
}

function GartsideStudy({ colors, seed }: { colors: MunsellColor[]; seed: number }) {
  const blobs = useMemo(() => {
    const random = randomFor(seed * 97 + 11);
    return Array.from({ length: 10 }, (_, index) => {
      const color = colors[index % colors.length];
      return {
        color,
        style: {
          '--blob-color': rgb(color),
          '--blob-left': `${4 + random() * 70}%`,
          '--blob-top': `${2 + random() * 68}%`,
          '--blob-width': `${20 + random() * 30}%`,
          '--blob-height': `${14 + random() * 28}%`,
          '--blob-rotate': `${-38 + random() * 76}deg`,
          '--blob-radius': `${36 + random() * 32}% ${32 + random() * 38}% ${38 + random() * 30}% ${34 + random() * 36}%`,
        } as CSSProperties,
      };
    });
  }, [colors, seed]);
  return (
    <div className="study-canvas study-gartside">
      <span className="gartside-paper-mark one" />
      <span className="gartside-paper-mark two" />
      {blobs.map((blob, index) => <span className="gartside-blob" key={`${index}-${notation(blob.color)}`} style={blob.style} />)}
    </div>
  );
}

type Harmony = 'complementary' | 'split' | 'analogous' | 'triadic' | 'square' | 'monochromatic';

const HARMONIES: { id: Harmony; label: string; offsets: number[] }[] = [
  { id: 'complementary', label: 'Complement', offsets: [0, 20] },
  { id: 'split', label: 'Split', offsets: [0, 17, 23] },
  { id: 'analogous', label: 'Analogous', offsets: [-6, -3, 0, 3, 6] },
  { id: 'triadic', label: 'Triad', offsets: [0, 13, 27] },
  { id: 'square', label: 'Square', offsets: [0, 10, 20, 30] },
  { id: 'monochromatic', label: 'Single hue', offsets: [0, 0, 0, 0, 0] },
];

function downloadHarmony(colors: MunsellColor[]) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width / colors.length;
  colors.forEach((color, index) => {
    context.fillStyle = rgb(color);
    context.fillRect(index * width, 0, width + 1, canvas.height);
    context.fillStyle = color.v > 5 ? '#1d1d1b' : '#ffffff';
    context.font = '600 30px system-ui';
    context.fillText(notation(color), index * width + 28, canvas.height - 72);
    context.font = '22px system-ui';
    context.fillText(hex(color), index * width + 28, canvas.height - 38);
  });
  const link = document.createElement('a');
  link.download = 'munsell-harmony.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function HarmonyStudy({ family, onSendToMixer }: { family: Family | 'Any'; onSendToMixer?: (color: MunsellColor) => void }) {
  const [harmony, setHarmony] = useState<Harmony>('split');
  const [baseHue, setBaseHue] = useState('5YR');
  const [value, setValue] = useState(6);
  const [chroma, setChroma] = useState(8);
  const definition = HARMONIES.find((entry) => entry.id === harmony) ?? HARMONIES[0];
  const familyHues = family === 'Any' ? HUE_ORDER : HUE_ORDER.filter((hue) => hue.endsWith(family));

  useEffect(() => {
    if (!familyHues.includes(baseHue as (typeof HUE_ORDER)[number])) setBaseHue(familyHues[Math.floor(familyHues.length / 2)] ?? HUE_ORDER[0]);
  }, [baseHue, familyHues]);

  const colors = useMemo(() => {
    const base = HUE_ORDER.indexOf(baseHue as (typeof HUE_ORDER)[number]);
    return definition.offsets.map((offset, index) => {
      const hue = HUE_ORDER[wrap(base + offset)];
      if (harmony === 'monochromatic') return closestChip(hue, Math.max(2, Math.min(8, value - 2 + index)), Math.max(2, chroma - Math.abs(2 - index) * 2));
      return closestChip(hue, value, chroma);
    });
  }, [baseHue, chroma, definition.offsets, harmony, value]);

  const copyPalette = async () => {
    const text = colors.map((color) => `${notation(color)}  ${hex(color)}`).join('\n');
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  };

  return (
    <div className="harmony-study">
      <div className="harmony-builder">
        <div className="harmony-wheel" aria-label={`${definition.label} Munsell harmony`}>
          {colors.map((color, index) => {
            const hueIndex = HUE_ORDER.indexOf(color.h as (typeof HUE_ORDER)[number]);
            return <button aria-label={`${notation(color)}, send to Mix`} key={`${notation(color)}-${index}`} onClick={() => onSendToMixer?.(color)} style={{ '--harmony-angle': `${hueIndex * 9}deg`, '--harmony-color': rgb(color) } as CSSProperties} title={`Send ${notation(color)} to Mix`} type="button" />;
          })}
          <span><small>{definition.label}</small><strong>{baseHue}</strong></span>
        </div>
        <div className="harmony-controls">
          <div className="harmony-types">
            {HARMONIES.map((entry) => <button className={entry.id === harmony ? 'active' : ''} key={entry.id} onClick={() => setHarmony(entry.id)} type="button">{entry.label}</button>)}
          </div>
          <div className="harmony-sliders">
            <label><span>Base hue</span><select onChange={(event) => setBaseHue(event.target.value)} value={baseHue}>{familyHues.map((hue) => <option key={hue}>{hue}</option>)}</select></label>
            <label><span>Value <strong>{value}</strong></span><input max="8" min="2" onChange={(event) => setValue(Number(event.target.value))} type="range" value={value} /></label>
            <label><span>Chroma <strong>{chroma}</strong></span><input max="12" min="2" onChange={(event) => setChroma(Number(event.target.value))} step="2" type="range" value={chroma} /></label>
          </div>
        </div>
      </div>
      <div className="harmony-palette">
        {colors.map((color, index) => (
          <button key={`${notation(color)}-${index}`} onClick={() => onSendToMixer?.(color)} style={{ background: rgb(color), color: color.v > 5 ? '#1d1d1b' : '#fff' }} title="Send to Mix" type="button">
            <strong>{notation(color)}</strong><small>{hex(color)}</small>
          </button>
        ))}
      </div>
      <div className="harmony-actions"><button className="outline-button" onClick={() => void copyPalette()} type="button">Copy palette</button><button className="outline-button" onClick={() => downloadHarmony(colors)} type="button">Export image</button><small>Tap any color to send it to Mix.</small></div>
    </div>
  );
}

export default function StudioView({ onSendToMixer }: { onSendToMixer?: (color: MunsellColor) => void }) {
  const [study, setStudy] = useState<Study>('harmony');
  const [family, setFamily] = useState<Family | 'Any'>('Any');
  const [seed, setSeed] = useState(4);
  const colors = useMemo(() => paletteFor(family, seed), [family, seed]);
  const current = STUDIES.find((entry) => entry.id === study) ?? STUDIES[0];

  return (
    <section className="studio-view" aria-labelledby="studio-title">
      <div className="reference-intro studio-intro">
        <span className="eyebrow">Explore</span>
        <h1 id="studio-title">Color relationships</h1>
        <p>Generate harmonies, translate screen palettes into discrete Munsell chips, or move through historically informed systems of color.</p>
      </div>

      <nav className="study-tabs" aria-label="Color study system">
        {STUDIES.map((entry) => <button className={study === entry.id ? 'active' : ''} key={entry.id} onClick={() => setStudy(entry.id)} type="button">{entry.id === 'vanderpoel' ? 'Vanderpoel' : entry.id === 'harmony' ? 'Harmonies' : entry.id[0].toUpperCase() + entry.id.slice(1)}</button>)}
      </nav>

      <div className="studio-controls">
        <label>
          <span>Hue family</span>
          <select value={family} onChange={(event) => setFamily(event.target.value as Family | 'Any')}>
            <option value="Any">All families</option>
            {FAMILIES.map((entry) => <option value={entry} key={entry}>{entry}</option>)}
          </select>
        </label>
        {study !== 'harmony' && <button type="button" onClick={() => setSeed((currentSeed) => randomSeed(currentSeed))}>New variation</button>}
      </div>

      <article className="study-card">
        <header>
          <div><span className="eyebrow">{current.eyebrow}</span><h2>{current.name}</h2></div>
          <p>{current.description}</p>
        </header>
        {study === 'harmony' && <HarmonyStudy family={family} onSendToMixer={onSendToMixer} />}
        {study === 'albers' && <AlbersStudy colors={colors} />}
        {study === 'klee' && <KleeStudy family={family} seed={seed} />}
        {study === 'ostwald' && <OstwaldStudy family={family} seed={seed} />}
        {study === 'vanderpoel' && <VanderpoelStudy colors={colors} seed={seed} />}
        {study === 'gartside' && <GartsideStudy colors={colors} seed={seed} />}
        {study === 'albers' && <PaletteLegend colors={[colors[0], colors[1], colors[3]]} />}
        {['vanderpoel', 'gartside'].includes(study) && <PaletteLegend colors={colors} />}
        <small className="study-method-note">Generated from discrete Munsell chips · representative notation shown in the palette</small>
      </article>
    </section>
  );
}
