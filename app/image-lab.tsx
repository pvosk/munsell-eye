'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MUNSELL_COLORS, NEUTRALS, type MunsellColor } from './munsell-data';
import { suggestPaintRecipe } from './paint-mixing';

type RGB = [number, number, number];
type Lab = readonly [number, number, number];
type ImageMode = 'original' | 'block' | 'value';
type QuantizedImage = { width: number; height: number; labels: Uint8Array; counts: number[] };
type Sample = { x: number; y: number; rgb: RGB; color: MunsellColor };

const INITIAL_CHIP_COUNT = 7;
const MAX_CHIP_COUNT = 18;
const rgbCss = (rgb: RGB) => `rgb(${rgb.join(',')})`;
const chipCss = (color: MunsellColor) => rgbCss(color.rgb);
const notation = (color: MunsellColor) => color.h === 'N' ? `N${color.v}` : `${color.h} ${color.v}/${color.c}`;

function rgbToOklab(rgb: RGB): Lab {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const l = .4122214708 * linear[0] + .5363325363 * linear[1] + .0514459929 * linear[2];
  const m = .2119034982 * linear[0] + .6806995451 * linear[1] + .1073969566 * linear[2];
  const s = .0883024619 * linear[0] + .2817188376 * linear[1] + .6299787005 * linear[2];
  const lr = Math.cbrt(l); const mr = Math.cbrt(m); const sr = Math.cbrt(s);
  return [
    .2104542553 * lr + .793617785 * mr - .0040720468 * sr,
    1.9779984951 * lr - 2.428592205 * mr + .4505937099 * sr,
    .0259040371 * lr + .7827717662 * mr - .808675766 * sr,
  ];
}

const CHIP_LABS = [...MUNSELL_COLORS, ...NEUTRALS].map((color) => ({ color, lab: rgbToOklab(color.rgb) }));

function labDistance(first: ArrayLike<number>, second: ArrayLike<number>) {
  return (first[0] - second[0]) ** 2 * 1.2 + (first[1] - second[1]) ** 2 + (first[2] - second[2]) ** 2;
}

function nearestChipFromLab(lab: ArrayLike<number>) {
  return CHIP_LABS.reduce((best, entry) => {
    const distance = labDistance(lab, entry.lab);
    return distance < best.distance ? { color: entry.color, distance } : best;
  }, { color: CHIP_LABS[0].color, distance: Number.POSITIVE_INFINITY }).color;
}

function nearestChip(rgb: RGB) {
  return nearestChipFromLab(rgbToOklab(rgb));
}

function buildLabField(data: ImageData) {
  const labs = new Float32Array(data.width * data.height * 3);
  for (let index = 0; index < data.width * data.height; index++) {
    const offset = index * 4;
    const lab = rgbToOklab([data.data[offset], data.data[offset + 1], data.data[offset + 2]]);
    labs[index * 3] = lab[0]; labs[index * 3 + 1] = lab[1]; labs[index * 3 + 2] = lab[2];
  }
  return labs;
}

