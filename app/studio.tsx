'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { HUE_ORDER, MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';

const FAMILIES = ['R', 'YR', 'Y', 'GY', 'G', 'BG', 'B', 'PB', 'P', 'RP'] as const;
type Family = (typeof FAMILIES)[number];
type Study = 'albers' | 'klee' | 'ostwald' | 'vanderpoel' | 'gartside';

const STUDIES: { id: Study; name: string; eyebrow: string; description: string }[] = [
  { id: 'albers', name: 'Relativity', eyebrow: 'After Josef Albers', description: 'One identical color is held inside two different grounds. The center chips never change—only their context does.' },
  { id: 'klee', name: 'Color movement', eyebrow: 'After Paul Klee', description: 'A field of stepped hue, value and chroma rhythms. Every transition is built from discrete Munsell chips.' },
  { id: 'ostwald', name: 'Constant-hue triangle', eyebrow: 'After Wilhelm Ostwald', description: 'A triangular path between light, dark and chromatic color, translated into the nearest available Munsell chips.' },
  { id: 'vanderpoel', name: 'Proportion study', eyebrow: 'After Emily Noyes Vanderpoel', description: 'A ten-by-ten abstraction for seeing the balance, interval and area of a small palette.' },
  { id: 'gartside', name: 'Color field', eyebrow: 'After Mary Gartside', description: 'Soft, asymmetric color masses evoke Gartside’s painted blots while the palette below preserves the exact Munsell sources.' },
];

const rgb = (color: MunsellColor) => `rgb(${color.rgb.join(',')})`;
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;
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
          <span style={{ background: rgb(center) }} aria-label={index === 0 ? `Identical center color ${notation(center)}` : undefined} />
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
  const hue = studyHues(family, seed)[0];
  const rows = useMemo(() => Array.from({ length: 9 }, (_, row) => (
    Array.from({ length: row + 1 }, (_, column) => {
      const white = (8 - row) / 8;
      const chromatic = row ? column / row : 0;
      const black = 1 - white - chromatic * (1 - white);
      const value = Math.max(1, Math.min(9, Math.round(1 + white * 8 + chromatic * 4 - black)));
      const chroma = Math.max(0, Math.min(12, 2 * Math.round(chromatic * 6)));
      return chroma === 0 ? closestChip('N', value, 0) : closestChip(hue, value, chroma);
    })
  )), [hue]);
  return (
    <>
      <div className="study-canvas study-ostwald">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex}>
            {row.map((color, index) => <span key={`${index}-${notation(color)}`} style={{ background: rgb(color) }} />)}
          </div>
        ))}
      </div>
      <PaletteLegend colors={[rows[0][0], rows[4][0], rows[4][4], rows[8][0], rows[8][8]]} />
    </>
  );
}

function VanderpoelStudy({ colors, seed }: { colors: MunsellColor[]; seed: number }) {
  const cells = useMemo(() => Array.from({ length: 100 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    const diagonal = column > row + ((seed % 3) - 1) ? 1 : 0;
    const stripe = Math.floor(row / 3) + Math.floor(column / 4);
    return colors[(stripe + diagonal * 2 + (row > 6 && column < 3 ? 1 : 0)) % colors.length];
  }), [colors, seed]);
  return (
    <div className="study-canvas study-vanderpoel">
      {cells.map((color, index) => <span key={`${index}-${notation(color)}`} style={{ background: rgb(color) }} />)}
    </div>
  );
}

function GartsideStudy({ colors, seed }: { colors: MunsellColor[]; seed: number }) {
  const blobs = useMemo(() => {
    const random = randomFor(seed * 97 + 11);
    return Array.from({ length: 12 }, (_, index) => {
      const color = colors[index % colors.length];
      return {
        color,
        style: {
          '--blob-color': `rgba(${color.rgb.join(',')}, .88)`,
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

export default function StudioView() {
  const [study, setStudy] = useState<Study>('albers');
  const [family, setFamily] = useState<Family | 'Any'>('Any');
  const [seed, setSeed] = useState(4);
  const colors = useMemo(() => paletteFor(family, seed), [family, seed]);
  const current = STUDIES.find((entry) => entry.id === study) ?? STUDIES[0];

  return (
    <section className="studio-view" aria-labelledby="studio-title">
      <div className="reference-intro studio-intro">
        <span className="eyebrow">Studio</span>
        <h1 id="studio-title">Color Studies</h1>
        <p>Historically informed structures, rebuilt as living studies with discrete Munsell chips. Change the family or generate another arrangement.</p>
      </div>

      <nav className="study-tabs" aria-label="Color study system">
        {STUDIES.map((entry) => <button className={study === entry.id ? 'active' : ''} key={entry.id} onClick={() => setStudy(entry.id)} type="button">{entry.id === 'vanderpoel' ? 'Vanderpoel' : entry.id[0].toUpperCase() + entry.id.slice(1)}</button>)}
      </nav>

      <div className="studio-controls">
        <label>
          <span>Hue family</span>
          <select value={family} onChange={(event) => setFamily(event.target.value as Family | 'Any')}>
            <option value="Any">All families</option>
            {FAMILIES.map((entry) => <option value={entry} key={entry}>{entry}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setSeed((currentSeed) => currentSeed + 1)}>New variation</button>
      </div>

      <article className="study-card">
        <header>
          <div><span className="eyebrow">{current.eyebrow}</span><h2>{current.name}</h2></div>
          <p>{current.description}</p>
        </header>
        {study === 'albers' && <AlbersStudy colors={colors} />}
        {study === 'klee' && <KleeStudy family={family} seed={seed} />}
        {study === 'ostwald' && <OstwaldStudy family={family} seed={seed} />}
        {study === 'vanderpoel' && <VanderpoelStudy colors={colors} seed={seed} />}
        {study === 'gartside' && <GartsideStudy colors={colors} seed={seed} />}
        {!['klee', 'ostwald'].includes(study) && <PaletteLegend colors={colors} />}
        <small className="study-method-note">Generated from discrete Munsell chips · representative notation shown in the palette</small>
      </article>
    </section>
  );
}