function initialPalette(labs: Float32Array, width: number, height: number) {
  const pixels = width * height;
  const stride = Math.max(1, Math.ceil(pixels / 14000));
  const samples: number[] = [];
  for (let index = 0; index < pixels; index += stride) samples.push(index);
  const mean = samples.reduce<[number, number, number]>((sum, index) => [
    sum[0] + labs[index * 3], sum[1] + labs[index * 3 + 1], sum[2] + labs[index * 3 + 2],
  ], [0, 0, 0]).map((channel) => channel / samples.length) as [number, number, number];
  const first = samples.reduce((best, index) => labDistance(mean, labs.subarray(index * 3, index * 3 + 3)) < labDistance(mean, labs.subarray(best * 3, best * 3 + 3)) ? index : best, samples[0]);
  const centroids: number[][] = [[labs[first * 3], labs[first * 3 + 1], labs[first * 3 + 2]]];

  while (centroids.length < 14) {
    let farthest = samples[0]; let farthestDistance = -1;
    for (const index of samples) {
      const sample = labs.subarray(index * 3, index * 3 + 3);
      const distance = Math.min(...centroids.map((centroid) => labDistance(sample, centroid)));
      if (distance > farthestDistance) { farthest = index; farthestDistance = distance; }
    }
    centroids.push([labs[farthest * 3], labs[farthest * 3 + 1], labs[farthest * 3 + 2]]);
  }

  let counts = new Array(centroids.length).fill(0);
  for (let iteration = 0; iteration < 6; iteration++) {
    const sums = centroids.map(() => [0, 0, 0]);
    counts = new Array(centroids.length).fill(0);
    for (const index of samples) {
      const sample = labs.subarray(index * 3, index * 3 + 3);
      let nearest = 0; let distance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, centroidIndex) => {
        const next = labDistance(sample, centroid);
        if (next < distance) { nearest = centroidIndex; distance = next; }
      });
      sums[nearest][0] += sample[0]; sums[nearest][1] += sample[1]; sums[nearest][2] += sample[2]; counts[nearest] += 1;
    }
    centroids.forEach((centroid, index) => {
      if (!counts[index]) return;
      centroid[0] = sums[index][0] / counts[index]; centroid[1] = sums[index][1] / counts[index]; centroid[2] = sums[index][2] / counts[index];
    });
  }

  const candidates = [...new Map(centroids.map((lab, index) => {
    const color = nearestChipFromLab(lab);
    return [notation(color), { color, count: counts[index], lab: rgbToOklab(color.rgb) }] as const;
  })).values()].sort((a, b) => b.count - a.count);
  const selected = candidates.length ? [candidates.shift()!] : [{ color: NEUTRALS[4], count: 1, lab: rgbToOklab(NEUTRALS[4].rgb) }];
  while (selected.length < INITIAL_CHIP_COUNT && candidates.length) {
    let bestIndex = 0; let bestScore = -1;
    candidates.forEach((candidate, index) => {
      const separation = Math.min(...selected.map((entry) => labDistance(candidate.lab, entry.lab)));
      const coverage = Math.pow(candidate.count / Math.max(1, samples.length), .55);
      const score = coverage * (.025 + separation);
      if (score > bestScore) { bestIndex = index; bestScore = score; }
    });
    selected.push(candidates.splice(bestIndex, 1)[0]);
  }
  return selected.map((entry) => entry.color);
}

function quantizeToPalette(labs: Float32Array, width: number, height: number, palette: MunsellColor[]): QuantizedImage {
  const paletteLabs = palette.map((color) => rgbToOklab(color.rgb));
  const labels = new Uint8Array(width * height);
  for (let index = 0; index < labels.length; index++) {
    const offset = index * 3;
    const l = labs[offset]; const a = labs[offset + 1]; const b = labs[offset + 2];
    let nearest = 0; let distance = Number.POSITIVE_INFINITY;
    paletteLabs.forEach((lab, paletteIndex) => {
      const next = (l - lab[0]) ** 2 * 1.2 + (a - lab[1]) ** 2 + (b - lab[2]) ** 2;
      if (next < distance) { nearest = paletteIndex; distance = next; }
    });
    labels[index] = nearest;
  }
  let cleaned = labels;
  const neighborCounts = new Uint8Array(palette.length);
  for (let pass = 0; pass < 2; pass++) {
    const next = cleaned.slice();
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      neighborCounts.fill(0);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighborCounts[cleaned[(y + dy) * width + x + dx]] += 1;
      let majority = cleaned[index];
      for (let color = 0; color < palette.length; color++) if (neighborCounts[color] > neighborCounts[majority]) majority = color;
      if (neighborCounts[majority] >= 5) next[index] = majority;
    }
    cleaned = next;
  }
  const counts = new Array(palette.length).fill(0);
  cleaned.forEach((label) => { counts[label] += 1; });
  return { width, height, labels: cleaned, counts };
}

export default function ImageLab({ selectedPaintIds, onSendToMixer }: {
  selectedPaintIds: string[];
  onSendToMixer: (color: MunsellColor) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawDataRef = useRef<ImageData | null>(null);
  const labFieldRef = useRef<Float32Array | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const pressRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const chipPressRef = useRef<number | undefined>(undefined);
  const chipRemovedRef = useRef(false);
  const [mode, setMode] = useState<ImageMode>('block');
  const [palette, setPalette] = useState<MunsellColor[]>([]);
  const [quantized, setQuantized] = useState<QuantizedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceName, setSourceName] = useState('Fruit study example');
  const [sourceVersion, setSourceVersion] = useState(0);
  const [selectedKey, setSelectedKey] = useState('');
  const [sample, setSample] = useState<Sample | null>(null);
  const [zoom, setZoom] = useState(1);

  const loadSource = useCallback((src: string, name: string) => {
    setLoading(true);
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = src.startsWith('blob:') ? '' : 'anonymous';
    image.onload = () => {
      const scale = Math.min(560 / image.naturalWidth, 480 / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const rawCanvas = document.createElement('canvas');
      rawCanvas.width = width; rawCanvas.height = height;
      const rawContext = rawCanvas.getContext('2d', { willReadFrequently: true });
      if (!rawContext) return;
      rawContext.drawImage(image, 0, 0, width, height);
      const raw = rawContext.getImageData(0, 0, width, height);
      const softened = document.createElement('canvas');
      softened.width = width; softened.height = height;
      const softContext = softened.getContext('2d', { willReadFrequently: true });
      if (!softContext) return;
      softContext.filter = `blur(${Math.max(.8, Math.min(1.6, Math.min(width, height) / 300))}px)`;
      softContext.drawImage(rawCanvas, 0, 0);
      const labs = buildLabField(softContext.getImageData(0, 0, width, height));
      const nextPalette = initialPalette(labs, width, height);
      rawDataRef.current = raw;
      labFieldRef.current = labs;
      originalCanvasRef.current = rawCanvas;
      setSourceName(name);
      setPalette(nextPalette);
      setSelectedKey(notation(nextPalette[0] ?? NEUTRALS[4]));
      setSample(null);
      setZoom(1);
      setSourceVersion((version) => version + 1);
      setLoading(false);
    };
    image.onerror = () => setLoading(false);
    image.src = src;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadSource('/practice/still-life-fruit.jpg', 'Fruit study example'), 0);
    return () => { window.clearTimeout(timer); if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, [loadSource]);

  useEffect(() => {
    const raw = rawDataRef.current;
    const labs = labFieldRef.current;
    if (!raw || !labs || !sourceVersion || !palette.length) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      setQuantized(quantizeToPalette(labs, raw.width, raw.height, palette));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [palette, sourceVersion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const raw = rawDataRef.current;
    if (!canvas || !raw || !quantized) return;
    canvas.width = raw.width; canvas.height = raw.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    if (mode === 'original' && originalCanvasRef.current) { context.drawImage(originalCanvasRef.current, 0, 0); return; }
    const output = context.createImageData(quantized.width, quantized.height);
    for (let index = 0; index < quantized.labels.length; index++) {
      const chip = palette[quantized.labels[index]] ?? palette[0] ?? NEUTRALS[4];
      const color = mode === 'value' ? NEUTRALS[Math.max(0, Math.min(8, chip.v - 1))] : chip;
      const offset = index * 4;
      output.data[offset] = color.rgb[0]; output.data[offset + 1] = color.rgb[1]; output.data[offset + 2] = color.rgb[2]; output.data[offset + 3] = 255;
    }
    context.putImageData(output, 0, 0);
  }, [mode, palette, quantized]);

  const paletteRows = useMemo(() => palette.map((color, index) => ({ color, count: quantized?.counts[index] ?? 0 })).sort((a, b) => b.color.v - a.color.v || a.color.h.localeCompare(b.color.h) || a.color.c - b.color.c), [palette, quantized]);
  const selectedColor = sample?.color ?? palette.find((color) => notation(color) === selectedKey) ?? paletteRows[0]?.color ?? NEUTRALS[4];
  const recipe = useMemo(() => suggestPaintRecipe(selectedColor, selectedPaintIds), [selectedColor, selectedPaintIds]);
  const representedValues = useMemo(() => [...new Set(paletteRows.filter((entry) => entry.count).map((entry) => entry.color.v))].sort((a, b) => b - a), [paletteRows]);

  const sampleAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const raw = rawDataRef.current;
    if (!canvas || !raw) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(raw.width - 1, Math.floor((clientX - rect.left) / rect.width * raw.width)));
    const y = Math.max(0, Math.min(raw.height - 1, Math.floor((clientY - rect.top) / rect.height * raw.height)));
    const radius = Math.max(1, Math.round(Math.min(raw.width, raw.height) * .006));
    let r = 0; let g = 0; let b = 0; let count = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.max(0, Math.min(raw.width - 1, x + dx)); const sy = Math.max(0, Math.min(raw.height - 1, y + dy)); const offset = (sy * raw.width + sx) * 4;
      r += raw.data[offset]; g += raw.data[offset + 1]; b += raw.data[offset + 2]; count += 1;
    }
    const rgb = [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as RGB;
    const next = { x: x / raw.width, y: y / raw.height, rgb, color: nearestChip(rgb) };
    setSample(next); setSelectedKey(notation(next.color)); return next;
  }, []);

  const addChip = useCallback((color = sample?.color) => {
    if (!color) return;
    setPalette((current) => current.some((entry) => notation(entry) === notation(color)) || current.length >= MAX_CHIP_COUNT ? current : [...current, color]);
    setSelectedKey(notation(color));
  }, [sample]);

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    sampleAt(event.clientX, event.clientY); event.currentTarget.setPointerCapture(event.pointerId);
    pressRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const press = pressRef.current; if (!press || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.moved = true;
    sampleAt(event.clientX, event.clientY);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const press = pressRef.current; const next = sampleAt(event.clientX, event.clientY);
    if (press && !press.moved && next) addChip(next.color);
    pressRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const beginChipHold = (color: MunsellColor) => {
    chipRemovedRef.current = false;
    if (chipPressRef.current) window.clearTimeout(chipPressRef.current);
    chipPressRef.current = window.setTimeout(() => {
      if (palette.length <= 2) return;
      chipRemovedRef.current = true;
      setPalette((current) => current.filter((entry) => notation(entry) !== notation(color)));
      setSample(null);
    }, 520);
  };
  const endChipHold = () => { if (chipPressRef.current) window.clearTimeout(chipPressRef.current); chipPressRef.current = undefined; };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file); loadSource(objectUrlRef.current, file.name.replace(/\.[^.]+$/, '')); event.target.value = '';
  };

  return (
    <section className="image-lab" aria-labelledby="image-lab-title">
      <header className="image-lab-head">
        <div><span className="eyebrow">Image</span><h1 id="image-lab-title">Build a Munsell block-in</h1><p>Begin with seven large color masses, then add only the chips the painting needs.</p></div>
        <div><input accept="image/*" hidden onChange={chooseFile} ref={fileRef} type="file" /><button className="outline-button" onClick={() => fileRef.current?.click()} type="button">Choose image</button></div>
      </header>
      <div className="image-lab-toolbar">
        <div className="segmented image-mode-switch" aria-label="Image view">{([['original', 'Original'], ['block', 'Block-in'], ['value', 'Value']] as const).map(([id, label]) => <button className={mode === id ? 'active' : ''} key={id} onClick={() => setMode(id)} type="button">{label}</button>)}</div>
        <label className="image-zoom"><span>Zoom <strong>{Math.round(zoom * 100)}%</strong></span><button aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((current) => Math.max(1, current - .25))} type="button">−</button><input aria-label="Image zoom" max="3" min="1" onChange={(event) => setZoom(Number(event.target.value))} step=".25" type="range" value={zoom} /><button aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((current) => Math.min(3, current + .25))} type="button">+</button></label>
      </div>
      <div className="image-lab-stage">
        <div className="image-lab-viewport"><div className="image-lab-canvas-wrap" style={{ width: `${zoom * 100}%` }}><canvas aria-label={`${sourceName}, ${mode} view`} onPointerCancel={pointerUp} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} ref={canvasRef} />{sample && <span className="image-lab-sample" style={{ background: chipCss(sample.color), left: `${sample.x * 100}%`, top: `${sample.y * 100}%` }} />}</div></div>
        {loading && <span className="image-lab-loading">Resolving the color masses…</span>}<span className="image-lab-instruction">Tap to add a chip · drag to inspect</span>
      </div>
      {mode === 'value' && <div className="image-value-key" aria-label={`Represented Munsell values ${representedValues.join(', ')}`}><span>Values in this block-in</span>{representedValues.map((value) => <i key={value} style={{ background: chipCss(NEUTRALS[value - 1]) }}>N{value}</i>)}</div>}
      <div className="mass-dock" aria-label="Munsell block-in palette ordered from light to dark">
        {paletteRows.map(({ color }) => <button aria-label={`${notation(color)}. Hold to remove.`} className={notation(color) === selectedKey ? 'active' : ''} key={notation(color)} onClick={() => { if (chipRemovedRef.current) { chipRemovedRef.current = false; return; } setSelectedKey(notation(color)); setSample(null); }} onContextMenu={(event) => event.preventDefault()} onPointerCancel={endChipHold} onPointerDown={() => beginChipHold(color)} onPointerLeave={endChipHold} onPointerUp={endChipHold} style={{ background: chipCss(color) }} type="button"><span>{color.v}</span></button>)}
      </div>
      <p className="mass-dock-note">{palette.length} Munsell chips · hold a chip to remove it</p>
      <div className="sample-sheet">
        <div className="sample-identity"><span className="sample-large" style={{ background: chipCss(selectedColor) }} /><div><span className="eyebrow">Closest Munsell chip</span><strong>{notation(selectedColor)}</strong></div></div>
        <div className="sample-actions"><button className="outline-button" disabled={!sample || palette.some((color) => notation(color) === notation(sample.color))} onClick={() => addChip()} type="button">Add chip</button><button className="dark-button" onClick={() => onSendToMixer(selectedColor)} type="button">Send to Mix</button></div>
        {recipe && <div className="sample-paint-match"><span style={{ background: rgbCss(recipe.rgb) }} /><small>Closest from active palette</small><strong>{recipe.ingredients.map(({ paint, parts }) => `${parts} ${paint.name}`).join(' · ')}</strong></div>}
      </div>
    </section>
  );
}
